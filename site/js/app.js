// Seitenlogik: Daten laden, Filterleiste aufbauen, Liste zeichnen, Einstellungen am Gerät merken.
import { applyFilters, groupByDay, berlinDay, loadPrefs, savePrefs, DEFAULT_PREFS } from './filter.js';
import { renderEventCard, renderStatusFooter, dayLabel, artName, GENRES, SONSTIGE_KONZERTE } from './render.js';

const ARTEN = ['konzert', 'party', 'markt', 'fest', 'schau', 'sonstiges'];
const ZEIT_CHIPS = [
  ['alle', 'Alle'], ['heute', 'Heute'], ['wochenende', 'Wochenende'], ['7', '7 Tage'], ['30', '30 Tage'], ['bereich', 'Zeitraum …'],
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

/** Wie viele Filter im Bereich "Mehr Filter" vom Standard abweichen (der Zeitraum ist immer sichtbar). */
function aktiveFilter(prefs) {
  return (prefs.hiddenArt.length ? 1 : 0)
    + (prefs.hiddenGenres.length ? 1 : 0)
    + (prefs.ort || prefs.maxKm < DEFAULT_PREFS.maxKm ? 1 : 0)
    + (prefs.showCZ ? 0 : 1);
}

function datumsfeld(beschriftung, wert, beiAenderung) {
  const label = neu('label', 'datum');
  label.append(neu('span', null, beschriftung));
  const feld = neu('input');
  feld.setAttribute('type', 'date');
  if (wert) feld.value = wert;
  feld.addEventListener('change', () => beiAenderung(feld.value || null));
  label.append(feld);
  return label;
}

function baueFilterleiste(leiste, prefs, orteListe, beiAenderung) {
  leiste.replaceChildren();

  // --- Zeitraum: immer sichtbar ---
  const zeitReihe = neu('div', 'zeit');
  zeitReihe.setAttribute('role', 'group');
  zeitReihe.setAttribute('aria-label', 'Zeitraum');
  const zeitChips = new Map();
  const bereich = neu('div', 'bereich');
  const zeigeBereich = () => { bereich.hidden = prefs.zeit !== 'bereich'; };
  for (const [wert, text] of ZEIT_CHIPS) {
    const chip = neu('button', 'chip', text);
    chip.setAttribute('type', 'button');
    chip.setAttribute('aria-pressed', String(prefs.zeit === wert));
    chip.addEventListener('click', () => {
      prefs.zeit = wert;
      for (const [w, c] of zeitChips) c.setAttribute('aria-pressed', String(w === wert));
      zeigeBereich();
      beiAenderung();
    });
    zeitChips.set(wert, chip);
    zeitReihe.append(chip);
  }
  bereich.append(
    datumsfeld('von', prefs.von, (v) => { prefs.von = v; beiAenderung(); }),
    datumsfeld('bis', prefs.bis, (v) => { prefs.bis = v; beiAenderung(); }),
  );
  zeigeBereich();
  leiste.append(zeitReihe, bereich);

  // --- Mehr Filter: Ort + Umkreis, Art, Tschechien ---
  const mehr = neu('details', 'mehr');
  const titel = neu('summary');
  const zaehler = neu('span', 'zaehler');
  const aktualisiereZaehler = () => {
    const n = aktiveFilter(prefs);
    zaehler.textContent = n ? String(n) : '';
    zaehler.hidden = !n;
  };
  titel.append(neu('span', null, 'Mehr Filter'), zaehler);
  mehr.append(titel);
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
  // Ein gespeicherter Ort, den es nicht mehr gibt, zeigt Sebnitz (so rechnet auch der Filter).
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

  const artGruppe = neu('div', 'gruppe');
  artGruppe.append(neu('p', 'gruppentitel', 'Arten anzeigen'));
  const chips = neu('div', 'chips');
  for (const art of ARTEN) {
    const chip = neu('button', 'chip', artName(art));
    chip.setAttribute('type', 'button');
    chip.setAttribute('aria-pressed', String(!prefs.hiddenArt.includes(art)));
    chip.addEventListener('click', () => {
      const aus = prefs.hiddenArt.includes(art);
      prefs.hiddenArt = aus ? prefs.hiddenArt.filter((a) => a !== art) : [...prefs.hiddenArt, art];
      chip.setAttribute('aria-pressed', String(aus));
      aktualisiereZaehler();
      beiAenderung();
    });
    chips.append(chip);
  }
  artGruppe.append(chips);

  const genreGruppe = neu('div', 'gruppe');
  genreGruppe.append(neu('p', 'gruppentitel', 'Genres anzeigen (Konzerte, Comedy …)'));
  const genreChips = neu('div', 'chips');
  for (const [genre, text] of [...Object.entries(GENRES), ['sonstige', SONSTIGE_KONZERTE]]) {
    const chip = neu('button', 'chip', text);
    chip.setAttribute('type', 'button');
    chip.setAttribute('aria-pressed', String(!prefs.hiddenGenres.includes(genre)));
    chip.addEventListener('click', () => {
      const aus = prefs.hiddenGenres.includes(genre);
      prefs.hiddenGenres = aus ? prefs.hiddenGenres.filter((g) => g !== genre) : [...prefs.hiddenGenres, genre];
      chip.setAttribute('aria-pressed', String(aus));
      aktualisiereZaehler();
      beiAenderung();
    });
    genreChips.append(chip);
  }
  genreGruppe.append(genreChips);

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

  feld.append(ortGruppe, artGruppe, genreGruppe, schalter);
  mehr.append(feld);
  aktualisiereZaehler();
  leiste.append(mehr);
}

function zeichneListe(container, events, prefs, orte) {
  const jetzt = new Date().toISOString();
  const heute = berlinDay(jetzt);
  const sichtbar = applyFilters(events, prefs, jetzt, orte);
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
  let orteListe = [];
  let orte = {};
  const beiAenderung = () => {
    savePrefs(speicher(), prefs);
    zeichneListe(liste, events, prefs, orte);
  };
  // Ohne Ortsverzeichnis (Datei fehlt) bleibt der Umkreis um Sebnitz, die Seite funktioniert weiter.
  try {
    const roh = await ladeJson('data/places.json');
    if (Array.isArray(roh)) {
      orteListe = roh.filter((o) => o && typeof o.name === 'string' && Number.isFinite(o.lat) && Number.isFinite(o.lon));
      orte = Object.fromEntries(orteListe.map((o) => [o.name, { lat: o.lat, lon: o.lon }]));
    }
  } catch { /* siehe oben */ }
  baueFilterleiste(leiste, prefs, orteListe, beiAenderung);
  try {
    const daten = await ladeJson('data/events.json');
    events = Array.isArray(daten.events) ? daten.events : [];
    stand.textContent = standText(daten.generatedAt);
    zeichneListe(liste, events, prefs, orte);
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
