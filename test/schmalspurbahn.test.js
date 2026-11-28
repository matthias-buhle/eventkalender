import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { name, fetchEvents } from '../src/sources/schmalspurbahn.js';
import { adapters } from '../src/sources/index.js';

const fx = (datei) => readFileSync(new URL(`./fixtures/${datei}`, import.meta.url), 'utf8');
const LISTE = 'https://www.zittauer-schmalspurbahn.de/kalender/';
const config = { enabled: true, listUrl: LISTE, maxDetailPages: 15, minDelayMs: 5000, horizonDays: 120 };

async function holen({ today = '2026-11-28', cfg = {}, liste = fx('schmalspurbahn-kalender.html'), termin = () => fx('schmalspurbahn-termin.html') } = {}) {
  const abrufe = [];
  const http = {
    get: async (url, opts) => {
      abrufe.push([url, opts]);
      return { status: 200, url, body: url === LISTE ? liste : termin(url) };
    },
  };
  const events = await fetchEvents({ http, today, config: { ...config, ...cfg } });
  return { events, abrufe };
}
const mitTitel = (events, anfang) => events.find((e) => e.title.startsWith(anfang));

test('Quellenname ist schmalspurbahn', () => {
  assert.equal(name, 'schmalspurbahn');
});

test('schmalspurbahn: Titel, Tag ohne Uhrzeit, Abfahrtsort und Link zur Veranstaltungsseite', async () => {
  const e = mitTitel((await holen()).events, 'Heizer');
  assert.equal(e.title, 'Heizerfrühstück im Speisewagen');
  assert.equal(e.start, '2026-12-13T00:00:00+01:00');
  assert.equal(e.hasTime, false);
  assert.equal(e.placeName, 'Zittauer Schmalspurbahn, Zittau');
  assert.equal(e.sources[0].name, 'Zittauer Schmalspurbahn');
  assert.equal(e.sources[0].url, `${LISTE}?event=103`);
  assert.equal(e.contact.url, e.sources[0].url);
});

test('schmalspurbahn: ein Wochenende ist ein Termin mit Ende', async () => {
  const e = mitTitel((await holen()).events, 'Adventsfahrten');
  assert.equal(e.start, '2026-11-28T00:00:00+01:00');
  assert.equal(e.end, '2026-11-29T00:00:00+01:00');
});

test('schmalspurbahn: kurze Beschreibung nur aus den Absätzen vor der ersten Zwischenüberschrift, nichts Weiteres', async () => {
  const { events } = await holen();
  assert.equal(mitTitel(events, 'Heizer').description, 'Erfundener Beispieltext: In den Nachmittagszügen gibt es ein Gedeck. Zweiter erfundener Absatz.');
  for (const e of events) {
    assert.ok(!JSON.stringify(e).match(/bild\.jpg|KARTENLINK|karten\.example|TELEFONTEXT|KONTAKTBLOCK/), e.title);
  }
});

test('schmalspurbahn: lange Texte werden auf höchstens 300 Zeichen gekürzt', async () => {
  const lang = () => `<div class="results-details-content"><p>${'Wort '.repeat(200)}</p></div>`;
  const { events } = await holen({ termin: lang });
  assert.ok(events[0].description.length <= 300);
  assert.ok(events[0].description.endsWith('…'));
});

test('schmalspurbahn: "Ausverkauft - " wird zum Status und steht nicht mehr im Titel', async () => {
  const e = mitTitel((await holen()).events, 'Silvester');
  assert.equal(e.title, 'Silvesterzug');
  assert.equal(e.ticketStatus, 'ausverkauft');
});

test('schmalspurbahn: Termine im Bahnhof Oybin stehen in Oybin', async () => {
  const e = mitTitel((await holen()).events, 'Theaterwagen');
  assert.equal(e.placeName, 'Bahnhof Oybin, Oybin');
  assert.equal(e.country, 'DE');
  assert.ok(Math.abs(e.lat - 50.84) < 0.02 && Math.abs(e.lon - 14.74) < 0.02);
});

test('schmalspurbahn: Vergangenes, zu Fernes und reine Fahrplanhinweise fehlen', async () => {
  const { events } = await holen();
  assert.equal(mitTitel(events, 'Vorbei'), undefined);
  assert.equal(mitTitel(events, 'Weit weg'), undefined);
  assert.equal(mitTitel(events, 'Zusätzliche Dieselzüge'), undefined);
  assert.equal(events.length, 5);
});

test('schmalspurbahn: je Titel nur eine Einzelseite, mit mindestens 5 Sekunden Abstand', async () => {
  const { abrufe } = await holen({ cfg: { minDelayMs: 100 } });
  assert.deepEqual(abrufe.map(([url]) => url), [LISTE, ...[101, 103, 104, 106].map((n) => `${LISTE}?event=${n}`)]);
  for (const [, opts] of abrufe) assert.equal(opts.minDelayMs, 5000);
});

test('schmalspurbahn: fehlt eine Einzelseite oder ist die Grenze erreicht, bleibt der Termin ohne Beschreibung', async () => {
  const kaputt = await holen({ termin: () => { throw new Error('404'); } });
  assert.equal(kaputt.events.length, 5);
  assert.ok(kaputt.events.every((e) => e.description === null));
  const knapp = await holen({ cfg: { maxDetailPages: 1 } });
  assert.equal(knapp.abrufe.length, 2);
  assert.equal(knapp.events.length, 5);
});

test('schmalspurbahn: Liste ohne Termine ist ein Fehler', async () => {
  await assert.rejects(() => holen({ liste: '<html><body>leer</body></html>' }), /keine Termine/);
});

test('schmalspurbahn: in der Adapterliste und in sources.json eingeschaltet', () => {
  assert.ok(adapters.some((a) => a.name === 'schmalspurbahn'));
  assert.equal(JSON.parse(readFileSync(new URL('../sources.json', import.meta.url), 'utf8')).schmalspurbahn?.enabled, true);
});
