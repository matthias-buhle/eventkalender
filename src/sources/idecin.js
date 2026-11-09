import * as cheerio from 'cheerio';
import { makeEvent } from '../model.js';
import { berlinIsoAt } from '../time.js';
import { cleanText, shorten } from '../normalize.js';

export const name = 'idecin';

const QUELLE = 'Děčín – idecin.cz';
const ART_REGELN = [
  ['konzert', /koncert|jam session|kapela|hudební|hudba|\blive\b|orchestr|recitál|\bdj\b/i],
  ['party', /party|diskotéka|zábava|ples\b/i],
  ['markt', /trh\b|trhy|jarmark|bleší/i],
  ['fest', /festival|slavnost|advent|vánoč|masopust|pouť/i],
  ['schau', /výstava|vernisáž/i],
];

function artVon(titel, text) {
  for (const [art, regel] of ART_REGELN) if (regel.test(titel)) return art;
  for (const [art, regel] of ART_REGELN) if (art !== 'party' && regel.test(text.slice(0, 120))) return art;
  return 'sonstiges';
}

/** "Teplická, 405 02 Děčín, Ústecký kraj, Česko" → "Teplická, Děčín". */
function ortVon(adresse) {
  const teile = String(adresse ?? '').split(',').map((t) => t.trim());
  const stadt = (teile[1] ?? '').replace(/^\d{3}\s?\d{2}\s*/, '');
  return [teile[0], stadt].filter(Boolean).join(', ') || 'Děčín';
}

const sekunden = (wert) => {
  const n = Number(wert);
  return Number.isFinite(n) && n > 0 ? n * 1000 : null;
};

function zuEvent(roh, baseUrl) {
  const startMs = sekunden(roh.dateStart);
  const titel = cleanText(roh.title);
  if (!titel || !startMs || !roh.id) return null;
  const start = berlinIsoAt(startMs);
  const endMs = sekunden(roh.dateEnd);
  const ende = endMs ? berlinIsoAt(endMs) : null;
  const text = cleanText(roh.description);
  const url = `${baseUrl}/udalost/${roh.id}`;
  return makeEvent({
    sourceName: QUELLE,
    sourceId: roh.id,
    sourceUrl: url,
    title: titel,
    art: artVon(titel, text),
    start,
    end: ende && ende > start ? ende : null,
    hasTime: start.slice(11, 16) !== '00:00',
    placeName: ortVon(roh.location?.address),
    lat: roh.location?.lat ?? null,
    lon: roh.location?.lng ?? null,
    country: 'CZ',
    contact: { url },
    description: shorten(text, 300) || null,
  });
}

function leseMonat(html) {
  const $ = cheerio.load(html);
  const roh = $('script#__NEXT_DATA__').text();
  if (!roh) throw new Error('idecin: Seitendaten fehlen');
  const liste = JSON.parse(roh)?.props?.pageProps?.events;
  if (!Array.isArray(liste)) throw new Error('idecin: Seitendaten ohne Termine');
  return liste;
}

/** Monatsseiten ("/program/11-2026") ab dem laufenden Monat; `months` Seiten. */
function monatsSeiten(today, baseUrl, months) {
  let [jahr, monat] = today.split('-').map(Number);
  const seiten = [];
  for (let i = 0; i < months; i++) {
    seiten.push(`${baseUrl}/${String(monat).padStart(2, '0')}-${jahr}`);
    if (++monat > 12) { monat = 1; jahr++; }
  }
  return seiten;
}

/**
 * Programm der Stadt Děčín (idecin.cz): die Monatsseiten tragen ihre Termine als eingebettetes JSON.
 * Titel aus `ausschluss` (kleingeschriebene Teilstrings, z. B. regelmäßiges öffentliches Eislaufen) bleiben draußen.
 */
export async function fetchEvents({ http, today, config }) {
  const baseUrl = config.baseUrl;
  const ausschluss = (config.ausschluss ?? []).map((s) => s.toLowerCase());
  const events = new Map();
  let erfolge = 0;
  let ersterFehler = null;
  for (const seite of monatsSeiten(today, baseUrl, config.months ?? 3)) {
    try {
      const { body } = await http.get(seite, { as: 'text' });
      for (const roh of leseMonat(body)) {
        if (ausschluss.some((a) => String(roh.title ?? '').toLowerCase().includes(a))) continue;
        const event = zuEvent(roh, baseUrl);
        // Die Stadt führt manchen Termin unter zwei Kennungen; gleicher Titel und gleiche Zeit gelten als ein Termin.
        const schluessel = event && `${event.title}|${event.start}`;
        if (event && !events.has(schluessel)) events.set(schluessel, event);
      }
      erfolge++;
    } catch (fehler) {
      ersterFehler ??= fehler;
    }
  }
  if (!erfolge) throw ersterFehler;
  return [...events.values()];
}
