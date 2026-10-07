import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequest } from '../functions/_middleware.js';

const chromeOnMac = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36';
const chromeOnWindows = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36';
const secretIP = '192.0.2.123';
const secretSalt = 'private-session-salt';
const webhook = 'https://discord.invalid/private-webhook';

// Exercise the public middleware boundary. This in-memory fixture implements
// session claims and message state, without contacting D1 or Discord.
function harness(t, { session = null, failStage, status = 200, fetchImpl } = {}) {
  const logs = [];
  const dbCalls = [];
  const deliveries = [];
  const pending = [];
  let row = session;
  t.mock.method(console, 'log', (line) => logs.push(JSON.parse(line)));
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    deliveries.push({ url, ...options, body: JSON.parse(options.body) });
    if (fetchImpl) return fetchImpl(url, options);
    if (failStage === 'fetch') throw new Error(`${webhook} ${secretIP}`);
    return new Response(JSON.stringify({ id: 'message-123' }), { status });
  });

  const db = {
    prepare(sql) {
      const stage = sql.startsWith('INSERT INTO sessions') ? 'session_claim'
        : sql.startsWith('SELECT') ? 'session_load'
        : sql.startsWith('DELETE') ? 'session_cleanup'
        : sql.includes('message_id = ?') ? 'session_save'
        : sql.startsWith('UPDATE') ? 'session_update'
        : 'firehose';
      let args;
      const execute = () => {
        dbCalls.push({ stage, sql, args });
        if (failStage === stage) throw new Error(`${secretIP} ${secretSalt} ${webhook}`);
      };
      return {
        bind(...values) { args = values; return this; },
        async run() {
          execute();
          if (stage === 'session_claim') {
            if (row) return { meta: { changes: 0 } };
            row = { message_id: '', content: '', last_seen: args[1] };
          } else if (stage === 'session_save') {
            row = { message_id: args[0], last_seen: args[1], content: args[2] };
          } else if (stage === 'session_update') {
            row.last_seen = args[0];
            row.content = args[1];
          } else if (stage === 'session_cleanup' && row?.message_id === '') {
            row = null;
          }
          return { meta: { changes: 1 } };
        },
        async first() { execute(); return row ? { ...row } : null; },
      };
    },
  };
  const env = {
    VISITOR_LOG: db,
    SESSION_SALT: secretSalt,
    DISCORD_WEBHOOK_URL: webhook,
    DISCORD_SIGNAL_WEBHOOK_URL: webhook,
  };

  async function send({ path = '/b?e=load', referer = 'https://site.invalid/', fetchSite,
    ua = chromeOnMac, org = 'RackNerd LLC', ip = secretIP, missingBinding,
    drain = true } = {}) {
    const headers = { 'user-agent': ua };
    if (referer !== null) headers.referer = referer;
    if (fetchSite) headers['sec-fetch-site'] = fetchSite;
    if (ip !== null) headers['cf-connecting-ip'] = ip;
    const request = new Request(`https://site.invalid${path}`, { headers });
    request.cf = { asOrganization: org, asn: 36352, city: 'Chicago', country: 'US' };
    const bindings = { ...env };
    if (missingBinding) delete bindings[missingBinding];
    let nextCalls = 0;
    const response = await onRequest({
      request,
      env: bindings,
      next: () => { nextCalls++; return new Response('page'); },
      waitUntil: (promise) => pending.push(promise),
    });
    if (drain) await Promise.all(pending);
    return { response, nextCalls };
  }
  return { logs, dbCalls, deliveries, pending, send, get row() { return row; } };
}

function hasLog(h, expected) {
  return h.logs.some((log) => Object.entries(expected).every(([key, value]) => log[key] === value));
}

function assertPrivateLogs(h) {
  const serialized = JSON.stringify(h.logs);
  for (const secret of [secretIP, secretSalt, webhook]) assert.equal(serialized.includes(secret), false);
  const keys = new Set(['event', 'outcome', 'reason', 'stage', 'status']);
  for (const log of h.logs) {
    assert.equal(log.event, 'visitor_signal');
    assert.ok(Object.keys(log).every((key) => keys.has(key)));
  }
}

