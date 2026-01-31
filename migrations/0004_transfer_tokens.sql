-- Create transfer_tokens table for OAuth flow
CREATE TABLE IF NOT EXISTS transfer_tokens (
  id TEXT PRIMARY KEY,
  return_url TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_transfer_tokens_expires_at ON transfer_tokens(expires_at);
