# Branch Strategy

This document defines how Git branches are used in this project. Following these rules keeps the codebase stable and makes it easy to track what changed and why.

---

## Branch Overview

```
main ─────────────────────────────────────────── production-ready code only
  └── develop ──────────────────────────────────── integration branch
        ├── feature/ticket-email-notifications
        ├── feature/dashboard-stats
        ├── fix/kb-search-not-returning-results
        └── fix/attachment-upload-timeout
```

---

## Branches

### `main`
- **Always deployable.** Every commit on `main` should be working, tested code.
- **Never commit directly to `main`.** All changes come in through a Pull Request.
- This is what runs on the production server.
- Only the project maintainer (admin) merges into `main`.

### `develop`
- The active integration branch where finished features collect before a release.
- All feature and fix branches are created from `develop` and merged back into `develop`.
- Periodically merged into `main` when a batch of changes is ready to deploy.
- Relatively stable — don't push broken code here.

### `feature/*`
- For new functionality.
- Branch off `develop`, merge back into `develop` via Pull Request.
- Name format: `feature/short-description`

Examples:
```
feature/email-notifications
feature/dashboard-stats
feature/ai-kb-suggestions
feature/password-reset
```

### `fix/*`
- For bug fixes.
- Branch off `develop` for normal bugs.
- Branch off `main` only for critical production hotfixes (then merge into both `main` and `develop`).
- Name format: `fix/short-description`

Examples:
```
fix/login-invalid-credentials
fix/kb-search-empty-results
fix/image-upload-size-limit
```

### `hotfix/*`
- Reserved for urgent fixes that need to go straight to production.
- Branch off `main`, merge back into **both** `main` and `develop`.
- Use sparingly — only for things actively breaking the live system.

Example:
```
hotfix/admin-login-broken
```

---

## Workflow Step by Step

### Starting a new feature or fix

```bash
# Make sure you're up to date
git checkout develop
git pull origin develop

# Create your branch
git checkout -b feature/your-feature-name
```

### Working on your branch

```bash
# Make changes, then stage and commit regularly
git add .
git commit -m "feat: add email notification on ticket update"

# Push to GitHub
git push origin feature/your-feature-name
```

### Opening a Pull Request

1. Go to the GitHub repo
2. Click **Compare & pull request** on your branch
3. Set the base branch to **`develop`** (not `main`)
4. Fill in the description — what changed, why, how you tested it
5. Request a review from the maintainer
6. Do not merge your own PR

### After your PR is approved

The maintainer will merge it into `develop`. You can then delete your branch:

```bash
git checkout develop
git pull origin develop
git branch -d feature/your-feature-name
```

---

## Commit Message Format

Use a short prefix to make the history easy to scan:

| Prefix | Use for |
|---|---|
| `feat:` | New feature |
| `fix:` | Bug fix |
| `chore:` | Maintenance, dependency updates, config |
| `docs:` | Documentation only |
| `style:` | CSS / formatting changes, no logic change |
| `refactor:` | Code restructure, no behavior change |
| `db:` | Database schema or migration changes |

**Examples:**
```
feat: add internal notes to ticket comments
fix: prevent duplicate KB article links on ticket
chore: remove obsolete version field from docker-compose
docs: update CONTRIBUTING with database backup steps
db: add resolved_at index to tickets table
style: tighten sidebar spacing on mobile
```

Keep the subject line under 72 characters. If more context is needed, add a blank line and a longer description below.

---

## Deploying to Production

Only the maintainer deploys. The process is:

```bash
# 1. Merge develop into main via Pull Request on GitHub

# 2. On the production server, pull the latest main
git pull origin main

# 3. Rebuild and restart containers
docker compose up -d --build

# 4. Verify everything is healthy
docker compose ps
docker compose logs -f backend
```

If a database schema change is included, apply the migration before restarting — see `CONTRIBUTING.md` for details.

---

## Rules Summary

| Rule | Reason |
|---|---|
| Never commit directly to `main` | Keeps production stable |
| Always branch from `develop` | Ensures your work is based on the latest integrated code |
| One branch per feature or fix | Keeps PRs small and reviewable |
| PR required to merge into `develop` or `main` | Ensures a second set of eyes on every change |
| Never run `docker compose down -v` on the server | It deletes all data |
| Never commit `.env` | It contains secrets |
