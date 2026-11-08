import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gemeindeVon, spielstaetteVon, plattform, navigationsLink } from '../site/js/ort.js';
import { anzeigeText } from '../site/js/filter.js';

const BEKANNT = ['Bautzen', 'Děčín', 'Dresden', 'Görlitz', 'Kamenz', 'Pirna', 'Sebnitz', 'Zittau'];

test('Gemeinde: Teil nach dem letzten Komma, bei Ortsteilen der erste', () => {
  assert.equal(gemeindeVon('Turnhalle, Neustadt in Sachsen'), 'Neustadt in Sachsen');
  assert.equal(gemeindeVon('Turnhalle, Reichenbach / Sohland a. Rotstein'), 'Reichenbach');
  assert.equal(gemeindeVon('Görlitzer Sammlungen, Kulturhistorisches Museum Görlitz, Kaisertrutz'), 'Kaisertrutz');
  assert.equal(gemeindeVon('Sporthaus "Krümelarena", Leutersdorf'), 'Leutersdorf');
  assert.equal(gemeindeVon('Kamenz, Kamenz'), 'Kamenz');
});

test('Gemeinde ohne Komma: nur ein bekannter Ort als ganzes Wort, sonst nichts', () => {
  assert.equal(gemeindeVon('Museum Bautzen', BEKANNT), 'Bautzen');
  assert.equal(gemeindeVon('Pirna', BEKANNT), 'Pirna');
  assert.equal(gemeindeVon('Kirche Kleinbautzen', BEKANNT), null);
  assert.equal(gemeindeVon('RABRYKA Werk I', BEKANNT), null);
  assert.equal(gemeindeVon('Museum Bautzen'), null, 'ohne Ortsverzeichnis nichts erfinden');
});

test('Gemeinde: leere oder fehlende Namen geben null', () => {
  assert.equal(gemeindeVon(null, BEKANNT), null);
  assert.equal(gemeindeVon('', BEKANNT), null);
  assert.equal(gemeindeVon('   ', BEKANNT), null);
  assert.equal(gemeindeVon(' , ', BEKANNT), null);
});

test('Spielstätte: alles vor dem letzten Komma, ohne Komma der ganze Name, bei gleichem Namen wie die Gemeinde nichts', () => {
  assert.equal(spielstaetteVon('Turnhalle, Neustadt in Sachsen'), 'Turnhalle');
  assert.equal(spielstaetteVon('Museum Bautzen', BEKANNT), 'Museum Bautzen');
  assert.equal(spielstaetteVon('RABRYKA Werk I', BEKANNT), 'RABRYKA Werk I');
  assert.equal(spielstaetteVon('Kamenz, Kamenz'), null);
  assert.equal(spielstaetteVon('Pirna', BEKANNT), null);
  assert.equal(spielstaetteVon('Sporthaus "Krümelarena", Leutersdorf'), 'Sporthaus "Krümelarena"');
  assert.equal(spielstaetteVon('Görlitzer Sammlungen, Kulturhistorisches Museum Görlitz, Kaisertrutz'), 'Görlitzer Sammlungen, Kulturhistorisches Museum Görlitz');
  assert.equal(spielstaetteVon(null), null);
});

test('Plattform grob aus dem User-Agent', () => {
  assert.equal(plattform('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'), 'ios');
  assert.equal(plattform('Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X)'), 'ios');
  assert.equal(plattform('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120 Mobile'), 'android');
  assert.equal(plattform('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120'), 'andere');
  assert.equal(plattform(undefined), 'andere');
});

test('Navigationslink je Plattform; ohne Koordinaten keiner', () => {
  const e = { lat: 51.2701, lon: 14.0949 };
  assert.equal(navigationsLink(e, 'ios'), 'https://maps.apple.com/?daddr=51.2701,14.0949');
  assert.equal(navigationsLink(e, 'android'), 'geo:51.2701,14.0949?q=51.2701,14.0949');
  assert.equal(navigationsLink(e, 'andere'), 'https://www.google.com/maps/dir/?api=1&destination=51.2701,14.0949');
  assert.equal(navigationsLink({ lat: null, lon: null }, 'ios'), null);
  assert.equal(navigationsLink({ lat: 51.2, lon: null }, 'android'), null);
  assert.equal(navigationsLink({}, 'andere'), null);
  assert.equal(navigationsLink({ lat: '51.2', lon: '14.1' }, 'andere'), null, 'nur echte Zahlen, keine Texte in der Adresse');
  assert.equal(navigationsLink({ lat: NaN, lon: 14 }, 'andere'), null);
});

test('Ergebnistext für den Knopf im Filterfenster', () => {
  assert.equal(anzeigeText(0), 'Keine Termine gefunden');
  assert.equal(anzeigeText(1), '1 Termin anzeigen');
  assert.equal(anzeigeText(1595), '1595 Termine anzeigen');
});
