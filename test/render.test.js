import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { renderEventCard, renderDetail, renderStatusFooter, dayLabel, safeHref } from '../site/js/render.js';

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

test('ohne contact und ohne Quelle keine Knöpfe Anrufen/Webseite/E-Mail', () => {
  const karte = renderEventCard(document, ev({ contact: undefined, sources: [] }));
  const texte = knoepfe(karte);
  for (const t of ['Anrufen', 'Zur Webseite', 'E-Mail']) assert.ok(!texte.includes(t), t);
  const leer = renderEventCard(document, ev({ contact: { phone: null, url: null, email: null }, sources: [] }));
  assert.ok(!knoepfe(leer).includes('Anrufen'));
});

test('Zur Webseite zeigt ersatzweise auf die erste Quelle mit sicherem Link, in Karte und Detailfenster', () => {
  const quellen = [{ name: 'Ohne Link', url: null }, { name: 'Böse', url: 'javascript:alert(1)' }, { name: 'Zweite', url: 'https://example.org/e/2' }];
  for (const seite of [renderEventCard(document, ev({ contact: { phone: null, url: null, email: null }, sources: quellen })),
    renderDetail(document, ev({ contact: undefined, sources: quellen }), { orte: [], userAgent: '' })]) {
    assert.equal(hrefVon(seite, 'Zur Webseite'), 'https://example.org/e/2');
    assert.equal(seite.querySelector('.btn.primaer').textContent, 'Zur Webseite');
  }
  const eigene = renderEventCard(document, ev({ contact: { phone: null, url: 'https://veranstalter.example/', email: null }, sources: quellen }));
  assert.equal(hrefVon(eigene, 'Zur Webseite'), 'https://veranstalter.example/', 'eigene Adresse hat Vorrang');
});

