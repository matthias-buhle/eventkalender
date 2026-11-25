import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fetchEvents, bewerte, zuEvent, name } from '../src/sources/evlks.js';
import { rubrikUndGenre } from '../src/rubriken.js';

// Auswahl echter Einträge aus dem Export (kalender.evlks.de/json, abgerufen am 25.11.2026), auf die vom Adapter
// gelesenen Felder gekürzt: keine Beschreibungen, Bilder oder Ansprechpersonen.
const fixture = JSON.parse(readFileSync(new URL('./fixtures/evlks-export.json', import.meta.url), 'utf8'));

const TODAY = '2026-11-25';
const config = { horizonDays: 60 };

/** Fake-Client: liefert die Seiten nacheinander und merkt sich die abgerufenen Adressen. */
function fakeHttp(seiten = [fixture]) {
  const abgerufen = [];
  return {
    abgerufen,
    get: async (url) => {
      abgerufen.push(url);
      return { status: 200, body: seiten[Math.min(abgerufen.length - 1, seiten.length - 1)], url };
    },
  };
}

const lade = (extra = {}, seiten = [fixture]) => fetchEvents({ http: fakeHttp(seiten), today: TODAY, config: { ...config, ...extra } });
const titel = (events) => events.map((e) => e.title);
const eintrag = (t, ort) => fixture.find((x) => x.Veranstaltung._event_TITLE.trim().startsWith(t) && (!ort || x.Veranstaltung._place_NAME.includes(ort)));
const einzeln = (events, t) => {
  const treffer = events.filter((e) => e.title.startsWith(t));
  assert.equal(treffer.length, 1, `${t}: ${treffer.length} Treffer`);
  return treffer[0];
};
/** Eintrag der Auswahl mit geänderten Feldern (für Fälle, die in der Auswahl nicht vorkommen). */
const abwandlung = (t, felder) => ({ Veranstaltung: { ...eintrag(t).Veranstaltung, ...felder } });

test('Name des Adapters', () => {
  assert.equal(name, 'evlks');
});

test('ein Abruf für ganz Sachsen mit allen Parametern ausdrücklich gesetzt', async () => {
  const http = fakeHttp();
  await fetchEvents({ http, today: TODAY, config });
  assert.equal(http.abgerufen.length, 1);
  const url = new URL(http.abgerufen[0]);
  assert.equal(url.origin + url.pathname, 'https://kalender.evlks.de/json');
  const p = Object.fromEntries(url.searchParams);
  assert.equal(p.eventtype, '3,4,5,6,7'); // nie Gottesdienste (1), Gruppen (2), Andachten (10)
  assert.equal(p.dest, 'all'); // nie dest=intern
  assert.equal(p.highlight, 'all');
  assert.equal(p.start, '2026-11-25');
  assert.equal(p.end, '2027-01-24');
  assert.equal(p.itemsPerPage, '3000');
  assert.equal(p.pageID, '1');
  assert.ok(!http.abgerufen[0].includes('dest=intern'));
});

test('blättert nur bei voller Seite und bricht bei zu vielen Seiten ab', async () => {
  const volleSeite = fixture.slice(0, 4);
  const http = fakeHttp([volleSeite, volleSeite, fixture.slice(0, 2)]);
  await fetchEvents({ http, today: TODAY, config: { ...config, limit: 4, maxPages: 4 } });
  assert.equal(http.abgerufen.length, 3);
  assert.match(http.abgerufen[2], /pageID=3/);
  await assert.rejects(
    () => fetchEvents({ http: fakeHttp([volleSeite]), today: TODAY, config: { ...config, limit: 4, maxPages: 2 } }),
    /unvollständig/,
  );
});

