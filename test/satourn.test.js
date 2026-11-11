import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { name, fetchEvents } from '../src/sources/satourn.js';

const fx = (datei) => readFileSync(new URL(`./fixtures/${datei}`, import.meta.url), 'utf8');
const apiAntwort = JSON.parse(fx('satourn-api.json'));

// Die Sebnitz-Fixture enthält Termine ab dem 4.11.2026; ein früheres "heute" hält sie im Fenster.
const TODAY_SEBNITZ = '2026-11-01';
// Die API-Fixture ist auf den 11.11.2026 zugeschnitten.
const TODAY_API = '2026-11-11';
const SEBNITZ = 'https://www.sebnitz.org/Veranstaltungskalender/';
const API = 'https://meta.et4.de/rest.ashx/search/';
const config = {
  enabled: true,
  sebnitzUrl: SEBNITZ,
  apiUrl: API,
  experience: 'open-data-sachsen-tourismus',
  limit: 1000,
  horizonDays: 90,
  fallbackUrl: 'https://www.sachsen-tourismus.de/',
};
const QUELLE_API = 'Tourismus Sachsen (Open Data)';

/** Fake-Client: Sebnitz-Seite und API-Antwort; ein Wert null (oder fehlender) lässt die Adresse mit 404 scheitern. */
function fakeHttp({ sebnitz = fx('satourn-sebnitz.html'), api = apiAntwort } = {}) {
  const abgerufen = [];
  return {
    abgerufen,
    get: async (url) => {
      abgerufen.push(url);
      if (url === SEBNITZ && sebnitz !== null) return { status: 200, body: sebnitz, url };
      if (url.startsWith('https://meta.et4.de/') && api !== null) return { status: 200, body: api, url };
      throw new Error(`HTTP 404 für ${url}`);
    },
  };
}

test('Quellenname ist satourn', () => {
  assert.equal(name, 'satourn');
});

test('satourn: Termine aus Sebnitz und aus der API', async () => {
  const events = await fetchEvents({ http: fakeHttp(), today: TODAY_API, config });
  const quellen = new Set(events.map((e) => e.sources[0].name));
  assert.ok(quellen.has('sebnitz.org'), 'Quelle sebnitz.org fehlt');
  assert.ok(quellen.has(QUELLE_API), 'API-Quelle fehlt');
  assert.ok(!quellen.has('Sächsische Schweiz'), 'die Sitemap-Quelle gibt es nicht mehr');
});

test('satourn: jedes Event hat title, start und Ort', async () => {
  const events = await fetchEvents({ http: fakeHttp(), today: TODAY_SEBNITZ, config });
  assert.ok(events.length >= 5, `nur ${events.length} Events`);
  for (const e of events) {
    assert.ok(e.title, 'title');
    assert.match(e.start, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\+0[12]:00$/);
    assert.ok(e.placeName, `Ort fehlt bei ${e.title}`);
    assert.ok(e.sources[0].url.startsWith('https://'), 'Quellenlink');
  }
});

test('satourn: Kontakt, Koordinaten und Preisfeld aus dem Sebnitzer Kalender', async () => {
  const events = await fetchEvents({ http: fakeHttp(), today: TODAY_SEBNITZ, config });
  const film = events.find((e) => e.title.startsWith('17. Europäisches Filmfestival'));
  assert.equal(film.contact.phone, '03597184252');
  assert.equal(film.contact.email, 'veranstaltung@stadtverwaltung-sebnitz.de');
  assert.equal(film.lat, 50.9724248);
  assert.equal(film.hasTime, true);
  assert.ok(film.description.length <= 300);
});

test('satourn: Termin mit Ausverkauft im Text hat ticketStatus ausverkauft', async () => {
  const seite = fx('satourn-sebnitz.html').replace('Filmvorführung: Die Schüler der Madame Anne', 'Ausverkauft! Filmvorführung');
  const events = await fetchEvents({ http: fakeHttp({ sebnitz: seite }), today: TODAY_SEBNITZ, config });
  const sebnitz = events.filter((e) => e.sources[0].name === 'sebnitz.org');
  const film = sebnitz.find((e) => e.title.startsWith('17. Europäisches Filmfestival'));
  assert.equal(film.ticketStatus, 'ausverkauft');
  for (const e of sebnitz.filter((x) => x !== film)) assert.notEqual(e.ticketStatus, 'verfuegbar');
});

