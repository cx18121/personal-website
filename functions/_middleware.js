// Cloudflare Pages middleware. Runs on every request before the static
// asset is served. Two independent streams:
//
//   Firehose — every real page load (not assets, not honest bots) pings
//   the firehose webhook and appends a row to the D1 visit log. Raw,
//   noisy, durable.
//
//   Signal — driven entirely by the page's own JS via the /b beacon, not
//   by raw requests. The site fires /b?e=load once it executes (proof a
//   real browser ran it — the only human signal that survives a visitor
//   arriving through a cloud or corporate proxy) and /b?e=view each time a
//   project/travel is opened (client-side routing hides those opens from
//   the server). Each beacon appends to one running per-visitor message
//   that gets PATCHed as they read on. So signal = "ran the JS," never an
//   ASN guess; the view lines show exactly what they read. Org/ASN is kept
//   only as a label, it gates nothing.
//
// All writes go through waitUntil so they never block the response.
//
// Bindings (see wrangler.toml):
//   VISITOR_LOG                 D1 database (tables `visits`, `sessions`)
//   DISCORD_WEBHOOK_URL         secret — firehose text channel
//   DISCORD_SIGNAL_WEBHOOK_URL  secret — signal text channel (optional)
//   SESSION_SALT                secret — salt for IP→session_key hash

const SKIP_EXT = /\.(css|js|mjs|md|png|jpe?g|webp|svg|gif|ico|woff2?|ttf|otf|map|json|xml|txt|pdf)$/i;
const BOT_UA = /bot|crawl|spider|slurp|duckduck|baidu|yandex|sogou|facebookexternal|twitter|linkedinbot|applebot|ahrefs|semrush|mj12|dotbot|headlesschrome|phantomjs|selenium|puppeteer|playwright|curl|wget|monitor|pingdom|uptime/i;

// Orgs that show up as "Likely corporate" or similar but are actually
// internet-wide scanners or commercial proxy/scraper providers. Filter
// these out of the signal channel.
const NOISE_ORG = /onyphe|qualys|tenable|rapid7|censys|shodan|shadowserver|netcraft|binaryedge|leakix|securitytrails|stretchoid|alphastrike|driftnet|recyber|internet measurement|cyberresilience|1337 services|hostroyale|racknerd|aventice|subnet digital|uab code200|bl networks|omegatech|31173 services|qux labs|datacamp limited|m247|leaseweb|cogent communications/i;

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

