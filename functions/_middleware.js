// Cloudflare Pages middleware. Runs on every request before the static
// asset is served. Pings a Discord webhook with visitor metadata on HTML
// page loads; skips static assets and obvious bots. The webhook fires via
// waitUntil so it never blocks the response.
//
// DISCORD_WEBHOOK_URL is set as an encrypted env var via:
//   wrangler pages secret put DISCORD_WEBHOOK_URL --project-name=personal-website

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
    !BOT_UA.test(ua) &&
    env.DISCORD_WEBHOOK_URL
  ) {
    waitUntil(report(request, env.DISCORD_WEBHOOK_URL));
  }

  return next();
}

async function report(request, webhookUrl) {
  const url = new URL(request.url);
  const cf = request.cf || {};
  const ua = request.headers.get('user-agent') || '';
  const referer = request.headers.get('referer') || '';

  const org = classifyOrg(cf.asOrganization, cf.asn);
  const device = parseDevice(ua);
  const location = formatLocation(cf);

  const fields = [
    { name: 'Org', value: `${org.label}\n_${org.category}_`, inline: true },
    { name: 'Location', value: location || 'unknown', inline: true },
    { name: 'Device', value: device, inline: true },
  ];
  if (referer) {
    fields.push({ name: 'Came from', value: formatReferer(referer), inline: false });
  }

  const embed = {
    title: `${url.pathname}${url.search}`,
    url: url.toString(),
    color: org.color,
    fields,
    footer: { text: `ASN ${cf.asn || '?'} · ${cf.colo || 'cf'}` },
    timestamp: new Date().toISOString(),
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
  if (!ua) return 'unknown';
  let browser = 'Browser';
  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/OPR\//.test(ua) || /Opera\//.test(ua)) browser = 'Opera';
  else if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) browser = 'Chrome';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';
  else if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) browser = 'Safari';

  let os = 'OS';
  if (/iPhone/.test(ua)) os = 'iPhone';
  else if (/iPad/.test(ua)) os = 'iPad';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/Macintosh|Mac OS X/.test(ua)) os = 'Mac';
  else if (/Windows NT/.test(ua)) os = 'Windows';
  else if (/Linux/.test(ua)) os = 'Linux';

  return `${browser} on ${os}`;
}

function formatLocation(cf) {
  const parts = [cf.city, cf.region, cf.country].filter(Boolean);
  return parts.length ? parts.join(', ') : '';
}

function formatReferer(ref) {
  try {
    const u = new URL(ref);
    return `[${u.hostname}${u.pathname}](${ref})`;
  } catch {
    return ref;
  }
}
