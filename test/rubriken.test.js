import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RUBRIKEN, UNTERARTEN, rubrikUndGenre, quellHinweis, istAdvent } from '../src/rubriken.js';
import { GENRES, MARKT_SORTEN, PARTY_SORTEN, FEST_SORTEN } from '../src/normalize.js';

const von = (e) => rubrikUndGenre({ description: null, genre: null, ...e });
const sonst = (title, description = null) => von({ art: 'sonstiges', title, description });

test('RUBRIKEN hat 13 eindeutige Schlüssel in der Reihenfolge der Spec', () => {
  assert.deepEqual(RUBRIKEN.map((r) => r.key), [
    'konzert', 'markt', 'ausstellung', 'schau', 'fest', 'party', 'fuehrung', 'wandern', 'kurse', 'theater', 'essen', 'kinder', 'sonstiges',
  ]);
  assert.equal(new Set(RUBRIKEN.map((r) => r.key)).size, 13);
  for (const r of RUBRIKEN) {
    assert.ok(r.name && r.karte && r.art, r.key);
  }
  const art = Object.fromEntries(RUBRIKEN.map((r) => [r.key, r.art]));
  assert.equal(art.ausstellung, 'schau');
  assert.equal(art.schau, 'schau');
  assert.equal(art.konzert, 'konzert');
  assert.equal(art.wandern, 'sonstiges');
  assert.equal(RUBRIKEN.find((r) => r.key === 'wandern').karte, 'Wandern & Natur');
  assert.equal(RUBRIKEN.find((r) => r.key === 'schau').karte, 'Schau');
});

test('UNTERARTEN: Unterfilter je Rubrik', () => {
  assert.equal(UNTERARTEN.konzert, GENRES);
  assert.equal(UNTERARTEN.markt, MARKT_SORTEN);
  assert.equal(UNTERARTEN.party, PARTY_SORTEN);
  assert.equal(UNTERARTEN.fest, FEST_SORTEN);
  assert.deepEqual(Object.keys(UNTERARTEN.schau), ['tiere', 'hobby']);
  assert.deepEqual(Object.keys(UNTERARTEN.ausstellung), ['kunst', 'museum']);
  assert.deepEqual(Object.keys(UNTERARTEN.fuehrung), ['stadt', 'untertage', 'brauerei', 'kinder']);
  assert.equal(UNTERARTEN.theater, undefined);
});

test('art konzert/markt/party/fest bleibt gleichnamige Rubrik', () => {
  assert.deepEqual(von({ art: 'markt', title: 'Weihnachtsmarkt Sebnitz' }), { rubrik: 'markt', genre: 'weihnachtsmarkt' });
  assert.deepEqual(von({ art: 'konzert', title: 'Jazzabend' }), { rubrik: 'konzert', genre: 'jazz' });
  assert.equal(von({ art: 'party', title: 'Silvesterparty' }).rubrik, 'party');
  assert.equal(von({ art: 'fest', title: 'Stadtfest' }).rubrik, 'fest');
});

test('schau: Kunst und Museum werden Ausstellungen, Tier und Hobby bleiben Schauen', () => {
  assert.deepEqual(von({ art: 'schau', title: 'Kunstausstellung in der Galerie' }), { rubrik: 'ausstellung', genre: 'kunst' });
  assert.deepEqual(von({ art: 'schau', title: 'Kleintierschau Hainewalde' }), { rubrik: 'schau', genre: 'tiere' });
  assert.deepEqual(von({ art: 'schau', title: 'Sonderausstellung im Museum' }), { rubrik: 'ausstellung', genre: 'museum' });
  assert.deepEqual(von({ art: 'schau', title: 'Ausstellung' }), { rubrik: 'ausstellung', genre: null });
  assert.deepEqual(von({ art: 'schau', title: 'Modellbahnbörse' }), { rubrik: 'schau', genre: 'hobby' });
  assert.equal(von({ art: 'schau', title: 'Irgendetwas', description: 'Eine Ausstellung von Bildern' }).rubrik, 'ausstellung');
  assert.equal(von({ art: 'schau', title: 'Irgendetwas' }).rubrik, 'schau');
});

test('Führung im Titel gewinnt vor Museum und vor Sonstigem', () => {
  assert.equal(von({ art: 'schau', title: 'Führung durch das Museum' }).rubrik, 'fuehrung');
  assert.deepEqual(sonst('Mühlen- und Bäckereiführung'), { rubrik: 'fuehrung', genre: 'brauerei' });
  assert.equal(sonst('Kuratorenführung zur TRAUMZEIT').rubrik, 'fuehrung');
  assert.deepEqual(sonst('Kinderführung im Schloss'), { rubrik: 'fuehrung', genre: 'kinder' });
  assert.deepEqual(sonst('Besichtigung des Stollens'), { rubrik: 'fuehrung', genre: 'untertage' });
});

