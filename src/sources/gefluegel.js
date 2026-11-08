import * as cheerio from 'cheerio';
import { extractSchemaEvents } from '../schemaorg.js';
import { makeEvent } from '../model.js';
import { berlinIso } from '../time.js';
import { cleanText, normalizePhone, shorten } from '../normalize.js';
import { plusTage } from './culturebase.js';

export const name = 'gefluegel';

const QUELLE = 'Oberlausitzer Geflügelzüchterverband';
const tag = (iso) => String(iso ?? '').slice(0, 10);

/** Liest den Ausstellungskalender: Titel, Link, Zeitraum und Kurztext je Eintrag. */
function leseListe(html, listUrl) {
  const $ = cheerio.load(html);
  return $('.event-entry-div').map((_, el) => {
    const a = $(el).find('h3 a').first();
    const href = a.attr('href')?.trim();
    const zeiten = $(el).find('time').map((__, t) => $(t).attr('datetime')).get();
    if (!href || !zeiten[0]) return null;
    const teaser = cleanText($(el).find('.vorschau').first().text()).replace(/\s*\.{3}\s*\[mehr\]$/, '');
    return { title: cleanText(a.text()), url: new URL(href, listUrl).href, start: zeiten[0], end: zeiten[1] ?? null, teaser };
  }).get().filter(Boolean);
}

/** Ort, Veranstalter und Kontakt der Detailseite (JSON-LD kennt nur Namen und Datum). */
function leseDetail(html, detailUrl) {
  const $ = cheerio.load(html);
  const ld = extractSchemaEvents(html)[0] ?? null;
  const ortBox = $('.single-view-4-location');
  const ortName = cleanText(ortBox.children('p').first().text()) || ld?.location?.name || '';
  const stadt = /\b\d{5}\s+([^\d]+?)\s*$/.exec(cleanText(ortBox.find('.tiny_p').last().text()))?.[1] ?? null;
  const orgBox = $('.single-view-4-organizer');
  const orgText = cleanText(orgBox.text().replace(/Veranstalter/, ''));
  const veranstalter = cleanText(orgBox.children('p').first().text());
  const mail = orgBox.find('a[href^="mailto:"]').attr('href')?.replace(/^mailto:/, '').split('?')[0] || null;
  const extern = orgBox.find('a[href^="http"]').filter((_, a) => new URL($(a).attr('href')).host !== new URL(detailUrl).host).first().attr('href');
  return {
    ld,
    placeName: [ortName, stadt].filter(Boolean).join(', '),
    veranstalter,
    text: cleanText($('#single-view-4-content').text()) || cleanText(ld?.description),
    contact: { phone: normalizePhone(orgText), email: mail, url: extern ?? detailUrl },
  };
}

function zuEvent(eintrag, detail) {
  const startTag = tag(detail?.ld?.startDate ?? eintrag.start);
  const endTag = tag(detail?.ld?.endDate ?? eintrag.end);
  const beschreibung = [detail?.veranstalter && `Veranstalter: ${detail.veranstalter}.`, detail?.text || eintrag.teaser].filter(Boolean).join(' ');
  return makeEvent({
    sourceName: QUELLE,
    sourceId: eintrag.url,
    sourceUrl: eintrag.url,
    title: eintrag.title,
    art: 'schau',
    start: berlinIso(startTag, null),
    end: endTag && endTag !== startTag ? berlinIso(endTag, null) : null,
    hasTime: false,
    placeName: detail?.placeName ?? '',
    contact: detail?.contact ?? { url: eintrag.url },
    description: shorten(beschreibung, 300) || null,
  });
}

/**
 * Ausstellungskalender des Oberlausitzer Geflügelzüchterverbands. Eine Liste, dazu je Termin eine Detailseite
 * (Ort, Veranstalter); jede Seite wird je Lauf höchstens einmal abgerufen, mit großem Abstand (Crawl-delay-Wunsch der Seite).
 */
export async function fetchEvents({ http, today, config }) {
  const opts = { as: 'text', minDelayMs: config.minDelayMs ?? 10000 };
  const { body } = await http.get(config.listUrl, opts);
  const letzterTag = plusTage(today, config.horizonDays ?? 60);
  const eintraege = leseListe(body, config.listUrl)
    .filter((e) => tag(e.end ?? e.start) >= today && tag(e.start) <= letzterTag)
    .sort((a, b) => a.start.localeCompare(b.start));
  const events = [];
  for (const [i, eintrag] of eintraege.entries()) {
    let detail = null;
    if (i < (config.maxDetailPages ?? 60)) {
      try {
        const antwort = await http.get(eintrag.url, opts);
        detail = leseDetail(antwort.body, eintrag.url);
      } catch { /* Termin bleibt mit den Listenangaben */ }
    }
    events.push(zuEvent(eintrag, detail));
  }
  return events;
}
