// Rubriken (Feld "rubrik" am Termin), die alten Arten (Feld "art") und die Unterarten (Feld "genre").
// Die Schlüssel und Namen entsprechen src/rubriken.js und src/normalize.js; die Seite kann diese Dateien nicht laden.
// Der Gleichlauf ist in test/normalize.test.js gesichert.

/**
 * Die 14 Rubriken in Kachelreihenfolge. name = Kachelname, karte = Einzahl für die Karte,
 * farbe = Farbfamilie (die Art in src/rubriken.js; die CSS-Klasse art-<farbe> bleibt).
 */
export const RUBRIKEN = [
  { key: 'konzert', name: 'Konzerte', karte: 'Konzert', farbe: 'konzert' },
  { key: 'markt', name: 'Märkte', karte: 'Markt', farbe: 'markt' },
  { key: 'ausstellung', name: 'Ausstellungen & Museen', karte: 'Ausstellung', farbe: 'schau' },
  { key: 'schau', name: 'Schauen', karte: 'Schau', farbe: 'schau' },
  { key: 'fest', name: 'Feste', karte: 'Fest', farbe: 'fest' },
  { key: 'party', name: 'Partys', karte: 'Party', farbe: 'party' },
  { key: 'fuehrung', name: 'Führungen', karte: 'Führung', farbe: 'sonstiges' },
  { key: 'wandern', name: 'Wandern & Natur', karte: 'Wandern & Natur', farbe: 'sonstiges' },
  { key: 'kurse', name: 'Kurse & Vorträge', karte: 'Kurs & Vortrag', farbe: 'sonstiges' },
  { key: 'theater', name: 'Theater & Lesungen', karte: 'Theater & Lesung', farbe: 'sonstiges' },
  { key: 'essen', name: 'Essen & Trinken', karte: 'Essen & Trinken', farbe: 'sonstiges' },
  { key: 'kinder', name: 'Kinder & Familie', karte: 'Kinder & Familie', farbe: 'sonstiges' },
  { key: 'sport', name: 'Sport & Freizeit', karte: 'Sport & Freizeit', farbe: 'sonstiges' },
  { key: 'sonstiges', name: 'Sonstiges', karte: 'Sonstiges', farbe: 'sonstiges' },
];

const RUBRIK = new Map(RUBRIKEN.map((r) => [r.key, r]));

/** Alte Daten ohne Feld rubrik: die Rubrik folgt der Art. */
const RUBRIK_NACH_ART = { konzert: 'konzert', markt: 'markt', party: 'party', fest: 'fest', schau: 'schau', sonstiges: 'sonstiges' };

/** Die Rubrik des Termins: e.rubrik, wenn bekannt; sonst nach e.art; Unbekanntes ist "sonstiges". */
export function rubrikVon(e) {
  if (typeof e?.rubrik === 'string' && RUBRIK.has(e.rubrik)) return e.rubrik;
  return typeof e?.art === 'string' && Object.hasOwn(RUBRIK_NACH_ART, e.art) ? RUBRIK_NACH_ART[e.art] : 'sonstiges';
}

/** Kachelname einer Rubrik ("Konzerte"); Unbekanntes heißt "Sonstiges". */
export const rubrikName = (key) => (RUBRIK.get(key) ?? RUBRIK.get('sonstiges')).name;

/** Einzahl für die Karte ("Konzert"); Unbekanntes heißt "Sonstiges". */
export const rubrikKarte = (key) => (RUBRIK.get(key) ?? RUBRIK.get('sonstiges')).karte;

/** Farbfamilie einer Rubrik (CSS-Klasse art-<farbe>, wie die Kachel); Unbekanntes ist "sonstiges". */
export const rubrikFarbe = (key) => (RUBRIK.get(key) ?? RUBRIK.get('sonstiges')).farbe;

