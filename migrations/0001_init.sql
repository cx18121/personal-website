-- Visitor log for charliexue.com. One row per non-bot page hit, written
-- from functions/_middleware.js alongside the Discord webhook ping.
-- Mirrors the fields shown in the Discord embed plus the raw UA (kept
-- for debugging when the device classifier guesses wrong).
--
-- No IP is stored — matches the privacy posture of the Discord ping.

CREATE TABLE IF NOT EXISTS visits (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  ts           TEXT    NOT NULL,           -- ISO 8601
  path         TEXT    NOT NULL,
  query        TEXT,
  referer      TEXT,
  user_agent   TEXT,
  country      TEXT,
  region       TEXT,
  city         TEXT,
  colo         TEXT,                       -- Cloudflare colo (e.g. "SJC")
  asn          INTEGER,
  org_label    TEXT,
  org_category TEXT,                       -- see classifyOrg() in middleware
  browser      TEXT,                       -- NULL when UA wasn't recognized
  os           TEXT,
  bot_flagged  INTEGER NOT NULL DEFAULT 0, -- 0/1
  bot_reason   TEXT
);

CREATE INDEX IF NOT EXISTS idx_visits_ts           ON visits(ts DESC);
CREATE INDEX IF NOT EXISTS idx_visits_org_category ON visits(org_category);
CREATE INDEX IF NOT EXISTS idx_visits_bot_flagged  ON visits(bot_flagged);
