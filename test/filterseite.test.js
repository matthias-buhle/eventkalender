import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { baueFilterseite } from '../site/js/filterseite.js';
import { DEFAULT_PREFS } from '../site/js/filter.js';

const fenster = parseHTML('<!doctype html><html><body></body></html>');
const { document } = fenster;

const JETZT = '2026-11-23T10:00:00Z'; // Montag
const BOESE = '<img src=x onerror=alert(1)>';

const ev = (extra) => ({
  id: extra.title, art: 'sonstiges', tags: [], end: null, hasTime: true, placeName: 'Sebnitz', distanceKm: 5,
  lat: 50.97, lon: 14.27, country: 'DE', description: null, advent: false, ...extra,
});

/** Kleine Liste: am Wochenende 27.–29.11. ein Konzert (Sa) und ein Markt (Fr, Advent); dazu Termine am 24.11., 5.12., 12.12. */
const TERMINE = [
  ev({ title: 'Rockabend', rubrik: 'konzert', genre: 'rock-pop', start: '2026-11-28T19:00:00+01:00' }),
  ev({ title: 'Weihnachtsmarkt', rubrik: 'markt', genre: 'weihnachtsmarkt', advent: true, start: '2026-11-27T15:00:00+01:00' }),
  ev({ title: BOESE, rubrik: 'konzert', start: '2026-11-24T19:00:00+01:00', placeName: BOESE }),
  ev({ title: 'Nikolauskonzert', rubrik: 'konzert', start: '2026-12-05T17:00:00+01:00' }),
  ev({ title: 'Disco', rubrik: 'party', start: '2026-12-12T21:00:00+01:00' }),
];

const ORTE = [
  { name: 'Sebnitz', lat: 50.97, lon: 14.27 },
  { name: 'Görlitz', lat: 51.15, lon: 14.99 },
  { name: BOESE, lat: 51, lon: 14 },
];

function aufbau(prefsExtra = {}, events = TERMINE) {
  const container = document.createElement('div');
  document.body.append(container);
  const aufrufe = { aenderung: 0, anzeigen: 0 };
  const ctx = {
    prefs: { ...DEFAULT_PREFS, rubriken: [], hiddenGenres: [], hiddenTags: [], ...prefsExtra },
    events,
    orteListe: ORTE,
    orte: Object.fromEntries(ORTE.map((o) => [o.name, { lat: o.lat, lon: o.lon }])),
    jetzt: () => JETZT,
    beiAenderung: () => { aufrufe.aenderung += 1; },
    beiAnzeigen: () => { aufrufe.anzeigen += 1; },
  };
  const seite = baueFilterseite(document, container, ctx);
  return { container, ctx, aufrufe, seite };
}

const kacheln = (c) => [...c.querySelectorAll('button.kachel')];
const kachel = (c, name) => kacheln(c).find((k) => k.querySelector('.kachel-name').textContent === name);
const zahlen = (c) => Object.fromEntries(kacheln(c).map((k) => [k.querySelector('.kachel-name').textContent, Number(k.querySelector('.kachel-zahl').textContent)]));
const tag = (c, iso) => c.querySelector(`.kalender button[data-tag="${iso}"]`);
const knopf = (c) => c.querySelector('button.btn.primaer');
const chip = (c, text) => [...c.querySelectorAll('button.chip')].find((b) => b.textContent === text);
const kalenderChip = (c) => c.querySelector('button.kalender-chip');
const kalenderbox = (c) => c.querySelector('.kalenderbox');
const gruppe = (c, titel) => [...c.querySelectorAll('.sorten')].find((g) => g.querySelector('.gruppentitel').textContent === titel);
const sorte = (c, titel, text) => [...gruppe(c, titel).querySelectorAll('button.chip')].find((b) => b.textContent === text);
const gedrueckt = (c, titel) => [...gruppe(c, titel).querySelectorAll('button.chip[aria-pressed="true"]')].map((b) => b.textContent);
const sichtbareGruppen = (c) => [...c.querySelectorAll('.sorten')].filter((g) => !g.hasAttribute('hidden')).map((g) => g.querySelector('.gruppentitel').textContent);