/** Je Rubrik mit Unterarten, Reihenfolge = Reihenfolge der Filterknöpfe. "sonstige" gilt für Termine dieser Rubrik ohne bekannte Unterart. */
export const SORTEN = {
  konzert: {
    titel: 'Konzerte: Genre',
    sonstige: 'sonstige',
    sonstigeText: 'Sonstige Konzerte',
    liste: {
      'rock-pop': 'Rock & Pop', 'metal-punk': 'Metal & Punk', klassik: 'Klassik & Chor', kirche: 'Kirchenmusik', jazz: 'Jazz & Blues',
      'schlager-folk': 'Schlager & Folk', 'hiphop-elektro': 'Hip-Hop & Elektro',
    },
  },
  party: {
    titel: 'Partys: Sorte',
    sonstige: 'sonstige-party',
    sonstigeText: 'Sonstige Partys',
    liste: { disco: 'Disco & Tanz', club: 'Club & DJ', silvester: 'Silvester & Ball', fasching: 'Fasching & Karneval' },
  },
  markt: {
    titel: 'Märkte: Sorte',
    sonstige: 'sonstige-markt',
    sonstigeText: 'Sonstige Märkte',
    liste: { weihnachtsmarkt: 'Weihnachtsmarkt', troedel: 'Flohmarkt & Trödel', handwerk: 'Handwerk & Kunst', bauern: 'Bauern- & Wochenmarkt' },
  },
  fest: {
    titel: 'Feste: Sorte',
    sonstige: 'sonstige-fest',
    sonstigeText: 'Sonstige Feste',
    liste: {
      familie: 'Familie & Kinder', stadtfest: 'Stadt- & Dorffest', weihnachten: 'Weihnachten & Lichter',
      brauchtum: 'Brauchtum', festival: 'Festival',
    },
  },
  schau: {
    titel: 'Schauen: Sorte',
    sonstige: 'sonstige-schau',
    sonstigeText: 'Sonstige Schauen',
    liste: { tiere: 'Tier- & Zuchtschau', hobby: 'Messe & Hobby' },
  },
  ausstellung: {
    titel: 'Ausstellungen: Sorte',
    sonstige: 'sonstige-ausstellung',
    sonstigeText: 'Sonstige Ausstellungen',
    liste: { kunst: 'Kunst & Foto', museum: 'Museum & Geschichte' },
  },
  fuehrung: {
    titel: 'Führungen: Sorte',
    sonstige: 'sonstige-fuehrung',
    sonstigeText: 'Sonstige Führungen',
    liste: {
      stadt: 'Stadt & Ort', untertage: 'Untertage & Bergwerk', brauerei: 'Brauerei & Bäckerei', kinder: 'Kinderführung',
      hausfuehrung: 'Museum & Schloss', bahn: 'Sonderfahrt Bahn',
    },
  },
  wandern: {
    titel: 'Wandern & Natur: Sorte',
    sonstige: 'sonstige-wandern',
    sonstigeText: 'Sonstige Touren',
    liste: { wanderung: 'Geführte Wanderung', spaziergang: 'Spaziergang & Rundgang', natur: 'Tiere & Natur' },
  },
  kurse: {
    titel: 'Kurse & Vorträge: Sorte',
    sonstige: 'sonstige-kurse',
    sonstigeText: 'Sonstige Kurse',
    liste: {
      vortrag: 'Vortrag & Reisebericht', kreativ: 'Kreativ, Handwerk & Kochen', bewegung: 'Bewegung & Entspannung',
      lernen: 'Computer, Sprache & Beruf',
    },
  },
  theater: {
    titel: 'Theater & Lesungen: Sorte',
    sonstige: 'sonstige-theater',
    sonstigeText: 'Sonstiges Theater',
    liste: {
      schauspiel: 'Schauspiel & Oper', lesung: 'Lesung & Literatur', kabarett: 'Kabarett & Comedy', kino: 'Kino & Film',
      show: 'Show, Zirkus & Musical',
    },
  },
  essen: {
    titel: 'Essen & Trinken: Sorte',
    sonstige: 'sonstige-essen',
    sonstigeText: 'Sonstiges Essen',
    liste: { dinner: 'Dinner & Menü', brunch: 'Brunch', verkostung: 'Verkostung' },
  },
  kinder: {
    titel: 'Kinder & Familie: Sorte',
    sonstige: 'sonstige-kinder',
    sonstigeText: 'Sonstiges für Kinder',
    liste: { 'kinder-buehne': 'Theater, Kino & Musik', 'kinder-mitmachen': 'Basteln, Backen & Mitmachen', 'kinder-lernen': 'Lesen & Lernen' },
  },
};

/**
 * Die Unterart, nach der gefiltert wird: der Schlüssel des Termins, wenn er zur Rubrik passt, sonst der "sonstige"-Schlüssel der Rubrik.
 * Ein Genre, das die Rubrik nicht (mehr) kennt (alte Daten), zählt als "sonstige". Rubriken ohne Unterarten liefern null.
 */
export function sorteFilter(e) {
  const rubrik = rubrikVon(e);
  const def = Object.hasOwn(SORTEN, rubrik) ? SORTEN[rubrik] : null;
  if (!def) return null;
  return typeof e.genre === 'string' && Object.hasOwn(def.liste, e.genre) ? e.genre : def.sonstige;
}

/** Der Anzeigename der Unterart für die Karte; null, wenn unbekannt oder nicht zur Rubrik gehörig. */
export function sorteName(e) {
  const rubrik = rubrikVon(e);
  const def = Object.hasOwn(SORTEN, rubrik) ? SORTEN[rubrik] : null;
  return def && typeof e.genre === 'string' && Object.hasOwn(def.liste, e.genre) ? def.liste[e.genre] : null;
}

const SPRACHE_HINWEIS = { cs: 'auf Tschechisch', pl: 'auf Polnisch' };
const SPRACHE_RUBRIKEN = new Set(['theater', 'kurse', 'fuehrung', 'kinder']);

/** Der Sprachhinweis für die Karte; nur bei Theater, Kursen, Führungen und Kinderprogramm und nur für bekannte Werte, sonst null. */
export function sprachHinweis(e) {
  if (!SPRACHE_RUBRIKEN.has(rubrikVon(e))) return null;
  return typeof e?.sprache === 'string' && Object.hasOwn(SPRACHE_HINWEIS, e.sprache) ? SPRACHE_HINWEIS[e.sprache] : null;
}
