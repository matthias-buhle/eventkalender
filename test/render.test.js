import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { renderEventCard, renderDetail, renderStatusFooter, dayLabel, safeHref } from '../site/js/render.js';
import { tagPlus } from '../site/js/filter.js';

const { document } = parseHTML('<!doctype html><html><body></body></html>');
const ev = (extra = {}) => ({
  id: 'x', title: 'Dudelsack-Konzert', art: 'konzert', tags: [], start: '2026-11-14T19:00:00+01:00', end: null, hasTime: true,
  placeName: 'Pirna', distanceKm: 20.4, lat: 50.96, lon: 13.94, country: 'DE',
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

test('Fußzeile: bei übernommenen Terminen steht, dass die Termine vom letzten Abruf stammen', () => {
  const fuss = renderStatusFooter(document, [
    { name: 'goerlitz', ok: false, count: 316, error: 'HTTP 500', lastOkAt: '2026-11-05T05:00:00.000Z', uebernommen: true },
    { name: 'goout', ok: false, count: 0, error: 'x', lastOkAt: null },
  ]);
  assert.match(fuss.textContent, /Quelle goerlitz seit 05\.11\.2026 nicht erreichbar, gezeigt werden die Termine vom letzten Abruf/);
  assert.match(fuss.textContent, /Quelle goout seit unbekannt ohne Daten/);
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

const lizenzBsp = (extra = {}) => ({ name: 'CC BY-SA 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/deed.de', urheber: 'Touristinformation Sebnitz', ...extra });
const detail = (e) => renderDetail(document, e, { orte: [], userAgent: '' });

test('Detailfenster zeigt Lizenz und Urheber', () => {
  const d = detail(ev({ lizenz: lizenzBsp() }));
  const p = d.querySelector('p.lizenz');
  assert.ok(p);
  assert.equal(p.textContent, 'Lizenz: CC BY-SA 4.0 · Urheber: Touristinformation Sebnitz');
  const a = p.querySelector('a');
  assert.equal(a.textContent, 'CC BY-SA 4.0');
  assert.equal(a.getAttribute('href'), 'https://creativecommons.org/licenses/by-sa/4.0/deed.de');
  assert.equal(a.getAttribute('rel'), 'noopener noreferrer');
  assert.equal(a.getAttribute('target'), '_blank');
  const quelle = d.querySelector('p.sources');
  assert.equal(quelle.nextSibling, p, 'direkt nach der Quellenzeile');
});

test('Lizenz ohne Urheber zeigt nur den Lizenznamen', () => {
  const p = detail(ev({ lizenz: lizenzBsp({ name: 'CC0 1.0', urheber: null }) })).querySelector('p.lizenz');
  assert.equal(p.textContent, 'Lizenz: CC0 1.0');
});

test('Karte ohne Lizenz und Detailfenster ohne Lizenz haben keinen Lizenz-Absatz', () => {
  assert.equal(detail(ev()).querySelector('.lizenz'), null);
  assert.equal(detail(ev({ lizenz: null })).querySelector('.lizenz'), null);
  assert.equal(renderEventCard(document, ev({ lizenz: lizenzBsp() })).querySelector('.lizenz'), null, 'die Karte zeigt die Lizenz nie');
  assert.equal(renderEventCard(document, ev()).querySelector('.lizenz'), null);
});

test('Fremder Text im Urheber wird als Text dargestellt, unsichere Lizenzadresse ergibt keinen Link', () => {
  const boese = '<img src=x onerror=alert(1)>';
  const d = detail(ev({ lizenz: lizenzBsp({ urheber: boese, name: boese }) }));
  assert.equal(d.querySelectorAll('img').length, 0);
  assert.ok(d.querySelector('p.lizenz').textContent.includes(boese));
  for (const url of ['javascript:alert(3)', 'mailto:a@b.de', 'tel:123', null, '']) {
    const p = detail(ev({ lizenz: lizenzBsp({ url }) })).querySelector('p.lizenz');
    assert.equal(p.querySelectorAll('a').length, 0, String(url));
    assert.equal(p.textContent, 'Lizenz: CC BY-SA 4.0 · Urheber: Touristinformation Sebnitz');
  }
});

test('Farbklasse von Karte und Detail folgt der Rubrik (RUBRIKEN.farbe), wie die Kachel; alte Daten über die Art', () => {
  const klasse = (e) => [renderEventCard(document, e), renderDetail(document, e, { orte: [], userAgent: '' })]
    .map((x) => [...x.classList].filter((k) => k.startsWith('art-')));
  // "Konzert" aus der Musikregel auf art:'sonstiges': orange wie die Kachel Konzerte
  assert.deepEqual(klasse(ev({ art: 'sonstiges', rubrik: 'konzert' })), [['art-konzert'], ['art-konzert']]);
  // Führung aus art:'schau': Farbfamilie sonstiges wie die Kachel Führungen
  assert.deepEqual(klasse(ev({ art: 'schau', rubrik: 'fuehrung' })), [['art-sonstiges'], ['art-sonstiges']]);
  assert.deepEqual(klasse(ev({ art: 'sonstiges', rubrik: 'ausstellung' })), [['art-schau'], ['art-schau']]);
  // alte Daten ohne rubrik: über rubrikVon nach der Art; Unbekanntes ist sonstiges
  assert.deepEqual(klasse(ev({ art: 'markt' })), [['art-markt'], ['art-markt']]);
  assert.deepEqual(klasse(ev({ art: 'quatsch', rubrik: 'quatsch' })), [['art-sonstiges'], ['art-sonstiges']]);
});

test('Kartenkopf nennt die Rubrik in der Einzahl; ohne rubrik (alte Daten) die Art', () => {
  const fuehrung = renderEventCard(document, ev({ art: 'sonstiges', rubrik: 'fuehrung', genre: 'stadt' }));
  assert.equal(fuehrung.querySelector('.art').textContent, 'Führung');
  assert.equal(fuehrung.querySelector('.genre').textContent, 'Stadt & Ort');
  assert.ok(fuehrung.classList.contains('art-sonstiges'));
  const alt = renderEventCard(document, ev({ art: 'konzert' }));
  assert.equal(alt.querySelector('.art').textContent, 'Konzert');
  assert.ok(alt.classList.contains('art-konzert'));
  const unbekannt = renderEventCard(document, ev({ art: 'konzert', rubrik: 'quatsch' }));
  assert.equal(unbekannt.querySelector('.art').textContent, 'Konzert');
  const detailKopf = renderDetail(document, ev({ art: 'sonstiges', rubrik: 'theater' }), { orte: [], userAgent: '' });
  assert.equal(detailKopf.querySelector('.art').textContent, 'Theater & Lesung');
});

test('Ausstellung (Farbe Schau) zeigt "Ausstellung · Kunst & Foto"; alter Schau-Termin mit Genre kunst bleibt sichtbar ohne Zusatz', () => {
  const karte = renderEventCard(document, ev({ art: 'schau', rubrik: 'ausstellung', genre: 'kunst' }));
  assert.equal(karte.querySelector('.art-zeile').textContent, 'Ausstellung · Kunst & Foto');
  assert.ok(karte.classList.contains('art-schau'));
  const alt = renderEventCard(document, ev({ art: 'schau', genre: 'kunst' }));
  assert.equal(alt.querySelector('.art-zeile').textContent, 'Schau');
});

test('Ortszeile: ohne Koordinaten "Ort nicht genau bekannt" statt der Kilometer, mit Koordinaten nicht; Karte und Detailfenster', () => {
  const ohne = ev({ lat: null, lon: null, distanceKm: null });
  assert.equal(renderEventCard(document, ohne).querySelector('.where').textContent, 'Pirna · Ort nicht genau bekannt');
  assert.equal(detail(ohne).querySelector('.where').textContent, 'Pirna · Ort nicht genau bekannt');
  const mit = ev({ lat: 50.96, lon: 13.94 });
  assert.ok(!renderEventCard(document, mit).querySelector('.where').textContent.includes('Ort nicht genau bekannt'));
  assert.ok(!detail(mit).querySelector('.where').textContent.includes('Ort nicht genau bekannt'));
  const nurHinweis = renderEventCard(document, ev({ lat: undefined, lon: undefined, distanceKm: 20, placeName: '' }));
  assert.equal(nurHinweis.querySelector('.where').textContent, 'Ort nicht genau bekannt');
  const eineKoordinate = renderEventCard(document, ev({ lat: 50.9, lon: null })).querySelector('.where').textContent;
  assert.ok(!eineKoordinate.includes('Ort nicht genau bekannt'), 'eine endliche Koordinate genügt');
  const unsinn = renderEventCard(document, ev({ lat: '50.9', lon: NaN })).querySelector('.where').textContent;
  assert.ok(unsinn.includes('Ort nicht genau bekannt'), 'Strings und NaN zählen nicht als Koordinate');
});

test('Karte zeigt bei Theater mit sprache cs den Hinweis "auf Tschechisch"', () => {
  const karte = renderEventCard(document, ev({ rubrik: 'theater', genre: 'kabarett', country: 'CZ', sprache: 'cs' }));
  assert.equal(karte.querySelector('.sprache').textContent, 'auf Tschechisch');
});

test('Karte zeigt den Sprachhinweis nicht bei Konzert und nicht bei unbekanntem Wert', () => {
  assert.equal(renderEventCard(document, ev({ rubrik: 'konzert', sprache: 'cs' })).querySelector('.sprache'), null);
  const karte = renderEventCard(document, ev({ rubrik: 'theater', sprache: '<b>x</b>' }));
  assert.equal(karte.querySelector('.sprache'), null);
  assert.equal(karte.querySelectorAll('b').length, 0);
});

const serienTage = (tage, extra = {}) => tage.map((tag) => ev({ id: tag, start: `${tag}T10:00:00+01:00`, end: `${tag}T21:00:00+01:00`, rubrik: 'markt', serie: 's1', ...extra }));

test('Serienkarte: „Nächster Termin: “ in der ersten Zeile, Rhythmus in der zweiten, dann der Ort', () => {
  const termine = serienTage(['2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29']);
  const karte = renderEventCard(document, termine[0], { termine });
  assert.equal(karte.querySelector('.when').textContent, 'Nächster Termin: Do, 26. Nov., 10:00–21:00 Uhr');
  const zweite = karte.querySelector('.rhythmus');
  assert.equal(zweite.textContent, 'täglich bis So, 29. Nov. · 4 Termine');
  assert.equal(karte.querySelector('.when').nextElementSibling, zweite);
  assert.equal(zweite.nextElementSibling.getAttribute('class'), 'where');
});

test('Serienkarte: der Status des nächsten Termins steht in der ersten Zeile', () => {
  const termine = serienTage(['2026-11-26', '2026-11-27']);
  termine[1] = { ...termine[1], ticketStatus: 'ausverkauft' };
  const karte = renderEventCard(document, termine[1], { termine });
  assert.equal(karte.querySelector('.when .status-ausverkauft').textContent, 'ausverkauft');
  assert.equal(karte.querySelector('.rhythmus').textContent, 'auch Do, 26. Nov.');
});

test('ohne termine bleibt die Karte wie bisher, auch wenn der Termin eine Serienkennung trägt', () => {
  for (const optionen of [{}, { termine: null }]) {
    const karte = renderEventCard(document, ev({ serie: 's1' }), optionen);
    assert.equal(karte.querySelector('.when').textContent, 'Sa, 14. Nov., 19:00 Uhr');
    assert.equal(karte.querySelector('.rhythmus'), null);
  }
});

test('Serienkarte: fremde Werte bleiben Text', () => {
  const boese = '<img src=x onerror=alert(1)>';
  const termine = serienTage(['2026-11-26', '2026-11-27'], { title: boese, placeName: boese });
  const karte = renderEventCard(document, termine[0], { termine });
  assert.equal(karte.querySelectorAll('img').length, 0);
});

const langeSerie = (n, extra = {}) => Array.from({ length: n }, (_, i) => ev({ id: `t${i}`, start: `${tagPlus('2026-11-26', i)}T10:00:00+01:00`, rubrik: 'markt', serie: 's1', ...extra }));
const offen = (d) => [...d.querySelectorAll('.terminliste li')].filter((li) => !li.hasAttribute('hidden'));

test('Einzelheiten einer Serie: beide Zeitzeilen, Abschnitt „Termine“ mit fünf Zeilen, Knopf klappt alle auf', () => {
  const termine = langeSerie(29);
  termine[2] = { ...termine[2], ticketStatus: 'abgesagt' };
  const d = renderDetail(document, termine[0], { termine });
  assert.equal(d.querySelector('.when').textContent, 'Nächster Termin: Do, 26. Nov., 10:00 Uhr');
  assert.equal(d.querySelector('.rhythmus').textContent, 'täglich bis Do, 24. Dez. · 29 Termine');
  assert.equal(d.querySelector('.termine h3').textContent, 'Termine');
  assert.equal(d.querySelectorAll('.terminliste li').length, 29);
  assert.equal(offen(d).length, 5);
  assert.equal(offen(d)[0].textContent, 'Do, 26. Nov., 10:00 Uhr');
  assert.equal(offen(d)[2].querySelector('.status-abgesagt').textContent, 'abgesagt');
  assert.equal(d.querySelectorAll('.terminliste .status').length, 1);
  const knopf = d.querySelector('.termine button');
  assert.equal(knopf.textContent, 'Alle 29 Termine zeigen');
  knopf.click();
  assert.equal(offen(d).length, 29);
  assert.equal(d.querySelector('.termine button'), null);
});

test('Einzelheiten: bis fünf Termine kein Knopf; volle Terminliste heißt „Alle bekannten Termine zeigen“', () => {
  const fuenf = langeSerie(5);
  const d5 = renderDetail(document, fuenf[0], { termine: fuenf });
  assert.equal(offen(d5).length, 5);
  assert.equal(d5.querySelector('.termine button'), null);
  const voll = langeSerie(30);
  voll[29] = { ...voll[29], terminlisteVoll: true };
  assert.equal(renderDetail(document, voll[0], { termine: voll }).querySelector('.termine button').textContent, 'Alle bekannten Termine zeigen');
});

test('Einzelheiten: die Terminliste steht vor den Knöpfen; ohne termine gibt es sie nicht', () => {
  const termine = langeSerie(3);
  const d = renderDetail(document, termine[0], { termine });
  assert.equal(d.querySelector('.termine').nextElementSibling.getAttribute('class'), 'actions');
  assert.equal(renderDetail(document, ev()).querySelector('.termine'), null);
  assert.equal(renderDetail(document, ev(), { termine: null }).querySelector('.rhythmus'), null);
});

test('Einzelheiten: Zeilen der Terminliste sind reiner Text', () => {
  const termine = langeSerie(3);
  assert.equal(renderDetail(document, termine[0], { termine }).querySelectorAll('.terminliste a').length, 0);
});

test('Einzelheiten: nach „Alle Termine zeigen“ bekommt die erste bisher versteckte Zeile den Fokus', () => {
  const termine = langeSerie(29);
  const d = renderDetail(document, termine[0], { termine });
  const sechste = d.querySelectorAll('.terminliste li')[5];
  // linkedom führt document.activeElement nicht: der Aufruf von focus() wird mitgezählt, das Attribut geprüft.
  let fokus = 0;
  sechste.focus = () => { fokus += 1; };
  d.querySelector('.termine button').click();
  assert.equal(sechste.getAttribute('tabindex'), '-1');
  assert.equal(sechste.hasAttribute('hidden'), false);
  assert.equal(fokus, 1);
});
