import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { name, fetchEvents } from '../src/sources/museendresden.js';

const fx = (datei) => readFileSync(new URL(`./fixtures/${datei}`, import.meta.url), 'utf8');
const URL_LISTE = 'https://museen-dresden.de/?ajax=events&limit=200';
const config = { enabled: true, url: URL_LISTE };
const http = (body) => ({ get: async (url) => { assert.equal(url, URL_LISTE); return { status: 200, body, url }; } });
const holen = (today = '2026-11-25', body = fx('museendresden-ajax-alle.html')) => fetchEvents({ http: http(body), today, config });
const finden = (events, anfang) => events.filter((e) => e.title.startsWith(anfang));

/** Eine Karte im Aufbau der Seite, für Sonderfälle. */
const karte = ({ id = 'abc', datum = 'Do<span class="text--light"> / </span>3. Dez ', zeit = '19:00', haus = 'Stadtmuseum', titel = 'Probe', status = '', extra = '' } = {}) => `
<div class="event-list__event" id="${id}"><div class="event-list__date__container"><div class="event-list__date">${datum}<div class="event-list__time">${zeit}</div><div class="text--small"></div></div>${status ? `<div class="event-list__status-info">${status}</div>` : ''}</div>
<div class="event-list__content"><div class="breadcrumb"><a href="https://stadtmuseum-dresden.de/">${haus}</a><span> > </span><a href="/programm/kalender?category=vortrag">Vortrag</a></div>
<h5 class="event-list__title">${titel}</h5></div>${extra}</div>`;

test('Quellenname ist museendresden', () => {
  assert.equal(name, 'museendresden');
});

test('museendresden: ein Abruf liefert alle kommenden Termine, mehrere Uhrzeiten werden einzelne Termine', async () => {
  const events = await holen();
  assert.equal(events.length, 76); // 72 Karten, davon drei mit mehreren Uhrzeiten (+4)
  assert.equal(new Set(events.map((e) => e.id)).size, 76);
  assert.equal(finden(events, 'Musikalische Schlittenfahrt').length, 3);
  assert.deepEqual(finden(events, 'Torah und Judentum').map((e) => e.start.slice(0, 16)), ['2026-12-05T11:00', '2026-12-05T14:00', '2026-12-19T11:00', '2026-12-19T14:00']);
});

test('museendresden: Datum und Uhrzeit zur Berliner Zeit, auch einstellige Stunde und Jahreswechsel', async () => {
  const events = await holen();
  const lesung = finden(events, 'Marcel Beyer')[0];
  assert.equal(lesung.start, '2026-12-03T19:00:00+01:00');
  assert.equal(lesung.hasTime, true);
  assert.equal(lesung.end, null);
  assert.equal(finden(events, 'Dialoge zwischen Kunst')[0].start, '2026-11-25T09:00:00+01:00');
  assert.equal(finden(events, 'Friedrich Hoffmann')[0].start, '2027-01-20T18:00:00+01:00'); // "20. Jan 27"
});

test('museendresden: ohne Jahr gilt das nächste Vorkommen ab heute', async () => {
  const body = `<div>${karte({ datum: 'Mo<span> / </span>4. Jan ' })}${karte({ id: 'x', datum: 'Mi<span> / </span>30. Dez ' })}</div>`;
  const events = await holen('2026-12-30', body);
  assert.deepEqual(events.map((e) => e.start.slice(0, 10)).sort(), ['2026-12-30', '2027-01-04']);
});

test('museendresden: Ort kommt vom Kartenlink, ohne Postleitzahl und mit ", Dresden"', async () => {
  const events = await holen();
  assert.equal(finden(events, 'Marcel Beyer')[0].placeName, 'Stadtmuseum, Dresden');
  assert.equal(finden(events, 'Papierschaltkreise und Ornamentstempel')[0].placeName, 'Striezelmarkt, Dresden');
  assert.equal(finden(events, 'Torah und Judentum')[0].placeName, 'Synagoge der Jüdischen Kultusgemeinde, Dresden');
  assert.equal(finden(events, 'Digitale Bildkulturen')[0].placeName, 'Vortragssaal der Hochschule für Bildende Künste Dresden, Güntzstrasse 34, Dresden');
  assert.ok(events.every((e) => e.placeName.endsWith(', Dresden') && !/\d{5}/.test(e.placeName)));
});

