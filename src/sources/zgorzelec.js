import { extractSchemaEvents } from '../schemaorg.js';
import { makeEvent } from '../model.js';
import { berlinIso, plusTage } from '../time.js';
import { cleanText } from '../normalize.js';

export const name = 'zgorzelec';

/**
 * Veranstaltungskalender der Stadt Zgorzelec (Kalendarz wydarzeń, Modern Events Calendar mit schema.org-JSON-LD).
 * Die Stadt wurde am 24.11.2026 per freiwilliger Hinweis-Mail informiert (keine Bitte um Erlaubnis); ihre robots.txt
 * sperrt nichts. Zugesagt und übernommen werden NUR Titel, Datum und Uhrzeit, Ort und der Link zur Veranstaltung auf
 * zgorzelec.eu. Keine Bilder, keine Beschreibungstexte (description bleibt null).
 *
 * Die Terminliste steht vollständig in einer Seite (ein Abruf, keine Einzelseiten): je Eintrag Beginn, Ende, Ort
 * ("Zgorzelec" oder "Görlitz (DE)") und Link. Die Titel bleiben polnisch (die Übersetzung gibt es nur für Tschechien).
 */
const QUELLE = 'Stadt Zgorzelec';
const LISTE = 'https://zgorzelec.eu/wydarzenia-zgorzelec/';

/** Mittelpunkt von Zgorzelec: die Stadt hat keinen Eintrag in places.json, ohne Koordinaten gäbe es keine Entfernung. */
const MITTE = { lat: 51.152, lon: 15.009 };

/** Polnische Stichworte → Art (die deutschen Regeln in normalize.js erkennen sie nicht). */
const ART_NACH_TITEL = [
  ['markt', /jarmark|kiermasz/i],
  ['konzert', /koncert|recital|melodie|orkiestra|kabaret/i],
  ['schau', /wystaw/i],
  ['fest', /festyn|rocznica|\bfina[łl]\b/i],
];

const artVon = (titel) => ART_NACH_TITEL.find(([, regel]) => regel.test(titel))?.[0] ?? 'sonstiges';

/** "Görlitz (DE)" → "Görlitz"; "Zgorzelec" bleibt. Ohne Ortsangabe gilt Zgorzelec. */
function ortVon(location) {
  const roh = cleanText(location?.name ?? '').replace(/\s*\((?:DE|PL)\)\s*$/i, '');
  return roh || 'Zgorzelec';
}

function statusVon(raw) {
  const s = String(raw?.eventStatus ?? '');
  if (/Cancel/i.test(s)) return 'abgesagt';
  if (/Postponed|Rescheduled/i.test(s)) return 'verlegt';
  return null;
}

/** Zerlegt "2026-11-25T18:00:00+01:00" oder "2026-11-25" in Tag und Uhrzeit (Ortszeit, wie die Seite sie nennt). */
function zeitpunkt(text) {
  const m = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}))?/.exec(text ?? '');
  if (!m) return null;
  return { tag: m[1], zeit: m[2] && m[2] !== '00:00' ? m[2] : null };
}

function zuTermin(roh) {
  const titel = cleanText(roh.name ?? '');
  const url = roh.url;
  const start = zeitpunkt(roh.startDate);
  if (!titel || !url || !start) return null;
  const ende = zeitpunkt(roh.endDate);
  let endeIso = null;
  if (ende && start.zeit && ende.zeit && `${ende.tag}T${ende.zeit}` > `${start.tag}T${start.zeit}`) endeIso = berlinIso(ende.tag, ende.zeit);
  else if (ende && ende.tag > start.tag) endeIso = berlinIso(ende.tag, ende.zeit ?? '23:59');
  return {
    titel,
    url,
    tag: start.tag,
    endeTag: ende?.tag ?? start.tag,
    hasTime: Boolean(start.zeit),
    start: berlinIso(start.tag, start.zeit),
    end: endeIso,
    ort: ortVon(roh.location),
    status: statusVon(roh.raw),
  };
}

/**
 * Ein mehrtägiger Termin (z. B. Weihnachtsmarkt bis 20.12.) steht mehrfach in der Liste: je Öffnungstag ein Eintrag mit
 * demselben Ende. Er wird zu einem Termin vom ersten Tag bis zum Ende.
 */
function zusammenfassen(termine) {
  const gesehen = new Set();
  return termine
    .sort((a, b) => a.start.localeCompare(b.start))
    .filter((t) => {
      if (!t.end) return true;
      const schluessel = `${t.url}|${t.end}`;
      if (gesehen.has(schluessel)) return false;
      gesehen.add(schluessel);
      return true;
    });
}

function zuEvent(t, config) {
  const inZgorzelec = t.ort === 'Zgorzelec';
  return makeEvent({
    sourceName: QUELLE,
    sourceId: `${new URL(t.url).pathname}#${t.start}`,
    sourceUrl: t.url,
    title: t.titel,
    art: artVon(t.titel),
    start: t.start,
    end: t.end,
    hasTime: t.hasTime,
    placeName: t.ort,
    ...(inZgorzelec ? MITTE : {}),
    contact: config.contact,
    ticketStatus: t.status,
    description: null,
  });
}

/** Termine der Stadt Zgorzelec ab `today` (laufende mehrtägige Termine zählen mit); ein Abruf der Listenseite. */
export async function fetchEvents({ http, today, config }) {
  const { body } = await http.get(config.url ?? LISTE, { as: 'text' });
  const letzterTag = config.horizonDays ? plusTage(today, config.horizonDays) : null;
  const termine = extractSchemaEvents(body).map(zuTermin).filter(Boolean);
  return zusammenfassen(termine)
    .filter((t) => t.endeTag >= today && (!letzterTag || t.tag <= letzterTag))
    .map((t) => zuEvent(t, config));
}
