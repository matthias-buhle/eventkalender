import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeEvent } from '../src/model.js';
import { CENTER, distanceKm } from '../src/geo.js';
import { suchtexteFuer, ergaenzeOrte, erzeugeAbruf } from '../src/ortssuche.js';

const HEUTE = '2026-11-23';
const BAUTZEN = { lat: 51.1809, lon: 14.4276 };
/** Ein Punkt `km` Kilometer nördlich von `p`, als Nominatim-Antwort (Zahlen als Text). */
const noerdlich = (p, km) => ({ lat: String(p.lat + km / 111.195), lon: String(p.lon) });

let zaehler = 0;
function ev(over) {
  zaehler += 1;
  return makeEvent({
    sourceName: 'T', sourceId: String(zaehler), sourceUrl: 'https://t.example/x',
    title: 'Termin', start: '2026-11-30T10:00:00+01:00', placeName: 'Sebnitz',
    ...over,
  });
}
const region = (venue, km = 30) => ev({ placeName: `${venue}, Raum Bautzen`, ...BAUTZEN, country: 'DE', ortRegionKm: km });

/** Fake-Abruf: antwortet je Suchtext (q) aus der Tabelle, Standard `[]`; merkt sich alle Adressen. */
function fakeAbruf(antworten = {}) {
  const urls = [];
  const abruf = async (url) => {
    urls.push(url);
    const q = new URL(url).searchParams.get('q');
    const a = Object.hasOwn(antworten, q) ? antworten[q] : undefined;
    if (a instanceof Error) throw a;
    return a ?? [];
  };
  return { abruf, urls };
}
const ohnePause = async () => {};

test('suchtexteFuer: Regionstermin fragt "<Spielstätte>, <Region>", ohne Spielstätte nichts', () => {
  assert.deepEqual(suchtexteFuer(region('Galerie Budissin')), ['Galerie Budissin, Bautzen']);
  assert.deepEqual(suchtexteFuer(ev({ placeName: 'Raum Bautzen', ...BAUTZEN, ortRegionKm: 15 })), []);
});

test('suchtexteFuer: ohne Quellregion keine Frage, auch ohne Koordinaten (Spezifikation: Titel, sonst Rest mit Vermerk)', () => {
  assert.deepEqual(suchtexteFuer(ev({ placeName: 'Turnhalle, Kubschütz / Kreckwitz' })), []);
  assert.deepEqual(suchtexteFuer(ev({ placeName: 'Unbekanntdorf' })), []);
  assert.deepEqual(suchtexteFuer(ev({ placeName: 'Sebnitz', lat: 50.97, lon: 14.27 })), []);
  assert.deepEqual(suchtexteFuer(ev({ placeName: '' })), []);
});

test('Termine ohne Quellregion werden nicht nachgeschlagen und bleiben ohne Koordinaten', async () => {
  const { abruf, urls } = fakeAbruf({ Nahdorf: [noerdlich(CENTER, 40)], 'Turnhalle, Kubschütz': [noerdlich(CENTER, 30)] });
  const a = ev({ placeName: 'Nahdorf' });
  const b = ev({ placeName: 'Turnhalle, Kubschütz' });
  const { events, cache, stats } = await ergaenzeOrte([a, b], { abruf, cache: {}, heute: HEUTE, sleep: ohnePause });
  assert.equal(urls.length, 0);
  assert.equal(events[0], a);
  assert.equal(events[1], b);
  assert.equal(events[0].lat, null);
  assert.deepEqual(cache, {});
  assert.deepEqual(stats, { treffer: 0, ohneTreffer: 0, ausCache: 0, fehler: 0, offen: 0 });
});

test('Treffer in der Nähe wird übernommen', async () => {
  const { abruf } = fakeAbruf({ 'Galerie Budissin, Bautzen': [noerdlich(BAUTZEN, 8)] });
  const { events, stats } = await ergaenzeOrte([region('Galerie Budissin')], { abruf, cache: {}, heute: HEUTE, sleep: ohnePause });
  const [e] = events;
  assert.equal(typeof e.lat, 'number');
  assert.ok(Math.abs(distanceKm(BAUTZEN, e) - 8) < 0.1);
  assert.equal(e.lon, BAUTZEN.lon);
  assert.equal(e.ortRegionKm, null);
  assert.equal(stats.treffer, 1);
});

