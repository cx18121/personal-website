-- Switch sessions from forum-channel threading to text-channel
-- edit-in-place. Each visitor session is one Discord message that
-- gets PATCHed as they browse new pages. We store the message_id
-- (the message to PATCH) and the current content blob (so we can
-- append the next line without re-querying Discord).
--
-- Safe to DROP — the previous schema was never put into production
-- use (signal webhook secret was never set).

DROP TABLE IF EXISTS sessions;

CREATE TABLE sessions (
  session_key TEXT PRIMARY KEY,
  message_id  TEXT NOT NULL,
  first_seen  TEXT NOT NULL,
  last_seen   TEXT NOT NULL,
  hits        INTEGER NOT NULL DEFAULT 1,
  content     TEXT NOT NULL
);

CREATE INDEX idx_sessions_last_seen ON sessions(last_seen);
