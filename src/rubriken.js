import { GENRES, MARKT_SORTEN, PARTY_SORTEN, FEST_SORTEN, detectGenre, detectSorte, passendeSorte } from './normalize.js';
import { FUEHRUNG_UNTER, WANDERN_UNTER, KURSE_UNTER, THEATER_UNTER, ESSEN_UNTER, KINDER_UNTER, BAHN, THEATER_HAUS, KINO_HAUS, unterpunkt } from './unterpunkte.js';

/**
 * Die 14 Rubriken in Kachelreihenfolge. name = Kachelname, karte = Einzahl für die Karte,
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
  { key: 'sport', name: 'Sport & Freizeit', karte: 'Sport & Freizeit', art: 'sonstiges' },
  { key: 'sonstiges', name: 'Sonstiges', karte: 'Sonstiges', art: 'sonstiges' },
];

const SCHAU_UNTER = { tiere: 'Tier- & Zuchtschau', hobby: 'Messe & Hobby' };
const AUSSTELLUNG_UNTER = { kunst: 'Kunst & Foto', museum: 'Museum & Geschichte' };
/** Unterfilter je Rubrik (Schlüssel → Anzeigename). Rubriken ohne Eintrag haben keine. */
export const UNTERARTEN = {
  konzert: GENRES,
  markt: MARKT_SORTEN,
  party: PARTY_SORTEN,
  fest: FEST_SORTEN,
  schau: SCHAU_UNTER,
  ausstellung: AUSSTELLUNG_UNTER,
  fuehrung: FUEHRUNG_UNTER,
  wandern: WANDERN_UNTER,
  kurse: KURSE_UNTER,
  theater: THEATER_UNTER,
  essen: ESSEN_UNTER,
  kinder: KINDER_UNTER,
};