test('Treffer außerhalb des Annahmeradius wird verworfen und als kein Treffer gemerkt', async () => {
  const { abruf } = fakeAbruf({ 'Rathaus, Bautzen': [noerdlich(BAUTZEN, 60)] });
  const vorher = region('Rathaus', 15);
  const { events, cache, stats } = await ergaenzeOrte([vorher], { abruf, cache: {}, heute: HEUTE, sleep: ohnePause });
  assert.deepEqual(events[0], vorher);
  assert.deepEqual(cache['Rathaus, Bautzen'], { lat: null, lon: null, zuletzt: HEUTE });
  assert.equal(stats.ohneTreffer, 1);
  assert.equal(stats.treffer, 0);
});

test('zweiter Lauf fragt nicht noch einmal', async () => {
  const termine = () => [region('Galerie Budissin'), region('Nirgendwo')];
  const erst = fakeAbruf({ 'Galerie Budissin, Bautzen': [noerdlich(BAUTZEN, 8)] });
  const lauf1 = await ergaenzeOrte(termine(), { abruf: erst.abruf, cache: {}, heute: HEUTE, sleep: ohnePause });
  assert.equal(erst.urls.length, 2);
  assert.equal(lauf1.cache['Nirgendwo, Bautzen'].lat, null);

  const zweit = fakeAbruf({});
  const lauf2 = await ergaenzeOrte(termine(), { abruf: zweit.abruf, cache: lauf1.cache, heute: '2026-11-24', sleep: ohnePause });
  assert.equal(zweit.urls.length, 0);
  assert.equal(lauf2.stats.ausCache, 2);
  assert.ok(Math.abs(distanceKm(BAUTZEN, lauf2.events[0]) - 8) < 0.1);
  assert.equal(lauf2.events[0].ortRegionKm, null);
  assert.equal(lauf2.events[1].ortRegionKm, 30);
  assert.equal(lauf2.cache['Nirgendwo, Bautzen'].zuletzt, '2026-11-24');
});

test('gemerkter Treffer gilt nur im Annahmeradius des jeweiligen Termins', async () => {
  const text = 'Rathaus, Bautzen';
  const cache = { [text]: { ...noerdlich(BAUTZEN, 25), zuletzt: HEUTE } };
  cache[text].lat = Number(cache[text].lat);
  cache[text].lon = Number(cache[text].lon);
  const { abruf, urls } = fakeAbruf();
  const eng = region('Rathaus', 15);
  const weit = region('Rathaus', 30);
  const r = await ergaenzeOrte([eng, weit], { abruf, cache, heute: HEUTE, sleep: ohnePause });
  assert.equal(urls.length, 0);
  assert.deepEqual(r.events[0], eng, '25 km liegt außerhalb von 15 km: unverändert');
  assert.equal(r.events[1].lat, cache[text].lat, 'beim 30-km-Termin übernommen');
  assert.equal(r.events[1].ortRegionKm, null);
  assert.equal(r.cache[text].lat, cache[text].lat, 'Eintrag bleibt erhalten');

  // auch innerhalb eines Laufs: ein frischer Treffer für einen 30-km-Termin verschiebt keinen 15-km-Termin
  const { abruf: abruf2, urls: urls2 } = fakeAbruf({ 'Rathaus, Bautzen': [noerdlich(BAUTZEN, 25)] });
  const r2 = await ergaenzeOrte([region('Rathaus', 30), region('Rathaus', 15)], { abruf: abruf2, cache: {}, heute: HEUTE, sleep: ohnePause });
  assert.equal(urls2.length, 1);
  assert.equal(r2.events[0].ortRegionKm, null);
  assert.equal(r2.events[1].ortRegionKm, 15);
  assert.equal(r2.events[1].lat, BAUTZEN.lat);
});

