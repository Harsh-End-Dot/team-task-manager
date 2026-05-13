import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.resolve(__dirname, "../..");
const repoDir = path.resolve(serverDir, "..");

// Monorepo: `npm run dev -w server` uses cwd `server/`, so default dotenv misses repo-root `.env`.
dotenv.config({ path: path.join(repoDir, ".env") });
dotenv.config({ path: path.join(serverDir, ".env"), override: true });

const required = (name: string): string => {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
};

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: Number(process.env.PORT) || 4000,
  DATABASE_URL: process.env.DATABASE_URL ?? "",
  JWT_SECRET: process.env.JWT_SECRET ?? "dev-only-change-in-production",
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
};

export function assertProductionEnv(): void {
  if (env.NODE_ENV === "production") {
    if (!env.DATABASE_URL) throw new Error("DATABASE_URL required in production");
    if (env.JWT_SECRET === "dev-only-change-in-production") {
      throw new Error("Set JWT_SECRET in production");
    }
  }
}
