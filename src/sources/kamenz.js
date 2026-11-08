import * as cheerio from 'cheerio';
import { extractSchemaEvents } from '../schemaorg.js';
import { makeEvent } from '../model.js';
import { berlinIso, parseGermanDate } from '../time.js';
import { cleanText, detectStatus, normalizeArt, shorten } from '../normalize.js';

export const name = 'kamenz';

const QUELLE = 'Stadt Kamenz';

/** Das Ende steht nur im Anzeigetext: "Sa, 14.11.2026, 14:00 Uhr - Di, 17.11.2026, 14:00 Uhr". */
function endeAusAnzeige(zeitText) {
  const treffer = [...zeitText.matchAll(/(\d{1,2}\.\d{1,2}\.\d{4}),\s*(\d{1,2}:\d{2})/g)];
  if (treffer.length < 2) return null;
  const tag = parseGermanDate(treffer[1][1]);
  return tag ? berlinIso(tag, treffer[1][2].padStart(5, '0')) : null;
}

function zuEvent(roh, config) {
  if (!roh.name || !roh.startDate) return null;
  const $ = cheerio.load(roh.raw.html);
  // Manche Einträge verlinken nur das Bild, nicht die Überschrift.
  const detail = roh.url ?? $('a[href*="/veranstaltung_kamenz_ausfuehrlich/"]').first().attr('href');
  const link = detail ? new URL(detail, config.url).href : config.url;
  const beschreibung = $('[itemprop="description"]').clone();
  beschreibung.find('.more').remove();
  const text = cleanText(beschreibung.html() ?? '');
  const reservix = $('a[href*="reservix"]').attr('href');
  const mitZeit = !/T00:00:00/.test(roh.startDate);
  return makeEvent({
    sourceName: QUELLE,
    sourceId: `${new URL(link).pathname}#${roh.startDate}`,
    sourceUrl: link,
    title: cleanText(roh.name),
    art: normalizeArt('', roh.name),
    start: roh.startDate,
    end: endeAusAnzeige($('time').first().text().replace(/\s+/g, ' ')),
    hasTime: mitZeit,
    placeName: [roh.location?.name, 'Kamenz'].filter(Boolean).join(', '),
    contact: config.contact,
    ticketUrl: reservix ? new URL(reservix, config.url).href : null,
    ticketStatus: detectStatus(`${roh.name} ${text}`),
    description: shorten(text, 300) || null,
  });
}

/** Veranstaltungskalender der Stadt Kamenz (schema.org-Microdata). Ein Reservix-Link ist nur ein Kauflink, kein Verfügbarkeitsbeleg. */
export async function fetchEvents({ http, config }) {
  const { body } = await http.get(config.url, { as: 'text' });
  return extractSchemaEvents(body).map((roh) => zuEvent(roh, config)).filter(Boolean);
}
