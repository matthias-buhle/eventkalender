import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { name, fetchEvents } from '../src/sources/hellerau.js';
import { adapters } from '../src/sources/index.js';
import { rubrikUndGenre } from '../src/rubriken.js';

const fx = (datei) => readFileSync(new URL(`./fixtures/${datei}`, import.meta.url), 'utf8');
const URL_PLAN = 'https://hellerau.org/programm/spielplan';
const config = { enabled: true, url: URL_PLAN, horizonDays: 120 };

async function holen({ today = '2026-11-27', cfg = {}, body = fx('hellerau-spielplan.html') } = {}) {
  const abrufe = [];
  const http = { get: async (url) => { abrufe.push(url); return { status: 200, body, url }; } };
  const events = await fetchEvents({ http, today, config: { ...config, ...cfg } });
  return { events, abrufe };
}
const mitTitel = (events, anfang) => events.find((e) => e.title.startsWith(anfang));

test('Quellenname ist hellerau', () => {
  assert.equal(name, 'hellerau');
});

test('hellerau: ein Abruf; Titel, Beginn zur Berliner Zeit, Spielstätte und Link', async () => {
  const { events, abrufe } = await holen();
  assert.deepEqual(abrufe, [URL_PLAN]);
  const e = mitTitel(events, 'Sacre');
  assert.equal(e.title, 'Sacre & Magnificat');
  assert.equal(e.start, '2026-12-03T20:00:00+01:00');
  assert.equal(e.hasTime, true);
  assert.equal(e.placeName, 'HELLERAU, Großer Saal, Dresden');
  assert.equal(e.sources[0].name, 'HELLERAU');
  assert.equal(e.sources[0].url, 'https://hellerau.org/2026-27/sacre-magnificat');
  assert.equal(e.contact.url, e.sources[0].url);
});

test('hellerau: nur das Zugesagte, keine Beschreibung, keine Mitwirkenden, kein Preis, kein Bild, kein Ticketlink', async () => {
  const { events } = await holen();
  assert.ok(events.length > 0);
  for (const e of events) {
    assert.equal(e.description, null, e.title);
    assert.equal(e.ticketUrl, null, e.title);
    assert.ok(!JSON.stringify(e).match(/UNTERTITEL|MITWIRKENDE|bild\.jpg|karten\.example|€/), e.title);
  }
});

test('hellerau: zwei Abende desselben Stücks bleiben getrennte Termine', async () => {
  const zwei = (await holen()).events.filter((e) => e.title.startsWith('Sacre'));
  assert.equal(zwei.length, 2);
  assert.notEqual(zwei[0].id, zwei[1].id);
});

test('hellerau: Spielstätten werden einheitlich und enden auf Dresden', async () => {
  const { events } = await holen();
  const ort = (titel) => mitTitel(events, titel).placeName;
  assert.equal(ort('Öffentliche'), 'HELLERAU, Besucherzentrum, Dresden');
  assert.equal(ort('Nano'), 'HELLERAU, Kleiner Saal, Dresden');
  assert.equal(ort('Karkerou'), 'HELLERAU, Dalcroze-Saal, Dresden');
  assert.equal(ort('Feature'), 'HELLERAU (auswärts), Dresden');
  assert.equal(ort('Gastspiel'), 'tjg., Kleine Bühne, Dresden');
  assert.equal(ort('Ausstellung'), 'HELLERAU, Dresden');
});

test('hellerau: ohne Uhrzeit hat hasTime false; abgesagt wird erkannt', async () => {
  const { events } = await holen();
  const a = mitTitel(events, 'Ausstellung');
  assert.equal(a.hasTime, false);
  assert.equal(a.start, '2026-12-14T00:00:00+01:00');
  assert.equal(mitTitel(events, 'Karkerou').ticketStatus, 'abgesagt');
});

test('hellerau: ohne anderes Stichwort bei Theater, Führungen bleiben Führungen', async () => {
  const { events } = await holen();
  assert.equal(rubrikUndGenre(mitTitel(events, 'Sacre')).rubrik, 'theater');
  assert.equal(rubrikUndGenre(mitTitel(events, 'Öffentliche')).rubrik, 'fuehrung');
});

test('hellerau: Vergangenes fällt heraus, horizonDays begrenzt die Vorschau', async () => {
  const { events } = await holen({ today: '2026-12-04', cfg: { horizonDays: 3 } });
  assert.deepEqual(events.map((e) => e.start.slice(0, 10)), ['2026-12-04', '2026-12-04', '2026-12-07']);
  const alle = (await holen()).events;
  assert.equal(mitTitel(alle, 'Vorbei'), undefined);
  assert.equal(mitTitel(alle, 'Weit weg'), undefined);
});

test('hellerau: Seite ohne Terminliste ist ein Fehler', async () => {
  await assert.rejects(() => holen({ body: '<html><body>leer</body></html>' }), /keine Termine/);
});

test('hellerau: in der Adapterliste und in sources.json eingeschaltet', () => {
  assert.ok(adapters.some((a) => a.name === 'hellerau'));
  assert.equal(JSON.parse(readFileSync(new URL('../sources.json', import.meta.url), 'utf8')).hellerau?.enabled, true);
});
