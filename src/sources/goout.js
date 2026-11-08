import { extractSchemaEvents } from '../schemaorg.js';
import { makeEvent } from '../model.js';
import { berlinIso, berlinIsoAt } from '../time.js';
import { cleanText, detectStatus, normalizeArt, normalizePhone, shorten } from '../normalize.js';

export const name = 'goout';

/** Art nach Kategorieseite; "jine-akce" (andere Veranstaltungen) bleibt dem Titel überlassen. */
const ART_NACH_SEITE = { koncerty: 'konzert', parties: 'party' };

/** JSON-LD von GoOut nennt Zeiten wie 'Sat Nov 14 2026 19:00:00 GMT+0000 (Coordinated Universal Time)' (UTC); ISO ohne Zone gilt als Berliner Zeit. */
function zeit(text) {
  const s = String(text ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return { iso: berlinIso(s, null), hasTime: false };
  const lokal = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2})?$/.exec(s);
  if (lokal) return { iso: berlinIso(lokal[1], lokal[2]), hasTime: true };
  const ms = Date.parse(s);
  return Number.isNaN(ms) ? null : { iso: berlinIsoAt(ms), hasTime: true };
}

/** Das angegebene Ende ist oft nur "23:59:59" desselben Tages, also kein echtes Ende. */
function ende(text, start) {
  const z = zeit(text);
  if (!z?.hasTime || z.iso.slice(11, 16) === '23:59' || z.iso <= start) return null;
  return z.iso;
}

function verfuegbarkeit(offers) {
  const werte = offers.map((o) => String(o.availability ?? ''));
  if (werte.some((w) => /InStock|LimitedAvailability/i.test(w))) return 'verfuegbar';
  if (werte.some((w) => /OutOfStock|SoldOut/i.test(w))) return 'ausverkauft';
  return null;
}

function zuEvent(roh, kategorie) {
  const start = zeit(roh.startDate);
  if (!roh.name || !roh.url || !start) return null;
  const text = cleanText(String(roh.description ?? '').replace(/\*\*/g, ''));
  const titel = cleanText(roh.name);
  const art = ART_NACH_SEITE[kategorie] ?? normalizeArt('', titel);
  return makeEvent({
    sourceName: 'GoOut',
    sourceId: `${roh.url}#${start.iso}`,
    sourceUrl: roh.url,
    title: titel,
    art,
    start: start.iso,
    end: ende(roh.endDate, start.iso),
    hasTime: start.hasTime,
    placeName: [roh.location?.name, roh.location?.locality].filter(Boolean).join(', '),
    lat: roh.location?.lat ?? null,
    lon: roh.location?.lon ?? null,
    country: 'CZ',
    contact: { phone: normalizePhone(text), url: roh.url },
    ticketUrl: roh.offers[0]?.url ?? null,
    // Negative Hinweise im Titel schlagen "InStock"; verfügbar nur mit Beleg aus dem Angebot.
    ticketStatus: detectStatus(titel) ?? verfuegbarkeit(roh.offers),
    description: shorten(text, 300) || null,
  });
}

/** Kategorieseiten (Konzerte, Partys, andere Akte) tschechischer Grenzstädte auf GoOut; Seiten kommen aus der Sitemap. */
export async function fetchEvents({ http, config }) {
  const { body: sitemap } = await http.get(config.sitemapUrl, { as: 'text' });
  const seiten = new Map();
  for (const m of sitemap.matchAll(/<loc>\s*(https:\/\/goout\.net\/cs\/([\w-]+)\/([\w-]+)\/[\w-]+\/)\s*<\/loc>/g)) {
    if (config.cities.includes(m[2]) && config.categories.includes(m[3])) seiten.set(m[1], m[3]);
  }
  if (!seiten.size) throw new Error('GoOut-Sitemap enthält keine passenden Seiten');

  const events = new Map();
  let erfolge = 0;
  let ersterFehler = null;
  for (const [url, kategorie] of seiten) {
    try {
      const { body } = await http.get(url, { as: 'text' });
      for (const roh of extractSchemaEvents(body)) {
        const event = zuEvent(roh, kategorie);
        if (event && !events.has(event.id)) events.set(event.id, event);
      }
      erfolge++;
    } catch (fehler) {
      ersterFehler ??= fehler;
    }
  }
  if (!erfolge) throw ersterFehler;
  return [...events.values()];
}
