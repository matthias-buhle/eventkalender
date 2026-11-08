import robotsParser from 'robots-parser';

export class RobotsDisallowedError extends Error {
  constructor(url) { super(`robots.txt verbietet den Abruf: ${url}`); this.name = 'RobotsDisallowedError'; }
}
export class HttpError extends Error {
  constructor(status, url) { super(`HTTP ${status} für ${url}`); this.name = 'HttpError'; this.status = status; }
}

const realSleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Höflicher Abruf: beachtet robots.txt und Crawl-delay, hält pro Host Abstand,
 * wiederholt bei 5xx genau einmal. Status >= 400 wirft HttpError.
 * @param {{userAgent:string, perHostDelayMs:number, timeoutMs?:number,
 *          fetchImpl?:typeof fetch, now?:()=>number, sleep?:(ms:number)=>Promise<void>}} opts
 */
export function createPoliteClient({
  userAgent, perHostDelayMs, timeoutMs = 20000,
  fetchImpl = fetch, now = Date.now, sleep = realSleep,
}) {
  const token = userAgent.split('/')[0];
  const robotsByOrigin = new Map(); // origin -> Promise<robots|null>
  const lastAtByHost = new Map();
  const chainByHost = new Map();

  async function request(url, extraHeaders = {}) {
    return fetchImpl(url, {
      headers: { 'User-Agent': userAgent, 'Accept-Language': 'de,cs;q=0.8', ...extraHeaders },
      signal: AbortSignal.timeout(timeoutMs),
      redirect: 'follow',
    });
  }

  function robotsFor(origin) {
    if (!robotsByOrigin.has(origin)) {
      robotsByOrigin.set(origin, (async () => {
        try {
          const res = await request(`${origin}/robots.txt`);
          if (!res.ok) return null;
          return robotsParser(`${origin}/robots.txt`, await res.text());
        } catch { return null; }
      })());
    }
    return robotsByOrigin.get(origin);
  }

  /** Reiht den Abruf in die Warteschlange des Hosts ein und hält den Abstand ein. */
  function schedule(host, delayMs, task) {
    const prev = chainByHost.get(host) ?? Promise.resolve();
    const run = prev.catch(() => {}).then(async () => {
      const last = lastAtByHost.get(host);
      if (last !== undefined) {
        const wait = last + delayMs - now();
        if (wait > 0) await sleep(wait);
      }
      try { return await task(); } finally { lastAtByHost.set(host, now()); }
    });
    chainByHost.set(host, run);
    return run;
  }

  async function get(url, { as = 'text' } = {}) {
    const u = new URL(url);
    const robots = await robotsFor(u.origin);
    if (robots && robots.isAllowed(url, token) === false) throw new RobotsDisallowedError(url);
    const crawlDelay = robots?.getCrawlDelay(token);
    const delayMs = Math.max(perHostDelayMs, (crawlDelay ?? 0) * 1000);

    return schedule(u.host, delayMs, async () => {
      let res = await request(url);
      if (res.status >= 500) {
        await sleep(Math.min(delayMs, 1000));
        res = await request(url);
      }
      if (res.status >= 400) throw new HttpError(res.status, url);
      const text = await res.text();
      return { status: res.status, body: as === 'json' ? JSON.parse(text) : text, url: res.url || url };
    });
  }

  return { get };
}
