// Baut die Filterseite (Wann? Was? Wo? und den Anzeigen-Knopf) als DOM.
// Fremdwerte (Ortsnamen, Rubriknamen, Termindaten) kommen ausschließlich über textContent und setAttribute hinein, nie über innerHTML.
import { RUBRIKEN, SORTEN } from './arten.js';
import {
  DEFAULT_PREFS, UMKREISE, anzeigeText, applyFilters, berlinDay, gewaehlteSorten, rubrikGetippt, sorteWaehlen, zaehleRubriken, zaehleSorten, zeitAbgelaufen,
  zeitfenster,
} from './filter.js';
import { markierterBereich, monateMitTerminen, monatsName, monatsRaster, tageMitTerminen, tagWaehlen } from './kalender.js';

const STANDARD_ORT = 'Sebnitz';
const SCHNELLWAHL = [['heute', 'Heute'], ['wochenende', 'Wochenende'], ['7', '7 Tage'], ['30', '30 Tage'], ['alle', 'Alle']];
const WOCHENTAGE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const KOPF_TAGE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

function el(doc, tag, klasse, text) {
  const e = doc.createElement(tag);
  if (klasse) e.setAttribute('class', klasse);
  if (text != null) e.textContent = text;
  return e;
}

function knopf(doc, klasse, text) {
  const b = el(doc, 'button', klasse, text);
  b.setAttribute('type', 'button');
  return b;
}

const datum = (tag) => new Date(`${tag}T00:00:00Z`);

/** "Samstag, 28. November" */
function tagLang(tag) {
  const d = datum(tag);
  return `${WOCHENTAGE[d.getUTCDay()]}, ${d.getUTCDate()}. ${MONATE[d.getUTCMonth()]}`;
}

/** "Sa 28.11." */
function tagKurz(tag) {
  const d = datum(tag);
  return `${WOCHENTAGE[d.getUTCDay()].slice(0, 2)} ${d.getUTCDate()}.${d.getUTCMonth() + 1}.`;
}

/** Text des Kalender-Chips bei zeit 'tage': "Sa 28.11.", "Sa 28.11. – So 29.11." oder "ab Sa 28.11.". */
function zeitraumText(prefs, heute) {
  const { von, bis } = zeitfenster(prefs, heute);
  if (!bis) return `ab ${tagKurz(von)}`;
  return von === bis ? tagKurz(von) : `${tagKurz(von)} – ${tagKurz(bis)}`;
}

function abschnitt(doc, titel) {
  const s = el(doc, 'section', 'bereich');
  s.append(el(doc, 'h2', 'bereich-titel', titel));
  return s;
}

/**
 * Baut die Filterseite in `container` (dessen bisheriger Inhalt wird ersetzt).
 * Jede Bedienung, die die Auswahl ändert, ändert ctx.prefs, ruft ctx.beiAenderung() genau einmal und zeichnet dann Zahlen,
 * Kalender und Knopf neu. Das Auf- und Zuklappen des Kalenders ändert die Auswahl nicht und ruft beiAenderung nicht.
 * ctx.events, ctx.orteListe, ctx.orte und ctx.laedt dürfen später ersetzt werden; danach aktualisieren() rufen.
 * @param {Document} doc
 * @param {Element} container
 * @param {{prefs: any, events: any[], orteListe: {name:string,lat:number,lon:number}[], orte: Record<string,{lat:number,lon:number}>,
 *   jetzt: () => string, beiAenderung: () => void, beiAnzeigen: () => void, laedt?: boolean, fehler?: boolean}} ctx
 * @returns {{aktualisieren(): void}}
 */
