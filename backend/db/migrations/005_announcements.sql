-- Announcement banners — site-wide notices shown at the top of every page.
-- Admins create/manage them; all authenticated users see active, non-expired ones.

CREATE TABLE IF NOT EXISTS announcements (
  id         SERIAL PRIMARY KEY,
  message    TEXT NOT NULL,
  type       VARCHAR(20) NOT NULL DEFAULT 'info', -- info, warning, critical
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
