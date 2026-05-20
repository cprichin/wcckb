-- Migration: add email confirmation to users table
-- Run with:
--   docker compose exec db psql -U helpdesk_user -d helpdesk < backend/db/migrations/001_email_confirmation.sql

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_confirmed        BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS confirmation_token     TEXT        UNIQUE,
  ADD COLUMN IF NOT EXISTS confirmation_expires_at TIMESTAMPTZ;

-- Mark existing accounts as already confirmed so they aren't purged
UPDATE users SET email_confirmed = TRUE WHERE email_confirmed = FALSE;

-- Index for fast token lookups on the confirm endpoint
CREATE INDEX IF NOT EXISTS idx_users_confirmation_token ON users (confirmation_token);