// Einführung, Vorführung, Aufführung, Durchführung, Ausführung, Verführung sind keine Führungen; Weinführung, Steinführung schon ("aus" und "ein" zählen nur als ganzes Wort: Haus-, Rathaus-, Wein-, Steinführung sind Führungen).
// Führungskräfte, Führungsstil, Führung auf Distanz sind Kursthemen. Touren und Lichterfahrten sind Führungen (Entscheidung 9).
const FUEHRUNG = /(?<!vor|auf|durch|ver|\b(?:aus|ein))f[uü]hrung(?!skr[aä]ft|sstil|skompetenz| auf distanz)|rundgang|besichtigung|stadtrundfahrt|nachtw[aä]chter|zwiedzanie|prohl[ií]dk|stadtschleicher|lichterfahrt|(?:stadt|altstadt|kneipen|gl[uü]hwein|laternen|fackel|m[uü]hlen|weihnachts)tour\b/;
// "märchenhaft" ist ein Beiwort (Adventsshopping, Nacht mit dem Karnevalsclub), kein Märchen.
const KINDER = /kinder|\bkids?\b|m[aä]rchen(?!haft)|krabbel|ferienprogramm|basteln|puppentheater|kasper|ka[sš]p[aá]rek|puppenspiel|puppenb[uü]hne|theater der puppen|marionetten|(?<!sport.{0,8})familienwochenende|familien(?:tag|nachmittag|sonntag|programm|theater|zeit|kino|vorstellung|konzert|st[uü]ck|musical|angebot)|f[uü]r (?:die ganze )?famili/;
// In der Beschreibung zählen nur Wendungen, die das Publikum nennen ("Kinder" allein kommt überall vor).
// Altersangaben nur im Kinderalter (bis 12): "Einlass ab 18 Jahren" ist kein Kinderprogramm.
const KINDER_BESCHREIBUNG = /f[uü]r kinder|mit (?:euren|ihren) kindern|f[uü]r unsere kleinen|puppenm[aä]rchen|puppenspiel|\bab (?:drei|vier|f[uü]nf|sechs|sieben|acht|neun|zehn)\b(?! (?:uhr|euro|personen|teilnehmer|wochen|monat|minuten|tage|stunden))|\b(?:[1-9]|1[0-2]) ?(?:bis|[-–]) ?(?:[1-9]|1[0-2]) jahre|\bab (?:[1-9]|1[0-2]) jahren?\b|kindertheater|puppentheater|familienprogramm/;
const THEATER = /theater|lesung|vorlese|b[uü]hne|schauspiel|puppenspiel|kabarett|\bkino\b|\bfilm\b|oper\b|autorengespr|auff[uü]hrung|ballett|musical|poetry|\bslam\b|travestie|\bliest\b|buchvorstellung|literatur|revue|\bshow\b|zirkus|circus|cyrkus|divadel|kom[oö]die|marionett|zauberer|filmvorf[uü]hrung|kurzfilm|filmabend|filmnachmittag|filmgespr[aä]ch|sommerkino|comedy|stand.?up|satire|signierstunde|buchpremiere|variet/;
const KURSE = /\bkurs\b|kurse?n?\b|workshop|vortrag|seminar|schulung|infoabend|lehrgang|sprechstunde|kinderuni|weiterbildung|ratgeber|reisebericht|photowalk|\byoga|meditation|kreativ|stammtisch|reparatur|biografie|maltreff|malnachmittag|h[aä]kel|\bvhs\b|feedback|bastelei|reportage|podiumsgespr|diskussion|diskutiert|wissensvermittlung/;
const SPORT = /\bsport\b|eislauf|schlittschuh|tischtennis|kegel|bowling|skat\b|skatturnier|spiele(?:abend|nachmittag|tag|treff)|brettspiel|turnier|volleyball|fu[sß]ball|handball|basketball|eishockey|heimspiel|marathon|\blauf\b|(?:stadt|volks|silvester|advents|nikolaus|cross|berg|wald|spenden|benefiz|neujahrs)lauf\b|schwimm|tanzsport|billard|\bdart|schach(?!t)|wettkampf|meisterschaft/;
const WANDERN = /wander|spaziergang|exkursion|radtour|nachtwanderung|vogelbeobacht|naturf|artenschutz|naturschutz|offenland|vivarium|tierpark|schauf[uü]tter|erdm[aä]nn|\bzoo\b/;
// Essen nur im Titel: "Kaffee und Kuchen" in der Beschreibung macht noch kein Essen (Entscheidung 14).
const ESSEN = /brunch|dinner|men[uü]\b|verkostung|weinprobe|bierprobe|tasting|whisky|kulinar|fr[uü]hst[uü]ck|schmaus|buffet|kaffeeklatsch|\bessen\b|(?:abend|mittag|sonntags|festtags|weihnachts|gourmet|ritter|wein|g[aä]nse|enten|schlacht)essen\b|g[aä]nsebraten|martinsgans|baudenabend|h[uü]ttenabend|grill|kochshow/;
const BRAUCHTUM = { test: (/** @type {string} */ t) => detectSorte('fest', t) === 'brauchtum' };
const PARTY = /party|disco|disko|\bball\b|tanzabend|tanznacht|fasching|karneval|\bbkc\b|legt auf|silvester/;
const AUSSTELLUNG = /vernissage|finissage|ausstellung|zeichnungen|druckgrafik|malerei|fotografien|skulpturen/;
const KONZERT = /konzert|musik|requiem|oratori|kantate|matinee|orgel|vesper|singen\b|\bchor\b|klangschal|klangreise|\bgesang|\bband\b|tribute|hosianna|(?<!g)lieder|philharmon|orchester|bl[aä]ser|sinfon|symphon|klavier|streichorch|streichquartett|streicher\b|quartett|saxophon|\bpiano|violin|kl[aä]nge\b|gitarr|guitar|\btrio\b|\balbum/;

