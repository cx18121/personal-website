// Cloudflare Pages middleware. Runs on every request before the static
// asset is served. For each non-bot HTML page load it:
//   1. Pings the firehose Discord webhook (every visit, raw stream).
//   2. Appends a row to the D1 visit log (durable, queryable history).
//   3. If the visit looks like signal (real human from a corp/ISP/mobile
//      ASN, not a scanner, not a probe path), also pings the signal
//      webhook. Multi-page visits from the same person collapse into a
//      single message that gets edited (PATCHed) as they browse more
//      pages — works in a normal text channel, no forum required.
// All writes go through waitUntil so they never block the response.
//
// Bindings (see wrangler.toml):
//   VISITOR_LOG                 D1 database (tables `visits`, `sessions`)
//   DISCORD_WEBHOOK_URL         secret — firehose text channel
//   DISCORD_SIGNAL_WEBHOOK_URL  secret — signal text channel (optional)
//   SESSION_SALT                secret — salt for IP→session_key hash

const SKIP_EXT = /\.(css|js|mjs|png|jpe?g|webp|svg|gif|ico|woff2?|ttf|otf|map|json|xml|txt|pdf)$/i;
const BOT_UA = /bot|crawl|spider|slurp|duckduck|baidu|yandex|sogou|facebookexternal|twitter|linkedinbot|applebot|ahrefs|semrush|mj12|dotbot|headlesschrome|phantomjs|selenium|puppeteer|playwright|curl|wget|monitor|pingdom|uptime/i;

// Paths a static personal site never legitimately serves. Hitting any
// of these is a scanner probing for CMS / config / cred leaks.
const PROBE_PATH = /^\/(?:wp-|wordpress|xmlrpc|setup\/?$|admin\/?$|\.env|\.git|\.aws|\.ssh|phpmyadmin|cgi-bin|owa\/|ecp\/|autodiscover|hudson|jenkins|actuator|console\/|boaform|RouterAccess|HNAP1|hnap1|api\/|server-status|solr\/|cf_scripts\/|vendor\/phpunit|geoserver|drupal|joomla|magento)/i;

// Orgs that show up as "Likely corporate" or similar but are actually
// internet-wide scanners or commercial proxy/scraper providers. Filter
// these out of the signal channel.
const NOISE_ORG = /onyphe|qualys|tenable|rapid7|censys|shodan|shadowserver|netcraft|binaryedge|leakix|securitytrails|stretchoid|alphastrike|driftnet|recyber|internet measurement|cyberresilience|1337 services|hostroyale|racknerd|aventice|subnet digital|uab code200|bl networks|omegatech|31173 services|qux labs|datacamp limited|m247|leaseweb|cogent communications/i;

// Session freshness window — visits from the same session_key within
// this window get appended to the existing message. After this we
// start a fresh message (probably a different reading session).
const SESSION_WINDOW_MS = 30 * 60 * 1000;

// Discord message content limit is 2000 chars. Keep the running visit
// log under this with comfortable headroom for the header.
const MAX_VISIT_LINES = 30;
const MAX_CONTENT_CHARS = 1900;
const SUPPRESS_EMBEDS_FLAG = 1 << 2;

