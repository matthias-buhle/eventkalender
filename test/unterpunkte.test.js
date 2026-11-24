import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unterpunkt as u } from '../src/unterpunkte.js';

const pruefe = (rubrik, erwartet, ...args) => {
  for (const [titel, beschreibung] of args.map((a) => (Array.isArray(a) ? a : [a]))) {
    assert.equal(u(rubrik, titel, beschreibung ?? null), erwartet, titel);
  }
};

test('Führung: Reihenfolge bahn, kinder, untertage, brauerei, hausfuehrung, stadt', () => {
  pruefe('fuehrung', 'bahn', 'Adventszauber auf der Weißeritztalbahn');
  pruefe('fuehrung', 'kinder', 'Kinderführung im Schloss');
  pruefe('fuehrung', 'untertage', 'Besichtigung des Stollens');
  pruefe('fuehrung', 'brauerei', 'Mühlen- und Bäckereiführung', 'Kleine Mühlentour mit Besuch der Max Bähr-Mühle');
  pruefe('fuehrung', 'hausfuehrung',
    'Öffentliche Führung durch das Museum Bautzen',
    'Führung durch das Stadtmuseum',
    'Rathausturm - Zwiedzanie Wieży Ratuszowej po polsku',
    ['Kuratorenführung zur TRAUMZEIT', 'Eine Führung in der Ausstellung']);
  pruefe('fuehrung', 'stadt',
    'Der Nachtwächter zu Bautzen',
    'Bautzener Lichterfahrt: Mit Panorama und Glühwein durch den Advent',
    'Altstadtrundgang');
  pruefe('fuehrung', null, 'Führung');
});

test('Theater: Reihenfolge kabarett, lesung, kino, show, schauspiel', () => {
  pruefe('theater', 'kabarett', 'Kabarett „Der nackte Shakespeare 2“');
  pruefe('theater', 'lesung', 'Signierstunde', 'Buchpremiere "Serbska protyka 2027"', 'Vorlesestunde');
  pruefe('theater', 'kino', 'Kurzfilmtag mit den Senftenberger Videofilmern', 'Steinhaus-Kino: Vaterland');
  pruefe('theater', 'show', 'Travestie-Revue', 'Zirkus Probst');
  pruefe('theater', 'schauspiel', ['Carmen', 'Oper am Theater']);
});

test('Theater: die Spielstätte ist der letzte Rückfall', () => {
  assert.equal(u('theater', 'Wunderwahr', null, 'Haus Görlitz Apollo'), 'schauspiel');
  assert.equal(u('theater', 'Vaterland', null, 'Kunstbauerkino Großhennersdorf'), 'kino');
  assert.equal(u('theater', 'Abend', null, 'Gasthof'), null);
});

test('Kurse: Reihenfolge bewegung, kreativ, lernen, vortrag', () => {
  pruefe('kurse', 'bewegung', 'Tanzkursreihe 2026 – Kurs „A“', 'Yoga am Morgen');
  pruefe('kurse', 'kreativ', 'Töpferkurs', 'Kochkurs: Sächsische Küche');
  pruefe('kurse', 'lernen',
    'Französisch To Go - Einführungskurs',
    'Smartphone-Sprechstunde',
    'Kommunikation in hybriden Teams – Führung auf Distanz wirksam gestalten');
  pruefe('kurse', 'vortrag', 'Archäologischer Vortrag: Von Teufelssteinen', 'Reisebericht Island');
});

test('Wandern: Reihenfolge wanderung, spaziergang, natur', () => {
  pruefe('wandern', 'wanderung', 'Geführte Wanderung rund um Berggießhübel');
  pruefe('wandern', 'spaziergang', 'Abendspaziergang durch den Park');
  pruefe('wandern', 'natur', 'Vogelbeobachtung am Stausee', 'Schaufütterung der Erdmännchen');
});

test('Essen: Reihenfolge brunch, verkostung, dinner', () => {
  pruefe('essen', 'brunch', 'Adventsbrunch im Berghotel');
  pruefe('essen', 'verkostung', 'Whisky-Tasting', 'Weinprobe im Schlosskeller');
  pruefe('essen', 'dinner', 'Gänseessen im Landgasthof', 'Krimidinner');
  pruefe('essen', null, 'Kaffeeklatsch');
});

test('Kinder: Reihenfolge kinder-buehne, kinder-mitmachen, kinder-lernen', () => {
  pruefe('kinder', 'kinder-buehne', 'Kindertheater: Der Grüffelo', 'Kinderkino');
  pruefe('kinder', 'kinder-mitmachen', 'Laternebasteln im Schuberts e.V.', 'Plätzchenbacken für Kinder');
  pruefe('kinder', 'kinder-lernen', 'Vorlesestunde für Kinder', 'Kinderuni');
});

