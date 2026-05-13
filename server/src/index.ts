import "express-async-errors";
import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { assertProductionEnv, env } from "./lib/env.js";
import authRoutes from "./routes/auth.js";
import projectRoutes from "./routes/projects.js";
import memberRoutes from "./routes/members.js";
import taskRoutes from "./routes/tasks.js";
import dashboardRoutes from "./routes/dashboard.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

assertProductionEnv();

if (!env.DATABASE_URL) {
  console.error(`
[server] Missing DATABASE_URL.

Add it to .env at the project repo root or in server/.env, for example:

  DATABASE_URL="postgresql://USER:PASSWORD@localhost:54333/ttm"

Local Postgres (Docker): from the repo root run  docker compose up -d
Then use: postgresql://ttm:ttm@127.0.0.1:54333/ttm
`);
  process.exit(1);
}

const app = express();
app.use(
  cors({
    origin: env.NODE_ENV === "production" ? true : env.CLIENT_ORIGIN,
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRoutes);
app.use("/api/projects/:projectId/members", memberRoutes);
app.use("/api/projects/:projectId/tasks", taskRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/dashboard", dashboardRoutes);

const staticDir = path.join(__dirname, "../public");
if (fs.existsSync(staticDir)) {
  app.use(express.static(staticDir));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(staticDir, "index.html"));
  });
}

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(env.PORT, () => {
  console.log(`Server listening on port ${env.PORT}`);
});