test('Konzerte und Musiken bleiben: Orgel, Vesper, Adventsmusik, Chor, Kantate, Christmette, Christvesper', async () => {
  const t = titel(await lade());
  for (const erwartet of [
    'Orgel Punkt Drei',
    'Adventskonzert',
    'Adventsorgelmusik',
    'Striezelmarktmusik',
    'Weihnachtskonzert',
    'Silvesterkonzert',
    'Musikalischer Gottesdienst am 3. Advent in Sebnitz – »Adventsmusik«', // musikalischer Gottesdienst: Musik im Titel
    'Singen zum 2. Advent mit dem Sängerbund',
    'Musikalische Adventsandacht mit dem Männerchor Liebstadt',
    'Neujahrsandacht mit Orgelmusik',
    'Kantatengottesdienst',
    'WEIHNACHTSLIEDERSINGEN der Kurrende Freital', // Auftritt der Kurrende, nicht die Probe
    'Musikalische Christvesper mit Posaunenchor',
    'Christvesper mit Krippenspiel der Konfirmanden',
    'Christmette in Sebnitz',
  ]) assert.ok(t.includes(erwartet), `fehlt: ${erwartet}`);
});

test('Proben, Gruppennamen, Gottesdienste, Andachten und Gebete fallen weg', async () => {
  const t = titel(await lade()).join('\n');
  for (const verboten of [
    'Posaunenchorprobe', 'Kantoreiprobe', 'Chorprobe Laubegast', 'Posaunenchor Zschachwitz', 'Kurrende\n',
    'Festgottesdienst', 'Gottesdienst mit Einführung', 'Friedensgebet', 'Offene Kapelle', 'Lichter Erinnerungs-Nachmittag',
    'Yoga christlich', 'Bibel und Bier', 'vierzigPLUSMINUS',
  ]) assert.ok(!t.includes(verboten), `sollte fehlen: ${verboten}`);
  // "Kurrende" allein ist die Probe der Gruppe, "Kurrende" im Auftritt (Weihnachtsliedersingen) bleibt:
  assert.ok(!titel(await lade()).includes('Kurrende'));
});

test('interne Termine fallen weg, auch wenn der Titel nach Konzert klingt', async () => {
  const intern = eintrag('Adventsliedersingen des Chores der Frauenkirche - intern -');
  assert.ok(intern, 'Beispiel fehlt in der Auswahl');
  assert.equal((await lade()).filter((e) => e.title.includes('intern')).length, 0);
  // Das Feld der Sichtbarkeit allein genügt (Kantorei und Kirchenchor stehen im Export als "intern"):
  for (const t of ['Kantorei Arnsdorf-Fischbach', 'Instrumentalkreis', 'Christnacht']) {
    const e = eintrag(t)?.Veranstaltung;
    assert.ok(e, `${t}: Beispiel fehlt`);
    assert.equal(e._event_DESTINATION, 'intern');
    assert.equal(bewerte(e), null);
  }
  assert.equal(bewerte({ ...eintrag('Adventskonzert').Veranstaltung, _event_DESTINATION: 'intern' }), null);
});

test('Gottesdienst als Zweitkategorie zählt nur mit Musik im Titel', () => {
  const kat = (t) => eintrag(t, '')?.Veranstaltung._event_EVENTTYPE;
  assert.match(kat('Lichter Erinnerungs-Nachmittag'), /Gottesdienste/);
  assert.equal(bewerte(eintrag('Lichter Erinnerungs-Nachmittag').Veranstaltung), null);
  assert.equal(bewerte(eintrag('Offene Kapelle').Veranstaltung), null);
  assert.match(kat('Singen zum 2. Advent'), /Gottesdienste/);
  assert.ok(bewerte(eintrag('Singen zum 2. Advent').Veranstaltung));
  assert.ok(bewerte(eintrag('Adventskonzert', 'Burkau').Veranstaltung));
});

test('Fortbildungen (Kategorie 3) bleiben nur mit öffentlichem Titel', async () => {
  const t = titel(await lade());
  for (const erwartet of ['Kirchenführung', '»Schreibspuren« mit Marcel Beyer', 'Kunstwerkstatt', 'Tag der offenen Tür']) {
    assert.ok(t.includes(erwartet), `fehlt: ${erwartet}`);
    assert.match(eintrag(erwartet).Veranstaltung._event_EVENTTYPE, /Fortbildungen/);
  }
  const text = t.join('\n');
  for (const verboten of ['Stiller Tag', 'Krabbelfrühstück', 'Gesprächskreis Blinde', 'Pastoralkolleg', 'Christologie', 'Impulstag SINGEN', 'Grundkurs Kurzgespräche', 'Jahrestagung']) {
    assert.ok(!text.includes(verboten), `sollte fehlen: ${verboten}`);
    assert.ok(eintrag(verboten), `${verboten}: Beispiel fehlt in der Auswahl`);
  }
});

