-- pg_trgm extension for trigram-based full-text search (supports Japanese)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN indexes for trigram search on products
CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_description_trgm ON products USING GIN (description gin_trgm_ops);
