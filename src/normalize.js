// Vereinheitlichung von Rohtexten aus den Quellen: Art, Ticketstatus, Telefonnummer, Text.

/** @typedef {'konzert'|'party'|'markt'|'fest'|'schau'|'sonstiges'} Art */

const ART_REGELN = /** @type {[Art, RegExp][]} */ ([
  ['konzert', /konzert|\brock\b|\bpop\b|metal|punk|jazz|liedermacher|hip.?hop|singer|songwriter|\blive\b|\bband\b|chor\b|orchester|oratorium|kantate|orgelmusik|orgelkonzert/],
  ['party', /party|disco|diskothek|clubnacht|feiern|tanzabend|tanznacht|\bdj\b|silvester|jahreswechsel/],
  ['markt', /markt\b|m[aä]rkte\b|tr[oö]del|flohmarkt|basar|bazar/],
  ['schau', /schau\b|ausstellung|messe\b/],
  ['fest', /\bfest(?!ung|tag)|fest\b|feste\b|festival|feier\b|kirmes|kirchweih|jubil|umzug/],
]);

// Lesungen, Führungen, Theaterdinner usw. sind weder Fest noch Party, auch wenn das Wort vorkommt ("Babettes Fest").
const KEIN_FEST = /lesung|f[uü]hrung|vortrag|theaterdinner|verkostung|workshop/;

function artAusText(text, ohneFestUndParty = false) {
  const t = String(text ?? '').toLowerCase();
  if (!t) return null;
  for (const [art, regel] of ART_REGELN) {
    if (ohneFestUndParty && (art === 'fest' || art === 'party')) continue;
    if (regel.test(t)) return art;
  }
  return null;
}

/**
 * Ordnet Kategorie und Titel einer der festen Arten zu. Kategorie hat Vorrang.
 * @param {string|undefined|null} categoryText
 * @param {string|undefined|null} title
 * @returns {Art}
 */
export function normalizeArt(categoryText, title) {
  const art = artAusText(categoryText) ?? artAusText(title) ?? 'sonstiges';
  if ((art === 'fest' || art === 'party') && KEIN_FEST.test(String(title ?? '').toLowerCase())) {
    return /** @type {Art} */ (artAusText(title, true) ?? 'sonstiges');
  }
  return /** @type {Art} */ (art);
}

const STATUS_REGELN = /** @type {[string, RegExp][]} */ ([
  ['abgesagt', /abgesagt|f[aä]llt aus|zru[sš]eno|odpad[aá]/i],
  ['verlegt', /verlegt|verschoben|p[rř]esunuto|p[rř]elo[zž]eno/i],
  ['ausverkauft', /ausverkauft|vyprod[aá]no|prodej ukon[cč]en|sold.?out/i],
]);

/**
 * Erkennt nur negative Zustände. "verfuegbar" wird bewusst nie aus Text geschlossen.
 * @param {string|undefined|null} text
 * @returns {'ausverkauft'|'abgesagt'|'verlegt'|null}
 */
export function detectStatus(text) {
  const t = String(text ?? '');
  for (const [status, regel] of STATUS_REGELN) {
    if (regel.test(t)) return /** @type {any} */ (status);
  }
  return null;
}

const TELEFON = /(?<![\w.])(?:\+|0)\d[\d\s/()-]{5,}\d/;

/**
 * Findet die erste Telefonnummer im Text (Beginn mit + oder 0) und gibt sie nur aus Ziffern zurück.
 * @param {string|undefined|null} text
 * @returns {string|null}
 */
export function normalizePhone(text) {
  const m = TELEFON.exec(String(text ?? ''));
  if (!m) return null;
  const roh = m[0].replace(/\(0\)/g, '');
  const plus = roh.startsWith('+') ? '+' : '';
  const ziffern = roh.replace(/\D/g, '');
  return ziffern.length >= 6 ? plus + ziffern : null;
}

const ENTITAETEN = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  auml: 'ä', ouml: 'ö', uuml: 'ü', Auml: 'Ä', Ouml: 'Ö', Uuml: 'Ü', szlig: 'ß',
  ndash: '–', mdash: '—', hellip: '…', euro: '€', laquo: '«', raquo: '»',
  bdquo: '„', ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’',
  middot: '·', times: '×', bull: '•', deg: '°', copy: '©', reg: '®', sect: '§', eacute: 'é', egrave: 'è',
};

function decodeEntities(text) {
  return text.replace(/&(?:#(\d+)|#x([0-9a-f]+)|([a-z]+));/gi, (whole, dez, hex, name) => {
    if (dez || hex) {
      const code = dez ? Number(dez) : parseInt(hex, 16);
      try { return String.fromCodePoint(code).replace(/ /g, ' '); } catch { return whole; }
    }
    return Object.hasOwn(ENTITAETEN, name) ? ENTITAETEN[name] : whole;
  });
}

