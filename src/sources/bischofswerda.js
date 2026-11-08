import * as cheerio from 'cheerio';
import { makeEvent } from '../model.js';
import { berlinIso } from '../time.js';
import { cleanText, detectStatus, normalizeArt, normalizePhone, shorten } from '../normalize.js';

export const name = 'bischofswerda';

const QUELLE = 'Stadt Bischofswerda';
const MONATE = { jan: 1, feb: 2, mär: 3, mar: 3, apr: 4, mai: 5, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, okt: 10, oct: 10, nov: 11, dez: 12, dec: 12 };
const pad = (n) => String(n).padStart(2, '0');

/** "Do, 12 Nov 2026 15:00:00" → { tag:'2026-11-12', zeit:'15:00' } */
function zeitpunkt(text) {
  const m = /(\d{1,2})\s+([A-Za-zä]{3})\w*\s+(\d{4})\s+(\d{2}:\d{2})/.exec(text ?? '');
  const monat = m && MONATE[m[2].toLowerCase()];
  return monat ? { tag: `${m[3]}-${pad(monat)}-${pad(m[1])}`, zeit: m[4] } : null;
}

const iso = (z) => berlinIso(z.tag, z.zeit === '00:00' ? null : z.zeit);

function zuEvent(eintrag, $) {
  const e = $(eintrag);
  const titelRoh = cleanText(e.children('title').text());
  const link = e.children('link[rel="alternate"]').attr('href') ?? e.children('id').text().trim();
  const inhalt = cleanText(e.children('content').text() || e.children('summary').text());
  const kopf = /^Start:\s*([^|]*?)(?:,\s*Ende:\s*([^|]*?))?\s*\|\s*/.exec(inhalt);
  const start = zeitpunkt(kopf?.[1]) ?? zeitpunkt(e.children('published').text().replace('T', ' '));
  if (!titelRoh || !link || !start) return null;
  const ende = zeitpunkt(kopf?.[2]);
  const text = kopf ? inhalt.slice(kopf[0].length) : inhalt;
  // "AUSVERKAUFT" im Titel gilt für den Termin selbst; im Text geht es oft um andere Termine.
  const ausverkauft = /ausverkauft/i.test(titelRoh);
  const titel = titelRoh.replace(/\s*[-–(]*\s*ausverkauft\s*\)?\s*$/i, '').trim();
  const kategorien = e.children('category').map((_, c) => $(c).attr('term')).get().join(' ');
  return makeEvent({
    sourceName: QUELLE,
    sourceId: link,
    sourceUrl: link,
    title: titel || titelRoh,
    art: normalizeArt(kategorien, titel),
    start: iso(start),
    end: ende ? iso(ende) : null,
    hasTime: start.zeit !== '00:00',
    placeName: 'Bischofswerda',
    contact: {
      phone: normalizePhone(text),
      email: /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/.exec(text)?.[0] ?? null,
      url: link,
    },
    ticketStatus: ausverkauft ? 'ausverkauft' : detectStatus(titel),
    description: shorten(text, 300) || null,
  });
}

/** Veranstaltungsfeed (Atom) der Stadt Bischofswerda. */
export async function fetchEvents({ http, config }) {
  const { body } = await http.get(config.url, { as: 'text' });
  const $ = cheerio.load(body, { xmlMode: true });
  return $('entry').map((_, eintrag) => zuEvent(eintrag, $)).get().filter(Boolean);
}
