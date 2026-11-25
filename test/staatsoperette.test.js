import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { name, fetchEvents } from '../src/sources/staatsoperette.js';

const fx = () => JSON.parse(readFileSync(new URL('./fixtures/staatsoperette-events.json', import.meta.url), 'utf8'));
const URL_JSON = 'https://www.staatsoperette.de/data-exports/events.json';
const config = { enabled: true, url: URL_JSON };
const http = (body) => ({ get: async (url, opts) => { assert.equal(url, URL_JSON); assert.equal(opts.as, 'json'); return { status: 200, body, url }; } });
const holen = (today = '2026-11-25', body = fx()) => fetchEvents({ http: http(body), today, config });
const finden = (events, anfang) => events.filter((e) => e.title.startsWith(anfang));

const produktion = (titel, termine, rest = {}) => ({
  id: 1,
  title: titel,
  description: 'Ein Text.',
  event_dates: termine.map(([start_date, end_date = null]) => ({ start_date, end_date })),
  location: { title: 'Staatsoperette Saal', address: 'Kraftwerk Mitte 1', zip: '01067', city: 'Dresden', country: 'Deutschland' },
  categories: 'Operette',
  event_link: [{ title: titel, href: 'https://www.staatsoperette.de/spielplan/a-z/x/' }],
  ticket_link: { title: titel, href: 'https://www.staatsoperette.de/spielplan/a-z/x/' },
  ...rest,
});

test('Quellenname ist staatsoperette', () => {
  assert.equal(name, 'staatsoperette');
});

test('staatsoperette: jeder Termin einer Produktion wird ein eigenes Event', async () => {
  const events = await holen();
  assert.equal(events.length, 90); // 12 Produktionen im Fixture, 90 Termine ab 25.11.2026
  const alice = finden(events, 'Alice');
  assert.equal(alice.length, 12);
  assert.equal(new Set(alice.map((e) => e.id)).size, 12);
});

test('staatsoperette: Zeiten ohne Zone sind Berliner Zeit (Winterzeit +01:00, Sommerzeit +02:00)', async () => {
  const erste = finden(await holen(), 'Alice')[0];
  assert.equal(erste.start, '2026-11-28T19:30:00+01:00');
  assert.equal(erste.end, '2026-11-28T21:45:00+01:00');
  assert.equal(erste.hasTime, true);
  const sommer = (await holen('2026-06-01', { events: [produktion('Sommerabend', [['2026-07-04T19:30:00', '2026-07-04T22:00:00']])] }))[0];
  assert.equal(sommer.start, '2026-07-04T19:30:00+02:00');
});

test('staatsoperette: fehlendes Ende (null) bleibt offen, ein Ende vor dem Anfang auch', async () => {
  const events = await holen();
  assert.equal(finden(events, 'poesie')[0].end, null);
  const e = (await holen('2026-11-25', [produktion('Komisch', [['2026-12-01T19:30:00', '2026-12-01T19:00:00']])]))[0];
  assert.equal(e.end, null);
});

test('staatsoperette: Termin ohne Uhrzeit hat hasTime false und kein Ende', async () => {
  const e = (await holen('2026-11-25', [produktion('Ganztags', [['2026-12-01', '2026-12-01']])]))[0];
  assert.equal(e.start, '2026-12-01T00:00:00+01:00');
  assert.equal(e.hasTime, false);
  assert.equal(e.end, null);
});

test('staatsoperette: Haus im Kraftwerk Mitte ist ein Ort, Gastspielort behält seinen Namen; keine Koordinaten', async () => {
  const events = await holen();
  for (const t of ['Alice', 'Green-Box', 'Theaterführung', 'Karaoke']) {
    assert.equal(finden(events, t)[0].placeName, 'Staatsoperette Dresden, Dresden', t); // Saal, Kranfoyer, Foyer
  }
  const psycho = finden(events, 'alfred')[0];
  assert.equal(psycho.placeName, 'Großer Saal Hellerau, Dresden');
  assert.ok(events.every((e) => e.lat === null && e.lon === null && e.country === 'DE'));
});

test('staatsoperette: Quellenlink, Kontakt und Kartenlink zeigen auf die Spielplanseite', async () => {
  const alice = finden(await holen(), 'Alice')[0];
  assert.equal(alice.sources[0].name, 'Staatsoperette Dresden');
  assert.equal(alice.sources[0].url, 'https://www.staatsoperette.de/spielplan/a-z/alice-im-wunderland/');
  assert.equal(alice.contact.url, alice.sources[0].url);
  assert.equal(alice.ticketUrl, 'https://www.staatsoperette.de/spielplan/a-z/alice-im-wunderland/');
});

test('staatsoperette: Art aus Kategorie und Titel; Operette, Musical und Tanz sind (noch) sonstiges', async () => {
  const events = await holen();
  assert.equal(finden(events, 'Green-Box')[0].art, 'konzert'); // Kategorie "Special", Titel nennt Konzert
  assert.equal(finden(events, 'poesie')[0].art, 'konzert'); // Kategorie "Konzert"
  assert.equal(finden(events, 'Die lustige Witwe')[0].art, 'sonstiges');
  assert.equal(finden(events, 'Evita')[0].art, 'sonstiges');
  assert.equal(finden(events, 'Alice')[0].art, 'sonstiges');
});

test('staatsoperette: Beschreibung ist auf rund 300 Zeichen gekürzt, ohne Bilder; Platzhaltertext fällt weg', async () => {
  const events = await holen();
  const alice = finden(events, 'Alice')[0];
  assert.ok(alice.description.length <= 300 && alice.description.endsWith('…'));
  assert.ok(alice.description.startsWith('Alice, das mutige kleine Mädchen'));
  assert.ok(!alice.description.includes('\r') && !alice.description.includes('  '));
  assert.equal(finden(events, 'Kulturfrühstück')[0].description, null); // "Weitere Informationen folgen in Kürze."
  assert.ok(events.every((e) => !('image' in e) && !JSON.stringify(e).includes('kxcdn.com')));
});

test('staatsoperette: ohne Statusfeld bleibt ticketStatus leer, Stichwörter im Titel werden erkannt', async () => {
  const events = await holen();
  assert.ok(events.every((e) => e.ticketStatus === null));
  const abgesagt = (await holen('2026-11-25', [produktion('Gala (abgesagt)', [['2026-12-01T19:30:00']])]))[0];
  assert.equal(abgesagt.ticketStatus, 'abgesagt');
});

test('staatsoperette: vergangene Termine fallen heraus, der heutige Tag bleibt', async () => {
  const events = await holen('2026-12-04');
  assert.ok(events.every((e) => e.start.slice(0, 10) >= '2026-12-04'));
  assert.equal(finden(events, 'Alice').length, 8); // 28.11., 29.11., 01.12. und 02.12. sind vorbei
  assert.ok(finden(events, 'Evita').some((e) => e.start.startsWith('2026-12-04')));
  assert.equal((await holen('2028-01-01')).length, 0);
});

test('staatsoperette: auch eine Antwort als Objekt mit events wird gelesen; kaputte Einträge werden übersprungen', async () => {
  const body = { events: [produktion('Gut', [['2026-12-01T19:30:00']]), { title: '', event_dates: [] }, { title: 'Ohne Termine' }, null] };
  const events = await holen('2026-11-25', body);
  assert.deepEqual(events.map((e) => e.title), ['Gut']);
});

test('staatsoperette: unerwartete Antwort ist ein Fehler', async () => {
  await assert.rejects(() => holen('2026-11-25', { fehler: 'x' }), /keine Liste/);
});
