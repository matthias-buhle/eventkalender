// Seitenlogik: Daten laden, Filterleiste aufbauen, Liste zeichnen, Einstellungen am Gerät merken.
import { applyFilters, groupByDay, berlinDay, loadPrefs, savePrefs, einzelneArt, artWaehlen, wirksameSorten, anzeigeText, DEFAULT_PREFS } from './filter.js';
import { renderEventCard, renderDetail, renderStatusFooter, dayLabel, artName } from './render.js';
import { ARTEN, SORTEN } from './arten.js';
import { renderUeber } from './ueber.js';

const ZEIT_CHIPS = [
  ['alle', 'Alle'], ['heute', 'Heute'], ['wochenende', 'Wochenende'], ['7', '7 Tage'], ['30', '30 Tage'], ['60', '60 Tage'],
];
const STANDARD_ORT = 'Sebnitz';

function speicher() {
  try {
    return window.localStorage;
  } catch {
    return null; // privater Modus oder gesperrt: Einstellungen gelten nur bis zum Neuladen
  }
}

async function ladeJson(url) {
  const antwort = await fetch(url, { cache: 'no-cache' });
  if (!antwort.ok) throw new Error(`HTTP ${antwort.status}`);
  return antwort.json();
}

function neu(tag, klasse, text) {
  const e = document.createElement(tag);
  if (klasse) e.setAttribute('class', klasse);
  if (text != null) e.textContent = text;
  return e;
}

function standText(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `Stand: ${d.toLocaleString('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })} Uhr`;
}

/**
 * Ein Fenster, das von unten hereinfährt (dialog). Schließen mit X, Tipp daneben, Escape und der Zurück-Taste des Geräts.
 * Beim Öffnen kommt ein Eintrag in den Verlauf, damit "Zurück" das Fenster schließt und nicht die Seite verlässt.
 */
function neuesFenster(klasse, titelText) {
  const dialog = neu('dialog', `sheet ${klasse}`);
  dialog.setAttribute('aria-label', titelText);
  const kopf = neu('div', 'sheet-kopf');
  const zu = neu('button', 'schliessen', '×');
  zu.setAttribute('type', 'button');
  zu.setAttribute('aria-label', 'Schließen');
  zu.addEventListener('click', () => dialog.close());
  kopf.append(neu('h2', null, titelText), zu);
  const koerper = neu('div', 'sheet-koerper');
  dialog.append(kopf, koerper);
  document.body.append(dialog);

  let ueberZurueck = false;
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => {
    if (!ueberZurueck && history.state?.fenster) history.back();
    ueberZurueck = false;
  });
  window.addEventListener('popstate', () => {
    if (!dialog.open) return;
    ueberZurueck = true;
    dialog.close();
  });
  const oeffnen = () => {
    if (dialog.open) return;
    dialog.showModal();
    try { history.pushState({ fenster: true }, ''); } catch { /* ohne Verlauf schließt nur X oder Tipp daneben */ }
  };
  return { dialog, koerper, oeffnen, schliessen: () => dialog.close() };
}

/** Wie viele Filter im Filterfenster vom Standard abweichen (der Zeitraum ist immer sichtbar). */
function aktiveFilter(prefs) {
  return (prefs.hiddenArt.length ? 1 : 0)
    + (wirksameSorten(prefs).length ? 1 : 0)
    + (prefs.ort || prefs.maxKm < DEFAULT_PREFS.maxKm ? 1 : 0)
    + (prefs.showCZ ? 0 : 1);
}

