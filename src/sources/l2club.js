import * as cheerio from 'cheerio';
import { extractSchemaEvents } from '../schemaorg.js';
import { makeEvent } from '../model.js';
import { berlinIsoAt } from '../time.js';
import { cleanText, normalizeArt, normalizePhone, shorten } from '../normalize.js';

export const name = 'l2club';

const QUELLE = 'L2 Club Görlitz';
const KONZERT = /tribute|master show|coverband|live[- ]?(?:band|konzert|tour)|\bkonzert|\btour\b/i;
const KEINE_PARTY = /comedy|stand-?up|true crime|rechtsmedizin|lesung|kabarett|theater/i;

/** Die Zeit aus dem JSON-LD ("2026-11-14T21:00:00+01:00") als Berliner Zeit. */
function zeit(text) {
  const ms = Date.parse(String(text ?? ''));
  return Number.isNaN(ms) ? null : berlinIsoAt(ms);
}

/** Der Club zeigt fast nur Partys; Tribute-Shows sind Konzerte, Comedy und Vorträge bleiben sonstiges. */
function artVon(titel, text) {
  const art = normalizeArt('', titel);
  if (art !== 'sonstiges') return art;
  if (KEINE_PARTY.test(titel)) return 'sonstiges';
  if (KONZERT.test(titel) || KONZERT.test(text.slice(0, 200))) return 'konzert';
  return 'party';
}

function verfuegbarkeit(offers) {
  const werte = offers.map((o) => String(o.availability ?? ''));
  if (werte.some((w) => /InStock|LimitedAvailability/i.test(w))) return 'verfuegbar';
  if (werte.some((w) => /OutOfStock|SoldOut/i.test(w))) return 'ausverkauft';
  return null;
}

function zuEvent(roh, seitenUrl) {
  const start = zeit(roh.startDate);
  const titel = cleanText(roh.name);
  if (!titel || !start) return null;
  const ende = zeit(roh.endDate);
  const text = cleanText(String(roh.description ?? '').replace(/\p{Extended_Pictographic}️?/gu, ' '));
  const url = roh.url ?? seitenUrl;
  const ticket = roh.offers.find((o) => o.url)?.url ?? null;
  return makeEvent({
    sourceName: QUELLE,
    sourceId: `${url}#${start}`,
    sourceUrl: url,
    title: titel,
    art: artVon(titel, text),
    start,
    end: ende && ende > start ? ende : null,
    hasTime: true,
    placeName: [roh.location?.name, roh.location?.locality].filter(Boolean).join(', '),
    lat: roh.location?.lat ?? null,
    lon: roh.location?.lon ?? null,
    contact: { phone: normalizePhone(text), url },
    ticketUrl: ticket,
    ticketStatus: verfuegbarkeit(roh.offers),
    description: shorten(text, 300) || null,
  });
}

/** Die Adressen der Terminseiten aus der Liste (ohne Anker wie #tickets, jede nur einmal). */
function terminSeiten(html, listUrl) {
  const $ = cheerio.load(html);
  const seiten = new Set();
  $('a[href*="/events/"]').each((_, a) => {
    const url = new URL($(a).attr('href'), listUrl);
    url.hash = '';
    if (/^\/events\/[^/]+$/.test(url.pathname)) seiten.add(url.href);
  });
  return [...seiten];
}

/**
 * Programm des L2 Club in Görlitz: die Liste nennt die Terminseiten, jede trägt schema.org-Daten (JSON-LD).
 * Fällt eine Terminseite aus, bleiben die übrigen; ohne jeden Termin meldet die Quelle einen Fehler.
 */
export async function fetchEvents({ http, config }) {
  const { body, url: listUrl } = await http.get(config.listUrl, { as: 'text' });
  const seiten = terminSeiten(body, config.listUrl ?? listUrl).slice(0, config.maxDetailPages ?? 30);
  if (!seiten.length) throw new Error('L2 Club: keine Termine in der Liste gefunden');
  const events = [];
  let ersterFehler = null;
  for (const seite of seiten) {
    try {
      const { body: html } = await http.get(seite, { as: 'text' });
      const roh = extractSchemaEvents(html).find((e) => e.startDate);
      const event = roh && zuEvent(roh, seite);
      if (event) events.push(event);
    } catch (fehler) {
      ersterFehler ??= fehler;
    }
  }
  if (!events.length && ersterFehler) throw ersterFehler;
  return events;
}
