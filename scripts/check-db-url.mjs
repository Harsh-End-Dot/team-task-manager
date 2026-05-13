/**
 * Fail fast before Vite starts if the API would exit without DATABASE_URL
 * (avoids confusing AggregateError [ECONNREFUSED] on /api proxy).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

function readDatabaseUrlFromFile(filePath) {
  if (!fs.existsSync(filePath)) return "";
  const txt = fs.readFileSync(filePath, "utf8");
  for (const line of txt.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    if (key !== "DATABASE_URL") continue;
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    return val;
  }
  return "";
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fromRoot = readDatabaseUrlFromFile(path.join(root, ".env"));
const fromServer = readDatabaseUrlFromFile(path.join(root, "server", ".env"));
const url = (process.env.DATABASE_URL || fromServer || fromRoot || "").trim();

if (!url) {
  console.error(`
[dev] DATABASE_URL is not set, so the API will not start and Vite will show ECONNREFUSED.

Fix:
  1. Copy .env.example to .env in this folder: ${root}
  2. Set DATABASE_URL (see comments in .env.example)
  3. Example after  docker compose up -d :
       DATABASE_URL="postgresql://ttm:ttm@127.0.0.1:54333/ttm"

Then run: npm run dev
`);
  process.exit(1);
}

process.exit(0);
