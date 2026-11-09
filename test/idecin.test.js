import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { name, fetchEvents } from '../src/sources/idecin.js';

const fx = (datei) => readFileSync(new URL(`./fixtures/${datei}`, import.meta.url), 'utf8');
const BASIS = 'https://www.idecin.cz/program';
const config = { enabled: true, baseUrl: BASIS, months: 2, ausschluss: ['veřejné bruslení'] };

function fakeHttp() {
  const abgerufen = [];
  const seiten = { [`${BASIS}/11-2026`]: 'idecin-11-2026.html', [`${BASIS}/12-2026`]: 'idecin-12-2026.html' };
  return {
    abgerufen,
    get: async (url) => {
      abgerufen.push(url);
      if (!seiten[url]) throw new Error(`HTTP 404 für ${url}`);
      return { status: 200, body: fx(seiten[url]), url };
    },
  };
}
const holen = async (cfg = config, today = '2026-11-09') => {
  const http = fakeHttp();
  return { events: await fetchEvents({ http, today, config: cfg }), http };
};
const finden = (events, anfang) => events.find((e) => e.title.startsWith(anfang));

test('Quellenname ist idecin', () => {
  assert.equal(name, 'idecin');
});

test('idecin: ruft den laufenden und die folgenden Monate ab', async () => {
  const { http } = await holen();
  assert.deepEqual(http.abgerufen, [`${BASIS}/11-2026`, `${BASIS}/12-2026`]);
});

test('idecin: Zeit aus Unix-Sekunden als Berliner Zeit, Ende nur wenn vorhanden', async () => {
  const { events } = await holen();
  const dan = finden(events, 'Dan Bárta');
  assert.equal(dan.start, '2026-11-25T19:00:00+01:00');
  assert.equal(dan.end, null);
  const jam = finden(events, 'Jam Session');
  assert.equal(jam.start, '2026-11-07T14:00:00+01:00');
  assert.equal(jam.end, '2026-11-07T18:00:00+01:00');
});

test('idecin: Ort mit Straße und Stadt, Koordinaten, Land CZ, Quellenlink zur Terminseite', async () => {
  const dan = finden((await holen()).events, 'Dan Bárta');
  assert.equal(dan.placeName, 'Teplická, Děčín');
  assert.equal(dan.country, 'CZ');
  assert.ok(Math.abs(dan.lat - 50.77) < 0.05);
  assert.match(dan.sources[0].url, /^https:\/\/www\.idecin\.cz\/program\/udalost\/[\w-]+$/);
  assert.equal(dan.sources[0].name, 'Děčín – idecin.cz');
});

test('idecin: tschechische Konzerte werden Konzerte', async () => {
  const { events } = await holen();
  assert.equal(finden(events, 'Podzimní koncert').art, 'konzert');
  assert.equal(finden(events, 'Dan Bárta').art, 'konzert');
  assert.equal(finden(events, 'Jam Session').art, 'konzert');
});

test('idecin: ausgeschlossene Titel (öffentliches Eislaufen) fehlen', async () => {
  const { events } = await holen();
  assert.equal(finden(events, 'Veřejné bruslení'), undefined);
  const ohne = await holen({ ...config, ausschluss: [] });
  assert.ok(finden(ohne.events, 'Veřejné bruslení'));
});

test('idecin: ein Termin, der in zwei Monatsseiten steht, erscheint nur einmal', async () => {
  const { events } = await holen();
  const ids = events.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('idecin: zwei Einträge mit gleichem Titel und gleicher Startzeit (zwei Kennungen) werden ein Termin', async () => {
  const eintrag = (id) => ({ id, type: 'Culture', dateStart: '1799524800', dateEnd: null, title: 'Zahajovací ples', description: 'Ples', location: { address: 'Labská 691/23, 405 02 Děčín, Česko', lat: 50.77, lng: 14.2 } });
  const seite = `<html><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { events: [eintrag('a1'), eintrag('b2')] } } })}</script></body></html>`;
  const http = { get: async (url) => ({ status: 200, body: seite, url }) };
  const events = await fetchEvents({ http, today: '2026-11-09', config: { ...config, months: 1 } });
  assert.equal(events.length, 1);
});

test('idecin: fällt eine Monatsseite aus, kommen die anderen; fallen alle aus, ist es ein Fehler', async () => {
  const einzeln = { get: async (url) => { if (url.endsWith('12-2026')) throw new Error('HTTP 404'); return { status: 200, body: fx('idecin-11-2026.html'), url }; } };
  assert.ok((await fetchEvents({ http: einzeln, today: '2026-11-09', config })).length > 0);
  const keine = { get: async () => { throw new Error('HTTP 500'); } };
  await assert.rejects(() => fetchEvents({ http: keine, today: '2026-11-09', config }), /HTTP 500/);
});