function buildVisit(request, url, ua) {
  const cf = request.cf || {};
  const org = classifyOrg(cf.asOrganization, cf.asn);
  const device = parseDevice(ua);
  const bot = detectBot(org.category, device);
  const referer = request.headers.get('referer') || '';

  return {
    ts: new Date().toISOString(),
    path: url.pathname,
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

// The page's JS fires /b on load and on each project/travel open. A load
// beacon proves a real browser executed the page (our only human signal
// that survives a cloud/corp proxy); a view beacon names what they opened.
// Honest bots (BOT_UA) and known JS-capable scanners (NOISE_ORG) are
// dropped — everything else that runs the code counts as a real visitor.
async function handleBeacon(context, url, ua) {
  const { request, env } = context;
  const ip = request.headers.get('cf-connecting-ip') || '';
  if (!ip || BOT_UA.test(ua)) return;

  const v = buildVisit(request, url, ua);
  if (v.org_label && NOISE_ORG.test(v.org_label)) return;

  // /b is public and unauthenticated, and these values land verbatim in a
  // Discord embed. Validate hard: a backtick in `n` would break out of the
  // code span (markdown/link injection); an unbounded value would bloat or
  // 400 the embed. Reject anything that isn't a plain slug.
  let label;
  switch (url.searchParams.get('e')) {
    case 'load':
      label = `landed \`${refPath(request.headers.get('referer')) || '/'}\``;
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

  const sessionKey = await hashSession(env.SESSION_SALT, ip);
  await recordEvent(env.DISCORD_SIGNAL_WEBHOOK_URL, env.VISITOR_LOG, sessionKey, v, eventLine(v, label));
}

function refPath(ref) {
  try {
    // pathname only (the URL parser percent-encodes backticks, so this can't
    // break out of the code span); bounded so a forged Referer can't bloat
    // the embed.
    return new URL(ref).pathname.slice(0, 80);
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

// Session embed: same field structure as the firehose embed, but the
// description carries the running event list and the timestamp tracks the
// most recent beacon (Discord localizes it per viewer). No bot framing — a
// beacon means the client executed our JS, so it's a real browser by
// definition; org/ASN here is just a color-coded label.
function buildSignalEmbed(v, listBody) {
  const location = [v.city, v.region, v.country].filter(Boolean).join(', ') || 'unknown';

  return {
    title: `${headerDot(v)} ${v.org_label}`,
    color: v.org_color,
    description: listBody,
    fields: [
      { name: 'Org', value: `${v.org_label}\n_${v.org_category}_`, inline: true },
      { name: 'Location', value: location, inline: true },
      { name: 'Device', value: v.device_label, inline: true },
    ],
    footer: { text: `ASN ${v.asn || '?'} · ${v.colo || 'cf'}` },
    timestamp: v.ts,
  };
}

function headerDot(v) {
  switch (v.org_category) {
    case 'Likely corporate': return '🟢';
    case 'SASE (corp behind security vendor)': return '🟠';
    case 'Residential ISP':
    case 'Mobile carrier': return '🟡';
    default: return '⚪';
  }
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
    { name: 'Org', value: `${v.org_label}\n_${v.org_category}_`, inline: true },
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

// ASN classification — color stripe on the embed at a glance signals
// signal quality. Green = a real company hit (high signal). Orange =
// corp traffic but masked by SASE so the company isn't visible. Yellow
// = residential/mobile (low signal — most home browsing). Purple =
// cloud or VPN (could be hiding something). Grey = unclassified.
function classifyOrg(org, asn) {
  const label = org || (asn ? `ASN ${asn}` : 'unknown');
  if (!org) return { label, category: 'Unknown', color: 0x808080 };
  const s = org.toLowerCase();

  if (/t-mobile|verizon wireless|at&t mobility|sprint|cellco|cricket|metropcs|bharti airtel|reliance jio|vodafone idea|orange s\.a\.|telefonica|o2 czech|ee limited|vodafone gmbh/.test(s))
    return { label, category: 'Mobile carrier', color: 0xe0c060 };

  if (/comcast|spectrum|charter|cox|verizon fios|verizon online|centurylink|frontier|optimum|cablevision|xfinity|altice|rogers|bell canada|telus|shaw|virgin media|sky broadband|bt group|deutsche telekom|google fiber/.test(s))
    return { label, category: 'Residential ISP', color: 0xe0c060 };

  if (/zscaler|netskope|palo alto networks|cisco umbrella|prisma|forcepoint|symantec|mcafee|cato networks|perimeter 81|iboss|menlo security/.test(s))
    return { label, category: 'SASE (corp behind security vendor)', color: 0xd97757 };

  if (/nordvpn|expressvpn|surfshark|protonvpn|mullvad|cyberghost|private internet|tunnelbear|ipvanish|windscribe|hideman/.test(s))
    return { label, category: 'Consumer VPN', color: 0xb381c5 };

  if (/amazon\.com|amazon technologies|amazon data|aws|google llc|google cloud|microsoft corp|azure|digitalocean|linode|vultr|hetzner|ovh|oracle|alibaba cloud|tencent cloud/.test(s))
    return { label, category: 'Cloud / hosting', color: 0xb381c5 };

  if (/cloudflare|akamai|fastly|stackpath|incapsula|imperva|sucuri/.test(s))
    return { label, category: 'CDN / edge', color: 0x808080 };

  if (/apple inc/.test(s))
    return { label, category: 'iCloud Private Relay', color: 0xb381c5 };

  return { label, category: 'Likely corporate', color: 0x3ba55c };
}

function parseDevice(ua) {
  if (!ua) return { label: 'unknown', browser: null, os: null, browserKnown: false, osKnown: false };

  let browser = 'Browser';
  let browserKnown = false;
  if (/Edg\//.test(ua)) { browser = 'Edge'; browserKnown = true; }
  else if (/OPR\//.test(ua) || /Opera\//.test(ua)) { browser = 'Opera'; browserKnown = true; }
  else if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) { browser = 'Chrome'; browserKnown = true; }
  else if (/Firefox\//.test(ua)) { browser = 'Firefox'; browserKnown = true; }
  else if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) { browser = 'Safari'; browserKnown = true; }

  let os = 'OS';
  let osKnown = false;
  if (/iPhone/.test(ua)) { os = 'iPhone'; osKnown = true; }
  else if (/iPad/.test(ua)) { os = 'iPad'; osKnown = true; }
  else if (/Android/.test(ua)) { os = 'Android'; osKnown = true; }
  else if (/Macintosh|Mac OS X/.test(ua)) { os = 'Mac'; osKnown = true; }
  else if (/Windows NT/.test(ua)) { os = 'Windows'; osKnown = true; }
  else if (/Linux/.test(ua)) { os = 'Linux'; osKnown = true; }

  return { label: `${browser} on ${os}`, browser, os, browserKnown, osKnown };
}

// Heuristic bot detection — runs AFTER the obvious BOT_UA filter that
// catches honest crawlers. This catches the dishonest ones that fake a
// browser UA but leak signal elsewhere: scraper traffic from CDN/cloud
// ASNs, or UAs that look browser-shaped but match no known parser.
function detectBot(orgCategory, device) {
  if (orgCategory === 'CDN / edge')
    return { flagged: true, reason: 'CDN/edge infrastructure (not a real client)' };
  if (!device.browserKnown && !device.osKnown)
    return { flagged: true, reason: 'unrecognized browser+OS (likely faked UA)' };
  if (!device.browserKnown && orgCategory === 'Cloud / hosting')
    return { flagged: true, reason: 'cloud ASN + unknown browser' };
  return { flagged: false };
}

function formatReferer(ref) {
  try {
    const u = new URL(ref);
    return `[${u.hostname}${u.pathname}](${ref})`;
  } catch {
    return ref;
  }
}
