// Seitenlogik: Daten laden, Filterleiste aufbauen, Liste zeichnen, Einstellungen am Gerät merken.
import { applyFilters, groupByDay, berlinDay, loadPrefs, savePrefs } from './filter.js';
import { renderEventCard, renderStatusFooter, dayLabel, artName } from './render.js';

const ARTEN = ['konzert', 'party', 'markt', 'fest', 'schau', 'sonstiges'];

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

function baueFilterleiste(leiste, prefs, beiAenderung) {
  leiste.replaceChildren();
  for (const art of ARTEN) {
    const chip = neu('button', 'chip', artName(art));
    chip.setAttribute('type', 'button');
    chip.setAttribute('aria-pressed', String(!prefs.hiddenArt.includes(art)));
    chip.addEventListener('click', () => {
      const aus = prefs.hiddenArt.includes(art);
      prefs.hiddenArt = aus ? prefs.hiddenArt.filter((a) => a !== art) : [...prefs.hiddenArt, art];
      chip.setAttribute('aria-pressed', String(aus));
      beiAenderung();
    });
    leiste.append(chip);
  }
  const regler = neu('label', 'regler');
  const text = neu('span', null, `Umkreis: ${prefs.maxKm} km`);
  const schieber = neu('input');
  schieber.setAttribute('type', 'range');
  schieber.setAttribute('min', '5');
  schieber.setAttribute('max', '75');
  schieber.setAttribute('step', '5');
  schieber.setAttribute('value', String(prefs.maxKm));
  schieber.addEventListener('input', () => {
    prefs.maxKm = Number(schieber.value);
    text.textContent = `Umkreis: ${prefs.maxKm} km`;
    beiAenderung();
  });
  regler.append(text, schieber);
  leiste.append(regler);
  const schalter = neu('label', 'schalter');
  const haken = neu('input');
  haken.setAttribute('type', 'checkbox');
  if (prefs.showCZ) haken.setAttribute('checked', '');
  haken.checked = prefs.showCZ;
  haken.addEventListener('change', () => {
    prefs.showCZ = haken.checked;
    beiAenderung();
  });
  schalter.append(haken, neu('span', null, 'Tschechien'));
  leiste.append(schalter);
}

function zeichneListe(container, events, prefs) {
  const jetzt = new Date().toISOString();
  const heute = berlinDay(jetzt);
  const sichtbar = applyFilters(events, prefs, jetzt);
  container.replaceChildren();
  if (!sichtbar.length) {
    container.append(neu('p', 'leer', 'Keine Termine mit diesen Filtern.'));
    return;
  }
  for (const gruppe of groupByDay(sichtbar, heute)) {
    const abschnitt = neu('section', 'tag');
    abschnitt.append(neu('h2', null, dayLabel(gruppe.day, heute)));
    for (const ev of gruppe.events) abschnitt.append(renderEventCard(document, ev));
    container.append(abschnitt);
  }
}

async function start() {
  const liste = document.getElementById('liste');
  const leiste = document.getElementById('filters');
  const fuss = document.getElementById('fuss');
  const stand = document.getElementById('stand');
  const prefs = loadPrefs(speicher());
  let events = [];
  const beiAenderung = () => {
    savePrefs(speicher(), prefs);
    zeichneListe(liste, events, prefs);
  };
  baueFilterleiste(leiste, prefs, beiAenderung);
  try {
    const daten = await ladeJson('data/events.json');
    events = Array.isArray(daten.events) ? daten.events : [];
    stand.textContent = standText(daten.generatedAt);
    zeichneListe(liste, events, prefs);
  } catch {
    liste.replaceChildren(neu('p', 'leer', 'Die Termine konnten nicht geladen werden. Bitte später erneut versuchen.'));
  }
  try {
    const status = await ladeJson('data/status.json');
    fuss.replaceChildren(renderStatusFooter(document, status.sources));
  } catch { /* Fußzeile ist nur ein Hinweis */ }
}

start();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => { /* ohne Service Worker kein Offline-Betrieb */ });
}
