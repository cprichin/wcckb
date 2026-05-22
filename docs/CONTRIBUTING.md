# Contributing to HelpDesk

Welcome! This document explains how to contribute to the HelpDesk project — whether you're a TA, a successor maintainer, or a developer picking this up for the first time.

---

## Table of Contents

- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Branch Strategy](#branch-strategy)
- [Making Changes](#making-changes)
- [Submitting a Pull Request](#submitting-a-pull-request)
- [Code Style Guidelines](#code-style-guidelines)
- [Environment Variables](#environment-variables)
- [Common Tasks](#common-tasks)

---

## Getting Started

### Prerequisites

Make sure you have the following installed:

- [Git](https://git-scm.com/downloads)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- A code editor — [VS Code](https://code.visualstudio.com/) is recommended

### Clone and Run Locally

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/helpdesk.git
cd helpdesk

# Copy and configure environment variables
cp .env.example .env
# Open .env and set DB_PASSWORD and JWT_SECRET to anything for local dev

# Build and start
docker compose up -d --build

# App is now running at http://localhost:3000
```

A default admin account is seeded by `backend/db/schema.sql` on the first start of a fresh database. Look at the `INSERT INTO users` block at the bottom of that file for the email and the bcrypt-hashed default password.

> ⚠️ Never use the seeded default credentials on a production server — change the admin password via **My Account → Change Password** immediately after the first login (or edit the seed in `schema.sql` before the very first `docker compose up`).

---

## Project Structure

```
helpdesk/
├── backend/
│   ├── db/
│   │   ├── index.js          # PostgreSQL connection pool
│   │   └── schema.sql        # All tables + seed data (runs on first start)
│   ├── middleware/
│   │   └── auth.js           # JWT verification, role-based access control
│   ├── routes/
│   │   ├── auth.js           # Login, register, /me
│   │   ├── tickets.js        # Tickets, comments, attachments, KB links
│   │   ├── kb.js             # Knowledge base articles
│   │   └── users.js          # User management (admin only)
│   ├── uploads/              # Uploaded images (persisted via Docker volume)
│   └── server.js             # Express app entry point — start here
├── frontend/
│   ├── src/
│   │   ├── api/client.js     # Axios instance with JWT injection
│   │   ├── context/          # React context (global auth state)
│   │   ├── components/       # Shared UI components (Layout, nav)
│   │   └── pages/            # One file per page/route
│   ├── nginx.conf            # Nginx config: serves React + proxies /api
│   └── Dockerfile
├── docker-compose.yml
├── .env.example              # Safe to commit — no real secrets
├── CONTRIBUTING.md           # This file
└── BRANCH_STRATEGY.md        # Git branching rules
```

**Good places to start reading the code:**
1. `backend/server.js` — 15 lines, shows how everything is wired together
2. `backend/routes/tickets.js` — the most complete route file, good reference
3. `frontend/src/App.jsx` — all frontend routes in one place

---

## Development Workflow

All changes go through Git. Never edit files directly on the production server.

The basic loop:

```
create a branch → make changes → test locally → open a pull request → get reviewed → merge
```

See [BRANCH_STRATEGY.md](./BRANCH_STRATEGY.md) for the full branching rules.

---

## Making Changes

### Backend changes (Node.js / Express)

After editing backend files, restart the backend container:

```powershell
docker compose restart backend
```

View live logs:

```powershell
docker compose logs -f backend
```

### Frontend changes (React)

The frontend requires a rebuild after changes:

```powershell
docker compose up -d --build frontend
```

### Database schema changes

If you need to add or modify tables:

1. Edit `backend/db/schema.sql`
2. For **local dev**, wipe and recreate the database:
   ```powershell
   docker compose down -v
   docker compose up -d --build
   ```
3. For **production**, write a migration script instead — do **not** run `down -v` on the live server (it deletes all data)
4. Document the change clearly in your pull request

---

## Submitting a Pull Request

1. Push your branch to GitHub
2. Open a Pull Request (PR) against `main` (or `develop` — see branch strategy)
3. Fill in the PR description:
   - What does this change?
   - Why is it needed?
   - How was it tested?
   - Any database changes?
4. Request a review from the project maintainer
5. Wait for approval before merging — do not merge your own PRs without review

---

## Code Style Guidelines

There is no enforced linter yet, but please follow these conventions to keep the codebase consistent:

### JavaScript (Backend & Frontend)

- Use `const` and `let` — never `var`
- Use `async/await` — not `.then()` chains
- Always wrap database calls in `try/catch`
- Return meaningful error messages from API routes: `{ error: 'Description' }`
- Use descriptive variable names — `ticketId` not `id2`

### React (Frontend)

- One component per file
- Use functional components with hooks — no class components
- Keep API calls in event handlers or `useEffect` — not inline in JSX
- Name page components after their route: `TicketDetail.jsx` for `/tickets/:id`

### SQL

- Table and column names in `snake_case`
- Always use parameterized queries (`$1, $2`) — never string interpolation (SQL injection risk)
- Add a comment above any non-obvious query

---

## Environment Variables

Never commit a real `.env` file. The `.env.example` file shows what variables are needed — copy it and fill in your own values locally.

| Variable | Description |
|---|---|
| `DB_PASSWORD` | PostgreSQL password |
| `JWT_SECRET` | Secret key for signing JWT tokens — make this long and random |
| `FRONTEND_URL` | URL of the frontend (for CORS) |
| `API_URL` | Full URL to the backend API |

For local development, these can be anything. On the production server, use strong random values.

---

## Common Tasks

### View running containers
```powershell
docker compose ps
```

### Restart a specific service
```powershell
docker compose restart backend
docker compose restart frontend
```

### View logs
```powershell
docker compose logs -f backend
docker compose logs -f db
```

### Backup the production database
```powershell
docker compose exec db pg_dump -U helpdesk_user helpdesk > backup_$(date +%Y%m%d).sql
```

### Generate a bcrypt password hash
```powershell
docker compose exec backend node -e "const b=require('bcryptjs'); b.hash('yourpassword',10).then(console.log)"
```

### Wipe and reset local database (dev only — never on production)
```powershell
docker compose down -v
docker compose up -d --build
```

---

## Questions?

If something in the codebase is unclear, check the `README.md` first. If you're still stuck, reach out to the current project maintainer.
