# HelpDesk MVP

A self-hosted ticketing system with integrated knowledge base.
Built with Node.js + Express, React, and PostgreSQL — runs entirely in Docker.

---

## Project Structure

```
helpdesk/
├── backend/
│   ├── db/
│   │   ├── index.js        # PostgreSQL connection pool
│   │   └── schema.sql      # Database tables (auto-run on first start)
│   ├── middleware/
│   │   └── auth.js         # JWT authentication & role checks
│   ├── routes/
│   │   ├── auth.js         # Login, register, /me
│   │   ├── tickets.js      # Tickets, comments, attachments, KB links
│   │   ├── kb.js           # Knowledge base articles
│   │   └── users.js        # User management (admin)
│   ├── uploads/            # Uploaded images (persisted via Docker volume)
│   ├── server.js           # Express app entry point
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── api/client.js   # Axios with JWT injection
│   │   ├── context/        # Auth context (global user state)
│   │   ├── components/     # Layout (sidebar nav)
│   │   └── pages/          # Login, Register, Tickets, KB pages
│   ├── nginx.conf          # Nginx: serves React + proxies /api to backend
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

**Default admin account:**
- Email: `admin@helpdesk.local`
- Password: `admin1234`  
  ⚠️ **Change this immediately** in the Users admin panel after first login.

---

## User Roles

| Role  | Can Do |
|-------|--------|
| user  | Submit tickets, view own tickets, comment, attach images, browse KB |
| agent | All of the above + view all tickets, update status/priority, assign tickets, post internal notes, write KB articles, link KB to tickets |
| admin | All of the above + manage user roles |

New registrations default to the `user` role. Promote users to `agent` or `admin` via the Users page (admin only).

---

## API Reference

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Login, returns JWT |
| GET  | `/api/auth/me` | Get current user |

### Tickets
| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET    | `/api/tickets` | List tickets (own for users, all for agents) | all |
| GET    | `/api/tickets/:id` | Get ticket detail with comments & attachments | all |
| POST   | `/api/tickets` | Create ticket | all |
| PATCH  | `/api/tickets/:id` | Update status, priority, assignee | agent, admin |
| POST   | `/api/tickets/:id/comments` | Add comment (or internal note) | all |
| POST   | `/api/tickets/:id/attachments` | Upload image | all |
| POST   | `/api/tickets/:id/kb-links` | Link KB article to ticket | agent, admin |

### Knowledge Base
| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET    | `/api/kb` | List articles (supports `?search=` and `?category=`) | all |
| GET    | `/api/kb/:id` | Get article | all |
| POST   | `/api/kb` | Create article | agent, admin |
| PATCH  | `/api/kb/:id` | Update article | agent, admin |
| DELETE | `/api/kb/:id` | Delete article | admin |

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

## Phase 2 Ideas (Next Steps)

- **Email notifications** — use Nodemailer to alert users when tickets are updated
- **Full-text search** — add PostgreSQL `tsvector` indexes for fast KB + ticket search  
- **AI KB suggestions** — when creating a ticket, call Claude API to suggest relevant KB articles
- **Dashboard** — charts for open tickets by status, resolution time, top KB articles
- **SLA tracking** — flag tickets that have been open too long
