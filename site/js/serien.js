// Bildet aus den gefilterten Terminen die Zeilen der Liste (Einzeltermine und Serien). Reine Funktionen, kein Zugriff auf window oder document.
import { lastDay, groupByDay } from './filter.js';

const WOCHENTAGE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

/** "Do, 26. Nov." für 2026-11-26. */
export function kurzTag(tag) {
  const d = new Date(`${tag}T00:00:00Z`);
  return `${WOCHENTAGE[d.getUTCDay()].slice(0, 2)}, ${d.getUTCDate()}. ${MONATE[d.getUTCMonth()].slice(0, 3)}.`;
}

/** Die Serien-Kennung eines Termins; alte Daten ohne das Feld und leere Werte sind Einzeltermine (null). */
const serieVon = (ev) => (typeof ev.serie === 'string' && ev.serie !== '' ? ev.serie : null);

/** Nach start sortiert (stabil); gleicher start nur einmal, der erste gilt. */
function nachStartOhneDoppelte(termine) {
  const sortiert = [...termine].sort((a, b) => a.start.localeCompare(b.start));
  const gesehen = new Set();
  return sortiert.filter((e) => !gesehen.has(e.start) && gesehen.add(e.start));
}

const abgesagt = (ev) => ev.ticketStatus === 'abgesagt' || ev.ticketStatus === 'verlegt';

/**
 * Zeilen der Liste. Ein Einzeltermin ergibt { ev, termine: null }. Eine Serie steht einmal, angeführt vom ersten sichtbaren
 * Termin, der nicht abgesagt oder verlegt ist (sonst vom frühesten); `termine` sind alle Termine der Serie ab heute,
 * oder null, wenn es weniger als zwei sind.
 * @param {any[]} sichtbar Ergebnis von applyFilters
 * @param {any[]} alle alle geladenen Termine
 * @param {string} heute JJJJ-MM-TT
 * @returns {{ev:any, termine:any[]|null}[]}
 */
export function zeilenAus(sichtbar, alle, heute) {
  const sichtbarJeSerie = new Map();
  for (const ev of sichtbar) {
    const id = serieVon(ev);
    if (id === null) continue;
    if (!sichtbarJeSerie.has(id)) sichtbarJeSerie.set(id, []);
    sichtbarJeSerie.get(id).push(ev);
  }
  const alleJeSerie = new Map();
  for (const ev of alle) {
    const id = serieVon(ev);
    if (id === null || !sichtbarJeSerie.has(id) || lastDay(ev) < heute) continue;
    if (!alleJeSerie.has(id)) alleJeSerie.set(id, []);
    alleJeSerie.get(id).push(ev);
  }
  const zeilen = [];
  const fertig = new Set();
  for (const ev of sichtbar) {
    const id = serieVon(ev);
    if (id === null) {
      zeilen.push({ ev, termine: null });
      continue;
    }
    if (fertig.has(id)) continue;
    fertig.add(id);
    const passend = nachStartOhneDoppelte(sichtbarJeSerie.get(id));
    const termine = nachStartOhneDoppelte(alleJeSerie.get(id) ?? []);
    zeilen.push({ ev: passend.find((e) => !abgesagt(e)) ?? passend[0], termine: termine.length >= 2 ? termine : null });
  }
  return zeilen;
}

/** Wie groupByDay, aber für Zeilen: maßgeblich ist zeile.ev. @returns {{day:string, zeilen:any[]}[]} */
export function zeilenNachTagen(zeilen, fromDay) {
  const zeileVon = new Map(zeilen.map((z) => [z.ev, z]));
  return groupByDay(zeilen.map((z) => z.ev), fromDay).map((g) => ({ day: g.day, zeilen: g.events.map((e) => zeileVon.get(e)) }));
}

/** Ist die Terminliste der Quelle voll (dann kennen wir nur ein Mindest-Ende)? */
export const istVoll = (termine) => termine.at(-1).terminlisteVoll === true;

/** Kalendertage seit 1970 aus JJJJ-MM-TT, unabhängig von Zeitzone und Zeitumstellung. */
const tagNr = (tag) => Date.UTC(+tag.slice(0, 4), +tag.slice(5, 7) - 1, +tag.slice(8, 10)) / 86400000;

/** "freitags, samstags und sonntags" (Reihenfolge Montag bis Sonntag). */
function wochentageText(tageNr) {
  const namen = [...new Set(tageNr.map((n) => new Date(n * 86400000).getUTCDay()))]
    .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
    .map((w) => `${WOCHENTAGE[w].toLowerCase()}s`);
  return namen.length === 1 ? namen[0] : `${namen.slice(0, -1).join(', ')} und ${namen.at(-1)}`;
}

/**
 * Text der zweiten Zeile einer Serie: Rhythmus, Ende, Anzahl. Die erste passende Regel gilt.
 * @param {any[]} termine Termine der Serie (mindestens zwei), nach start sortiert
 * @param {any} naechster der Termin, mit dem die Zeile angeführt wird
 */
export function serienText(termine, naechster) {
  const n = termine.length;
  const tageListe = [...new Set(termine.map((e) => e.start.slice(0, 10)))];
  const nrs = tageListe.map(tagNr).sort((a, b) => a - b);
  const ende = kurzTag(lastDay(termine.at(-1)));
  const voll = istVoll(termine);
  const mitEnde = (rhythmus) => (voll ? `${rhythmus}, mindestens bis ${ende}` : `${rhythmus} bis ${ende} · ${n} Termine`);

  if (n <= 3) {
    const starttag = naechster.start.slice(0, 10);
    const weitere = termine.filter((e) => e.start !== naechster.start).map((e) => {
      const tag = e.start.slice(0, 10);
      return tag === starttag && e.hasTime ? `${e.start.slice(11, 16)} Uhr` : kurzTag(tag);
    });
    return `auch ${weitere.join(' und ')}`;
  }
  if (nrs.length === 1) return `${n} Termine an diesem Tag`;
  const spanne = nrs.at(-1) - nrs[0] + 1;
  if (nrs.length === spanne) return mitEnde('täglich');
  const wochentage = new Set(nrs.map((x) => new Date(x * 86400000).getUTCDay()));
  if (wochentage.size === 1) {
    const woechentlich = nrs.every((x, i) => i === 0 || x - nrs[i - 1] === 7);
    return mitEnde(woechentlich ? `jeden ${WOCHENTAGE[[...wochentage][0]]}` : wochentageText(nrs));
  }
  if (wochentage.size <= 3) return mitEnde(wochentageText(nrs));
  if (nrs.length >= 5 && nrs.length / spanne >= 0.6) return mitEnde('fast täglich');
  return voll ? `Termine mindestens bis ${ende}` : `${n} Termine bis ${ende}`;
}