test('RackNerd load reaches a likely-visitor Discord embed, not the firehose', async (t) => {
  const h = harness(t);
  const { response, nextCalls } = await h.send();
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(nextCalls, 0);
  assert.equal(h.deliveries.length, 1);
  const embed = h.deliveries[0].body.embeds[0];
  assert.equal(embed.title, '🟢 Likely visitor');
  assert.match(embed.description, /landed `\/`/);
  assert.equal(embed.fields[0].value, 'RackNerd LLC\nCloud / hosting');
  assert.ok(h.row.message_id);
  assert.equal(h.dbCalls.some((call) => call.stage === 'firehose'), false);
  assert.ok(hasLog(h, { outcome: 'accepted' }));
  assert.ok(hasLog(h, { outcome: 'delivered', stage: 'discord_create' }));
  assertPrivateLogs(h);
});

for (const org of ['GlobalConnect AB', 'Cogent Communications', 'Subnet Digital LLC', 'Shodan']) {
  test(`${org} Windows browser load is not rejected by network name`, async (t) => {
    const h = harness(t);
    await h.send({ org, ua: chromeOnWindows });
    assert.equal(h.deliveries.length, 1);
    assert.ok(hasLog(h, { outcome: 'delivered' }));
    assert.equal(hasLog(h, { outcome: 'rejected' }), false);
  });
}

test('content view edits an existing Discord session and records engagement', async (t) => {
  const h = harness(t);
  await h.send();
  await h.send({ path: '/b?e=view&k=project&n=sparrow', referer: 'https://site.invalid/projects/sparrow' });
  assert.equal(h.deliveries.length, 2);
  assert.equal(h.deliveries[1].method, 'PATCH');
  const embed = h.deliveries[1].body.embeds[0];
  assert.equal(embed.title, '🟢 Engaged visitor');
  assert.match(embed.description, /landed `\/`/);
  assert.match(embed.description, /viewed project `sparrow`/);
  assert.match(h.row.content, /viewed project `sparrow`/);
  assert.ok(hasLog(h, { outcome: 'delivered', stage: 'discord_edit' }));
});

const rejectedCases = [
  [{ ip: null }, 'missing client IP'],
  [{ referer: null }, 'missing same-origin evidence'],
  [{ referer: 'https://external.invalid/' }, 'missing same-origin evidence'],
  [{ referer: 'https://site.invalid/.env' }, 'invalid/probe path'],
  [{ path: '/b?e=invalid' }, 'invalid event type'],
  [{ path: '/b?e=view' }, 'invalid content name'],
  [{ path: '/b?e=view&n=%60injected%60' }, 'invalid content name'],
  [{ path: `/b?e=view&n=${'a'.repeat(41)}` }, 'invalid content name'],
  [{ path: '/b?e=view&n=sparrow&k=invalid' }, 'invalid content kind'],
  [{ ua: `${chromeOnMac} GoogleOther` }, 'known crawler user agent'],
  [{ ua: `${chromeOnMac} HeadlessChrome` }, 'known crawler user agent'],
  [{ ua: 'unrecognized-client' }, 'request already flagged as automated'],
  [{ ua: 'Windows NT 10.0' }, 'request already flagged as automated'],
];
for (const [options, reason] of rejectedCases) {
  test(`beacon rejects ${JSON.stringify(options)} with a diagnostic reason`, async (t) => {
    const h = harness(t);
    const { response } = await h.send(options);
    assert.equal(response.status, 204);
    assert.equal(h.dbCalls.length, 0);
    assert.equal(h.deliveries.length, 0);
    assert.ok(hasLog(h, { outcome: 'rejected', reason }));
    assertPrivateLogs(h);
  });
}

for (const missingBinding of ['VISITOR_LOG', 'SESSION_SALT', 'DISCORD_SIGNAL_WEBHOOK_URL']) {
  test(`missing ${missingBinding} is observable without exposing binding values`, async (t) => {
    const h = harness(t);
    const { response } = await h.send({ missingBinding });
    assert.equal(response.status, 204);
    assert.equal(h.dbCalls.length, 0);
    assert.equal(h.deliveries.length, 0);
    assert.ok(hasLog(h, { outcome: 'skipped', reason: 'missing signal bindings' }));
    assertPrivateLogs(h);
  });
}

for (const referer of [null, 'not a URL', 'https://external.invalid/']) {
  test(`same-origin fetch metadata preserves homepage fallback with referrer ${referer}`, async (t) => {
    const h = harness(t);
    await h.send({ referer, fetchSite: 'same-origin' });
    assert.equal(h.deliveries.length, 1);
    assert.match(h.deliveries[0].body.embeds[0].description, /landed `\/`/);
  });
}

