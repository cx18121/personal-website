export const BOT_UA = /bot|crawl|spider|slurp|duckduck|baidu|yandex|sogou|facebookexternal|twitter|linkedinbot|applebot|ahrefs|semrush|mj12|dotbot|headlesschrome|phantomjs|selenium|puppeteer|playwright|curl|wget|monitor|pingdom|uptime/i;

// Crawlers that use a browser-shaped user agent and therefore evade the
// general bot tokens above. This list is signal-only so the firehose keeps
// its existing coverage.
const SIGNAL_BOT_UA = /googleother|google-inspectiontool|google-read-aloud/i;

// Scanner, proxy, and commodity hosting organizations observed executing the
// site's JavaScript. These known-noise providers are excluded from signal;
// generic cloud and privacy networks are not excluded by network alone.
const NOISE_ORG = /onyphe|qualys|tenable|rapid7|censys|shodan|shadowserver|netcraft|binaryedge|leakix|securitytrails|stretchoid|alphastrike|driftnet|recyber|internet measurement|cyberresilience|1337 services|hostroyale|racknerd|aventice|subnet digital|uab code200|bl networks|omegatech|31173 services|qux labs|datacamp limited|m247|leaseweb|cogent communications|techoff srv|virtualine|tc datacenter|vpspay|server mania|contabo|scaleway|egihosting|logicweb|tnahosting|titanic technologies|oculus networks|datalix|digivps|ace data centers|frantech|cloudvider/i;

const STATIC_ROUTES = new Set([
  '/about',
  '/projects',
  '/contact',
  '/travels',
  '/theme',
  '/help',
]);

export function isValidSitePath(path) {
  if (typeof path !== 'string') return false;
  const normalized = path.length > 1 && path.endsWith('/')
    ? path.slice(0, -1)
    : path;
  if (normalized === '/' || STATIC_ROUTES.has(normalized)) return true;
  return /^\/(?:projects|travels)\/[^/]+$/.test(normalized);
}

export function classifyOrg(org, asn) {
  const label = org || (asn ? `ASN ${asn}` : 'unknown');
  if (!org) return { label, category: 'Unknown', color: 0x808080 };
  const s = org.toLowerCase();

  if (/t-mobile|verizon wireless|at&t mobility|sprint|cellco|cricket|metropcs|bharti airtel|reliance jio|vodafone idea|orange s\.|telefonica|o2 czech|ee limited|vodafone gmbh/.test(s))
    return { label, category: 'Mobile carrier', color: 0xe0c060 };

  if (/comcast|spectrum|charter|cox|verizon fios|verizon online|centurylink|frontier|optimum|cablevision|xfinity|altice|rogers|bell canada|telus|shaw|virgin media|sky broadband|bt group|deutsche telekom|google fiber|maroctelecom/.test(s))
    return { label, category: 'Residential ISP', color: 0xe0c060 };

  if (/zscaler|netskope|palo alto networks|cisco umbrella|prisma|forcepoint|symantec|mcafee|cato networks|perimeter 81|iboss|menlo security/.test(s))
    return { label, category: 'Security gateway', color: 0xd97757 };

  if (/nordvpn|expressvpn|surfshark|protonvpn|mullvad|cyberghost|private internet|tunnelbear|ipvanish|windscribe|hideman/.test(s))
    return { label, category: 'Consumer VPN', color: 0xb381c5 };

  if (NOISE_ORG.test(s) || /amazon\.com|amazon technologies|amazon data|aws|google llc|google cloud|microsoft corp|azure|digitalocean|linode|vultr|hetzner|ovh|oracle|alibaba cloud|aliyun|tencent cloud|routerhosting|mevspace/.test(s))
    return { label, category: 'Cloud / hosting', color: 0xb381c5 };

  if (/cloudflare|akamai|fastly|stackpath|incapsula|imperva|sucuri/.test(s))
    return { label, category: 'CDN / edge', color: 0x808080 };

  if (/apple inc/.test(s))
    return { label, category: 'iCloud Private Relay', color: 0xb381c5 };

  return { label, category: 'Other network', color: 0x808080 };
}

export function parseDevice(ua) {
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

export function detectBot(orgCategory, device, path) {
  if (!isValidSitePath(path))
    return { flagged: true, reason: 'invalid/probe path' };
  if (!device.browserKnown && !device.osKnown)
    return { flagged: true, reason: 'unrecognized browser+OS (likely faked UA)' };
  if (!device.browserKnown && orgCategory === 'Cloud / hosting')
    return { flagged: true, reason: 'cloud ASN + unknown browser' };
  return { flagged: false };
}

export function signalRejectionReason({
  orgLabel,
  botFlagged,
  ua,
}) {
  if (BOT_UA.test(ua || '') || SIGNAL_BOT_UA.test(ua || ''))
    return 'known crawler user agent';
  if (NOISE_ORG.test(orgLabel || ''))
    return 'known scanner or proxy network';
  if (botFlagged)
    return 'request already flagged as automated';
  return null;
}
