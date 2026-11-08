import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { name, fetchEvents } from '../src/sources/ticketmaster.js';
import { runAll } from '../src/build.js';

// Die Fixture ist nach der dokumentierten Discovery-API-v2-Antwort gebaut, weil noch kein Schlüssel vorliegt.
const seite0 = JSON.parse(readFileSync(new URL('./fixtures/ticketmaster-p0.json', import.meta.url), 'utf8'));
const config = { enabled: true, url: 'https://app.ticketmaster.com/discovery/v2/events.json', radiusKm: 75, maxPages: 5 };

let vorher;
beforeEach(() => { vorher = process.env.TICKETMASTER_API_KEY; process.env.TICKETMASTER_API_KEY = 'testschluessel'; });
afterEach(() => { if (vorher === undefined) delete process.env.TICKETMASTER_API_KEY; else process.env.TICKETMASTER_API_KEY = vorher; });

function fakeHttp(seiten) {
  const urls = [];
  return {
    urls,
    get: async (url) => {
      urls.push(url);
      const p = Number(new URL(url).searchParams.get('page') ?? 0);
      return { status: 200, body: seiten[p] ?? { page: { totalPages: seiten.length, number: p } }, url };
    },
  };
}
const mitStatus = (code) => ({ ...seite0, _embedded: { events: [{ ...seite0._embedded.events[0], dates: { ...seite0._embedded.events[0].dates, status: { code } } }] } });

test('Quellenname ist ticketmaster', () => {
  assert.equal(name, 'ticketmaster');
});

test('ticketmaster: Anfrage mit Mittelpunkt, Radius 75 km, Land DE und Schlüssel', async () => {
  const http = fakeHttp([seite0]);
  await fetchEvents({ http, today: '2026-11-08', config });
  const u = new URL(http.urls[0]);
  assert.equal(u.searchParams.get('latlong'), '50.9399,14.291');
  assert.equal(u.searchParams.get('radius'), '75');
  assert.equal(u.searchParams.get('unit'), 'km');
  assert.equal(u.searchParams.get('countryCode'), 'DE');
  assert.equal(u.searchParams.get('apikey'), 'testschluessel');
  assert.equal(u.searchParams.get('startDateTime'), '2026-11-08T00:00:00Z');
});

test('ticketmaster: Termin hat Titel, Berliner Start, Ort mit Koordinaten, Quellen- und Ticketlink', async () => {
  const [e] = await fetchEvents({ http: fakeHttp([seite0]), today: '2026-11-08', config });
  assert.equal(e.title, 'Beispielband – Tour 2026');
  assert.equal(e.start, '2026-11-14T20:00:00+01:00');
  assert.equal(e.hasTime, true);
  assert.equal(e.art, 'konzert');
  assert.equal(e.placeName, 'Messe Dresden, Dresden');
  assert.equal(e.lat, 51.0663);
  assert.equal(e.country, 'DE');
  assert.equal(e.sources[0].url, e.ticketUrl);
  assert.match(e.ticketUrl, /^https:\/\/www\.ticketmaster\.de\//);
});

test('ticketmaster: Statuszuordnung für alle fünf Codes', async () => {
  const erwartet = { onsale: 'verfuegbar', offsale: 'ausverkauft', cancelled: 'abgesagt', canceled: 'abgesagt', postponed: 'verlegt', rescheduled: 'verlegt' };
  for (const [code, status] of Object.entries(erwartet)) {
    const [e] = await fetchEvents({ http: fakeHttp([mitStatus(code)]), today: '2026-11-08', config });
    assert.equal(e.ticketStatus, status, code);
  }
  const [unbekannt] = await fetchEvents({ http: fakeHttp([mitStatus('irgendwas')]), today: '2026-11-08', config });
  assert.equal(unbekannt.ticketStatus, null);
});

test('ticketmaster: ohne Termin-Uhrzeit ist hasTime false', async () => {
  const roh = structuredClone(seite0);
  roh._embedded.events[0].dates.start = { localDate: '2026-11-20', timeTBA: true };
  const [e] = await fetchEvents({ http: fakeHttp([roh]), today: '2026-11-08', config });
  assert.equal(e.hasTime, false);
  assert.equal(e.start, '2026-11-20T00:00:00+01:00');
});

test('ticketmaster: liest weitere Seiten bis totalPages, höchstens maxPages', async () => {
  const s = (nr) => ({ ...seite0, page: { totalPages: 9, number: nr } });
  const http = fakeHttp([s(0), s(1), s(2), s(3)]);
  await fetchEvents({ http, today: '2026-11-08', config: { ...config, maxPages: 3 } });
  assert.equal(http.urls.length, 3);
  const kurz = fakeHttp([{ ...seite0, page: { totalPages: 2, number: 0 } }, { ...seite0, page: { totalPages: 2, number: 1 } }]);
  await fetchEvents({ http: kurz, today: '2026-11-08', config });
  assert.equal(kurz.urls.length, 2);
});

test('ticketmaster: keine Treffer ergeben eine leere Liste', async () => {
  assert.deepEqual(await fetchEvents({ http: fakeHttp([{ page: { totalElements: 0 } }]), today: '2026-11-08', config }), []);
});

test('ticketmaster: ohne Schlüssel leer und Fehlertext im Status', async () => {
  delete process.env.TICKETMASTER_API_KEY;
  const http = fakeHttp([seite0]);
  const { events, status } = await runAll({
    sources: [{ name, fetchEvents, config }], http, now: new Date('2026-11-08T12:00:00Z'),
  });
  assert.deepEqual(events, []);
  assert.equal(status[0].ok, false);
  assert.equal(status[0].error, 'kein Schlüssel');
  assert.equal(http.urls.length, 0, 'ohne Schlüssel wird nichts abgerufen');
});

test('ticketmaster: Genre aus der Klassifizierung (Musik und Bühne), unbekanntes Genre bleibt leer', async () => {
  const mitKlasse = (klasse) => ({ ...seite0, _embedded: { events: [{ ...seite0._embedded.events[0], classifications: [klasse] }] } });
  const genreVon = async (klasse) => (await fetchEvents({ http: fakeHttp([mitKlasse(klasse)]), today: '2026-11-08', config }))[0].genre;
  assert.equal(await genreVon({ segment: { name: 'Musik' }, genre: { name: 'Rock' } }), 'rock-pop');
  assert.equal(await genreVon({ segment: { name: 'Musik' }, genre: { name: 'Alternative' } }), 'rock-pop');
  assert.equal(await genreVon({ segment: { name: 'Musik' }, genre: { name: 'Klassik' } }), 'klassik');
  assert.equal(await genreVon({ segment: { name: 'Musik' }, genre: { name: 'Pop' }, subGenre: { name: 'Schlager' } }), 'schlager-folk');
  assert.equal(await genreVon({ segment: { name: 'Musik' }, genre: { name: 'Comedy' } }), 'comedy');
  assert.equal(await genreVon({ segment: { name: 'Kunst & Theater' }, genre: { name: 'Comedy' } }), null, 'Genres gibt es nur bei Konzerten');
  assert.equal(await genreVon({ segment: { name: 'Musik' }, genre: { name: 'Undefined' } }), null);
});
