// Seitenlogik: Daten laden, Filterseite und Liste verdrahten, Einstellungen am Gerät merken.
// Zwei Ansichten: die Filterseite (beim Start) und die Liste. "N Termine anzeigen" legt einen Verlaufseintrag
// {ansicht:'liste'} an; Zurück führt von der Liste zur Filterseite. Fenster (Detail, Über) legen eigene Einträge an,
// ihr Zurück schließt nur das Fenster (Regeln in ansicht.js).
import { applyFilters, groupByDay, berlinDay, loadPrefs, savePrefs, zusammenfassung } from './filter.js';
import { renderEventCard, renderDetail, renderStatusFooter, dayLabel } from './render.js';
import { renderUeber } from './ueber.js';
import { baueFilterseite } from './filterseite.js';
import { ansichtNachPopstate, filterAendernPerZurueck, fensterZustand, zusammenfassungMitSuche } from './ansicht.js';

const LADEFEHLER = 'Die Termine konnten nicht geladen werden. Bitte später erneut versuchen.';

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
 * Beim Öffnen kommt ein Eintrag in den Verlauf, damit "Zurück" das Fenster schließt und nicht die Seite verlässt;
 * der Eintrag trägt die Ansicht darunter mit (fensterZustand), damit Zurück und Vorwärts die Ansicht nicht wechseln.
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
    try { history.pushState(fensterZustand(history.state), ''); } catch { /* ohne Verlauf schließt nur X oder Tipp daneben */ }
  };
  return { dialog, koerper, oeffnen, schliessen: () => dialog.close() };
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

/** Suchfeld über der Liste: zeichnet verzögert neu; das Löschkreuz ist nur bei Text sichtbar. */
function verdrahteSuche(feld, loeschen, beiAenderung) {
  let timer = null;
  const zeigeLoeschen = () => { loeschen.hidden = feld.value === ''; };
  zeigeLoeschen();
  feld.addEventListener('input', () => {
    zeigeLoeschen();
    clearTimeout(timer);
    timer = setTimeout(() => beiAenderung(feld.value), 150); // nicht bei jedem Buchstaben die ganze Liste neu zeichnen
  });
  loeschen.addEventListener('click', () => {
    feld.value = '';
    zeigeLoeschen();
    clearTimeout(timer);
    feld.focus();
    beiAenderung('');
  });
}