function baueFilterleiste(leiste, prefs, orteListe, beiAenderung) {
  leiste.replaceChildren();

  // --- Suche und Zeitraum: immer sichtbar ---
  const suchfeld = neu('input', 'suche');
  suchfeld.setAttribute('type', 'search');
  suchfeld.setAttribute('placeholder', 'Suchen: Künstler, Veranstaltung, Ort …');
  suchfeld.setAttribute('aria-label', 'Suchen');
  suchfeld.setAttribute('autocomplete', 'off');
  suchfeld.setAttribute('enterkeyhint', 'search');
  suchfeld.value = prefs.suche;
  let suchTimer = null;
  // Löschkreuz: nur sichtbar, wenn Text im Feld steht; leert das Feld und zeichnet sofort neu
  const suchBox = neu('div', 'suchbox');
  const loeschen = neu('button', 'suche-loeschen', '×');
  loeschen.setAttribute('type', 'button');
  loeschen.setAttribute('aria-label', 'Suche löschen');
  const zeigeLoeschen = () => { loeschen.hidden = suchfeld.value === ''; };
  zeigeLoeschen();
  suchBox.append(suchfeld, loeschen);
  suchfeld.addEventListener('input', () => {
    prefs.suche = suchfeld.value;
    zeigeLoeschen();
    clearTimeout(suchTimer);
    suchTimer = setTimeout(beiAenderung, 150); // nicht bei jedem Buchstaben die ganze Liste neu zeichnen
  });
  loeschen.addEventListener('click', () => {
    suchfeld.value = '';
    prefs.suche = '';
    zeigeLoeschen();
    clearTimeout(suchTimer);
    suchfeld.focus();
    beiAenderung();
  });
  const zeitReihe = neu('div', 'zeit');
  zeitReihe.setAttribute('role', 'group');
  zeitReihe.setAttribute('aria-label', 'Zeitraum');
  const zeitChips = new Map();
  for (const [wert, text] of ZEIT_CHIPS) {
    const chip = neu('button', 'chip', text);
    chip.setAttribute('type', 'button');
    chip.setAttribute('aria-pressed', String(prefs.zeit === wert));
    chip.addEventListener('click', () => {
      prefs.zeit = wert;
      for (const [w, c] of zeitChips) c.setAttribute('aria-pressed', String(w === wert));
      beiAenderung();
    });
    zeitChips.set(wert, chip);
    zeitReihe.append(chip);
  }
  // --- Filter: Ort + Umkreis, Art, Tschechien in einem Fenster von unten ---
  const fenster = neuesFenster('filterfenster', 'Filter');
  const filterKnopf = neu('button', 'filterknopf');
  filterKnopf.setAttribute('type', 'button');
  filterKnopf.setAttribute('aria-haspopup', 'dialog');
  const zaehler = neu('span', 'zaehler');
  const aktualisiereZaehler = () => {
    const n = aktiveFilter(prefs);
    zaehler.textContent = n ? String(n) : '';
    zaehler.hidden = !n;
    filterKnopf.setAttribute('aria-label', n ? `Filter, ${n} aktiv` : 'Filter');
  };
  filterKnopf.append(neu('span', null, 'Filter'), zaehler);
  filterKnopf.addEventListener('click', fenster.oeffnen);
  const zeitZeile = neu('div', 'zeitzeile');
  zeitZeile.append(zeitReihe, filterKnopf);
  leiste.append(suchBox, zeitZeile);
  const feld = neu('div', 'feld');

  const ortGruppe = neu('div', 'gruppe');
  const ortLabel = neu('label', 'ort');
  ortLabel.append(neu('span', null, 'Ort'));
  const auswahl = neu('select');
  const namen = orteListe.map((o) => o.name);
  if (!namen.includes(STANDARD_ORT)) namen.unshift(STANDARD_ORT);
  for (const name of namen) {
    const option = neu('option', null, name);
    option.setAttribute('value', name);
    auswahl.append(option);
  }
  // Ein gespeicherter Ort, der nicht (mehr) zur Auswahl gehört, gilt als Sebnitz; nur wenn die Liste geladen wurde.
  if (prefs.ort && orteListe.length && !namen.includes(prefs.ort)) prefs.ort = null;
  auswahl.value = prefs.ort && namen.includes(prefs.ort) ? prefs.ort : STANDARD_ORT;
  ortLabel.append(auswahl);

  const regler = neu('label', 'regler');
  const text = neu('span');
  const schieber = neu('input');
  const zeigeKm = () => { text.textContent = `Umkreis: ${prefs.maxKm} km`; };
  schieber.setAttribute('type', 'range');
  schieber.setAttribute('min', '5');
  schieber.setAttribute('max', '75');
  schieber.setAttribute('step', '5');
  schieber.value = String(prefs.maxKm);
  zeigeKm();
  regler.append(text, schieber);
  auswahl.addEventListener('change', () => {
    prefs.ort = auswahl.value === STANDARD_ORT ? null : auswahl.value;
    aktualisiereZaehler();
    beiAenderung();
  });
  schieber.addEventListener('input', () => {
    prefs.maxKm = Number(schieber.value);
    zeigeKm();
    aktualisiereZaehler();
    beiAenderung();
  });
  ortGruppe.append(ortLabel, regler);

  // Arten: "Alle" oder einzelne Arten wählen. Unterfilter (Genres, Sorten) gibt es nur, wenn genau eine Art gewählt ist.
  const artGruppe = neu('div', 'gruppe');
  artGruppe.append(neu('p', 'gruppentitel', 'Arten anzeigen'));
  const chips = neu('div', 'chips');
  const artChips = new Map();
  const sortenGruppen = new Map();
  const zeigeArten = () => {
    const alle = prefs.hiddenArt.length === 0;
    for (const [art, chip] of artChips) {
      chip.setAttribute('aria-pressed', String(art === 'alle' ? alle : !alle && !prefs.hiddenArt.includes(art)));
    }
    const einzel = einzelneArt(prefs.hiddenArt);
    for (const [art, gruppe] of sortenGruppen) gruppe.hidden = art !== einzel;
    aktualisiereZaehler();
  };
  const alleChip = neu('button', 'chip wahl', 'Alle');
  alleChip.setAttribute('type', 'button');
  alleChip.addEventListener('click', () => {
    prefs.hiddenArt = [];
    zeigeArten();
    beiAenderung();
  });
  artChips.set('alle', alleChip);
  chips.append(alleChip);
  for (const art of ARTEN) {
    const chip = neu('button', 'chip wahl', artName(art));
    chip.setAttribute('type', 'button');
    chip.addEventListener('click', () => {
      prefs.hiddenArt = artWaehlen(prefs.hiddenArt, art);
      zeigeArten();
      beiAenderung();
    });
    artChips.set(art, chip);
    chips.append(chip);
  }
  artGruppe.append(chips);

  const sortenFelder = [];
  for (const [art, def] of Object.entries(SORTEN)) {
    const gruppe = neu('div', 'gruppe');
    gruppe.append(neu('p', 'gruppentitel', def.titel));
    const sortenChips = neu('div', 'chips');
    for (const [schluessel, text] of [...Object.entries(def.liste), [def.sonstige, def.sonstigeText]]) {
      const chip = neu('button', 'chip', text);
      chip.setAttribute('type', 'button');
      chip.setAttribute('aria-pressed', String(!prefs.hiddenGenres.includes(schluessel)));
      chip.addEventListener('click', () => {
        const aus = prefs.hiddenGenres.includes(schluessel);
        prefs.hiddenGenres = aus ? prefs.hiddenGenres.filter((g) => g !== schluessel) : [...prefs.hiddenGenres, schluessel];
        chip.setAttribute('aria-pressed', String(aus));
        aktualisiereZaehler();
        beiAenderung();
      });
      sortenChips.append(chip);
    }
    gruppe.append(sortenChips);
    sortenGruppen.set(art, gruppe);
    sortenFelder.push(gruppe);
  }

  const schalter = neu('label', 'schalter');
  const haken = neu('input');
  haken.setAttribute('type', 'checkbox');
  haken.checked = prefs.showCZ;
  haken.addEventListener('change', () => {
    prefs.showCZ = haken.checked;
    aktualisiereZaehler();
    beiAenderung();
  });
  schalter.append(haken, neu('span', null, 'Tschechien'));

  feld.append(ortGruppe, artGruppe, ...sortenFelder, schalter);
  const ergebnis = neu('button', 'btn primaer ergebnis');
  ergebnis.setAttribute('type', 'button');
  ergebnis.addEventListener('click', fenster.schliessen);
  const fuss = neu('div', 'sheet-fuss');
  fuss.append(ergebnis);
  fenster.koerper.append(feld);
  fenster.dialog.append(fuss);
  zeigeArten();
  return { zeigeAnzahl: (n) => { ergebnis.textContent = anzeigeText(n); } };
}

