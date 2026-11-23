// Welche Ansicht (Filterseite oder Liste) zu einem Verlaufseintrag gehört. Reine Funktionen, kein Zugriff auf window.
//
// Verlauf: "N Termine anzeigen" legt {ansicht:'liste'} an. Ein Fenster (Detail, Über) legt beim Öffnen einen eigenen
// Eintrag an, der die Ansicht darunter mitträgt ({...state, fenster:true}); Zurück schließt dann nur das Fenster.

/** Die Ansicht eines Verlaufszustands: 'liste' nur bei ansicht:'liste', sonst (auch null) 'filter'. */
export function ansichtVon(state) {
  return state && typeof state === 'object' && state.ansicht === 'liste' ? 'liste' : 'filter';
}

/**
 * Die Ansicht nach einem popstate. War dabei ein Fenster offen, schließt Zurück nur das Fenster: die Ansicht bleibt.
 * Sonst entscheidet der neue Verlaufszustand.
 * @param {any} state history.state nach dem Sprung
 * @param {boolean} fensterOffen ob vor dem Sprung ein Fenster offen war
 * @param {'filter'|'liste'} aktuell die gerade gezeigte Ansicht
 * @returns {'filter'|'liste'}
 */
export function ansichtNachPopstate(state, fensterOffen, aktuell) {
  return fensterOffen ? aktuell : ansichtVon(state);
}

/**
 * "Filter ändern": per history.back() zurück, wenn der aktuelle Eintrag der Listeneintrag selbst ist (kein Fenster),
 * sonst direkt umschalten (z. B. ohne Verlauf).
 */
export function filterAendernPerZurueck(state) {
  return ansichtVon(state) === 'liste' && !state.fenster;
}

/** Der Zustand für den Eintrag eines Fensters: die Ansicht darunter bleibt erhalten (auch für Vorwärts). */
export function fensterZustand(state) {
  return { ...(state && typeof state === 'object' ? state : {}), fenster: true };
}
