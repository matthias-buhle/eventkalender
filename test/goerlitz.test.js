import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { name, fetchEvents } from '../src/sources/goerlitz.js';

const seite1 = JSON.parse(readFileSync(new URL('./fixtures/goerlitz-p1.json', import.meta.url), 'utf8'));
const config = { enabled: true, url: 'https://www.goerlitz.de/termine/api', days: 60, maxPages: 50 };
const LEER = { Pager: { NbResults: 0, IsLastPage: true }, EventDates: [] };

/** Vorlage für erfundene Zeilen im Format der echten Antwort. */
const vorlage = seite1.EventDates.find((r) => r.Title === 'Hackday4all Görlitz 2026');
let nummer = 9000;
const zeile = (over) => ({ ...vorlage, Id: nummer++, Url: '', ...over });

/** Fake-Client: Seite n kommt aus `seiten[n-1]`, danach leer. */
function fakeHttp(seiten) {
  const urls = [];
  return {
    urls,
    get: async (url) => {
      urls.push(url);
      const p = Number(new URL(url).searchParams.get('p'));
      return { status: 200, body: seiten[p - 1] ?? LEER, url };
    },
  };
}
const holen = (seiten, extra = {}) => fetchEvents({ http: fakeHttp(seiten), today: '2026-11-08', config: { ...config, ...extra } });
const seiteMit = (rows, letzte = true) => ({ Pager: { IsLastPage: letzte }, EventDates: rows });

test('Quellenname ist goerlitz', () => {
  assert.equal(name, 'goerlitz');
});

test('goerlitz: ruft 60 Tage ab und liest Seiten, bis die Antwort leer ist', async () => {
  const http = fakeHttp([{ ...seite1, Pager: { IsLastPage: false } }, seiteMit([zeile({ Title: 'Zweite Seite' })], false)]);
  const events = await fetchEvents({ http, today: '2026-11-08', config });
  assert.equal(http.urls.length, 3); // Seite 3 ist leer
  assert.match(http.urls[0], /date_from=2026-11-08&date_to=2027-01-07&p=1$/);
  assert.match(http.urls[2], /&p=3$/);
  assert.ok(events.some((e) => e.title === 'Zweite Seite'));
});

test('goerlitz: hört bei IsLastPage auf und liest höchstens maxPages Seiten', async () => {
  const einzel = fakeHttp([seiteMit(seite1.EventDates, true)]);
  await fetchEvents({ http: einzel, today: '2026-11-08', config });
  assert.equal(einzel.urls.length, 1);
  const urls = [];
  const endlos = { get: async (url) => { urls.push(url); return { status: 200, body: seite1, url }; } };
  await fetchEvents({ http: endlos, today: '2026-11-08', config: { ...config, maxPages: 3 } });
  assert.equal(urls.length, 3);
});

test('goerlitz: Dauerausstellung (Kategorie Ausstellung oder Dauer über 14 Tage) wird verworfen', async () => {
  const events = await holen([seite1]);
  const titel = events.map((e) => e.title);
  assert.ok(!titel.some((t) => t.includes('KNIPS')), 'Sonderausstellung Sept–Nov');
  assert.ok(!titel.some((t) => t.startsWith('Aufstieg auf den Rathausturm')), 'ganztägiges Dauerangebot');
  assert.ok(!titel.some((t) => t.startsWith('Sabine Wagner')), 'ganztägige Installation');
  assert.ok(titel.includes('Hackday4all Görlitz 2026'));
});

const CARMEN = () => zeile({
  Title: 'Carmen', FormalCategoryName: 'Aufführung', Url: 'https://www.g-h-t.de/spielplan',
  Production1: { DateFromTo: '01. Oktober - 31. Dezember 2026' }, DateTime: '2026-11-08T15:00:00+0100',
});

test('goerlitz: Aufführung mit Uhrzeit bleibt, auch wenn die Spielzeit lang ist', async () => {
  const events = await holen([seiteMit([CARMEN()])]);
  assert.equal(events.length, 1);
  assert.equal(events[0].start, '2026-11-08T15:00:00+01:00');
  assert.equal(events[0].hasTime, true);
  });

test('goerlitz: kurze Ausstellung (höchstens 2 Tage) bleibt als Schau', async () => {
  const events = await holen([seiteMit([zeile({ Title: 'Rassegeflügelschau', FormalCategoryName: 'Ausstellung', Production1: { DateFromTo: '14. November - 15. November 2026' }, DateTime: '2026-11-14T09:00:00+0100' })])]);
  assert.equal(events.length, 1);
  assert.equal(events[0].art, 'schau');
});

test('goerlitz: mehrtägiger Markt bleibt ein Termin mit end nach start', async () => {
  const tage = ['14', '15', '16'].map((t) => zeile({
    Title: 'Töpfermarkt', FormalCategoryName: 'Markt', LocationName: 'Marktplatz Löbau',
    Production1: { DateFromTo: '14. November - 16. November 2026' }, DateTime: `2026-11-${t}T10:00:00+0100`,
  }));
  const events = await holen([seiteMit(tage)]);
  assert.equal(events.length, 1);
  assert.equal(events[0].start, '2026-11-14T10:00:00+01:00');
  assert.equal(events[0].end, '2026-11-16T10:00:00+01:00');
  assert.equal(events[0].art, 'markt');
});

test('goerlitz: Termine mit Uhrzeit 00:00 haben keine Uhrzeit, Zeit-Offset wird korrekt gelesen', async () => {
  const events = await holen([seiteMit([zeile({ Title: 'Weihnachtsmarkt', Production1: { DateFromTo: '08. November 2026' }, DateTime: '2026-11-08T00:00:00+0100' })])]);
  assert.equal(events[0].hasTime, false);
  assert.equal(events[0].start, '2026-11-08T00:00:00+01:00');
});

test('goerlitz: jeder Termin hat sources[0].url mit der Termin-ID, Veranstalterlink als Kontakt', async () => {
  const events = await holen([seite1, seiteMit([CARMEN()])]);
  assert.ok(events.length > 1);
  for (const e of events) assert.match(e.sources[0].url, /^https:\/\/www\.goerlitz\.de\/termine\/detail\/\d+$/);
  const carmen = events.find((e) => e.title === 'Carmen');
  assert.equal(carmen.contact.url, 'https://www.g-h-t.de/spielplan');
  assert.equal(carmen.ticketStatus, null);
});

test('goerlitz: Telefonnummer im Text wird contact.phone', async () => {
  const events = await holen([seiteMit([zeile({ Title: 'Lesung', DescriptionTruncated: 'Anmeldung unter 03581 12345 erbeten.' })])]);
  assert.equal(events[0].contact.phone, '0358112345');
});

test('goerlitz: ausverkauft im Titel wird erkannt', async () => {
  const events = await holen([seiteMit([zeile({ Title: 'Konzert (ausverkauft)', FormalCategoryName: 'Konzert' })])]);
  assert.equal(events[0].ticketStatus, 'ausverkauft');
});

test('goerlitz: ein HTTP-Fehler wird weitergereicht', async () => {
  const kaputt = { get: async () => { throw new Error('HTTP 500'); } };
  await assert.rejects(fetchEvents({ http: kaputt, today: '2026-11-08', config }), /HTTP 500/);
});