test('unbrauchbarer Cache-Eintrag gilt als fehlend und wird neu gefragt', async () => {
  const cache = { 'Rathaus, Bautzen': { lat: 'x', lon: 'y', zuletzt: HEUTE } };
  const { abruf, urls } = fakeAbruf({ 'Rathaus, Bautzen': [noerdlich(BAUTZEN, 5)] });
  const r = await ergaenzeOrte([region('Rathaus')], { abruf, cache, heute: HEUTE, sleep: ohnePause });
  assert.equal(urls.length, 1);
  assert.equal(typeof r.cache['Rathaus, Bautzen'].lat, 'number');
  assert.equal(r.events[0].ortRegionKm, null);
});

test('Suchtexte wie "constructor" oder "__proto__" sind gewöhnliche Schlüssel', async () => {
  // Solche Schlüssel kommen nur noch aus einer gelesenen Datei (JSON.parse legt "__proto__" als eigenen Schlüssel an).
  const cache = JSON.parse(`{"constructor":{"lat":null,"lon":null,"zuletzt":"${HEUTE}"},"__proto__":{"lat":null,"lon":null,"zuletzt":"${HEUTE}"}}`);
  const { abruf, urls } = fakeAbruf({ 'A, Bautzen': [noerdlich(BAUTZEN, 5)] });
  const r = await ergaenzeOrte([region('A')], { abruf, cache, heute: HEUTE, sleep: ohnePause });
  assert.equal(urls.length, 1);
  assert.equal(r.events[0].ortRegionKm, null);
  assert.equal(Object.hasOwn(r.cache, 'constructor'), true);
  assert.equal(Object.hasOwn(r.cache, '__proto__'), true);
  assert.equal(Object.getPrototypeOf(r.cache), Object.prototype);
});

test('Cache-Treffer lösen keine Pause aus', async () => {
  const pausen = [];
  const cache = { 'A, Bautzen': { lat: null, lon: null, zuletzt: HEUTE }, 'B, Bautzen': { lat: null, lon: null, zuletzt: HEUTE } };
  const { abruf } = fakeAbruf();
  await ergaenzeOrte([region('A'), region('B'), region('C')], { abruf, cache, heute: HEUTE, sleep: async (ms) => { pausen.push(ms); } });
  assert.deepEqual(pausen, []);
});

test('HTTP 500 zählt als Fehler und wird nicht gemerkt', async () => {
  const fetchImpl = async () => ({ ok: false, status: 500, json: async () => ({}) });
  const abruf = erzeugeAbruf({ userAgent: 'Test/1.0', fetchImpl });
  const a = region('A');
  const r = await ergaenzeOrte([a], { abruf, cache: {}, heute: HEUTE, sleep: ohnePause });
  assert.equal(r.stats.fehler, 1);
  assert.deepEqual(r.cache, {});
  assert.deepEqual(r.events[0], a);
});

test('Abfrageurl', async () => {
  const { abruf, urls } = fakeAbruf();
  await ergaenzeOrte([region('Kirche St. Petri & Co')], { abruf, cache: {}, heute: HEUTE, sleep: ohnePause });
  const url = new URL(urls[0]);
  assert.equal(`${url.origin}${url.pathname}`, 'https://nominatim.openstreetmap.org/search');
  const p = url.searchParams;
  assert.equal(p.get('format'), 'jsonv2');
  assert.equal(p.get('limit'), '1');
  assert.equal(p.get('countrycodes'), 'de');
  assert.equal(p.get('bounded'), '1');
  const [links, oben, rechts, unten] = p.get('viewbox').split(',').map(Number);
  assert.ok(Math.abs(links - (CENTER.lon - 1.1)) < 1e-6);
  assert.ok(Math.abs(rechts - (CENTER.lon + 1.1)) < 1e-6);
  assert.ok(Math.abs(oben - (CENTER.lat + 0.7)) < 1e-6);
  assert.ok(Math.abs(unten - (CENTER.lat - 0.7)) < 1e-6);
  assert.equal(p.get('q'), 'Kirche St. Petri & Co, Bautzen');
  assert.ok(!urls[0].includes(' ') && !urls[0].includes('& Co'), 'Suchtext URL-kodiert');
});

