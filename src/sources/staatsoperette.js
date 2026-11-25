import { makeEvent } from '../model.js';
import { berlinIso } from '../time.js';
import { cleanText, detectSorte, detectStatus, normalizeArt, shorten } from '../normalize.js';

export const name = 'staatsoperette';

const QUELLE = 'Staatsoperette Dresden';
const ORT_HAUS = 'Staatsoperette Dresden, Dresden';

/** Platzhalter der Staatsoperette für noch fehlende Texte; daraus wird keine Beschreibung. */
const PLATZHALTER = /^weitere informationen folgen/i;

/**
 * Zeitangaben der Schnittstelle: "2026-11-28T19:30:00" ohne Zone. Gemeint ist die Ortszeit in Dresden,
 * also Berliner Zeit (die Staatsoperette spielt nur dort; eine UTC-Angabe passte nicht zu den Anfangszeiten).
 */
function berliner(text) {
  const m = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}))?/.exec(String(text ?? ''));
  return m ? { iso: berlinIso(m[1], m[2] ?? null), hatZeit: Boolean(m[2]) && m[2] !== '00:00' } : null;
}

/**
 * Spielstätte: das Haus im Kraftwerk Mitte (Saal, Kranfoyer, Foyer ...) ist für Besucher ein Ort, "Staatsoperette Dresden".
 * Gastspielorte (z. B. "Großer Saal Hellerau") behalten ihren Namen. Koordinaten liefert die Schnittstelle nicht.
 */
function ortVon(location) {
  const titel = cleanText(location?.title);
  const stadt = cleanText(location?.city) || 'Dresden';
  if (!titel || /^staatsoperette\b/i.test(titel)) return ORT_HAUS;
  return `${titel}, ${stadt}`;
}

function webAdresse(wert) {
  try {
    const u = new URL(String(wert ?? ''));
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null;
  } catch {
    return null;
  }
}

/**
 * Ein Eintrag der Schnittstelle ist eine Produktion mit einer Liste von Terminen (event_dates); jeder Termin wird ein Event.
 * Es gibt kein Statusfeld (ausverkauft/abgesagt): der Status kommt nur aus Stichwörtern im Titel, sonst null.
 * Preise, Bilder (medialist) und Lizenzangaben gibt es bzw. werden hier nicht übernommen.
 */
function zuEvents(roh, config) {
  const titel = cleanText(roh?.title);
  if (!titel || !Array.isArray(roh.event_dates)) return [];
  const seite = webAdresse(roh.event_link?.[0]?.href) ?? webAdresse(roh.ticket_link?.href) ?? webAdresse(config.url);
  const karten = webAdresse(roh.ticket_link?.href);
  const kategorie = cleanText(roh.categories);
  const art = normalizeArt(kategorie, titel);
  const text = cleanText(roh.description);
  const beschreibung = PLATZHALTER.test(text) ? '' : shorten(text, 300);
  const status = detectStatus(`${titel} ${kategorie}`);
  const ort = ortVon(roh.location);
  const events = [];
  for (const d of roh.event_dates) {
    const start = berliner(d?.start_date);
    if (!start || !seite) continue;
    const endeRoh = berliner(d.end_date);
    // Ende nur mit Anfangszeit sinnvoll; fehlt es (null) oder liegt es nicht nach dem Anfang, bleibt es offen.
    const ende = start.hatZeit && endeRoh && endeRoh.iso > start.iso ? endeRoh.iso : null;
    events.push(makeEvent({
      sourceName: QUELLE,
      sourceId: `${roh.id ?? titel}:${start.iso}`,
      sourceUrl: seite,
      title: titel,
      art,
      genre: detectSorte(art, kategorie, titel), // Hinweis für die Einsortierung, nur aus Kategorie und Titel
      start: start.iso,
      end: ende,
      hasTime: start.hatZeit,
      placeName: ort,
      contact: { url: seite },
      ticketUrl: karten,
      ticketStatus: status,
      description: beschreibung || null,
    }));
  }
  return events;
}

/**
 * Terminschnittstelle der Staatsoperette Dresden (data-exports/events.json), von der Staatsoperette am 25.11.2026
 * ausdrücklich zugesagt und selbst genannt. Ein Abruf liefert den ganzen Spielplan.
 */
export async function fetchEvents({ http, today, config }) {
  const { body } = await http.get(config.url, { as: 'json' });
  const liste = Array.isArray(body) ? body : body?.events;
  if (!Array.isArray(liste)) throw new Error('Staatsoperette: unerwartete Antwort, keine Liste von Terminen');
  return liste
    .flatMap((roh) => zuEvents(roh, config))
    .filter((e) => (e.end ?? e.start).slice(0, 10) >= today);
}
