import * as cheerio from 'cheerio';
import { makeEvent } from '../model.js';
import { berlinIso } from '../time.js';
import { cleanText, detectStatus, normalizeArt, shorten } from '../normalize.js';
import { plusTage } from './culturebase.js';

export const name = 'neustadthalle';

const QUELLE = 'Neustadthalle';
const ORT_HALLE = 'Neustadthalle, Neustadt in Sachsen';

/** Monate (JJJJMM) vom Tag `today` bis zum letzten Tag des Zeitraums, einschließlich. */
function monate(today, letzterTag) {
  const liste = [];
  let [j, m] = today.split('-').map(Number);
  const [lj, lm] = letzterTag.split('-').map(Number);
  while (j < lj || (j === lj && m <= lm)) {
    liste.push(`${j}${String(m).padStart(2, '0')}`);
    if (++m > 12) { m = 1; j++; }
  }
  return liste;
}

/** Liest die Terminliste eines Monats: Datum, Uhrzeit(en), Ort, Titel, Link, Ticketlink, "Ausverkauft!". */
function leseMonat(html, basis) {
  const $ = cheerio.load(html);
  return $('.mod_eventlist .event').map((_, el) => {
    const e = $(el);
    const datum = /(\d{2})\.(\d{2})\.(\d{4})/.exec(e.find('.header .date').text());
    const a = e.find('h2 a').first();
    if (!datum || !a.attr('href')) return null;
    const zeiten = [...e.find('.header .time').text().matchAll(/(\d{1,2}):(\d{2})/g)].map((z) => `${z[1].padStart(2, '0')}:${z[2]}`);
    const ticket = e.find('a[href*="reservix"]').first().attr('href') ?? null;
    const beschreibung = e.find('[itemprop="description"]').first().clone();
    beschreibung.find('.tickets, .ausverkauft').remove();
    return {
      tag: `${datum[3]}-${datum[2]}-${datum[1]}`,
      von: zeiten[0] ?? null,
      bis: zeiten[1] ?? null,
      ort: cleanText(e.find('.header .ort').text()),
      title: cleanText(a.text()),
      url: new URL(a.attr('href'), basis).href,
      ticketUrl: ticket,
      ausverkauft: cleanText(e.find('.ausverkauft').text()) !== '',
      beschreibung: shorten(cleanText(beschreibung.text()), 300),
    };
  }).get().filter(Boolean);
}

function zuEvent(t, contact) {
  return makeEvent({
    sourceName: QUELLE,
    sourceId: `${t.url}#${t.tag}`,
    sourceUrl: t.url,
    title: t.title,
    art: normalizeArt(t.ort, t.title),
    start: berlinIso(t.tag, t.von),
    // Ein Ende, das nicht nach dem Start liegt ("bis 00:00 Uhr"), gehört zum Folgetag.
    end: t.von && t.bis ? berlinIso(t.bis > t.von ? t.tag : plusTage(t.tag, 1), t.bis) : null,
    hasTime: Boolean(t.von),
    placeName: /kirche/i.test(t.ort) ? t.ort : ORT_HALLE,
    contact,
    ticketUrl: t.ticketUrl,
    ticketStatus: t.ausverkauft ? 'ausverkauft' : detectStatus(t.title),
    description: t.beschreibung || null,
  });
}

/**
 * Veranstaltungen der Neustadthalle Neustadt in Sachsen: eine Seite je Monat (`?month=JJJJMM`).
 * Der Kontakt ist der der Halle (aus der Konfiguration), ein Ticketlink kommt nur, wenn die Seite einen Reservix-Link hat.
 */
export async function fetchEvents({ http, today, config }) {
  const letzterTag = plusTage(today, config.horizonDays ?? 60);
  const basis = new URL(config.url);
  const gesehen = new Set();
  const events = [];
  let letzterFehler = null;
  let geklappt = 0;
  for (const monat of monate(today, letzterTag)) {
    let body;
    try {
      ({ body } = await http.get(`${config.url}?month=${monat}`, { as: 'text' }));
      geklappt++;
    } catch (fehler) {
      letzterFehler = fehler;
      continue;
    }
    for (const t of leseMonat(body, basis.origin + '/')) {
      const schluessel = `${t.url}#${t.tag}`;
      if (t.tag < today || t.tag > letzterTag || gesehen.has(schluessel)) continue;
      gesehen.add(schluessel);
      events.push(zuEvent(t, config.contact ?? {}));
    }
  }
  if (!geklappt && letzterFehler) throw letzterFehler;
  return events;
}
