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
import * as maerkte from './maerkte.js';
import * as neustadthalle from './neustadthalle.js';
import * as stolpen from './stolpen.js';

export const adapters = [
  aust, satourn, kamenz, bischofswerda, goerlitz, augusto, goout, ticketmaster,
  gefluegel, maerkte, neustadthalle, stolpen,
];
