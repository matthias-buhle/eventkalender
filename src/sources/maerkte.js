import { extractSchemaEvents } from '../schemaorg.js';
import { makeEvent } from '../model.js';
import { berlinIso } from '../time.js';
import { fold, resolvePlace } from '../geo.js';
import { cleanText, detectStatus, shorten } from '../normalize.js';
import { plusTage } from './culturebase.js';

export const name = 'maerkte';

const tag = (iso) => String(iso ?? '').slice(0, 10);

/** Die Portale kodieren Texte doppelt oder dreifach (&amp;ouml;): so lange entschlüsseln, bis nichts mehr passiert. */
function entschluesseln(text) {
  let t = cleanText(text);
  for (let i = 0; i < 4; i++) {
    const weiter = cleanText(t);
    if (weiter === t) break;
    t = weiter;
  }
  return t;
}

/** Ein Termin des Portals als flache Zeile; null, wenn Ort oder Datum unbrauchbar sind. */
function zuZeile(e, ausserhalbPlz, verworfen) {
  const titel = entschluesseln(e.name);
  const startTag = tag(e.startDate);
  if (!titel || !startTag || !e.url) return null;
  const ort = e.location;
  if (ort?.postalCode && ausserhalbPlz.some((p) => ort.postalCode.startsWith(p))) return null;
  const placeName = [entschluesseln(ort?.name), entschluesseln(ort?.locality)].filter(Boolean).join(', ');
  // Nur Orte, die wir kennen: die Portale führen auch weit entfernte Märkte unter derselben Postleitzahl-Zone.
  if (!resolvePlace(entschluesseln(ort?.locality)) && !resolvePlace(placeName)) {
    verworfen?.add(placeName);
    return null;
  }
  const beschreibung = entschluesseln(e.description);
  return {
    titel, startTag, endTag: tag(e.endDate) || startTag, url: e.url, placeName,
    beschreibung, status: detectStatus(`${titel} ${beschreibung.slice(0, 200)}`),
  };
}

/** Tage mit eigener Seite (derselbe Markt, derselbe Ort, lückenlos aufeinanderfolgende Tage) werden ein Termin. */
function fasseTageZusammen(zeilen) {
  const gruppen = new Map();
  for (const z of zeilen) {
    const schluessel = `${fold(z.titel)}|${fold(z.placeName)}`;
    if (!gruppen.has(schluessel)) gruppen.set(schluessel, []);
    gruppen.get(schluessel).push(z);
  }
  const ergebnis = [];
  for (const gruppe of gruppen.values()) {
    gruppe.sort((a, b) => a.startTag.localeCompare(b.startTag));
    let aktuell = null;
    for (const z of gruppe) {
      if (aktuell && z.startTag <= plusTage(aktuell.endTag, 1)) {
        if (z.endTag > aktuell.endTag) aktuell.endTag = z.endTag;
        aktuell.status ??= z.status;
      } else {
        aktuell = { ...z };
        ergebnis.push(aktuell);
      }
    }
  }
  return ergebnis;
}

function zuEvent(z) {
  return makeEvent({
    sourceName: new URL(z.url).host,
    sourceId: z.url,
    sourceUrl: z.url,
    title: z.titel,
    art: 'markt',
    start: berlinIso(z.startTag, null),
    end: z.endTag > z.startTag ? berlinIso(z.endTag, null) : null,
    hasTime: false,
    placeName: z.placeName,
    contact: { url: z.url },
    ticketStatus: z.status,
    description: shorten(z.beschreibung, 300) || null,
  });
}

/** Liest eine Portalseite für Postleitzahl-Zone und folgt `?page=N`, solange Termine im Zeitraum kommen. */
async function leseUrl(http, url, { today, letzterTag, maxPages, ausserhalbPlz, verworfen }) {
  const zeilen = [];
  for (let seite = 1; seite <= maxPages; seite++) {
    let body;
    try {
      ({ body } = await http.get(seite === 1 ? url : `${url}?page=${seite}`, { as: 'text' }));
    } catch (fehler) {
      if (seite === 1) throw fehler;
      break; // spätere Seite fehlt: mit dem bisher Gelesenen weiterarbeiten
    }
    const roh = extractSchemaEvents(body);
    if (!roh.length) break;
    for (const e of roh) {
      const z = zuZeile(e, ausserhalbPlz, verworfen);
      if (z && z.endTag >= today && z.startTag <= letzterTag) zeilen.push(z);
    }
    const spaetester = roh.map((e) => tag(e.startDate)).filter(Boolean).sort().at(-1);
    if (!spaetester || spaetester > letzterTag) break;
  }
  return zeilen;
}

/**
 * Märkte aus den Portalen meine-flohmarkt-termine.de und meine-kunsthandwerker-termine.de (JSON-LD je Seite).
 * Eine ausgefallene Adresse stoppt die anderen nicht; fallen alle aus, ist es ein Fehler.
 */
export async function fetchEvents({ http, today, config }) {
  const optionen = {
    today,
    letzterTag: plusTage(today, config.horizonDays ?? 60),
    maxPages: config.maxPages ?? 8,
    ausserhalbPlz: config.ausserhalbPlz ?? [],
    verworfen: new Set(),
  };
  const zeilen = [];
  let letzterFehler = null;
  let geklappt = 0;
  for (const url of config.urls ?? []) {
    try {
      zeilen.push(...await leseUrl(http, url, optionen));
      geklappt++;
    } catch (fehler) {
      letzterFehler = fehler;
    }
  }
  if (!geklappt && letzterFehler) throw letzterFehler;
  const events = fasseTageZusammen(zeilen).map(zuEvent);
  // Für den Status: Orte, die das Ortsverzeichnis nicht kennt und deren Termine deshalb fehlen.
  events.verworfeneOrte = [...optionen.verworfen];
  return events;
}
