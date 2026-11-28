import * as cheerio from 'cheerio';
import { makeEvent } from '../model.js';
import { fold, resolvePlace } from '../geo.js';
import { berlinIso, imFenster, plusTage } from '../time.js';
import { cleanText, detectStatus, normalizeArt } from '../normalize.js';

export const name = 'niesky';

const QUELLE = 'Stadt Niesky';
const STADT = 'Niesky';
// Angebote im Netz haben keinen Ort, an den man fahren kann.
const IM_NETZ = /\bonline\b|vhs\.cloud|webinar/i;

/**
 * Die Seite nennt freien Text ("HOLZ Niesky, Beispielstraße 16"). Hinter dem letzten Komma soll die Gemeinde stehen.
 * Lässt sich keine erkennen, steht die Spielstätte im "Raum Niesky"; die Feinsuche darf sie dann nachschlagen.
 */
function ortVon(roh) {
  if (!roh) return { placeName: STADT };
  const bekannt = resolvePlace(roh);
  if (!bekannt) {
    const { lat, lon, country } = resolvePlace(STADT);
    return { placeName: `${roh}, Raum ${STADT}`, lat, lon, country, ortRegionKm: 15 };
  }
  const komma = roh.lastIndexOf(',');
  if (komma < 0 || fold(roh.slice(komma + 1)) === fold(bekannt.name)) return { placeName: roh };
  return { placeName: `${roh}, ${bekannt.name}` };
}

/** Je Eintrag nur, was zugesagt ist: Titel, Datum, Uhrzeit, Veranstaltungsort und Link. Vorschautext und Bild bleiben. */
function leseListe(html, listUrl) {
  const $ = cheerio.load(html);
  return $('.event-entry').toArray().map((el) => {
    const e = $(el);
    const a = e.find('h2 a[href]').first();
    const titel = cleanText(a.text());
    const tag = e.find('time.event-time').attr('datetime');
    if (!titel || !a.attr('href') || !/^\d{4}-\d{2}-\d{2}$/.test(tag ?? '')) return null;
    const [von, bis] = e.find('.event-time-start time').toArray().map((t) => cleanText($(t).text()).padStart(5, '0'));
    return {
      titel,
      url: new URL(a.attr('href'), listUrl).href,
      tag,
      endTag: e.find('time.event-time-more').attr('datetime') ?? null,
      von: von ?? null,
      bis: bis ?? null,
      ort: cleanText(e.find('.event-location').text()),
    };
  }).filter(Boolean);
}

function zuEvent(t) {
  const start = berlinIso(t.tag, t.von);
  let end = null;
  if (t.endTag && t.endTag > t.tag) end = berlinIso(t.endTag, null);
  else if (t.bis) end = berlinIso(t.tag, t.bis);
  return makeEvent({
    sourceName: QUELLE,
    sourceId: new URL(t.url).pathname,
    sourceUrl: t.url,
    title: t.titel,
    art: normalizeArt('', t.titel),
    start,
    end,
    hasTime: Boolean(t.von),
    ...ortVon(t.ort),
    contact: { url: t.url },
    ticketStatus: detectStatus(t.titel),
    description: null,
  });
}

/**
 * Veranstaltungsliste der Stadt Niesky (eine Seite, ein Abruf). Zusage vom 27.11.2026: keine Einwände gegen Titel,
 * Datum, Uhrzeit, Veranstaltungsort und Link zur Veranstaltungsseite; keine Bilder, Logos oder andere geschützte Inhalte.
 */
export async function fetchEvents({ http, today, config }) {
  const { body } = await http.get(config.listUrl, { as: 'text', minDelayMs: config.minDelayMs });
  const termine = leseListe(body, config.listUrl);
  if (!termine.length) throw new Error('Niesky: keine Termine in der Seite gefunden');
  const letzterTag = plusTage(today, config.horizonDays ?? 120);
  return termine
    .filter((t) => !IM_NETZ.test(t.titel) && !IM_NETZ.test(t.ort))
    .filter((t) => imFenster(t.tag, t.endTag, today, letzterTag))
    .map(zuEvent);
}
