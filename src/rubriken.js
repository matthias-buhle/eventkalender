import { GENRES, MARKT_SORTEN, PARTY_SORTEN, FEST_SORTEN, detectSorte, passendeSorte } from './normalize.js';

/**
 * Die 13 Rubriken in Kachelreihenfolge. name = Kachelname, karte = Einzahl für die Karte,
 * art = bestehende Farbfamilie (Feld art der Termine bleibt unverändert).
 */
export const RUBRIKEN = [
  { key: 'konzert', name: 'Konzerte', karte: 'Konzert', art: 'konzert' },
  { key: 'markt', name: 'Märkte', karte: 'Markt', art: 'markt' },
  { key: 'ausstellung', name: 'Ausstellungen & Museen', karte: 'Ausstellung', art: 'schau' },
  { key: 'schau', name: 'Schauen', karte: 'Schau', art: 'schau' },
  { key: 'fest', name: 'Feste', karte: 'Fest', art: 'fest' },
  { key: 'party', name: 'Partys', karte: 'Party', art: 'party' },
  { key: 'fuehrung', name: 'Führungen', karte: 'Führung', art: 'sonstiges' },
  { key: 'wandern', name: 'Wandern & Natur', karte: 'Wandern & Natur', art: 'sonstiges' },
  { key: 'kurse', name: 'Kurse & Vorträge', karte: 'Kurs & Vortrag', art: 'sonstiges' },
  { key: 'theater', name: 'Theater & Lesungen', karte: 'Theater & Lesung', art: 'sonstiges' },
  { key: 'essen', name: 'Essen & Trinken', karte: 'Essen & Trinken', art: 'sonstiges' },
  { key: 'kinder', name: 'Kinder & Familie', karte: 'Kinder & Familie', art: 'sonstiges' },
  { key: 'sonstiges', name: 'Sonstiges', karte: 'Sonstiges', art: 'sonstiges' },
];

const SCHAU_UNTER = { tiere: 'Tier- & Zuchtschau', hobby: 'Messe & Hobby' };
const AUSSTELLUNG_UNTER = { kunst: 'Kunst & Foto', museum: 'Museum & Geschichte' };
const FUEHRUNG_UNTER = { stadt: 'Stadt & Ort', untertage: 'Untertage & Bergwerk', brauerei: 'Brauerei & Bäckerei', kinder: 'Kinderführung' };

/** Unterfilter je Rubrik (Schlüssel → Anzeigename). Rubriken ohne Eintrag haben keine. */
export const UNTERARTEN = {
  konzert: GENRES,
  markt: MARKT_SORTEN,
  party: PARTY_SORTEN,
  fest: FEST_SORTEN,
  schau: SCHAU_UNTER,
  ausstellung: AUSSTELLUNG_UNTER,
  fuehrung: FUEHRUNG_UNTER,
};

// Einführung, Vorführung, Aufführung, Durchführung, Ausführung, Verführung sind keine Führungen; Weinführung, Steinführung schon ("ein" zählt nur als ganzes Wort).
const FUEHRUNG = /(?<!vor|auf|durch|aus|ver|(?<![a-zäöü])ein)f[uü]hrung|rundgang|besichtigung|stadtrundfahrt|nachtw[aä]chter/;

// Reihenfolge = Vorrang (erste passende Regel gewinnt): Führung vor Theater vor Kurse ... vor Kinder, zuletzt Konzert. Für alle Termine der Art "sonstiges"; Titel vor Beschreibung.
const REGELN = /** @type {[string, RegExp][]} */ ([
  ['fuehrung', FUEHRUNG],
  ['theater', /theater|lesung|vorlese|b[uü]hne|schauspiel|puppenspiel|kabarett|\bkino\b|\bfilm\b|oper\b|autorengespr|vorf[uü]hrung|auff[uü]hrung|ballett|musical|poetry|\bslam\b|travestie|\bliest\b|buchvorstellung|literatur|revue|\bshow\b|zirkus|circus|cyrkus|divadel|kom[oö]die|marionett|zauberer/],
  ['kurse', /\bkurs\b|kurse?n?\b|workshop|vortrag|seminar|schulung|infoabend|lehrgang|sprechstunde|kinderuni|weiterbildung|ratgeber|reisebericht|photowalk|\byoga|meditation|kreativ|stammtisch|reparatur|biografie|maltreff|malnachmittag|h[aä]kel|\bvhs\b|feedback/],
  ['wandern', /wander|spaziergang|exkursion|radtour|nachtwanderung|vogelbeobacht|naturf|artenschutz|naturschutz|offenland|vivarium|tierpark|schauf[uü]tter|erdm[aä]nn|\bzoo\b/],
  ['essen', /\bessen\b|(?:abend|mittag|sonntags|festtags|weihnachts|fest)essen\b|kulinar|brunch|dinner|verkostung|\bwein|\bbier|brauerei|backen|k[oö]chen|schlachtfest|g[aä]nse|gans\b|grill|fr[uü]hst[uü]ck|kaffee|kuchen|gl[uü]hwein|tasting|whisky|schmaus|abendbrot|baudenabend/],
  ['kinder', /kinder|familie|m[aä]rchen|krabbel|ferienprogramm|basteln|d[aä]umling|rumpelkammer|fusselkopf|\bshaun\b|kuscheltier|spielend/],
  ['konzert', /konzert|musik|requiem|oratori|kantate|matinee|orgel|vesper|singen\b|\bchor\b|klangschal|klangreise|\bgesang|\bband\b|tribute|hosianna|lieder|philharmon|orchester|bl[aä]ser|sinfon|symphon|klavier|streichorch|streichquartett|streicher\b|quartett|saxophon|piano|violin/],
]);

