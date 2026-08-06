CREATE TABLE IF NOT EXISTS ebay_outbox (
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
  aggregate_type TEXT NOT NULL DEFAULT 'LISTING',
  aggregate_id TEXT NOT NULL,
  ebay_item_id TEXT,
  ebay_offer_id TEXT,
  operation TEXT NOT NULL,
  payload TEXT NOT NULL,
  dedupe_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  available_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  locked_at TEXT,
  last_attempt_at TEXT,
  succeeded_at TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ebay_outbox_status_check CHECK (status IN ('PENDING', 'PROCESSING', 'RETRY_WAIT', 'SUCCEEDED', 'FAILED', 'CANCELLED'))
);
CREATE UNIQUE INDEX IF NOT EXISTS ebay_outbox_dedupe_unique ON ebay_outbox(dedupe_key);
CREATE INDEX IF NOT EXISTS ebay_outbox_available_idx ON ebay_outbox(status, available_at);
CREATE INDEX IF NOT EXISTS ebay_outbox_lock_idx ON ebay_outbox(status, locked_at);
CREATE INDEX IF NOT EXISTS ebay_outbox_listing_idx ON ebay_outbox(ebay_item_id, operation, status);
