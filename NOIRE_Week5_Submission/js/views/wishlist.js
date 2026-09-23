/* views/wishlist.js: pieces the visitor saved. Re-renders whenever the store changes. */
import { getProducts } from '../api.js';
import { html, fragment, url, $ } from '../utils.js';
import * as store from '../store.js';
import { productCard, bindWishlist, pageShell } from './shared.js';
import { gridSkeleton } from './skeleton.js';

export const wishlistRoute = {
  path: '/wishlist',
  name: 'Wishlist',
  nav: 'wishlist',
  title: () => 'Wishlist',
  load: () => getProducts(),
  prefetch: () => getProducts(),
  skeleton: gridSkeleton,
  render(products, ctx) {
    const el = pageShell();
    el.append(
      fragment(html`
        <h1 class="page__title">Wishlist</h1>
        <p class="meta lede" id="wish-count" aria-live="polite"></p>
        <h2 class="visually-hidden">Saved pieces</h2>
        <ul class="product-grid" id="grid"></ul>
        <div class="empty-state" id="empty" hidden>
          <p>Nothing saved yet. Tap the heart on any piece to keep it here.</p>
          <a class="button button--small" href="${url('/shop')}" data-link>Browse the collection</a>
        </div>`)
    );
    function paint() {
      const saved = store.getState().wish.map((id) => products.find((p) => p.id === id)).filter(Boolean);
      $('#wish-count', el).textContent = saved.length ? `${saved.length} saved ${saved.length === 1 ? 'piece' : 'pieces'}` : '';
      $('#grid', el).replaceChildren(fragment(html`${saved.map((p) => productCard(p))}`));
      $('#empty', el).hidden = saved.length > 0;
    }
    paint();
    ctx.onCleanup(store.subscribe(paint));
    bindWishlist(el, ctx);
    return { el };
  }
};
