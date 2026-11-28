// Die Unterpunkte (Schlüssel → Anzeigename) der Rubriken, die nicht schon in normalize.js stehen.
// Die Seite (site/js/arten.js) führt dieselben Listen; der Gleichlauf ist in test/normalize.test.js gesichert.

export const FUEHRUNG_UNTER = {
  stadt: 'Stadt & Ort',
  untertage: 'Untertage & Bergwerk',
  brauerei: 'Brauerei & Bäckerei',
  kinder: 'Kinderführung',
  hausfuehrung: 'Museum & Schloss',
  bahn: 'Sonderfahrt Bahn',
};

export const WANDERN_UNTER = {
  wanderung: 'Geführte Wanderung',
  spaziergang: 'Spaziergang & Rundgang',
  natur: 'Tiere & Natur',
};

export const KURSE_UNTER = {
  vortrag: 'Vortrag & Reisebericht',
  kreativ: 'Kreativ, Handwerk & Kochen',
  bewegung: 'Bewegung & Entspannung',
  lernen: 'Computer, Sprache & Beruf',
};

export const THEATER_UNTER = {
  schauspiel: 'Schauspiel & Oper',
  lesung: 'Lesung & Literatur',
  kabarett: 'Kabarett & Comedy',
  kino: 'Kino & Film',
  show: 'Show, Zirkus & Musical',
};

export const ESSEN_UNTER = {
  dinner: 'Dinner & Menü',
  brunch: 'Brunch',
  verkostung: 'Verkostung',
};

export const KINDER_UNTER = {
  'kinder-buehne': 'Theater, Kino & Musik',
  'kinder-mitmachen': 'Basteln, Backen & Mitmachen',
  'kinder-lernen': 'Lesen & Lernen',
};

// Sonderfahrten der Bahn zählen zu den Führungen (Entscheidung 11).
export const BAHN = /sonderzug|sonderfahrt|dampfzug|dampflok|(?:nikolaus|gl[uü]hwein|advents|osterhasen|mondschein)(?:fahrt|express|zug)|schmalspurbahn|talbahn\b|grundbahn\b|museumsbahn|kleinbahn|(?:reichsbahn|sachsen)zug\b|(?:reichsbahn|sachsen)zuges|weihnachtsmannz(?:ug|[uü]ge)|(?:stadtw[aä]chter|kloster) ?z[uü]ge/;

