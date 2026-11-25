import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { name, fetchEvents } from '../src/sources/herkuleskeule.js';

const fx = (datei) => readFileSync(new URL(`./fixtures/${datei}`, import.meta.url), 'utf8');
const URL_LISTE = 'https://www.herkuleskeule.de/spielplan-und-tickets';
const config = { enabled: true, url: URL_LISTE };
const http = (body) => ({ get: async (url) => { assert.equal(url, URL_LISTE); return { status: 200, body, url }; } });
const holen = (today = '2026-11-25', body = fx('herkuleskeule-spielplan.html'), extra = {}) =>
  fetchEvents({ http: http(body), today, config: { ...config, ...extra } });
const finden = (events, anfang, start) => events.find((e) => e.title.startsWith(anfang) && (!start || e.start.startsWith(start)));

/** Ein Eintrag der Terminliste im Aufbau der Seite, mit Beschreibung und Bild, damit der Test sieht, dass sie ungelesen bleiben. */
const eintrag = ({ tag = 30, monat = 'November', jahr = 2026, uhr = '19:30 Uhr', titel = 'Probe', ticket = '<a href="https://tickets.example/1" class="lq-btn">TICKETS</a>' } = {}) => `
<div class="event-list-item type1"><div class="content"><a href="/produktion/probe" title="...mehr zu ${titel}">
<div class="wrapper-date invisible-phone"><div class="date"><div class="date-day">${tag}</div><div class="date-month">${monat}</div><div class="date-year">${jahr}</div></div></div>
<div class="wrapper-time invisible-phone"><div class="time"><div class="time-weekday">Montag</div><div class="time-time">${uhr}</div></div></div>
<div class="wrapper-image"><div class="image"><img src="data/img/x.jpg" alt="${titel}"></div></div>
<div class="wrapper-title"><div class="title"><div class="title">${titel}</div><div class="sub-title">Langer Werbetext über das Programm.</div></div></div></a>
<div class="wrapper-ticket"><div class="ticket">${ticket}</div></div></div></div>`;
const seite = (...eintraege) => `<html><body><div id="event-list">${eintraege.join('')}</div></body></html>`;

test('Quellenname ist herkuleskeule', () => {
  assert.equal(name, 'herkuleskeule');
});

test('herkuleskeule: Titel, Beginn zur Berliner Zeit, Ort und Link zur Veranstaltung', async () => {
  const e = finden(await holen(), 'Keule 65', '2026-11-26');
  assert.equal(e.title, 'Keule 65: Ziemlich beste Lieder - aus 65 Jahren Herkuleskeule');
  assert.equal(e.start, '2026-11-26T19:30:00+01:00');
  assert.equal(e.end, null);
  assert.equal(e.hasTime, true);
  assert.equal(e.placeName, 'Herkuleskeule, Dresden');
  assert.equal(e.country, 'DE');
  assert.equal(e.sources[0].name, 'Herkuleskeule Dresden');
  assert.equal(e.sources[0].url, 'https://www.herkuleskeule.de/produktion/ziemlich-beste-lieder-aus-65-jahren-herkuleskeule');
  assert.equal(e.contact.url, e.sources[0].url);
  assert.equal(e.ticketUrl, 'https://herkuleskeule.reservix.de/p/reservix/event/2558295');
  assert.equal(e.ticketStatus, null);
});

test('herkuleskeule: keine Beschreibung, kein Untertitel, kein Bild (nur verweisen, nicht übernehmen)', async () => {
  const events = await holen();
  assert.ok(events.length > 10);
  for (const e of events) {
    assert.equal(e.description, null);
    assert.equal(e.lizenz, null);
    assert.ok(!JSON.stringify(e).match(/jpg|Feuerwerk musikalischer/i));
  }
});

test('herkuleskeule: mehrere Abende derselben Veranstaltung bleiben getrennte Termine mit eigener id', async () => {
  const events = await holen();
  const keule = events.filter((e) => e.title.startsWith('Keule 65'));
  assert.equal(keule.length, 2);
  assert.notEqual(keule[0].id, keule[1].id);
  assert.equal(keule[0].sources[0].url, keule[1].sources[0].url);
  const zwei = events.filter((e) => e.title === '9m² - 800 kalt');
  assert.deepEqual(zwei.map((e) => e.start), ['2026-11-28T17:00:00+01:00', '2026-11-28T20:00:00+01:00']);
});

test('herkuleskeule: Sommerzeit ergibt den Offset +02:00', async () => {
  const e = finden(await holen('2027-04-01', undefined, { horizonDays: 1000 }), 'Leise flehen', '2027-04-11');
  assert.equal(e.start, '2027-04-11T11:00:00+02:00');
});

test('herkuleskeule: nur Termine von heute bis 120 Tage voraus; der 120. Tag zählt noch', async () => {
  const events = await holen('2026-11-25');
  const tage = events.map((e) => e.start.slice(0, 10));
  assert.equal(tage[0], '2026-11-26');
  assert.equal(tage.at(-1), '2027-03-25'); // 25.11.2026 + 120 Tage
  assert.ok(tage.every((t) => t >= '2026-11-25' && t <= '2027-03-25'));
  assert.equal(finden(events, 'Tunnel in Sicht', '2027-03-26'), undefined);
  assert.equal(finden(events, 'Nur die Harten'), undefined);
});

