import { makeEvent } from '../model.js';
import { berlinIso, parseGermanDate } from '../time.js';
import { cleanText, detectStatus } from '../normalize.js';

export const name = 'aust';

/** Die Antwort ist { events: { others: [...] } }; alle enthaltenen Listen werden zusammengenommen. */
function eintraege(body) {
  const events = body?.events;
  if (Array.isArray(events)) return events;
  if (events && typeof events === 'object') return Object.values(events).filter(Array.isArray).flat();
  return [];
}

function zuEvent(venue, eintrag) {
  const date = parseGermanDate(eintrag.datum);
  if (!date || !eintrag.titel) return null;
  const beginn = /^\d{1,2}:\d{2}$/.test(eintrag.beginn ?? '') ? eintrag.beginn.padStart(5, '0') : null;
  const teaser = cleanText(eintrag.teaser);
  const beschreibung = teaser.replace(/\+{2,}[^+]*\+{2,}/g, '').replace(/\s+/g, ' ').trim();
  return makeEvent({
    sourceName: venue.name,
    sourceId: String(eintrag.id),
    sourceUrl: `${venue.baseUrl}/konzerte/${eintrag.id}/${eintrag.modrewrite}`,
    title: cleanText(eintrag.titel),
    art: venue.art ?? 'konzert',
    start: berlinIso(date, beginn),
    hasTime: beginn !== null,
    placeName: [eintrag.ort, eintrag.stadt].filter(Boolean).join(', '),
    contact: venue.contact,
    ticketUrl: eintrag.tickets_url || null,
    ticketStatus: detectStatus(teaser),
    description: beschreibung || null,
  });
}

/**
 * Alter Schlachthof und Junge Garde (Bernd Aust KulturManagement): offene JSON-Schnittstelle der eigenen Webseite.
 * Fällt eine Spielstätte aus, liefern die anderen weiter; fallen alle aus, wird der Fehler weitergereicht.
 */
export async function fetchEvents({ http, config }) {
  const events = [];
  const fehler = [];
  for (const venue of config.venues ?? []) {
    try {
      const { body } = await http.get(`${venue.baseUrl}/api/getEvents`, { as: 'json' });
      for (const eintrag of eintraege(body)) {
        const event = zuEvent(venue, eintrag);
        if (event) events.push(event);
      }
    } catch (err) {
      fehler.push(err);
    }
  }
  if (fehler.length && fehler.length === (config.venues ?? []).length) throw fehler[0];
  return events;
}