test('Pause von mindestens 1100 ms zwischen zwei Anfragen, nicht vor der ersten', async () => {
  const pausen = [];
  const { abruf } = fakeAbruf();
  await ergaenzeOrte([region('A'), region('B'), region('C')], { abruf, cache: {}, heute: HEUTE, sleep: async (ms) => { pausen.push(ms); } });
  assert.equal(pausen.length, 2);
  assert.ok(pausen.every((ms) => ms >= 1100));
});

test('Fehler', async () => {
  const fehler = (m) => new Error(m);
  // einzelner Fehler: Termin unverändert, nichts im Cache; leere Antwort ist kein Fehler
  const { abruf } = fakeAbruf({ 'A, Bautzen': fehler('HTTP 429'), 'B, Bautzen': [] });
  const a = region('A');
  const r = await ergaenzeOrte([a, region('B')], { abruf, cache: {}, heute: HEUTE, sleep: ohnePause });
  assert.deepEqual(r.events[0], a);
  assert.equal(r.stats.fehler, 1);
  assert.equal('A, Bautzen' in r.cache, false);
  assert.deepEqual(r.cache['B, Bautzen'], { lat: null, lon: null, zuletzt: HEUTE });

  // nach 5 Fehlern in Folge keine weiteren Aufrufe
  const immer = { urls: [] };
  const kaputt = async (url) => { immer.urls.push(url); throw fehler('Zeitüberschreitung'); };
  const termine = ['1', '2', '3', '4', '5', '6', '7'].map((n) => region(`Ort${n}`));
  const r2 = await ergaenzeOrte(termine, { abruf: kaputt, cache: {}, heute: HEUTE, sleep: ohnePause });
  assert.equal(immer.urls.length, 5);
  assert.equal(r2.stats.fehler, 5);
  assert.equal(r2.stats.offen, 2);
  assert.deepEqual(r2.cache, {});
  assert.deepEqual(r2.events, termine);
});

test('Fehler: kaputte Antwort (kein Array) zählt als Fehler, wirft nicht', async () => {
  const r = await ergaenzeOrte([region('A')], { abruf: async () => ({ error: 'x' }), cache: {}, heute: HEUTE, sleep: ohnePause });
  assert.equal(r.stats.fehler, 1);
  assert.deepEqual(r.cache, {});
});

test('Fehler: auch ein unbrauchbarer Termin oder Cache lässt keine Ausnahme heraus', async () => {
  const kaputt = { placeName: { toString() { throw new Error('x'); } }, ...BAUTZEN, ortRegionKm: 15 };
  const { abruf } = fakeAbruf();
  const r = await ergaenzeOrte([kaputt, region('A')], { abruf, cache: null, heute: HEUTE, sleep: ohnePause });
  assert.equal(r.events[0], kaputt);
  assert.equal(r.events.length, 2);
});

test('maxAnfragen', async () => {
  const { abruf, urls } = fakeAbruf();
  const termine = ['1', '2', '3', '4', '5'].map((n) => region(`Ort${n}`));
  const { stats } = await ergaenzeOrte(termine, { abruf, cache: {}, heute: HEUTE, maxAnfragen: 2, sleep: ohnePause });
  assert.equal(urls.length, 2);
  assert.equal(stats.offen, 3);
});

test('Gesamtgrenze: nach 20 Fehlern insgesamt (nicht in Folge) wird nicht mehr gefragt', async () => {
  const urls = [];
  // abwechselnd Fehler und Treffer: nie 5 Fehler in Folge
  const abruf = async (url) => {
    urls.push(url);
    if (urls.length % 2 === 1) throw new Error('Zeitüberschreitung');
    return [noerdlich(BAUTZEN, 3)];
  };
  const termine = Array.from({ length: 50 }, (_, i) => region(`Ort${i}`));
  const r = await ergaenzeOrte(termine, { abruf, cache: {}, heute: HEUTE, sleep: ohnePause });
  assert.equal(urls.length, 39, 'der 20. Fehler ist die 39. Anfrage');
  assert.equal(r.stats.fehler, 20);
  assert.equal(r.stats.treffer, 19);
  assert.equal(r.stats.offen, 11);
  const s = r.stats;
  assert.equal(s.treffer + s.ohneTreffer + s.ausCache + s.fehler + s.offen, termine.length, 'Statistik geht auf');
  assert.equal(Object.keys(r.cache).length, 19, 'gefundene Treffer bleiben gemerkt');
  assert.equal(r.events.filter((e) => e.ortRegionKm == null).length, 19);
});

