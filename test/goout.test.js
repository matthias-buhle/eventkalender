import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { name, fetchEvents } from '../src/sources/goout.js';

const fx = (datei) => readFileSync(new URL(`./fixtures/${datei}`, import.meta.url), 'utf8');
const SITEMAP = 'https://goout.net/sitemaps/city-CS-0.xml';
const config = {
  enabled: true,
  sitemapUrl: SITEMAP,
  cities: ['decin', 'usti-nad-labem', 'liberec', 'ceska-lipa'],
  categories: ['koncerty', 'parties', 'jine-akce'],
};

/** Eine Seite mit JSON-LD-Terminen im Format von GoOut. */
function seite(events) {
  const ld = events.map((e) => `<script type="application/ld+json">${JSON.stringify({
    '@context': 'http://schema.org', '@type': 'Event',
    name: 'Testkonzert', startDate: 'Sat Nov 14 2026 19:00:00 GMT+0000 (Coordinated Universal Time)',
    endDate: 'Sat Nov 14 2026 22:59:59 GMT+0000 (Coordinated Universal Time)',
    url: 'https://goout.net/cs/testkonzert/szabcde/',
    location: { '@type': 'Place', name: 'Klub Test', address: { '@type': 'PostalAddress', addressLocality: 'Liberec', streetAddress: 'Hlavní 1' } },
    offers: [{ '@type': 'Offer', url: 'https://goout.net/sale/1', availability: 'InStock', price: '300' }],
    ...e,
  })}</script>`).join('\n');
  return `<!doctype html><html><head>${ld}</head><body></body></html>`;
}

/** Fake-Client: Sitemap aus der Fixture, alle Seiten liefern `seitenBody`. */
function fakeHttp(seitenBody) {
  const abgerufen = [];
  return {
    abgerufen,
    get: async (url) => {
      abgerufen.push(url);
      if (url === SITEMAP) return { status: 200, body: fx('goout-sitemap.xml'), url };
      if (seitenBody instanceof Error) throw seitenBody;
      return { status: 200, body: seitenBody, url };
    },
  };
}
const holen = (events, extra = {}) =>
  fetchEvents({ http: fakeHttp(seite(events)), today: '2026-11-08', config: { ...config, ...extra } });

test('Quellenname ist goout', () => {
  assert.equal(name, 'goout');
});

test('goout: ruft nur die gewählten Städte und Kategorien aus der Sitemap ab', async () => {
  const http = fakeHttp(seite([{}]));
  await fetchEvents({ http, today: '2026-11-08', config });
  const seiten = http.abgerufen.filter((u) => u !== SITEMAP).sort();
  assert.deepEqual(seiten.map((u) => u.split('/').slice(4, 6).join('/')), [
    'ceska-lipa/koncerty', 'decin/koncerty', 'liberec/jine-akce', 'liberec/koncerty', 'liberec/parties',
    'usti-nad-labem/jine-akce', 'usti-nad-labem/koncerty',
  ]);
});

test('goout: echte Liberec-Seite liefert Termine mit Titel, Ort, Quellenlink und Ticketlink', async () => {
  const http = { get: async (url) => ({ status: 200, body: url === SITEMAP ? fx('goout-sitemap.xml') : fx('goout-liberec-koncerty.html'), url }) };
  const events = await fetchEvents({ http, today: '2026-11-08', config });
  assert.equal(events.length, 3); // dieselben drei Termine aus mehreren Seiten zählen einmal
  for (const e of events) {
    assert.ok(e.title);
    assert.match(e.start, /^2026-\d\d-\d\dT\d\d:\d\d:00\+01:00$/);
    assert.match(e.sources[0].url, /^https:\/\/goout\.net\/cs\//);
    assert.match(e.ticketUrl, /^https:\/\/goout\.net\/sale\//);
    assert.match(e.placeName, /Liberec/);
  }
});

test('goout: InStock ergibt verfuegbar, OutOfStock ausverkauft, fehlendes offers null', async () => {
  const [a, b, c] = await holen([
    { name: 'A', url: 'https://goout.net/cs/a/s1/' },
    { name: 'B', url: 'https://goout.net/cs/b/s2/', offers: [{ availability: 'OutOfStock', url: 'https://goout.net/sale/2' }] },
    { name: 'C', url: 'https://goout.net/cs/c/s3/', offers: undefined },
  ]);
  assert.equal(a.ticketStatus, 'verfuegbar');
  assert.equal(b.ticketStatus, 'ausverkauft');
  assert.equal(c.ticketStatus, null);
  assert.equal(c.ticketUrl, null);
});

test('goout: tschechischer Abgesagt-Hinweis im Titel schlägt InStock', async () => {
  const [e] = await holen([{ name: 'ZRUŠENO: Koncert', url: 'https://goout.net/cs/z/s9/' }]);
  assert.equal(e.ticketStatus, 'abgesagt');
});

test("goout: country ist 'CZ'", async () => {
  const events = await holen([{}]);
  assert.ok(events.length > 0);
  assert.ok(events.every((e) => e.country === 'CZ'));
});

test("goout: nicht-ISO startDate wird zu '2026-11-14T20:00:00+01:00' (Berlin) geparst", async () => {
  const [e] = await holen([{}]);
  assert.equal(e.start, '2026-11-14T20:00:00+01:00');
  assert.equal(e.hasTime, true);
  assert.equal(e.end, null, 'der Platzhalter-Schluss 23:59:59 ist kein echtes Ende');
  const [sommer] = await holen([{ startDate: 'Sat Jul 04 2026 18:00:00 GMT+0000 (Coordinated Universal Time)', url: 'https://goout.net/cs/x/sx/' }], {});
  assert.equal(sommer.start, '2026-07-04T20:00:00+02:00');
});

test('goout: ISO-Datum ohne Uhrzeit hat hasTime false', async () => {
  const [e] = await holen([{ startDate: '2026-11-20', endDate: undefined }]);
  assert.equal(e.start, '2026-11-20T00:00:00+01:00');
  assert.equal(e.hasTime, false);
});

test('goout: Art folgt der Kategorieseite (Konzerte, Partys)', async () => {
  const http = fakeHttp(seite([{ name: 'Etwas' }]));
  const events = await fetchEvents({ http, today: '2026-11-08', config: { ...config, categories: ['parties'] } });
  assert.equal(events[0].art, 'party');
  const konz = await fetchEvents({ http, today: '2026-11-08', config: { ...config, categories: ['koncerty'] } });
  assert.equal(konz[0].art, 'konzert');
});

test('goout: eine fehlende Seite überspringt nur diese Seite, fallen alle aus, ist es ein Fehler', async () => {
  let n = 0;
  const http = {
    get: async (url) => {
      if (url === SITEMAP) return { status: 200, body: fx('goout-sitemap.xml'), url };
      if (n++ === 0) throw new Error('HTTP 404');
      return { status: 200, body: seite([{}]), url };
    },
  };
  assert.equal((await fetchEvents({ http, today: '2026-11-08', config })).length, 1);
  await assert.rejects(fetchEvents({ http: fakeHttp(new Error('HTTP 500')), today: '2026-11-08', config }), /HTTP 500/);
});

test('goout: Sitemap ohne passende Seiten ist ein Fehler, nicht eine leere Liste', async () => {
  const http = { get: async (url) => ({ status: 200, body: '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>', url }) };
  await assert.rejects(fetchEvents({ http, today: '2026-11-08', config }), /Sitemap/);
});
