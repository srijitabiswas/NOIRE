/* views/skeleton.js: grey placeholder shapes shown when a page is slow to load */
import { html, fragment } from '../utils.js';

export function gridSkeleton() {
  const el = document.createElement('div');
  el.className = 'skeleton';
  el.append(
    fragment(html`<h1 class="visually-hidden">Loading&hellip;</h1>
      <div class="skeleton__bar"></div>
      <div class="skeleton__grid">${Array.from({ length: 8 }, () => html`<div class="skeleton__card"></div>`)}</div>`)
  );
  return el;
}
