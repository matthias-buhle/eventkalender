// Hell/Dunkel: folgt dem Handy, bis man umschaltet; die Wahl wird auf dem Gerät gemerkt.
// Läuft früh im <head>, damit die Seite nicht erst hell und dann dunkel aufblitzt.
(function () {
  var KEY = 'buehnenlicht-thema';
  var wurzel = document.documentElement;
  var FARBEN = { dark: '#0F1420', light: '#F6F2EA' };

  function gemerkt() {
    try {
      var v = window.localStorage.getItem(KEY);
      return v === 'dark' || v === 'light' ? v : null;
    } catch (e) {
      return null; // privater Modus: Wahl gilt nur bis zum Neuladen
    }
  }
  function merke(wert) {
    try { window.localStorage.setItem(KEY, wert); } catch (e) { /* egal */ }
  }
  var system = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  function ausSystem() { return system && system.matches ? 'dark' : 'light'; }

  var aktuell = gemerkt() || ausSystem();
  var festgelegt = gemerkt() !== null;

  function anwenden(thema) {
    aktuell = thema;
    wurzel.setAttribute('data-theme', thema);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', FARBEN[thema]);
    var knopf = document.getElementById('thema');
    if (knopf) {
      knopf.setAttribute('aria-pressed', String(thema === 'dark'));
      knopf.setAttribute('aria-label', thema === 'dark' ? 'Zum hellen Design wechseln' : 'Zum dunklen Design wechseln');
    }
  }

  anwenden(aktuell);
  if (system && system.addEventListener) {
    system.addEventListener('change', function () { if (!festgelegt) anwenden(ausSystem()); });
  }
  document.addEventListener('DOMContentLoaded', function () {
    var knopf = document.getElementById('thema');
    if (!knopf) return;
    anwenden(aktuell);
    knopf.addEventListener('click', function () {
      festgelegt = true;
      var neu = aktuell === 'dark' ? 'light' : 'dark';
      merke(neu);
      anwenden(neu);
    });
  });
})();
