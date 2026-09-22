import {
  BOT_UA,
  classifyOrg,
  detectBot,
  isValidSitePath,
  parseDevice,
  signalRejectionReason,
} from './visitor-classification.mjs';

// Cloudflare Pages middleware. Runs on every request before the static
// asset is served. Two independent streams:
//
//   Firehose — every page request that is not an asset or an honest bot
//   pings the firehose webhook and appends a row to D1. Probe paths stay in
//   this stream and are labeled as automation instead of being discarded.
//
//   Signal — the page's own JS fires /b?e=load after the app runs and
//   /b?e=view when project or travel content opens. Known crawlers and
//   scanner networks are removed. A valid browser load can qualify on any
//   network so homepage-only visitors are not discarded.
//
// All writes go through waitUntil so they never block the response.
//
// Bindings (see wrangler.toml):
//   VISITOR_LOG                 D1 database (tables `visits`, `sessions`)
//   DISCORD_WEBHOOK_URL         secret — firehose text channel
//   DISCORD_SIGNAL_WEBHOOK_URL  secret — signal text channel (optional)
//   SESSION_SALT                secret — salt for IP→session_key hash

const SKIP_EXT = /\.(css|js|mjs|md|png|jpe?g|webp|svg|gif|ico|woff2?|ttf|otf|map|json|xml|txt|pdf)$/i;

// Session freshness window — visits from the same session_key within
// this window get appended to the existing message. After this we
// start a fresh message (probably a different reading session).
const SESSION_WINDOW_MS = 30 * 60 * 1000;

// The session embed's description holds the running visit log. Discord
// caps an embed description at 4096 chars; keep headroom and a line cap.
const MAX_VISIT_LINES = 30;
const MAX_DESC_CHARS = 3900;

export async function onRequest(context) {
  const { request, env, next, waitUntil } = context;
  const url = new URL(request.url);
  const ua = request.headers.get('user-agent') || '';

  if (url.hostname === 'www.charliexue.com') {
    url.hostname = 'charliexue.com';
    return Response.redirect(url.toString(), 301);
  }

  // Behavioral beacon from the page's JS (see handleBeacon). Drives the
  // signal channel; never a logged pageview. Always answer 204.
  if (url.pathname === '/b' && request.method === 'GET') {
    if (env.DISCORD_SIGNAL_WEBHOOK_URL && env.VISITOR_LOG && env.SESSION_SALT) {
      waitUntil(handleBeacon(context, url, ua));
    }
    return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
  }

  if (
    request.method === 'GET' &&
    !SKIP_EXT.test(url.pathname) &&
    !BOT_UA.test(ua)
  ) {
    const visit = buildVisit(request, url, ua);

    if (env.DISCORD_WEBHOOK_URL) {
      waitUntil(reportDiscord(env.DISCORD_WEBHOOK_URL, visit, url));
    }
    if (env.VISITOR_LOG) {
      waitUntil(logToD1(env.VISITOR_LOG, visit));
    }
  }

  return next();
}

function buildVisit(request, url, ua, path = url.pathname) {
  const cf = request.cf || {};
  const org = classifyOrg(cf.asOrganization, cf.asn);
  const device = parseDevice(ua);
  const bot = detectBot(org.category, device, path);
  const referer = request.headers.get('referer') || '';

  return {
    ts: new Date().toISOString(),
    path,
    query: url.search || null,
    referer: referer || null,
    user_agent: ua || null,
    country: cf.country || null,
    region: cf.region || null,
    city: cf.city || null,
    colo: cf.colo || null,
    asn: cf.asn || null,
    org_label: org.label,
    org_category: org.category,
    org_color: org.color,
    browser: device.browserKnown ? device.browser : null,
    os: device.osKnown ? device.os : null,
    device_label: device.label,
    bot_flagged: bot.flagged,
    bot_reason: bot.reason || null,
  };
}

// The page's existing load and content-view beacons drive the filtered
// channel. No additional client tracking is required. Network information is
// one filter input, never an employer or identity claim.
async function handleBeacon(context, url, ua) {
  const { request, env } = context;
  const ip = request.headers.get('cf-connecting-ip') || '';
  if (!ip) return;

  const pagePath = refPath(request.headers.get('referer'), request.url);
  const sameOriginFetch = request.headers.get('sec-fetch-site') === 'same-origin';
  if (!pagePath && !sameOriginFetch) return;
  const effectivePath = pagePath || '/';
  if (!isValidSitePath(effectivePath)) return;

  // /b is public and unauthenticated, and these values land verbatim in a
  // Discord embed. Validate hard: a backtick in `n` would break out of the
  // code span (markdown/link injection); an unbounded value would bloat or
  // 400 the embed. Reject anything that isn't a plain slug.
  const eventType = url.searchParams.get('e');
  let label;
  switch (eventType) {
    case 'load':
      label = `landed \`${effectivePath}\``;
      break;
    case 'view': {
      const name = url.searchParams.get('n');
      const kind = url.searchParams.get('k');
      if (!name || !/^[a-z0-9 _-]{1,40}$/i.test(name)) return;
      if (kind && !/^(project|travel)$/.test(kind)) return;
      label = `viewed ${kind ? `${kind} ` : ''}\`${name}\``;
      break;
    }
    default:
      return;
  }

  const v = buildVisit(request, url, ua, effectivePath);
  if (signalRejectionReason({
    orgLabel: v.org_label,
    botFlagged: v.bot_flagged,
    ua,
  })) return;

  const sessionKey = await hashSession(env.SESSION_SALT, ip);
  await recordEvent(env.DISCORD_SIGNAL_WEBHOOK_URL, env.VISITOR_LOG, sessionKey, v, eventLine(v, label));
}

