import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { name, fetchEvents } from '../src/sources/augusto.js';

const seite1 = JSON.parse(readFileSync(new URL('./fixtures/augusto-p1.json', import.meta.url), 'utf8'));
const config = { enabled: true, baseUrl: 'https://augusto-sachsen.de/veranstaltungen/api/1.0/export', slugs: ['stadt-bautzen'], days: 60, maxPages: 50 };
const LEER = { Pager: { NbResults: 0, IsLastPage: true }, EventDates: [] };

const vorlage = seite1.EventDates[0];
let nummer = 9000;
const zeile = (over) => ({ ...vorlage, Id: nummer++, ...over });
const seiteMit = (rows, letzte = false) => ({ Pager: { IsLastPage: letzte }, EventDates: rows });

function fakeHttp(proSlug) {
  const urls = [];
  return {
    urls,
    get: async (url) => {
      urls.push(url);
      const u = new URL(url);
      const slug = u.pathname.split('/')[u.pathname.split('/').length - 2];
      const antwort = proSlug[slug];
      if (antwort instanceof Error) throw antwort;
      return { status: 200, body: (antwort ?? [])[Number(u.searchParams.get('p')) - 1] ?? LEER, url };
    },
  };
}
const holen = (proSlug, extra = {}) => fetchEvents({ http: fakeHttp(proSlug), today: '2026-11-08', config: { ...config, ...extra } });

test('Quellenname ist augusto', () => {
  assert.equal(name, 'augusto');
});

test('augusto: Pagination endet bei leerer Seite', async () => {
  const http = fakeHttp({ 'stadt-bautzen': [seite1, seiteMit([zeile({ Title: 'Zweite Seite' })])] });
  const events = await fetchEvents({ http, today: '2026-11-08', config });
  assert.equal(http.urls.length, 3);
  assert.match(http.urls[0], /\/export\/stadt-bautzen\/list\?date_from=2026-11-08&date_to=2027-01-07&p=1$/);
  assert.ok(events.some((e) => e.title === 'Zweite Seite'));
  assert.ok(events.some((e) => e.title === 'Hubertusmesse'));
});

test('augusto: jeder Termin hat sources[0].url, Zeit mit Berliner Offset und Ort', async () => {
  const events = await holen({ 'stadt-bautzen': [seite1] });
  assert.ok(events.length >= 9);
  for (const e of events) {
    assert.match(e.sources[0].url, /^https:\/\/augusto-sachsen\.de\/veranstaltungen\/t\/\d+\//);
    assert.match(e.start, /^2026-11-\d\dT\d\d:\d\d:00\+01:00$/);
    assert.ok(e.placeName);
  }
  const messe = events.find((e) => e.title === 'Hubertusmesse');
  assert.equal(messe.start, '2026-11-08T10:00:00+01:00');
  assert.equal(messe.placeName, 'Kirche Cunewalde');
  assert.equal(messe.sources[0].name, 'Augusto');
});

test('augusto: Telefonnummer im Text wird contact.phone', async () => {
  const events = await holen({ 'stadt-bautzen': [seiteMit([zeile({ Title: 'Singen', DescriptionTruncated: 'Karten und Infos: Tel. 03591 12345.' })])] });
  assert.equal(events[0].contact.phone, '0359112345');
  const ohne = await holen({ 'stadt-bautzen': [seiteMit([zeile({ Title: 'Stille', DescriptionTruncated: 'Ohne Nummer' })])] });
  assert.equal(ohne[0].contact.phone, null);
});

test('augusto: Dauerangebote über 14 Tage ohne Aufführungscharakter werden verworfen, kurze Ausstellung bleibt', async () => {
  const events = await holen({ 'stadt-bautzen': [seiteMit([
    zeile({ Title: 'Dauerausstellung', FormalCategoryName: 'Ausstellung, Museum', Production: { DateFromTo: '01. Januar - 31. Dezember 2026' }, DateTime: '2026-11-08T00:00:00+0100' }),
    zeile({ Title: 'Roll-Up-Ausstellung', FormalCategoryName: 'Ausstellung, Museum', Production: { DateFromTo: '09. November 2026' }, DateTime: '2026-11-09T15:15:00+0100' }),
    zeile({ Title: 'Oper im Winter', FormalCategoryName: 'Theater, Oper', Production: { DateFromTo: '01. November - 28. Februar 2027' }, DateTime: '2026-11-10T19:30:00+0100' }),
  ])] });
  assert.deepEqual(events.map((e) => e.title).sort(), ['Oper im Winter', 'Roll-Up-Ausstellung']);
});

test('augusto: mehrere Orte werden nacheinander abgerufen, ein gesperrter Ort stoppt die anderen nicht', async () => {
  const proSlug = { 'stadt-bautzen': [seite1], 'stadt-zittau': new Error('HTTP 403') };
  const events = await holen(proSlug, { slugs: ['stadt-zittau', 'stadt-bautzen'] });
  assert.ok(events.length > 0);
  await assert.rejects(holen({ 'stadt-zittau': new Error('HTTP 403') }, { slugs: ['stadt-zittau'] }), /403/);
});

test('augusto: ausverkauft im Titel wird erkannt, sonst null', async () => {
  const events = await holen({ 'stadt-bautzen': [seiteMit([zeile({ Title: 'Weihnachtskonzert - AUSVERKAUFT' }), zeile({ Title: 'Neujahrskonzert' })])] });
  assert.equal(events.find((e) => e.title.startsWith('Weihnachtskonzert')).ticketStatus, 'ausverkauft');
  assert.equal(events.find((e) => e.title === 'Neujahrskonzert').ticketStatus, null);
});

test('augusto: Spielstätte ohne Ortsangabe bekommt Koordinaten und Namen der Region (fallbackPlace)', async () => {
  const seite = { Pager: { IsLastPage: true }, EventDates: [zeile({ Title: 'Lesung', LocationName: 'Galerie Budissin', DateTime: '2026-11-14T19:00:00+0100', Production: { DateFromTo: '14. November 2026' } })] };
  const http = { get: async (url) => ({ status: 200, body: new URL(url).searchParams.get('p') === '1' ? seite : { Pager: { IsLastPage: true }, EventDates: [] }, url }) };
  const [e] = await fetchEvents({ http, today: '2026-11-08', config: { ...config, fallbackPlace: 'Bautzen' } });
  assert.equal(e.placeName, 'Galerie Budissin, Raum Bautzen');
  assert.ok(Math.abs(e.lat - 51.18) < 0.1 && Math.abs(e.lon - 14.42) < 0.1, `${e.lat}, ${e.lon}`);
});
