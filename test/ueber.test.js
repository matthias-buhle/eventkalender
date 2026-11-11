import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseHTML } from 'linkedom';
import { QUELLEN, GRUPPEN, KONTAKT_MAIL, renderUeber, versionsZeile } from '../site/js/ueber.js';

const { document } = parseHTML('<!doctype html><html><body></body></html>');
const quellenJson = JSON.parse(readFileSync(new URL('../sources.json', import.meta.url), 'utf8'));
const text = (mail) => renderUeber(document, { kontaktMail: mail }).textContent;

test('jede eingeschaltete Quelle aus sources.json hat einen Eintrag im Menü, und umgekehrt', () => {
  const imMenue = QUELLEN.map((q) => q.schluessel).sort();
  const aktiv = Object.entries(quellenJson).filter(([, c]) => c.enabled !== false).map(([k]) => k).sort();
  assert.deepEqual(imMenue, aktiv);
});

test('jeder Menüeintrag hat Namen, sichere Adresse und Hinweis zur Nutzung', () => {
  for (const q of QUELLEN) {
    assert.ok(q.name && q.hinweis, `${q.schluessel}: Name und Hinweis`);
    for (const l of q.links) {
      assert.match(l.url, /^https:\/\//, `${q.schluessel}: ${l.url}`);
      assert.ok(l.text);
    }
    assert.ok(q.links.length >= 1, `${q.schluessel}: mindestens ein Link`);
  }
});

test('das Fenster nennt jede Quelle mit Link', () => {
  const inhalt = renderUeber(document, {});
  const hrefs = [...inhalt.querySelectorAll('a')].map((a) => a.getAttribute('href'));
  for (const q of QUELLEN) for (const l of q.links) assert.ok(hrefs.includes(l.url), l.url);
  for (const a of inhalt.querySelectorAll('a[href^="http"]')) assert.equal(a.getAttribute('rel'), 'noopener noreferrer');
});

test('Sachsen-Tourismus: Lizenzen und Verweis aufs Detailfenster stehen im Fenster', () => {
  const t = text(null);
  assert.ok(t.includes('CC0 1.0'));
  assert.ok(t.includes('CC BY 4.0'));
  assert.ok(t.includes('CC BY-SA 4.0'));
  assert.match(t, /Lizenz und Urheber stehen im Detailfenster/);
  assert.ok(t.includes('Touristinformation Sebnitz'));
  const a = [...renderUeber(document, {}).querySelectorAll('a')].find((x) => x.textContent === 'CC BY-SA 4.0');
  assert.equal(a.getAttribute('href'), 'https://creativecommons.org/licenses/by-sa/4.0/deed.de');
});

test('Übersetzung: Hinweis auf DeepL und den Originaltitel steht im Fenster, DeepL ist verlinkt', () => {
  const inhalt = renderUeber(document, {});
  const t = inhalt.textContent;
  assert.match(t, /maschinell mit DeepL/);
  assert.match(t, /Originaltitel/);
  const a = [...inhalt.querySelectorAll('a')].find((x) => x.getAttribute('href') === 'https://www.deepl.com');
  assert.ok(a);
  assert.equal(a.getAttribute('rel'), 'noopener noreferrer');
});

test('Ticketmaster: Hinweis zu Datenschutz und Entfernung steht im Fenster', () => {
  const t = text(null);
  assert.ok(t.includes('Ticketmaster'));
  assert.match(t, /24 Stunden/);
  assert.match(t, /Datenschutz/);
});

test('Datenschutzerklärung von Ticketmaster ist verlinkt', () => {
  const a = [...renderUeber(document, {}).querySelectorAll('a')].find((x) => x.getAttribute('href') === 'https://privacy.ticketmaster.de/de/privacy-policy#privacy-notice');
  assert.ok(a);
  assert.equal(a.getAttribute('rel'), 'noopener noreferrer');
});

test('Wofür: erklärt Filter, Eingrenzen der Suche, Details per Klick, Tickets und Navigation', () => {
  const t = text(null);
  assert.match(t, /Filter/);
  assert.match(t, /eingrenzen/);
  assert.match(t, /Klick oder Tipp/);
  assert.match(t, /Tickets/);
  assert.match(t, /Navigation/);
});

test('Schriften: Namen, Urheber und Lizenz stehen im Fenster', () => {
  const t = text(null);
  for (const s of ['Barlow Condensed', 'Jeremy Tribby', 'Inter', 'Rasmus Andersson', 'SIL Open Font License']) assert.ok(t.includes(s), s);
});

test('Kontaktzeile erscheint nur mit hinterlegter Adresse', () => {
  assert.equal(KONTAKT_MAIL, 'buehnenlicht@mbuhle.de');
  assert.equal(renderUeber(document).querySelector('a[href^="mailto:"]').getAttribute('href'), 'mailto:buehnenlicht@mbuhle.de');
  assert.ok(!renderUeber(document, { kontaktMail: null }).querySelector('a[href^="mailto:"]'));
  const mit = renderUeber(document, { kontaktMail: 'kalender@example.org' });
  assert.equal(mit.querySelector('a[href^="mailto:"]').getAttribute('href'), 'mailto:kalender@example.org');
});

test('ohne Adresse steht, wohin Löschwünsche gehen: zur Person, die den Link weitergab', () => {
  assert.match(text(null), /Person, von der du den Link/);
});

test('die E-Mail-Adresse des Betreibers steht nirgends im Fenster', () => {
  assert.ok(!text(null).includes('gmail'));
});

test('jede Quelle steht in genau einer Gruppe, und jede Gruppe nennt nur bekannte Quellen', () => {
  const alle = GRUPPEN.flatMap((g) => g.schluessel);
  assert.equal(new Set(alle).size, alle.length, 'keine Quelle doppelt');
  assert.deepEqual([...alle].sort(), QUELLEN.map((q) => q.schluessel).sort());
});

test('Tschechische Quellen stehen in der Gruppe Tschechien, mit dem Übersetzungshinweis darunter', () => {
  const tschechien = GRUPPEN.find((g) => g.titel === 'Tschechien');
  assert.deepEqual([...tschechien.schluessel].sort(), ['goout', 'idecin']);
});

test('Gliederung: fünf aufklappbare Abschnitte, nur der erste ist offen', () => {
  const abschnitte = [...renderUeber(document, {}).querySelectorAll('details.abschnitt')];
  assert.deepEqual(abschnitte.map((d) => d.querySelector('summary').textContent.replace(/\s*\(.*\)$/, '')),
    ['Wofür', 'Woher die Termine kommen', 'Lizenzen', 'Datenschutz', 'Kontakt']);
  assert.deepEqual(abschnitte.map((d) => d.hasAttribute('open')), [true, false, false, false, false]);
});

test('Abschnitt Quellen nennt die Anzahl und gliedert nach Gruppen', () => {
  const inhalt = renderUeber(document, {});
  const quellen = [...inhalt.querySelectorAll('details.abschnitt')][1];
  assert.match(quellen.querySelector('summary').textContent, new RegExp(`\\(${QUELLEN.length} Quellen\\)`));
  assert.deepEqual([...quellen.querySelectorAll('h4')].map((h) => h.textContent), GRUPPEN.map((g) => g.titel));
  assert.equal(quellen.querySelectorAll('li').length, QUELLEN.length);
});

test('Version: Zeile mit Nummer, Commit und Datum; ohne Angaben entfällt sie', () => {
  assert.equal(versionsZeile({ version: '1.4.0', commit: 'ec29751', gebaut: '2026-11-10T14:23:31.511Z' }), 'Version 1.4.0 (ec29751) · gebaut am 10.11.2026');
  assert.equal(versionsZeile({ version: '1.4.0', commit: null, gebaut: 'kaputt' }), 'Version 1.4.0');
  assert.equal(versionsZeile(null), null);
  assert.equal(versionsZeile({}), null);
  assert.match(renderUeber(document, { version: { version: '1.4.0', commit: 'ec29751', gebaut: '2026-11-10T14:23:31Z' } }).textContent, /Version 1\.4\.0 \(ec29751\)/);
  assert.ok(!/Version \d/.test(renderUeber(document, {}).textContent));
});
