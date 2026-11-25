import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { name, fetchEvents } from '../src/sources/projekttheater.js';
import { rubrikUndGenre } from '../src/rubriken.js';

const fx = (datei) => readFileSync(new URL(`./fixtures/${datei}`, import.meta.url), 'utf8');
const LISTE = 'https://projekttheater.de/spielplan/';
const DEZEMBER = `${LISTE}?start_month=12&start_year=2026`;
const D_MOVEMENT = 'https://projekttheater.de/veranstaltung/the-movement-never-ends/';
const D_WEIHNACHT = 'https://projekttheater.de/veranstaltung/weihnachtsspecial-i-iii/';
const TODAY = '2026-11-25';
const config = { enabled: true, listUrl: LISTE, maxDetailPages: 40, minDelayMs: 5000 };

/** Liefert November- und Dezemberseite und zwei Einzelseiten; alles andere gibt es nicht (404). */
function fakeHttp(extra = {}) {
  const seiten = {
    [LISTE]: fx('projekttheater-spielplan.html'),
    [DEZEMBER]: fx('projekttheater-spielplan-2026-12.html'),
    [D_MOVEMENT]: fx('projekttheater-detail-1.html'),
    [D_WEIHNACHT]: fx('projekttheater-detail-2.html'),
    ...extra,
  };
  const abgerufen = [];
  return {
    abgerufen,
    get: async (url, opts) => {
      abgerufen.push({ url, minDelayMs: opts?.minDelayMs });
      if (seiten[url] === undefined) throw new Error(`HTTP 404 für ${url}`);
      return { status: 200, body: seiten[url], url };
    },
  };
}
const holen = (opts = {}) => fetchEvents({ http: opts.http ?? fakeHttp(), today: opts.today ?? TODAY, config: { ...config, ...opts.config } });

test('Quellenname ist projekttheater', () => {
  assert.equal(name, 'projekttheater');
});

test('projekttheater: Termine aus November- und Dezemberansicht, je Termin ein Eintrag', async () => {
  const events = await holen();
  assert.equal(events.length, 16);
  const movement = events.filter((e) => e.title === 'Movement Never Ends');
  assert.deepEqual(movement.map((e) => e.start), ['2026-11-26T20:00:00+01:00', '2026-11-27T20:00:00+01:00', '2026-11-28T20:00:00+01:00']);
  assert.equal(new Set(events.map((e) => e.id)).size, 16, 'jede id ist einmalig');
});

test('projekttheater: Uhrzeit, Ort, Quellenlink und Kartenlink', async () => {
  const e = (await holen()).find((x) => x.title === 'DRACULA' && x.start.startsWith('2026-12-12'));
  assert.equal(e.start, '2026-12-12T19:00:00+01:00');
  assert.equal(e.hasTime, true);
  assert.equal(e.placeName, 'projekttheater dresden, Dresden');
  assert.equal(e.sources[0].name, 'projekttheater dresden');
  assert.equal(e.sources[0].url, 'https://projekttheater.de/veranstaltung/dracula/');
  assert.equal(e.contact.url, e.sources[0].url);
  assert.equal(e.ticketUrl, 'https://projekttheater-dresden.reservix.de/p/reservix/group/547413');
  assert.equal(e.country, 'DE');
});

test('projekttheater: Beschreibung aus Untertitel und Einzelseite, höchstens 300 Zeichen', async () => {
  const events = await holen();
  const m = events.find((e) => e.title === 'Movement Never Ends');
  assert.match(m.description, /^Eine Clubnacht zwischen Raum und Zeit · Charles A\. Washington\/Pinkmetalpetal Productions – Ein endloser Club\./);
  assert.ok(m.description.length <= 300);
  const w = events.find((e) => e.title === 'Weihnachtsspecial I');
  assert.match(w.description, /^Trashige Szenen zum Advent/);
  assert.match(w.description, /schrecklich nette Familie/);
  for (const e of events) assert.ok(!e.description || e.description.length <= 300);
});

test('projekttheater: ohne Einzelseite bleibt der Termin mit dem Untertitel der Liste', async () => {
  const events = await holen();
  const d = events.find((e) => e.title === 'DRACULA');
  assert.equal(d.description, 'Die Schatten der Nacht · ColumbaPalumbus e.V.');
});