function refPath(ref, requestUrl) {
  try {
    const source = new URL(ref);
    if (source.origin !== new URL(requestUrl).origin) return null;
    // pathname only (the URL parser percent-encodes backticks, so this can't
    // break out of the code span); bounded so a forged Referer can't bloat
    // the embed.
    return source.pathname.slice(0, 80);
  } catch {
    return null;
  }
}

async function logToD1(db, v) {
  try {
    await db
      .prepare(
        `INSERT INTO visits (
          ts, path, query, referer, user_agent,
          country, region, city, colo, asn,
          org_label, org_category, browser, os,
          bot_flagged, bot_reason
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .bind(
        v.ts, v.path, v.query, v.referer, v.user_agent,
        v.country, v.region, v.city, v.colo, v.asn,
        v.org_label, v.org_category, v.browser, v.os,
        v.bot_flagged ? 1 : 0, v.bot_reason,
      )
      .run();
  } catch {
    // Best-effort — never break the page if D1 is down.
  }
}

async function reportDiscord(webhookUrl, v, url) {
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [buildEmbed(v, url)],
        allowed_mentions: { parse: [] },
      }),
    });
  } catch {
    // Best-effort — never break the page if Discord is down.
  }
}

// Edit-in-place threading: each visitor is one Discord message that we
// PATCH as new beacons arrive, so a whole reading session shows up as one
// growing message instead of N separate notifications. Works in a normal
// text channel — no forum required.
async function recordEvent(webhookUrl, db, sessionKey, v, line) {
  // A deep-link entry fires the load + view beacons together. Without a lock
  // both would see no session row and each POST its own Discord message
  // (dupe + orphan). D1 is single-writer, so claim the create slot with one
  // atomic statement: exactly one caller wins and posts the message; the
  // rest fall through to edit it.
  if (await claimNewSession(db, sessionKey, v.ts)) {
    await createSessionMessage(webhookUrl, db, sessionKey, v, line);
    return;
  }

  const session = await loadSession(db, sessionKey);
  if (session && session.message_id) {
    const edited = await tryEditMessage(webhookUrl, db, sessionKey, session, v, line);
    if (edited) return;
    // PATCH failed (message deleted manually, etc.) — drop this one line
    // rather than risk a duplicate message.
  }
  // Else: lost the race before the winner wrote its message_id. Dropping the
  // odd line beats a duplicate; the next beacon edits cleanly.
}

// Insert a placeholder row, or reset it if the prior session has gone stale
// (>30 min). Returns true iff this caller should create the Discord message.
// On a concurrent cold burst the first writer inserts (last_seen = now) and
// the rest hit the conflict whose WHERE (stale-only) is false → 0 changes →
// they edit instead.
async function claimNewSession(db, sessionKey, ts) {
  const cutoff = new Date(Date.now() - SESSION_WINDOW_MS).toISOString();
  try {
    const res = await db
      .prepare(
        `INSERT INTO sessions (session_key, message_id, first_seen, last_seen, hits, content)
         VALUES (?, '', ?, ?, 0, '')
         ON CONFLICT(session_key) DO UPDATE SET
           message_id = '',
           first_seen = excluded.first_seen,
           last_seen  = excluded.last_seen,
           hits       = 0,
           content    = ''
         WHERE sessions.last_seen < ?`,
      )
      .bind(sessionKey, ts, ts, cutoff)
      .run();
    return (res.meta?.changes ?? 0) > 0;
  } catch {
    return false;
  }
}

async function loadSession(db, sessionKey) {
  try {
    return await db
      .prepare('SELECT message_id, last_seen, content FROM sessions WHERE session_key = ?')
      .bind(sessionKey)
      .first();
  } catch {
    return null;
  }
}

async function tryEditMessage(webhookUrl, db, sessionKey, session, v, line) {
  // session.content holds just the accumulated event list (the embed body).
  const newList = appendVisitLine(session.content, line);
  try {
    const res = await fetch(`${webhookUrl}/messages/${session.message_id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [buildSignalEmbed(v, newList)],
        allowed_mentions: { parse: [] },
      }),
    });
    if (!res.ok) return false;
    await db
      .prepare('UPDATE sessions SET last_seen = ?, hits = hits + 1, content = ? WHERE session_key = ?')
      .bind(v.ts, newList, sessionKey)
      .run();
    return true;
  } catch {
    return false;
  }
}

