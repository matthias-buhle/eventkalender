import { makeEvent } from '../model.js';
import { berlinIso, imFenster, plusTage } from '../time.js';
import { CENTER, RADIUS_KM, distanceKm, resolvePlace } from '../geo.js';
import { cleanText, detectGenre, detectStatus, normalizeArt } from '../normalize.js';

export const name = 'evlks';

const QUELLE = 'Kirchenkalender der Ev.-Luth. Landeskirche Sachsens';
const BASIS = 'https://kalender.evlks.de';

// Mehr als 800 Termine je Lauf nimmt der Adapter nicht auf (die frühesten zuerst).
const HOECHSTZAHL = 800;

/**
 * Kategorien des Kalenders (Feld _event_EVENTTYPE, im JSON als Klartext, bei mehreren durch ", " getrennt):
 * 3 Fortbildungen/Seminare/Vorträge, 4 Konzerte/Theater/Musik, 5 Freizeiten/Reisen, 6 Ausstellungen/Kunst, 7 Feste/Gemeindefeste.
 * Gottesdienste (1), Gruppen/Kreise (2), Sport (8), Sonstiges (9) und Andachten (10) werden gar nicht erst abgerufen;
 * sie stehen höchstens als Zweitkategorie an einem Termin, der auch in einer der abgerufenen steht.
 */
const ABRUF_KATEGORIEN = '3,4,5,6,7';
const KONZERTE = 'Konzerte/Theater/Musik';
const FORTBILDUNG = 'Fortbildungen/Seminare/Vorträge';
const FREIZEIT = 'Freizeiten/Reisen';
const AUSSTELLUNG = 'Ausstellungen/Kunst';
const FESTE = 'Feste/Gemeindefeste';
const GOTTESDIENSTE = 'Gottesdienste';

const text = (wert) => (typeof wert === 'string' ? wert.trim() : '');
const zahl = (wert) => {
  const z = Number(text(wert).replace(',', '.'));
  return text(wert) === '' || !Number.isFinite(z) ? null : z;
};

const klein = (titel) => titel.toLowerCase();

// Was nach Musik aussieht: rettet Termine, die sonst als Gottesdienst, Andacht oder Treffen aussortiert würden
// ("Musikalischer Gottesdienst – Adventsmusik", "Musikalische Adventsandacht mit dem Männerchor"), und macht aus Festen und Ausstellungen Konzerte.
const MUSIK = /konzert|musik|orgel|vesper|kantate|oratori|singen\b|gesang|lieder|\bchor|chor\b|chöre|b[lä]+ser|blech|posaun|turmblasen|gospel|sinfon|symphon|messias|h[äa]ndel|bach\b|ensemble|\btrio\b|quartett|consort|kammer|klavier|piano|cello|violin|gitarr|\bband\b|choral|motette|jauchzet|carols|matin[eé]e|recital|requiem|christmette|christvesper|christnacht|kantorei|kurrende/;

// Immer weg, auch mit Musikwort im Titel: interne Termine, Online-Angebote, Kopien, Tagungen, Unterricht.
const IMMER_WEG = /\bintern\b|\(kopie\)|\bonline\b|zoom|webinar|stiller tag|klausur|pastoralkolleg|ephoralkolleg|supervision|fortbildung|qualifizierung|schulung|unterricht|lehrkr[aä]fte|kirchenvorstand|kirchenvorst[aä]nde|christenlehre|junge gemeinde|tagung|grundkurs|basiskurs|aufbaukurs|\bmodul\b/;
// Proben (Chorprobe, Posaunenchorprobe, Kantoreiprobe) sind Gruppentreffen; öffentliche und offene Proben bleiben (wie in aussortieren.js).
const PROBE = /probe/;
const PROBE_OEFFENTLICH = /[oö]ffentlich|offene/;
// Weg, solange kein Musikwort dabei ist: Gottesdienste, Andachten, Gebete, Gruppen- und Kreistreffen.
const OHNE_MUSIK_WEG = /gottesdienst|andacht|gebet|abendmahl|taufe|segnung|einf[uü]hrung|konfirmand|\bkonfi\b|bibelkreis|bibelstunde|bibelgespr|bibelwoche|bibelabend|bibelfr|bibel und bier|bibel teilen|bibliodrama|bibliolog|kreis\b|runde\b|treff|stammtisch|fr[uü]hst[uü]ck|mittagstisch|seniorennachmittag|gespr[aä]chskreis|hauskreis|yoga|krabbel|eltern-?kind|spielkreis|ausschuss|sitzung|versammlung|besinnungstag|mentor|netzwerk|exerzitien/;
// Reine Gruppennamen ("Posaunenchor Zschachwitz", "Kurrende", "Kantorei Leuben"): das ist die Probe, nicht der Auftritt.
const GRUPPENNAME = /^(?:posaunenchor|kirchenchor|kantorei|kurrende|instrumentalkreis|jugendchor|kinderchor|kinderkantorei|spatzenchor|fl[öo]tenkreis|blockfl[öo]tenkreis|singkreis|gitarrenkreis|bl[äa]serkreis|jungbl[äa]ser|bl[äa]serchor|handglockenchor|orchester|ensemble)(?:\s+[\p{L}\-/]+){0,2}\.?$/u;