test('Freizeiten nur als Kinder- und Familienangebot; Feste, Ausstellungen und Märkte bleiben', async () => {
  const events = await lade();
  assert.ok(!titel(events).includes('Alle Jahre wieder'));
  assert.ok(!titel(events).some((x) => x.startsWith('Motorradfahrerfreizeit')));
  assert.ok(bewerte(abwandlung('Alle Jahre wieder', { _event_TITLE: 'Kinderrüstzeit 8.–12.2.2027' }).Veranstaltung));
  assert.ok(bewerte(abwandlung('Alle Jahre wieder', { _event_TITLE: 'Familienfreizeit am Meer' }).Veranstaltung));

  assert.equal(einzeln(events, 'Kirchhof-Lichteln').art, 'fest');
  assert.equal(einzeln(events, 'Festwochenende').art, 'fest');
  assert.equal(einzeln(events, 'Weihnachtsmarkt an der Weinbergkirche').art, 'markt');
  assert.equal(einzeln(events, '"Geschichten in der Landschaft"').art, 'schau');
  assert.equal(einzeln(events, 'Krippenausstellung').art, 'schau');
});

test('Art: Musik ist konzert, anderes bekommt die Art aus dem Titel', async () => {
  const events = await lade();
  for (const t of ['Orgel Punkt Drei', 'Adventskonzert', 'Christmette in Sebnitz', 'Kantatengottesdienst', 'Silvesterkonzert']) {
    assert.equal(einzeln(events, t).art, 'konzert', t);
  }
  // Kategorie "Konzerte/Theater/Musik" enthält auch Theater, Lesungen und Filmabende: die sind keine Konzerte.
  for (const t of ['Messias- Die Weihnachtskomödie', 'Lesung Sabine Ebert', 'Tacheles', 'Spiel zur Nacht', 'Feierstunde zu 90 Jahre']) {
    assert.notEqual(einzeln(events, t).art, 'konzert', t);
  }
});

test('Einsortierung nach den Projektregeln: Kirchenmusik, Lesung, Theater, Kinder, Führung', async () => {
  const events = await lade();
  const rubrik = (t) => rubrikUndGenre(einzeln(events, t));
  for (const t of [
    'Orgel Punkt Drei', // "Punkt" gilt in der Genre-Erkennung als Punk; der Hinweis des Adapters hält es bei der Kirchenmusik
    'Adventskonzert', 'Adventsorgelmusik', 'Striezelmarktmusik', 'Silvesterkonzert',
    'Christmette in Sebnitz', 'Musikalische Christvesper mit Posaunenchor', 'Christvesper mit Krippenspiel der Konfirmanden',
    'Kantatengottesdienst', 'Singen zum 2. Advent', 'Musikalische Adventsandacht',
  ]) assert.deepEqual(rubrik(t), { rubrik: 'konzert', genre: 'kirche' }, t);
  assert.deepEqual(rubrik('Lesung Sabine Ebert'), { rubrik: 'theater', genre: 'lesung' });
  assert.equal(rubrik('Messias- Die Weihnachtskomödie').rubrik, 'theater');
  assert.equal(rubrik('Tacheles').rubrik, 'theater');
  assert.equal(rubrik('Weihnachtsoratorium für Kinder').rubrik, 'kinder');
  assert.equal(rubrik('Weihnachts-Kindermusical').rubrik, 'kinder');
  assert.equal(rubrik('Kirchenführung').rubrik, 'fuehrung');
  assert.equal(rubrik('Weihnachtsmarkt an der Weinbergkirche').rubrik, 'markt');
  assert.equal(rubrik('Festwochenende').rubrik, 'fest');
  assert.deepEqual(rubrik('"Geschichten in der Landschaft"'), { rubrik: 'ausstellung', genre: 'kunst' });
});

