import { createHash } from 'node:crypto';

/**
 * Übersetzt Titel und Beschreibung der tschechischen Termine ins Deutsche (DeepL API).
 * Bewusst fehlertolerant: ohne Schlüssel, bei Netzfehlern oder aufgebrauchtem Kontingent bleibt der Originaltext
 * stehen und der Lauf geht weiter. Jede Übersetzung wandert in einen Zwischenspeicher, der von Lauf zu Lauf
 * weitergereicht wird; so wird derselbe Text nie ein zweites Mal übersetzt und das Kontingent kaum verbraucht.
 */

const STAPEL = 50; // DeepL erlaubt höchstens 50 Texte je Anfrage
const AUFBEWAHREN_TAGE = 90;

/** Der Schlüssel eines Gratis-Kontos endet auf ":fx" und hat einen eigenen Server. */
export function deeplHost(apiKey) {
  return apiKey.trim().endsWith(':fx') ? 'https://api-free.deepl.com' : 'https://api.deepl.com';
}

const schluessel = (text) => createHash('sha1').update(text).digest('hex');
const gleich = (a, b) => a.normalize('NFC').trim().toLowerCase() === b.normalize('NFC').trim().toLowerCase();
const realSleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Der jeweils andere Server: ob ein Schlüssel zum Free- oder Pro-Server gehört, verrät nicht jeder Tarif am Ende (:fx). */
const andererHost = (host) => (host === 'https://api-free.deepl.com' ? 'https://api.deepl.com' : 'https://api-free.deepl.com');

/**
 * Ein Stapel Texte an DeepL. Wirft bei Fehlern; 429 und 5xx werden einmal wiederholt, 456 (Kontingent) nie.
 * Bei 403 (Schlüssel passt nicht zum Server) wird einmal am anderen Server versucht.
 */
async function uebersetzeStapel(texte, { apiKey, fetchImpl, sleep }) {
  const anfrage = (host) => fetchImpl(`${host}/v2/translate`, {
    method: 'POST',
    headers: { Authorization: `DeepL-Auth-Key ${apiKey.trim()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: texte, source_lang: 'CS', target_lang: 'DE' }),
    signal: AbortSignal.timeout(30000),
  });
  let host = deeplHost(apiKey);
  let res = await anfrage(host);
  if (res.status === 403) {
    host = andererHost(host);
    res = await anfrage(host);
  }
  if (res.status === 429 || res.status >= 500) {
    await sleep(3000);
    res = await anfrage(host);
  }
  if (!res.ok) {
    let meldung = '';
    try { meldung = (await res.json())?.message ?? ''; } catch { /* Antwort ohne JSON */ }
    const fehler = new Error(res.status === 456 ? 'DeepL-Kontingent aufgebraucht' : `DeepL HTTP ${res.status}${meldung ? ` (${meldung})` : ''}`);
    fehler.status = res.status;
    throw fehler;
  }
  const antwort = await res.json();
  const liste = antwort?.translations;
  if (!Array.isArray(liste) || liste.length !== texte.length) throw new Error('DeepL: unerwartete Antwort');
  return liste.map((t) => String(t.text ?? ''));
}

/**
 * @param {import('./model.js').Event[]} events
 * @param {{apiKey?:string, cache?:Record<string,{de:string, zuletzt:string}>, heute:string,
 *          fetchImpl?:typeof fetch, sleep?:(ms:number)=>Promise<void>}} opts
 * @returns {Promise<{events:import('./model.js').Event[], cache:object, stats:{uebersetzt:number, ausCache:number, zeichen:number, fehler:string|null}}>}
 */
export async function uebersetzeTermine(events, { apiKey, cache = {}, heute, fetchImpl = fetch, sleep = realSleep }) {
  const neuerCache = { ...cache };
  const stats = { uebersetzt: 0, ausCache: 0, zeichen: 0, fehler: null };
  const tschechisch = events.filter((e) => e.country === 'CZ');

  // Welche Texte brauchen wir? Jeder verschiedene Text einmal.
  const gebraucht = new Set();
  for (const e of tschechisch) {
    if (e.title) gebraucht.add(e.title);
    if (e.description) gebraucht.add(e.description);
  }
  const fehlend = [];
  for (const t of gebraucht) {
    const k = schluessel(t);
    if (neuerCache[k]) {
      neuerCache[k] = { ...neuerCache[k], zuletzt: heute };
      stats.ausCache += 1;
    } else fehlend.push(t);
  }

  if (fehlend.length && !apiKey?.trim()) {
    stats.fehler = 'kein DEEPL_API_KEY gesetzt, Originaltexte bleiben stehen';
  } else {
    for (let i = 0; i < fehlend.length; i += STAPEL) {
      const stapel = fehlend.slice(i, i + STAPEL);
      try {
        const de = await uebersetzeStapel(stapel, { apiKey, fetchImpl, sleep });
        stapel.forEach((t, j) => { neuerCache[schluessel(t)] = { de: de[j], zuletzt: heute }; });
        stats.uebersetzt += stapel.length;
        stats.zeichen += stapel.reduce((s, t) => s + t.length, 0);
      } catch (err) {
        stats.fehler = err.message;
        break; // Rest bleibt im Original; beim nächsten Lauf wird nachgeholt
      }
    }
  }

  // Alte, nicht mehr gebrauchte Einträge verwerfen, damit die Datei nicht endlos wächst.
  const grenze = new Date(`${heute}T00:00:00Z`).getTime() - AUFBEWAHREN_TAGE * 86400000;
  for (const [k, v] of Object.entries(neuerCache)) {
    if (!v?.zuletzt || Date.parse(v.zuletzt) < grenze) delete neuerCache[k];
  }

  const deutsch = (t) => neuerCache[schluessel(t)]?.de ?? null;
  const ergebnis = events.map((e) => {
    if (e.country !== 'CZ') return e;
    const titel = deutsch(e.title);
    const beschreibung = e.description ? deutsch(e.description) : null;
    if (!titel && !beschreibung) return e;
    const neuerTitel = titel?.trim() || e.title;
    const teile = [];
    if (!gleich(neuerTitel, e.title)) teile.push(`Originaltitel: ${e.title}`);
    teile.push(beschreibung?.trim() || e.description || '');
    return { ...e, title: neuerTitel, description: teile.filter(Boolean).join(' – ') || null };
  });
  return { events: ergebnis, cache: neuerCache, stats };
}
