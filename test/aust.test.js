import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { name, fetchEvents } from '../src/sources/aust.js';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/aust-getEvents.json', import.meta.url), 'utf8'));

const config = {
  venues: [{
    name: 'Alter Schlachthof',
    baseUrl: 'https://www.alter-schlachthof.de',
    contact: { phone: '+49351431310', url: 'https://www.alter-schlachthof.de', email: 'info@aust-konzerte.com' },
  }],
};

function fakeHttp(body) {
  const urls = [];
  return { urls, get: async (url) => { urls.push(url); return { status: 200, body, url }; } };
}

test('Quellenname ist aust', () => {
  assert.equal(name, 'aust');
});

test('liefert aus der Fixture Events mit title, start (ISO Berlin) und sources[0].url', async () => {
  const http = fakeHttp(fixture);
  const events = await fetchEvents({ http, today: '2026-11-08', config });
  assert.deepEqual(http.urls, ['https://www.alter-schlachthof.de/api/getEvents']);
  assert.equal(events.length, 6);
  const rammstein = events.find((e) => e.title.startsWith('RAMMSTEIN'));
  assert.equal(rammstein.start, '2026-11-10T20:00:00+01:00');
  assert.equal(rammstein.hasTime, true);
  assert.equal(rammstein.sources[0].name, 'Alter Schlachthof');
  assert.equal(rammstein.sources[0].url, 'https://www.alter-schlachthof.de/konzerte/4410/RAMMSTEIN-SYMPHONIC-TRIBUTE-HERZFEUER');
  assert.equal(rammstein.placeName, 'Alter Schlachthof, Dresden');
  assert.equal(rammstein.art, 'konzert');
  assert.match(rammstein.ticketUrl, /^https:\/\/www\.eventim\.de\//);
});

test('Eintrag mit +++Ausverkauft+++ hat ticketStatus ausverkauft', async () => {
  const events = await fetchEvents({ http: fakeHttp(fixture), today: '2026-11-08', config });
  const bodo = events.find((e) => e.title === 'Bodo Wartke');
  assert.equal(bodo.ticketStatus, 'ausverkauft');
  assert.equal(bodo.description, 'Wunderpunkt (Klavierkabarett)');
});

test('Eintrag ohne Hinweis hat ticketStatus null (nie verfuegbar)', async () => {
  const events = await fetchEvents({ http: fakeHttp(fixture), today: '2026-11-08', config });
  const andere = events.filter((e) => e.title !== 'Bodo Wartke');
  assert.ok(andere.length > 0);
  for (const e of andere) assert.equal(e.ticketStatus, null);
});

test('contact stammt aus der Venue-Konfiguration', async () => {
  const events = await fetchEvents({ http: fakeHttp(fixture), today: '2026-11-08', config });
  for (const e of events) {
    assert.deepEqual(e.contact, { phone: '+49351431310', url: 'https://www.alter-schlachthof.de', email: 'info@aust-konzerte.com' });
  }
});

test('Eintrag ohne lesbares Datum wird übersprungen, ohne Beginn bleibt er ohne Uhrzeit', async () => {
  const body = { events: { others: [
    { id: 1, datum: 'bald', titel: 'Kaputt', teaser: '', modrewrite: 'k', stadt: 'Dresden', ort: 'X', tickets_url: '', beginn: '20:00' },
    { id: 2, datum: 'Fr, 13.11.2026', titel: 'Ohne Zeit', teaser: '', modrewrite: 'o', stadt: 'Dresden', ort: 'X', tickets_url: '', beginn: '' },
  ] } };
  const events = await fetchEvents({ http: fakeHttp(body), today: '2026-11-08', config });
  assert.equal(events.length, 1);
  assert.equal(events[0].hasTime, false);
  assert.equal(events[0].ticketUrl, null);
});

test('eine ausgefallene Spielstätte stoppt die andere nicht, fallen alle aus, ist es ein Fehler', async () => {
  const zwei = { venues: [
    { name: 'Eins', baseUrl: 'https://eins.example', contact: {} },
    { name: 'Zwei', baseUrl: 'https://zwei.example', contact: {} },
  ] };
  const teilweise = { get: async (url) => {
    if (url.startsWith('https://eins')) throw new Error('HTTP 500');
    return { status: 200, body: fixture, url };
  } };
  const events = await fetchEvents({ http: teilweise, today: '2026-11-08', config: zwei });
  assert.equal(events.length, 6);
  const kaputt = { get: async () => { throw new Error('HTTP 500'); } };
  await assert.rejects(fetchEvents({ http: kaputt, today: '2026-11-08', config: zwei }), /HTTP 500/);
});
