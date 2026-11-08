import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { name, fetchEvents } from '../src/sources/satourn.js';

const fx = (datei) => readFileSync(new URL(`./fixtures/${datei}`, import.meta.url), 'utf8');

// Die Fixture enthält Termine ab dem 4.11.2026; ein früheres "heute" hält sie im Fenster.
const TODAY = '2026-11-01';
const SEBNITZ = 'https://www.sebnitz.org/Veranstaltungskalender/';
const INDEX = 'https://www.saechsische-schweiz.de/sitemap.xml';
const config = { enabled: true, sebnitzUrl: SEBNITZ, sitemapIndexUrl: INDEX, maxDetailPages: 150, horizonDays: 90 };
const sitemapUrls = [...fx('satourn-sitemap.xml').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

/** Fake-Client: liefert die Fixtures, die ersten zwei Sitemap-URLs mit Detailseiten, den Rest als 404. */
function fakeHttp(overrides = {}) {
  const abgerufen = [];
  const seiten = {
    [SEBNITZ]: fx('satourn-sebnitz.html'),
    [INDEX]: fx('satourn-sitemap-index.xml'),
    [sitemapUrls[0]]: fx('satourn-detail-1.html'),
    [sitemapUrls[1]]: fx('satourn-detail-2.html'),
    ...overrides,
  };
  return {
    abgerufen,
    get: async (url) => {
      abgerufen.push(url);
      if (url.includes('ndsdestinationdataevent')) return { status: 200, body: overrides.sitemap ?? fx('satourn-sitemap.xml'), url };
      if (!(url in seiten) || seiten[url] === null) throw new Error(`HTTP 404 für ${url}`);
      return { status: 200, body: seiten[url], url };
    },
  };
}

test('Quellenname ist satourn', () => {
  assert.equal(name, 'satourn');
});

test('satourn: jedes Event hat title, start und Ort', async () => {
  const events = await fetchEvents({ http: fakeHttp(), today: TODAY, config });
  assert.ok(events.length >= 5, `nur ${events.length} Events`);
  for (const e of events) {
    assert.ok(e.title, 'title');
    assert.match(e.start, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\+0[12]:00$/);
    assert.ok(e.placeName, `Ort fehlt bei ${e.title}`);
    assert.ok(e.sources[0].url.startsWith('https://'), 'Quellenlink');
  }
  assert.ok(events.some((e) => e.sources[0].name === 'sebnitz.org'));
  assert.ok(events.some((e) => e.sources[0].name === 'Sächsische Schweiz'));
});

test('satourn: Kontakt, Koordinaten und Preisfeld aus dem Sebnitzer Kalender', async () => {
  const events = await fetchEvents({ http: fakeHttp(), today: TODAY, config });
  const film = events.find((e) => e.title.startsWith('17. Europäisches Filmfestival'));
  assert.equal(film.contact.phone, '03597184252');
  assert.equal(film.contact.email, 'veranstaltung@stadtverwaltung-sebnitz.de');
  assert.equal(film.lat, 50.9724248);
  assert.equal(film.hasTime, true);
  assert.ok(film.description.length <= 300);
});

test('satourn: Kontakt aus dem Anbieter der Detailseite', async () => {
  const events = await fetchEvents({ http: fakeHttp(), today: TODAY, config });
  const gluehwein = events.find((e) => e.title.startsWith('Glühweinführung'));
  assert.equal(gluehwein.contact.phone, '+4935023' + '52980');
  assert.equal(gluehwein.contact.email, 'info@badgottleuba-berggiesshuebel.de');
  assert.equal(gluehwein.start, '2026-11-25T13:30:00+01:00');
  assert.equal(gluehwein.end, '2026-11-25T15:00:00+01:00');
});

test('satourn: Termin mit Ausverkauft im Text hat ticketStatus ausverkauft', async () => {
  const seite = fx('satourn-sebnitz.html').replace('Filmvorführung: Die Schüler der Madame Anne', 'Ausverkauft! Filmvorführung');
  const events = await fetchEvents({ http: fakeHttp({ [SEBNITZ]: seite }), today: TODAY, config });
  const film = events.find((e) => e.title.startsWith('17. Europäisches Filmfestival'));
  assert.equal(film.ticketStatus, 'ausverkauft');
  const andere = events.filter((e) => e !== film);
  for (const e of andere) assert.notEqual(e.ticketStatus, 'verfuegbar');
});

test('satourn: abgesagte Termine sind abgesagt', async () => {
  const seite = fx('satourn-sebnitz.html').replaceAll('"cancelled":false', '"cancelled":true');
  const events = await fetchEvents({ http: fakeHttp({ [SEBNITZ]: seite }), today: TODAY, config });
  assert.ok(events.filter((e) => e.sources[0].name === 'sebnitz.org').every((e) => e.ticketStatus === 'abgesagt'));
});

test('satourn: nur kommende Tage innerhalb des Zeitraums', async () => {
  const kurz = await fetchEvents({ http: fakeHttp(), today: TODAY, config: { ...config, horizonDays: 20 } });
  const lang = await fetchEvents({ http: fakeHttp(), today: TODAY, config });
  assert.ok(kurz.length < lang.length);
  for (const e of kurz) assert.ok(e.start.slice(0, 10) <= '2026-11-21', `${e.title} ${e.start}`);
  const vergangen = await fetchEvents({ http: fakeHttp(), today: '2027-06-01', config });
  assert.equal(vergangen.length, 0);
});

test('satourn: höchstens maxDetailPages Detailseiten, frisch geänderte zuerst', async () => {
  const http = fakeHttp();
  await fetchEvents({ http, today: TODAY, config: { ...config, maxDetailPages: 1 } });
  const details = http.abgerufen.filter((u) => u.includes('/veranstaltungen/'));
  assert.deepEqual(details, [sitemapUrls[0]]); // jüngstes lastmod der Fixture
});

test('satourn: Detailseiten, die der Sebnitzer Kalender schon liefert, werden nicht noch einmal geholt', async () => {
  const canonical = JSON.parse(/id="event-data">([\s\S]*?)<\/script>/.exec(fx('satourn-sebnitz.html'))[1]).events[0].canonical;
  const sitemap = fx('satourn-sitemap.xml').replace(sitemapUrls[0], canonical);
  const http = fakeHttp({ sitemap });
  await fetchEvents({ http, today: TODAY, config });
  assert.ok(!http.abgerufen.includes(canonical));
});

test('satourn: eine fehlende Detailseite überspringt nur diesen Termin', async () => {
  const events = await fetchEvents({ http: fakeHttp({ [sitemapUrls[0]]: null }), today: TODAY, config });
  assert.ok(events.length > 0);
  assert.ok(!events.some((e) => e.title.startsWith('Glühweinführung')));
});

test('satourn: fällt ein Teil aus, läuft der andere weiter; fallen beide aus, ist es ein Fehler', async () => {
  const nurSitemap = await fetchEvents({ http: fakeHttp({ [SEBNITZ]: null }), today: TODAY, config });
  assert.ok(nurSitemap.length > 0);
  assert.ok(nurSitemap.every((e) => e.sources[0].name === 'Sächsische Schweiz'));
  const nurSebnitz = await fetchEvents({ http: fakeHttp({ [INDEX]: null }), today: TODAY, config });
  assert.ok(nurSebnitz.every((e) => e.sources[0].name === 'sebnitz.org'));
  await assert.rejects(fetchEvents({ http: fakeHttp({ [SEBNITZ]: null, [INDEX]: null }), today: TODAY, config }), /404/);
});