test('herkuleskeule: horizonDays in der Konfiguration ändert das Fenster', async () => {
  const kurz = await holen('2026-11-25', undefined, { horizonDays: 7 });
  assert.ok(kurz.length > 0 && kurz.every((e) => e.start.slice(0, 10) <= '2026-12-02'));
  const lang = await holen('2026-11-25', undefined, { horizonDays: 1000 });
  assert.equal(lang.length, 22); // alle Einträge der Fixture
  assert.equal(lang.at(-1).start.slice(0, 10), '2028-05-03');
});

test('herkuleskeule: vergangene Termine fallen heraus, heute zählt', async () => {
  const events = await holen('2026-11-28', undefined, { horizonDays: 2 });
  assert.equal(events.length, 4);
  assert.ok(events.every((e) => e.start >= '2026-11-28'));
  assert.equal(finden(events, 'Keule 65'), undefined);
});

test('herkuleskeule: AUSVERKAUFT ohne Ticketlink wird ausverkauft', async () => {
  const events = await holen('2026-12-10', undefined, { horizonDays: 30 });
  const lisa = finden(events, 'Lisa Fitz', '2026-12-16');
  assert.equal(lisa.ticketStatus, 'ausverkauft');
  assert.equal(lisa.ticketUrl, null);
  const silvester = events.filter((e) => e.title === 'Generation XY ungelöst');
  assert.equal(silvester.length, 2);
  assert.ok(silvester.every((e) => e.ticketStatus === 'ausverkauft'));
});

test('herkuleskeule: RESTKARTEN, "keine Tickets hier" und "VVK-Start" schließen nichts', async () => {
  const events = await holen('2026-11-25', undefined, { horizonDays: 1000 });
  const rest = finden(events, '9m²');
  assert.equal(rest.ticketStatus, null);
  assert.ok(rest.ticketUrl);
  const tunnel = finden(events, 'Tunnel in Sicht', '2027-03-05');
  assert.equal(tunnel.ticketStatus, null); // "Hier keine Tickets verfügbar" neben dem Ticketknopf: unklar, also nichts behaupten
  assert.ok(tunnel.ticketUrl);
  const distel = finden(events, 'DISTEL', '2027-11-29');
  assert.equal(distel.ticketStatus, null); // Vorverkauf beginnt erst
});

test('herkuleskeule: Kabarett ist immer sonstiges, auch bei "Fest ohne Ausweg"; Unterpunkt-Hinweis kabarett', async () => {
  const events = await holen('2026-11-25', undefined, { horizonDays: 1000 });
  assert.ok(events.every((e) => e.art === 'sonstiges' && e.genre === 'kabarett'));
  assert.equal(finden(events, 'Lisa Fitz').art, 'sonstiges');
});

test('herkuleskeule: ausverkauft aus dem Ticketkasten, nicht aus dem Titel', async () => {
  const [e] = await holen('2026-11-25', seite(eintrag({ titel: 'Die ausverkauft-Revue' })));
  assert.equal(e.ticketStatus, null);
  const [a] = await holen('2026-11-25', seite(eintrag({ ticket: '<div>AUSVERKAUFT</div><div class="statusinfo">Hier keine Tickets verfügbar</div>' })));
  assert.equal(a.ticketStatus, 'ausverkauft');
});

test('herkuleskeule: abgesagt nur, wenn der Ticketkasten es klar zeigt', async () => {
  const [a] = await holen('2026-11-25', seite(eintrag({ ticket: '<div>ABGESAGT</div>' })));
  assert.equal(a.ticketStatus, 'abgesagt');
});

test('herkuleskeule: relative Links werden absolut; Eintrag ohne Uhrzeit hat hasTime false', async () => {
  const [e] = await holen('2026-11-25', seite(eintrag({ uhr: '' })));
  assert.equal(e.sources[0].url, 'https://www.herkuleskeule.de/produktion/probe');
  assert.equal(e.hasTime, false);
  assert.equal(e.start, '2026-11-30T00:00:00+01:00');
});

test('herkuleskeule: Monatsnamen mit Umlaut (März) werden gelesen', async () => {
  const [e] = await holen('2027-03-01', seite(eintrag({ tag: 5, monat: 'März', jahr: 2027, uhr: '9:05 Uhr' })));
  assert.equal(e.start, '2027-03-05T09:05:00+01:00');
});

test('herkuleskeule: derselbe Eintrag zweimal in der Liste erscheint nur einmal', async () => {
  const events = await holen('2026-11-25', seite(eintrag(), eintrag()));
  assert.equal(events.length, 1);
});

test('herkuleskeule: Seite ohne Terminliste ist ein Fehler', async () => {
  await assert.rejects(() => holen('2026-11-25', '<html><body>leer</body></html>'), /keine Termine/);
});

test('herkuleskeule: Einträge, aus denen nichts lesbar ist, sind ein Fehler', async () => {
  await assert.rejects(() => holen('2026-11-25', seite('<div class="event-list-item"><div class="content"></div></div>')), /kein Eintrag/);
});