test('14 Kacheln in Spec-Reihenfolge mit den Zahlen beim Wochenende', () => {
  const { container } = aufbau();
  assert.deepEqual(kacheln(container).map((k) => k.querySelector('.kachel-name').textContent), [
    'Konzerte', 'Märkte', 'Ausstellungen & Museen', 'Schauen', 'Feste', 'Partys', 'Führungen', 'Wandern & Natur',
    'Kurse & Vorträge', 'Theater & Lesungen', 'Essen & Trinken', 'Kinder & Familie', 'Sport & Freizeit', 'Sonstiges',
  ]);
  const z = zahlen(container);
  assert.equal(z.Konzerte, 1);
  assert.equal(z['Märkte'], 1);
  assert.equal(z.Partys, 0);
  assert.ok(kachel(container, 'Konzerte').getAttribute('class').includes('art-konzert'));
  assert.ok(kachel(container, 'Führungen').getAttribute('class').includes('art-sonstiges'));
});

test('Tipp auf 28.11. wählt den Einzeltag, ruft beiAenderung einmal, Zahlen ändern sich; 29.11. danach ergibt den Zeitraum', () => {
  const { container, ctx, aufrufe } = aufbau();
  tag(container, '2026-11-28').click();
  assert.equal(ctx.prefs.zeit, 'tage');
  assert.equal(ctx.prefs.von, '2026-11-28');
  assert.equal(ctx.prefs.bis, '2026-11-28');
  assert.equal(aufrufe.aenderung, 1);
  assert.equal(zahlen(container)['Märkte'], 0);
  assert.equal(zahlen(container).Konzerte, 1);
  const zeitChip = kalenderChip(container);
  assert.equal(zeitChip.textContent, 'Sa 28.11.');
  assert.equal(zeitChip.getAttribute('aria-label'), 'Kalender: Sa 28.11.');
  assert.equal(zeitChip.getAttribute('aria-pressed'), 'true');
  assert.equal(chip(container, 'Wochenende').getAttribute('aria-pressed'), 'false');
  tag(container, '2026-11-29').click();
  assert.deepEqual([ctx.prefs.zeit, ctx.prefs.von, ctx.prefs.bis], ['tage', '2026-11-28', '2026-11-29']);
  assert.equal(aufrufe.aenderung, 2);
  assert.equal(zeitChip.textContent, 'Sa 28.11. – So 29.11.');
  assert.ok(tag(container, '2026-11-28').classList.contains('a'));
  assert.ok(tag(container, '2026-11-29').classList.contains('e'));
});

test('Tage vor heute sind gesperrt, heute nicht; heute trägt heute; Tag mit Termin trägt punkt, ohne nicht', () => {
  const { container, ctx, aufrufe } = aufbau();
  assert.equal(tag(container, '2026-11-01').disabled, true);
  assert.equal(tag(container, '2026-11-22').disabled, true);
  assert.equal(tag(container, '2026-11-23').disabled, false);
  assert.ok(tag(container, '2026-11-23').classList.contains('heute'));
  assert.ok(tag(container, '2026-11-24').classList.contains('punkt'));
  assert.ok(!tag(container, '2026-11-25').classList.contains('punkt'));
  tag(container, '2026-11-20').click();
  assert.equal(ctx.prefs.zeit, 'wochenende', 'gesperrter Tag ändert nichts');
  assert.equal(aufrufe.aenderung, 0);
});

test('Kacheln tragen einen sprechenden Namen mit Zahl (aria-label), auch nach dem Aktualisieren', () => {
  const { container, ctx, seite } = aufbau();
  assert.equal(kachel(container, 'Konzerte').getAttribute('aria-label'), 'Konzerte, 1 Termin');
  assert.equal(kachel(container, 'Partys').getAttribute('aria-label'), 'Partys, 0 Termine');
  ctx.prefs.zeit = 'alle';
  seite.aktualisieren();
  assert.equal(kachel(container, 'Konzerte').getAttribute('aria-label'), 'Konzerte, 3 Termine');
  assert.equal(kachel(container, 'Partys').getAttribute('aria-label'), 'Partys, 1 Termin');
});

test('Tage ohne Termine (ab heute) tragen ohne und bleiben wählbar; Tage mit Termin und vergangene nicht', () => {
  const { container, ctx } = aufbau();
  const ohne = tag(container, '2026-11-25');
  assert.ok(ohne.classList.contains('ohne'));
  assert.equal(ohne.disabled, false);
  assert.ok(!tag(container, '2026-11-24').classList.contains('ohne'), 'Tag mit Termin');
  assert.ok(!tag(container, '2026-11-20').classList.contains('ohne'), 'vergangener Tag ist gesperrt, nicht blass');
  ohne.click();
  assert.equal(ctx.prefs.zeit, 'tage');
  assert.equal(ctx.prefs.von, '2026-11-25');
});

