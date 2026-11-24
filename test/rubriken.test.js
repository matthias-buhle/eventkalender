import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RUBRIKEN, UNTERARTEN, rubrikUndGenre, quellHinweis, istAdvent } from '../src/rubriken.js';
import { GENRES, MARKT_SORTEN, PARTY_SORTEN, FEST_SORTEN } from '../src/normalize.js';

const von = (e) => rubrikUndGenre({ description: null, genre: null, ...e });
const sonst = (title, description = null) => von({ art: 'sonstiges', title, description });

test('RUBRIKEN hat 14 eindeutige Schlüssel in der Reihenfolge der Spec', () => {
  assert.deepEqual(RUBRIKEN.map((r) => r.key), [
    'konzert', 'markt', 'ausstellung', 'schau', 'fest', 'party', 'fuehrung', 'wandern', 'kurse', 'theater', 'essen', 'kinder', 'sport', 'sonstiges',
  ]);
  assert.equal(new Set(RUBRIKEN.map((r) => r.key)).size, 14);
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
  assert.deepEqual(Object.keys(UNTERARTEN.fuehrung), ['stadt', 'untertage', 'brauerei', 'kinder', 'hausfuehrung', 'bahn']);
  assert.deepEqual(Object.keys(UNTERARTEN).sort(), [
    'ausstellung', 'essen', 'fest', 'fuehrung', 'kinder', 'konzert', 'kurse', 'markt', 'party', 'schau', 'theater', 'wandern',
  ]);
  assert.equal(UNTERARTEN.sport, undefined);
  assert.equal(UNTERARTEN.sonstiges, undefined);
  assert.equal(UNTERARTEN.konzert.comedy, undefined);
  assert.equal(UNTERARTEN.konzert.musical, undefined);
  assert.equal(UNTERARTEN.fest.brauchtum, 'Brauchtum');
  assert.equal(UNTERARTEN.fest.essen, undefined);
  assert.equal(UNTERARTEN.theater.kabarett, 'Kabarett & Comedy');
  assert.equal(UNTERARTEN.fuehrung.hausfuehrung, 'Museum & Schloss');
  assert.equal(UNTERARTEN.fuehrung.bahn, 'Sonderfahrt Bahn');
  assert.deepEqual(Object.keys(UNTERARTEN.wandern), ['wanderung', 'spaziergang', 'natur']);
  assert.deepEqual(Object.keys(UNTERARTEN.kurse), ['vortrag', 'kreativ', 'bewegung', 'lernen']);
  assert.deepEqual(Object.keys(UNTERARTEN.theater), ['schauspiel', 'lesung', 'kabarett', 'kino', 'show']);
  assert.deepEqual(Object.keys(UNTERARTEN.essen), ['dinner', 'brunch', 'verkostung']);
  assert.deepEqual(Object.keys(UNTERARTEN.kinder), ['kinder-buehne', 'kinder-mitmachen', 'kinder-lernen']);
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
  assert.equal(sonst('Kindertheater').rubrik, 'kinder', 'Kinder vor Theater');
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
  assert.deepEqual(sonst('Adventliche Orgelmusik am Mittag'), { rubrik: 'konzert', genre: 'kirche' });
  assert.equal(sonst('Malkurs - Weihnachtliche Strukturkunst').rubrik, 'kurse');
  assert.equal(sonst('Yoga am Morgen').rubrik, 'kurse');
  assert.equal(sonst('Schwanensee – Ballett in vier Akten').rubrik, 'theater');
  assert.equal(sonst('Whisky-Tasting im Besucherbergwerk').rubrik, 'essen');
  assert.equal(rubrikUndGenre({ art: 'sonstiges', title: 'Peer Gynt', placeName: 'Burgtheater Bautzen' }).rubrik, 'theater');
  assert.equal(sonst('Treffen', 'Musik liegt in der Luft und Kaffee gibt es auch').rubrik, 'sonstiges', 'Musik und Essen zählen nur im Titel');
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

test('Kirchenmusik (Entscheidung 5)', () => {
  assert.deepEqual(von({ art: 'konzert', title: 'Adventliche Orgelmusik am Mittag', placeName: 'Dom St. Petri Bautzen' }), { rubrik: 'konzert', genre: 'kirche' });
  assert.deepEqual(von({ art: 'konzert', title: '"Orgelpunkt 12" in der Peterskirche, Görlitz' }), { rubrik: 'konzert', genre: 'kirche' });
  assert.deepEqual(von({ art: 'konzert', title: 'Kammerkonzert', placeName: 'Kirche Cunewalde' }), { rubrik: 'konzert', genre: 'kirche' }, 'Klassik im Kirchenraum');
  assert.deepEqual(von({ art: 'konzert', title: 'Kammerkonzert', placeName: 'Kulturpalast Dresden' }), { rubrik: 'konzert', genre: 'klassik' });
  assert.deepEqual(von({ art: 'konzert', genre: 'klassik', title: 'Orgelkonzert' }), { rubrik: 'konzert', genre: 'kirche' }, 'Hinweis Klassik weicht dem Titel');
  assert.deepEqual(von({ art: 'konzert', genre: 'rock-pop', title: 'Rock in der Kirche', placeName: 'Kirche Cunewalde' }), { rubrik: 'konzert', genre: 'rock-pop' });
  assert.notEqual(von({ art: 'konzert', title: 'Liederabend', placeName: 'Dom kultury Zgorzelec' }).genre, 'kirche');
});

test('Konzert wird Theater (Entscheidung 1 bis 3)', () => {
  assert.deepEqual(von({ art: 'konzert', title: 'Kabarett Herkuleskeule: Hüttenzauber' }), { rubrik: 'theater', genre: 'kabarett' });
  assert.deepEqual(von({ art: 'konzert', title: 'Monchi', description: 'Liest: Jenseits der Brandmauer' }), { rubrik: 'theater', genre: 'lesung' });
  assert.deepEqual(von({ art: 'konzert', title: 'Die Nacht der Musicals' }), { rubrik: 'theater', genre: 'show' });
  assert.deepEqual(von({ art: 'konzert', title: 'Sebastian Fitzek', description: 'Die Einladung - Der Bestseller als packendes Theatererlebnis' }), { rubrik: 'theater', genre: 'schauspiel' });
  assert.equal(von({ art: 'konzert', title: 'Circus Mirage - Techno Electronic Musik' }).rubrik, 'konzert', 'Musik-Stichwort im Titel schlägt Zirkus');
  assert.equal(von({ art: 'konzert', title: 'The AC/DC Master-Show', placeName: 'L2 Club, Görlitz' }).rubrik, 'konzert', 'Show im Club ist ein Konzert');
  assert.deepEqual(von({ art: 'konzert', title: 'A4u – DIE ABBA REVIVAL SHOW' }), { rubrik: 'konzert', genre: 'rock-pop' });
  assert.deepEqual(von({ art: 'konzert', title: 'KARAT', description: '45 Jahre „Der blaue Planet“ – KARAT auf Tour 2027' }), { rubrik: 'konzert', genre: null });
});

test('Konzert wird Kinder', () => {
  assert.deepEqual(von({ art: 'konzert', title: 'Kinderkonzert: Peter und der Wolf' }), { rubrik: 'kinder', genre: 'kinder-buehne' });
  assert.deepEqual(von({ art: 'konzert', title: 'Familienkonzert der Elbland Philharmonie' }), { rubrik: 'kinder', genre: 'kinder-buehne' });
});

test('Lichterfest ist ein Fest (Entscheidung 6)', () => {
  assert.deepEqual(von({ art: 'markt', title: 'Lichterfest Kleinwelka' }), { rubrik: 'fest', genre: 'weihnachten' });
  assert.deepEqual(von({ art: 'markt', title: 'Lichtelfest mit Weihnachtsmarkt' }), { rubrik: 'markt', genre: 'weihnachtsmarkt' });
  assert.equal(von({ art: 'markt', title: 'Lichtermarkt Pirna' }).rubrik, 'markt');
});

test('Brauchtum (Entscheidung 7)', () => {
  for (const t of ['Hexenfeuer in Ottendorf', 'Osterreiten in Wittichenau', 'Kirmes in Radibor', 'Vogelhochzeit im Kindergarten', 'Maibaumsetzen', 'Schlachtfest im Gasthof']) {
    assert.deepEqual(von({ art: 'fest', title: t }), { rubrik: 'fest', genre: 'brauchtum' }, t);
  }
  assert.deepEqual(von({ art: 'fest', title: 'Martinsumzug in Königstein' }), { rubrik: 'fest', genre: 'familie' });
  assert.deepEqual(von({ art: 'fest', title: 'Erntedankfestival' }), { rubrik: 'fest', genre: 'festival' });
});

test('Feste ohne Essen & Trinken (Entscheidung 8)', () => {
  for (const t of ['Weinfest am Schloss', 'Weihnachts-Food-Festival', 'Streetfood-Festival Bautzen']) {
    assert.deepEqual(von({ art: 'fest', title: t }), { rubrik: 'essen', genre: null }, t);
  }
  assert.deepEqual(von({ art: 'fest', title: '8. Lauterbacher Suppenfest' }), { rubrik: 'fest', genre: 'stadtfest' });
  assert.deepEqual(von({ art: 'fest', title: 'Apfelfest im Museumshof' }), { rubrik: 'fest', genre: 'stadtfest' });
});

test('Fest wird Sport oder Kino', () => {
  assert.deepEqual(von({ art: 'fest', title: 'Fußballturnier zum Dorffest' }), { rubrik: 'sport', genre: null });
  assert.deepEqual(von({ art: 'fest', title: 'Sebnitzer Stadtlauf' }), { rubrik: 'sport', genre: null });
  assert.equal(von({ art: 'fest', title: 'Sportfest der Grundschule' }).rubrik, 'fest');
  assert.deepEqual(von({ art: 'fest', title: '17. Europäisches Filmfestival der Generationen - Im Taxi mit Madeleine' }), { rubrik: 'theater', genre: 'kino' });
});

test('Party (Entscheidung 13 und Umleitung)', () => {
  assert.deepEqual(von({ art: 'party', title: 'Tanzabend mit DJ Ulli' }), { rubrik: 'party', genre: 'disco' });
  assert.deepEqual(von({ art: 'party', title: '80er Party mit DJ Basti' }), { rubrik: 'party', genre: 'disco' });
  assert.deepEqual(von({ art: 'party', title: 'QUERBEET PARTY mit DJ Basti' }), { rubrik: 'party', genre: 'club' });
  assert.deepEqual(von({ art: 'party', title: 'Tanzturnier um den Stadtpokal' }), { rubrik: 'sport', genre: null });
  assert.deepEqual(von({ art: 'party', title: 'Tanzkurs für Paare' }), { rubrik: 'kurse', genre: 'bewegung' });
});

test('Führung schlägt Essen (Entscheidung 9), Bahn (11)', () => {
  for (const t of [
    'Glühwein, Lichter & Geschichte - die WEIHNACHTSTOUR mit dem Stadtschleicher',
    'Bautzener Lichterfahrt: Mit Panorama und Glühwein durch den Advent',
    'Der Nachtwächter zu Bautzen',
    'Rathausturm - Zwiedzanie Wieży Ratuszowej po polsku',
    'Kleine Mühlentour mit Besuch der Max Bähr-Mühle',
    'Adventszauber auf der Weißeritztalbahn',
    'Nikolausfahrt mit dem Dampfzug',
  ]) {
    assert.equal(sonst(t).rubrik, 'fuehrung', t);
  }
  assert.equal(von({ art: 'sonstiges', title: 'Kommunikation in hybriden Teams – Führung auf Distanz wirksam gestalten (Onlinekurs)', placeName: 'Kreisvolkshochschule Bautzen - Online' }).rubrik, 'kurse');
  assert.equal(sonst('Seminar für Führungskräfte').rubrik, 'kurse');
  assert.equal(sonst('Modellbahnausstellung im Lokschuppen').rubrik, 'ausstellung', 'keine Sonderfahrt');
});

test('Kinder vor Theater, Kurse, Essen', () => {
  for (const t of ['Kindertheater: Der Grüffelo', 'Bastelkurs für Kinder', 'Plätzchenbacken für Kinder', 'Laternebasteln im Schuberts e.V.']) {
    assert.equal(sonst(t).rubrik, 'kinder', t);
  }
  assert.equal(sonst('Kinderführung im Schloss').rubrik, 'fuehrung');
  assert.notEqual(sonst('Familienalbum ‒ aus dem Leben der Görlitzer Juden | Die Familie Alexander').rubrik, 'kinder');
});

test('Theater (Entscheidung 1 bis 4, 15)', () => {
  for (const t of ['Kabarett „Der nackte Shakespeare 2“', 'Signierstunde', 'Buchpremiere "Serbska protyka 2027"', 'Kurzfilmtag mit den Senftenberger Videofilmern', 'Theaterdinner "Die Schneekönigin"']) {
    assert.equal(sonst(t).rubrik, 'theater', t);
  }
  assert.equal(von({ art: 'sonstiges', title: 'Eine Woche voller Samstage', placeName: 'Haus Zittau Großer Saal' }).rubrik, 'theater');
  assert.equal(von({ art: 'sonstiges', title: 'Wunderwahr', placeName: 'Haus Görlitz Apollo' }).rubrik, 'theater');
  assert.notEqual(sonst('Vorführung der historischen Dampfmaschine').rubrik, 'theater');
  assert.equal(von({ art: 'sonstiges', title: 'Mark Reeder legt auf', placeName: 'Haus Zittau Großer Saal' }).rubrik, 'party');
});

test('Kurse', () => {
  assert.deepEqual(von({ art: 'sonstiges', title: 'Liebesgeschichten am Nachthimmel', placeName: 'Scultetus-Sternwarte, Raum Görlitz' }), { rubrik: 'kurse', genre: 'vortrag' });
  assert.equal(sonst('Tanzkursreihe 2026 – Kurs „A“').rubrik, 'kurse');
  assert.equal(sonst('Französisch To Go - Einführungskurs').rubrik, 'kurse');
});

test('Sport & Freizeit (Entscheidung 12)', () => {
  for (const t of ['Eislaufen in Görlitz', 'Tischtennisspiel', 'Geselliger Kegelabend', 'Winterskat im Gasthof Hillig', 'Spieleabend im Jugendclub', 'Volleyballturnier']) {
    assert.deepEqual(sonst(t), { rubrik: 'sport', genre: null }, t);
  }
  assert.equal(sonst('Eröffnung des Skateparks').rubrik, 'sonstiges');
  assert.notEqual(sonst('Krippenspiel in der Stadtkirche').rubrik, 'sport');
});

test('Essen wird enger (Entscheidung 14)', () => {
  for (const t of ['Adventsbrunch im Berghotel', 'Whisky-Tasting', 'Gänseessen im Landgasthof', 'Kaffeeklatsch']) {
    assert.equal(sonst(t).rubrik, 'essen', t);
  }
  assert.deepEqual(sonst('Lebendiger Adventskalender in Mulda', 'Täglich vom 1. bis 23. Dezember … mit Kaffee und Kuchen'), { rubrik: 'fest', genre: 'weihnachten' });
  assert.equal(sonst('Seniorentreff', 'Bei Kaffee und Kuchen …').rubrik, 'sonstiges');
});

test('Feste, Partys, Ausstellungen, Konzerte aus Sonstiges (Entscheidung 15)', () => {
  assert.deepEqual(sonst('Weihnachtliche Mettenschicht im Besucherbergwerk'), { rubrik: 'fest', genre: 'brauchtum' });
  assert.deepEqual(sonst('Bergparade im Fackelschein'), { rubrik: 'fest', genre: 'brauchtum' });
  assert.deepEqual(sonst('Lebendiger Adventskalender in Frauenstein'), { rubrik: 'fest', genre: 'weihnachten' });
  assert.deepEqual(sonst('Ball Royale'), { rubrik: 'party', genre: 'silvester' });
  assert.deepEqual(sonst('BKC Weiberfasching'), { rubrik: 'party', genre: 'fasching' });
  assert.deepEqual(sonst('»HANS-PETER MENGE. Zeichnungen und Druckgrafik«'), { rubrik: 'ausstellung', genre: 'kunst' });
  assert.deepEqual(sonst('Weihnachtszeit: Christmette'), { rubrik: 'konzert', genre: 'kirche' });
  assert.deepEqual(sonst('Christnacht mit Lichterzug in der Kirche'), { rubrik: 'konzert', genre: 'kirche' });
  assert.equal(sonst('Adventssingen im Rathaus').rubrik, 'konzert', 'Jahreszeit ist schwach');
  assert.equal(von({ art: 'sonstiges', title: 'FORCED TO MODE', placeName: 'Hutbergbühne Kamenz' }).rubrik, 'konzert');
});

test('Konzerte aus Sonstiges nehmen denselben Weg wie Art konzert (Kabarett bleibt Theater)', () => {
  assert.deepEqual(von({ art: 'sonstiges', title: 'Schmutzige Lieder', description: 'Die Kabarettistin hat bereits etliche Komplikationen überlebt' }), { rubrik: 'theater', genre: 'kabarett' });
  assert.equal(sonst('Kinderkonzert im Saal').rubrik, 'kinder', 'Kinder vor Konzert');
});

test('Nachgeschärft am Bestand: Gruppen mit gemeinsamem Stichwort', () => {
  assert.equal(sonst('Uriger Baudenabend').rubrik, 'essen');
  assert.equal(sonst('Grillvergnügen').rubrik, 'essen');
  assert.equal(sonst('Sagenhafte Klänge').rubrik, 'konzert');
  assert.equal(sonst('Guitar Arte Trio – Abrazo').rubrik, 'konzert');
  assert.equal(sonst('Kids Connect').rubrik, 'kinder');
  assert.equal(sonst('Freizeitangebot: Holzbasteleien').rubrik, 'kurse');
  assert.equal(sonst('Podiumsgespräch mit Zeitzeugen').rubrik, 'kurse');
  assert.equal(sonst('Patagonien', 'Eine Reisereportage von und mit dem Fotografen').rubrik, 'kurse');
  assert.deepEqual(sonst('Eine märchenhafte Nacht mit dem BKC'), { rubrik: 'party', genre: 'fasching' }, 'märchenhaft ist kein Märchen');
  assert.equal(sonst('Märchenlesung im Atelier').rubrik, 'kinder');
});

test('Beschreibung vor Jahreszeit: die Beschreibung nennt die Gattung, die Jahreszeit nur das Thema', () => {
  assert.equal(sonst('Weihnachten im Zauberwald', 'Familienmusical für Groß und Klein auf der Bühne').rubrik, 'theater');
  assert.equal(sonst('Wie wurde Weihnachten früher gefeiert?', 'Sonderführungen durch die festlich geschmückten Räume').rubrik, 'fuehrung');
  assert.deepEqual(sonst('Advent im Hof', 'Gemütliches Beisammensein mit Glühwein'), { rubrik: 'fest', genre: 'weihnachten' });
});

test('Schach ist Sport, Schacht nicht', () => {
  for (const t of ['Schachturnier', 'Schachabend', 'Schach für alle']) assert.equal(sonst(t).rubrik, 'sport', t);
  assert.notEqual(sonst('Schachtfest am Besucherbergwerk').rubrik, 'sport');
});

test('Altersangabe in der Beschreibung zählt nur im Kinderalter', () => {
  assert.equal(sonst('Nachmittag im Saal', 'Für Kinder ab 4 Jahren').rubrik, 'kinder');
  assert.equal(sonst('Abend im Saal', 'Basteln ab 6 Jahren').rubrik, 'kinder');
  assert.notEqual(sonst('Abend im Saal', 'Einlass ab 18 Jahren').rubrik, 'kinder');
  assert.notEqual(sonst('Abend im Saal', 'Zutritt ab 16 Jahren').rubrik, 'kinder');
});

test('Durchstich: je Rubrik ein Unterpunkt aus Titel, Beschreibung oder Spielstätte', () => {
  assert.deepEqual(von({ art: 'schau', title: 'Öffentliche Führung durch das Museum Bautzen' }), { rubrik: 'fuehrung', genre: 'hausfuehrung' });
  assert.deepEqual(sonst('Kinderführung im Schloss'), { rubrik: 'fuehrung', genre: 'kinder' });
  assert.deepEqual(sonst('Geführte Wanderung rund um Berggießhübel'), { rubrik: 'wandern', genre: 'wanderung' });
  assert.deepEqual(sonst('Töpferkurs'), { rubrik: 'kurse', genre: 'kreativ' });
  assert.deepEqual(sonst('Kabarett Abend'), { rubrik: 'theater', genre: 'kabarett' });
  assert.deepEqual(sonst('Adventsbrunch im Berghotel'), { rubrik: 'essen', genre: 'brunch' });
  assert.deepEqual(sonst('Kinderkino am Sonntag'), { rubrik: 'kinder', genre: 'kinder-buehne' });
  assert.deepEqual(von({ art: 'sonstiges', title: 'Wunderwahr', placeName: 'Haus Görlitz Apollo' }), { rubrik: 'theater', genre: 'schauspiel' });
  assert.deepEqual(sonst('Eislaufen in Görlitz'), { rubrik: 'sport', genre: null });
});

test('Hinweis der Quelle zählt nur, wenn er zur Rubrik passt', () => {
  assert.deepEqual(von({ art: 'sonstiges', genre: 'kabarett', title: 'Abendprogramm im Theater' }), { rubrik: 'theater', genre: 'kabarett' });
  assert.deepEqual(von({ art: 'sonstiges', genre: 'jazz', title: 'Abendprogramm im Theater' }), { rubrik: 'theater', genre: 'schauspiel' });
});

test('Spielstätten: eine gemeinsame Liste führt zur Rubrik Theater und zum Rückfall-Unterpunkt', () => {
  const orte = [['Divadlo Liberec', 'schauspiel'], ['Puppenbühne Zittau', 'schauspiel'], ['Haus Zittau Großer Saal', 'schauspiel'], ['Apollo Görlitz', 'schauspiel'], ['Kunstbauerkino Großhennersdorf', 'kino']];
  for (const [ort, unter] of orte) {
    assert.deepEqual(von({ art: 'sonstiges', title: 'Ein Abend', placeName: ort }), { rubrik: 'theater', genre: unter }, ort);
  }
});

// Task 10, Runde 1: Nachschärfen nach der Stichproben-Bewertung.
const markt = (title) => von({ art: 'markt', title });

test('Markt ohne Marktwort mit Lichter- oder Adventswort ist ein Fest', () => {
  for (const t of ['Advent im Miniaturpark "Kleine Sächsische Schweiz"', '21. Lichterzug auf Bergbaupfaden in Seiffen', 'Dresdner Winterlichter', 'Freitaler Schlossadvent']) {
    assert.deepEqual(markt(t), { rubrik: 'fest', genre: 'weihnachten' }, t);
  }
  assert.equal(markt('32. Seiffener Laternenzug in Seiffen').rubrik, 'fest');
  assert.ok(Object.hasOwn(FEST_SORTEN, markt('32. Seiffener Laternenzug in Seiffen').genre));
  for (const t of ['Meißner Weihnacht', 'Dresdner Hüttenzauber am Haus der Presse', '34. Seiffener Weihnacht', 'Lichtermarkt Pirna', 'Adventsmarkt am Schloss', 'Weihnachtsmarkt im Advent', 'Adventure Weekend']) {
    assert.equal(markt(t).rubrik, 'markt', t);
  }
});

test('Kinder und Familie: Puppenspiel, Familienwochenende und Wendungen in der Beschreibung', () => {
  assert.deepEqual(sonst('Theater der Puppen', 'Ein neues Märchen ganz aus Papier für alle ab vier Prinzessin Marie …').rubrik, 'kinder');
  assert.deepEqual(von({ art: 'sonstiges', title: 'Theater der Puppen', placeName: 'Jugendhaus Wartburg', description: 'Ein neues Märchen ganz aus Papier für alle ab vier Prinzessin Marie …' }), { rubrik: 'kinder', genre: 'kinder-buehne' });
  assert.deepEqual(von({ art: 'sonstiges', title: 'Sváťos Dividlo – Kašpárek und Honza in der Hölle', placeName: 'Zámek, Děčín', description: 'Originaltitel: Sváťovo dividlo - Kašpárek a Honza v pekle – Puppenmärchen' }), { rubrik: 'kinder', genre: 'kinder-buehne' });
  assert.equal(von({ art: 'sonstiges', title: 'Das höllische Kreuzworträtsel', placeName: 'Děčín', description: 'Originaltitel: Pekelná Křížovka – Kommt vorbei und erlebt mit euren Kindern jede Menge teuflischen Spaß …' }).rubrik, 'kinder');
  assert.deepEqual(sonst('Weihnachtsbäckerei - Familienwochenende im Schullandheim Bautzen/Burk'), { rubrik: 'kinder', genre: 'kinder-mitmachen' });
  assert.equal(sonst('Kasparek Show').rubrik, 'kinder');
  for (const b of ['für unsere Kleinen: Lieder und Spiele', 'Für die Kleinen gibt es Geschichten', 'Ein Puppenspiel mit Musik', 'Für Kinder von 4 bis 6 Jahre', 'Offen für 6–10 Jahre', 'ab zehn Jahren']) {
    assert.equal(sonst('Nachmittag am Sonntag', b).rubrik, 'kinder', b);
  }
  // Gegenbeispiele
  assert.equal(sonst('Nachtführung', 'Beginn ab vier Uhr am Markt').rubrik, 'fuehrung');
  assert.equal(sonst('Sommerkino', 'Einlass ab 16 Jahren').rubrik, 'theater');
  assert.notEqual(sonst('Lesung im Advent', 'Ein Abend für Erwachsene, 18 bis 99 Jahre').rubrik, 'kinder');
  assert.notEqual(sonst('Vereinsabend', 'Treffen ab vier Uhr, 30 bis 60 Jahre').rubrik, 'kinder');
});

test('Party: Zusammensetzungen auf "ball" sind Silvester & Ball, Sportbälle nicht', () => {
  assert.deepEqual(von({ art: 'party', title: '4. Bautzener Sportlerball' }), { rubrik: 'party', genre: 'silvester' });
  for (const t of ['Abiball 2026', 'Feuerwehrball', 'Tanzball']) assert.equal(von({ art: 'party', title: t }).genre, 'silvester', t);
  for (const t of ['Fußball-Party im Vereinsheim', 'Handballparty', 'Wasserball Party']) assert.notEqual(von({ art: 'party', title: t }).genre, 'silvester', t);
});

test('Theater: Songtexte in der Beschreibung machen ein Musical (Show)', () => {
  assert.equal(von({ art: 'sonstiges', title: 'The Addams Family', placeName: 'Theater Görlitz', description: 'Buch von Marshall Brickman und Rick Elice - Musik und Songtexte von Andrew Lippa …' }).genre, 'show');
  assert.equal(von({ art: 'sonstiges', title: 'Der zerbrochne Krug', placeName: 'Theater Görlitz', description: 'Lustspiel von Heinrich von Kleist' }).genre, 'schauspiel');
});

test('Filmnachmittag am Beschreibungsanfang ist Kino', () => {
  assert.deepEqual(von({ art: 'sonstiges', title: 'Kaffee um Drei „So war das damals? Einblicke in historisches sorbisches Filmmaterial“', placeName: 'Sorbisches Museum', description: 'Das Sorbische Kulturarchiv widmet der Digitalisierung historischen sorbischen Filmmaterials. In einem kommentierten Filmnachmittag wird …' }), { rubrik: 'theater', genre: 'kino' });
  assert.notEqual(von({ art: 'sonstiges', title: 'Vereinsabend', description: 'Wir sprechen über Filmförderung im ländlichen Raum' }).rubrik, 'theater');
});

test('Festakte im Theaterhaus bleiben Sonstiges, Stücke im selben Haus Theater', () => {
  const ort = 'Theater Görlitz (Gerhart-Hauptmann-Theater Görlitz-Zittau GmbH)';
  assert.deepEqual(von({ art: 'sonstiges', title: 'Stadt Görlitz verleiht den „Meridian des Ehrenamtes“ 2026', placeName: ort }), { rubrik: 'sonstiges', genre: null });
  for (const t of ['Ehrung der Sportler', 'Neujahrsempfang', 'Öffentliche Sitzung des Rates', 'Hauptversammlung']) {
    assert.equal(von({ art: 'sonstiges', title: t, placeName: ort }).rubrik, 'sonstiges', t);
  }
  assert.equal(von({ art: 'sonstiges', title: 'Der Besuch der alten Dame', placeName: ort }).rubrik, 'theater');
});

test('Kammermusik in der Beschreibung ist ein Konzert, der Titel gewinnt', () => {
  assert.deepEqual(von({ art: 'sonstiges', title: 'Sehnsucht und Verklärung', placeName: 'Evangelische Kirche, Raum Görlitz', description: 'Schon immer bot Musik nicht nur Raum für Fantasien … In seinem zweiten Streichsextett nimmt Brahms Abschied …' }), { rubrik: 'konzert', genre: 'kirche' });
  assert.deepEqual(von({ art: 'sonstiges', title: 'Abend im Saal', placeName: 'Kulturhaus', description: 'Ein Streichquartett spielt Haydn' }).rubrik, 'konzert');
  assert.equal(von({ art: 'sonstiges', title: 'Vortrag: Brahms und seine Zeit', description: 'Ein Abend über Kammermusik des 19. Jahrhunderts' }).rubrik, 'kurse');
});