test('Die Beschreibung zählt nur mit ihren ersten 200 Zeichen und nach dem Titel', () => {
  assert.equal(u('essen', 'Abend im Hotel', 'Ein Brunch für alle'), 'brunch');
  assert.equal(u('essen', 'Abend im Hotel', `${'x'.repeat(200)} Brunch`), null);
  assert.equal(u('essen', 'Weinprobe', 'Mit Brunch'), 'verkostung');
});

test('unterpunkt wirft nie und kennt nur die sechs Rubriken', () => {
  assert.equal(u('konzert', 'Jazz'), null);
  assert.equal(u('sport', 'Lauf'), null);
  assert.equal(u('theater', undefined), null);
  assert.equal(u(undefined, undefined), null);
  assert.equal(u('essen', 42, {}, 7), null);
});

test('geschärfte Stichwörter: kein Treffer im Teilwort', () => {
  pruefe('kurse', 'vortrag', 'Öffentlicher Arztvortrag "Rücken stärken - Nerven schützen"');
  pruefe('kurse', 'bewegung', 'Rückenschule am Abend');
  pruefe('kurse', 'kreativ', 'Workshop Sorbische Perlenstickerei', 'Weihnachtlicher Pralinen-Kurs');
  pruefe('essen', 'dinner', 'Uriger Baudenabend');
  pruefe('kinder', 'kinder-buehne', 'Weihnachtliche Kinderrevue');
});

test('Teilwörter treffen nicht: Brauchtum ist keine Brauerei, Zauberflöte keine Zaubershow', () => {
  assert.notEqual(u('fuehrung', 'Weihnachtliches Brauchtum im Museum'), 'brauerei');
  assert.equal(u('fuehrung', 'Weihnachtliches Brauchtum im Museum'), 'hausfuehrung');
  assert.notEqual(u('fuehrung', 'Braunkohle im Tagebau'), 'brauerei');
  for (const t of ['Brauerei-Rundgang', 'Führung durch die Braumanufaktur', 'Brauhaus-Abend', 'Besuch beim Braumeister']) assert.equal(u('fuehrung', t), 'brauerei', t);
  assert.equal(u('theater', 'Die Zauberflöte', null, 'Theater Görlitz'), 'schauspiel');
  assert.notEqual(u('theater', 'Der Traumzauberbaum'), 'show');
  assert.equal(u('theater', 'Zaubershow für die ganze Familie'), 'show');
  assert.equal(u('theater', 'Der große Zauberer'), 'show');
});

test('Kurse: Bild-Ton-Vortrag ist ein Vortrag, Töpfern mit Ton bleibt kreativ', () => {
  pruefe('kurse', 'vortrag', ['Streifzug durch die Sächsische Schweiz', 'Ein interessanter Bild-Ton-Vortrag mit eindrucksvollen Aufnahmen …']);
  pruefe('kurse', 'kreativ', 'Töpfern mit Ton für Anfänger', 'Nähen für Anfänger', ['Kuscheltiere stopfen', 'Das komplett genähte Kuscheltier muss nur noch ausgestopft werden']);
  pruefe('kurse', 'vortrag', ['Abend im Saal', 'Kurz vor der Nähe des Ziels, Aufnahmen vom Berg – ein Vortrag']);
});

test('Führung: Stadtrundfahrt im Titel ist Stadt, auch mit Mühle oder Brauerei', () => {
  pruefe('fuehrung', 'stadt', 'Stadtrundfahrt Bautzen und Besuch der Hammermühle', 'Stadtführung mit Brauereibesuch', 'Stadtrundgang zur Bäckerei');
  pruefe('fuehrung', 'brauerei', 'Brauereiführung mit Verkostung');
});

test('Kurse: Näh-Wörter sind kreativ, Nähe, Ernährung und Aufnahmen nicht', () => {
  pruefe('kurse', 'kreativ', 'Nähcafé im Stadtteilhaus', 'Nähabend für Anfänger');
  pruefe('kurse', 'vortrag', ['Streifzug durch die Sächsische Schweiz', 'Ein interessanter Bild-Ton-Vortrag mit eindrucksvollen Aufnahmen …'], 'Vortrag: Ernährung im Alter', ['Abend im Saal', 'Ein Vortrag in der Nähe des Bahnhofs']);
});

test('S4: erzähl zählt nur im Titel; Kabarett bleibt Kabarett', () => {
  pruefe('theater', 'lesung', 'Erzählabend am Kamin');
  pruefe('theater', 'schauspiel', ['Der Besuch der alten Dame', 'Das Stück erzählt die Geschichte einer Rache']);
  pruefe('theater', 'kabarett', 'Kabarett: Humor ist, wenn man trotzdem lacht');
});