test('Gebiet: Koordinaten des Ortes, sonst der Ortsname; Online und Ferne bleiben draußen', async () => {
  const events = await lade();
  const t = titel(events);
  // Leipzig, Grünau und Großzschocher liegen weit außerhalb der 75 km
  for (const fern of ['J.S. Bach: Weihnachtsoratorium', '"Naturphantasien', 'Lichterfest Großzschocher', 'Konzert mit dem Chorlektiv']) assert.ok(!t.some((x) => x.startsWith(fern)), fern);
  // Online-Eintrag (Ort "Online", ohne Koordinaten)
  assert.ok(fixture.some((x) => x.Veranstaltung._place_NAME === 'Online'));
  assert.ok(!events.some((e) => e.placeName === 'Online'));
  // Ohne Koordinaten, aber Ort im Gebiet (Weinböhla, Dresden): bleibt, Koordinaten null, Entfernung rechnet das Projekt später
  const weinboehla = einzeln(events, 'Adventsmusik zum Zuhören');
  assert.equal(weinboehla.lat, null);
  assert.match(weinboehla.placeName, /Weinböhla/);
  assert.ok(einzeln(events, 'Adventsblasen im Schillergarten').start);
  // Mit Koordinaten: übernommen
  const sebnitz = einzeln(events, 'Christmette in Sebnitz');
  assert.ok(Math.abs(sebnitz.lat - 50.97) < 0.01);
  assert.ok(Math.abs(sebnitz.lon - 14.27) < 0.01);
});

test('Felder: Link zur Veranstaltung, Ort, Zeit; keine Beschreibung, kein Bild, keine Kontaktdaten', async () => {
  const events = await lade();
  const e = einzeln(events, 'Musikalischer Gottesdienst am 3. Advent in Sebnitz');
  assert.equal(e.title, 'Musikalischer Gottesdienst am 3. Advent in Sebnitz – »Adventsmusik«');
  assert.equal(e.start, '2026-12-13T16:00:00+01:00');
  assert.equal(e.hasTime, true);
  assert.equal(e.end, null); // der Export kennt hier kein Ende (END_RFC ist nur Standarddauer)
  assert.equal(e.placeName, 'Ev.-Luth. Stadtkirche Sebnitz'); // der Name nennt die Stadt schon
  assert.deepEqual(e.sources, [{ name: 'Kirchenkalender der Ev.-Luth. Landeskirche Sachsens', url: 'https://kalender.evlks.de/veranstaltung_im_detail175066.html' }]);
  assert.equal(e.description, null);
  assert.equal(e.ticketUrl, null);
  assert.deepEqual(e.contact, { phone: null, url: null, email: null });
  assert.equal(e.lizenz, null);

  assert.equal(einzeln(events, 'Christmette in Sebnitz').start, '2026-12-25T08:00:00+01:00');
  // Ort aus Name und Stadt, wenn der Name die Stadt nicht nennt
  assert.equal(einzeln(events, 'Orgel Punkt Drei').placeName, 'Kreuzkirche Dresden');
  assert.equal(einzeln(events, 'Adventsblasen im Schillergarten').placeName, 'Schillergarten, Dresden');
  // "Siehe Beschreibung" ist kein Ort
  assert.equal(einzeln(events, 'Jauchzet Frohlocket').placeName, 'Freital');
  // Nirgends ein Bild- oder Kontaktfeld im Ergebnis
  for (const ev of events) {
    assert.equal(ev.description, null);
    assert.equal(ev.ticketUrl, null);
    assert.equal(ev.contact.email, null);
    assert.ok(!JSON.stringify(ev).includes('thumbnails'));
  }
});

