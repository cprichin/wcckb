-- Migration: add password-reset token columns to users
-- Run with:
--   docker compose exec -T db psql -U helpdesk_user -d helpdesk < backend/db/migrations/002_password_reset.sql

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS reset_token      TEXT        UNIQUE,
  ADD COLUMN IF NOT EXISTS reset_expires_at TIMESTAMPTZ;

-- Index for fast token lookups on the reset endpoint
CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users (reset_token);
