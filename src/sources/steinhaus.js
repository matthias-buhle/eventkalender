import * as cheerio from 'cheerio';
import { makeEvent } from '../model.js';
import { berlinIsoAt } from '../time.js';
import { cleanText, normalizeArt, shorten } from '../normalize.js';

export const name = 'steinhaus';

const QUELLE = 'Steinhaus Bautzen';
const SEITE = 'https://www.steinhaus-bautzen.de/event-details/';

/**
 * Sucht im eingebetteten Wix-JSON alle Listen von Terminen (Objekte mit title, slug und scheduling).
 * Die Seite enthält mehrere: die kommenden Termine und einen Rückblick mit vergangenen. Je nach Auslieferung
 * steht mal die eine, mal die andere zuerst, deshalb werden alle gesammelt.
 */
function findeTermine(wert, treffer = []) {
  if (Array.isArray(wert)) {
    if (wert.length && wert[0]?.scheduling && wert[0]?.title && wert[0]?.slug) treffer.push(wert);
    else for (const x of wert) findeTermine(x, treffer);
  } else if (wert && typeof wert === 'object') {
    for (const k of Object.keys(wert)) findeTermine(wert[k], treffer);
  }
  return treffer;
}

function leseTermine(html) {
  const $ = cheerio.load(html);
  const bekannt = new Set();
  const alle = [];
  for (const el of $('script[type="application/json"]').toArray()) {
    const t = $(el).text();
    if (!t.includes('"scheduling"')) continue;
    try {
      for (const liste of findeTermine(JSON.parse(t))) {
        for (const roh of liste) {
          if (roh?.slug && !bekannt.has(roh.slug)) {
            bekannt.add(roh.slug);
            alle.push(roh);
          }
        }
      }
    } catch { /* kaputtes JSON einer anderen Stelle der Seite */ }
  }
  return alle;
}

function zuEvent(roh) {
  const cfg = roh.scheduling?.config ?? {};
  const ms = Date.parse(cfg.startDate);
  const titel = cleanText(roh.title);
  if (!titel || Number.isNaN(ms) || !roh.slug) return null;
  const start = berlinIsoAt(ms);
  const endMs = cfg.endDateHidden ? NaN : Date.parse(cfg.endDate);
  const ende = Number.isNaN(endMs) ? null : berlinIsoAt(endMs);
  const url = `${SEITE}${roh.slug}`;
  const text = cleanText([roh.description, roh.about].filter(Boolean).join(' '));
  const koordinaten = roh.location?.coordinates;
  return makeEvent({
    sourceName: QUELLE,
    sourceId: url,
    sourceUrl: url,
    title: titel,
    art: normalizeArt('', `${titel} ${text}`),
    start,
    end: ende && ende > start ? ende : null,
    hasTime: true,
    placeName: [roh.location?.name, roh.location?.fullAddress?.city].filter(Boolean).join(', '),
    lat: koordinaten?.lat ?? null,
    lon: koordinaten?.lng ?? null,
    contact: { url },
    // Das Wix-Feld "soldOut" steht bei allen Terminen auf true und sagt nichts über den Kartenverkauf.
    description: shorten(text, 300) || null,
  });
}

/**
 * Terminseite des Steinhaus e. V. in Bautzen. Die Seite trägt alle kommenden Termine eingebettet (Wix-Daten),
 * ein Abruf pro Tag genügt; die Einzelseiten (je rund 1 MB) werden nicht geladen.
 */
export async function fetchEvents({ http, today, config }) {
  const { body } = await http.get(config.url, { as: 'text' });
  const termine = leseTermine(body);
  if (!termine.length) throw new Error('Steinhaus: keine Termine in der Seite gefunden');
  return termine.map(zuEvent).filter((e) => e && (e.end ?? e.start).slice(0, 10) >= today);
}