export function baueFilterseite(doc, container, ctx) {
  const seite = el(doc, 'div', 'filterseite');
  const heute = () => berlinDay(ctx.jetzt());

  const geaendert = () => {
    ctx.beiAenderung();
    aktualisieren();
  };

  // --- Wann? ---
  const wann = abschnitt(doc, 'Wann?');
  const zeitwahl = el(doc, 'div', 'chips zeitwahl');
  zeitwahl.setAttribute('role', 'group');
  zeitwahl.setAttribute('aria-label', 'Zeitraum');
  const zeitChips = new Map();
  for (const [wert, text] of SCHNELLWAHL) {
    const chip = knopf(doc, 'chip', text);
    chip.addEventListener('click', () => {
      Object.assign(ctx.prefs, { zeit: wert, von: null, bis: null });
      geblaettert = false; // der Kalender zeigt wieder den Monat des markierten Bereichs
      kalenderOffen = false;
      geaendert();
    });
    zeitChips.set(wert, chip);
    zeitwahl.append(chip);
  }
  // Der Kalender ist beim Start zugeklappt. Dieser Chip (vor "Alle") klappt ihn auf und zu und nennt den eigenen Zeitraum.
  let kalenderOffen = false;
  const kalenderChip = knopf(doc, 'chip kalender-chip', 'Kalender');
  kalenderChip.setAttribute('aria-controls', 'kalenderbox');
  kalenderChip.addEventListener('click', () => {
    kalenderOffen = !kalenderOffen;
    aktualisieren();
  });
  zeitwahl.insertBefore(kalenderChip, zeitChips.get('alle'));

  const kalenderbox = el(doc, 'div', 'kalenderbox');
  kalenderbox.setAttribute('id', 'kalenderbox');
  const kopf = el(doc, 'div', 'kalender-kopf');
  const zurueck = knopf(doc, 'monat-zurueck', '‹');
  zurueck.setAttribute('aria-label', 'Voriger Monat');
  const vor = knopf(doc, 'monat-vor', '›');
  vor.setAttribute('aria-label', 'Nächster Monat');
  const monatsname = el(doc, 'span', 'monatsname');
  monatsname.setAttribute('aria-live', 'polite');
  kopf.append(zurueck, monatsname, vor);
  const kalender = el(doc, 'div', 'kalender');
  kalenderbox.append(kopf, kalender);
  wann.append(zeitwahl, kalenderbox);

  /**
   * Der gezeigte Monat (JJJJ-MM). Bis zum ersten Blättern folgt er der Zeitwahl: der Monat, in dem der markierte Bereich
   * beginnt, wenn es dort Termine gibt, sonst der Monat von heute. Nach dem Blättern bleibt er, wohin geblättert wurde.
   */
  let monat = heute().slice(0, 7);
  let geblaettert = false;
  let gezeichnet = null;
  let monate = [];
  /** @type {Map<string, Element>} */
  let zellen = new Map();

  function zeichneMonat() {
    kalender.replaceChildren();
    zellen = new Map();
    for (const t of KOPF_TAGE) {
      const wt = el(doc, 'span', 'wt', t);
      wt.setAttribute('aria-hidden', 'true');
      kalender.append(wt);
    }
    for (const t of monatsRaster(monat)) {
      if (!t) {
        kalender.append(el(doc, 'span', 'tag leerzelle'));
        continue;
      }
      const zelle = knopf(doc, 'tag', String(Number(t.slice(8, 10))));
      zelle.setAttribute('data-tag', t);
      zelle.setAttribute('aria-label', tagLang(t));
      zelle.addEventListener('click', () => {
        if (zelle.disabled) return;
        Object.assign(ctx.prefs, tagWaehlen(ctx.prefs, t));
        geaendert();
      });
      zellen.set(t, zelle);
      kalender.append(zelle);
    }
    gezeichnet = monat;
    monatsname.textContent = monatsName(monat);
  }

  function blaettern(schritt) {
    const i = monate.indexOf(monat) + schritt;
    if (i < 0 || i >= monate.length) return;
    monat = monate[i];
    geblaettert = true;
    aktualisieren();
  }
  zurueck.addEventListener('click', () => blaettern(-1));
  vor.addEventListener('click', () => blaettern(1));

  // --- Was? ---
  const was = abschnitt(doc, 'Was?');
  const kachelFeld = el(doc, 'div', 'kacheln');
  kachelFeld.setAttribute('role', 'group');
  kachelFeld.setAttribute('aria-label', 'Rubriken');
  const kacheln = new Map();
  /** Je Rubrik mit Unterarten: die Gruppe direkt hinter ihrer Kachel (im Raster über die ganze Breite), "Alle" und die Unterarten. */
  const sortenGruppen = new Map();
  for (const r of RUBRIKEN) {
    const k = knopf(doc, `kachel art-${r.farbe}`);
    const zahl = el(doc, 'span', 'kachel-zahl', '0');
    k.append(el(doc, 'span', 'kachel-name', r.name), zahl);
    k.addEventListener('click', () => {
      Object.assign(ctx.prefs, rubrikGetippt(ctx.prefs, r.key));
      geaendert();
    });
    kacheln.set(r.key, { k, zahl, name: r.name });
    kachelFeld.append(k);

    const def = Object.hasOwn(SORTEN, r.key) ? SORTEN[r.key] : null;
    if (!def) continue;
    const gruppe = el(doc, 'div', `gruppe sorten art-${r.farbe}`);
    gruppe.setAttribute('role', 'group');
    gruppe.setAttribute('aria-label', def.titel);
    gruppe.setAttribute('hidden', '');
    gruppe.append(el(doc, 'p', 'gruppentitel', def.titel));
    const chips = el(doc, 'div', 'chips');
    const waehle = (schluessel) => () => {
      ctx.prefs.hiddenGenres = sorteWaehlen(ctx.prefs.hiddenGenres, r.key, schluessel);
      geaendert();
    };
    const alle = knopf(doc, 'chip sorte-alle', 'Alle');
    alle.addEventListener('click', waehle(null));
    chips.append(alle);
    const einzelne = [];
    for (const [schluessel, text] of [...Object.entries(def.liste), [def.sonstige, def.sonstigeText]]) {
      const chip = knopf(doc, 'chip', text);
      chip.addEventListener('click', waehle(schluessel));
      einzelne.push([schluessel, chip]);
      chips.append(chip);
    }
    gruppe.append(chips);
    sortenGruppen.set(r.key, { gruppe, alle, einzelne });
    kachelFeld.append(gruppe);
  }
  was.append(kachelFeld);

  // --- Wo? ---
  const wo = abschnitt(doc, 'Wo?');
  const ortLabel = el(doc, 'label', 'ort');
  ortLabel.append(el(doc, 'span', null, 'Mittelpunkt'));
  const auswahl = el(doc, 'select', 'mittelpunkt');
  ortLabel.append(auswahl);
  auswahl.addEventListener('change', () => {
    ctx.prefs.ort = auswahl.value === STANDARD_ORT ? null : auswahl.value;
    geaendert();
  });
  let orteGezeichnet = null;
  let ortNamen = [];
  function zeichneOrte() {
    ortNamen = (ctx.orteListe ?? []).map((o) => o.name).filter((n) => typeof n === 'string' && n);
    if (!ortNamen.includes(STANDARD_ORT)) ortNamen.unshift(STANDARD_ORT);
    auswahl.replaceChildren(...ortNamen.map((name) => {
      const option = el(doc, 'option', null, name);
      option.setAttribute('value', name);
      return option;
    }));
    orteGezeichnet = ctx.orteListe;
  }

  const umkreis = el(doc, 'div', 'chips umkreis');
  umkreis.setAttribute('role', 'group');
  umkreis.setAttribute('aria-label', 'Umkreis');
  const umkreisChips = new Map();
  for (const km of UMKREISE) {
    const chip = knopf(doc, 'chip', `${km} km`);
    chip.addEventListener('click', () => {
      ctx.prefs.maxKm = km;
      geaendert();
    });
    umkreisChips.set(km, chip);
    umkreis.append(chip);
  }

  const tschechien = el(doc, 'label', 'schalter tschechien');
  const czHaken = el(doc, 'input');
  czHaken.setAttribute('type', 'checkbox');
  tschechien.append(czHaken, el(doc, 'span', null, 'Tschechien'));
  czHaken.addEventListener('change', () => {
    ctx.prefs.showCZ = czHaken.checked;
    geaendert();
  });
  const umkreisTitel = el(doc, 'p', 'gruppentitel', 'Umkreis');
  wo.append(ortLabel, umkreisTitel, umkreis, tschechien);

  // --- Anzeigen ---
  const anzeigen = knopf(doc, 'btn primaer anzeigen');
  anzeigen.setAttribute('aria-live', 'polite');
  anzeigen.addEventListener('click', () => {
    if (!anzeigen.disabled) ctx.beiAnzeigen();
  });
  const fuss = el(doc, 'div', 'filterseite-fuss');
  fuss.append(anzeigen);

  seite.append(wann, was, wo, fuss);
  container.replaceChildren(seite);

  function aktualisieren() {
    const prefs = ctx.prefs;
    const jetzt = ctx.jetzt();
    const tagHeute = berlinDay(jetzt);
    const events = ctx.events ?? [];
    const orte = ctx.orte ?? {};

    // Wann?
    // Ein abgelaufener eigener Zeitraum gilt wie der Standard (siehe zeitfenster); so zeigen es auch die Chips.
    const zeit = zeitAbgelaufen(prefs, tagHeute) ? DEFAULT_PREFS.zeit : prefs.zeit;
    for (const [wert, chip] of zeitChips) chip.setAttribute('aria-pressed', String(zeit === wert));
    if (zeit === 'tage') {
      const text = zeitraumText(prefs, tagHeute);
      kalenderChip.textContent = text;
      kalenderChip.setAttribute('aria-label', `Kalender: ${text}`);
    } else {
      kalenderChip.textContent = 'Kalender';
      kalenderChip.removeAttribute('aria-label');
    }
    kalenderChip.setAttribute('aria-pressed', String(zeit === 'tage'));
    kalenderChip.setAttribute('aria-expanded', String(kalenderOffen));
    if (kalenderOffen) kalenderbox.removeAttribute('hidden');
    else kalenderbox.setAttribute('hidden', '');
    const tage = tageMitTerminen(events, prefs, jetzt, orte);
    monate = monateMitTerminen(tage, tagHeute);
    const bereich = markierterBereich(prefs, tagHeute);
    if (!geblaettert) {
      const start = bereich ? bereich.von.slice(0, 7) : null;
      monat = start && monate.includes(start) ? start : tagHeute.slice(0, 7);
    }
    if (!monate.includes(monat)) monat = tagHeute.slice(0, 7);
    if (gezeichnet !== monat) zeichneMonat();
    const i = monate.indexOf(monat);
    zurueck.disabled = i <= 0;
    vor.disabled = i >= monate.length - 1;
    // Ein Pfeil mit Fokus, der gerade gesperrt wird, gibt den Fokus an den anderen ab (sonst fiele er auf die Seite zurück).
    const aktiv = doc.activeElement;
    if (aktiv === vor && vor.disabled && !zurueck.disabled) zurueck.focus();
    else if (aktiv === zurueck && zurueck.disabled && !vor.disabled) vor.focus();
    for (const [t, zelle] of zellen) {
      const drin = Boolean(bereich) && t >= bereich.von && t <= bereich.bis;
      zelle.disabled = t < tagHeute;
      zelle.classList.toggle('heute', t === tagHeute);
      zelle.classList.toggle('punkt', tage.has(t));
      zelle.classList.toggle('ohne', t >= tagHeute && !tage.has(t)); // blass, aber wählbar
      zelle.classList.toggle('gewaehlt', drin);
      zelle.classList.toggle('a', drin && t === bereich.von);
      zelle.classList.toggle('e', drin && t === bereich.bis);
      if (t === tagHeute) zelle.setAttribute('aria-current', 'date');
      else zelle.removeAttribute('aria-current');
    }

    // Was?
    const zahlen = zaehleRubriken(events, prefs, jetzt, orte);
    const gewaehlt = prefs.rubriken ?? [];
    for (const [key, { k, zahl, name }] of kacheln) {
      zahl.textContent = String(zahlen[key]);
      k.setAttribute('aria-label', `${name}, ${zahlen[key] === 1 ? '1 Termin' : `${zahlen[key]} Termine`}`);
      k.classList.toggle('leer', zahlen[key] === 0);
      k.setAttribute('aria-pressed', String(gewaehlt.includes(key)));
    }
    const sortenZahlen = zaehleSorten(events, prefs, jetzt, orte);
    for (const [rubrik, { gruppe, alle, einzelne }] of sortenGruppen) {
      const wahl = gewaehlteSorten(prefs.hiddenGenres, rubrik); // null = Alle
      alle.setAttribute('aria-pressed', String(wahl === null));
      let mitTerminen = 0;
      for (const [schluessel, chip] of einzelne) {
        const gewaehlterChip = wahl !== null && wahl.includes(schluessel);
        const hat = sortenZahlen[schluessel] > 0;
        if (hat) mitTerminen += 1;
        chip.setAttribute('aria-pressed', String(gewaehlterChip));
        // Ein leerer Unterpunkt verschwindet, außer er ist gerade gewählt (sonst ließe er sich nicht mehr abwählen).
        if (hat || gewaehlterChip) chip.removeAttribute('hidden');
        else chip.setAttribute('hidden', '');
      }
      if (gewaehlt.includes(rubrik) && (mitTerminen >= 2 || wahl !== null)) gruppe.removeAttribute('hidden');
      else gruppe.setAttribute('hidden', '');
    }

    // Wo?
    if (orteGezeichnet !== ctx.orteListe) zeichneOrte();
    const ort = prefs.ort && ortNamen.includes(prefs.ort) ? prefs.ort : STANDARD_ORT;
    const gewaehlteOption = [...auswahl.querySelectorAll('option')].find((o) => o.getAttribute('value') === ort);
    if (gewaehlteOption) gewaehlteOption.selected = true; // wählt die übrigen ab
    for (const [km, chip] of umkreisChips) chip.setAttribute('aria-pressed', String(prefs.maxKm === km));
    czHaken.checked = prefs.showCZ !== false;

    // Knopf
    if (ctx.laedt) {
      anzeigen.textContent = 'Termine werden geladen …';
      anzeigen.disabled = true;
    } else if (ctx.fehler) {
      anzeigen.textContent = 'Termine konnten nicht geladen werden';
      anzeigen.disabled = false; // führt zur Liste mit der Fehlermeldung
    } else {
      anzeigen.textContent = anzeigeText(applyFilters(events, prefs, jetzt, orte).length);
      anzeigen.disabled = false;
    }
  }

  aktualisieren();
  return { aktualisieren };
}