// Führungs-Unterarten, Reihenfolge = Vorrang.
const FUEHRUNG_REGELN = /** @type {[string, RegExp][]} */ ([
  ['kinder', /kinder|familie/],
  ['untertage', /bergwerk|untertage|stollen|h[oö]hle|schacht|bergbau|salz/],
  ['brauerei', /brau|b[aä]cker|m[uü]hle|manufaktur|distill|r[oö]sterei/],
  ['stadt', /stadt|altstadt|rundgang|dorf|spazier/],
]);

const BESCHREIBUNG_ZEICHEN = 200;
const klein = (x) => (typeof x === 'string' ? x.toLowerCase() : '');

/** Erster Treffer, Titel vor Beschreibung. */
function ersteRegel(regeln, titel, beschreibung) {
  for (const t of [titel, beschreibung]) {
    if (!t) continue;
    for (const [schluessel, regel] of regeln) if (regel.test(t)) return schluessel;
  }
  return null;
}

/**
 * Ordnet einen Termin genau einer Rubrik zu und bestimmt die Unterart (Feld genre).
 * Das Feld art bleibt davon unberührt. Wirft nie; Unbekanntes wird "sonstiges".
 * @param {{art?:string, genre?:string|null, title?:string, description?:string|null, placeName?:string}} e
 * @returns {{rubrik:string, genre:string|null}}
 */
export function rubrikUndGenre(e) {
  const art = e?.art;
  const titel = klein(e?.title);
  // Beschreibungen sind lang und verrauscht ("Kaffee", "Kinder" kommen überall vor): nur der Anfang zählt.
  const beschreibung = klein(e?.description).slice(0, BESCHREIBUNG_ZEICHEN);
  const sorte = (a) => passendeSorte(a, e?.genre) ?? detectSorte(a, e?.title, e?.description);

  if (art === 'konzert' || art === 'markt' || art === 'party' || art === 'fest') return { rubrik: art, genre: sorte(art) };

  if (art === 'schau') {
    if (FUEHRUNG.test(titel)) return fuehrung(titel, beschreibung);
    const s = sorte('schau');
    if (s === 'kunst' || s === 'museum') return { rubrik: 'ausstellung', genre: s };
    if (s === 'tiere' || s === 'hobby') return { rubrik: 'schau', genre: s };
    return { rubrik: /ausstellung/.test(titel) || /ausstellung/.test(beschreibung) ? 'ausstellung' : 'schau', genre: null };
  }

  // Musik-Stichwörter zählen nur im Titel; in Beschreibungen kommen sie bei allem Möglichen vor.
  const rubrik = ersteRegel(REGELN, titel) ?? ersteRegel(REGELN.filter(([k]) => k !== 'konzert'), beschreibung);
  if (rubrik === 'fuehrung') return fuehrung(titel, beschreibung);
  if (rubrik === 'konzert') return { rubrik, genre: detectSorte('konzert', e?.title, e?.description) };
  if (rubrik) return { rubrik, genre: null };
  // Letzter Anhaltspunkt: das Haus ("Theater Görlitz", "Kunstbauerkino").
  return { rubrik: /theater|kino/.test(klein(e?.placeName)) ? 'theater' : 'sonstiges', genre: null };
}

function fuehrung(titel, beschreibung) {
  return { rubrik: 'fuehrung', genre: ersteRegel(FUEHRUNG_REGELN, titel, beschreibung) };
}
