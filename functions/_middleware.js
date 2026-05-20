// Cloudflare Pages middleware. Runs on every request before the static
// asset is served. For each non-bot HTML page load it:
//   1. Pings a Discord webhook with visitor metadata (realtime feel).
//   2. Appends a row to the D1 visit log (durable, queryable history).
// Both writes go through waitUntil so they never block the response.
//
// Bindings (see wrangler.toml):
//   VISITOR_LOG          D1 database (table `visits`)
//   DISCORD_WEBHOOK_URL  secret — set with `wrangler pages secret put`

const SKIP_EXT = /\.(css|js|mjs|png|jpe?g|webp|svg|gif|ico|woff2?|ttf|otf|map|json|xml|txt|pdf)$/i;
const BOT_UA = /bot|crawl|spider|slurp|duckduck|baidu|yandex|sogou|facebookexternal|twitter|linkedinbot|applebot|ahrefs|semrush|mj12|dotbot|headlesschrome|phantomjs|selenium|puppeteer|playwright|curl|wget|monitor|pingdom|uptime/i;

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

  const embed = {
    title,
    url: url.toString(),
    color: v.bot_flagged ? 0x4f5660 : v.org_color,
    fields,
    footer: { text: footerParts.join(' · ') },
    timestamp: v.ts,
  };

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed], allowed_mentions: { parse: [] } }),
    });
  } catch {
    // Best-effort — never break the page if Discord is down.
  }
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

  if (/t-mobile|verizon wireless|at&t mobility|sprint|cellco|cricket|metropcs/.test(s))
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
