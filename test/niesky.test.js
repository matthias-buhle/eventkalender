import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { name, fetchEvents } from '../src/sources/niesky.js';
import { adapters } from '../src/sources/index.js';
import { resolvePlace } from '../src/geo.js';

const fx = (datei) => readFileSync(new URL(`./fixtures/${datei}`, import.meta.url), 'utf8');
const LISTE = 'https://www.niesky.de/veranstaltungen/index.php';
const config = { enabled: true, listUrl: LISTE, minDelayMs: 10000, horizonDays: 120 };

async function holen({ today = '2026-11-27', cfg = {}, body = fx('niesky-liste.html') } = {}) {
  const abrufe = [];
  const http = { get: async (url, opts) => { abrufe.push([url, opts]); return { status: 200, body, url }; } };
  const events = await fetchEvents({ http, today, config: { ...config, ...cfg } });
  return { events, abrufe };
}
const mitTitel = (events, anfang) => events.find((e) => e.title.startsWith(anfang));

test('Quellenname ist niesky', () => {
  assert.equal(name, 'niesky');
});

test('niesky: ein Abruf der Liste mit 10 Sekunden Mindestabstand', async () => {
  const { abrufe } = await holen();
  assert.equal(abrufe.length, 1);
  assert.equal(abrufe[0][0], LISTE);
  assert.equal(abrufe[0][1].minDelayMs, 10000);
});

test('niesky: Titel, Beginn, Ende zur Berliner Zeit und Link zur Veranstaltungsseite', async () => {
  const e = mitTitel((await holen()).events, 'Weihnachtskonzert');
  assert.equal(e.start, '2026-12-19T15:00:00+01:00');
  assert.equal(e.end, null);
  assert.equal(e.hasTime, true);
  assert.equal(e.art, 'konzert');
  assert.equal(e.sources[0].name, 'Stadt Niesky');
  assert.equal(e.sources[0].url, 'https://www.niesky.de/veranstaltungen/2000004/2026/12/19/weihnachtskonzert');
  assert.equal(e.contact.url, e.sources[0].url);
  const w = mitTitel((await holen()).events, 'ReparaturCafé');
  assert.equal(w.end, '2026-12-21T18:00:00+01:00');
});

test('niesky: nur das Zugesagte, keine Beschreibung, kein Bild', async () => {
  const { events } = await holen();
  assert.ok(events.length > 0);
  for (const e of events) {
    assert.equal(e.description, null, e.title);
    assert.ok(!JSON.stringify(e).match(/VORSCHAUTEXT|bild\.png|fotos/), e.title);
  }
});

test('niesky: doppelt verschlüsselte Zeichen im Titel werden lesbar', async () => {
  assert.ok(mitTitel((await holen()).events, 'Workshop "L(i)eb doch wie du willst"'));
});

test('niesky: mehrtägige Termine laufen von bis, auch wenn sie schon begonnen haben', async () => {
  const { events } = await holen();
  const wandern = mitTitel(events, 'Gesundheitswandern');
  assert.equal(wandern.start, '2026-10-21T00:00:00+02:00');
  assert.equal(wandern.end, '2026-12-15T00:00:00+01:00');
  assert.equal(wandern.hasTime, false);
  assert.equal(mitTitel(events, 'Nieskyer Weihnachtsmarkt').end, '2026-12-08T00:00:00+01:00');
});

test('niesky: der Ort endet auf die Gemeinde, wenn sie sich erkennen lässt', async () => {
  const { events } = await holen();
  const ort = (titel) => mitTitel(events, titel).placeName;
  assert.equal(ort('Weihnachtskonzert'), 'Bürgerhaus, Beispielstr. 31/35, Niesky');
  assert.equal(ort('Nieskyer'), 'Zinzendorfplatz Niesky');
  assert.equal(ort('Workshop'), 'HOLZ Niesky, Beispielstraße 16/18, Niesky');
  assert.equal(ort('Digital'), 'VHS Dreiländereck, Geschäftsstelle Weißwasser, Beispielstraße 50, Weißwasser');
});

test('niesky: unbekannte Spielstätten stehen im Raum Niesky und dürfen nachgeschlagen werden', async () => {
  const e = mitTitel((await holen()).events, 'ReparaturCafé');
  assert.equal(e.placeName, 'Jugendzentrum H.O.L.Z., Raum Niesky');
  assert.equal(e.lat, resolvePlace('Niesky').lat);
  assert.equal(e.lon, resolvePlace('Niesky').lon);
  assert.equal(e.ortRegionKm, 15);
});

test('niesky: Eintrag ohne Ortsangabe bekommt Niesky, abgesagt wird erkannt', async () => {
  const e = mitTitel((await holen()).events, 'Ostrock');
  assert.equal(e.placeName, 'Niesky');
  assert.equal(e.ticketStatus, 'abgesagt');
});

test('niesky: Online-Angebote fehlen', async () => {
  const { events } = await holen();
  assert.equal(mitTitel(events, 'Online-Angebot'), undefined);
});

test('niesky: Vergangenes fällt heraus, horizonDays begrenzt die Vorschau', async () => {
  const { events } = await holen({ today: '2026-12-16', cfg: { horizonDays: 5 } });
  assert.deepEqual(events.map((e) => e.start.slice(0, 10)), ['2026-12-19', '2026-12-21']);
});

test('niesky: Seite ohne Veranstaltungsliste ist ein Fehler', async () => {
  await assert.rejects(() => holen({ body: '<html><body>leer</body></html>' }), /keine Termine/);
});

test('niesky: in der Adapterliste und in sources.json eingeschaltet', () => {
  assert.ok(adapters.some((a) => a.name === 'niesky'));
  assert.equal(JSON.parse(readFileSync(new URL('../sources.json', import.meta.url), 'utf8')).niesky?.enabled, true);
});