test('satourn: abgesagte Termine sind abgesagt', async () => {
  const seite = fx('satourn-sebnitz.html').replaceAll('"cancelled":false', '"cancelled":true');
  const events = await fetchEvents({ http: fakeHttp({ sebnitz: seite }), today: TODAY_SEBNITZ, config });
  const sebnitz = events.filter((e) => e.sources[0].name === 'sebnitz.org');
  assert.ok(sebnitz.length > 0);
  assert.ok(sebnitz.every((e) => e.ticketStatus === 'abgesagt'));
});

test('satourn: nur kommende Tage innerhalb des Zeitraums', async () => {
  const kurz = await fetchEvents({ http: fakeHttp(), today: TODAY_SEBNITZ, config: { ...config, horizonDays: 20 } });
  const lang = await fetchEvents({ http: fakeHttp(), today: TODAY_SEBNITZ, config });
  assert.ok(kurz.length < lang.length);
  for (const e of kurz) assert.ok(e.start.slice(0, 10) <= '2026-11-21', `${e.title} ${e.start}`);
  // Liegt alles hinter dem Fenster, ist die (auf das Fenster zugeschnittene) API-Antwort leer: das ist ein Fehler.
  await assert.rejects(fetchEvents({ http: fakeHttp(), today: '2027-06-01', config }), /keine/);
});

test('satourn: Sebnitzer Termine tragen Lizenz und Urheber aus den eingebetteten Daten', async () => {
  const events = await fetchEvents({ http: fakeHttp(), today: TODAY_SEBNITZ, config });
  const sebnitz = events.filter((e) => e.sources[0].name === 'sebnitz.org');
  const film = sebnitz.find((e) => e.title.startsWith('17. Europäisches Filmfestival'));
  assert.deepEqual(film.lizenz, {
    name: 'CC0 1.0',
    url: 'https://creativecommons.org/publicdomain/zero/1.0/deed.de',
    urheber: 'Große Kreisstadt Sebnitz Touristinformation Sebnitz',
  });
  const nacht = sebnitz.filter((e) => e.title.startsWith('Nachtwächterführung'));
  assert.ok(nacht.length > 0);
  for (const e of nacht) {
    assert.deepEqual(e.lizenz, {
      name: 'CC BY-SA 4.0',
      url: 'https://creativecommons.org/licenses/by-sa/4.0/deed.de',
      urheber: 'Nicole Hesse (Tourismusverband Sächsische Schweiz e.V.)',
    });
  }
});

test('satourn: Sebnitzer Termine mit fremder oder fehlender Lizenz bleiben erhalten, ohne Lizenz', async () => {
  const fremd = fx('satourn-sebnitz.html').replaceAll('creativecommons.org/publicdomain/zero/1.0/deed.de', 'creativecommons.org/licenses/by-nc/4.0/deed.de');
  const ohne = fx('satourn-sebnitz.html').replaceAll(/"licenseUrl":"[^"]*",/g, '');
  for (const seite of [fremd, ohne]) {
    const events = await fetchEvents({ http: fakeHttp({ sebnitz: seite }), today: TODAY_SEBNITZ, config });
    const film = events.find((e) => e.title.startsWith('17. Europäisches Filmfestival'));
    assert.ok(film, 'Termin bleibt erhalten');
    assert.equal(film.lizenz, null);
  }
});

test('satourn: fällt der Sebnitzer Teil aus, kommen die API-Termine', async () => {
  const events = await fetchEvents({ http: fakeHttp({ sebnitz: null }), today: TODAY_API, config });
  assert.ok(events.length > 0);
  assert.ok(events.every((e) => e.sources[0].name === QUELLE_API));
});

test('satourn: fällt der API-Teil aus, ist das ein Fehler', async () => {
  await assert.rejects(fetchEvents({ http: fakeHttp({ api: null }), today: TODAY_API, config }), /404/);
});

test('satourn: fallen beide aus, ist es ein Fehler', async () => {
  await assert.rejects(fetchEvents({ http: fakeHttp({ sebnitz: null, api: null }), today: TODAY_API, config }), /404/);
});