test('neuer Tag (Rückkehr aus dem Hintergrund): aktualisieren setzt heute und gesperrte Tage neu, auch im selben Monat', () => {
  let jetzt = JETZT;
  const { container, ctx, seite } = aufbau();
  ctx.jetzt = () => jetzt;
  jetzt = '2026-11-25T08:00:00Z';
  seite.aktualisieren();
  assert.equal(tag(container, '2026-11-24').disabled, true);
  assert.ok(!tag(container, '2026-11-23').classList.contains('heute'));
  assert.ok(tag(container, '2026-11-25').classList.contains('heute'));
  assert.equal(tag(container, '2026-11-25').getAttribute('aria-current'), 'date');
  assert.equal(tag(container, '2026-11-23').getAttribute('aria-current'), null);
  // Monatswechsel: der neue Monat wird gezeigt
  jetzt = '2026-12-01T08:00:00Z';
  seite.aktualisieren();
  assert.equal(container.querySelector('.monatsname').textContent, 'Dezember 2026');
  assert.ok(tag(container, '2026-12-01').classList.contains('heute'));
});

test('Kalender: 42 Zellen, Leerzellen als span, Wochentagszeile, aria-label mit vollem Wochentag und Monat', () => {
  const { container } = aufbau();
  const kal = container.querySelector('.kalender');
  assert.deepEqual([...kal.querySelectorAll('.wt')].map((w) => w.textContent), ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']);
  assert.equal(kal.querySelectorAll('button.tag').length, 30);
  assert.equal(kal.querySelectorAll('span.tag.leerzelle').length, 12);
  assert.equal(tag(container, '2026-11-28').getAttribute('aria-label'), 'Samstag, 28. November');
  assert.equal(tag(container, '2026-11-28').textContent, '28');
});

test('Monatskopf blättert nur durch Monate mit Terminen und ist an den Enden gesperrt', () => {
  const { container } = aufbau();
  const zurueck = container.querySelector('.monat-zurueck');
  const vor = container.querySelector('.monat-vor');
  const name = container.querySelector('.monatsname');
  assert.equal(name.textContent, 'November 2026');
  assert.equal(zurueck.disabled, true);
  assert.equal(vor.disabled, false);
  vor.click();
  assert.equal(name.textContent, 'Dezember 2026');
  assert.equal(vor.disabled, true);
  assert.equal(zurueck.disabled, false);
  assert.ok(tag(container, '2026-12-05').classList.contains('punkt'));
  assert.equal(tag(container, '2026-11-28'), null);
  zurueck.click();
  assert.equal(name.textContent, 'November 2026');
});

test('der Kalender beginnt im Monat des gewählten Tages', () => {
  const { container } = aufbau({ zeit: 'tage', von: '2026-12-12', bis: '2026-12-12' });
  assert.equal(container.querySelector('.monatsname').textContent, 'Dezember 2026');
  assert.ok(tag(container, '2026-12-12').classList.contains('gewaehlt'));
});

test('Schnellwahl Wochenende markiert Fr–So im Kalender', () => {
  const { container } = aufbau();
  assert.equal(chip(container, 'Wochenende').getAttribute('aria-pressed'), 'true');
  assert.equal(kalenderChip(container).textContent, 'Kalender');
  assert.equal(kalenderChip(container).getAttribute('aria-pressed'), 'false');
  assert.equal(kalenderChip(container).hasAttribute('aria-label'), false);
  assert.equal(container.querySelector('.zeitraum-chip'), null, 'den eigenen Zeitraum-Chip gibt es nicht mehr');
  for (const t of ['2026-11-27', '2026-11-28', '2026-11-29']) assert.ok(tag(container, t).classList.contains('gewaehlt'), t);
  assert.ok(!tag(container, '2026-11-26').classList.contains('gewaehlt'));
  assert.ok(!tag(container, '2026-11-30').classList.contains('gewaehlt'));
  assert.ok(tag(container, '2026-11-27').classList.contains('a'));
  assert.ok(tag(container, '2026-11-29').classList.contains('e'));
});

test('Schnellwahl-Chips setzen zeit und löschen von/bis', () => {
  const { container, ctx, aufrufe } = aufbau({ zeit: 'tage', von: '2026-11-28', bis: '2026-11-28' });
  assert.deepEqual([...container.querySelectorAll('.zeitwahl button.chip')].map((b) => b.textContent), ['Heute', 'Wochenende', '7 Tage', '30 Tage', 'Sa 28.11.', 'Alle'], 'der Kalender-Chip nennt den gewählten Tag');
  chip(container, 'Alle').click();
  assert.deepEqual([ctx.prefs.zeit, ctx.prefs.von, ctx.prefs.bis], ['alle', null, null]);
  assert.equal(aufrufe.aenderung, 1);
  assert.equal(chip(container, 'Alle').getAttribute('aria-pressed'), 'true');
  assert.equal(container.querySelectorAll('.kalender .gewaehlt').length, 0);
  chip(container, '7 Tage').click();
  assert.equal(ctx.prefs.zeit, '7');
});

test('Kachel Konzerte wählt die Rubrik und klappt ihre Unterpunkte direkt unter der Kachel auf, auch bei zwei Rubriken', () => {
  // Je Rubrik zwei Unterpunkte mit Terminen am Wochenende, sonst bliebe die Gruppe zu (siehe unten).
  const mehr = [
    ...TERMINE,
    ev({ title: 'Jazzabend', rubrik: 'konzert', genre: 'jazz', start: '2026-11-28T20:00:00+01:00' }),
    ev({ title: 'Trödelmarkt', rubrik: 'markt', genre: 'troedel', start: '2026-11-28T10:00:00+01:00' }),
  ];
  const { container, ctx, aufrufe } = aufbau({}, mehr);
  assert.deepEqual(sichtbareGruppen(container), []);
  const k = kachel(container, 'Konzerte');
  k.click();
  assert.deepEqual(ctx.prefs.rubriken, ['konzert']);
  assert.equal(aufrufe.aenderung, 1);
  assert.equal(k.getAttribute('aria-pressed'), 'true');
  assert.equal(kachel(container, 'Konzerte'), k, 'die Kachel bleibt dasselbe Element (Fokus bleibt)');
  assert.deepEqual(sichtbareGruppen(container), ['Konzerte: Genre']);
  assert.ok(k.nextElementSibling === gruppe(container, 'Konzerte: Genre'), 'die Unterpunkte stehen direkt hinter ihrer Kachel');
  assert.ok(gruppe(container, 'Konzerte: Genre').parentNode === k.parentNode);
  assert.equal(gruppe(container, 'Konzerte: Genre').getAttribute('aria-label'), 'Konzerte: Genre');
  kachel(container, 'Märkte').click();
  assert.deepEqual(ctx.prefs.rubriken, ['konzert', 'markt']);
  assert.deepEqual(sichtbareGruppen(container), ['Konzerte: Genre', 'Märkte: Sorte']);
  kachel(container, 'Sport & Freizeit').click();
  assert.deepEqual(sichtbareGruppen(container), ['Konzerte: Genre', 'Märkte: Sorte'], 'Rubrik ohne Unterpunkte');
  k.click();
  assert.deepEqual(sichtbareGruppen(container), ['Märkte: Sorte']);
});

test('Unterpunkte: erst gilt "Alle"; ein Tipp wählt genau diese Unterart, weitere kommen dazu, "Alle" hebt es auf', () => {
  const { container, ctx, aufrufe } = aufbau({ rubriken: ['konzert'], zeit: 'alle' });
  const G = 'Konzerte: Genre';
  assert.deepEqual([...gruppe(container, G).querySelectorAll('button.chip')].map((b) => b.textContent).slice(0, 3), ['Alle', 'Rock & Pop', 'Metal & Punk']);
  assert.deepEqual(gedrueckt(container, G), ['Alle']);
  assert.equal(knopf(container).textContent, '3 Termine anzeigen');
  sorte(container, G, 'Rock & Pop').click();
  assert.deepEqual(gedrueckt(container, G), ['Rock & Pop']);
  assert.equal(aufrufe.aenderung, 1);
  assert.ok(!ctx.prefs.hiddenGenres.includes('rock-pop'));
  assert.equal(ctx.prefs.hiddenGenres.length, 7);
  assert.equal(knopf(container).textContent, '1 Termin anzeigen');
  sorte(container, G, 'Sonstige Konzerte').click();
  assert.deepEqual(gedrueckt(container, G), ['Rock & Pop', 'Sonstige Konzerte']);
  assert.equal(knopf(container).textContent, '3 Termine anzeigen');
  sorte(container, G, 'Rock & Pop').click();
  assert.deepEqual(gedrueckt(container, G), ['Sonstige Konzerte']);
  assert.equal(knopf(container).textContent, '2 Termine anzeigen');
  sorte(container, G, 'Alle').click();
  assert.deepEqual(gedrueckt(container, G), ['Alle']);
  assert.deepEqual(ctx.prefs.hiddenGenres, []);
  assert.equal(aufrufe.aenderung, 4);
});

test('Unterpunkte: die letzte abgewählte Unterart führt zurück zu "Alle"; Abwählen der Kachel setzt ihre Unterpunkte zurück', () => {
  const { container, ctx } = aufbau({ rubriken: ['konzert', 'markt'], zeit: 'alle' });
  sorte(container, 'Konzerte: Genre', 'Jazz & Blues').click();
  sorte(container, 'Märkte: Sorte', 'Weihnachtsmarkt').click();
  assert.deepEqual(gedrueckt(container, 'Konzerte: Genre'), ['Jazz & Blues']);
  assert.deepEqual(gedrueckt(container, 'Märkte: Sorte'), ['Weihnachtsmarkt']);
  assert.equal(knopf(container).textContent, '1 Termin anzeigen', 'nur der Weihnachtsmarkt; kein Jazz in der Liste');
  sorte(container, 'Konzerte: Genre', 'Jazz & Blues').click();
  assert.deepEqual(gedrueckt(container, 'Konzerte: Genre'), ['Alle']);
  assert.deepEqual(gedrueckt(container, 'Märkte: Sorte'), ['Weihnachtsmarkt'], 'die andere Rubrik bleibt');
  kachel(container, 'Märkte').click();
  assert.deepEqual(ctx.prefs.hiddenGenres, []);
  kachel(container, 'Märkte').click();
  assert.deepEqual(gedrueckt(container, 'Märkte: Sorte'), ['Alle'], 'neu gewählt beginnt bei Alle');
});

test('Kachel mit Zahl 0 ist leer, nicht gesperrt und ändert beim Tipp die Auswahl', () => {
  const { container, ctx } = aufbau();
  const feste = kachel(container, 'Feste');
  assert.ok(feste.classList.contains('leer'));
  assert.equal(feste.disabled, false);
  assert.ok(!kachel(container, 'Konzerte').classList.contains('leer'));
  feste.click();
  assert.deepEqual(ctx.prefs.rubriken, ['fest']);
});

const KONZERT_G = 'Konzerte: Genre';
const konzerte = (...genres) => genres.map((genre, i) => ev({ title: `K${i}`, rubrik: 'konzert', genre, start: '2026-11-28T19:00:00+01:00' }));

test('leere Unterpunkte sind ausgeblendet', () => {
  const { container } = aufbau({ rubriken: ['konzert'] }, konzerte('jazz', 'klassik'));
  assert.equal(sorte(container, KONZERT_G, 'Jazz & Blues').hasAttribute('hidden'), false);
  assert.equal(sorte(container, KONZERT_G, 'Klassik & Chor').hasAttribute('hidden'), false);
  assert.equal(sorte(container, KONZERT_G, 'Rock & Pop').hasAttribute('hidden'), true);
  assert.equal(sorte(container, KONZERT_G, 'Sonstige Konzerte').hasAttribute('hidden'), true);
  assert.equal(sorte(container, KONZERT_G, 'Alle').hasAttribute('hidden'), false);
  assert.deepEqual(sichtbareGruppen(container), [KONZERT_G]);
});

test('ein gewählter Unterpunkt bleibt sichtbar, auch wenn er leer wird', () => {
  const alleAusserRock = ['metal-punk', 'klassik', 'kirche', 'jazz', 'schlager-folk', 'hiphop-elektro', 'sonstige'];
  const { container } = aufbau({ rubriken: ['konzert'], hiddenGenres: alleAusserRock }, konzerte('jazz'));
  const rock = sorte(container, KONZERT_G, 'Rock & Pop');
  assert.equal(rock.hasAttribute('hidden'), false);
  assert.equal(rock.getAttribute('aria-pressed'), 'true');
  assert.deepEqual(sichtbareGruppen(container), [KONZERT_G]);
});

test('weniger als zwei Unterpunkte mit Terminen: keine Gruppe', () => {
  const { container } = aufbau({ rubriken: ['konzert'] }, konzerte('jazz', 'jazz'));
  assert.deepEqual(sichtbareGruppen(container), []);
  assert.equal(gruppe(container, KONZERT_G).hasAttribute('hidden'), true);
});

test('14 Kacheln; die vorletzte ist Sport & Freizeit und hat keine Unterpunkt-Gruppe', () => {
  const { container } = aufbau({ rubriken: ['sport'] });
  const alle = kacheln(container);
  assert.equal(alle.length, 14);
  const sport = alle[12];
  assert.equal(sport.querySelector('.kachel-name').textContent, 'Sport & Freizeit');
  assert.ok(!sport.nextElementSibling?.classList.contains('sorten'));
});

test('den Advent-Schalter gibt es nicht mehr; ein altes prefs.advent filtert nichts', () => {
  const { container } = aufbau({ advent: true });
  assert.equal(container.querySelector('.schalter-advent'), null);
  assert.ok(!container.textContent.includes('Advent'));
  assert.equal(knopf(container).textContent, '2 Termine anzeigen');
});

test('Kalender: beim Start zugeklappt; der Chip "Kalender" klappt ihn auf und zu, ohne die Auswahl zu ändern', () => {
  const { container, ctx, aufrufe } = aufbau();
  const chipK = kalenderChip(container);
  assert.equal(kalenderbox(container).hasAttribute('hidden'), true);
  assert.equal(chipK.getAttribute('aria-expanded'), 'false');
  assert.equal(chipK.getAttribute('aria-controls'), kalenderbox(container).getAttribute('id'));
  assert.ok(chipK.nextElementSibling === chip(container, 'Alle'), 'der Chip steht vor "Alle"');
  chipK.click();
  assert.equal(kalenderbox(container).hasAttribute('hidden'), false);
  assert.equal(chipK.getAttribute('aria-expanded'), 'true');
  assert.equal(chipK.getAttribute('aria-pressed'), 'false', 'noch kein eigener Tag gewählt');
  assert.equal(ctx.prefs.zeit, 'wochenende');
  assert.equal(aufrufe.aenderung, 0);
  chipK.click();
  assert.equal(kalenderbox(container).hasAttribute('hidden'), true);
  assert.equal(chipK.getAttribute('aria-expanded'), 'false');
});

test('Kalender: bleibt beim Wählen von Tagen offen; eine Schnellwahl klappt ihn zu; der gewählte Zeitraum bleibt am Chip stehen', () => {
  const { container } = aufbau();
  const chipK = kalenderChip(container);
  chipK.click();
  tag(container, '2026-11-28').click();
  tag(container, '2026-11-29').click();
  assert.equal(kalenderbox(container).hasAttribute('hidden'), false);
  chipK.click();
  assert.equal(kalenderbox(container).hasAttribute('hidden'), true);
  assert.equal(chipK.textContent, 'Sa 28.11. – So 29.11.');
  assert.equal(chipK.getAttribute('aria-pressed'), 'true');
  chipK.click();
  chip(container, '7 Tage').click();
  assert.equal(kalenderbox(container).hasAttribute('hidden'), true);
  assert.equal(chipK.textContent, 'Kalender');
  assert.equal(chipK.getAttribute('aria-expanded'), 'false');
});

test('abgelaufener eigener Zeitraum (Seite stand über Nacht offen): Wochenende ist gedrückt, nicht der Kalender-Chip', () => {
  let jetzt = JETZT;
  const { container, ctx, seite } = aufbau({ zeit: 'tage', von: '2026-11-24', bis: '2026-11-24' });
  ctx.jetzt = () => jetzt;
  assert.equal(kalenderChip(container).getAttribute('aria-pressed'), 'true');
  jetzt = '2026-11-25T08:00:00Z';
  seite.aktualisieren();
  assert.equal(kalenderChip(container).getAttribute('aria-pressed'), 'false');
  assert.equal(kalenderChip(container).textContent, 'Kalender');
  assert.equal(chip(container, 'Wochenende').getAttribute('aria-pressed'), 'true');
});

test('Umkreis-Chip 25 km setzt maxKm, Ortsauswahl Görlitz setzt prefs.ort, Tschechien setzt showCZ', () => {
  const { container, ctx, aufrufe } = aufbau();
  assert.deepEqual([...container.querySelectorAll('.umkreis button.chip')].map((b) => b.textContent), ['10 km', '25 km', '50 km', '75 km']);
  assert.equal(chip(container, '75 km').getAttribute('aria-pressed'), 'true');
  chip(container, '25 km').click();
  assert.equal(ctx.prefs.maxKm, 25);
  assert.equal(chip(container, '25 km').getAttribute('aria-pressed'), 'true');
  assert.equal(chip(container, '75 km').getAttribute('aria-pressed'), 'false');
  const auswahl = container.querySelector('select.mittelpunkt');
  assert.equal(auswahl.value, 'Sebnitz');
  [...auswahl.querySelectorAll('option')].find((o) => o.textContent === 'Görlitz').selected = true;
  auswahl.dispatchEvent(new fenster.Event('change'));
  assert.equal(ctx.prefs.ort, 'Görlitz');
  const cz = container.querySelector('.tschechien input[type="checkbox"]');
  assert.equal(cz.checked, true);
  cz.checked = false;
  cz.dispatchEvent(new fenster.Event('change'));
  assert.equal(ctx.prefs.showCZ, false);
  assert.equal(aufrufe.aenderung, 3);
});

test('Knopftext und Klick auf den Knopf', () => {
  const { container, aufrufe } = aufbau();
  assert.equal(knopf(container).textContent, '2 Termine anzeigen');
  tag(container, '2026-11-25').click();
  assert.equal(knopf(container).textContent, 'Keine Termine gefunden');
  knopf(container).click();
  assert.equal(aufrufe.anzeigen, 1);
});

test('aktualisieren nach Austausch von ctx.events zählt neu, ohne beiAenderung', () => {
  const { container, ctx, aufrufe, seite } = aufbau();
  ctx.events = [];
  seite.aktualisieren();
  assert.equal(knopf(container).textContent, 'Keine Termine gefunden');
  assert.equal(zahlen(container).Konzerte, 0);
  assert.ok(!tag(container, '2026-11-24').classList.contains('punkt'));
  assert.equal(aufrufe.aenderung, 0);
});

test('ctx.laedt zeigt den Knopf gesperrt mit Ladehinweis', () => {
  const { container, ctx, seite } = aufbau();
  ctx.laedt = true;
  seite.aktualisieren();
  assert.equal(knopf(container).textContent, 'Termine werden geladen …');
  assert.equal(knopf(container).disabled, true);
  ctx.laedt = false;
  seite.aktualisieren();
  assert.equal(knopf(container).disabled, false);
});

test("Fremdwerte (Titel, Ortsnamen mit '<img …>') erzeugen kein img", () => {
  const { container } = aufbau({ zeit: 'alle' });
  assert.equal(container.querySelectorAll('img').length, 0);
  // Attributwerte dürfen "<" unmaskiert enthalten (HTML-Serialisierung); entscheidend ist, dass auch neu eingelesen kein img entsteht.
  const neu = parseHTML(`<!doctype html><html><body>${container.innerHTML}</body></html>`).document;
  assert.equal(neu.querySelectorAll('img').length, 0);
  assert.ok([...container.querySelectorAll('select.mittelpunkt option')].some((o) => o.textContent === BOESE));
});

/** Aufbau mit eigenem Zeitpunkt und eigenen Terminen (für den Startmonat des Kalenders). */
function aufbauAm(jetzt, events, prefsExtra = {}) {
  const container = document.createElement('div');
  document.body.append(container);
  const ctx = {
    prefs: { ...DEFAULT_PREFS, rubriken: [], hiddenGenres: [], hiddenTags: [], ...prefsExtra },
    events,
    orteListe: ORTE,
    orte: Object.fromEntries(ORTE.map((o) => [o.name, { lat: o.lat, lon: o.lon }])),
    jetzt: () => jetzt,
    beiAenderung: () => {},
    beiAnzeigen: () => {},
  };
  return { container, ctx, seite: baueFilterseite(document, container, ctx) };
}

const MAI = [
  ev({ title: 'Maifeuer', rubrik: 'fest', start: '2026-05-01T18:00:00+02:00' }),
  ev({ title: 'Aprilkonzert', rubrik: 'konzert', start: '2026-04-30T19:00:00+02:00' }),
];

test('Startmonat: Wochenende am Donnerstag 30. April beginnt am 1. Mai, der Kalender öffnet im Mai', () => {
  const { container } = aufbauAm('2026-04-30T08:00:00Z', MAI);
  assert.equal(container.querySelector('.monatsname').textContent, 'Mai 2026');
  for (const t of ['2026-05-01', '2026-05-02', '2026-05-03']) assert.ok(tag(container, t).classList.contains('gewaehlt'), t);
  assert.equal(container.querySelector('.monat-zurueck').disabled, false);
});

test('Startmonat: ohne Termine im Monat des Bereichs bleibt der Kalender im Monat von heute', () => {
  const { container } = aufbauAm('2026-04-30T08:00:00Z', [MAI[1]]);
  assert.equal(container.querySelector('.monatsname').textContent, 'April 2026');
});

test('Startmonat: werden die Termine erst nachgeladen, springt der Kalender in den Monat des Bereichs', () => {
  const { container, ctx, seite } = aufbauAm('2026-04-30T08:00:00Z', []);
  assert.equal(container.querySelector('.monatsname').textContent, 'April 2026');
  ctx.events = MAI;
  seite.aktualisieren();
  assert.equal(container.querySelector('.monatsname').textContent, 'Mai 2026');
});

test('Startmonat: nach dem Blättern bleibt der Kalender im geblätterten Monat', () => {
  const { container, seite } = aufbauAm('2026-04-30T08:00:00Z', MAI);
  container.querySelector('.monat-zurueck').click();
  assert.equal(container.querySelector('.monatsname').textContent, 'April 2026');
  seite.aktualisieren();
  assert.equal(container.querySelector('.monatsname').textContent, 'April 2026');
});

test('Monatspfeil mit Fokus wird gesperrt: der Fokus geht auf den anderen Pfeil', () => {
  const { container } = aufbau();
  const zurueck = container.querySelector('.monat-zurueck');
  const vor = container.querySelector('.monat-vor');
  // linkedom kennt keinen Fokus; activeElement und focus() werden hier nachgebildet.
  let aktiv = null;
  Object.defineProperty(document, 'activeElement', { configurable: true, get: () => aktiv });
  for (const b of [zurueck, vor]) b.focus = () => { aktiv = b; };
  try {
    vor.focus();
    vor.click(); // Dezember ist der letzte Monat mit Terminen
    assert.equal(vor.disabled, true);
    // assert.ok statt assert.equal: der Vergleich zweier linkedom-Knoten würde im Fehlerfall den ganzen Baum ausgeben
    assert.ok(aktiv === zurueck, 'Fokus auf dem Zurück-Pfeil');
    zurueck.click(); // zurück im November, dem ersten Monat
    assert.equal(zurueck.disabled, true);
    assert.ok(aktiv === vor, 'Fokus auf dem Vor-Pfeil');
  } finally {
    delete document.activeElement;
  }
});

test('ctx.fehler: Knopf nennt den Ladefehler und bleibt bedienbar (führt zur Liste mit der Meldung)', () => {
  const { container, ctx, aufrufe, seite } = aufbau();
  ctx.fehler = true;
  seite.aktualisieren();
  assert.equal(knopf(container).textContent, 'Termine konnten nicht geladen werden');
  assert.equal(knopf(container).disabled, false);
  knopf(container).click();
  assert.equal(aufrufe.anzeigen, 1);
  ctx.laedt = true;
  seite.aktualisieren();
  assert.equal(knopf(container).textContent, 'Termine werden geladen …');
  assert.equal(knopf(container).disabled, true);
  ctx.laedt = false;
  ctx.fehler = false;
  seite.aktualisieren();
  assert.notEqual(knopf(container).textContent, 'Termine konnten nicht geladen werden');
});

test('Schnellwahl nach dem Blättern: der Kalender zeigt wieder den Monat des markierten Bereichs', () => {
  const { container } = aufbau();
  const name = container.querySelector('.monatsname');
  container.querySelector('.monat-vor').click();
  assert.equal(name.textContent, 'Dezember 2026');
  chip(container, 'Heute').click();
  assert.equal(name.textContent, 'November 2026');
  container.querySelector('.monat-vor').click();
  chip(container, '7 Tage').click();
  assert.equal(name.textContent, 'November 2026');
});