test('Ganztägige und mehrtägige Termine: ohne Uhrzeit, mit Ende nur über mehrere Tage', async () => {
  const events = await lade();
  const lichter = einzeln(events, 'Kirchenmusik auf dem Weihnachtsmarkt');
  assert.equal(lichter.hasTime, false);
  assert.equal(lichter.start, '2026-12-10T00:00:00+01:00');
  assert.equal(lichter.end, '2026-12-13T23:59:00+01:00');
  // ganztägig, ohne Ende
  const ausstellung = einzeln(events, '"Geschichten in der Landschaft"');
  assert.equal(ausstellung.hasTime, false);
  assert.equal(ausstellung.end, null);
  // läuft schon, im Fenster, weil das Ende nach heute liegt
  const installation = einzeln(events, 'Geliebt. Licht');
  assert.equal(installation.start, '2026-11-01T00:00:00+01:00');
  assert.equal(installation.end, '2026-12-06T23:59:00+01:00');
});

test('Zeitfenster: Termine hinter dem Horizont und vor heute fallen weg', async () => {
  const kurz = await lade({ horizonDays: 5 });
  assert.ok(kurz.every((e) => e.start.slice(0, 10) <= '2026-11-30'));
  assert.ok(kurz.some((e) => e.title === 'Adventskonzert'));
  const spaeter = await fetchEvents({ http: fakeHttp(), today: '2026-12-20', config });
  assert.ok(spaeter.every((e) => (e.end ?? e.start).slice(0, 10) >= '2026-12-20'));
  assert.ok(!spaeter.some((e) => e.title === 'Adventskonzert'));
});

test('Ergebnis ist nach Beginn sortiert, ohne Dubletten und stabil in der Kennung', async () => {
  const ersterAbruf = await lade();
  const starts = ersterAbruf.map((e) => e.start);
  assert.deepEqual(starts, [...starts].sort());
  assert.equal(new Set(ersterAbruf.map((e) => e.id)).size, ersterAbruf.length);
  assert.deepEqual((await lade()).map((e) => e.id), ersterAbruf.map((e) => e.id));
  // derselbe Termin doppelt im Export (andere Datum-ID, gleiche Angaben) zählt einmal
  const doppelt = [...fixture, abwandlung('Adventskonzert', { ID: '999999', _event_ID: '888888' })];
  const mitDublette = await lade({}, [doppelt]);
  assert.equal(mitDublette.filter((e) => e.title === 'Adventskonzert').length, ersterAbruf.filter((e) => e.title === 'Adventskonzert').length);
});

test('höchstens 800 Termine je Lauf, die frühesten zuerst', async () => {
  const vorlage = eintrag('Silvesterkonzert').Veranstaltung;
  const viele = Array.from({ length: 900 }, (_, i) => {
    const minute = String(i % 60).padStart(2, '0');
    const stunde = String(Math.floor(i / 60) % 24).padStart(2, '0');
    const tag = String(1 + Math.floor(i / 1440)).padStart(2, '0');
    return { Veranstaltung: { ...vorlage, ID: String(1000 + i), _event_ID: String(5000 + i), _event_TITLE: `Konzert ${i}`, START: `2026-12-${tag} ${stunde}:${minute}:00` } };
  });
  const events = await lade({ limit: 5000 }, [viele]);
  assert.equal(events.length, 800);
  assert.equal(events[0].title, 'Konzert 0');
  assert.equal(events[799].title, 'Konzert 799');
});

test('Fehler: leere Antwort, kein Array, nichts übrig', async () => {
  await assert.rejects(() => lade({}, [[]]), /leere Antwort/);
  await assert.rejects(() => lade({}, [{ fehler: 'x' }]), /kein Array/);
  const nurProben = fixture.filter((x) => /probe/i.test(x.Veranstaltung._event_TITLE));
  assert.ok(nurProben.length > 0);
  await assert.rejects(() => lade({}, [nurProben]), /keine Termine übrig/);
});

test('zuEvent wirft nie, auch bei Müll', () => {
  for (const muell of [null, undefined, 5, 'x', {}, { Veranstaltung: null }, { Veranstaltung: { _event_TITLE: 'Konzert' } }]) {
    assert.equal(zuEvent(muell), null);
  }
  assert.equal(bewerte(undefined), null);
});
