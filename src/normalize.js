// Vereinheitlichung von Rohtexten aus den Quellen: Art, Ticketstatus, Telefonnummer, Text.

/** @typedef {'konzert'|'party'|'markt'|'fest'|'schau'|'sonstiges'} Art */

const ART_REGELN = /** @type {[Art, RegExp][]} */ ([
  ['konzert', /konzert|\brock\b|\bpop\b|metal|punk|jazz|liedermacher|hip.?hop|singer|songwriter|\blive\b|\bband\b|chor\b|orchester/],
  ['party', /party|disco|diskothek|clubnacht|feiern|tanzabend|tanznacht|\bdj\b/],
  ['markt', /markt\b|m[aä]rkte\b|tr[oö]del|flohmarkt|basar|bazar/],
  ['schau', /schau\b|ausstellung|messe\b/],
  ['fest', /fest|feier\b|kirmes|kirchweih|jubil|umzug/],
]);

function artAusText(text) {
  const t = String(text ?? '').toLowerCase();
  if (!t) return null;
  for (const [art, regel] of ART_REGELN) if (regel.test(t)) return art;
  return null;
}

/**
 * Ordnet Kategorie und Titel einer der festen Arten zu. Kategorie hat Vorrang.
 * @param {string|undefined|null} categoryText
 * @param {string|undefined|null} title
 * @returns {Art}
 */
export function normalizeArt(categoryText, title) {
  return /** @type {Art} */ (artAusText(categoryText) ?? artAusText(title) ?? 'sonstiges');
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
