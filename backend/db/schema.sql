-- Run this once to initialize the database schema

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- USERS
CREATE TABLE IF NOT EXISTS users (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  email       VARCHAR(150) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role        VARCHAR(20) NOT NULL DEFAULT 'user', -- 'user', 'agent', 'admin'
  department  VARCHAR(100),
  email_confirmed         BOOLEAN     NOT NULL DEFAULT FALSE,
  confirmation_token      TEXT        UNIQUE,
  confirmation_expires_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- TICKETS
CREATE TABLE IF NOT EXISTS tickets (
  id          SERIAL PRIMARY KEY,
  title       VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  status      VARCHAR(30) NOT NULL DEFAULT 'open', -- open, in_progress, pending, resolved, closed
  priority    VARCHAR(20) NOT NULL DEFAULT 'medium', -- low, medium, high, urgent
  category    VARCHAR(100),
  created_by  INT REFERENCES users(id) ON DELETE SET NULL,
  assigned_to INT REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- TICKET ATTACHMENTS (images)
CREATE TABLE IF NOT EXISTS ticket_attachments (
  id          SERIAL PRIMARY KEY,
  ticket_id   INT REFERENCES tickets(id) ON DELETE CASCADE,
  filename    VARCHAR(255) NOT NULL,
  original_name VARCHAR(255),
  uploaded_by INT REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- TICKET COMMENTS
CREATE TABLE IF NOT EXISTS ticket_comments (
  id          SERIAL PRIMARY KEY,
  ticket_id   INT REFERENCES tickets(id) ON DELETE CASCADE,
  user_id     INT REFERENCES users(id) ON DELETE SET NULL,
  body        TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT FALSE, -- agent-only notes
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- KNOWLEDGE BASE ARTICLES
CREATE TABLE IF NOT EXISTS kb_articles (
  id          SERIAL PRIMARY KEY,
  title       VARCHAR(255) NOT NULL,
  content     TEXT NOT NULL, -- Markdown
  category    VARCHAR(100),
  tags        TEXT[], -- array of tag strings
  author_id   INT REFERENCES users(id) ON DELETE SET NULL,
  is_public   BOOLEAN DEFAULT TRUE,
  view_count  INT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- TICKET <-> KB ARTICLE LINKS
CREATE TABLE IF NOT EXISTS ticket_kb_links (
  ticket_id   INT REFERENCES tickets(id) ON DELETE CASCADE,
  article_id  INT REFERENCES kb_articles(id) ON DELETE CASCADE,
  linked_by   INT REFERENCES users(id) ON DELETE SET NULL,
  linked_at   TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (ticket_id, article_id)
);

-- Auto-update updated_at on tickets
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tickets_updated_at
  BEFORE UPDATE ON tickets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER kb_articles_updated_at
  BEFORE UPDATE ON kb_articles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Seed: default admin account (password: admin1234 — CHANGE THIS)
INSERT INTO users (name, email, password_hash, role, email_confirmed)
VALUES (
  'Admin',
  'admin@helpdesk.local',
  '$2a$10$wqVQ1q5c3wRqiQqHLjk9/.hBb9CfE3dQ0PgwBUmRVq3VpWIQAn4dS',
  'admin',
  TRUE
) ON CONFLICT DO NOTHING;