/** Zeichnet die Liste und gibt zurück, wie viele Termine sie zeigt. */
function zeichneListe(container, events, prefs, orte, beiOeffnen) {
  const jetzt = new Date().toISOString();
  const heute = berlinDay(jetzt);
  const sichtbar = applyFilters(events, prefs, jetzt, orte);
  const optionen = { orte: Object.keys(orte) };
  container.replaceChildren();
  if (!sichtbar.length) {
    container.append(neu('p', 'leer', 'Keine Termine mit diesen Filtern.'));
    return 0;
  }
  for (const gruppe of groupByDay(sichtbar, heute)) {
    const abschnitt = neu('section', 'tag');
    abschnitt.append(neu('h2', null, dayLabel(gruppe.day, heute)));
    for (const ev of gruppe.events) {
      const karte = renderEventCard(document, ev, optionen);
      // Ein Tipp auf die Karte (nicht auf einen Knopf oder Link) öffnet die Einzelansicht.
      karte.setAttribute('tabindex', '0');
      karte.addEventListener('click', (e) => {
        if (e.target.closest('a') || String(window.getSelection?.() ?? '')) return;
        beiOeffnen(ev);
      });
      karte.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.target === karte) beiOeffnen(ev);
      });
      abschnitt.append(karte);
    }
    container.append(abschnitt);
  }
  return sichtbar.length;
}