export async function onRequest(context) {
  const { request, env, next, waitUntil } = context;
  const url = new URL(request.url);
  const ua = request.headers.get('user-agent') || '';

  if (url.hostname === 'www.charliexue.com') {
    url.hostname = 'charliexue.com';
    return Response.redirect(url.toString(), 301);
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
    if (
      env.DISCORD_SIGNAL_WEBHOOK_URL &&
      env.VISITOR_LOG &&
      env.SESSION_SALT &&
      isSignal(visit)
    ) {
      const ip = request.headers.get('cf-connecting-ip') || '';
      if (ip) {
        waitUntil(
          reportSignal(env.DISCORD_SIGNAL_WEBHOOK_URL, env.VISITOR_LOG, env.SESSION_SALT, ip, visit),
        );
      }
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

// Signal = "this looks like a real human from a real network, not a
// scanner or proxy." Recruiter visits clear all these gates.
function isSignal(v) {
  if (v.bot_flagged) return false;
  if (PROBE_PATH.test(v.path)) return false;
  if (v.org_label && NOISE_ORG.test(v.org_label)) return false;
  switch (v.org_category) {
    case 'Likely corporate':
    case 'SASE (corp behind security vendor)':
    case 'Residential ISP':
    case 'Mobile carrier':
      return true;
    default:
      return false;
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

// Edit-in-place threading: each visitor session is one Discord message
// that we PATCH with each new pageview, so a multi-page visit shows up
// as one growing message instead of N separate notifications. Works in
// a normal text channel — no forum required.
async function reportSignal(webhookUrl, db, salt, ip, v) {
  const sessionKey = await hashSession(salt, ip);
  const session = await loadSession(db, sessionKey);
  const fresh = session && Date.now() - Date.parse(session.last_seen) < SESSION_WINDOW_MS;

  if (fresh) {
    const edited = await tryEditMessage(webhookUrl, db, sessionKey, session, v);
    if (edited) return;
    // PATCH failed (404 → message was deleted manually, etc.) — fall
    // through and post a fresh one.
  }

  await createSessionMessage(webhookUrl, db, sessionKey, v);
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

async function tryEditMessage(webhookUrl, db, sessionKey, session, v) {
  const newContent = appendVisitLine(session.content, v);
  try {
    const res = await fetch(`${webhookUrl}/messages/${session.message_id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: newContent,
        allowed_mentions: { parse: [] },
      }),
    });
    if (!res.ok) return false;
    await db
      .prepare('UPDATE sessions SET last_seen = ?, hits = hits + 1, content = ? WHERE session_key = ?')
      .bind(v.ts, newContent, sessionKey)
      .run();
    return true;
  } catch {
    return false;
  }
}

async function createSessionMessage(webhookUrl, db, sessionKey, v) {
  const content = `${formatHeader(v)}\n${formatVisitLine(v)}`;
  try {
    const res = await fetch(`${webhookUrl}?wait=true`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content,
        flags: SUPPRESS_EMBEDS_FLAG,
        allowed_mentions: { parse: [] },
      }),
    });
    if (!res.ok) return;
    const msg = await res.json();
    if (!msg.id) return;
    await db
      .prepare(
        `INSERT INTO sessions (session_key, message_id, first_seen, last_seen, hits, content)
         VALUES (?, ?, ?, ?, 1, ?)
         ON CONFLICT(session_key) DO UPDATE SET
           message_id = excluded.message_id,
           first_seen = excluded.first_seen,
           last_seen  = excluded.last_seen,
           hits       = 1,
           content    = excluded.content`,
      )
      .bind(sessionKey, msg.id, v.ts, v.ts, content)
      .run();
  } catch {
    // Swallow.
  }
}

// Two-line header: org + device on line 1, location + ASN/colo on line 2.
function formatHeader(v) {
  const dot = headerDot(v);
  const loc = [v.city, v.region, v.country].filter(Boolean).join(', ') || 'unknown';
  return (
    `${dot} **${v.org_label}** · _${v.org_category}_ · ${v.device_label}\n` +
    `📍 ${loc} · ASN ${v.asn || '?'} · ${v.colo || 'cf'}`
  );
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

// IANA zone for the visit-line clock; DST handled automatically by Intl.
const DISPLAY_TZ = 'America/New_York';

function formatVisitLine(v) {
  const refererPart = v.referer ? ` ← ${formatReferer(v.referer)}` : '';
  const time = new Date(v.ts).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: DISPLAY_TZ,
  }); // HH:MM in DISPLAY_TZ
  return `\`${v.path}${v.query || ''}\`${refererPart} · ${time}`;
}

// Header is fixed (first 2 lines). Append the new visit line, trim
// older visit lines if we'd blow past Discord's 2000-char content cap.
function appendVisitLine(oldContent, v) {
  const lines = oldContent.split('\n');
  const header = lines.slice(0, 2);
  const visitLines = lines.slice(2).filter((l) => !l.startsWith('… '));
  visitLines.push(formatVisitLine(v));

  let kept = visitLines.slice(-MAX_VISIT_LINES);
  let body = kept.join('\n');
  let truncated = kept.length < visitLines.length;

  while (header.join('\n').length + 1 + (truncated ? 20 : 0) + body.length > MAX_CONTENT_CHARS && kept.length > 1) {
    kept = kept.slice(1);
    body = kept.join('\n');
    truncated = true;
  }

  const out = truncated
    ? `${header.join('\n')}\n… earlier omitted …\n${body}`
    : `${header.join('\n')}\n${body}`;
  return out;
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
