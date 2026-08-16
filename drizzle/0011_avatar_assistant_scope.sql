-- Existing event-feed tokens must not silently gain access to business data.
-- They retain EVENTS only. A fresh admin-authorized pairing issues the
-- ASSISTANT_READ scope and an expiry timestamp explicitly.
ALTER TABLE avatar_device_tokens ADD COLUMN scopes TEXT NOT NULL DEFAULT '["EVENTS"]';
ALTER TABLE avatar_device_tokens ADD COLUMN pairing_id TEXT;
ALTER TABLE avatar_device_tokens ADD COLUMN created_by_user_id TEXT;
ALTER TABLE avatar_device_tokens ADD COLUMN expires_at TEXT;
CREATE INDEX avatar_device_tokens_expiry_idx ON avatar_device_tokens(expires_at);
