import { makeEvent } from '../model.js';
import { imFenster, plusTage } from '../time.js';
import { fetchApiEvents } from './satourn-api.js';
import { cleanText, detectStatus, normalizeArt, normalizePhone, shorten } from '../normalize.js';

export const name = 'satourn';

/** Statushinweise nur aus Titel und Kurztext lesen; Langtexte erzählen oft von "verlegten" Handlungen. */
const statusAus = (...teile) => detectStatus(teile.filter(Boolean).join(' '));

// --- sebnitz.org: eingebettetes JSON (Daten der Tourismusdatenbank, Lizenz CC0) ---

function ausSebnitz(html, config, heute, letzterTag) {
  const treffer = /<script[^>]*id="event-data"[^>]*>([\s\S]*?)<\/script>/.exec(html);
  if (!treffer) throw new Error('sebnitz.org: eingebettete Termindaten nicht gefunden');
  const daten = JSON.parse(treffer[1]);
  const events = [];
  for (const e of daten.events ?? []) {
    const kontakt = (e.contacts ?? [])[0] ?? {};
    for (const o of e.occurrences ?? []) {
      if (!e.title || !o.start || !imFenster(o.start, o.end, heute, letzterTag)) continue;
      events.push(makeEvent({
        sourceName: 'sebnitz.org',
        sourceId: `${e.id}:${o.start}`,
        sourceUrl: new URL(e.url, config.sebnitzUrl).href,
        title: cleanText(e.title),
        art: normalizeArt((e.categories ?? []).join(' '), e.title),
        start: o.start,
        end: o.hideEnd ? null : (o.end ?? null),
        hasTime: !o.allDay,
        placeName: [e.venue, e.city].filter(Boolean).join(', '),
        lat: e.geo?.latitude ?? null,
        lon: e.geo?.longitude ?? null,
        contact: { phone: normalizePhone(kontakt.phone), url: kontakt.web || e.website || null, email: kontakt.email || null },
        ticketUrl: e.ticket || null,
        ticketStatus: o.cancelled ? 'abgesagt' : statusAus(e.title, e.teaser),
        description: shorten(cleanText(e.description || e.teaser), 300) || null,
      }));
    }
  }
  return events;
}

/**
 * Sächsische Schweiz und Umkreis: der Sebnitzer Kalender (alle Termine mit Kontakt in einem Abruf) und die
 * SaTourN-API der Tourismus Marketing Gesellschaft Sachsen (ein Abruf, siehe satourn-api.js).
 * Fällt der Sebnitzer Teil aus, laufen die API-Termine weiter. Fällt der API-Teil aus, wirft die Funktion,
 * auch wenn Sebnitz geantwortet hat: so bleiben die Termine des letzten guten Laufs stehen (14-Tage-Übernahme).
 */
export async function fetchEvents({ http, today, config }) {
  const letzterTag = plusTage(today, config.horizonDays ?? 90);
  let sebnitzEvents = [];

  try {
    const { body } = await http.get(config.sebnitzUrl, { as: 'text' });
    sebnitzEvents = ausSebnitz(body, config, today, letzterTag);
  } catch {
    // Sebnitz allein ist verzichtbar; ob die Quelle insgesamt ausfällt, entscheidet der API-Teil
  }

  // Ein Fehler hier wird bewusst nicht abgefangen.
  const apiEvents = await fetchApiEvents({ http, today, config });
  return [...sebnitzEvents, ...apiEvents];
}
