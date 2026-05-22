-- Migration: add soft-delete to tickets
-- Run with:
--   docker compose exec -T db psql -U helpdesk_user -d helpdesk < backend/db/migrations/003_ticket_soft_delete.sql

ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Partial index so the "deleted_at IS NULL" filter on every list/detail query
-- stays fast as the trash grows.
CREATE INDEX IF NOT EXISTS idx_tickets_not_deleted
  ON tickets (id)
  WHERE deleted_at IS NULL;