// Fortbildungen (Kategorie 3) bleiben nur mit einem Titel, der nach öffentlichem Angebot klingt.
const FORTBILDUNG_POSITIV = /konzert|musik|lesung|vortrag|gespr[aä]ch|abend|film|ausstellung|f[uü]hrung|offenen? t[uü]r|literatur|kunst|reisebericht|autor|schreibspur|kinder|familie/;
// Freizeiten (Kategorie 5) bleiben nur als Kinder- und Familienangebot.
const FREIZEIT_POSITIV = /kinder|familie/;

// In Kategorie 4 (Konzerte/Theater/Musik) ist fast alles Musik; diese Titel sind es nicht und bekommen die Art aus normalizeArt.
const CHRISTNACHT = /christmette|christvesper|christnacht/;
// Davon gelten diese immer, auch mit Musikwort ("Messias – Die Weihnachtskomödie" ist Theater) ...
const KEIN_KONZERT = /kom[öo]die|theater|schauspiel|lesung|\bfilm|dokumentar|krippenspiel|weihnachtsspiel|spiel zur nacht|kabarett|comedy|feierstunde|festakt/;
// ... und diese nur ohne Musikwort ("Musik zum Weihnachtsmarkt" ist Musik).
const KEINE_MUSIK = /\btalk\b|auf den spuren|ausstellung|installation|markt\b|kommt in|musical|vortrag|f[uü]hrung|kinder(?!konzert)|nikolaus/;

/** Die Kategorien eines Termins als Liste (Klartext, durch ", " getrennt). */
const kategorienVon = (e) => text(e._event_EVENTTYPE).split(/\s*,\s*/).filter(Boolean);

/**
 * Entscheidet, ob ein Termin des Kalenders übernommen wird, und welche Art er bekommt.
 * Reine Funktion über die Felder des Exports (Titel, Kategorien, Sichtbarkeit, Online/Präsenz); wirft nie.
 * @returns {{art:string, genre:string|null}|null} null = aussortiert
 */
export function bewerte(e) {
  const titel = cleanText(e?._event_TITLE);
  if (!titel) return null;
  // Interne Termine und nicht freigegebene gibt der Export mit dest=all ebenfalls aus; nur Öffentliches gehört in den Kalender.
  if (text(e._event_DESTINATION) !== 'öffentlich' || (text(e._event_STATUS) && text(e._event_STATUS) !== 'ok')) return null;
  if (/online/i.test(text(e._event_MENUE_1))) return null;

  const t = klein(titel);
  const kategorien = kategorienVon(e);
  const hat = (k) => kategorien.includes(k);
  const musik = MUSIK.test(t);

  if (IMMER_WEG.test(t) || (PROBE.test(t) && !PROBE_OEFFENTLICH.test(t))) return null;
  if (!musik && OHNE_MUSIK_WEG.test(t)) return null;
  if (GRUPPENNAME.test(t)) return null;

  // Ein Gottesdienst (auch als Zweitkategorie) ist nur ein Termin des Kalenders, wenn die Musik im Titel steht.
  if (hat(GOTTESDIENSTE) && !musik) return null;
  // Gruppentreffen mit Konzert als Zweitkategorie: nur mit Musikwort im Titel.
  if (kategorien.includes('Gruppen/Kreise') && !musik) return null;

  if (hat(KONZERTE)) {
    // Die Christnacht ist Kirchenmusik (Regel des Projekts), auch mit Krippenspiel.
    const nichtMusik = !CHRISTNACHT.test(t) && (KEIN_KONZERT.test(t) || (KEINE_MUSIK.test(t) && !musik));
    return { art: nichtMusik ? normalizeArt('', titel) : 'konzert', genre: null };
  }
  if (hat(FESTE)) {
    const art = musik ? 'konzert' : normalizeArt('', titel);
    return { art: art === 'sonstiges' ? 'fest' : art, genre: null };
  }
  if (hat(AUSSTELLUNG)) {
    const art = musik ? 'konzert' : normalizeArt('', titel);
    return art === 'konzert' ? { art, genre: null } : { art: art === 'sonstiges' ? 'schau' : art, genre: 'kunst' };
  }
  if (hat(FREIZEIT)) {
    return FREIZEIT_POSITIV.test(t) ? { art: normalizeArt('', titel), genre: null } : null;
  }
  if (hat(FORTBILDUNG)) {
    return FORTBILDUNG_POSITIV.test(t) ? { art: musik ? 'konzert' : normalizeArt('', titel), genre: null } : null;
  }
  return null;
}