test('Discord POST failure is not logged as successful delivery and releases the claim', async (t) => {
  const h = harness(t, { status: 429 });
  await h.send();
  assert.ok(hasLog(h, { outcome: 'failed', stage: 'discord_create', status: 429 }));
  assert.equal(hasLog(h, { outcome: 'delivered' }), false);
  assert.equal(h.row, null);
  assertPrivateLogs(h);
});

test('Discord PATCH failure is not replaced with a duplicate message', async (t) => {
  const h = harness(t, { status: 404, session: { message_id: 'existing', content: 'landed `/`', last_seen: new Date().toISOString() } });
  await h.send({ path: '/b?e=view&n=sparrow&k=project' });
  assert.equal(h.deliveries.length, 1);
  assert.equal(h.deliveries[0].method, 'PATCH');
  assert.ok(hasLog(h, { outcome: 'failed', stage: 'discord_edit', status: 404 }));
  assert.equal(hasLog(h, { outcome: 'delivered' }), false);
  assert.equal(h.dbCalls.some((call) => call.stage === 'session_update'), false);
});

for (const failStage of ['session_claim', 'session_load', 'session_save', 'session_update', 'session_cleanup', 'fetch']) {
  test(`${failStage} failure is visible without leaking exception details`, async (t) => {
    const session = ['session_load', 'session_update'].includes(failStage)
      ? { message_id: 'existing', content: 'landed `/`', last_seen: new Date().toISOString() } : null;
    const h = harness(t, { failStage, session, status: failStage === 'session_cleanup' ? 500 : 200 });
    await h.send();
    assert.ok(hasLog(h, { outcome: 'failed', stage: failStage === 'fetch' ? 'discord_create' : failStage }));
    assertPrivateLogs(h);
  });
}

test('unexpected background error is observed without changing the beacon response', async (t) => {
  const h = harness(t);
  t.mock.method(crypto.subtle, 'digest', async () => { throw new Error(secretIP); });
  const { response } = await h.send();
  assert.equal(response.status, 204);
  assert.ok(hasLog(h, { outcome: 'failed', stage: 'beacon' }));
  assert.equal(h.deliveries.length, 0);
  assertPrivateLogs(h);
});

test('204 does not promise completed delivery; a creation race is explicitly logged as dropped', async (t) => {
  let release;
  const blocked = new Promise((resolve) => { release = resolve; });
  let started;
  const creating = new Promise((resolve) => { started = resolve; });
  const h = harness(t, { fetchImpl: async () => {
    started();
    await blocked;
    return new Response(JSON.stringify({ id: 'message-123' }));
  } });
  const { response } = await h.send({ drain: false });
  assert.equal(response.status, 204);
  await creating;
  await h.send({ path: '/b?e=view&n=sparrow', drain: false });
  await h.pending[1];
  assert.ok(hasLog(h, { outcome: 'dropped', reason: 'session message pending' }));
  assert.equal(hasLog(h, { outcome: 'delivered' }), false);
  release();
  await Promise.all(h.pending);
  assert.equal(h.deliveries.length, 1);
  assert.ok(hasLog(h, { outcome: 'delivered' }));
  assert.doesNotMatch(h.row.content, /viewed/);
});

test('firehose still records a normal GET and serves the page', async (t) => {
  const h = harness(t);
  const { response, nextCalls } = await h.send({ path: '/' });
  assert.equal(response.status, 200);
  assert.equal(nextCalls, 1);
  assert.equal(h.deliveries.length, 1);
  assert.equal(h.deliveries[0].body.embeds[0].title, '/');
  assert.equal(h.dbCalls.filter((call) => call.stage === 'firehose').length, 1);
  assert.equal(h.logs.length, 0);
});

for (const options of [{ path: '/app.js' }, { path: '/', ua: 'Googlebot' }]) {
  test(`firehose still skips ${JSON.stringify(options)}`, async (t) => {
    const h = harness(t);
    const { nextCalls } = await h.send(options);
    assert.equal(nextCalls, 1);
    assert.equal(h.deliveries.length, 0);
    assert.equal(h.dbCalls.length, 0);
    assert.equal(h.logs.length, 0);
  });
}