test('sonstiges wird nach Stichwörtern zerlegt', () => {
  assert.equal(sonst('Geführte Wanderung rund um Berggießhübel').rubrik, 'wandern');
  assert.equal(sonst('Archäologischer Vortrag: Von Teufelssteinen').rubrik, 'kurse');
  assert.equal(sonst('Vorlesestunde').rubrik, 'theater');
  assert.equal(sonst('Steinhaus-Kino: Vaterland').rubrik, 'theater');
  assert.equal(sonst('Kaffeeklatsch').rubrik, 'essen');
  assert.equal(sonst('Laternebasteln im Schuberts e.V.').rubrik, 'kinder');
  assert.equal(sonst('Karaoke-Abend').rubrik, 'sonstiges');
  assert.equal(sonst('Carmen', 'Oper am Theater').rubrik, 'theater');
});

test('Reihenfolge der Regeln', () => {
  assert.equal(sonst('Kindertheater').rubrik, 'theater');
  assert.equal(sonst('Theaterdinner').rubrik, 'theater');
});

test('Quellen-Genre zählt nur, wenn es zur Rubrik passt', () => {
  assert.equal(von({ art: 'konzert', genre: 'jazz', title: 'X' }).genre, 'jazz');
  assert.equal(von({ art: 'markt', genre: 'jazz', title: 'Flohmarkt' }).genre, 'troedel');
});

test('jeder Termin bekommt genau eine bekannte Rubrik', () => {
  const keys = new Set(RUBRIKEN.map((r) => r.key));
  for (const e of [{ art: undefined, title: '', description: null }, {}, { art: 'ufo', title: 'Zeug', description: undefined }, { art: 'schau', title: undefined }]) {
    const r = rubrikUndGenre(e);
    assert.ok(keys.has(r.rubrik), JSON.stringify(e));
  }
  assert.deepEqual(rubrikUndGenre({ art: undefined, title: '', description: null }), { rubrik: 'sonstiges', genre: null });
});

test('Nachgeschärft an den echten Daten: Vorführung ist keine Führung, Musik und Kurse aus sonstiges, Haus als letzter Hinweis', () => {
  assert.equal(sonst('Filmvorführung „Stolz & Eigensinn“').rubrik, 'theater', 'Vorführung/Aufführung gehören zu Theater, nicht zu Führung');
  assert.equal(sonst('Aufführung').rubrik, 'theater');
  assert.equal(sonst('Einführung in die Kalligrafie').rubrik, 'sonstiges');
  assert.deepEqual(sonst('Adventliche Orgelmusik am Mittag'), { rubrik: 'konzert', genre: 'klassik' });
  assert.equal(sonst('Malkurs - Weihnachtliche Strukturkunst').rubrik, 'kurse');
  assert.equal(sonst('Yoga am Morgen').rubrik, 'kurse');
  assert.equal(sonst('Schwanensee – Ballett in vier Akten').rubrik, 'theater');
  assert.equal(sonst('Whisky-Tasting im Besucherbergwerk').rubrik, 'essen');
  assert.equal(rubrikUndGenre({ art: 'sonstiges', title: 'Peer Gynt', placeName: 'Burgtheater Bautzen' }).rubrik, 'theater');
  assert.equal(sonst('Treffen', 'Musik liegt in der Luft und Kaffee gibt es auch').rubrik, 'essen', 'Musik zählt nur im Titel');
});

test('Führung: eine Regel für Art schau und sonstiges; Wein- und Steinführung zählen, Einführung nicht', () => {
  assert.equal(von({ art: 'schau', title: 'Nachtwächterführung' }).rubrik, 'fuehrung');
  assert.equal(sonst('Nachtwächterführung').rubrik, 'fuehrung');
  assert.equal(von({ art: 'schau', title: 'Der Nachtwächter zu Bautzen' }).rubrik, 'fuehrung');
  assert.equal(sonst('Weinführung im Keller').rubrik, 'fuehrung');
  assert.equal(sonst('Steinführung im Steinbruch').rubrik, 'fuehrung');
  assert.notEqual(sonst('Einführung in die Fotografie').rubrik, 'fuehrung');
  assert.notEqual(sonst('Ausführung').rubrik, 'fuehrung');
});

test('Streichelzoo ist kein Konzert, Streichquartett schon', () => {
  assert.notEqual(sonst('Streichelzoo').rubrik, 'konzert');
  assert.equal(sonst('Streichquartett im Schloss').rubrik, 'konzert');
});

test('essen nur als ganzes Wort oder in bekannten Zusammensetzungen', () => {
  assert.notEqual(sonst('Messen und Märkte').rubrik, 'essen');
  assert.notEqual(sonst('Adressen und Hausnummern').rubrik, 'essen');
  assert.equal(sonst('Gemeinsames Essen').rubrik, 'essen');
  assert.equal(sonst('Abendessen im Schloss').rubrik, 'essen');
});