// Rangfolge für die Art "sonstiges" (und jede unbekannte Art); erste passende Stufe gewinnt.
// Stufe 1: die Christnacht ist Kirchenmusik.
const CHRISTNACHT = /christmette|christvesper|christnacht/;
// Stufe 2: starke Wörter im Titel, Reihenfolge = Vorrang.
const TITEL_REGELN = /** @type {[string, {test(t:string):boolean}][]} */ ([
  ['fuehrung', FUEHRUNG],
  ['fuehrung', BAHN],
  ['kinder', KINDER],
  ['theater', THEATER],
  ['kurse', KURSE],
  ['sport', SPORT],
  ['wandern', WANDERN],
  ['essen', ESSEN],
  ['fest', BRAUCHTUM],
  ['party', PARTY],
  ['ausstellung', AUSSTELLUNG],
  ['konzert', KONZERT],
]);
// Stufe 3: die Spielstätte.
const SPIELSTAETTEN = /** @type {[string, RegExp][]} */ ([
  ['theater', new RegExp(`${THEATER_HAUS.source}|${KINO_HAUS.source}`)],
  ['sternwarte', /sternwarte|planetarium/],
  ['kurse', /volkshochschule|\bk?vhs\b/],
  ['konzert', /hutbergb[uü]hne/],
]);
// Kammermusik und Streicher in der Beschreibung (der Titel nennt sie oft nicht); steht am Ende, damit Vortrag und Co. vorgehen.
const KAMMERMUSIK = /streichquartett|streichquintett|streichsextett|streichtrio|streichorchester|kammermusik|kammerorchester|sinfoniekonzert/;
// Festakte im Theaterhaus sind kein Theater: die Spielstätte allein macht dann keine Rubrik.
const FESTAKT = /verleiht|verleihung|(?<!l|k|ver)ehrung|empfang|(?<!prunk)sitzung|versammlung/;
// Stufe 4: der Anfang der Beschreibung, nur für diese Rubriken; er nennt die Gattung und zählt deshalb vor der Jahreszeit.
const BESCHREIBUNG_REGELN = /** @type {[string, RegExp][]} */ ([
  ['fuehrung', FUEHRUNG],
  ['fuehrung', BAHN],
  ['kinder', KINDER_BESCHREIBUNG],
  ['theater', THEATER],
  ['kurse', KURSE],
  ['wandern', WANDERN],
  ['konzert', KAMMERMUSIK],
]);
// Stufe 5: die Jahreszeit im Titel ist nur das Thema, ein schwacher Hinweis.
const JAHRESZEIT = /advent(?!ure|urer)|weihnacht|nikolaus|christkind|pyramide|winterzauber|lichterfest|lichtelfest/;

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
 * Der Unterpunkt-Hinweis, den der Adapter geliefert hat. Nach dem Einordnen steht er im Feld genreQuelle, weil genre
 * dann das Ergebnis ist; frisch vom Adapter (noch ohne rubrik) ist es das Feld genre selbst. Im alten gespeicherten
 * Format ist genre errechnet und kein Hinweis.
 * @param {{genre?:string|null, rubrik?:string|null, genreQuelle?:string|null}|undefined} e
 * @returns {string|null}
 */
export function quellHinweis(e) {
  if (e && Object.hasOwn(e, 'genreQuelle')) return e.genreQuelle;
  if (e?.rubrik == null) return e?.genre ?? null;
  return null;
}

/**
 * Der Unterpunkt für Führung, Wandern, Kurse, Theater, Essen und Kinder: der Hinweis der Quelle, wenn er in der Liste der
 * Rubrik steht, sonst aus Titel, Beschreibung und Spielstätte.
 */
function unterRubrik(rubrik, e) {
  const hinweis = quellHinweis(e);
  if (hinweis && Object.hasOwn(UNTERARTEN[rubrik], hinweis)) return hinweis;
  return unterpunkt(rubrik, e?.title, e?.description, e?.placeName);
}

// Räume, in denen Klassik zur Kirchenmusik wird ("Dom kultury" ist ein Kulturhaus, kein Dom).
const KIRCHENRAUM = /kirche|\bdom\b(?! kultury)|kloster|kapelle|m[uü]nster/;

/**
 * Der Unterpunkt eines Konzerts aus Hinweis der Quelle, Titel, Beschreibung und Spielstätte. Klassik im Kirchenraum
 * oder mit Kirchen-Stichwort im Titel (Orgel, Vesper …) ist Kirchenmusik; andere Hinweise (Rock, Jazz …) bleiben.
 * @param {{genre?:string|null, rubrik?:string|null, genreQuelle?:string|null, title?:string, description?:string|null, placeName?:string}} e
 * @returns {string|null}
 */
function konzertUnterpunkt(e) {
  const g = passendeSorte('konzert', quellHinweis(e)) ?? detectGenre(e?.title, e?.description);
  if (g === 'klassik' && (detectGenre(e?.title) === 'kirche' || KIRCHENRAUM.test(klein(e?.placeName)))) return 'kirche';
  return g;
}

