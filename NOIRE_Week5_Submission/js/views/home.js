/* views/home.js: the landing page (hero, new arrivals, editorial feature, latest journal stories) */
import { getProducts, getJournal } from '../api.js';
import { html, fragment, url, picture, srcset } from '../utils.js';
import { productCard, journalCard, bindWishlist } from './shared.js';
import { gridSkeleton } from './skeleton.js';

const wide = [800, 1200, 1920];
const portrait = [480, 780];

/* art direction: a portrait crop on phones, a wide crop from 48em up */
const heroPicture = html`<picture>
  <source media="(min-width: 48em)" type="image/avif" srcset="${srcset('banner-wide', wide, 'avif')}" sizes="100vw">
  <source media="(min-width: 48em)" type="image/webp" srcset="${srcset('banner-wide', wide, 'webp')}" sizes="100vw">
  <source media="(min-width: 48em)" srcset="${srcset('banner-wide', wide, 'jpg')}" sizes="100vw">
  <source type="image/avif" srcset="${srcset('banner-portrait', portrait, 'avif')}" sizes="100vw">
  <source type="image/webp" srcset="${srcset('banner-portrait', portrait, 'webp')}" sizes="100vw">
  <img src="${url('/images/banner-portrait-780.jpg')}" srcset="${srcset('banner-portrait', portrait, 'jpg')}" sizes="100vw" width="780" height="873" fetchpriority="high" alt="Model in a dark brown tailored suit against a sunlit plaster wall">
</picture>`;

export const homeRoute = {
  path: '/',
  name: 'Home',
  nav: '',
  title: () => 'Home',
  load: () => Promise.all([getProducts(), getJournal()]),
  prefetch: () => Promise.all([getProducts(), getJournal()]),
  skeleton: gridSkeleton,
  render([products, journal], ctx) {
    const el = document.createElement('div');
    const arrivals = products.filter((p) => p.isNew).slice(0, 4);
    el.append(
      fragment(html`
        <section class="hero" aria-labelledby="hero-title">
          ${heroPicture}
          <div class="hero__content">
            <p class="eyebrow">Autumn/Winter 2026</p>
            <h1 id="hero-title">The Art of Silhouette</h1>
            <p class="hero__lead">Designed for the moments that matter.</p>
            <a class="button" href="${url('/shop')}" data-link>Explore now</a>
          </div>
        </section>

        <section class="section" aria-labelledby="new-title">
          <div class="section__head">
            <h2 id="new-title">New arrivals</h2>
            <a class="link" href="${url('/shop?new=1')}" data-link>View all <span aria-hidden="true">&rarr;</span></a>
          </div>
          <ul class="product-grid">${arrivals.map((p) => productCard(p))}</ul>
        </section>

        <section class="feature" aria-labelledby="feature-title">
          ${picture({ base: 'feature', widths: [600, 1055], alt: 'Model in a flowing ivory satin dress caught in movement', sizes: '(min-width: 48em) 55vw, 100vw', width: 1055, height: 760 })}
          <div class="feature__text">
            <p class="eyebrow">The evening edit</p>
            <h2 id="feature-title">Draped, not dressed</h2>
            <p class="feature__copy">Sculptural silhouettes and structured tailoring with a softer edge. Minimal details, maximum character.</p>
            <a class="link" href="${url('/shop?category=Dresses')}" data-link>Shop dresses <span aria-hidden="true">&rarr;</span></a>
          </div>
        </section>

        <section class="section" aria-labelledby="journal-title">
          <div class="section__head">
            <h2 id="journal-title">From the journal</h2>
            <a class="link" href="${url('/journal')}" data-link>All stories <span aria-hidden="true">&rarr;</span></a>
          </div>
          <ul class="journal-grid">${journal.slice(0, 3).map(journalCard)}</ul>
        </section>`)
    );
    bindWishlist(el, ctx);
    return { el };
  }
};