// Posts the message and fills in the row claimNewSession reserved. If the
// POST fails, drop the placeholder so the next beacon can re-claim instead
// of being stuck editing a row that has no message_id.
async function createSessionMessage(webhookUrl, db, sessionKey, v, line) {
  const list = line;
  let posted = false;
  try {
    const res = await fetch(`${webhookUrl}?wait=true`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [buildSignalEmbed(v, list)],
        allowed_mentions: { parse: [] },
      }),
    });
    if (res.ok) {
      const msg = await res.json();
      if (msg.id) {
        await db
          .prepare('UPDATE sessions SET message_id = ?, last_seen = ?, hits = 1, content = ? WHERE session_key = ?')
          .bind(msg.id, v.ts, list, sessionKey)
          .run();
        posted = true;
      }
    }
  } catch {
    // Swallow — cleanup below.
  }
  if (!posted) {
    try {
      await db
        .prepare("DELETE FROM sessions WHERE session_key = ? AND message_id = ''")
        .bind(sessionKey)
        .run();
    } catch {
      // Best-effort.
    }
  }
}

// The filtered embed describes the browser activity first. ASN ownership is
// supporting network context, not a claim about the visitor's employer.
function buildSignalEmbed(v, listBody) {
  const location = [v.city, v.region, v.country].filter(Boolean).join(', ') || 'unknown';
  const engaged = listBody.includes('viewed ');

  return {
    title: engaged ? '🟢 Engaged visitor' : '🟢 Likely visitor',
    color: 0x3ba55c,
    description: listBody,
    fields: [
      { name: 'Network', value: `${v.org_label}\n${v.org_category}`, inline: true },
      { name: 'Location', value: location, inline: true },
      { name: 'Device', value: v.device_label, inline: true },
    ],
    footer: { text: `ASN ${v.asn || '?'} · ${v.colo || 'cf'}` },
    timestamp: v.ts,
  };
}

// One line in the running per-visitor list: a label ("landed `/`",
// "viewed `spectre`") plus a Discord <t:epoch:t> short time, localized to
// each viewer's device.
function eventLine(v, label) {
  const time = `<t:${Math.floor(Date.parse(v.ts) / 1000)}:t>`;
  return `${label} · ${time}`;
}

// Append a new line to the running list, trimming older lines if we'd blow
// past the embed description cap.
function appendVisitLine(oldList, line) {
  const visitLines = oldList.split('\n').filter((l) => !l.startsWith('… '));
  visitLines.push(line);

  let kept = visitLines.slice(-MAX_VISIT_LINES);
  let body = kept.join('\n');
  let truncated = kept.length < visitLines.length;

  while ((truncated ? 20 : 0) + body.length > MAX_DESC_CHARS && kept.length > 1) {
    kept = kept.slice(1);
    body = kept.join('\n');
    truncated = true;
  }

  return truncated ? `… earlier omitted …\n${body}` : body;
}

function buildEmbed(v, url) {
  const titlePath = `${v.path}${v.query || ''}`;
  const title = v.bot_flagged ? `[BOT?] ${titlePath}` : titlePath;
  const location = [v.city, v.region, v.country].filter(Boolean).join(', ') || 'unknown';

  const fields = [
    { name: 'Network', value: `${v.org_label}\n${v.org_category}`, inline: true },
    { name: 'Location', value: location, inline: true },
    { name: 'Device', value: v.device_label, inline: true },
  ];
  if (v.referer) {
    fields.push({ name: 'Came from', value: formatReferer(v.referer), inline: false });
  }

  const footerParts = [`ASN ${v.asn || '?'}`, v.colo || 'cf'];
  if (v.bot_flagged) footerParts.push(`flagged: ${v.bot_reason}`);

  return {
    title,
    url: url.toString(),
    color: v.bot_flagged ? 0x4f5660 : v.org_color,
    fields,
    footer: { text: footerParts.join(' · ') },
    timestamp: v.ts,
  };
}

async function hashSession(salt, ip) {
  const bytes = new TextEncoder().encode(`${salt}:${ip}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const arr = new Uint8Array(digest);
  // 8 bytes = 64 bits of session_key — plenty for collision safety at
  // personal-site scale and short enough to log without ceremony.
  let hex = '';
  for (let i = 0; i < 8; i++) hex += arr[i].toString(16).padStart(2, '0');
  return hex;
}

function formatReferer(ref) {
  try {
    const u = new URL(ref);
    return `[${u.hostname}${u.pathname}](${ref})`;
  } catch {
    return ref;
  }
}
