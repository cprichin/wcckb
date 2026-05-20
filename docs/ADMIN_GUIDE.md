# Administrator Guide

This guide is written for the HelpDesk system administrator. It covers day-to-day operations, user management, database maintenance, and how to handle common administrative tasks.

> **You should be the only person with admin credentials.** TAs are agents, not admins. If you're handing the system off to a successor, create them a new admin account and delete or demote the old one — never share your credentials.

---

## Table of Contents

- [Accessing the Admin Panel](#accessing-the-admin-panel)
- [User Management](#user-management)
- [Database Backups](#database-backups)
- [Restoring from Backup](#restoring-from-backup)
- [Resetting a User's Password](#resetting-a-users-password)
- [Changing the Admin Password](#changing-the-admin-password)
- [Managing the Knowledge Base](#managing-the-knowledge-base)
- [Monitoring the System](#monitoring-the-system)
- [Stopping and Starting the System](#stopping-and-starting-the-system)
- [Applying Updates](#applying-updates)
- [Handing Off to a Successor](#handing-off-to-a-successor)
- [Emergency Procedures](#emergency-procedures)

---

## Accessing the Admin Panel

1. Navigate to the helpdesk URL on the campus network
2. Log in with your admin credentials
3. Click **Users** in the left sidebar — this is only visible to admin accounts

From the Users page you can:
- Create new accounts with any role
- Change any user's role
- Delete accounts

---

## User Management

### Creating a TA (Agent) Account

1. Go to **Users** in the sidebar
2. Click **+ Create Account**
3. Fill in the TA's name, campus email, a temporary password, and their department
4. Set the role to **Agent**
5. Click **Create Account**
6. Share the temporary password with the TA and ask them to log in and note it down — there is no "change password" UI yet (see below for the manual method)

### Promoting an Existing User to Agent

If a user already self-registered:

1. Go to **Users**
2. Find their row in the table
3. Change the role dropdown from `user` to `agent`
4. The change saves immediately — no confirmation needed

### Removing a TA's Access

When a TA leaves or the semester ends:

- **Option A — Demote:** Change their role back to `user` in the Users panel. Their account remains but they lose agent access.
- **Option B — Delete:** Click **Delete** on their row and confirm. This removes the account entirely. Their past comments on tickets will show as the comment author being blank, but ticket history is preserved.

> Demoting is safer than deleting if you want to keep a clean audit trail.

### Onboarding Checklist for a New TA

- [ ] Create their account with role `agent`
- [ ] Share their temporary password securely (in person or via campus email)
- [ ] Point them to `docs/AGENT_GUIDE.md`
- [ ] Have them log in and verify they can see all tickets
- [ ] Walk them through closing their first test ticket

---

## Database Backups

Backups should be taken regularly — before any update, and at least weekly in production.

### Manual Backup

Run this from your project folder on the server:

```powershell
docker compose exec db pg_dump -U helpdesk_user helpdesk > backup_2026-05-20.sql
```

Replace the date with today's date. Store the `.sql` file somewhere safe — ideally off the server (a network share, external drive, or cloud storage).

### What the Backup Contains

The backup includes:
- All users and their roles
- All tickets, comments, and attachments metadata
- All knowledge base articles
- All ticket-KB links

> Note: The actual uploaded image files are stored in a Docker volume (`uploads_data`), not in the database. Back these up separately if image attachments are important.

### Backing Up Uploaded Images

```powershell
# Find where Docker stores the uploads volume
docker volume inspect helpdesk_uploads_data

# Copy the contents to a backup folder
docker run --rm -v helpdesk_uploads_data:/data -v C:\Backups:/backup alpine tar czf /backup/uploads_backup_2026-05-20.tar.gz /data
```

---

## Restoring from Backup

> ⚠️ This will overwrite all current data. Only do this if you need to roll back.

```powershell
# Stop the backend so nothing writes to the DB during restore
docker compose stop backend

# Restore the SQL dump
docker compose exec -T db psql -U helpdesk_user helpdesk < backup_2026-05-20.sql

# Restart everything
docker compose start backend
```

If the database is corrupted and you need a full wipe first:

```powershell
docker compose down -v
docker compose up -d db
# Wait ~10 seconds for the DB to initialize, then:
docker compose exec -T db psql -U helpdesk_user helpdesk < backup_2026-05-20.sql
docker compose up -d
```

---

## Resetting a User's Password

There is no self-service password reset in the MVP. To manually reset a user's password:

**Step 1 — Generate a bcrypt hash of the new password:**

```powershell
docker compose exec backend node -e "const b=require('bcryptjs'); b.hash('newpassword123',10).then(console.log)"
```

Copy the output hash (starts with `$2a$10$...`).

**Step 2 — Update it in the database:**

```powershell
docker compose exec db psql -U helpdesk_user -d helpdesk -c "UPDATE users SET password_hash = 'PASTE_HASH_HERE' WHERE email = 'user@example.com';"
```

**Step 3 —** Tell the user their temporary password and ask them to note it down.

---

## Changing the Admin Password

Same process as above, using your own email address in the `WHERE` clause.

Alternatively, create a new admin account with a strong password, verify you can log in with it, then delete the old admin account.

---

## Managing the Knowledge Base

As admin you can do everything agents can, plus:

- **Delete articles** — use this to remove outdated or incorrect articles. Agents can only edit, not delete.
- **Make articles private** — uncheck "Public" when editing an article to hide it from regular users. Useful for internal TA-only documentation.

### Recommended KB Categories to Set Up Early

- Hardware
- Software
- Network
- Account Access
- General
- TA Reference (private — for internal procedures)

---

## Monitoring the System

### Check container health

```powershell
docker compose ps
```

All three containers (`db`, `backend`, `frontend`) should show as `running` or `healthy`.

### View live backend logs

```powershell
docker compose logs -f backend
```

Watch for repeated errors, failed database connections, or unusual activity. Press `Ctrl+C` to stop.

### View database logs

```powershell
docker compose logs -f db
```

### Check disk space

Uploaded images accumulate over time. Monitor disk usage on the server periodically:

```powershell
docker system df
```

To see how large the uploads volume has grown:

```powershell
docker run --rm -v helpdesk_uploads_data:/data alpine du -sh /data
```

---

## Stopping and Starting the System

### Graceful stop (data is preserved)

```powershell
docker compose down
```

### Start back up

```powershell
docker compose up -d
```

### Full wipe including database — DEV ONLY, never on production

```powershell
docker compose down -v
```

> `-v` deletes all Docker volumes including the database. There is no undo. Never run this on the production server.

---

## Applying Updates

When new code is merged to `main` on GitHub:

```powershell
# Pull the latest code
git pull origin main

# Rebuild and restart (takes 1-3 minutes)
docker compose up -d --build

# Verify everything came up healthy
docker compose ps
```

If the update includes database schema changes, the release notes or PR description will say so. Apply any migration SQL before rebuilding:

```powershell
docker compose exec db psql -U helpdesk_user -d helpdesk < migration.sql
```

---

## Handing Off to a Successor

When you're leaving and passing this to someone else:

1. **Create a new admin account** for your successor via the Users panel
2. **Brief them** on the system — walk through this guide together
3. **Share access** to:
   - The GitHub repository
   - The production server (SSH or RDP access)
   - Wherever database backups are stored
   - The `.env` file on the server (never stored in Git)
4. **Change the `.env` secrets** — rotate `JWT_SECRET` and `DB_PASSWORD` after handoff so your credentials no longer work
5. **Delete or demote your own admin account** once the successor has confirmed access
6. **Take a final backup** before stepping away

---

## Emergency Procedures

### The site is down

```powershell
# Check what's running
docker compose ps

# If containers are stopped, start them
docker compose up -d

# Check for errors
docker compose logs --tail=50 backend
docker compose logs --tail=50 db
```

### The database won't start

```powershell
docker compose logs db
```

Common causes:
- Disk full — free up space on the server
- Corrupt data files — restore from the most recent backup
- Wrong password in `.env` — verify `DB_PASSWORD` matches what was set when the volume was created

### A user is locked out

Their password hash may be corrupted. Reset it manually — see [Resetting a User's Password](#resetting-a-users-password).

### Suspicious activity / possible breach

1. Immediately take the system offline: `docker compose down`
2. Take a backup of the current database state for forensic purposes
3. Rotate all secrets in `.env` (`JWT_SECRET`, `DB_PASSWORD`)
4. Review user accounts — remove any unrecognized accounts
5. Review recent ticket and comment activity for signs of misuse
6. Bring the system back up: `docker compose up -d`
7. Force all users to reset their passwords (manual process for now)
8. Report the incident to campus IT security
