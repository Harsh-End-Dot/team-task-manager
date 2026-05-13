/**
 * End-to-end API smoke test: migrates DB, starts server, exercises auth/projects/tasks/dashboard.
 * Requires PostgreSQL (e.g. `docker compose up -d` in repo root) and a built server (`npm run build`).
 *
 * Usage:
 *   docker compose up -d
 *   npm run build
 *   npm run test:smoke
 */
import { spawn, execSync, execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const serverDir = path.join(root, "server");

const DEFAULT_URL = "postgresql://ttm:ttm@127.0.0.1:54333/ttm";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

/** If not ok, reads body as text and throws. If ok, leaves body unread for .json(). */
async function ensureOk(res, label) {
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`${label} failed ${res.status}: ${t}`);
  }
}

async function main() {
  const DATABASE_URL = process.env.DATABASE_URL || DEFAULT_URL;
  const PORT = String(process.env.SMOKE_PORT || process.env.PORT || 40199);
  const JWT_SECRET = process.env.JWT_SECRET || "smoke-test-jwt-secret";
  const BASE = `http://127.0.0.1:${PORT}`;

  console.log("Smoke test: DATABASE_URL=%s… PORT=%s", DATABASE_URL.slice(0, 36), PORT);

  execSync("npx prisma migrate deploy", {
    cwd: serverDir,
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL },
    shell: true,
  });

  const srv = spawn(process.execPath, ["dist/index.js"], {
    cwd: serverDir,
    env: {
      ...process.env,
      DATABASE_URL,
      PORT,
      JWT_SECRET,
      NODE_ENV: "development",
      CLIENT_ORIGIN: "http://localhost:5173",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stderr = "";
  srv.stderr?.on("data", (c) => {
    stderr += String(c);
  });

  const shutdown = () => {
    try {
      srv.kill("SIGTERM");
    } catch {
      /* ignore */
    }
    if (process.platform === "win32" && srv.pid) {
      try {
        execFileSync("taskkill", ["/PID", String(srv.pid), "/T", "/F"], { stdio: "ignore" });
      } catch {
        /* ignore */
      }
    }
  };

  process.on("exit", shutdown);

  try {
    let ok = false;
    for (let i = 0; i < 60; i++) {
      try {
        const r = await fetch(`${BASE}/api/health`);
        if (r.ok) {
          ok = true;
          break;
        }
      } catch {
        /* not up yet */
      }
      await sleep(250);
    }
    assert(ok, `Server did not become healthy on ${BASE}/api/health.\n${stderr}`);

    const email = `smoke_${Date.now()}@example.com`;
    const password = "smokepass123";

    const reg = await fetch(`${BASE}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name: "Smoke User" }),
    });
    await ensureOk(reg, "register");
    const { token } = await reg.json();
    assert(token, "no token from register");

    const me = await fetch(`${BASE}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
    await ensureOk(me, "me");

    const proj = await fetch(`${BASE}/api/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: "Smoke Project", description: "test" }),
    });
    await ensureOk(proj, "create project");
    const project = await proj.json();
    const projectId = project.id;

    const list = await fetch(`${BASE}/api/projects`, { headers: { Authorization: `Bearer ${token}` } });
    await ensureOk(list, "list projects");
    const projects = await list.json();
    assert(Array.isArray(projects) && projects.some((p) => p.id === projectId), "project not in list");

    const task = await fetch(`${BASE}/api/projects/${projectId}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        title: "Smoke task",
        description: "d",
        status: "TODO",
        dueDate: new Date(Date.now() + 864e5).toISOString(),
      }),
    });
    await ensureOk(task, "create task");
    const taskRow = await task.json();
    const taskId = taskRow.id;

    const patch = await fetch(`${BASE}/api/projects/${projectId}/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: "IN_PROGRESS" }),
    });
    await ensureOk(patch, "patch task");

    const dash = await fetch(`${BASE}/api/dashboard`, { headers: { Authorization: `Bearer ${token}` } });
    await ensureOk(dash, "dashboard");
    const d = await dash.json();
    assert(typeof d.projects === "number", "dashboard shape");
    assert(d.tasksByStatus && typeof d.tasksByStatus.TODO === "number", "dashboard status counts");

    console.log("OK — smoke test passed (register, me, project, tasks, patch, dashboard).");
  } finally {
    process.off("exit", shutdown);
    shutdown();
    await sleep(300);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
