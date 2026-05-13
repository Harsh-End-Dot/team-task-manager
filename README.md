# Team Task Manager

Full-stack web app for projects, team membership with **Admin** / **Member** roles, task assignment, status tracking, and a cross-project dashboard (including overdue counts).

## Stack

- **Backend:** Node.js, Express, Prisma, PostgreSQL, JWT auth, Zod validation
- **Frontend:** React (Vite, TypeScript)
- **Deploy:** [Railway](https://railway.app) — one service runs API + static UI

## Local development

1. Copy environment variables:

   ```bash
   cp .env.example .env
   ```

2. Set `DATABASE_URL` to a PostgreSQL instance (local Docker or cloud).

3. Install and migrate:

   ```bash
   npm install
   npm run db:push -w server
   ```

4. Run API + UI:

   ```bash
   npm run dev
   ```

   - API: `http://localhost:4000`
   - UI: `http://localhost:5173` (proxies `/api` to the API)

## Production build

```bash
npm run build
npm run start
```

`npm run build` builds the client, compiles the server, and copies `client/dist` into `server/public` so Express can serve the SPA. `npm start` runs `prisma migrate deploy` then starts the server.

## Deploy on Railway

1. Create a new **Railway** project and connect this repository (or deploy from the CLI).
2. Add a **PostgreSQL** plugin. Railway injects `DATABASE_URL` into the service.
3. Set these variables on the **web** service:

   | Variable        | Example                          |
   |----------------|-----------------------------------|
   | `DATABASE_URL` | *(from Postgres plugin)*        |
   | `JWT_SECRET`   | Long random string                |
   | `NODE_ENV`     | `production`                      |

4. **Root directory:** repository root (where this `README.md` lives).

5. **Build command:** `npm install && npm run build`  
   **Start command:** `npm start` (already set in `railway.toml`).

6. After deploy, open the generated public URL. Sign up, create a project, invite teammates by email (they must register first), and manage tasks.

### Railway: online then crashes

1. **`prisma` missing at runtime** — Production installs often skip `devDependencies`. This repo lists **`prisma` under `server` `dependencies`** so `npm start` can run `prisma migrate deploy`.

2. **`JWT_SECRET` not set** — In production the server exits if `JWT_SECRET` is missing or still the dev default. Set a long random value in Railway **Variables**.

3. **`DATABASE_URL` not on the web service** — Reference or copy Postgres’s `DATABASE_URL` onto the **same** service that runs `npm start`.

4. **Port / bind** — The server listens on **`0.0.0.0`** and **`PORT`** from Railway.

5. **Health checks** — Use **`/health`** or **`/api/health`** if you configure HTTP health checks.

Always read the latest **Deploy logs** for `[server]` or Prisma messages.

## API overview

| Method | Path | Notes |
|--------|------|--------|
| POST | `/api/auth/register` | Sign up |
| POST | `/api/auth/login` | Sign in |
| GET | `/api/auth/me` | Current user (Bearer token) |
| GET/POST | `/api/projects` | List / create projects |
| GET/PATCH/DELETE | `/api/projects/:projectId` | Member read; Admin update/delete |
| GET/POST | `/api/projects/:projectId/members` | List; Admin invites by email |
| PATCH/DELETE | `/api/projects/:projectId/members/:userId` | Admin only |
| GET/POST | `/api/projects/:projectId/tasks` | List / create |
| PATCH | `/api/projects/:projectId/tasks/:taskId` | Admin or assignee/creator rules |
| DELETE | `/api/projects/:projectId/tasks/:taskId` | Admin only |
| GET | `/api/dashboard` | Aggregated stats for the current user |

Health check: `GET /api/health`

## Role model

- **Admin (per project):** Edit/delete project, manage members and roles, assign tasks to anyone, delete any task.
- **Member:** View project; create tasks; assign tasks only to themselves; edit tasks they created or are assigned to; cannot delete tasks or manage members.

The project creator is added as **Admin** automatically.
