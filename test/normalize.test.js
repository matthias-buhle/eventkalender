import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeArt, detectStatus, normalizePhone, cleanText, detectGenre, detectSorte, passendeSorte } from '../src/normalize.js';

test('detectStatus erkennt Ausverkauft in Plus-Klammern', () => {
  assert.equal(detectStatus('+++Ausverkauft+++'), 'ausverkauft');
});
test('detectStatus erkennt tschechische Ausverkauft-Wörter', () => {
  assert.equal(detectStatus('Vyprodáno'), 'ausverkauft');
  assert.equal(detectStatus('Prodej ukončen'), 'ausverkauft');
});
test('detectStatus erkennt abgesagt und verlegt', () => {
  assert.equal(detectStatus('Konzert abgesagt'), 'abgesagt');
  assert.equal(detectStatus('Zrušeno'), 'abgesagt');
  assert.equal(detectStatus('Termin verlegt auf Mai'), 'verlegt');
});
test('detectStatus setzt nie verfuegbar und kennt Normaltext nicht', () => {
  assert.equal(detectStatus('Eintritt frei'), null);
  assert.equal(detectStatus('Karten an der Abendkasse'), null);
  assert.equal(detectStatus(''), null);
});

test('normalizeArt ordnet Quellenkategorien zu', () => {
  assert.equal(normalizeArt('Rock & Pop', 'Band X'), 'konzert');
  assert.equal(normalizeArt('Feiern & Ausgehen', '80er Party'), 'party');
});
test('normalizeArt erkennt Art am Titel', () => {
  assert.equal(normalizeArt('', 'Töpfermarkt Pulsnitz'), 'markt');
  assert.equal(normalizeArt('', 'Kreisschau Rassegeflügel'), 'schau');
  assert.equal(normalizeArt('', 'Suppenfest'), 'fest');
  assert.equal(normalizeArt('', 'Weihnachtsmarkt am 05.12.'), 'markt');
});
test('normalizeArt fällt auf sonstiges zurück', () => {
  assert.equal(normalizeArt('', 'Lesung im Rathaus'), 'sonstiges');
  assert.equal(normalizeArt(undefined, undefined), 'sonstiges');
});

test('normalizePhone bereinigt deutsche Nummern', () => {
  assert.equal(normalizePhone('035955 / 12 345'), '03595512345');
  assert.equal(normalizePhone('+49 (0) 351 123'), '+49351123');
});
test('normalizePhone findet die Nummer im Fließtext', () => {
  assert.equal(normalizePhone('Auskunft unter Tel. 035971 52 100 oder per Mail'), '03597152100');
});
test('normalizePhone lehnt Text, Datum und Uhrzeit ab', () => {
  assert.equal(normalizePhone('keine Nummer'), null);
  assert.equal(normalizePhone('am 10.11.2026 ab 19 Uhr'), null);
  assert.equal(normalizePhone('01.12.2026'), null);
  assert.equal(normalizePhone(null), null);
});

test('cleanText entfernt Tags, Skripte und Entitäten', () => {
  assert.equal(cleanText('<p>Hallo&nbsp;<b>Welt</b><script>alert(1)</script></p>'), 'Hallo Welt');
  assert.equal(cleanText('Tom &amp; Jerry &#8211; live'), 'Tom & Jerry – live');
  assert.equal(cleanText('  viel \n\n Leerraum\t'), 'viel Leerraum');
});

test('cleanText löst auch Mittelpunkt, Malzeichen, Aufzählungspunkt und Gradzeichen auf', () => {
  assert.equal(cleanText('10&ndash;18 Uhr &middot; 2&times; im Monat &bull; 20&deg;'), '10–18 Uhr · 2× im Monat • 20°');
});

