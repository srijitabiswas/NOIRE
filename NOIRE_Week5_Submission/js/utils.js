/* utils.js: small helpers shared by every module.
   - html`...`: a tagged template that escapes every interpolated value, so data can never become markup
   - url()/asset(): build URLs that respect the <base href> (works at / and under /repo-name/)
   - money(), debounce(), picture() */

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
export const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* '' when the app lives at the site root, '/noire' when it lives in a sub-folder */
export const BASE = new URL(document.baseURI).pathname.replace(/\/$/, '');
export const url = (path = '/') => BASE + path;
export const asset = (path) => `${BASE}/${path}`;

export const money = (n) => '\u20B9' + Number(n).toLocaleString('en-IN');
export const formatDate = (iso) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

export function debounce(fn, ms) {
  let timer;
  const wrapped = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
  wrapped.cancel = () => clearTimeout(timer);
  return wrapped;
}

/* ---- safe templates --------------------------------------------------- */
class SafeHTML {
  constructor(text) {
    this.text = text;
  }
  toString() {
    return this.text;
  }
}
const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escape = (value) => String(value).replace(/[&<>"']/g, (c) => ESCAPES[c]);
function toText(value) {
  if (value instanceof SafeHTML) return value.text;
  if (Array.isArray(value)) return value.map(toText).join('');
  if (value === null || value === undefined || value === false) return '';
  return escape(value);
}
export function html(strings, ...values) {
  let out = strings[0];
  values.forEach((value, i) => {
    out += toText(value) + strings[i + 1];
  });
  return new SafeHTML(out);
}
/* turns a template result into a real DOM fragment */
export function fragment(safe) {
  const template = document.createElement('template');
  template.innerHTML = String(safe);
  return template.content;
}

/* ---- responsive image markup -------------------------------------------- */
export const srcset = (base, widths, ext) => widths.map((w) => `${asset(`images/${base}-${w}.${ext}`)} ${w}w`).join(', ');
/* AVIF, then WebP, then JPEG: the browser uses the first it understands */
export function picture({ base, widths, alt = '', sizes, width, height, lazy = true, priority = false, cls = '' }) {
  const mid = widths[Math.floor(widths.length / 2)];
  const loading = priority ? 'fetchpriority="high"' : lazy ? 'loading="lazy"' : '';
  return html`<picture>
    <source type="image/avif" srcset="${srcset(base, widths, 'avif')}" sizes="${sizes}">
    <source type="image/webp" srcset="${srcset(base, widths, 'webp')}" sizes="${sizes}">
    <img class="${cls}" src="${asset(`images/${base}-${mid}.jpg`)}" srcset="${srcset(base, widths, 'jpg')}" sizes="${sizes}" width="${width}" height="${height}" alt="${alt}" ${new SafeHTML(loading)} decoding="async">
  </picture>`;
}
export const PRODUCT_SIZES = '(min-width: 90em) 315px, (min-width: 64em) 22vw, (min-width: 48em) 30vw, 46vw';
export const productPicture = (p, opts = {}) =>
  picture({ base: p.image, widths: [320, 480, 626], alt: '', sizes: PRODUCT_SIZES, width: 626, height: 798, ...opts });
