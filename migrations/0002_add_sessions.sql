-- Sessions track signal-channel Discord threads so multiple page hits
-- from the same visitor land as replies in one thread instead of
-- spawning a new thread per pageview. session_key is sha256(salt + IP),
-- truncated — the raw IP is never stored.

CREATE TABLE IF NOT EXISTS sessions (
  session_key TEXT PRIMARY KEY,
  thread_id   TEXT NOT NULL,
  first_seen  TEXT NOT NULL,
  last_seen   TEXT NOT NULL,
  hits        INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_sessions_last_seen ON sessions(last_seen);
