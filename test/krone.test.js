import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { name, fetchEvents } from '../src/sources/krone.js';

const fx = (datei) => readFileSync(new URL(`./fixtures/${datei}`, import.meta.url), 'utf8');
const BASIS = 'https://www.stadthalle-bautzen.de';
const LISTE = `${BASIS}/veranstaltungen-in-bautzen/`;
const DETAILS = {
  [`${BASIS}/dire-strats/`]: 'krone-detail-dire-strats.html',
  [`${BASIS}/andreas-rebers/`]: 'krone-detail-andreas-rebers.html',
};
const config = { enabled: true, listUrl: LISTE, maxDetailPages: 40 };

function fakeHttp(liste = fx('krone-list.html')) {
  const abgerufen = [];
  const optionen = [];
  return {
    abgerufen,
    optionen,
    get: async (url, opts) => {
      abgerufen.push(url);
      optionen.push(opts);
      if (url === LISTE) return { status: 200, body: liste, url };
      if (DETAILS[url]) return { status: 200, body: fx(DETAILS[url]), url };
      throw new Error(`HTTP 404 für ${url}`);
    },
  };
}
const holen = async (cfg = config, today = '2026-11-25') => {
  const http = fakeHttp();
  return { events: await fetchEvents({ http, today, config: cfg }), http };
};
const finden = (events, anfang) => events.find((e) => e.title.toLowerCase().startsWith(anfang.toLowerCase()));

test('Quellenname ist krone', () => {
  assert.equal(name, 'krone');
});

test('krone: Titel, Datum und Link aus der Liste, alle Veranstaltungen ab heute', async () => {
  const { events } = await holen();
  assert.equal(events.length, 43);
  const kaufmann = finden(events, 'Thomas Kaufmann');
  assert.equal(kaufmann.start.slice(0, 10), '2026-11-27');
  assert.equal(kaufmann.sources[0].url, `${BASIS}/thomas-kaufmann/`);
  assert.equal(kaufmann.sources[0].name, 'Stadthalle Krone Bautzen');
  assert.equal(kaufmann.country, 'DE');
  assert.equal(new Set(events.map((e) => e.id)).size, events.length);
});

test('krone: Uhrzeit und Ende aus dem JSON-LD der Detailseite, Ort der Halle', async () => {
  const { events } = await holen();
  const dire = finden(events, 'DIRE STRATS');
  assert.equal(dire.start, '2026-12-05T20:00:00+01:00');
  assert.equal(dire.end, '2026-12-05T22:30:00+01:00');
  assert.equal(dire.hasTime, true);
  assert.equal(dire.placeName, 'Stadthalle Krone, Bautzen');
  const rebers = finden(events, 'Andreas Rebers');
  assert.equal(rebers.start, '2027-01-29T19:30:00+01:00');
});

test('krone: Kategorie der Detailseite bestimmt die Art, KONZERT wird Konzert, KABARETT sonstiges', async () => {
  const { events } = await holen();
  assert.equal(finden(events, 'DIRE STRATS').art, 'konzert');
  assert.equal(finden(events, 'Andreas Rebers').art, 'sonstiges');
});

test('krone: ausverkauft aus der Liste, sonst kein Status', async () => {
  const { events } = await holen();
  assert.equal(finden(events, 'Zärtlichkeiten mit Freunden').ticketStatus, 'ausverkauft');
  assert.equal(finden(events, 'DIRE STRATS').ticketStatus, null);
});

test('krone: nur Titel, Datum, Uhrzeit, Ort und Link; keine Beschreibung, keine Ticketlinks, keine Bilder', async () => {
  const { events } = await holen();
  for (const e of events) {
    assert.equal(e.description, null, e.title);
    assert.equal(e.ticketUrl, null, e.title);
    assert.ok(!JSON.stringify(e).includes('wp-content/uploads'), e.title);
  }
});

test('krone: ohne erreichbare Detailseite bleibt der Termin mit Datum, aber ohne Uhrzeit', async () => {
  const { events } = await holen();
  const kaufmann = finden(events, 'Thomas Kaufmann');
  assert.equal(kaufmann.hasTime, false);
  assert.equal(kaufmann.placeName, 'Stadthalle Krone, Bautzen');
  assert.equal(events.filter((e) => e.hasTime).length, 2);
});

test('krone: maxDetailPages begrenzt die Abrufe; Abstand mindestens 3 Sekunden', async () => {
  const { events, http } = await holen({ ...config, maxDetailPages: 2 });
  assert.equal(http.abgerufen.length, 3); // Liste + 2 Details
  assert.equal(events.length, 43);
  assert.ok(http.optionen.every((o) => o.minDelayMs >= 3000));
  const { http: knapp } = await holen({ ...config, minDelayMs: 500, maxDetailPages: 1 });
  assert.ok(knapp.optionen.every((o) => o.minDelayMs >= 3000), 'ein kleinerer Wert aus der Konfiguration wird angehoben');
});

test('krone: vergangene Termine fallen heraus', async () => {
  const { events } = await holen(config, '2027-03-01');
  assert.ok(!finden(events, 'Thomas Kaufmann'));
  assert.ok(!finden(events, 'DIRE STRATS'));
  assert.equal(events.length, 43 - 22);
  assert.ok(events.every((e) => e.start.slice(0, 10) >= '2027-03-01'));
});

test('krone: Liste ohne Termine ist ein Fehler, damit der Status die Quelle als gestört zeigt', async () => {
  const http = { get: async () => ({ status: 200, body: '<html><body>leer</body></html>' }) };
  await assert.rejects(() => fetchEvents({ http, today: '2026-11-25', config }), /keine Termine/);
});