test('projekttheater: Art aus der Kategorie der Seite (musik, ausstellung); Theater und Tanz über den Spielort', async () => {
  const events = await holen();
  assert.equal(events.find((e) => e.title === 'Winterabend').art, 'konzert');
  assert.equal(events.find((e) => e.title.startsWith('Güterschweifen')).art, 'schau');
  assert.equal(events.find((e) => e.title === 'Lametta Lasziv').art, 'sonstiges');
  assert.equal(rubrikUndGenre(events.find((e) => e.title === 'Lametta Lasziv')).rubrik, 'theater');
  assert.equal(rubrikUndGenre(events.find((e) => e.title === 'Improtheater mit FSK')).rubrik, 'theater');
});

test('projekttheater: "Anmeldung" statt "Tickets" ist kein Kartenlink', async () => {
  const e = (await holen()).find((x) => x.title.startsWith('Güterschweifen'));
  assert.equal(e.ticketUrl, null);
  assert.equal(e.start, '2026-12-01T19:00:00+01:00');
});

test('projekttheater: nur Termine ab heute', async () => {
  const events = await holen({ today: '2026-12-12' });
  assert.ok(events.every((e) => e.start.slice(0, 10) >= '2026-12-12'));
  assert.equal(events.filter((e) => e.title === 'DRACULA').length, 1, 'der 11.12. ist vorbei');
  assert.equal((await holen({ today: '2027-01-01' })).length, 0, 'Monate ohne gelieferte Seite ergeben nichts, werfen aber nicht');
});

test('projekttheater: weitere Monate nach der JavaScript-Liste der Seite, jede Seite höchstens einmal, mit Abstand', async () => {
  const http = fakeHttp();
  await holen({ http });
  const urls = http.abgerufen.map((a) => a.url);
  assert.equal(urls.length, new Set(urls).size);
  for (const monat of [1, 2, 3, 4, 5, 6]) assert.ok(urls.includes(`${LISTE}?start_month=${monat}&start_year=2027`), `Monat ${monat}/2027 fehlt`);
  assert.ok(urls.includes(DEZEMBER));
  assert.ok(!urls.includes(`${LISTE}?start_month=11&start_year=2026`), 'der Monat der Startseite wird nicht noch einmal geladen');
  assert.equal(urls.filter((u) => u.includes('/veranstaltung/')).length, 11, 'je Inszenierung eine Einzelseite');
  assert.ok(http.abgerufen.every((a) => a.minDelayMs === 5000));
});

test('projekttheater: maxMonths und maxDetailPages begrenzen die Abrufe; Termine bleiben', async () => {
  const http = fakeHttp();
  const events = await holen({ http, config: { maxMonths: 1, maxDetailPages: 1 } });
  assert.equal(http.abgerufen.length, 1 + 1 + 1);
  assert.equal(events.length, 16);
});

test('projekttheater: ein fehlender Monat oder eine fehlende Einzelseite stoppt den Lauf nicht', async () => {
  const events = await holen({ http: fakeHttp({ [DEZEMBER]: undefined, [D_MOVEMENT]: undefined }) });
  assert.equal(events.filter((e) => e.title === 'Movement Never Ends').length, 3);
  assert.ok(!events.some((e) => e.title === 'DRACULA'));
});

test('projekttheater: Termin ohne Uhrzeit bleibt ein Tagestermin', async () => {
  const seite = fx('projekttheater-spielplan.html').replace('<div>Donnerstag | 20:00</div>', '<div>Donnerstag</div>');
  const events = await holen({ http: fakeHttp({ [LISTE]: seite }) });
  const e = events.find((x) => x.start.startsWith('2026-11-26'));
  assert.equal(e.hasTime, false);
  assert.equal(e.start, '2026-11-26T00:00:00+01:00');
});

test('projekttheater: fällt die Startseite aus oder ist sie leer, ist es ein Fehler', async () => {
  await assert.rejects(holen({ http: fakeHttp({ [LISTE]: undefined }) }), /404/);
  await assert.rejects(holen({ http: fakeHttp({ [LISTE]: '<html><body>leer</body></html>' }) }), /keine Termine/);
});
