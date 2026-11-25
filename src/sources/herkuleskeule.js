import * as cheerio from 'cheerio';
import { makeEvent } from '../model.js';
import { berlinIso, plusTage } from '../time.js';
import { cleanText, detectStatus } from '../normalize.js';

export const name = 'herkuleskeule';

const QUELLE = 'Herkuleskeule Dresden';
const ORT = 'Herkuleskeule, Dresden';
const MONATE = {
  januar: 1, februar: 2, 'märz': 3, april: 4, mai: 5, juni: 6, juli: 7, august: 8,
  september: 9, oktober: 10, november: 11, dezember: 12,
};
const pad = (n) => String(n).padStart(2, '0');

/** Macht aus einer (auch relativen) Adresse eine absolute http(s)-Adresse; sonst null. */
function adresse(href, basis) {
  if (!href) return null;
  try {
    const u = new URL(href, basis);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null;
  } catch { return null; }
}

/**
 * Liest je Eintrag der Terminliste nur das, was zum Verweisen nötig ist: Titel, Datum, Uhrzeit, den Link zur
 * Veranstaltung bei der Herkuleskeule, den Ticketlink und den Hinweis "ausverkauft". Beschreibungen, Untertitel
 * und Bilder werden bewusst nicht gelesen (die Herkuleskeule hat nur das Verweisen erlaubt).
 */
function leseListe(html, seitenUrl) {
  const $ = cheerio.load(html);
  const eintraege = $('#event-list .event-list-item').toArray();
  const termine = eintraege.map((el) => {
    const e = $(el);
    const tag = Number(e.find('.wrapper-date .date-day').first().text());
    const monat = MONATE[cleanText(e.find('.wrapper-date .date-month').first().text()).toLowerCase()];
    const jahr = Number(e.find('.wrapper-date .date-year').first().text());
    const [, uhr] = /(\d{1,2}:\d{2})\s*Uhr/.exec(e.find('.time-time').first().text()) ?? [];
    const titel = cleanText(e.find('.wrapper-title .title .title').first().text());
    const link = adresse(e.find('.content > a[href]').first().attr('href'), seitenUrl);
    if (!tag || !monat || !jahr || !titel || !link) return null;
    const ticket = e.find('.wrapper-ticket');
    return {
      title: titel,
      tag: `${jahr}-${pad(monat)}-${pad(tag)}`,
      uhr: uhr ? uhr.padStart(5, '0') : null,
      url: link,
      ticketUrl: adresse(ticket.find('a[href]').first().attr('href'), seitenUrl),
      // Nur der Ticketkasten zählt, nie der Titel: "ausverkauft" im Programmtitel sagt nichts über den Kartenverkauf.
      status: detectStatus(cleanText(ticket.text())),
    };
  }).filter(Boolean);
  return { gefunden: eintraege.length, termine };
}

function zuEvent(t) {
  const start = berlinIso(t.tag, t.uhr);
  return makeEvent({
    // Dieselbe Veranstaltung läuft an vielen Abenden: erst Link plus Beginn macht den Termin eindeutig.
    sourceName: QUELLE,
    sourceId: `${t.url}#${start}`,
    sourceUrl: t.url,
    title: t.title,
    // Alles hier ist Kabarett. normalizeArt würde Titel wie "Weihnachten - Fest ohne Ausweg" zum Fest machen.
    art: 'sonstiges',
    genre: 'kabarett',
    start,
    hasTime: Boolean(t.uhr),
    placeName: ORT,
    contact: { url: t.url },
    ticketUrl: t.status ? null : t.ticketUrl,
    ticketStatus: t.status,
    description: null,
  });
}

/**
 * Spielplan der Herkuleskeule (Kabarett, Dresden): eine Liste mit allen Terminen, ein Abruf genügt.
 * Es werden nur Termine von heute bis `horizonDays` (Standard 120) Tage voraus übernommen.
 * Die Herkuleskeule hat das Verweisen auf ihre Angebote erlaubt (25.11.2026), nicht das Übernehmen von Texten:
 * darum nur Titel, Datum, Uhrzeit, Ort und Links, keine Beschreibung und keine Bilder.
 */
export async function fetchEvents({ http, today, config }) {
  const { body } = await http.get(config.url, { as: 'text' });
  const { gefunden, termine } = leseListe(body, config.url);
  if (!termine.length) throw new Error(gefunden ? 'Herkuleskeule: kein Eintrag der Liste lesbar' : 'Herkuleskeule: keine Termine in der Seite gefunden');
  const letzterTag = plusTage(today, config.horizonDays ?? 120);
  const gesehen = new Set();
  return termine
    .filter((t) => t.tag >= today && t.tag <= letzterTag)
    .map(zuEvent)
    .filter((e) => !gesehen.has(e.id) && gesehen.add(e.id));
}
