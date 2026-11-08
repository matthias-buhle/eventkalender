// Liste aller Quellen-Adapter. Jeder Adapter exportiert `name` und `fetchEvents({http, today, config})`.
// Spätere Tasks tragen ihren Adapter hier ein.
import * as aust from './aust.js';
import * as satourn from './satourn.js';
import * as kamenz from './kamenz.js';

export const adapters = [aust, satourn, kamenz];