// Konzerte der Quelle, die keine sind (Reihenfolge = Vorrang). Beschreibungsanfang zählt nur bei den Wörtern, die ihn tragen.
const KONZERT_KINDER = /kinderkonzert|familienkonzert|taschenlampenkonzert|kinderlieder|kindermusical|f[uü]r kinder/;
const KONZERT_KABARETT = /kabarett|cabaret|comedy|comedian|stand.?up|satire/;
const KONZERT_LESUNG = /lesung|\bliest\b|buchvorstellung|buchpremiere|autorengespr|poetry/;
const KONZERT_SHOW = /musical|zirkus|circus|travestie|zauberer|zauberei|zaubershow|variet/;
const KONZERT_SHOW_WEICH = /\bshow\b|revue/;
const KONZERT_SHOW_NICHT = /konzert|tribute|revival|\blive\b/;
const KONZERT_SCHAUSPIEL = /theaterst[uü]ck|theatererlebnis|schauspiel(?!haus)/;

function konzertRubrik(e, titel, beschreibung) {
  const beides = (regel) => regel.test(titel) || regel.test(beschreibung);
  if (KONZERT_KINDER.test(titel)) return { rubrik: 'kinder', genre: 'kinder-buehne' };
  if (beides(KONZERT_KABARETT)) return { rubrik: 'theater', genre: 'kabarett' };
  if (beides(KONZERT_LESUNG)) return { rubrik: 'theater', genre: 'lesung' };
  if (KONZERT_SHOW.test(titel) && detectGenre(e?.title) === null) return { rubrik: 'theater', genre: 'show' };
  if (KONZERT_SHOW_WEICH.test(titel) && detectGenre(e?.title) === null && !KONZERT_SHOW_NICHT.test(titel) && !/club/.test(klein(e?.placeName))) return { rubrik: 'theater', genre: 'show' };
  if (beides(KONZERT_SCHAUSPIEL)) return { rubrik: 'theater', genre: 'schauspiel' };
  return { rubrik: 'konzert', genre: konzertUnterpunkt(e) };
}

// Lichter- und Adventstermine ohne Marktwort sind Feste ("Weihnacht" allein bleibt Markt).
const MARKT_FEST = /lichter|lichtel|advent(?!ure|urer)|laternenzug|laternenumzug|bergparade|pyramidenfest|weihnachtsfest/;
// Lichterzug und Bergparade sind hier Advents-Termine (nicht Brauchtum); andere Sorten (Laternen: Familie, Mettenschicht: Brauchtum) bleiben.
function marktFestSorte(titel) {
  const s = detectSorte('fest', titel);
  if (s === 'brauchtum' && /lichterzug|bergparade/.test(klein(titel))) return 'weihnachten';
  return s ?? 'weihnachten';
}
const FEST_KINO = /filmfest|kurzfilm|kinofest/;
const FEST_ESSEN = /weinfest|winzerfest|bierfest|street.?food|schlemmerfest|food.?festival/;
const FEST_SPORT = /turnier|marathon|\blauf\b|(?:stadt|volks|silvester|advents|nikolaus|cross|berg|wald|spenden|benefiz|neujahrs)lauf\b/;

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
  const sorte = (a) => passendeSorte(a, quellHinweis(e)) ??detectSorte(a, e?.title, e?.description);

  if (art === 'konzert') return konzertRubrik(e, titel, beschreibung);

  if (art === 'markt') {
    if (MARKT_FEST.test(titel) && !/markt|m[aä]rkt|basar|bazar/.test(titel)) return { rubrik: 'fest', genre: marktFestSorte(e?.title) };
    return { rubrik: 'markt', genre: sorte('markt') };
  }

  if (art === 'fest') {
    if (FEST_KINO.test(titel)) return { rubrik: 'theater', genre: 'kino' };
    if (FEST_ESSEN.test(titel)) return { rubrik: 'essen', genre: unterRubrik('essen', e) };
    if (FEST_SPORT.test(titel) && !/sportfest/.test(titel)) return { rubrik: 'sport', genre: null };
    return { rubrik: 'fest', genre: sorte('fest') };
  }

  if (art === 'party') {
    if (/tanzturnier|tanzsport/.test(titel)) return { rubrik: 'sport', genre: null };
    if (/tanzkurs|tanzschule|tanzworkshop/.test(titel)) return { rubrik: 'kurse', genre: 'bewegung' };
    return { rubrik: 'party', genre: sorte('party') };
  }

  if (art === 'schau') {
    if (FUEHRUNG.test(titel)) return { rubrik: 'fuehrung', genre: unterRubrik('fuehrung', e) };
    const s = sorte('schau');
    if (s === 'kunst' || s === 'museum') return { rubrik: 'ausstellung', genre: s };
    if (s === 'tiere' || s === 'hobby') return { rubrik: 'schau', genre: s };
    return { rubrik: /ausstellung/.test(titel) || /ausstellung/.test(beschreibung) ? 'ausstellung' : 'schau', genre: null };
  }

  return sonstigesRubrik(e, titel, beschreibung);
}

