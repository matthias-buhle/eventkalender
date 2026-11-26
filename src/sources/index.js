// Liste aller Quellen-Adapter. Jeder Adapter exportiert `name` und `fetchEvents({http, today, config})`.
// Spätere Tasks tragen ihren Adapter hier ein.
import * as aust from './aust.js';
import * as satourn from './satourn.js';
import * as kamenz from './kamenz.js';
import * as bischofswerda from './bischofswerda.js';
import * as goerlitz from './goerlitz.js';
import * as augusto from './augusto.js';
import * as goout from './goout.js';
import * as ticketmaster from './ticketmaster.js';
import * as gefluegel from './gefluegel.js';
import * as neustadthalle from './neustadthalle.js';
import * as stolpen from './stolpen.js';
import * as l2club from './l2club.js';
import * as steinhaus from './steinhaus.js';
import * as idecin from './idecin.js';
import * as dresden from './dresden.js';
import * as staatsoperette from './staatsoperette.js';
import * as projekttheater from './projekttheater.js';
import * as herkuleskeule from './herkuleskeule.js';
import * as museendresden from './museendresden.js';
import * as slpb from './slpb.js';
import * as flohmarkt from './flohmarkt.js';
import * as mvp from './mvp.js';
import * as bluenote from './bluenote.js';
import * as varnsdorf from './varnsdorf.js';
import * as zgorzelec from './zgorzelec.js';
import * as krone from './krone.js';
import * as evlks from './evlks.js';
import * as hoftheater from './hoftheater.js';
import * as kufa from './kufa.js';

// Die Reihenfolge zählt bei Dubletten: der frühere Eintrag behält seine Angaben, der spätere ergänzt nur.
export const adapters = [
  aust, satourn, kamenz, bischofswerda, goerlitz, augusto, goout, ticketmaster,
  gefluegel, neustadthalle, stolpen, l2club, steinhaus, idecin, dresden,
  staatsoperette, projekttheater, herkuleskeule, hoftheater, kufa, museendresden, slpb, flohmarkt, mvp,
  bluenote, varnsdorf, zgorzelec, krone, evlks,
];
