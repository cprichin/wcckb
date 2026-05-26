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
Get-Content backup.sql | docker compose exec -T db psql -U helpdesk_user helpdesk

# Generate a bcrypt hash (e.g. for seeding an admin)
docker compose exec backend node -e "const b=require('bcryptjs'); b.hash('yourpassword',10).then(console.log)"

# Reset local DB — DESTRUCTIVE, never on production (the -v drops the postgres_data volume)
docker compose down -v
```

`schema.sql` only runs on **initial** database creation (it's mounted into `/docker-entrypoint-initdb.d/`). Subsequent schema changes must go through `backend/db/migrations/*.sql`, applied manually:

```powershell
Get-Content backend/db/migrations/NNN_name.sql | docker compose exec -T db psql -U helpdesk_user -d helpdesk
```

## Architecture

### Auth flow
JWT-based. `backend/middleware/auth.js` exports `authenticate` (verifies the bearer token and sets `req.user = { id, email, role, name }`) and `authorize(...roles)` (403s if `req.user.role` isn't in the allowed set). The frontend axios client (`frontend/src/api/client.js`) injects the token from `localStorage` and force-redirects to `/login` on any 401.

Three roles: `user`, `agent`, `admin`. New self-registrations are always `user`; only admins can promote via `PATCH /api/users/:id/role`. The KB pages are gated to `agent`/`admin` at the React Router level in `frontend/src/App.jsx`, **and** the destructive KB endpoints are also gated on the backend — both layers matter.

### Email confirmation + purge
Registration creates an unconfirmed account with a 6-hour confirmation token (`confirmation_expires_at`). `services/purge.js` runs every 30 minutes (started from `server.js`) and `DELETE`s any unconfirmed accounts whose token has expired. Logins for unconfirmed accounts return 403 with `{ unconfirmed: true }`. If `sendConfirmationEmail` throws during registration, the freshly inserted user row is deleted so the email isn't taken.

### Forgot-password flow
`reset_token` + `reset_expires_at` columns on `users` hold a 1-hour single-use token issued by `POST /api/auth/forgot`. That endpoint **always** returns the same generic 200 regardless of whether the email exists — this is intentional, to avoid account enumeration; do not change it to a 404 or a different message. `POST /api/auth/reset/:token` validates expiry, hashes the new password (8-char minimum), and clears the token. If the account was still `email_confirmed = FALSE`, the reset also flips it to `TRUE` — clicking the link proves inbox ownership, so we don't need a separate confirmation step. `404` means invalid/used token, `410` means expired (so the UI can phrase the error appropriately).

### Ticket auto-assignment
On `POST /api/tickets`, `services/assignments.js#autoAssign()` picks the **confirmed agent** with the fewest currently active (not resolved/closed) tickets. Admins are **not** considered for auto-assignment (only `role = 'agent'`). If no eligible agent exists, the ticket is created unassigned.

### Notifications
All email sends go through `services/notifications.js` and are **fire-and-forget** (`.catch(console.error)` on every call site) — a failing SMTP call must never break the API response. The six hooks:
- `notifyTicketSubmitted` — confirm receipt to the ticket creator on create.
- `notifyTicketCreated` — broadcast to all confirmed **admins** on create (agents are excluded; only the assigned agent gets the separate assignment email).
- `notifyTicketAssigned` — DM the new assignee on auto-assign or manual reassign.
- `notifyStatusChanged` / `notifyTicketClosed` — DM the creator (and assignee on close). Status change to `closed` uses the dedicated closed function instead.
- `notifyCommentAdded` — internal comments (`is_internal = TRUE`) are **never** emailed; otherwise creator-replies notify the assignee, agent-replies notify the creator.

When adding a new event that should email, follow this pattern: do the DB write, then call the notify function with `.catch(console.error)` — never `await` it before the response.

### Route ordering
Express matches routes in declaration order. Any literal sub-path (e.g. `/trash`, `/all`) **must be defined before** the `/:id` param route, or Express will treat the literal as a param value. See `tickets.js` (`/trash` before `/:id`) and `announcements.js` (`/all` before `/:id`) as examples.

### Tickets route conventions
`backend/routes/tickets.js` is the canonical reference for how routes are structured here:
- Users only see their own tickets; agents/admins see everything (one query, branched).
- Users never see `is_internal = TRUE` comments — this is enforced by appending an `AND c.is_internal = FALSE` clause to the comments query when `req.user.role === 'user'`, not by post-filtering in JS.
- `PATCH` uses `COALESCE($n, column)` so any subset of fields can be sent. `resolved_at` is set via `CASE WHEN $5 THEN NOW() ELSE resolved_at END` when status flips to `resolved`.
- File uploads: multer disk storage in `backend/uploads` (persisted via the `uploads_data` Docker volume), 5 MB cap, image MIME types only.

### Soft delete + admin trash
Tickets carry a nullable `deleted_at` timestamp. Setting it = soft delete (admin-only via `DELETE /api/tickets/:id`); clearing it = restore (`POST /api/tickets/:id/restore`). Permanent hard delete (`DELETE /api/tickets/:id/purge`) is admin-only **and** guarded — the row must already be soft-deleted, so a misclick can't nuke an active ticket. Hard delete relies on FK `ON DELETE CASCADE` to clean up comments/attachments rows, then best-effort `fs.unlinkSync`s attachment files from `backend/uploads/` (ENOENT is swallowed, other unlink errors are logged but non-fatal).

Everywhere else in the codebase, soft-deleted tickets must be **invisible**. Every list/aggregate/auto-assignment query has an `AND deleted_at IS NULL` filter:
- `GET /api/tickets`, `GET /api/tickets/:id` (admins are exempted on detail so they can preview before restoring; users and agents get a 404).
- All dashboard CTEs and counts in `routes/dashboard.js`.
- The workload count in `services/assignments.js#autoAssign`.

When adding any new ticket query, copy this filter. The partial index `idx_tickets_not_deleted ON tickets (id) WHERE deleted_at IS NULL` (added in migration 003) keeps the filter cheap as the trash grows.

### Announcements
`backend/routes/announcements.js` — site-wide banners stored in the `announcements` table (migration 005). `GET /api/announcements` returns active, non-expired rows for all users; `GET /api/announcements/all` is admin-only. The `AnnouncementBanner` component in `Layout.jsx` fetches on mount and stores per-session dismissals in `sessionStorage` under key `hd_dismissed_announcements`.

### Dashboard
`backend/routes/dashboard.js` exposes a single `GET /api/dashboard?period=7d|30d|all` for agents/admins. The `period` query param maps through a hardcoded allowlist (`PERIODS`) to a PostgreSQL interval literal — only those three values can ever reach the SQL string interpolation, so the filter clauses are safe to splice into the templates even though they're not parameterized. Admins receive an additional `agent_stats` block built from four CTEs joined onto the confirmed-agent roster so agents with zero activity still appear. The frontend (`pages/Dashboard.jsx`) uses Recharts; agents/admins are routed here by default after login, regular users still land on `/tickets`.

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
- SMTP credentials live in `.env` (read into `docker-compose.yml` via `${SMTP_*}` expansion). Don't commit `.env` to git.
- The seed admin in `schema.sql` only inserts on a fresh DB (`ON CONFLICT DO NOTHING`). Changing the seed won't affect an existing deployment.
- JWTs expire in 12h (`backend/routes/auth.js`). The frontend has no refresh flow — a 401 just kicks the user to `/login`.

## Further docs

- `README.md` — quick start, full API reference, role matrix
- `docs/CONTRIBUTING.md` — onboarding for new contributors
- `docs/BRANCH_STRATEGY.md` — branching rules in detail
- `docs/DEPLOYMENT.md`, `docs/ADMIN_GUIDE.md`, `docs/AGENT_GUIDE.md` — operational guides
