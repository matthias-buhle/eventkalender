import * as cheerio from 'cheerio';
import { makeEvent } from '../model.js';
import { berlinIso } from '../time.js';
import { cleanText, normalizeArt, normalizePhone, shorten } from '../normalize.js';
import { plusTage } from './culturebase.js';

export const name = 'stolpen';

const QUELLE = 'Stadt Stolpen';
const MEHRTAGIG = new Set(['markt', 'fest', 'schau']);
const MAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/;

/** Liest die Terminliste: Start (datetime), Ende (aus "14:00 - 17:00 Uhr"), Ort, Titel, Link. */
function leseListe(html, listUrl) {
  const $ = cheerio.load(html);
  return $('.mod_eventlist .event').map((_, el) => {
    const e = $(el);
    const zeit = e.find('time[datetime]').first();
    const [, tagStart, uhr] = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(zeit.attr('datetime') ?? '') ?? [];
    const a = e.find('.event_content a[href]').first();
    const titel = cleanText(e.find('h3').first().text());
    if (!tagStart || !a.attr('href') || !titel) return null;
    const bis = /\d{1,2}:\d{2}\s*[-–]\s*(\d{1,2}):(\d{2})\s*Uhr/.exec(zeit.text());
    const ort = cleanText(e.find('.location strong').first().text());
    return {
      title: titel,
      tag: tagStart,
      von: uhr,
      bis: bis ? `${bis[1].padStart(2, '0')}:${bis[2]}` : null,
      placeName: [ort, 'Stolpen'].filter(Boolean).join(', '),
      url: new URL(a.attr('href'), listUrl).href,
    };
  }).get().filter(Boolean);
}

/** Tage mit eigenem Eintrag (gleicher Titel und Ort, lückenlos) werden bei Märkten, Festen und Schauen ein Termin. */
function fasseZusammen(eintraege) {
  const ergebnis = [];
  for (const e of [...eintraege].sort((a, b) => a.tag.localeCompare(b.tag) || a.von.localeCompare(b.von))) {
    const art = normalizeArt('', e.title);
    const vorher = ergebnis.find((x) => x.title === e.title && x.placeName === e.placeName && MEHRTAGIG.has(art) && e.tag <= plusTage(x.endTag, 1));
    if (vorher) {
      vorher.endTag = e.tag;
      vorher.bis = e.bis ?? e.von;
    } else {
      ergebnis.push({ ...e, art, endTag: e.tag });
    }
  }
  return ergebnis;
}

/** Telefon und E-Mail stehen nur im Freitext der Detailseite; ohne Angabe bleibt der Kontakt leer. */
function leseDetail(html) {
  const $ = cheerio.load(html);
  const text = cleanText($('.mod_eventreader .rte').text());
  const mail = $('.mod_eventreader .rte a[href^="mailto:"]').attr('href')?.replace(/^mailto:/, '').split('?')[0] ?? MAIL.exec(text)?.[0] ?? null;
  return { text, contact: { phone: normalizePhone(text), url: null, email: mail } };
}

function zuEvent(e, detail) {
  const mehrTage = e.endTag > e.tag;
  return makeEvent({
    sourceName: QUELLE,
    sourceId: e.url,
    sourceUrl: e.url,
    title: e.title,
    art: e.art,
    start: berlinIso(e.tag, e.von),
    end: mehrTage ? berlinIso(e.endTag, e.bis) : (e.bis ? berlinIso(e.tag, e.bis) : null),
    hasTime: true,
    placeName: e.placeName,
    contact: detail?.contact ?? {},
    description: shorten(detail?.text ?? '', 300) || null,
  });
}

/**
 * Veranstaltungskalender der Stadt Stolpen: eine Liste, dazu je Termin höchstens eine Detailseite
 * (Kontakt nur, wenn im Text genannt; sonst bleibt der Kontakt leer und der Quellenlink die Anlaufstelle).
 */
export async function fetchEvents({ http, today, config }) {
  const { body } = await http.get(config.listUrl, { as: 'text' });
  const letzterTag = plusTage(today, config.horizonDays ?? 90);
  const eintraege = fasseZusammen(
    leseListe(body, config.listUrl).filter((e) => e.tag >= today && e.tag <= letzterTag),
  );
  const events = [];
  for (const [i, e] of eintraege.entries()) {
    let detail = null;
    if (i < (config.maxDetailPages ?? 40)) {
      try {
        detail = leseDetail((await http.get(e.url, { as: 'text' })).body);
      } catch { /* Termin bleibt mit den Listenangaben */ }
    }
    events.push(zuEvent(e, detail));
  }
  return events;
}