test('Knöpfe Anrufen, Zur Webseite und E-Mail erscheinen jeweils nur mit Wert', () => {
  const karte = renderEventCard(document, ev({ contact: { phone: '03591 12345', url: 'https://veranstalter.example/', email: 'info@veranstalter.example' } }));
  assert.ok(knoepfe(karte).includes('Anrufen'));
  assert.equal(hrefVon(karte, 'Zur Webseite'), 'https://veranstalter.example/');
  assert.equal(hrefVon(karte, 'E-Mail'), 'mailto:info@veranstalter.example');
  const nurMail = renderEventCard(document, ev({ contact: { phone: null, url: null, email: 'a@b.de' }, sources: [] }));
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
  assert.equal(hrefVon(karte, 'Zur Webseite'), 'https://example.org/ok', 'unsichere eigene Adresse und unsichere Quelle werden übersprungen');
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

test('Ort ohne Entfernung: kein "null km"; tschechische Termine sind in der ersten Zeile bei der Art gekennzeichnet', () => {
  const karte = renderEventCard(document, ev({ distanceKm: null, placeName: 'Děčín', country: 'CZ' }));
  const ort = karte.querySelector('.where').textContent;
  assert.ok(!/null|NaN/.test(ort), ort);
  assert.ok(ort.startsWith('Děčín'));
  assert.ok(!/Tschechien/.test(ort), 'Land steht oben, nicht in der Ortszeile');
  assert.equal(karte.querySelector('.kartenkopf .art-zeile .land').textContent, 'Tschechien');
  assert.equal(renderEventCard(document, ev()).querySelector('.land'), null);
});

test('Kopfzeile: links Art und Sorte, rechts nur die Gemeinde; unten Spielstätte und Entfernung', () => {
  const orte = ['Pirna', 'Sebnitz'];
  const karte = renderEventCard(document, ev({ placeName: 'Turnhalle, Neustadt in Sachsen', distanceKm: 12.4, genre: 'jazz' }), { orte });
  const kopf = karte.querySelector('.kartenkopf');
  assert.equal(kopf, karte.firstElementChild, 'Kopfzeile steht zuerst');
  assert.equal(kopf.querySelector('.art-zeile').textContent, 'Konzert · Jazz & Blues');
  assert.equal(kopf.querySelector('.ort-rechts').textContent, 'Neustadt in Sachsen');
  assert.equal(karte.querySelector('.where').textContent, 'Turnhalle · 12 km');
  const museum = renderEventCard(document, ev({ placeName: 'Museum Pirna', distanceKm: 20 }), { orte });
  assert.equal(museum.querySelector('.ort-rechts').textContent, 'Pirna');
  assert.equal(museum.querySelector('.where').textContent, 'Museum Pirna · 20 km');
  const unbekannt = renderEventCard(document, ev({ placeName: 'RABRYKA Werk I' }), { orte });
  assert.equal(unbekannt.querySelector('.ort-rechts'), null, 'ohne erkennbare Gemeinde rechts leer');
  const gleich = renderEventCard(document, ev({ placeName: 'Kamenz, Kamenz', distanceKm: 25 }), { orte });
  assert.equal(gleich.querySelector('.where').textContent, '25 km', 'Spielstätte nicht doppelt zur Gemeinde');
});

test('Ticketstatus steht neben der Uhrzeit, nicht in der Kopfzeile', () => {
  const karte = renderEventCard(document, ev({ ticketStatus: 'ausverkauft' }));
  assert.equal(karte.querySelector('.when .status').textContent, 'ausverkauft');
  assert.equal(karte.querySelector('.kartenkopf .status'), null);
});

test('Knöpfe stehen in der Reihenfolge Webseite, Tickets, Anrufen, E-Mail; der erste Webknopf ist der Hauptknopf', () => {
  const alle = renderEventCard(document, ev({ ticketUrl: 'https://tickets.example/', contact: { phone: '03591 12345', url: 'https://veranstalter.example/', email: 'a@b.de' } }));
  assert.deepEqual(knoepfe(alle).filter((t) => t !== 'Alter Schlachthof'), ['Zur Webseite', 'Tickets', 'Anrufen', 'E-Mail']);
  assert.ok(alle.querySelector('.btn.primaer').textContent.includes('Zur Webseite'));
  assert.equal(alle.querySelectorAll('.btn.primaer').length, 1);
  const nurTickets = renderEventCard(document, ev({ ticketUrl: 'https://tickets.example/', contact: { phone: '03591 12345', url: null, email: null }, sources: [] }));
  assert.equal(nurTickets.querySelector('.btn.primaer').textContent, 'Tickets');
  const nurTelefon = renderEventCard(document, ev({ contact: { phone: '03591 12345', url: null, email: null }, sources: [] }));
  assert.equal(nurTelefon.querySelector('.btn.primaer'), null);
});

test('Detailansicht: voller Titel, Zeit, Ort, ganze Beschreibung, Knöpfe, Quelle', () => {
  const lang = 'Ein sehr langer Text. '.repeat(40).trim();
  const d = renderDetail(document, ev({ title: 'Großes Konzert', placeName: 'Turnhalle, Pirna', distanceKm: 20.4, description: lang, ticketStatus: 'verfuegbar', genre: 'jazz', country: 'CZ', ticketUrl: 'https://tickets.example/' }), { orte: ['Pirna'], userAgent: '' });
  assert.equal(d.querySelector('.title').textContent, 'Großes Konzert');
  assert.equal(d.querySelector('.art-zeile').textContent, 'Konzert · Jazz & Blues · Tschechien');
  assert.match(d.querySelector('.when').textContent, /Sa, 14\. Nov\.?.*19:00/);
  assert.equal(d.querySelector('.when .status').textContent, 'Karten verfügbar');
  assert.equal(d.querySelector('.where').textContent, 'Turnhalle · Pirna · 20 km');
  assert.equal(d.querySelector('.desc').textContent, lang, 'Beschreibung ungekürzt');
  assert.equal(hrefVon(d, 'Tickets'), 'https://tickets.example/');
  assert.equal(hrefVon(d, 'Alter Schlachthof'), 'https://example.org/e/1');
});

test('Detailansicht weist bei gekürztem Text als schlichter Text auf die Webseite hin, ohne Link', () => {
  for (const ende of ['…', '...']) {
    const d = renderDetail(document, ev({ description: `Ein Text der abbricht${ende}` }), { orte: [], userAgent: '' });
    const hinweis = d.querySelector('.gekuerzt');
    assert.ok(hinweis, `Hinweis bei Ende ${ende}`);
    assert.equal(hinweis.textContent, 'Text gekürzt – vollständig auf der Webseite.');
    assert.equal(hinweis.querySelector('a'), null, 'kein Link im Hinweis');
  }
});

test('kein Kürzungshinweis bei vollständigem oder fehlendem Text und nie auf der Karte', () => {
  const voll = renderDetail(document, ev({ description: 'Ein vollständiger Satz.' }), { orte: [], userAgent: '' });
  assert.equal(voll.querySelector('.gekuerzt'), null);
  const leer = renderDetail(document, ev({ description: null }), { orte: [], userAgent: '' });
  assert.equal(leer.querySelector('.gekuerzt'), null);
  const karte = renderEventCard(document, ev({ description: 'Abgebrochen…' }));
  assert.equal(karte.querySelector('.gekuerzt'), null);
});

test('Navigationsknopf nur im Detailfenster und nur mit Koordinaten, je nach Gerät', () => {
  const mit = ev({ lat: 51.2701, lon: 14.0949 });
  assert.ok(!knoepfe(renderEventCard(document, mit)).includes('Navigation'), 'nicht auf der Karte');
  const ios = renderDetail(document, mit, { orte: [], userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' });
  assert.equal(hrefVon(ios, 'Navigation'), 'https://maps.apple.com/?daddr=51.2701,14.0949');
  const android = renderDetail(document, mit, { orte: [], userAgent: 'Mozilla/5.0 (Linux; Android 14)' });
  assert.equal(hrefVon(android, 'Navigation'), 'geo:51.2701,14.0949?q=51.2701,14.0949');
  const pc = renderDetail(document, mit, { orte: [], userAgent: 'Mozilla/5.0 (Windows NT 10.0)' });
  assert.equal(hrefVon(pc, 'Navigation'), 'https://www.google.com/maps/dir/?api=1&destination=51.2701,14.0949');
  const ohne = renderDetail(document, ev({ lat: null, lon: null }), { orte: [], userAgent: '' });
  assert.ok(!knoepfe(ohne).includes('Navigation'));
});

test('Detailansicht setzt Fremdtexte nur als Text', () => {
  const boese = '<img src=x onerror=alert(1)>';
  const d = renderDetail(document, ev({ title: boese, description: boese, placeName: `${boese}, ${boese}`, sources: [{ name: boese, url: 'https://example.org/' }] }), { orte: [], userAgent: '' });
  assert.equal(d.querySelectorAll('img').length, 0);
  assert.ok(d.textContent.includes(boese));
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
