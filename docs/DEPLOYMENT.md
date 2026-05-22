# Deployment Guide

This guide covers how to deploy HelpDesk to the campus dedicated server from scratch, how to update it after code changes, and how to configure it for your network.

> This guide assumes the person deploying has basic comfort with a terminal. If you're picking this up cold, read through the whole document before running any commands.

---

## Table of Contents

- [Server Requirements](#server-requirements)
- [First-Time Setup](#first-time-setup)
- [Configuration](#configuration)
- [Starting the Application](#starting-the-application)
- [Verifying the Deployment](#verifying-the-deployment)
- [Making the App Accessible on the Campus Network](#making-the-app-accessible-on-the-campus-network)
- [Updating After Code Changes](#updating-after-code-changes)
- [Database Migrations](#database-migrations)
- [Rollback Procedure](#rollback-procedure)
- [SSL / HTTPS](#ssl--https)
- [Keeping Docker Clean](#keeping-docker-clean)

---

## Server Requirements

| Requirement | Minimum | Recommended |
|---|---|---|
| OS | Windows Server 2019 / Ubuntu 22.04 | Ubuntu 22.04 LTS |
| CPU | 2 cores | 4 cores |
| RAM | 2 GB | 4 GB |
| Disk | 20 GB | 50 GB |
| Docker | Docker Desktop (Windows) or Docker Engine (Linux) | Docker Engine on Linux |
| Git | Any recent version | — |
| Network | Accessible on campus LAN | Static IP recommended |

> Linux is strongly preferred for a production server. Docker runs more efficiently on Linux and doesn't require Docker Desktop licensing.

---

## First-Time Setup

### 1. Install Git

**Windows:**
Download and install from https://git-scm.com/downloads. Use all default options.

**Ubuntu:**
```bash
sudo apt update && sudo apt install -y git
```

### 2. Install Docker

**Windows:**
Download Docker Desktop from https://www.docker.com/products/docker-desktop and install it. Start Docker Desktop and wait for the whale icon in the taskbar to stop animating before continuing.

**Ubuntu:**
```bash
# Install Docker Engine
curl -fsSL https://get.docker.com | sh

# Add your user to the docker group so you don't need sudo every time
sudo usermod -aG docker $USER

# Log out and back in, then verify
docker --version
docker compose version
```

### 3. Clone the Repository

```bash
# Navigate to where you want the project to live
cd /opt   # Linux — a good home for server applications
# or
cd C:\Apps   # Windows

# Clone
git clone https://github.com/YOUR_USERNAME/helpdesk.git
cd helpdesk
```

If the repo is private, you'll be prompted for your GitHub credentials. Use a Personal Access Token as your password (GitHub → Settings → Developer settings → Personal access tokens).

---

## Configuration

### 1. Create the environment file

```bash
cp .env.example .env
```

Open `.env` in a text editor and fill in every value:

```bash
# Strong random password for the database
DB_PASSWORD=choose_something_long_and_random

# Secret key for signing JWT login tokens — must be long and random
# Generate one with: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
JWT_SECRET=replace_with_a_64_character_random_string

# The URL users will use to access the app
# Use your server's IP address or hostname
FRONTEND_URL=http://192.168.1.50:3000

# The URL the frontend uses to reach the API
API_URL=http://192.168.1.50:3000/api

# SMTP — required for email confirmation, password reset, and ticket notifications
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-mailbox@example.com
# For Gmail, SMTP_PASS must be an App Password (not your account password):
# https://myaccount.google.com/apppasswords
SMTP_PASS=your-16-character-app-password
SMTP_NAME=HelpDesk
SMTP_EMAIL=helpdesk@example.com
```

> **Never commit `.env` to Git.** It is listed in `.gitignore` for this reason. If you accidentally commit it, rotate all the secrets immediately. If credentials were pushed to a public remote, treat them as compromised and rotate even after removing the commit — they live in git history and on any clone.

### Generating a secure JWT_SECRET

Run this once on any machine that has Node.js installed:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Copy the output into your `.env`.

---

## Starting the Application

From inside the project folder:

```bash
docker compose up -d --build
```

This will:
1. Pull the PostgreSQL and Nginx base images from Docker Hub
2. Build the backend (Node.js) image
3. Build the frontend (React → Nginx) image
4. Start all three containers
5. Run `schema.sql` automatically to create tables and the default admin account

The first build takes 3–10 minutes depending on internet speed. Subsequent builds are faster because Docker caches layers.

---

## Verifying the Deployment

### Check all containers are running

```bash
docker compose ps
```

You should see three containers all showing `running` or `healthy`:

```
NAME                  STATUS
helpdesk-db-1         healthy
helpdesk-backend-1    running
helpdesk-frontend-1   running
```

### Check backend is responding

```bash
curl http://localhost:4000/health
# Expected: {"status":"ok"}
```

### Check frontend is serving

Open a browser on the server (or any machine on the same network) and go to:

```
http://YOUR_SERVER_IP:3000
```

You should see the HelpDesk login page.

### Log in with the default admin account

A default admin row is seeded by `backend/db/schema.sql` (see the
`INSERT INTO users` block at the bottom of that file for the email
and the bcrypt-hashed password).

> **Change the admin password immediately after first login** via
> **My Account → Change Password**. If you'd rather not run the seeded
> credentials at all, edit the `INSERT INTO users` block in `schema.sql`
> before the very first `docker compose up` — the seed runs only on
> a fresh database volume, so once Postgres has booted there's no
> easy way to undo it short of `docker compose down -v` (destructive).

---

## Making the App Accessible on the Campus Network

By default, the app runs on port `3000`. Users on the campus network can access it at `http://YOUR_SERVER_IP:3000` as long as:

1. **The server's firewall allows port 3000 inbound.** On Ubuntu:
   ```bash
   sudo ufw allow 3000/tcp
   sudo ufw allow 4000/tcp
   ```
   On Windows Server, add an inbound rule in Windows Firewall for port 3000.

2. **The server has a static IP** (or a DNS hostname). Talk to campus IT to request a static IP or a hostname like `helpdesk.campus.edu`.

3. **Users are on the campus network** (wired, WiFi, or VPN).

### Optional: Run on Port 80 (no port number in the URL)

Edit `docker-compose.yml` and change the frontend port mapping:

```yaml
frontend:
  ports:
    - "80:80"   # changed from "3000:80"
```

Then update your `.env`:
```
FRONTEND_URL=http://YOUR_SERVER_IP
API_URL=http://YOUR_SERVER_IP/api
```

Rebuild:
```bash
docker compose up -d --build
```

Users can now access the app at `http://YOUR_SERVER_IP` with no port number.

---

## Updating After Code Changes

When new code is merged to `main` on GitHub, deploy it to the server:

```bash
# 1. Pull the latest code
git pull origin main

# 2. Rebuild images and restart containers
docker compose up -d --build

# 3. Verify everything is healthy
docker compose ps
docker compose logs --tail=20 backend
```

The database and uploaded files are stored in Docker volumes and are not affected by rebuilds.

### Zero-downtime note

The current setup has a brief outage (a few seconds) during rebuild while containers restart. For a campus internal tool this is acceptable. If true zero-downtime is needed in the future, look into Docker Swarm or a load balancer setup.

---

## Database Migrations

`backend/db/schema.sql` runs **only on a fresh database volume** (via Postgres' `/docker-entrypoint-initdb.d/`). After the first start, any schema changes must be applied through numbered SQL files in `backend/db/migrations/`. Each migration is idempotent (`ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, etc.), so re-running one on an up-to-date database is safe.

To apply a migration that came with a code update:

```bash
# Always take a backup first — see docs/ADMIN_GUIDE.md
docker compose exec db pg_dump -U helpdesk_user helpdesk > backup_before_migration.sql

# Apply the migration (NN is the migration number, e.g. 002, 003)
docker compose exec -T db psql -U helpdesk_user -d helpdesk < backend/db/migrations/NNN_short_name.sql

# Then rebuild as normal
docker compose up -d --build
```

Current migrations in the repo (apply in order on an older deployment):

| File | What it adds |
|---|---|
| `001_email_confirmation.sql` | `email_confirmed`, `confirmation_token`, `confirmation_expires_at` on `users` |
| `002_password_reset.sql`     | `reset_token`, `reset_expires_at` on `users` |
| `003_ticket_soft_delete.sql` | `deleted_at` on `tickets`, plus a partial index for the `deleted_at IS NULL` filter |

A fresh deployment built from `schema.sql` already includes everything above and does not need the migrations.

---

## Rollback Procedure

If an update breaks something and you need to go back:

```bash
# Find the last working commit
git log --oneline

# Roll back to it (replace COMMIT_HASH with the actual hash)
git checkout COMMIT_HASH

# Rebuild with the old code
docker compose up -d --build
```

If the broken update also included a database migration, restore from your pre-update backup:

```bash
docker compose stop backend
docker compose exec -T db psql -U helpdesk_user helpdesk < backup_before_update.sql
docker compose start backend
```

---

## SSL / HTTPS

Running over plain HTTP is acceptable on a closed campus LAN. If the server is exposed to the internet, or if your campus security policy requires HTTPS, you'll need a TLS certificate.

### Option A — Reverse proxy with Caddy (simplest)

Install Caddy on the server and add this to a `Caddyfile`:

```
helpdesk.your-campus.edu {
    reverse_proxy localhost:3000
}
```

Caddy automatically handles certificate provisioning via Let's Encrypt.

### Option B — Nginx reverse proxy with a campus certificate

If campus IT provides a certificate:

1. Place the certificate and key files on the server
2. Add an Nginx reverse proxy config pointing to `localhost:3000`
3. Update `FRONTEND_URL` and `API_URL` in `.env` to use `https://`
4. Rebuild: `docker compose up -d --build`

Contact campus IT for guidance on which option fits your network policy.

---

## Keeping Docker Clean

Over time, old images and build cache accumulate and use disk space. Run this periodically (monthly is fine):

```bash
# Remove unused images, containers, and build cache
docker system prune -f

# To also remove unused volumes (careful — only if you're sure)
docker volume prune -f
```

Check current Docker disk usage:

```bash
docker system df
```
