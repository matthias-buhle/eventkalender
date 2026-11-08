import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createPoliteClient, RobotsDisallowedError, HttpError } from '../src/http.js';

let server, base;
const hits = { robots: 0, flaky: 0, always503: 0 };
let robotsBody = 'User-agent: *\nDisallow: /private\nCrawl-delay: 1\n';
let robotsStatus = 200;

before(async () => {
  server = http.createServer((req, res) => {
    if (req.url === '/robots.txt') {
      hits.robots++;
      res.writeHead(robotsStatus, { 'content-type': 'text/plain' });
      return res.end(robotsStatus === 200 ? robotsBody : 'nix');
    }
    if (req.url === '/flaky') {
      hits.flaky++;
      res.writeHead(hits.flaky === 1 ? 503 : 200);
      return res.end('ok');
    }
    if (req.url === '/always503') { hits.always503++; res.writeHead(503); return res.end('kaputt'); }
    if (req.url === '/slow') return; // antwortet nie
    if (req.url === '/data.json') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end('{"a":1}'); }
    res.writeHead(200); res.end('hallo');
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => { server.closeAllConnections(); server.close(); });

function fakeClock() {
  let t = 0;
  const sleeps = [];
  return { now: () => t, sleep: async (ms) => { sleeps.push(ms); t += ms; }, sleeps };
}
const newClient = (extra = {}) => createPoliteClient({ userAgent: 'eventkalender-ostsachsen/1.0 (test)', perHostDelayMs: 0, ...extra });

test('verweigert Pfad, den robots.txt sperrt', async () => {
  const c = newClient({ ...fakeClock() });
  await assert.rejects(c.get(`${base}/private/x`), RobotsDisallowedError);
});

test('wartet mindestens Crawl-delay zwischen zwei Abrufen desselben Hosts', async () => {
  const clock = fakeClock();
  const c = newClient(clock);
  await c.get(`${base}/a`);
  await c.get(`${base}/b`);
  assert.ok(clock.sleeps.some((ms) => ms >= 1000), `Wartezeiten: ${clock.sleeps}`);
});

test('ruft robots.txt pro Host nur einmal ab', async () => {
  hits.robots = 0;
  const c = newClient({ ...fakeClock() });
  await c.get(`${base}/a`); await c.get(`${base}/b`); await c.get(`${base}/c`);
  assert.equal(hits.robots, 1);
});

test('wiederholt genau einmal bei Status 503', async () => {
  hits.flaky = 0; hits.always503 = 0;
  const c = newClient({ ...fakeClock() });
  const r = await c.get(`${base}/flaky`);
  assert.equal(r.status, 200);
  assert.equal(hits.flaky, 2);
  await assert.rejects(c.get(`${base}/always503`), (e) => e instanceof HttpError && e.status === 503);
  assert.equal(hits.always503, 2);
});

test('bricht nach timeoutMs ab', async () => {
  const c = newClient({ ...fakeClock(), timeoutMs: 150 });
  await assert.rejects(c.get(`${base}/slow`), /time|abort/i);
});

test('liefert geparstes JSON bei as:json', async () => {
  const c = newClient({ ...fakeClock() });
  const r = await c.get(`${base}/data.json`, { as: 'json' });
  assert.deepEqual(r.body, { a: 1 });
});

test('fehlende robots.txt (404) erlaubt alles', async () => {
  robotsStatus = 404;
  try {
    const c = newClient({ ...fakeClock() });
    const r = await c.get(`${base}/private/x`);
    assert.equal(r.status, 200);
  } finally { robotsStatus = 200; }
});

test('sendet den eigenen User-Agent', async () => {
  let seen;
  const fetchImpl = async (url, opts) => { seen = opts.headers['User-Agent']; return new Response('', { status: 404 }); };
  const c = createPoliteClient({ userAgent: 'eventkalender-ostsachsen/1.0 (test)', perHostDelayMs: 0, fetchImpl, ...fakeClock() });
  await c.get('http://example.invalid/x').catch(() => {});
  assert.match(seen, /^eventkalender-ostsachsen\/1\.0/);
});
