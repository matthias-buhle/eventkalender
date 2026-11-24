import { makeEvent } from '../model.js';
import { berlinIso, berlinIsoAt, imFenster, plusTage } from '../time.js';
import { cleanText, detectSorte, detectStatus, normalizeArt, shorten } from '../normalize.js';
import { HttpError } from '../http.js';

export const name = 'dresden';

const QUELLE = 'Veranstaltungskalender Dresden';

/**
 * Die robots.txt des Hosts sperrt pauschal alles (gegen Suchmaschinen). Dresden Marketing GmbH hat den Abruf über die
 * Schnittstelle mit eigenen Zugangsdaten ausdrücklich erlaubt, deshalb ohne diese Prüfung; der Abstand je Host bleibt.
 */
const ERLAUBT = { robots: false };
const text = (wert) => (typeof wert === 'string' ? wert.trim() : '');

/**
 * Anmeldung: Key und Secret kommen nur aus der Umgebung und gehen nur als JSON-Inhalt an die Token-Adresse.
 * Der Token gilt 24 Stunden; er wird je Lauf einmal geholt und nie in eine Adresse oder Meldung geschrieben.
 */
async function holeToken(http, config) {
  const apiKey = process.env.DRESDEN_API_KEY;
  const apiSecret = process.env.DRESDEN_API_SECRET;
  if (!apiKey || !apiSecret) throw new Error('keine Zugangsdaten (DRESDEN_API_KEY und DRESDEN_API_SECRET)');
  let antwort;
  try {
    antwort = await http.post(`${config.apiUrl}/oauth/v2/token`, { json: { apiKey, apiSecret }, as: 'json', ...ERLAUBT });
  } catch (err) {
    if (err instanceof HttpError && err.status < 500) throw new Error(`Dresden-API: Anmeldung abgelehnt (HTTP ${err.status}), Zugangsdaten prüfen`);
    throw err;
  }
  const token = text(antwort?.body?.access_token);
  if (!token) throw new Error('Dresden-API: Anmeldung ohne Token in der Antwort');
  return token;
}

/** Alle Termine im Zeitfenster, Seite für Seite. Passt die Liste nicht in maxPages Seiten, ist das ein Fehler. */
async function holeTermine(http, config, token, today) {
  const limit = config.limit ?? 500;
  const filter = JSON.stringify({
    end_date_from: berlinIso(today, null),
    start_date_to: berlinIso(plusTage(today, config.horizonDays ?? 90), '23:59'),
  });
  const termine = [];
  let gesamt = null;
  for (let nr = 0; nr < (config.maxPages ?? 40); nr++) {
    const url = new URL('/api/v2/secure/eventdates', config.apiUrl);
    url.search = new URLSearchParams({ offset: String(termine.length), limit: String(limit), include_event: 'true', filter }).toString();
    const { body } = await http.get(url.href, { as: 'json', headers: { Authorization: `Bearer ${token}` }, ...ERLAUBT });
    if (!Array.isArray(body?.data)) throw new Error('Dresden-API: Antwort enthält keine Terminliste');
    termine.push(...body.data);
    // Ohne total_count gilt eine Seite, die kürzer als limit ist, als die letzte.
    gesamt = Number.isInteger(body.total_count) ? body.total_count : null;
    if (gesamt === null ? body.data.length < limit : termine.length >= gesamt) return termine;
    if (body.data.length === 0) break;
  }
  throw new Error(`Dresden-API: Liste unvollständig (${termine.length} von ${gesamt ?? 'unbekannt vielen'} Terminen gelesen), maxPages oder limit prüfen`);
}

const webAdresse = (wert) => (/^https?:\/\/\S+$/i.test(text(wert)) ? text(wert) : null);
const zahl = (wert) => (wert === null || wert === undefined || wert === '' || !Number.isFinite(Number(wert)) ? null : Number(wert));
const liste = (wert) => (Array.isArray(wert) ? wert : []);

/** Zeitpunkt der Schnittstelle (ISO mit beliebigem Offset) als Berliner ISO-Zeit; unlesbar → null. */
function berliner(wert) {
  const ms = Date.parse(text(wert));
  return Number.isNaN(ms) ? null : berlinIsoAt(ms);
}

/** Titel der Stichwörter und Kategorien als ein Text; Einträge ohne Titel (z. B. bloße Nummern) zählen nicht. */
function kategorieText(e) {
  return [...liste(e.categories), ...liste(e.tags)]
    .map((k) => text(typeof k === 'string' ? k : k?.title))
    .filter(Boolean)
    .join(' ');
}

const TICKET = /ticket|karten|vorverkauf|buchen|booking/i;