test('Gesamtgrenze: nach 10 Minuten Laufzeit wird nicht mehr gefragt', async () => {
  let uhr = 1_000_000;
  const urls = [];
  const abruf = async (url) => {
    urls.push(url);
    uhr += 4 * 60_000; // jede Anfrage „dauert“ 4 Minuten
    return [noerdlich(BAUTZEN, 3)];
  };
  const termine = ['1', '2', '3', '4', '5', '6'].map((n) => region(`Ort${n}`));
  const r = await ergaenzeOrte(termine, { abruf, cache: {}, heute: HEUTE, sleep: ohnePause, jetzt: () => uhr });
  assert.equal(urls.length, 3, 'nach 0, 4 und 8 Minuten gefragt, nach 12 Minuten nicht mehr');
  assert.equal(r.stats.treffer, 3);
  assert.equal(r.stats.offen, 3);
  assert.equal(Object.keys(r.cache).length, 3);
  assert.deepEqual(r.events.slice(3), termine.slice(3));
});

test('Aufräumen', async () => {
  const cache = {
    'Alt, Bautzen': { lat: null, lon: null, zuletzt: '2026-01-01' },
    'Alt aber gebraucht, Bautzen': { lat: null, lon: null, zuletzt: '2026-01-01' },
    'Jung, Bautzen': { lat: 51.2, lon: 14.4, zuletzt: '2026-10-01' },
  };
  const { abruf, urls } = fakeAbruf();
  const r = await ergaenzeOrte([region('Alt aber gebraucht')], { abruf, cache, heute: HEUTE, sleep: ohnePause });
  assert.equal(urls.length, 0);
  assert.deepEqual(Object.keys(r.cache).sort(), ['Alt aber gebraucht, Bautzen', 'Jung, Bautzen']);
  assert.equal(r.cache['Alt aber gebraucht, Bautzen'].zuletzt, HEUTE);
  assert.equal(cache['Alt, Bautzen'].zuletzt, '2026-01-01', 'der übergebene Cache bleibt unverändert');
});

test('Termine ohne Frage bleiben unberührt', async () => {
  const genau = ev({ placeName: 'Sebnitz', lat: 50.97, lon: 14.27, country: 'DE' });
  const ohneName = ev({ placeName: '' });
  const { abruf, urls } = fakeAbruf();
  const { events, stats } = await ergaenzeOrte([genau, ohneName], { abruf, cache: {}, heute: HEUTE, sleep: ohnePause });
  assert.equal(urls.length, 0);
  assert.equal(events[0], genau);
  assert.equal(events[1], ohneName);
  assert.deepEqual(stats, { treffer: 0, ohneTreffer: 0, ausCache: 0, fehler: 0, offen: 0 });
});

test('erzeugeAbruf: User-Agent, Accept-Language, Zeitlimit; HTTP-Fehler werfen', async () => {
  const aufrufe = [];
  const fetchImpl = async (url, init) => {
    aufrufe.push({ url, init });
    return url.includes('kaputt')
      ? { ok: false, status: 429, json: async () => ({}) }
      : { ok: true, status: 200, json: async () => [{ lat: '51', lon: '14' }] };
  };
  const abruf = erzeugeAbruf({ userAgent: 'Test/1.0', fetchImpl });
  assert.deepEqual(await abruf('https://n.example/search?q=a'), [{ lat: '51', lon: '14' }]);
  assert.equal(aufrufe[0].init.headers['User-Agent'], 'Test/1.0');
  assert.equal(aufrufe[0].init.headers['Accept-Language'], 'de');
  assert.ok(aufrufe[0].init.signal instanceof AbortSignal);
  await assert.rejects(abruf('https://n.example/kaputt'), /429/);
});
