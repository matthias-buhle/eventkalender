import * as cheerio from 'cheerio';
import { makeEvent } from '../model.js';
import { berlinIso, plusTage } from '../time.js';
import { cleanText, detectStatus } from '../normalize.js';

export const name = 'hoftheater';

const QUELLE = 'Hoftheater Dresden';
const ORT = 'Hoftheater Weißig, Dresden';
// "Geschlossene Familienfeier - …" und "Veranstaltung der Hutbergschule" sind nicht öffentlich.
const NICHT_OEFFENTLICH = /geschlossene (?:veranstaltung|vorstellung|familienfeier|gesellschaft)|^veranstaltung der /i;

const pad = (n) => String(n).padStart(2, '0');

/** Die Seite nennt kein Jahr: für den ersten Eintrag zählt das Jahr, das dem heutigen Tag am nächsten liegt. */
function ersterTag(monat, tag, heute) {
  const jahr = Number(heute.slice(0, 4));
  const kandidaten = [jahr - 1, jahr, jahr + 1].map((j) => `${j}-${pad(monat)}-${pad(tag)}`);
  const abstand = (d) => Math.abs(Date.parse(d) - Date.parse(heute));
  return kandidaten.reduce((a, b) => (abstand(b) < abstand(a) ? b : a));
}

/**
 * Liest je Eintrag nur das, was zugesagt ist: Titel, Datum, Uhrzeit und den Link zum Stück, dazu "ausverkauft".
 * Der Untertitel dient nur dazu, nicht öffentliche Termine zu erkennen; er wird nicht übernommen.
 * Die Liste ist zeitlich geordnet; springt Monat und Tag zurück, beginnt das nächste Jahr.
 */
function leseListe(html, seitenUrl, heute) {
  const $ = cheerio.load(html);
  let vorher = null;
  return $('.termine').toArray().map((el) => {
    const e = $(el);
    const [, tag, monat] = /^(\d{1,2})\.(\d{1,2})\./.exec(cleanText(e.find('.tagmonat').first().text())) ?? [];
    const a = e.find('.link a[href]').first();
    const titel = cleanText(a.text());
    const href = a.attr('href');
    if (!monat || !titel || !href) return null;
    let datum = vorher ? `${vorher.slice(0, 4)}-${pad(monat)}-${pad(tag)}` : ersterTag(Number(monat), Number(tag), heute);
    if (vorher && datum < vorher) datum = `${Number(vorher.slice(0, 4)) + 1}${datum.slice(4)}`;
    vorher = datum;
    const untertitel = cleanText(e.find('.link').first().clone().find('a').remove().end().text());
    if (NICHT_OEFFENTLICH.test(titel) || NICHT_OEFFENTLICH.test(untertitel)) return null;
    const [, h, min] = /(\d{1,2})[:.](\d{2})/.exec(e.find('.uhrzeit').first().text()) ?? [];
    return {
      title: titel,
      tag: datum,
      uhr: h ? `${pad(h)}:${min}` : null,
      url: new URL(href, seitenUrl).href,
      status: detectStatus(cleanText(e.find('.show-tickets').first().text())),
    };
  }).filter(Boolean);
}

function zuEvent(t) {
  const start = berlinIso(t.tag, t.uhr);
  return makeEvent({
    // Dasselbe Stück läuft an vielen Abenden: erst Link plus Beginn macht den Termin eindeutig.
    sourceName: QUELLE,
    sourceId: `${t.url}#${start}`,
    sourceUrl: t.url,
    title: t.title,
    // Alles läuft im Theater; die Spielstätte bestimmt die Rubrik. "Weihnachtsfeier" im Titel macht kein Fest.
    art: 'sonstiges',
    start,
    hasTime: Boolean(t.uhr),
    placeName: ORT,
    contact: { url: t.url },
    ticketStatus: t.status,
    description: null,
  });
}

/**
 * Spielplan des Hoftheaters Dresden-Weißig (eine Seite, ein Abruf). Zusage vom 26.11.2026 auf eine Anfrage, die nennt:
 * Titel, Datum, Uhrzeit, Spielstätte und den Link zur Vorstellung; eine Beschreibung nur mit Erlaubnis, keine Bilder.
 * Eine ausdrückliche Erlaubnis für Beschreibungen gab es nicht, darum bleiben sie weg.
 */
export async function fetchEvents({ http, today, config }) {
  const { body } = await http.get(config.url, { as: 'text' });
  const termine = leseListe(body, config.url, today);
  if (!termine.length) throw new Error('Hoftheater: keine Termine in der Seite gefunden');
  const letzterTag = plusTage(today, config.horizonDays ?? 120);
  return termine.filter((t) => t.tag >= today && t.tag <= letzterTag).map(zuEvent);
}
