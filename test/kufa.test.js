import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { name, fetchEvents } from '../src/sources/kufa.js';
import { HttpError } from '../src/http.js';
import { rubrikUndGenre } from '../src/rubriken.js';

const fx = (datei) => readFileSync(new URL(`./fixtures/${datei}`, import.meta.url), 'utf8');
const LISTE = 'https://kufa-hoyerswerda.de/veranstaltungen/kultur/';
const SEITEN = {
  [LISTE]: 'kufa-list-1.html',
  [`${LISTE}page/2/`]: 'kufa-list-2.html',
  [`${LISTE}page/3/`]: 'kufa-list-5.html',
  'https://kufa-hoyerswerda.de/veranstaltung/silvester-party/': 'kufa-detail-party.html',
  'https://kufa-hoyerswerda.de/veranstaltung/liederfest-hoyschrecke/': 'kufa-detail-jazz.html',
  'https://kufa-hoyerswerda.de/veranstaltung/glasblassing-das-weihnachtsspecial/': 'kufa-detail-comedy.html',
};
const config = { enabled: true, listUrl: LISTE, maxPages: 8, maxDetailPages: 40, minDelayMs: 3000, horizonDays: 400 };

/** Antwortet aus den Fixtures; unbekannte Adressen sind 404 wie auf der Seite. */
function fakeHttp(ersatz = {}) {
  const abgerufen = [];
  const optionen = [];
  return {
    abgerufen,
    optionen,
    get: async (url, opts) => {
      abgerufen.push(url);
      optionen.push(opts);
      if (url in ersatz) {
        if (ersatz[url] instanceof Error) throw ersatz[url];
        return { status: 200, body: ersatz[url], url };
      }
      if (SEITEN[url]) return { status: 200, body: fx(SEITEN[url]), url };
      throw new HttpError(404, url);
    },
  };
}
const holen = async ({ today = '2026-11-26', cfg = {}, ersatz } = {}) => {
  const http = fakeHttp(ersatz);
  return { events: await fetchEvents({ http, today, config: { ...config, ...cfg } }), http };
};
const finden = (events, anfang) => events.filter((e) => e.title.startsWith(anfang));

test('Quellenname ist kufa', () => {
  assert.equal(name, 'kufa');
});

test('kufa: Titel, Datum, Uhrzeit, Ort und Link aus der Übersicht Kultur', async () => {
  const { events } = await holen();
  const [e] = finden(events, 'GlasBlasSing');
  assert.equal(e.start, '2026-12-02T19:30:00+01:00');
  assert.equal(e.hasTime, true);
  assert.equal(e.placeName, 'Kulturfabrik, Hoyerswerda');
  assert.equal(e.sources[0].name, 'Kulturfabrik Hoyerswerda');
  assert.equal(e.sources[0].url, 'https://kufa-hoyerswerda.de/veranstaltung/glasblassing-das-weihnachtsspecial/');
  assert.equal(e.contact.url, e.sources[0].url);
});

test('kufa: jeder Tag einer Veranstaltung ist ein eigener Termin mit eigener id', async () => {
  const { events } = await holen();
  const advent = finden(events, 'Lebendiger Adventskalender');
  assert.equal(advent.length, 5);
  assert.equal(new Set(advent.map((e) => e.id)).size, 5);
  assert.equal(new Set(events.map((e) => e.id)).size, events.length);
});

test('kufa: blättert bis zur ersten fehlenden Seite, mit mindestens 3 Sekunden Abstand', async () => {
  const { events, http } = await holen({ cfg: { minDelayMs: 0 } });
  assert.deepEqual(http.abgerufen.slice(0, 4), [LISTE, `${LISTE}page/2/`, `${LISTE}page/3/`, `${LISTE}page/4/`]);
  assert.ok(finden(events, 'Felix Meyer').length === 1);
  assert.ok(http.optionen.every((o) => o.minDelayMs >= 3000));
});

test('kufa: maxPages begrenzt das Blättern', async () => {
  const { http } = await holen({ cfg: { maxPages: 1, maxDetailPages: 0 } });
  assert.deepEqual(http.abgerufen, [LISTE]);
});

test('kufa: von der Detailseite kommen kurze Beschreibung und Kategorie, nie Bilder oder Ticketlinks', async () => {
  const { events } = await holen();
  const [jazz] = finden(events, 'Liederfest Hoyschrecke');
  assert.match(jazz.description, /^Mit dem "New Songs From The Past"/);
  assert.ok(jazz.description.length <= 300);
  assert.equal(jazz.genre, 'jazz');
  const [party] = finden(events, 'Silvester-Party');
  assert.equal(party.art, 'party');
  for (const e of events) {
    assert.equal(e.ticketUrl, null, e.title);
    assert.ok(!JSON.stringify(e).match(/wp-content|tixforgigs/), e.title);
  }
});

test('kufa: fällt eine Detailseite aus, bleibt der Termin ohne Beschreibung', async () => {
  const { events } = await holen();
  const [e] = finden(events, 'Wie klingt die Freiheit');
  assert.equal(e.description, null);
  assert.equal(e.start, '2026-11-30T19:00:00+01:00');
});

test('kufa: die Kategorie Comedy der Seite ergibt Theater & Lesungen, Unterpunkt Kabarett', async () => {
  const { events } = await holen();
  const [e] = finden(events, 'GlasBlasSing');
  assert.equal(e.title, 'GlasBlasSing – Das Weihnachtsspecial'); // der Titel bleibt unverändert
  assert.match(e.description, /^Comedy\. /);
  assert.ok(e.description.length <= 300);
  assert.deepEqual(rubrikUndGenre(e), { rubrik: 'theater', genre: 'kabarett' });
});

test('kufa: jede Veranstaltungsseite wird nur einmal geholt, höchstens maxDetailPages', async () => {
  const { http } = await holen({ cfg: { maxDetailPages: 3 } });
  const details = http.abgerufen.filter((u) => u.includes('/veranstaltung/'));
  assert.equal(details.length, 3);
  assert.equal(new Set(details).size, 3);
});

test('kufa: vergangene Tage fallen heraus, horizonDays begrenzt die Vorschau', async () => {
  const { events } = await holen({ today: '2026-11-27', cfg: { horizonDays: 5 } });
  const tage = events.map((e) => e.start.slice(0, 10));
  assert.ok(tage.length > 0);
  assert.ok(tage.every((t) => t >= '2026-11-27' && t <= '2026-12-02'), tage.join());
});

test('kufa: Fehler auf einer Folgeseite (nicht 404) bricht den Lauf ab', async () => {
  await assert.rejects(() => holen({ ersatz: { [`${LISTE}page/2/`]: new HttpError(500, `${LISTE}page/2/`) } }), /HTTP 500/);
});

test('kufa: Übersicht ohne Termine ist ein Fehler', async () => {
  await assert.rejects(() => holen({ ersatz: { [LISTE]: '<html><body>leer</body></html>' } }), /keine Termine/);
});