test('shorten kürzt an Wortgrenze mit Auslassungszeichen und lässt Kurzes unverändert', async () => {
  const { shorten } = await import('../src/normalize.js');
  assert.equal(shorten('kurz', 10), 'kurz');
  assert.equal(shorten('eins zwei drei vier', 12), 'eins zwei…');
  assert.equal(shorten('', 5), '');
  assert.equal(shorten(null, 5), '');
});

test('detectGenre: Genre aus Titel, Kategorie und Beschreibung (deutsch und englisch); unklar bleibt null', () => {
  const g = (...t) => detectGenre(...t);
  assert.equal(g('Danger Dan', '"Keine Angst"-Tour 2027'), null);
  assert.equal(g('Weihnachtskonzert vom Frauenchor MELODIVEN'), 'klassik');
  assert.equal(g('Elbland Philharmonie Sachsen „Bella Italia“'), 'klassik');
  assert.equal(g('Fagottkonzert', 'Studierende der Hochschule für Musik'), 'klassik');
  assert.equal(g('Weihnachtszauber am Klavier mit Mark Ehrenfried'), 'klassik');
  assert.equal(g('Swingin‘ Santa Bigbandkonzerte 2026'), 'jazz');
  assert.equal(g('Jazzabend im Keller'), 'jazz');
  assert.equal(g('Bluesnight mit den Dirty Strings'), 'jazz');
  assert.equal(g('Johann König', 'Heute ein König', 'Comedy'), 'comedy');
  assert.equal(g('Kabarett: Die Dresdner Spitzen'), 'comedy');
  assert.equal(g('Stand-up Night'), 'comedy');
  assert.equal(g('Die Nacht der Musicals'), 'musical');
  assert.equal(g('Heavy Metal Open Air'), 'metal-punk');
  assert.equal(g('Punkrock im Hinterhof'), 'metal-punk');
  assert.equal(g('Rockkonzert mit den Stones Revival'), 'rock-pop');
  assert.equal(g('Popchor Dresden'), 'rock-pop');
  assert.equal(g('Alive', 'Pop / Rock'), 'rock-pop');
  assert.equal(g('Schlagerparty mit Andy Borg'), 'schlager-folk');
  assert.equal(g('Volksmusikabend'), 'schlager-folk');
  assert.equal(g('Hip-Hop Jam'), 'hiphop-elektro');
  assert.equal(g('Techno Night'), 'hiphop-elektro');
  assert.equal(g('Classical Music'), 'klassik');
  assert.equal(g('Dance/Electronic'), 'hiphop-elektro');
  assert.equal(g('', ''), null);
  assert.equal(g(undefined), null);
});

test('detectGenre: ein früher genannter Text zählt vor späteren; "Konzert" allein sagt nichts über das Genre', () => {
  assert.equal(detectGenre('Konzertabend "BESSER SPÄT ALS NIE"'), null);
  assert.equal(detectGenre('Jazz', 'Ein Abend mit Orchester'), 'jazz');
  assert.equal(detectGenre('Sinfoniekonzert', 'Rock-Klassiker für Orchester'), 'klassik');
});

test('detectGenre: Wortteile täuschen nicht ("Höhepunkt" ist kein Punk), Blasorchester sind Blasmusik', () => {
  assert.equal(detectGenre('Weihnachtskonzert', 'der Jahreshöhepunkt mit Wunderpunkt'), null);
  assert.equal(detectGenre('Post Punk Convention'), 'metal-punk');
  assert.equal(detectGenre('Frühjahrskonzert', 'Das Blasorchester der Lessingstadt'), 'schlager-folk');
});

