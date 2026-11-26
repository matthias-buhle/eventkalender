import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { name, fetchEvents } from '../src/sources/hoftheater.js';
import { rubrikUndGenre } from '../src/rubriken.js';

const fx = (datei) => readFileSync(new URL(`./fixtures/${datei}`, import.meta.url), 'utf8');
const URL_PLAN = 'https://hoftheater-dresden.de/spielplan/';
const config = { enabled: true, url: URL_PLAN, horizonDays: 400 };
const http = (body) => ({ get: async (url) => { assert.equal(url, URL_PLAN); return { status: 200, body, url }; } });
const holen = (today = '2026-11-26', body = fx('hoftheater-spielplan.html'), extra = {}) =>
  fetchEvents({ http: http(body), today, config: { ...config, ...extra } });
const am = (events, tag) => events.filter((e) => e.start.startsWith(tag));

const eintrag = ({ tag = '30.11.', uhr = '20:00', titel = 'Probe', zusatz = 'Untertitel', karten = '<a class="show-tickets green" href="https://www.etix.com/ticket/p/1">Karten</a>' } = {}) => `
<div class="termine"><div class="datum"><span class="tagmonat">${tag}</span><span class="wochentag">Montag</span><span class="uhrzeit">${uhr}</span></div>
<div class="vorschaubild_termine"></div><div class="link"><a href="https://hoftheater-dresden.de/stuecke/probe/">${titel}</a><br>${zusatz}</div>${karten}</div>`;
const seite = (...eintraege) => `<html><body><main>${eintraege.join('')}</main></body></html>`;

test('Quellenname ist hoftheater', () => {
  assert.equal(name, 'hoftheater');
});

test('hoftheater: Titel, Beginn zur Berliner Zeit, Spielstätte und Link zum Stück', async () => {
  const [e] = am(await holen(), '2026-11-28');
  assert.equal(e.title, 'Die Weihnachtsgans Auguste');
  assert.equal(e.start, '2026-11-28T15:00:00+01:00');
  assert.equal(e.hasTime, true);
  assert.equal(e.placeName, 'Hoftheater Weißig, Dresden');
  assert.equal(e.sources[0].name, 'Hoftheater Dresden');
  assert.equal(e.sources[0].url, 'https://hoftheater-dresden.de/stuecke/die-weihnachtsgans-auguste/');
  assert.equal(e.contact.url, e.sources[0].url);
});

test('hoftheater: nur das Zugesagte, keine Beschreibung, kein Untertitel, kein Ticketlink, kein Bild', async () => {
  const events = await holen();
  assert.ok(events.length > 40);
  for (const e of events) {
    assert.equal(e.description, null, e.title);
    assert.equal(e.ticketUrl, null, e.title);
    assert.ok(!JSON.stringify(e).match(/etix|Friedrich Wolf|jpg/i), e.title);
  }
});

test('hoftheater: das Jahr fehlt auf der Seite; nach dem Dezember zählt das nächste Jahr, auch im August', async () => {
  const events = await holen();
  assert.equal(am(events, '2026-12-31')[0].title, 'Alte Liebe');
  assert.equal(am(events, '2027-01-15')[0].title, 'Alte Liebe');
  assert.equal(am(events, '2027-04-24')[0].start, '2027-04-24T16:00:00+02:00');
});

test('hoftheater: steht Anfang Januar noch der Dezember oben, bleibt er im alten Jahr', async () => {
  const html = seite(eintrag({ tag: '30.12.' }), eintrag({ tag: '03.01.' }));
  const events = await holen('2027-01-01', html);
  assert.deepEqual(events.map((e) => e.start.slice(0, 10)), ['2027-01-03']);
});

test('hoftheater: zwei Vorstellungen am selben Tag bleiben getrennte Termine', async () => {
  const zwei = am(await holen(), '2026-12-24');
  assert.deepEqual(zwei.map((e) => e.start.slice(11, 16)), ['14:00', '16:30']);
  assert.notEqual(zwei[0].id, zwei[1].id);
});

test('hoftheater: geschlossene Veranstaltungen und Schulveranstaltungen fehlen', async () => {
  const events = await holen();
  assert.equal(am(events, '2026-12-21').length, 0); // "Veranstaltung der Hutbergschule"
  assert.equal(am(events, '2027-01-16').length, 0); // "Geschlossene Familienfeier - …"
  assert.ok(!events.some((e) => /geschlossen/i.test(e.title)));
});

test('hoftheater: AUSVERKAUFT wird ausverkauft, Restkarten und Karten bleiben offen', async () => {
  const events = await holen();
  assert.equal(am(events, '2026-11-27')[0].ticketStatus, 'ausverkauft');
  assert.equal(am(events, '2026-11-28')[0].ticketStatus, null);
  assert.equal(am(events, '2026-11-30')[0].ticketStatus, null); // Restkarten
});

test('hoftheater: landet über die Spielstätte bei Theater & Lesungen', async () => {
  const [e] = am(await holen(), '2027-01-30');
  assert.equal(rubrikUndGenre(e).rubrik, 'theater');
});

test('hoftheater: vergangene Termine fallen heraus, horizonDays begrenzt die Vorschau', async () => {
  const events = await holen('2026-11-29', undefined, { horizonDays: 3 });
  assert.deepEqual(events.map((e) => e.start.slice(0, 10)), ['2026-11-29', '2026-11-30', '2026-12-01', '2026-12-02']);
});

test('hoftheater: Eintrag ohne Uhrzeit hat hasTime false', async () => {
  const [e] = await holen('2026-11-26', seite(eintrag({ uhr: '' })));
  assert.equal(e.hasTime, false);
  assert.equal(e.start, '2026-11-30T00:00:00+01:00');
});

test('hoftheater: Seite ohne Spielplan ist ein Fehler', async () => {
  await assert.rejects(() => holen('2026-11-26', '<html><body>leer</body></html>'), /keine Termine/);
});
