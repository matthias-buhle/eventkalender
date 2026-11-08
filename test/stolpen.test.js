import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { name, fetchEvents } from '../src/sources/stolpen.js';

const fx = (datei) => readFileSync(new URL(`./fixtures/${datei}`, import.meta.url), 'utf8');
const BASIS = 'https://www.stolpen.de';
const LISTE = `${BASIS}/liste-aller-veranstaltungen`;
const D_SUPPENFEST = `${BASIS}/veranstaltung-anzeigen/8-lauterbacher-suppenfest`;
const D_STERNSTUNDEN = `${BASIS}/veranstaltung-anzeigen/sternstunden-2026`;
const TODAY = '2026-11-08';
const config = { enabled: true, listUrl: LISTE, horizonDays: 90, maxDetailPages: 40 };

/** Liste und zwei Detailseiten; alle anderen Detailseiten gibt es nicht (404). */
function fakeHttp(extra = {}) {
  const seiten = { [LISTE]: fx('stolpen-list.html'), [D_SUPPENFEST]: fx('stolpen-detail-1.html'), [D_STERNSTUNDEN]: fx('stolpen-detail-2.html'), ...extra };
  const abgerufen = [];
  return {
    abgerufen,
    get: async (url) => {
      abgerufen.push(url);
      if (!seiten[url]) throw new Error(`HTTP 404 für ${url}`);
      return { status: 200, body: seiten[url], url };
    },
  };
}
const holen = async (extra = {}, cfg = config) => fetchEvents({ http: fakeHttp(extra), today: TODAY, config: cfg });
const finden = (events, anfang) => events.find((e) => e.title.startsWith(anfang));

test('Quellenname ist stolpen', () => {
  assert.equal(name, 'stolpen');
});

test('stolpen: Titel, Start, Ende, Ort und Quellenlink aus der Liste', async () => {
  const events = await holen();
  const stern = finden(events, 'Sternstunden');
  assert.equal(stern.start, '2026-11-15T14:00:00+01:00');
  assert.equal(stern.end, '2026-11-15T17:00:00+01:00');
  assert.equal(stern.placeName, 'Altes Amtsgericht, Stolpen');
  assert.equal(stern.sources[0].url, D_STERNSTUNDEN);
  const fest = finden(events, '8. Lauterbacher Suppenfest');
  assert.equal(fest.start, '2026-11-08T11:00:00+01:00');
  assert.equal(fest.end, null);
  assert.equal(fest.placeName, 'Lauterbach, Vereinsräume im Erbgericht, Stolpen');
  assert.ok(events.every((e) => e.hasTime));
});

test('stolpen: Termin ohne Veranstalter hat leeren contact und weiterhin einen Quellenlink', async () => {
  const events = await holen();
  const blutspende = finden(events, 'DRK Blutspende'); // Detailseite nicht abrufbar
  assert.deepEqual(blutspende.contact, { phone: null, url: null, email: null });
  assert.equal(blutspende.sources[0].url, `${BASIS}/veranstaltung-anzeigen/drk-blutspende`);
  const fest = finden(events, '8. Lauterbacher Suppenfest'); // Detailseite ohne Kontaktangaben
  assert.deepEqual(fest.contact, { phone: null, url: null, email: null });
});

test('stolpen: Telefon und E-Mail aus dem Text der Detailseite werden Kontakt', async () => {
  const events = await holen();
  const stern = finden(events, 'Sternstunden');
  assert.equal(stern.contact.phone, '03597327313');
  assert.equal(stern.contact.email, 'stadtinfo@stolpen.de');
  assert.equal(stern.contact.url, null, 'ohne Veranstalterlink bleibt contact.url leer');
  assert.match(stern.description, /^Beim Sternstunden-Bastelnachmittag/);
});

test('stolpen: Markt an zwei aufeinanderfolgenden Tagen bleibt ein Termin, gleiche Reihe an Nicht-Märkten nicht', async () => {
  const events = await holen();
  const markt = events.filter((e) => e.title.startsWith('Romantischer Weihnachtsmarkt'));
  assert.equal(markt.length, 1);
  assert.equal(markt[0].start, '2026-12-05T10:00:00+01:00');
  assert.equal(markt[0].end, '2026-12-06T18:00:00+01:00');
  assert.equal(markt[0].art, 'markt');
  assert.equal(events.length, 4);
});

test('stolpen: nur Termine im Zeitraum, höchstens maxDetailPages Detailseiten', async () => {
  const kurz = await holen({}, { ...config, horizonDays: 10 });
  assert.deepEqual(kurz.map((e) => e.title.slice(0, 12)).sort(), ['8. Lauterbac', 'DRK Blutspen', 'Sternstunden']);
  const http = fakeHttp();
  const events = await fetchEvents({ http, today: TODAY, config: { ...config, maxDetailPages: 1 } });
  assert.equal(http.abgerufen.length, 2);
  assert.equal(events.length, 4);
});

test('stolpen: fällt die Liste aus, ist es ein Fehler', async () => {
  await assert.rejects(holen({ [LISTE]: '' }), /404/);
});
