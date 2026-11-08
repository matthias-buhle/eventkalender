import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { renderEventCard, renderStatusFooter, dayLabel, safeHref } from '../site/js/render.js';

const { document } = parseHTML('<!doctype html><html><body></body></html>');
const ev = (extra = {}) => ({
  id: 'x', title: 'Dudelsack-Konzert', art: 'konzert', tags: [], start: '2026-11-14T19:00:00+01:00', end: null, hasTime: true,
  placeName: 'Pirna', distanceKm: 20.4, country: 'DE',
  sources: [{ name: 'Alter Schlachthof', url: 'https://example.org/e/1' }],
  contact: { phone: null, url: null, email: null }, ticketUrl: null, ticketStatus: null,
  description: null, needsReview: false, submittedBy: null, ...extra,
});
const knoepfe = (karte) => [...karte.querySelectorAll('a')].map((a) => a.textContent.trim());
const hrefVon = (karte, text) => [...karte.querySelectorAll('a')].find((a) => a.textContent.trim() === text)?.getAttribute('href');

test("Titel '<img src=x onerror=alert(1)>' wird als Text dargestellt, kein img-Element in der Karte", () => {
  const boese = '<img src=x onerror=alert(1)>';
  const karte = renderEventCard(document, ev({ title: boese, description: boese, placeName: boese, sources: [{ name: boese, url: 'https://example.org/' }] }));
  assert.equal(karte.querySelectorAll('img').length, 0);
  assert.ok(karte.textContent.includes(boese));
  assert.equal(karte.querySelector('h3').textContent, boese);
  assert.ok(!karte.outerHTML.includes('<img'));
});

test('ohne contact keine Knöpfe Anrufen/Webseite/E-Mail', () => {
  const karte = renderEventCard(document, ev({ contact: undefined }));
  const texte = knoepfe(karte);
  for (const t of ['Anrufen', 'Zur Webseite', 'E-Mail']) assert.ok(!texte.includes(t), t);
  const leer = renderEventCard(document, ev({ contact: { phone: null, url: null, email: null } }));
  assert.ok(!knoepfe(leer).includes('Anrufen'));
});

test('Knöpfe Anrufen, Zur Webseite und E-Mail erscheinen jeweils nur mit Wert', () => {
  const karte = renderEventCard(document, ev({ contact: { phone: '03591 12345', url: 'https://veranstalter.example/', email: 'info@veranstalter.example' } }));
  assert.ok(knoepfe(karte).includes('Anrufen'));
  assert.equal(hrefVon(karte, 'Zur Webseite'), 'https://veranstalter.example/');
  assert.equal(hrefVon(karte, 'E-Mail'), 'mailto:info@veranstalter.example');
  const nurMail = renderEventCard(document, ev({ contact: { phone: null, url: null, email: 'a@b.de' } }));
  assert.deepEqual(knoepfe(nurMail).filter((t) => ['Anrufen', 'Zur Webseite', 'E-Mail'].includes(t)), ['E-Mail']);
});

test('tel:-Link enthält nur Ziffern und +', () => {
  const karte = renderEventCard(document, ev({ contact: { phone: '+49 (0)3591 / 12-345 "x', url: null, email: null } }));
  assert.equal(hrefVon(karte, 'Anrufen'), 'tel:+4903591' + '12345');
});

test('Linkziele mit javascript: werden nicht als Link ausgegeben', () => {
  const karte = renderEventCard(document, ev({
    contact: { phone: null, url: 'javascript:alert(1)', email: null },
    ticketUrl: 'JavaScript:alert(2)',
    sources: [{ name: 'Böse Quelle', url: 'javascript:alert(3)' }, { name: 'Gute Quelle', url: 'https://example.org/ok' }],
  }));
  const ziele = [...karte.querySelectorAll('a')].map((a) => a.getAttribute('href'));
  assert.ok(ziele.length > 0);
  assert.ok(ziele.every((h) => /^(https?:|tel:|mailto:)/i.test(h)), ziele.join(', '));
  assert.ok(!knoepfe(karte).includes('Zur Webseite'));
  assert.ok(karte.textContent.includes('Böse Quelle'), 'Quellenname bleibt als Text sichtbar');
  assert.equal(safeHref('  javascript:alert(1)'), null);
  assert.equal(safeHref('data:text/html,x'), null);
  assert.equal(safeHref('https://example.org/'), 'https://example.org/');
});

test('E-Mail-Knopf nur bei plausibler Adresse', () => {
  const karte = renderEventCard(document, ev({ contact: { phone: null, url: null, email: '"><script>@x' } }));
  assert.ok(!knoepfe(karte).includes('E-Mail'));
});

test('ticketStatus null zeigt keine Status-Marke', () => {
  const karte = renderEventCard(document, ev({ ticketStatus: null }));
  assert.equal(karte.querySelector('.status'), null);
});

test("ticketStatus 'verfuegbar' zeigt 'Karten verfügbar', 'ausverkauft' zeigt 'ausverkauft'", () => {
  assert.equal(renderEventCard(document, ev({ ticketStatus: 'verfuegbar' })).querySelector('.status').textContent, 'Karten verfügbar');
  assert.equal(renderEventCard(document, ev({ ticketStatus: 'ausverkauft' })).querySelector('.status').textContent, 'ausverkauft');
  assert.equal(renderEventCard(document, ev({ ticketStatus: 'abgesagt' })).querySelector('.status').textContent, 'abgesagt');
  assert.equal(renderEventCard(document, ev({ ticketStatus: 'verlegt' })).querySelector('.status').textContent, 'verlegt');
});

