# HelpDesk MVP

A self-hosted ticketing system with integrated knowledge base.
Built with Node.js + Express, React, and PostgreSQL — runs entirely in Docker.

---

## Project Structure

```
helpdesk/
├── backend/
│   ├── db/
│   │   ├── index.js          # PostgreSQL connection pool
│   │   ├── schema.sql        # Database tables (auto-run on first start)
│   │   └── migrations/       # Incremental schema changes for existing DBs
│   ├── middleware/
│   │   └── auth.js           # JWT authentication & role checks
│   ├── routes/
│   │   ├── auth.js           # Login, register, /me, forgot/reset password
│   │   ├── tickets.js        # Tickets, comments, attachments, KB links, FTS
│   │   ├── kb.js             # Knowledge base articles
│   │   ├── announcements.js  # Site-wide announcement banners
│   │   ├── dashboard.js      # Metrics & per-agent stats
│   │   └── users.js          # User management (admin)
│   ├── services/
│   │   ├── notifications.js  # Email notification hooks
│   │   ├── assignments.js    # Auto-assign new tickets to least-loaded agent
│   │   └── purge.js          # Purge expired unconfirmed accounts (runs every 30 min)
│   ├── uploads/              # Uploaded images (persisted via Docker volume)
│   ├── server.js             # Express app entry point
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── api/client.js     # Axios with JWT injection
│   │   ├── context/          # Auth context (global user state)
│   │   ├── components/       # Layout, AnnouncementBanner
│   │   └── pages/            # Login, Register, Tickets, KB, Dashboard, Announcements pages
│   ├── nginx.conf            # Nginx: serves React + proxies /api to backend
│   └── Dockerfile
├── docker-compose.yml
└── .env.example
```

---

## Quick Start

### 1. Clone and configure

```bash
git clone <your-repo> helpdesk
cd helpdesk
cp .env.example .env
# Edit .env — set DB_PASSWORD, JWT_SECRET, and your server's URL
```

### 2. Build and run

```bash
docker compose up -d --build
```

This will:
- Start PostgreSQL and run `schema.sql` automatically on first launch
- Build and start the Express API on port 4000
- Build and start the React frontend on port 3000 (served by Nginx)

### 3. Access the app

Open `http://your-server-ip:3000` in a browser.

**Default admin account:** seeded by `backend/db/schema.sql` on first start
(see the `INSERT INTO users` block at the bottom of that file for the email
and the bcrypt-hashed default password — log in once and change it immediately
via **My Account → Change Password**, or by editing the seed before first boot).

---

## User Roles

| Role  | Can Do |
|-------|--------|
| user  | Submit tickets, view own tickets, comment, attach images, browse KB |
| agent | All of the above + view all tickets, update status/priority, assign tickets, post internal notes, write KB articles, link KB to tickets |
| admin | All of the above + manage user roles, post announcements, purge deleted tickets |

New registrations default to the `user` role. Promote users to `agent` or `admin` via the Users page (admin only).

---

## API Reference

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST  | `/api/auth/register`        | Create account (sends email confirmation link) |
| GET   | `/api/auth/confirm/:token`  | Confirm a newly-registered email address |
| POST  | `/api/auth/login`           | Login, returns JWT |
| GET   | `/api/auth/me`              | Get current user |
| POST  | `/api/auth/forgot`          | Request a password-reset link (enumeration-safe) |
| POST  | `/api/auth/reset/:token`    | Set a new password using a reset token |
| PATCH | `/api/auth/password`        | Change own password (requires current password) |

### Tickets
| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET    | `/api/tickets`                  | List tickets (own for users, all for agents); supports `?q=` for full-text search | all |
| GET    | `/api/tickets/trash`            | List soft-deleted tickets | admin |
| GET    | `/api/tickets/:id`              | Get ticket detail with comments & attachments | all |
| POST   | `/api/tickets`                  | Create ticket (auto-assigns to least-loaded agent) | all |
| PATCH  | `/api/tickets/:id`              | Update status, priority, assignee | agent, admin |
| DELETE | `/api/tickets/:id`              | Soft delete (move to trash) | admin |
| POST   | `/api/tickets/:id/restore`      | Restore a soft-deleted ticket | admin |
| DELETE | `/api/tickets/:id/purge`        | Permanently delete (must be in trash first) | admin |
| POST   | `/api/tickets/:id/comments`     | Add comment (or internal note) | all |
| POST   | `/api/tickets/:id/attachments`  | Upload image | all |
| POST   | `/api/tickets/:id/kb-links`     | Link KB article to ticket | agent, admin |

### Knowledge Base
| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET    | `/api/kb` | List articles (supports `?search=` and `?category=`) | all |
| GET    | `/api/kb/:id` | Get article | all |
| POST   | `/api/kb` | Create article | agent, admin |
| PATCH  | `/api/kb/:id` | Update article | agent, admin |
| DELETE | `/api/kb/:id` | Delete article | admin |

### Announcements
| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET    | `/api/announcements`      | List active, non-expired banners | all |
| GET    | `/api/announcements/all`  | Full list including inactive | admin |
| POST   | `/api/announcements`      | Create announcement (`info`, `warning`, or `critical`) | admin |
| PATCH  | `/api/announcements/:id`  | Update message, type, active state, or expiry | admin |
| DELETE | `/api/announcements/:id`  | Permanently delete | admin |

### Dashboard
| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET    | `/api/dashboard?period=7d\|30d\|all` | Personal + team metrics; admins also receive a per-agent productivity table | agent, admin |

### Users (admin only)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | `/api/users` | List all users |
| GET    | `/api/users/agents` | List agents (for assignment dropdown) |
| PATCH  | `/api/users/:id/role` | Change user role |

---

## Common Operations

### View logs
```bash
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f db
```

### Restart a service
```bash
docker compose restart backend
```

### Stop everything
```bash
docker compose down
```

### Backup the database
```bash
docker compose exec db pg_dump -U helpdesk_user helpdesk > backup.sql
```

### Restore a backup
```bash
docker compose exec -T db psql -U helpdesk_user helpdesk < backup.sql
```

---

## Customization

**Add ticket categories:** Edit the `CATEGORIES` array in `frontend/src/pages/NewTicket.jsx`.

**Change the app name/branding:** Update `HelpDesk` text in `Layout.jsx` and `Login.jsx`.

**Adjust file upload size limit:** Change `5 * 1024 * 1024` in `backend/routes/tickets.js` (currently 5MB).

**Change JWT expiry:** Edit `expiresIn: '12h'` in `backend/routes/auth.js`.

---

## Roadmap

Shipped:
- Email confirmation on registration + email notifications on ticket events
- Confirmation email to ticket creator on submission
- Self-service password reset (forgot-password flow)
- Auto-assignment of new tickets to the least-loaded agent
- Dashboard with team/personal metrics and per-agent productivity (admin view)
- Soft delete + admin trash with restore / permanent delete
- Full-text search on tickets (PostgreSQL `tsvector`, `?q=` param)
- Site-wide announcement banners with `info`/`warning`/`critical` types and optional expiry

Still on the roadmap:
- **AI KB suggestions** — when creating a ticket, call Claude API to suggest relevant KB articles inline
- **SLA tracking** — flag tickets that have been open too long given their priority
- **Email-to-ticket** — create tickets from inbound email (no login required)
- **Filter chips on the ticket list** — filter by priority/assignee/category
- **Auth-endpoint rate limiting** — slow down brute-force attempts on login/register/forgot