/** Rangfolge für die Art "sonstiges" und jede unbekannte Art (siehe Stufen oben). */
function sonstigesRubrik(e, titel, beschreibung) {
  if (CHRISTNACHT.test(titel)) return { rubrik: 'konzert', genre: 'kirche' };
  const ausTitel = ersteRegel(TITEL_REGELN, titel);
  if (ausTitel) return ergebnis(ausTitel, e, titel, beschreibung);
  let haus = ersteRegel(SPIELSTAETTEN, klein(e?.placeName));
  if (haus === 'theater' && FESTAKT.test(titel)) haus = null;
  if (haus === 'sternwarte') return { rubrik: 'kurse', genre: 'vortrag' };
  if (haus) return ergebnis(haus, e, titel, beschreibung);
  // Musik-, Essens- und Sportwörter zählen nur im Titel; in Beschreibungen kommen sie bei allem Möglichen vor.
  const ausBeschreibung = ersteRegel(BESCHREIBUNG_REGELN, beschreibung);
  if (ausBeschreibung && !(ausBeschreibung === 'konzert' && FESTAKT.test(titel))) return ergebnis(ausBeschreibung, e, titel, beschreibung);
  if (JAHRESZEIT.test(titel)) return { rubrik: 'fest', genre: 'weihnachten' };
  return { rubrik: 'sonstiges', genre: null };
}

/** Rubrik und Unterpunkt zu einer Rubrik aus der Rangfolge. Unterpunkte gibt es nicht für Sport und Sonstiges. */
function ergebnis(rubrik, e, titel, beschreibung) {
  if (rubrik === 'konzert') return konzertRubrik(e, titel, beschreibung);
  if (rubrik === 'fest') return { rubrik, genre: 'brauchtum' };
  if (rubrik === 'party') return { rubrik, genre: detectSorte('party', e?.title) };
  if (rubrik === 'ausstellung') {
    const s = detectSorte('schau', e?.title);
    return { rubrik, genre: s === 'kunst' || s === 'museum' ? s : null };
  }
  if (Object.hasOwn(UNTERARTEN, rubrik)) return { rubrik, genre: unterRubrik(rubrik, e) };
  return { rubrik, genre: null };
}

// "advent" steht nicht für Adventure/Adventurer.
const ADVENT_WOERTER = /advent(?!ure|urer)|weihnacht|nikolaus|christkind|pyramide|winterzauber/;
// Mehrdeutige Wörter zählen nur im Titel und nie bei Führungen (Stollen = Bergwerk, Lichter der Stadt).
const ADVENT_TITELWOERTER = /\bstollen|christstollen|\blichter/;

/**
 * Gehört der Termin zu Advent und Weihnachten? Wirft nie.
 * @param {{rubrik?:string|null, genre?:string|null, title?:string, description?:string|null}} e
 * @returns {boolean}
 */
export function istAdvent(e) {
  if (e?.genre === 'weihnachtsmarkt' || e?.genre === 'weihnachten') return true;
  const titel = klein(e?.title);
  if (ADVENT_WOERTER.test(titel) || ADVENT_WOERTER.test(klein(e?.description))) return true;
  return e?.rubrik !== 'fuehrung' && ADVENT_TITELWOERTER.test(titel);
}
