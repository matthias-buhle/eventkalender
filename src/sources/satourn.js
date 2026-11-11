import { XMLParser } from 'fast-xml-parser';
import { extractSchemaEvents } from '../schemaorg.js';
import { makeEvent } from '../model.js';
import { imFenster, plusTage } from '../time.js';
import { cleanText, detectStatus, normalizeArt, normalizePhone, shorten } from '../normalize.js';

export const name = 'satourn';

const xml = new XMLParser({ ignoreAttributes: true });
const liste = (wert) => (wert === undefined || wert === null ? [] : [].concat(wert));

/** Statushinweise nur aus Titel und Kurztext lesen; Langtexte erzählen oft von "verlegten" Handlungen. */
const statusAus = (...teile) => detectStatus(teile.filter(Boolean).join(' '));

// --- sebnitz.org: eingebettetes JSON (Daten der Tourismusdatenbank, Lizenz CC0) ---

function ausSebnitz(html, config, heute, letzterTag) {
  const treffer = /<script[^>]*id="event-data"[^>]*>([\s\S]*?)<\/script>/.exec(html);
  if (!treffer) throw new Error('sebnitz.org: eingebettete Termindaten nicht gefunden');
  const daten = JSON.parse(treffer[1]);
  const events = [];
  const gesehen = new Set();
  for (const e of daten.events ?? []) {
    if (e.canonical) gesehen.add(e.canonical);
    const kontakt = (e.contacts ?? [])[0] ?? {};
    for (const o of e.occurrences ?? []) {
      if (!e.title || !o.start || !imFenster(o.start, o.end, heute, letzterTag)) continue;
      events.push(makeEvent({
        sourceName: 'sebnitz.org',
        sourceId: `${e.id}:${o.start}`,
        sourceUrl: new URL(e.url, config.sebnitzUrl).href,
        title: cleanText(e.title),
        art: normalizeArt((e.categories ?? []).join(' '), e.title),
        start: o.start,
        end: o.hideEnd ? null : (o.end ?? null),
        hasTime: !o.allDay,
        placeName: [e.venue, e.city].filter(Boolean).join(', '),
        lat: e.geo?.latitude ?? null,
        lon: e.geo?.longitude ?? null,
        contact: { phone: normalizePhone(kontakt.phone), url: kontakt.web || e.website || null, email: kontakt.email || null },
        ticketUrl: e.ticket || null,
        ticketStatus: o.cancelled ? 'abgesagt' : statusAus(e.title, e.teaser),
        description: shorten(cleanText(e.description || e.teaser), 300) || null,
      }));
    }
  }
  return { events, gesehen };
}

// --- saechsische-schweiz.de: Event-Sitemap und JSON-LD je Detailseite ---

async function eventUrls(http, config) {
  const { body: index } = await http.get(config.sitemapIndexUrl, { as: 'text' });
  const eintrag = liste(xml.parse(index).sitemapindex?.sitemap).find((s) => String(s.loc).includes('ndsdestinationdataevent'));
  if (!eintrag) throw new Error('Event-Sitemap nicht im Index gefunden');
  const { body } = await http.get(eintrag.loc, { as: 'text' });
  return liste(xml.parse(body).urlset?.url).map((u) => ({ loc: String(u.loc), lastmod: Date.parse(u.lastmod) || 0 }));
}

function ausDetail(html, heute, letzterTag) {
  const events = [];
  for (const roh of extractSchemaEvents(html)) {
    if (!roh.name || !roh.startDate || !imFenster(roh.startDate, roh.endDate, heute, letzterTag)) continue;
    const anbieter = roh.raw.author ?? {};
    const kennung = [].concat(roh.raw.identifier ?? [])[0] ?? roh.url;
    events.push(makeEvent({
      sourceName: 'Sächsische Schweiz',
      sourceId: `${kennung}:${roh.startDate}`,
      sourceUrl: roh.url,
      title: cleanText(roh.name),
      art: normalizeArt('', roh.name),
      start: roh.startDate,
      end: roh.endDate,
      hasTime: !/T00:00:00/.test(roh.startDate),
      placeName: [roh.location?.name, roh.location?.locality].filter(Boolean).join(', '),
      lat: roh.location?.lat ?? null,
      lon: roh.location?.lon ?? null,
      contact: { phone: normalizePhone(anbieter.telephone), url: anbieter.url || null, email: anbieter.email || null },
      ticketUrl: roh.offers[0]?.url ?? null,
      ticketStatus: statusAus(roh.name, cleanText(roh.description).slice(0, 160)),
      description: shorten(cleanText(roh.description), 300) || null,
    }));
  }
  return events;
}

/**
 * Sächsische Schweiz: der Sebnitzer Kalender (alle Termine mit Kontakt in einem Abruf) und die Tourismus-Sitemap
 * (nur die zuletzt geänderten Detailseiten, höchstens maxDetailPages je Lauf). Fällt ein Teil aus, läuft der andere weiter.
 */
export async function fetchEvents({ http, today, config }) {
  const letzterTag = plusTage(today, config.horizonDays ?? 90);
  const events = [];
  let gesehen = new Set();
  const fehler = [];

  try {
    const { body } = await http.get(config.sebnitzUrl, { as: 'text' });
    const sebnitz = ausSebnitz(body, config, today, letzterTag);
    events.push(...sebnitz.events);
    gesehen = sebnitz.gesehen;
  } catch (err) {
    fehler.push(err);
  }

  try {
    const urls = (await eventUrls(http, config))
      .filter((u) => !gesehen.has(u.loc))
      .sort((a, b) => b.lastmod - a.lastmod)
      .slice(0, config.maxDetailPages ?? 150);
    for (const u of urls) {
      try {
        const { body } = await http.get(u.loc, { as: 'text' });
        events.push(...ausDetail(body, today, letzterTag));
      } catch {
        // eine einzelne Detailseite darf den Lauf nicht stoppen
      }
    }
  } catch (err) {
    fehler.push(err);
  }

  if (fehler.length === 2) throw fehler[0];
  return events;
}
