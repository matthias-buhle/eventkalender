const TZ = 'Europe/Berlin';

const partsFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ, hourCycle: 'h23',
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
});
const dayFmt = new Intl.DateTimeFormat('sv-SE', { timeZone: TZ });

/** Berliner Ortszeit (YYYY-MM-DDTHH:MM) eines Zeitpunkts. */
function berlinLocal(instantMs) {
  const p = Object.fromEntries(partsFmt.formatToParts(new Date(instantMs)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

const pad = (n) => String(n).padStart(2, '0');

/**
 * ISO-8601-Zeit mit Berliner Offset. time=null ergibt Mitternacht.
 * @param {string} date 'YYYY-MM-DD'
 * @param {string|null} time 'HH:MM'
 */
export function berlinIso(date, time) {
  const hhmm = time ?? '00:00';
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = hhmm.split(':').map(Number);
  const wanted = `${date}T${hhmm}`;
  const asUtc = Date.UTC(y, m - 1, d, h, min);
  for (const offset of [1, 2]) {
    if (berlinLocal(asUtc - offset * 3600000) === wanted) {
      return `${date}T${hhmm}:00+${pad(offset)}:00`;
    }
  }
  // Zeit existiert nicht (Umstellung): Offset vom Mittag desselben Tages verwenden.
  const noon = Date.UTC(y, m - 1, d, 12, 0);
  const offset = berlinLocal(noon - 3600000) === `${date}T12:00` ? 1 : 2;
  return `${date}T${hhmm}:00+${pad(offset)}:00`;
}

/** Versteht 'Di, 10.11.2026' und '10.11.2026'; sonst null. */
export function parseGermanDate(text) {
  const m = /(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(text ?? '');
  if (!m) return null;
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const check = new Date(Date.UTC(y, mo - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return null;
  return `${y}-${pad(mo)}-${pad(d)}`;
}

/** Heutiges Datum in Berlin als 'YYYY-MM-DD'. */
export function todayBerlin(now) {
  return dayFmt.format(now);
}

/** Zeitpunkt (ms seit 1970) als Berliner ISO-Zeit mit Offset. */
export function berlinIsoAt(instantMs) {
  const lokal = berlinLocal(instantMs);
  return berlinIso(lokal.slice(0, 10), lokal.slice(11, 16));
}

/** Tag ('YYYY-MM-DD') plus eine Anzahl Tage. */
export function plusTage(tag, tage) {
  const d = new Date(`${tag}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + tage);
  return d.toISOString().slice(0, 10);
}

/** Läuft der Termin im Fenster [heute, letzterTag]? Mehrtägige Termine zählen, solange sie laufen. */
export const imFenster = (start, ende, heute, letzterTag) => start.slice(0, 10) <= letzterTag && (ende ?? start).slice(0, 10) >= heute;