test('Führung: ganze Vorsilben ausgeschlossen, Haus-/Rathaus-/Wein-/Steinführung zählen', () => {
  for (const t of ['Hausführung', 'Rathausführung', 'Gasthausführung', 'Weinführung', 'Steinführung']) {
    assert.equal(sonst(t).rubrik, 'fuehrung', t);
  }
  for (const t of ['Einführung in die Oper', 'Ausführung', 'Vorführung', 'Aufführung', 'Durchführung', 'Verführung']) {
    assert.notEqual(sonst(t).rubrik, 'fuehrung', t);
    assert.notEqual(von({ art: 'schau', title: t }).rubrik, 'fuehrung', `${t} (schau)`);
  }
});

test('essen: Zusammensetzungen mit -essen, aber nicht Messen oder Adressen', () => {
  for (const t of ['Ritteressen', 'Gourmetessen', 'Weinessen', 'Gänseessen', 'Schlachtessen']) {
    assert.equal(sonst(t).rubrik, 'essen', t);
  }
  assert.notEqual(sonst('Messen und Märkte').rubrik, 'essen');
  assert.notEqual(sonst('Adressen').rubrik, 'essen');
});

test('Haus mit Kino im Namen: letzter Hinweis für Theater', () => {
  assert.equal(rubrikUndGenre({ art: 'sonstiges', title: 'Bad Apples', placeName: 'Kunstbauerkino Großhennersdorf' }).rubrik, 'theater');
});

test('istAdvent: Genre weihnachtsmarkt und weihnachten zählen ohne Wörter im Text', () => {
  assert.equal(istAdvent({ rubrik: 'markt', genre: 'weihnachtsmarkt', title: 'Markt am Rathaus', description: null }), true);
  assert.equal(istAdvent({ rubrik: 'fest', genre: 'weihnachten', title: 'Feier im Schloss' }), true);
});

test('istAdvent: Advent-Wörter in Titel oder Beschreibung', () => {
  assert.equal(istAdvent({ rubrik: 'konzert', genre: null, title: 'Adventskonzert', description: null }), true);
  for (const w of ['Nikolaus', 'Weihnacht', 'Christkind', 'Pyramide', 'Winterzauber']) {
    assert.equal(istAdvent({ rubrik: 'sonstiges', genre: null, title: 'Abend im Ort', description: `Mit dem ${w} und Glühwein.` }), true, w);
  }
  assert.equal(istAdvent({ rubrik: 'sonstiges', genre: null, title: 'Adventure Day', description: null }), false);
});

test('istAdvent: Stollen und Lichter zählen nur im Titel', () => {
  assert.equal(istAdvent({ rubrik: 'markt', genre: null, title: 'Lichterglanz auf dem Markt', description: null }), true);
  assert.equal(istAdvent({ rubrik: 'essen', genre: null, title: 'Original Dresdner Stollen backen', description: null }), true);
  assert.equal(istAdvent({ rubrik: 'sonstiges', genre: null, title: 'Abend im Ort', description: 'Backen Sie Stollen und genießen Sie die Lichter.' }), false);
});

test('istAdvent: Führungen zählen nur über Advent-Wörter, nicht über Stollen oder Lichter', () => {
  assert.equal(istAdvent({ rubrik: 'fuehrung', genre: 'untertage', title: 'Führung durch den Stollen', description: null }), false);
  assert.equal(istAdvent({ rubrik: 'fuehrung', genre: 'stadt', title: 'Abendführung', description: 'Ein Rundgang durch die Lichter der Stadt.' }), false);
  assert.equal(istAdvent({ rubrik: 'fuehrung', genre: 'stadt', title: 'Lichterführung', description: null }), false);
  assert.equal(istAdvent({ rubrik: 'fuehrung', genre: 'stadt', title: 'Adventsführung', description: null }), true);
});

test('istAdvent: Sommerfest ist kein Advent, null-Felder werfen nicht', () => {
  assert.equal(istAdvent({ rubrik: 'fest', genre: null, title: 'Sommerfest', description: null }), false);
  assert.equal(istAdvent({ rubrik: null, genre: null, title: 'Sommerfest', description: null }), false);
  assert.equal(istAdvent({ rubrik: null, genre: null, title: undefined }), false);
  assert.equal(istAdvent({}), false);
});

test('quellHinweis: frisch, schon eingeordnet, altes Format', () => {
  assert.equal(quellHinweis({ genre: 'jazz' }), 'jazz');
  assert.equal(quellHinweis({ genre: 'jazz', rubrik: 'konzert' }), null);
  assert.equal(quellHinweis({ genre: 'rock-pop', rubrik: 'konzert', genreQuelle: 'jazz' }), 'jazz');
  assert.equal(quellHinweis({ genreQuelle: null, genre: 'jazz' }), null);
  assert.equal(quellHinweis(undefined), null);
});
