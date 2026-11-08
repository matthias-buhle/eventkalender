// Arten und ihre Unterarten (Feld "genre" am Termin): Genres bei Konzerten, Sorten bei Märkten und Schauen.
// Die Schlüssel entsprechen src/normalize.js; die Seite kann diese Datei nicht laden.

/** Alle Arten in der Reihenfolge der Filterknöpfe. */
export const ARTEN = ['konzert', 'party', 'markt', 'fest', 'schau', 'sonstiges'];

/** Reihenfolge = Reihenfolge der Filterknöpfe. "sonstige" gilt für Termine dieser Art ohne bekannte Unterart. */
export const SORTEN = {
  konzert: {
    titel: 'Konzerte: Genre',
    sonstige: 'sonstige',
    sonstigeText: 'Sonstige Konzerte',
    liste: {
      'rock-pop': 'Rock & Pop', 'metal-punk': 'Metal & Punk', klassik: 'Klassik & Chor', jazz: 'Jazz & Blues',
      'schlager-folk': 'Schlager & Folk', 'hiphop-elektro': 'Hip-Hop & Elektro', comedy: 'Comedy & Kabarett', musical: 'Musical',
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
      essen: 'Essen & Trinken', festival: 'Festival',
    },
  },
  schau: {
    titel: 'Schauen: Sorte',
    sonstige: 'sonstige-schau',
    sonstigeText: 'Sonstige Schauen',
    liste: { tiere: 'Tier- & Zuchtschau', hobby: 'Messe & Hobby', kunst: 'Kunst & Foto', museum: 'Museum & Geschichte' },
  },
};

/**
 * Die Unterart, nach der gefiltert wird: der Schlüssel des Termins, wenn er zur Art passt, sonst der "sonstige"-Schlüssel der Art.
 * Arten ohne Unterarten (Party, Fest, Sonstiges) liefern null.
 */
export function sorteFilter(e) {
  const def = Object.hasOwn(SORTEN, e.art) ? SORTEN[e.art] : null;
  if (!def) return null;
  return typeof e.genre === 'string' && Object.hasOwn(def.liste, e.genre) ? e.genre : def.sonstige;
}

/** Der Anzeigename der Unterart für die Karte; null, wenn unbekannt oder nicht zur Art gehörig. */
export function sorteName(e) {
  const def = Object.hasOwn(SORTEN, e.art) ? SORTEN[e.art] : null;
  return def && typeof e.genre === 'string' && Object.hasOwn(def.liste, e.genre) ? def.liste[e.genre] : null;
}
