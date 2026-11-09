import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { name, fetchEvents } from '../src/sources/l2club.js';

const fx = (datei) => readFileSync(new URL(`./fixtures/${datei}`, import.meta.url), 'utf8');
const BASIS = 'https://www.l2club.de';
const LISTE = `${BASIS}/events`;
const DETAILS = {
  [`${BASIS}/events/club-40-party-jungle-14-11-2026`]: 'l2club-detail-club-40.html',
  [`${BASIS}/events/die-erste-studiparty-jungle-12-11-2026`]: 'l2club-detail-die-erste.html',
  [`${BASIS}/events/rammzeit-a-tribute-to-rammstein-10-04-2027`]: 'l2club-detail-rammzeit-a.html',
  [`${BASIS}/events/comedyflash-die-stand-up-comedy-show-19-12-2026`]: 'l2club-detail-comedyflash-die.html',
};
const config = { enabled: true, listUrl: LISTE, maxDetailPages: 30 };

function fakeHttp() {
  const abgerufen = [];
  return {
    abgerufen,
    get: async (url) => {
      abgerufen.push(url);
      if (url === LISTE) return { status: 200, body: fx('l2club-list.html'), url };
      if (DETAILS[url]) return { status: 200, body: fx(DETAILS[url]), url };
      throw new Error(`HTTP 404 für ${url}`);
    },
  };
}
const holen = async (cfg = config) => {
  const http = fakeHttp();
  return { events: await fetchEvents({ http, today: '2026-11-09', config: cfg }), http };
};
const finden = (events, anfang) => events.find((e) => e.title.toLowerCase().startsWith(anfang.toLowerCase()));

test('Quellenname ist l2club', () => {
  assert.equal(name, 'l2club');
});

test('l2club: Titel, Zeit, Ende, Ort und Quellenlink aus dem JSON-LD der Detailseite', async () => {
  const { events } = await holen();
  const club = finden(events, 'Club 40 Party');
  assert.equal(club.title, 'Club 40 Party // Jungle');
  assert.equal(club.start, '2026-11-14T21:00:00+01:00');
  assert.equal(club.end, '2026-11-15T04:00:00+01:00');
  assert.equal(club.hasTime, true);
  assert.equal(club.placeName, 'L2 Club, Görlitz');
  assert.equal(club.sources[0].name, 'L2 Club Görlitz');
  assert.equal(club.sources[0].url, `${BASIS}/events/club-40-party-jungle-14-11-2026`);
  assert.equal(club.country, 'DE');
});

test('l2club: Party-Nächte sind Partys, Tribute-Shows Konzerte, Comedy sonstiges', async () => {
  const { events } = await holen();
  assert.equal(finden(events, 'Club 40 Party').art, 'party');
  assert.equal(finden(events, 'Die erste Studiparty').art, 'party');
  assert.equal(finden(events, 'Rammzeit').art, 'konzert');
  assert.equal(finden(events, 'ComedyFlash').art, 'sonstiges');
});

test('l2club: Tickets führen zur Seite des Clubs, Verfügbarkeit aus dem Angebot', async () => {
  const { events } = await holen();
  const club = finden(events, 'Club 40 Party');
  assert.match(club.ticketUrl, /^https:\/\/www\.l2club\.de\/events\/club-40-party-jungle-14-11-2026#ticket-/);
  assert.equal(club.ticketStatus, 'verfuegbar');
});

test('l2club: Beschreibung ohne Emojis und höchstens 300 Zeichen', async () => {
  const { events } = await holen();
  for (const e of events) {
    assert.ok(!e.description || e.description.length <= 300);
    assert.ok(!/\p{Extended_Pictographic}/u.test(e.description ?? ''), e.title);
  }
  assert.ok(finden(events, 'Club 40 Party').description.includes('CLUB 40 PARTY'));
});

test('l2club: nicht abrufbare Detailseite wird übersprungen, die anderen bleiben', async () => {
  const { events, http } = await holen();
  assert.equal(events.length, 4);
  assert.ok(http.abgerufen.some((u) => u.includes('nicht-abrufbar')));
  assert.equal(new Set(http.abgerufen).size, http.abgerufen.length, 'jede Seite nur einmal (Anker #tickets zählt nicht extra)');
});

test('l2club: maxDetailPages begrenzt die Abrufe', async () => {
  const { http } = await holen({ ...config, maxDetailPages: 2 });
  assert.equal(http.abgerufen.length, 3); // Liste + 2 Details
});

test('l2club: Liste ohne Termine ist ein Fehler, damit der Status die Quelle als gestört zeigt', async () => {
  const http = { get: async () => ({ status: 200, body: '<html><body>leer</body></html>' }) };
  await assert.rejects(() => fetchEvents({ http, today: '2026-11-09', config }), /keine Termine/);
});