async function start() {
  const liste = document.getElementById('liste');
  const leiste = document.getElementById('filters');
  const fuss = document.getElementById('fuss');
  const stand = document.getElementById('stand');
  const prefs = loadPrefs(speicher());
  let events = [];
  let orteListe = [];
  let orte = {};
  let filterleiste = null;
  const detail = neuesFenster('detailfenster', 'Einzelheiten');
  const ueber = neuesFenster('ueberfenster', 'Über Bühnenlicht');
  ueber.koerper.append(renderUeber(document));
  document.getElementById('menue')?.addEventListener('click', ueber.oeffnen);
  const zeigeDetail = (ev) => {
    detail.koerper.replaceChildren(renderDetail(document, ev, { orte: Object.keys(orte), userAgent: navigator.userAgent }));
    detail.koerper.scrollTop = 0;
    detail.oeffnen();
  };
  const zeichne = () => filterleiste?.zeigeAnzahl(zeichneListe(liste, events, prefs, orte, zeigeDetail));
  const beiAenderung = () => {
    savePrefs(speicher(), prefs);
    zeichne();
    // Eine neue Auswahl ist eine neue Liste: wieder von oben beginnen, nicht bei der zuletzt gesehenen Karte.
    window.scrollTo(0, 0);
  };
  // Ohne Ortsverzeichnis (Datei fehlt) bleibt der Umkreis um Sebnitz, die Seite funktioniert weiter.
  try {
    const roh = await ladeJson('data/places.json');
    if (Array.isArray(roh)) {
      orteListe = roh.filter((o) => o && typeof o.name === 'string' && Number.isFinite(o.lat) && Number.isFinite(o.lon));
      orte = Object.fromEntries(orteListe.map((o) => [o.name, { lat: o.lat, lon: o.lon }]));
    }
  } catch { /* siehe oben */ }
  filterleiste = baueFilterleiste(leiste, prefs, orteListe, beiAenderung);
  try {
    const daten = await ladeJson('data/events.json');
    events = Array.isArray(daten.events) ? daten.events : [];
    stand.textContent = standText(daten.generatedAt);
    zeichne();
  } catch {
    liste.replaceChildren(neu('p', 'leer', 'Die Termine konnten nicht geladen werden. Bitte später erneut versuchen.'));
  }
  try {
    const info = await ladeJson('data/version.json');
    if (info?.version) {
      const marke = document.getElementById('version');
      if (marke) {
        marke.textContent = `v${info.version}`;
        marke.hidden = false;
      }
      ueber.koerper.replaceChildren(renderUeber(document, { version: info }));
    }
  } catch { /* ohne Versionsangabe bleibt die Anzeige einfach leer */ }
  try {
    const status = await ladeJson('data/status.json');
    fuss.replaceChildren(renderStatusFooter(document, status.sources));
  } catch { /* Fußzeile ist nur ein Hinweis */ }
}

start();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => { /* ohne Service Worker kein Offline-Betrieb */ });
}
