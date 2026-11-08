// Ortsangaben für die Karte und der Navigationslink. Reine Funktionen, keine Seiteneffekte.
// Die Seite kann src/ortsname.js nicht laden; die Zerlegung entspricht dort ortskandidaten().

const NUL = '\u0000';

/** Teile eines Ortsnamens an Kommas; Kommas in Anführungszeichen zählen nicht. */
function teileVon(name) {
  const text = typeof name === 'string' ? name : '';
  const geschuetzt = text.replace(/"[^"]*"/g, (m) => m.replaceAll(',', NUL));
  return geschuetzt.split(',').map((t) => t.replaceAll(NUL, ',').trim()).filter(Boolean);
}

const maskiere = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Ein bekannter Ort als ganzes Wort im Namen ("Museum Bautzen" ja, "Kleinbautzen" nein). */
function bekannterOrtIn(text, bekannte) {
  for (const ort of bekannte) {
    if (typeof ort !== 'string' || !ort) continue;
    if (new RegExp(`(^|[^\\p{L}])${maskiere(ort)}($|[^\\p{L}])`, 'iu').test(text)) return ort;
  }
  return null;
}

/**
 * Die Gemeinde zu einem Ortsnamen wie "Turnhalle, Reichenbach / Sohland": der Teil nach dem letzten Komma, bei mehreren Ortsteilen der erste.
 * Ohne Komma nur ein bekannter Ort aus der Liste; sonst null (lieber nichts anzeigen als etwas Falsches).
 * @param {string|null|undefined} name
 * @param {string[]} [bekannte]
 * @returns {string|null}
 */
export function gemeindeVon(name, bekannte = []) {
  const teile = teileVon(name);
  if (!teile.length) return null;
  if (teile.length >= 2) return teile.at(-1).split('/')[0].trim() || null;
  return bekannterOrtIn(teile[0], bekannte);
}

/** Die Spielstätte: alles vor dem letzten Komma, ohne Komma der ganze Name; null, wenn sie nur die Gemeinde wiederholt. */
export function spielstaetteVon(name, bekannte = []) {
  const teile = teileVon(name);
  if (!teile.length) return null;
  const staette = teile.length >= 2 ? teile.slice(0, -1).join(', ') : teile[0];
  const gemeinde = gemeindeVon(name, bekannte);
  return gemeinde && gemeinde.toLowerCase() === staette.toLowerCase() ? null : staette;
}

/** Grob: 'ios', 'android' oder 'andere' aus dem User-Agent. */
export function plattform(userAgent) {
  const ua = typeof userAgent === 'string' ? userAgent : '';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'andere';
}

/** Adresse für die Navigation zum Termin; null ohne Koordinaten. In die Adresse kommen nur echte Zahlen. */
export function navigationsLink(ev, geraet) {
  const { lat, lon } = ev ?? {};
  if (typeof lat !== 'number' || typeof lon !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const punkt = `${lat},${lon}`;
  if (geraet === 'ios') return `https://maps.apple.com/?daddr=${punkt}`;
  if (geraet === 'android') return `geo:${punkt}?q=${punkt}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${punkt}`;
}