/** 'JJJJ-MM-TT HH:MM:SS' → { tag, uhr:'HH:MM' }; "0000-00-00 …" und Unlesbares → null. */
function zeitpunkt(roh) {
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})/.exec(text(roh));
  if (!m || m[1] === '0000') return null;
  return { tag: `${m[1]}-${m[2]}-${m[3]}`, uhr: `${m[4]}:${m[5]}` };
}

/** "Kirche, Ort"; nennt der Name des Ortes die Stadt schon, bleibt es beim Namen. */
function ortsname(e) {
  // Manche Gemeinden tragen "Siehe Beschreibung" o. ä. als Ortsnamen ein; das ist kein Ort.
  const haus = cleanText(e._place_NAME).replace(/^(?:siehe|s\.)\s*(?:beschreibung|text|unten)\b.*$/i, '').trim();
  const stadt = cleanText(e._place_CITY);
  if (haus && stadt && haus.toLowerCase().includes(stadt.toLowerCase())) return haus;
  return [haus, stadt].filter(Boolean).join(', ');
}

/**
 * Liegt der Ort im Gebiet? Der Export liefert Koordinaten je Ort (GLAT/GLONG); fehlen sie, entscheidet der Ortsname
 * (Ortsverzeichnis des Projekts). Gibt { lat, lon } zurück (bei Ortsname ohne Koordinaten null/null) oder null.
 */
function verorten(e) {
  const lat = zahl(e._place_GLAT);
  const lon = zahl(e._place_GLONG);
  if (lat !== null && lon !== null && (lat !== 0 || lon !== 0)) {
    return distanceKm(CENTER, { lat, lon }) <= RADIUS_KM ? { lat, lon } : null;
  }
  const ort = resolvePlace(cleanText(e._place_CITY));
  return ort && distanceKm(CENTER, ort) <= RADIUS_KM ? { lat: null, lon: null } : null;
}

// Titel, die Kirchenmusik meinen, auch wenn die Genre-Erkennung des Projekts sie anders liest ("Orgel Punkt Drei" gilt dort als Punk).
const KIRCHENMUSIK_TITEL = /orgel|vesper|kantate|oratori|motette|christmette|christvesper|christnacht|adventsmusik|kirchenmusik|turmblasen|posaunenchor/;
const KIRCHENRAUM = /kirche|\bdom\b|kloster|kapelle|m[uü]nster/;

/**
 * Hinweis auf die Unterart eines Konzerts. Die Quelle ist ein Kirchenkalender: Musik mit Kirchenwort im Titel und
 * Konzerte ohne erkennbares Genre in einer Kirche sind Kirchenmusik; sonst entscheidet die Erkennung des Projekts.
 */
function genreHinweis(art, titel, placeName) {
  if (art !== 'konzert') return null;
  const t = klein(titel);
  if (KIRCHENMUSIK_TITEL.test(t)) return 'kirche';
  return detectGenre(titel) === null && KIRCHENRAUM.test(klein(placeName)) ? 'kirche' : null;
}