test('Karte zeigt Art, Datum mit Uhrzeit, Ort mit Entfernung und Quellenlink', () => {
  const karte = renderEventCard(document, ev());
  assert.equal(karte.querySelector('.art').textContent, 'Konzert');
  assert.match(karte.querySelector('.when').textContent, /Sa, 14\. Nov\.?.*19:00/);
  assert.equal(karte.querySelector('.where').textContent, 'Pirna · 20 km');
  assert.equal(hrefVon(karte, 'Alter Schlachthof'), 'https://example.org/e/1');
});

test('Ort ohne Entfernung: kein "null km"; tschechische Termine sind gekennzeichnet', () => {
  const karte = renderEventCard(document, ev({ distanceKm: null, placeName: 'Děčín', country: 'CZ' }));
  const ort = karte.querySelector('.where').textContent;
  assert.ok(!/null|NaN/.test(ort), ort);
  assert.ok(ort.startsWith('Děčín'));
  assert.match(ort, /Tschechien/);
});

test('Termin ohne Uhrzeit zeigt keine 00:00; mehrtägiger Termin zeigt Start und Ende', () => {
  const ohne = renderEventCard(document, ev({ hasTime: false, start: '2026-11-14T00:00:00+01:00' }));
  assert.ok(!ohne.querySelector('.when').textContent.includes('00:00'));
  const mehr = renderEventCard(document, ev({ hasTime: false, start: '2026-11-14T00:00:00+01:00', end: '2026-11-15T00:00:00+01:00' }));
  assert.match(mehr.querySelector('.when').textContent, /14\. Nov.*15\. Nov/);
  const bis = renderEventCard(document, ev({ end: '2026-11-14T22:30:00+01:00' }));
  assert.match(bis.querySelector('.when').textContent, /19:00.*22:30/);
});

test("needsReview zeigt 'bitte prüfen', sonst nicht", () => {
  assert.match(renderEventCard(document, ev({ needsReview: true })).textContent, /bitte prüfen/);
  assert.ok(!/bitte prüfen/.test(renderEventCard(document, ev()).textContent));
});

test('Ticketlink wird als Knopf Tickets gezeigt, ohne Statusbehauptung', () => {
  const karte = renderEventCard(document, ev({ ticketUrl: 'https://www.reservix.de/x' }));
  assert.equal(hrefVon(karte, 'Tickets'), 'https://www.reservix.de/x');
  assert.equal(karte.querySelector('.status'), null);
});

test('dayLabel nennt Heute und Morgen, sonst Wochentag und Datum', () => {
  assert.equal(dayLabel('2026-11-08', '2026-11-08'), 'Heute');
  assert.equal(dayLabel('2026-11-09', '2026-11-08'), 'Morgen');
  assert.equal(dayLabel('2026-11-14', '2026-11-08'), 'Samstag, 14. November');
});

test('Fußzeile nennt nur ausgefallene Quellen mit Datum; bei lauter ok keine Warnung', () => {
  const fuss = renderStatusFooter(document, [
    { name: 'aust', ok: true, count: 12, error: null, lastOkAt: '2026-11-08T05:00:00.000Z' },
    { name: 'goerlitz', ok: false, count: 0, error: 'HTTP 500', lastOkAt: '2026-11-05T05:00:00.000Z' },
    { name: 'goout', ok: false, count: 0, error: 'x', lastOkAt: null },
  ]);
  assert.match(fuss.textContent, /Quelle goerlitz seit 05\.11\.2026 ohne Daten/);
  assert.match(fuss.textContent, /Quelle goout seit unbekannt ohne Daten/);
  assert.ok(!fuss.textContent.includes('aust'));
  const gut = renderStatusFooter(document, [{ name: 'aust', ok: true, count: 1, error: null, lastOkAt: '2026-11-08T05:00:00.000Z' }]);
  assert.ok(!/ohne Daten/.test(gut.textContent));
});

test('Fußzeile setzt Quellennamen als Text, nicht als HTML', () => {
  const fuss = renderStatusFooter(document, [{ name: '<b>x</b>', ok: false, count: 0, error: 'e', lastOkAt: null }]);
  assert.equal(fuss.querySelectorAll('b').length, 0);
  assert.ok(fuss.textContent.includes('<b>x</b>'));
});

test('Karte nennt Genre bzw. Sorte hinter der Art, aber nur bei Konzert, Markt und Schau; sonst kein Zusatz', () => {
  const label = (extra) => renderEventCard(document, ev(extra)).querySelector('.genre')?.textContent ?? null;
  assert.equal(label({ genre: 'rock-pop' }), 'Rock & Pop');
  assert.equal(label({ art: 'markt', genre: 'weihnachtsmarkt' }), 'Weihnachtsmarkt');
  assert.equal(label({ art: 'markt', genre: 'troedel' }), 'Flohmarkt & Trödel');
  assert.equal(label({ art: 'schau', genre: 'tiere' }), 'Tier- & Zuchtschau');
  assert.equal(label({ art: 'sonstiges', genre: 'comedy' }), null, 'Genres nur bei Konzerten');
  assert.equal(label({ art: 'markt', genre: 'jazz' }), null, 'Genre einer anderen Art');
  assert.equal(label({ genre: null }), null);
  assert.equal(label({ genre: '<b>x</b>' }), null);
  assert.equal(label({}), null, 'ältere Daten ohne genre');
});