async function start() {
  const filterBereich = document.getElementById('filterseite');
  const listenansicht = document.getElementById('listenansicht');
  const liste = document.getElementById('liste');
  const zeile = document.getElementById('zusammenfassung');
  const fuss = document.getElementById('fuss');
  const stand = document.getElementById('stand');
  const prefs = loadPrefs(speicher());
  // Die Suche gilt nur für die Liste und nur bis zum Neuladen; die Zahlen der Filterseite zählen ohne sie.
  let suche = '';
  let ladefehler = false;
  /** @type {'filter'|'liste'} */
  let ansicht = 'filter';
  let filterY = 0;

  // Jeder frische Start beginnt mit der Filterseite; ein beim Neuladen erhaltener Zustand (z. B. ansicht:'liste') gilt nicht mehr.
  try {
    if (history.state != null) history.replaceState(null, '');
    history.scrollRestoration = 'manual';
  } catch { /* ohne Verlauf wechselt nur "Filter ändern" die Ansicht */ }

  const ctx = {
    prefs, events: [], orteListe: [], orte: {}, laedt: true,
    jetzt: () => new Date().toISOString(),
    // filterseite.js zeichnet nach beiAenderung selbst neu (aktualisieren); hier nur speichern.
    beiAenderung: () => savePrefs(speicher(), prefs),
    beiAnzeigen: () => {
      try { history.pushState({ ansicht: 'liste' }, ''); } catch { /* ohne Verlauf: "Filter ändern" schaltet direkt um */ }
      zeigeAnsicht('liste');
    },
  };

  const zeichne = () => {
    zeile.textContent = zusammenfassungMitSuche(zusammenfassung(prefs, berlinDay(new Date().toISOString())), suche);
    if (ladefehler) liste.replaceChildren(neu('p', 'leer', LADEFEHLER));
    else zeichneListe(liste, ctx.events, { ...prefs, suche }, ctx.orte, zeigeDetail);
  };

  function zeigeAnsicht(neueAnsicht) {
    if (neueAnsicht === ansicht) return;
    ansicht = neueAnsicht;
    if (neueAnsicht === 'liste') {
      filterY = window.scrollY;
      filterBereich.hidden = true;
      listenansicht.hidden = false;
      zeichne();
      window.scrollTo(0, 0);
      zeile.focus({ preventScroll: true }); // der Anzeigen-Knopf ist verschwunden; der Fokus bleibt nicht auf der Seite hängen
    } else {
      listenansicht.hidden = true;
      filterBereich.hidden = false;
      filterseite.aktualisieren(); // die Zeit kann vergangen sein (heute, Zahlen)
      window.scrollTo(0, filterY);
      filterBereich.querySelector('.anzeigen')?.focus({ preventScroll: true });
    }
  }

  // Vor den Fenstern anmelden: so sieht dieser Empfänger noch, ob beim Zurück ein Fenster offen war (die Fenster schließen sich selbst).
  const fenster = [];
  window.addEventListener('popstate', (e) => {
    const offen = fenster.some((f) => f.dialog.open);
    zeigeAnsicht(ansichtNachPopstate(e.state, offen, ansicht));
  });
  const detail = neuesFenster('detailfenster', 'Einzelheiten');
  const ueber = neuesFenster('ueberfenster', 'Über Bühnenlicht');
  fenster.push(detail, ueber);
  ueber.koerper.append(renderUeber(document));
  document.getElementById('menue')?.addEventListener('click', ueber.oeffnen);
  function zeigeDetail(ev) {
    detail.koerper.replaceChildren(renderDetail(document, ev, { orte: Object.keys(ctx.orte), userAgent: navigator.userAgent }));
    detail.koerper.scrollTop = 0;
    detail.oeffnen();
  }

  document.getElementById('filter-aendern').addEventListener('click', () => {
    if (filterAendernPerZurueck(history.state)) history.back();
    else zeigeAnsicht('filter');
  });
  verdrahteSuche(document.getElementById('suche'), document.getElementById('suche-loeschen'), (text) => {
    suche = text;
    zeichne();
    window.scrollTo(0, 0);
  });

  const filterseite = baueFilterseite(document, filterBereich, ctx);

  // Ohne Ortsverzeichnis (Datei fehlt) bleibt der Umkreis um Sebnitz, die Seite funktioniert weiter.
  try {
    const roh = await ladeJson('data/places.json');
    if (Array.isArray(roh)) {
      ctx.orteListe = roh.filter((o) => o && typeof o.name === 'string' && Number.isFinite(o.lat) && Number.isFinite(o.lon));
      ctx.orte = Object.fromEntries(ctx.orteListe.map((o) => [o.name, { lat: o.lat, lon: o.lon }]));
      // Ein gespeicherter Ort, der nicht (mehr) zur Auswahl gehört, gilt als Sebnitz.
      if (prefs.ort && ctx.orteListe.length && !Object.hasOwn(ctx.orte, prefs.ort)) prefs.ort = null;
    }
  } catch { /* siehe oben */ }
  try {
    const daten = await ladeJson('data/events.json');
    ctx.events = Array.isArray(daten.events) ? daten.events : [];
    stand.textContent = standText(daten.generatedAt);
  } catch {
    // Die Filterseite bleibt benutzbar; der Knopf führt zur Liste mit der Fehlermeldung.
    ladefehler = true;
    ctx.fehler = true;
  }
  ctx.laedt = false;
  filterseite.aktualisieren();
  if (ansicht === 'liste') zeichne();
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
