# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack

Node.js + Express API, React (CRA) frontend served by Nginx, PostgreSQL 16 — everything runs in Docker via `docker-compose.yml`. There is no test suite and no linter. Frontend uses `react-scripts` (CRA), not Vite.

## Common commands

All commands assume the project root and PowerShell. Backend lives on port 4000, frontend on 3000.

```powershell
# Start / rebuild everything (Postgres auto-runs schema.sql on first volume create)
docker compose up -d --build

# After backend code changes — Dockerfile COPYs source at build time and there's no
# bind mount, so a plain `restart` would just re-run the old image. Rebuild instead.
docker compose up -d --build backend

# After frontend code changes — CRA build happens in the image, so rebuild
docker compose up -d --build frontend

# Logs
docker compose logs -f backend
docker compose logs -f db

# DB backup / restore
docker compose exec db pg_dump -U helpdesk_user helpdesk > backup.sql
docker compose exec -T db psql -U helpdesk_user helpdesk < backup.sql

# Generate a bcrypt hash (e.g. for seeding an admin)
docker compose exec backend node -e "const b=require('bcryptjs'); b.hash('yourpassword',10).then(console.log)"

# Reset local DB — DESTRUCTIVE, never on production (the -v drops the postgres_data volume)
docker compose down -v
```

`schema.sql` only runs on **initial** database creation (it's mounted into `/docker-entrypoint-initdb.d/`). Subsequent schema changes must go through `backend/db/migrations/*.sql`, applied manually:

```powershell
docker compose exec -T db psql -U helpdesk_user -d helpdesk < backend/db/migrations/NNN_name.sql
```

## Architecture

### Auth flow
JWT-based. `backend/middleware/auth.js` exports `authenticate` (verifies the bearer token and sets `req.user = { id, email, role, name }`) and `authorize(...roles)` (403s if `req.user.role` isn't in the allowed set). The frontend axios client (`frontend/src/api/client.js`) injects the token from `localStorage` and force-redirects to `/login` on any 401.

Three roles: `user`, `agent`, `admin`. New self-registrations are always `user`; only admins can promote via `PATCH /api/users/:id/role`. The KB pages are gated to `agent`/`admin` at the React Router level in `frontend/src/App.jsx`, **and** the destructive KB endpoints are also gated on the backend — both layers matter.

### Email confirmation + purge
Registration creates an unconfirmed account with a 6-hour confirmation token (`confirmation_expires_at`). `services/purge.js` runs every 30 minutes (started from `server.js`) and `DELETE`s any unconfirmed accounts whose token has expired. Logins for unconfirmed accounts return 403 with `{ unconfirmed: true }`. If `sendConfirmationEmail` throws during registration, the freshly inserted user row is deleted so the email isn't taken.

### Ticket auto-assignment
On `POST /api/tickets`, `services/assignments.js#autoAssign()` picks the **confirmed agent** with the fewest currently active (not resolved/closed) tickets. Admins are **not** considered for auto-assignment (only `role = 'agent'`). If no eligible agent exists, the ticket is created unassigned.

### Notifications
All email sends go through `services/notifications.js` and are **fire-and-forget** (`.catch(console.error)` on every call site) — a failing SMTP call must never break the API response. The five hooks:
- `notifyTicketCreated` — broadcast to all confirmed agents/admins on create.
- `notifyTicketAssigned` — DM the new assignee on auto-assign or manual reassign.
- `notifyStatusChanged` / `notifyTicketClosed` — DM the creator (and assignee on close). Status change to `closed` uses the dedicated closed function instead.
- `notifyCommentAdded` — internal comments (`is_internal = TRUE`) are **never** emailed; otherwise creator-replies notify the assignee, agent-replies notify the creator.

When adding a new event that should email, follow this pattern: do the DB write, then call the notify function with `.catch(console.error)` — never `await` it before the response.

### Tickets route conventions
`backend/routes/tickets.js` is the canonical reference for how routes are structured here:
- Users only see their own tickets; agents/admins see everything (one query, branched).
- Users never see `is_internal = TRUE` comments — this is enforced by appending an `AND c.is_internal = FALSE` clause to the comments query when `req.user.role === 'user'`, not by post-filtering in JS.
- `PATCH` uses `COALESCE($n, column)` so any subset of fields can be sent. `resolved_at` is set via `CASE WHEN $5 THEN NOW() ELSE resolved_at END` when status flips to `resolved`.
- File uploads: multer disk storage in `backend/uploads` (persisted via the `uploads_data` Docker volume), 5 MB cap, image MIME types only.

### Frontend
Single React app, React Router v6. `AuthContext` holds the user and exposes login/logout; `Layout` wraps every authenticated route with the sidebar. Pages are named after the route they serve (e.g. `TicketDetail.jsx` ↔ `/tickets/:id`). Nginx (`frontend/nginx.conf`) serves the built bundle and proxies `/api` to the backend container.

`REACT_APP_*` env vars are baked in at **build time**, so changing `API_URL` requires `docker compose up -d --build frontend`, not just a restart.

## Conventions

- **SQL:** always parameterized (`$1`, `$2`) — never string interpolation. `snake_case` columns. Wrap DB calls in `try/catch` and return `{ error: '…' }` on failure (status codes follow the existing routes: 400 missing fields, 401 auth, 403 role, 404 not found, 409 conflict, 500 everything else).
- **JS:** `const`/`let`, `async/await`, no `.then()` chains. Errors are logged with `console.error` and return a generic `'Server error'` to the client.
- **Commits:** prefix with `feat:`, `fix:`, `chore:`, `docs:`, `db:`, `style:`, or `refactor:`. Subject under 72 chars.
- **Branches:** `feature/*` and `fix/*` branch off `develop` and PR back into `develop`; `develop` → `main` is its own PR. `hotfix/*` branches off `main` and merges into both. **Never commit directly to `main`.** See `docs/BRANCH_STRATEGY.md`.
- **Database changes:** edit `schema.sql` **and** add a numbered migration in `backend/db/migrations/` — the migration is what gets applied to existing (production) databases; the schema file only runs on a fresh volume.

## Things to be careful with

- `docker compose down -v` deletes the postgres volume. Safe for local dev resets, **catastrophic on the production server**.
- `docker-compose.yml` currently has SMTP credentials inlined under the `backend` service (not pulled from `.env`). If you touch that file, don't leak them in commits — and consider moving them to env vars.
- The seed admin in `schema.sql` only inserts on a fresh DB (`ON CONFLICT DO NOTHING`). Changing the seed won't affect an existing deployment.
- JWTs expire in 12h (`backend/routes/auth.js`). The frontend has no refresh flow — a 401 just kicks the user to `/login`.

## Further docs

- `README.md` — quick start, full API reference, role matrix
- `docs/CONTRIBUTING.md` — onboarding for new contributors
- `docs/BRANCH_STRATEGY.md` — branching rules in detail
- `docs/DEPLOYMENT.md`, `docs/ADMIN_GUIDE.md`, `docs/AGENT_GUIDE.md` — operational guides