test('museendresden: ohne Kartenlink gilt der Name des Hauses', async () => {
  const [e] = await holen('2026-11-25', `<div>${karte({ haus: 'Kunsthaus' })}</div>`);
  assert.equal(e.placeName, 'Kunsthaus, Dresden');
});

test('museendresden: Link zur Veranstaltung auf der Seite des Hauses, nie ein Bild oder Fremdtext', async () => {
  const events = await holen();
  const lesung = finden(events, 'Marcel Beyer')[0];
  assert.equal(lesung.sources[0].name, 'Museen der Stadt Dresden');
  assert.equal(lesung.sources[0].url, 'https://stadtmuseum-dresden.de/programm/kalender/marcel-beyer');
  assert.equal(lesung.contact.url, lesung.sources[0].url);
  // "Mehr erfahren" hat Vorrang vor der Adresse des iCal-Eintrags
  assert.equal(finden(events, 'Ute Mahler')[0].sources[0].url, 'https://leonhardi-museum.de/programm/kalender/uta-mahler-1');
  assert.ok(events.every((e) => /^https:\/\/[\w.-]+\/programm\/kalender\/[\w-]+$/.test(e.sources[0].url)));
  assert.ok(events.every((e) => e.ticketUrl === null && e.lat === null));
});

test('museendresden: Beschreibung ist nur die Zeile unter dem Titel', async () => {
  const events = await holen();
  assert.equal(finden(events, 'Marcel Beyer')[0].description, 'Lesereihe »Schreibspuren«');
  assert.ok(events.every((e) => e.description === null || e.description.length <= 160));
});

test('museendresden: Art aus Kategorie und Titel; Führungen und Workshops bleiben sonstiges, Vernissage ist Schau', async () => {
  const events = await holen();
  assert.equal(finden(events, 'Musikalische Schlittenfahrt')[0].art, 'konzert');
  assert.equal(finden(events, 'Podium der Liedklasse')[0].art, 'konzert');
  assert.equal(finden(events, 'Marcel Beyer')[0].art, 'sonstiges');
  assert.equal(finden(events, 'Powered by Painting')[0].art, 'sonstiges');
  assert.equal(finden(events, 'Ute Mahler')[0].art, 'schau');
});

test('museendresden: "Ausgebucht" wird ausverkauft, "Mit Anmeldung" sagt nichts über den Kartenstand', async () => {
  const events = await holen();
  assert.equal(finden(events, '»Ludwig Richter in Civitella«')[0].ticketStatus, 'ausverkauft');
  assert.equal(finden(events, 'Powered by Painting')[0].ticketStatus, null);
  assert.equal(finden(events, 'Marcel Beyer')[0].ticketStatus, null);
});

test('museendresden: Termine ohne Uhrzeit sind ganztägig', async () => {
  const [e] = await holen('2026-11-25', `<div>${karte({ zeit: '' })}</div>`);
  assert.equal(e.hasTime, false);
  assert.equal(e.start, '2026-12-03T00:00:00+01:00');
});

test('museendresden: Termine mit Jahr aus der Vergangenheit fallen heraus, heutige bleiben', async () => {
  const body = `<div>${karte({ id: 'alt', datum: 'Mi<span> / </span>3. Dez 25' })}${karte({ id: 'heute', datum: 'Do<span> / </span>3. Dez 26' })}${karte({ id: 'spaeter', datum: 'Fr<span> / </span>4. Dez 26' })}</div>`;
  const events = await holen('2026-12-03', body);
  assert.deepEqual(events.map((e) => e.start.slice(0, 10)), ['2026-12-03', '2026-12-04']);
});

test('museendresden: Seite ohne Termine ist ein Fehler', async () => {
  await assert.rejects(() => holen('2026-11-25', '<div class="event-list__container"></div>'), /keine Termine/);
});
