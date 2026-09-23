/* api.js: loads JSON from data/. Everything the views need comes through here.
   - results are cached, so going back to a page is instant
   - a missing file becomes NotFoundError, any other failure becomes HttpError
   - two developer switches make it easy to demo loading and error states:
       ?latency=800   adds 800 ms to every request
       ?fail=journal  makes any request whose path contains "journal" fail with a 503
     (remembered for the tab; ?latency=0 and ?fail= turn them off) */
import { asset } from './utils.js';

export class HttpError extends Error {
  constructor(status, path) {
    super(`The request for ${path} failed (${status}).`);
    this.name = 'HttpError';
    this.status = status;
  }
}
export class NotFoundError extends Error {
  constructor(what = 'page') {
    super(`We could not find that ${what}.`);
    this.name = 'NotFoundError';
    this.what = what;
  }
}

/* ---- developer switches ---------------------------------------------------- */
function readDevFlags() {
  const params = new URLSearchParams(location.search);
  let changed = false;
  for (const key of ['latency', 'fail']) {
    if (params.has(key)) {
      try {
        sessionStorage.setItem(`noire.${key}`, params.get(key));
      } catch {
        /* storage unavailable: the switch only lasts for this load */
      }
      params.delete(key);
      changed = true;
    }
  }
  if (changed) {
    const query = params.toString();
    history.replaceState(history.state, '', location.pathname + (query ? `?${query}` : '') + location.hash);
  }
  const read = (key) => {
    try {
      return sessionStorage.getItem(`noire.${key}`) || '';
    } catch {
      return '';
    }
  };
  return { latency: Number(read('latency')) || 0, fail: read('fail') };
}
const dev = readDevFlags();
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* ---- fetching -------------------------------------------------------------------- */
async function fetchJSON(path) {
  if (dev.latency) await wait(dev.latency);
  if (dev.fail && path.includes(dev.fail)) throw new HttpError(503, path);
  let response;
  try {
    response = await fetch(asset(path), { headers: { Accept: 'application/json' } });
  } catch {
    throw new HttpError(0, path); /* offline or blocked */
  }
  /* A static host that rewrites unknown paths to index.html answers 200 with HTML, so check the type too */
  const isJSON = (response.headers.get('content-type') || '').includes('json');
  if (!response.ok || !isJSON) throw new HttpError(response.ok ? 404 : response.status, path);
  return response.json();
}

const cache = new Map();
function cached(key, loader) {
  if (!cache.has(key)) {
    const promise = loader().catch((error) => {
      cache.delete(key); /* never cache a failure, so Retry really retries */
      throw error;
    });
    cache.set(key, promise);
  }
  return cache.get(key);
}

export const getProducts = () => cached('products', async () => (await fetchJSON('data/products.json')).products);
export async function getProduct(id) {
  const product = (await getProducts()).find((p) => p.id === id);
  if (!product) throw new NotFoundError('piece');
  return product;
}
export const getJournal = async () => (await cached('journal', () => fetchJSON('data/journal.json'))).articles;
export function getArticle(slug) {
  if (!/^[a-z0-9-]+$/.test(slug)) return Promise.reject(new NotFoundError('story'));
  return cached(`article:${slug}`, async () => {
    try {
      return await fetchJSON(`data/articles/${slug}.json`);
    } catch (error) {
      if (error instanceof HttpError && error.status === 404) throw new NotFoundError('story');
      throw error;
    }
  });
}

/* the router asks this to tell a 404 from a real failure */
export const isNotFound = (error) => error instanceof NotFoundError;
