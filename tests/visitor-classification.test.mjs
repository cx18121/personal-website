import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BOT_UA,
  classifyOrg,
  detectBot,
  isValidSitePath,
  parseDevice,
  signalRejectionReason,
} from '../functions/visitor-classification.mjs';

const chromeOnMac = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36';
const googleOther = 'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.8010.47 Mobile Safari/537.36 (compatible; GoogleOther)';

test('recognizes only routes the site serves', () => {
  for (const path of ['/', '/about', '/projects', '/projects/sparrow', '/travels/peru', '/help/']) {
    assert.equal(isValidSitePath(path), true, path);
  }
  for (const path of ['/.env', '/wp-admin/install.php', '/projects/foo/bar', '/api']) {
    assert.equal(isValidSitePath(path), false, path);
  }
});

test('describes an unmatched ASN owner without calling the visitor corporate', () => {
  assert.deepEqual(classifyOrg('Cornell University', 26), {
    label: 'Cornell University',
    category: 'Other network',
    color: 0x808080,
  });
});

test('recognizes audited hosting providers', () => {
  assert.equal(classifyOrg('Subnet Digital LLC', 9009).category, 'Cloud / hosting');
  assert.equal(classifyOrg('LogicWeb Inc.', 64286).category, 'Cloud / hosting');
  assert.equal(classifyOrg('Charter Communications Inc', 11426).category, 'Residential ISP');
});

test('marks an invalid route as automation even with a browser user agent', () => {
  const device = parseDevice(chromeOnMac);
  assert.deepEqual(detectBot('Other network', device, '/.env'), {
    flagged: true,
    reason: 'invalid/probe path',
  });
  assert.deepEqual(detectBot('Other network', device, '/'), { flagged: false });
});

test('keeps the firehose bot filter unchanged', () => {
  assert.equal(BOT_UA.test(googleOther), false);
});

test('rejects browser-shaped crawlers from signal', () => {
  assert.equal(signalRejectionReason({
    eventType: 'view',
    orgLabel: 'Google LLC',
    orgCategory: 'Cloud / hosting',
    botFlagged: false,
    ua: googleOther,
  }), 'known crawler user agent');
});

test('accepts a homepage visitor from generic cloud infrastructure', () => {
  assert.equal(signalRejectionReason({
    orgLabel: 'Amazon Technologies Inc.',
    botFlagged: false,
    ua: chromeOnMac,
  }), null);
});

test('rejects known noise providers even after a view', () => {
  assert.equal(signalRejectionReason({
    eventType: 'view',
    orgLabel: 'Subnet Digital LLC',
    orgCategory: 'Cloud / hosting',
    botFlagged: false,
    ua: chromeOnMac,
  }), 'known scanner or proxy network');
});

test('accepts a homepage visitor through a CDN-backed privacy proxy', () => {
  const bot = detectBot('CDN / edge', parseDevice(chromeOnMac), '/');
  assert.equal(signalRejectionReason({
    orgLabel: 'Cloudflare, Inc.',
    botFlagged: bot.flagged,
    ua: chromeOnMac,
  }), null);
});

test('still rejects an unrecognized client from a CDN network', () => {
  const ua = 'unrecognized-client';
  const bot = detectBot('CDN / edge', parseDevice(ua), '/projects/sparrow');
  assert.equal(signalRejectionReason({
    orgLabel: 'Cloudflare, Inc.',
    botFlagged: bot.flagged,
    ua,
  }), 'request already flagged as automated');
});

test('accepts a normal browser load from an access network', () => {
  assert.equal(signalRejectionReason({
    eventType: 'load',
    orgLabel: 'Charter Communications Inc',
    orgCategory: 'Residential ISP',
    botFlagged: false,
    ua: chromeOnMac,
  }), null);
});