test('detectSorte(markt): Weihnachtsmarkt, Flohmarkt & Trödel, Handwerk & Kunst, Bauern- & Wochenmarkt; sonst null', () => {
  const m = (...t) => detectSorte('markt', ...t);
  assert.equal(m('Meißner Weihnachtsmarkt'), 'weihnachtsmarkt');
  assert.equal(m('Freitaler Schlossadvent'), 'weihnachtsmarkt');
  assert.equal(m('LABAs NIKOLAUSMARKT'), 'weihnachtsmarkt');
  assert.equal(m('Weihnachtsmarkt Gohrischer Lichteln mit Kunstmarkt'), 'weihnachtsmarkt', 'Weihnachten geht vor Kunstmarkt');
  assert.equal(m('Trödelmarkt Bad Muskau'), 'troedel');
  assert.equal(m('Elbeflohmarkt Dresden an der Albertbrücke'), 'troedel');
  assert.equal(m('Floh-& Antikmarkt ehemaliger Adlermarkt Görlitz'), 'troedel');
  assert.equal(m('Modellbahn und Modellauto BÖRSE in Görlitz'), 'troedel');
  assert.equal(m('Der große LAUSITZ-MARKT für Handgemachtes in Löbau'), 'handwerk');
  assert.equal(m('designmarket dresden'), 'handwerk');
  assert.equal(m('Herbstmarkt mit historischem Handwerkermarkt und Biermeile'), 'handwerk');
  assert.equal(m('Wochenmarkt Pirna'), 'bauern');
  assert.equal(m('Bauernmarkt am Schloss'), 'bauern');
  assert.equal(m('Mittelaltermarkt'), null);
  assert.equal(m('Markt', 'Großer Trödel in der Halle'), 'troedel', 'ein späterer Text hilft, wenn der Titel nichts sagt');
});

test('detectSorte(schau): Tier- & Zuchtschau, Kunst & Foto, Museum & Geschichte, Messe & Hobby; sonst null', () => {
  const s = (...t) => detectSorte('schau', ...t);
  for (const titel of ['Kleintierschau Hainewalde', 'Lokalschau Bautzen', '101. Rassegeflügelschau in Reichenbach O.L.', '46. Farben- & Tommeltaubenschau', 'Bezirksjugendschau 2026', '7. Grenzlandschau', 'Kreisschau KV Löbau']) {
    assert.equal(s(titel), 'tiere', titel);
  }
  assert.equal(s('Modellbahnausstellung Eisenbahnclub Oberland Crostau e.V.'), 'hobby');
  assert.equal(s('Hochschulmesse im BiZ - Studiengänge'), 'hobby');
  assert.equal(s('Hubertusmesse'), null, 'eine Messe im kirchlichen Sinn ist keine Messe-Veranstaltung');
  assert.equal(s('Double Agent - Collagen von Sam Melser'), 'kunst');
  assert.equal(s('Fotoausstellung 430 Jahre Bibliothek'), 'kunst');
  assert.equal(s('»TRAUMZEIT. Zeichenkunst der Romantik«'), 'kunst');
  assert.equal(s('Geologische Sonderausstellung „GRANIT.massiv“'), 'museum');
  assert.equal(s('Öffentliche Führung durch das Museum Bautzen'), 'museum');
  assert.equal(s('Kürbishausen'), null);
});

test('detectSorte: Konzerte bekommen ein Genre, alle anderen Arten (Party, Fest, Sonstiges) nie', () => {
  assert.equal(detectSorte('konzert', 'Jazzabend'), 'jazz');
  assert.equal(detectSorte('sonstiges', 'Comedy-Show Live'), null);
  assert.equal(detectSorte('party', 'Rock-Party'), null);
  assert.equal(detectSorte('fest', 'Jazzfest'), null);
});

test('passendeSorte: ein Schlüssel zählt nur bei der Art, zu der er gehört', () => {
  assert.equal(passendeSorte('konzert', 'jazz'), 'jazz');
  assert.equal(passendeSorte('markt', 'troedel'), 'troedel');
  assert.equal(passendeSorte('schau', 'tiere'), 'tiere');
  assert.equal(passendeSorte('sonstiges', 'comedy'), null);
  assert.equal(passendeSorte('markt', 'jazz'), null);
  assert.equal(passendeSorte('konzert', null), null);
  assert.equal(passendeSorte('konzert', 'toString'), null);
});
