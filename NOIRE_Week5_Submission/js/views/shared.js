/* views/shared.js: markup and behaviour that more than one view uses */
import { html, money, productPicture, url, $$, picture } from '../utils.js';
import * as store from '../store.js';
import { toast } from '../toast.js';

const HEART = html`<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 20.5s-7.5-4.6-9.2-9.4C1.6 7.6 3.6 4.5 6.9 4.5c2 0 3.4 1.1 5.1 3 1.7-1.9 3.1-3 5.1-3 3.3 0 5.3 3.1 4.1 6.6-1.7 4.8-9.2 9.4-9.2 9.4z"/></svg>`;

export function productCard(product, options = {}) {
  return html`<li class="product">
    <a class="product__link" href="${url(`/product/${product.id}`)}" data-link>
      ${productPicture(product, options)}
      <div class="product__info">
        <h3 class="product__name">${product.name}</h3>
        <span class="product__price"><span class="visually-hidden">Price: </span>${money(product.price)} <s><span class="visually-hidden">was </span>${money(product.mrp)}</s></span>
      </div>
    </a>
    <button class="heart" type="button" data-action="wish" data-id="${product.id}" data-name="${product.name}" aria-pressed="${String(store.isSaved(product.id))}" aria-label="Save ${product.name} to wishlist">${HEART}</button>
  </li>`;
}

export const journalCard = (article) => html`<li class="card">
  <a class="card__image" href="${url(`/journal/${article.slug}`)}" data-link tabindex="-1" aria-hidden="true">
    ${picture({ base: article.image.base, widths: article.image.widths, alt: '', sizes: '(min-width: 64em) 30vw, (min-width: 40em) 45vw, 100vw', width: article.image.ratio[0], height: article.image.ratio[1] })}
  </a>
  <p class="card__meta"><span class="visually-hidden">Published </span>${new Date(`${article.date}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} &middot; ${article.readMinutes} min read</p>
  <h3 class="card__title"><a href="${url(`/journal/${article.slug}`)}" data-link>${article.title}</a></h3>
  <p class="card__excerpt">${article.excerpt}</p>
</li>`;

/* Makes every heart inside `el` work, and keeps the hearts in step with the store
   (for example when the wishlist changes in another tab). */
export function bindWishlist(el, ctx) {
  el.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action="wish"]');
    if (!button) return;
    const saved = store.toggleWish(button.dataset.id);
    toast(saved ? `Saved ${button.dataset.name} to your wishlist` : `Removed ${button.dataset.name} from your wishlist`);
  });
  const sync = () => $$('[data-action="wish"]', el).forEach((b) => b.setAttribute('aria-pressed', String(store.isSaved(b.dataset.id))));
  ctx.onCleanup(store.subscribe(sync));
}

export function pageShell(className = 'page') {
  const el = document.createElement('div');
  el.className = className;
  return el;
}