/** Ein Eintrag des Exports → Event, oder null (aussortiert, außerhalb des Gebiets, ohne Zeit oder Ort). */
export function zuEvent(roh, config = {}) {
  const e = roh?.Veranstaltung ?? roh;
  if (!e || typeof e !== 'object') return null;
  const urteil = bewerte(e);
  if (!urteil) return null;
  const titel = cleanText(e._event_TITLE);
  const von = zeitpunkt(e.START);
  const id = text(e.ID);
  if (!von || !id) return null;
  const placeName = ortsname(e);
  const lage = verorten(e);
  if (!placeName || !lage) return null;

  const hasTime = text(e.allDay) !== '1' && von.uhr !== '00:00';
  const bis = zeitpunkt(e.END);
  const endeTag = bis && `${bis.tag} ${bis.uhr}` > `${von.tag} ${von.uhr}` ? bis : null;
  const ende = !endeTag ? null : hasTime ? berlinIso(endeTag.tag, endeTag.uhr) : endeTag.tag > von.tag ? berlinIso(endeTag.tag, '23:59') : null;

  return makeEvent({
    sourceName: QUELLE,
    sourceId: `${text(e._event_ID) || id}:${text(e.START)}`,
    sourceUrl: `${config.baseUrl ?? BASIS}/veranstaltung_im_detail${id}.html`,
    title: titel,
    art: urteil.art,
    genre: urteil.genre ?? genreHinweis(urteil.art, titel, placeName),
    start: berlinIso(von.tag, hasTime ? von.uhr : null),
    end: ende,
    hasTime,
    placeName,
    lat: lage.lat,
    lon: lage.lon,
    ticketStatus: detectStatus(titel),
    // Zugesagt sind nur Titel, Datum und Uhrzeit, Ort und Link: keine Beschreibung, kein Bild, keine Kontaktdaten.
    description: null,
  });
}

/** Eine Seite des Exports (JSON, bis zu `limit` Einträge). */
async function holeSeite(http, config, today, letzterTag, seite) {
  const url = new URL('/json', config.baseUrl ?? BASIS);
  // Alle Parameter ausdrücklich setzen: der Kalender merkt sich Parameter in der Sitzung (Handbuch). Nicht dest=intern.
  url.search = new URLSearchParams({
    vid: 'all',
    region: 'all',
    eventtype: ABRUF_KATEGORIEN,
    highlight: 'all',
    q: 'none',
    d: 'all',
    past: '1',
    dest: 'all',
    start: today,
    end: letzterTag,
    itemsPerPage: String(config.limit ?? 3000),
    pageID: String(seite),
  }).toString();
  const { body } = await http.get(url.href, { as: 'json' });
  if (!Array.isArray(body)) throw new Error('EVLKS-Kalender: Antwort ist kein Array');
  return body;
}

/**
 * Kirchenkalender der Ev.-Luth. Landeskirche Sachsens (kalender.evlks.de, Software "vket"): ein JSON-Abruf für ganz
 * Sachsen und das Zeitfenster (bei mehr als 3000 Einträgen weitere Seiten, höchstens maxPages), das Gebiet und die
 * Auswahl macht der Adapter selbst. Die EVLKS wurde am 24.11.2026 per Mail informiert; übernommen werden nur Titel,
 * Datum und Uhrzeit, Ort und der Link zur Veranstaltung.
 */
export async function fetchEvents({ http, today, config = {} }) {
  const letzterTag = plusTage(today, config.horizonDays ?? 60);
  const limit = config.limit ?? 3000;
  const roh = [];
  for (let seite = 1; seite <= (config.maxPages ?? 4); seite++) {
    const eintraege = await holeSeite(http, config, today, letzterTag, seite);
    roh.push(...eintraege);
    if (eintraege.length < limit) break;
    if (seite === (config.maxPages ?? 4)) {
      throw new Error(`EVLKS-Kalender: Liste unvollständig (${roh.length} Einträge nach ${seite} Seiten), maxPages oder limit prüfen`);
    }
  }

  const gesehen = new Set();
  const events = [];
  for (const eintrag of roh) {
    const e = zuEvent(eintrag, config);
    if (!e || !imFenster(e.start, e.end, today, letzterTag)) continue;
    // Derselbe Termin steht manchmal doppelt (zwei Einträge für Titel, Zeit und Ort).
    const schluessel = `${e.title}|${e.start}|${e.placeName}`;
    if (gesehen.has(schluessel)) continue;
    gesehen.add(schluessel);
    events.push(e);
  }

  // Wie bei den anderen Schnittstellen: im Normalbetrieb bleiben immer Termine übrig; sonst soll das als Fehler auffallen.
  if (events.length === 0) {
    throw new Error(roh.length === 0
      ? 'EVLKS-Kalender: leere Antwort, keine Termine'
      : `EVLKS-Kalender: ${roh.length} Einträge, aber keine Termine übrig (Filter, Gebiet oder Zeitfenster prüfen)`);
  }
  return events.sort((a, b) => a.start.localeCompare(b.start)).slice(0, HOECHSTZAHL);
}
