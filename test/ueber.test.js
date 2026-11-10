import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseHTML } from 'linkedom';
import { QUELLEN, KONTAKT_MAIL, renderUeber } from '../site/js/ueber.js';

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

test('Sebnitz: Lizenz und Namensnennung stehen im Fenster', () => {
  const t = text(null);
  assert.ok(t.includes('CC BY-SA 4.0'));
  assert.ok(t.includes('CC0'));
  assert.ok(t.includes('Touristinformation Sebnitz'));
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
