-- Full-text search for tickets.
-- Adds a tsvector column (title weight A, description weight B, category weight C),
-- a GIN index for fast @@ queries, and a trigger to keep the vector current.

ALTER TABLE tickets ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Backfill existing rows
UPDATE tickets
SET search_vector =
  setweight(to_tsvector('english', coalesce(title, '')),       'A') ||
  setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(category, '')),    'C');

CREATE INDEX IF NOT EXISTS idx_tickets_search ON tickets USING GIN (search_vector);

CREATE OR REPLACE FUNCTION tickets_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')),       'A') ||
    setweight(to_tsvector('english', coalesce(NEW.description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.category, '')),    'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tickets_search_vector_trigger ON tickets;
CREATE TRIGGER tickets_search_vector_trigger
  BEFORE INSERT OR UPDATE OF title, description, category ON tickets
  FOR EACH ROW EXECUTE FUNCTION tickets_search_vector_update();