/** Sichere Links am Termin: der erste Ticket-Link und der erste andere Link. */
function linksVon(e) {
  const links = liste(e.event_links).map((l) => ({ href: webAdresse(l?.href), titel: text(l?.title) })).filter((l) => l.href);
  return {
    ticket: links.find((l) => TICKET.test(l.titel))?.href ?? null,
    seite: links.find((l) => !TICKET.test(l.titel))?.href ?? null,
  };
}

/** "Spielstätte, Stadt"; nennt die Spielstätte die Stadt schon, bleibt es bei der Spielstätte. */
function ortsname(ort) {
  const haus = cleanText(ort?.title);
  const stadt = cleanText(ort?.city);
  if (haus && stadt && haus.toLowerCase().includes(stadt.toLowerCase())) return haus;
  return [haus, stadt].filter(Boolean).join(', ');
}

/**
 * Ein Termin (EventDate) mit eingebetteter Veranstaltung → Event. Übernommen wird nur, was die Veranstaltung als
 * offene Daten kennzeichnet (open_data: true); Online-Termine und abgeschaltete Termine bleiben weg.
 * Vom Veranstalter wird nur die Webseite übernommen: Ansprechperson, Mail und Telefon stehen im Datensatz für die
 * Verwaltung des Kalenders und sind nicht zum Weitergeben gedacht.
 */
function zuEvent(d, config) {
  const e = d?.event;
  if (!e || typeof e !== 'object' || d.enabled === false) return null;
  if (e.open_data !== true || e.is_online_event === true) return null;
  const titel = cleanText(e.title);
  const verlegt = d.is_rescheduled === true;
  const neu = verlegt ? berliner(d.rescheduled_start_date) : null;
  const start = neu ?? berliner(d.start_date);
  if (!titel || !start) return null;

  const placeName = ortsname(e.location);
  if (!placeName) return null;
  const { ticket, seite } = linksVon(e);
  const hostSeite = webAdresse(e.host?.url);
  const quelle = seite ?? ticket ?? hostSeite ?? webAdresse(config.fallbackUrl);
  if (!quelle) return null;

  const hasTime = !/T00:00:00/.test(start);
  const endeRoh = berliner(neu ? d.rescheduled_end_date : d.end_date);
  const ende = endeRoh && endeRoh > start && (hasTime || endeRoh.slice(0, 10) !== start.slice(0, 10)) ? endeRoh : null;
  const lat = zahl(e.location?.lat);
  const lon = zahl(e.location?.lng);
  const verortet = lat !== null && lon !== null && (lat !== 0 || lon !== 0);
  const kategorien = kategorieText(e);
  const art = normalizeArt(kategorien, titel);
  const beschreibung = cleanText(e.description);

  return makeEvent({
    sourceName: QUELLE,
    sourceId: `${e.id ?? titel}:${d.id ?? start}`,
    sourceUrl: quelle,
    title: titel,
    art,
    genre: detectSorte(art, kategorien), // Hinweis für die Einsortierung, nur aus Stichwörtern und Kategorie
    start,
    end: ende,
    hasTime,
    placeName,
    lat: verortet ? lat : null,
    lon: verortet ? lon : null,
    contact: { url: hostSeite },
    ticketUrl: ticket,
    ticketStatus: d.is_cancelled === true ? 'abgesagt' : verlegt ? 'verlegt' : detectStatus(titel),
    description: shorten(beschreibung, 300) || null,
  });
}

/**
 * Veranstaltungskalender der Dresden Marketing GmbH (veranstaltungen-api.dresden.de, Zugang erteilt am 24.11.2026).
 * Der Adapter liest nur: ein POST für den Token, danach nur GET. Dieselben Zugangsdaten dürften auch schreiben;
 * hier gibt es dafür bewusst keinen Code.
 */
export async function fetchEvents({ http, today, config }) {
  const token = await holeToken(http, config);
  const termine = await holeTermine(http, config, token, today);
  const letzterTag = plusTage(today, config.horizonDays ?? 90);
  const events = termine
    .map((d) => zuEvent(d, config))
    .filter((e) => e && imFenster(e.start, e.end, today, letzterTag));

  // Wie bei der SaTourN-API: im Zeitfenster gibt es im Normalbetrieb immer Termine. Bleibt keiner übrig, soll das
  // als Fehler auffallen (und die Übernahme der letzten guten Termine greifen), statt als leere Quelle durchzugehen.
  if (events.length === 0) {
    throw new Error(termine.length === 0
      ? 'Dresden-API: leere Antwort, keine Termine'
      : `Dresden-API: ${termine.length} Einträge, aber keine Termine übrig (open_data, Ort, Link oder Zeitfenster prüfen)`);
  }
  return events;
}