// Je Rubrik die Unterpunkte mit ihren Stichwörtern; Reihenfolge = Vorrang, erster Treffer gewinnt.
// Ein dritter Eintrag true heißt: das Stichwort zählt nur im Titel (nicht in der Beschreibung).
const REGELN = /** @type {Record<string, [string, RegExp, boolean?][]>} */ ({
  fuehrung: [
    ['bahn', BAHN],
    ['kinder', /kinder|familie/],
    // Steht bewusst vor untertage und brauerei: ein Stadtrundgang bleibt Stadt, auch wenn er an Mühle oder Stollen endet. Gibt nur Vorrang.
    ['stadt', /stadtrundfahrt|stadtf[uü]hrung|stadtrundgang/],
    ['untertage', /bergwerk|untertage|stollen|h[oö]hle|schacht|bergbau|salz/],
    ['brauerei', /brauerei|braumanufaktur|brauhaus|braumeister|bierbrau|b[aä]cker|m[uü]hle|manufaktur|distill|r[oö]sterei/],
    ['hausfuehrung', /museum|schloss|schlo[sß]|\bburg|kirche|\bdom\b|kloster|\bhaus|rathaus|turm|ausstellung|galerie|gedenkst[aä]tte|sammlung|festung|synagoge|bibliothek|kurator|zeitzeug/],
    ['stadt', /stadt|rundgang|dorf|spazier|nachtw[aä]chter|stadtschleicher|lichterfahrt|g[aä]sschen/],
  ],
  theater: [
    ['kabarett', /kabarett|cabaret|comedy|comedian|stand.?up|satire|kleinkunst|\bhumor/],
    ['lesung', /lesung|vorlese|lesestunde|\bliest\b|buchvorstellung|buchpremiere|autorengespr|literatur|poetry|\bslam\b|signierstunde/],
    ['lesung', /erz[aä]hl/, true],
    ['kino', /kino|\bfilm|kurzfilm|filmfest|filmabend|filmvorf/],
    ['show', /musical|revue|\bshow\b|zirkus|circus|cyrkus|travestie|zauberer|zauberei|zaubershow|zauberkunst|zauberk[uü]nstler|variet|artistik|akrobat|songtexte|gesangstexte|liedtexte/],
    ['schauspiel', /theater|schauspiel|\bst[uü]ck|oper\b|operette|ballett|kom[oö]die|trag[oö]die|auff[uü]hrung|premiere|inszenierung|puppenspiel|marionett|divadel|b[uü]hne/],
  ],
  kurse: [
    ['bewegung', /yoga|pilates|\btanz|fitness|gymnastik|qi.?gong|tai.?chi|meditation|entspann|r[uü]cken(?:schule|training|gymnastik)|zumba|klangschal|achtsam/],
    ['kreativ', /kreativ|mal(?:en|kurs|treff|nachmittag)|zeichn|t[oö]pfer|keramik|\bn[aä]h(?!e\b|er|rung|rboden)|gen[aä]ht|strick|h[aä]kel|filz|bastel|handwerk|schnitz|kl[oö]ppel|koch|back|floristik|schmied|foto|photowalk|reparatur|stick(?:en|erei)|upcycl|pralin|trommel|verzier|weihnachtskugel/],
    ['lernen', /computer|\bpc\b|smartphone|handy|internet|digital|\bki\b|excel|sprach|englisch|franz[oö]sisch|tschechisch|polnisch|spanisch|italienisch|beruf|bewerb|weiterbildung|schulung|seminar|lehrgang|kommunikation|f[uü]hrungs?\b|f[uü]hrung auf|online/],
    ['vortrag', /vortrag|reisebericht|reiseshow|reportage|multivision|infoabend|gespr[aä]ch|podium|diskussion|sternwarte|ratgeber/],
  ],
  wandern: [
    ['wanderung', /wander|exkursion|radtour|\btour\b/],
    ['spaziergang', /spazier|bummel/],
    ['natur', /vogel|tier|\bzoo\b|natur|pilz|kr[aä]uter|wald|fledermaus|artenschutz|vivarium|f[uü]tter|erdm[aä]nn/],
  ],
  essen: [
    ['brunch', /brunch|fr[uü]hst[uü]ck/],
    ['verkostung', /verkostung|probe\b|tasting|whisky|degustation/],
    ['dinner', /dinner|men[uü]|essen\b|buffet|schmaus|braten|gans\b|baudenabend|h[uü]ttenabend|grill|kochshow|kulinar/],
  ],
  kinder: [
    ['kinder-buehne', /theater|puppen|kasper|marionett|kino|film|konzert|musik|zirkus|musical|zauber|b[uü]hne|m[aä]rchen|revue/],
    ['kinder-mitmachen', /bastel|b[aä]ck|pl[aä]tzchen|werkstatt|mitmach|kreativ|malen|t[oö]pfer|experiment|spiel|ferien|krabbel|laterne/],
    ['kinder-lernen', /vorlese|lese|bibliothek|lern|kinderuni|forscher|entdecker|geschichten|bilderbuch/],
  ],
});

const BESCHREIBUNG_ZEICHEN = 200;
// Die Spielstätten des Theaters: einzige Stelle; rubriken.js baut daraus die Stufe "Spielstätte" der Rangfolge.
export const KINO_HAUS = /kino/;
export const THEATER_HAUS = /theater|divadl|kleinkunst|puppenb[uü]hne|\bhaus (?:zittau|g[oö]rlitz)\b|apollo|staatsoperette|herkuleskeule/;
const text = (x) => (typeof x === 'string' ? x.toLowerCase() : '');

/**
 * Der Unterpunkt eines Termins in einer der sechs Rubriken Führung, Theater, Kurse, Wandern, Essen, Kinder:
 * erster Treffer im Titel, sonst in den ersten 200 Zeichen der Beschreibung; bei Theater zuletzt die Spielstätte.
 * Für andere Rubriken und ohne Treffer null. Wirft nie.
 * @param {string} rubrik
 * @param {string|null|undefined} titel
 * @param {string|null} [beschreibung]
 * @param {string|null} [ort]
 * @returns {string|null}
 */
export function unterpunkt(rubrik, titel, beschreibung, ort) {
  const regeln = Object.hasOwn(REGELN, rubrik) ? REGELN[rubrik] : null;
  if (!regeln) return null;
  for (const [t, imTitel] of [[text(titel), true], [text(beschreibung).slice(0, BESCHREIBUNG_ZEICHEN), false]]) {
    if (!t) continue;
    for (const [schluessel, regel, nurTitel] of regeln) if ((imTitel || !nurTitel) && regel.test(t)) return schluessel;
  }
  if (rubrik === 'theater') {
    const haus = text(ort);
    if (KINO_HAUS.test(haus)) return 'kino';
    if (THEATER_HAUS.test(haus)) return 'schauspiel';
  }
  return null;
}
