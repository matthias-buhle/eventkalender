// Liste aller Quellen-Adapter. Jeder Adapter exportiert `name` und `fetchEvents({http, today, config})`.
// Spätere Tasks tragen ihren Adapter hier ein.
import * as aust from './aust.js';

export const adapters = [aust];