/**
 * Macht aus HTML oder Text einfachen Text: ohne Tags und Skripte, Entitäten aufgelöst, Leerraum zusammengezogen.
 * @param {string|undefined|null} htmlOrText
 * @returns {string}
 */
export function cleanText(htmlOrText) {
  const ohneSkripte = String(htmlOrText ?? '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
  const ohneTags = ohneSkripte
    .replace(/<\/?(?:br|p|div|li|ul|ol|h[1-6]|tr|td|th|table)\b[^>]*>/gi, ' ')
    .replace(/<[^>]*>/g, '');
  return decodeEntities(ohneTags).replace(/\s+/g, ' ').trim();
}

/**
 * Kürzt Text auf höchstens n Zeichen an einer Wortgrenze und hängt "…" an.
 * @param {string|undefined|null} text
 * @param {number} n
 * @returns {string}
 */
export function shorten(text, n) {
  const t = String(text ?? '');
  if (t.length <= n) return t;
  const kopf = t.slice(0, n - 1);
  const wortende = kopf.lastIndexOf(' ');
  return `${(wortende > 0 ? kopf.slice(0, wortende) : kopf).trimEnd()}…`;
}

export const GENRES = {
  'rock-pop': 'Rock & Pop',
  'metal-punk': 'Metal & Punk',
  klassik: 'Klassik & Chor',
  jazz: 'Jazz & Blues',
  'schlager-folk': 'Schlager & Folk',
  'hiphop-elektro': 'Hip-Hop & Elektro',
  comedy: 'Comedy & Kabarett',
  musical: 'Musical',
};

// Reihenfolge = Vorrang: das Besondere vor dem Allgemeinen ("Popchor" ist Pop, nicht Chor).
const GENRE_REGELN = /** @type {[string, RegExp][]} */ ([
  ['comedy', /comedy|kabarett|cabaret|stand.?up|satire|kleinkunst/],
  ['musical', /musical/],
  ['metal-punk', /\bmetal|\bpunk|hardcore|thrash|heavy/],
  ['jazz', /jazz|swing|blues|big.?band/],
  ['hiphop-elektro', /hip.?hop|\brap\b|rapper|techno|\bhouse\b|electro|elektro|\bedm\b|\bdance\b|trance|drum.?n.?bass/],
  ['schlager-folk', /schlager|volksmusik|blasorchester|volkst[uü]mlich|folk|blasmusik|shanty|country|bluegrass|liedermacher|chanson/],
  ['rock-pop', /\brock|\bpop\b|pop.?chor|\bindie\b|songwriter/],
  ['klassik', /klassik|classical|sinfon|symphon|philharmon|orchester|kammermusik|kammerorchester|\boper\b|operette|\bchor\b|chor\b|kantate|oratori|requiem|orgel|klavier|violin|cello|fagott|quartett|ensemble|motette|barock|bach\b|mozart|beethoven|vivaldi|chopin|brahms|h[aä]ndel/],
]);

/**
 * Rät das Genre aus Texten (Kategorie, Titel, Beschreibung …). Der erste Text, in dem etwas passt, entscheidet;
 * "Konzert" allein sagt nichts. Bleibt es unklar: null (die Seite nennt das "Sonstige").
 * @param {...(string|null|undefined)} texte
 * @returns {string|null}
 */
export function detectGenre(...texte) {
  for (const roh of texte) {
    const t = String(roh ?? '').toLowerCase();
    if (!t) continue;
    for (const [genre, regel] of GENRE_REGELN) if (regel.test(t)) return genre;
  }
  return null;
}

export const MARKT_SORTEN = {
  weihnachtsmarkt: 'Weihnachtsmarkt',
  troedel: 'Flohmarkt & Trödel',
  handwerk: 'Handwerk & Kunst',
  bauern: 'Bauern- & Wochenmarkt',
};

export const SCHAU_SORTEN = {
  tiere: 'Tier- & Zuchtschau',
  hobby: 'Messe & Hobby',
  kunst: 'Kunst & Foto',
  museum: 'Museum & Geschichte',
};

export const PARTY_SORTEN = {
  disco: 'Disco & Tanz',
  club: 'Club & DJ',
  silvester: 'Silvester & Ball',
  fasching: 'Fasching & Karneval',
};

export const FEST_SORTEN = {
  familie: 'Familie & Kinder',
  stadtfest: 'Stadt- & Dorffest',
  weihnachten: 'Weihnachten & Lichter',
  essen: 'Essen & Trinken',
  festival: 'Festival',
};

/** Unterarten je Art: Genres bei Konzerten, Sorten bei Märkten, Schauen, Partys und Festen. Andere Arten haben keine. */
export const SORTEN = { konzert: GENRES, party: PARTY_SORTEN, markt: MARKT_SORTEN, fest: FEST_SORTEN, schau: SCHAU_SORTEN };

const MARKT_REGELN = /** @type {[string, RegExp][]} */ ([
  ['weihnachtsmarkt', /weihnacht|advent|christkind|nikolaus|winterzauber|winterlicht|wintermarkt|lichtelfest|jolka/],
  ['troedel', /tr[oö]del|flohmarkt|floh-|antik|b[oö]rse|sammler|second.?hand|basar|bazar|kleidermarkt/],
  ['handwerk', /handwerk|handgemacht|kunstmarkt|k[uü]nstlermarkt|design.?market|designmarkt|manufaktur|t[oö]pfer|keramik|kreativmarkt|handarbeit/],
  ['bauern', /bauern|wochenmarkt|hofmarkt|erntemarkt|regionalmarkt|biomarkt|g[aä]rtner|pflanzenmarkt|blumenmarkt/],
]);

const SCHAU_REGELN = /** @type {[string, RegExp][]} */ ([
  ['tiere', /kleintier|gefl[uü]gel|tauben?schau|taube|kaninchen|z[uü]chter|tierschau|hundeschau|katzenschau|(?:lokal|orts|kreis|vereins|jugend|gemeinschafts|grenzland|territorial)schau|hauptsonderschau|lipsia|\bvdt\b/],
  ['hobby', /(?<!hubertus)messe\b|modellbahn|modellbau|modellauto|b[oö]rse|sammler|hobby|briefmarken|spielzeug/],
  ['kunst', /kunst|galerie|malerei|gem[aä]lde|foto|collage|vernissage|ausstellungser[oö]ffnung|zeichn|skulptur|grafik|k[uü]nstler|finissage|bildhauer|\bmale\b/],
  ['museum', /museum|sonderausstellung|f[uü]hrung|geschicht|geologisch|heimat|kabinettausstellung|synagog|j[uü]disch|bibliothek|archiv/],
]);

// Reihenfolge = Vorrang: Fasching vor Ball, Silvester vor Club ("Silvester Party mit DJ" ist Silvester).
const PARTY_REGELN = /** @type {[string, RegExp][]} */ ([
  ['fasching', /fasching|karneval|prunksitzung|fastnacht|fasnacht|\bbkc\b|narren/],
  ['silvester', /silvester|jahreswechsel|neujahr|\bball\b|(?:weihnachts|abschluss|tanz|fest|ernte|k[oö]nigs|sommer|herbst)ball\b/],
  ['club', /\bdj\b|club|aftershow|after.?party|techno|elektro|electro|\bhouse\b|takeover|\brave\b/],
  ['disco', /disco|disko|80er|90er|2000er|\b[89]0.?s\b|tanz|retro/],
]);

const FEST_REGELN = /** @type {[string, RegExp][]} */ ([
  ['festival', /festival|open.?air/],
  ['weihnachten', /weihnacht|advent|lichterfest|nikolaus|pyramide/],
  ['familie', /familie|kinder|m[aä]rchen|martin|laterne|kasper|puppen|oster/],
  ['essen', /suppe|\bwein|bier|schlemm|kulinar|gourmet|ernte|kartoffel|k[aä]se|\bbrot|fisch|grill|wurst|genuss|apfel|pilz/],
  ['stadtfest', /stadt|dorf|festumzug|jubil|kirmes|kirchweih|heimat|volksfest|umzug|sommerfest|herbstfest|schlossfest|burgfest|hoffest|gartenfest|vereinsfest|sch[uü]tzenfest/],
]);

function ratenAus(regeln, texte) {
  for (const roh of texte) {
    const t = String(roh ?? '').toLowerCase();
    if (!t) continue;
    for (const [sorte, regel] of regeln) if (regel.test(t)) return sorte;
  }
  return null;
}

/**
 * Rät die Unterart zu einer Art: Genre bei Konzerten, Sorte bei Märkten und Schauen, bei allen anderen Arten null.
 * Der erste Text, in dem etwas passt, entscheidet.
 * @param {string} art
 * @param {...(string|null|undefined)} texte
 * @returns {string|null}
 */
export function detectSorte(art, ...texte) {
  if (art === 'konzert') return detectGenre(...texte);
  if (art === 'markt') return ratenAus(MARKT_REGELN, texte);
  if (art === 'schau') return ratenAus(SCHAU_REGELN, texte);
  if (art === 'party') return ratenAus(PARTY_REGELN, texte);
  if (art === 'fest') return ratenAus(FEST_REGELN, texte);
  return null;
}

/** Gibt den Schlüssel zurück, wenn er zu dieser Art gehört (z. B. "jazz" bei "konzert"), sonst null. */
export function passendeSorte(art, schluessel) {
  const liste = Object.hasOwn(SORTEN, art) ? SORTEN[art] : null;
  return liste && typeof schluessel === 'string' && Object.hasOwn(liste, schluessel) ? schluessel : null;
}
