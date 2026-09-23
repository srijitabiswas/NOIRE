/* views/product.js: one product, at /product/:id.
   An unknown id makes getProduct() throw NotFoundError, and the router shows the 404 view. */
import { getProduct, getProducts } from '../api.js';
import { html, fragment, url, money, picture, $ } from '../utils.js';
import * as store from '../store.js';
import { toast } from '../toast.js';
import { productCard, bindWishlist, pageShell } from './shared.js';
import { gridSkeleton } from './skeleton.js';

export const productRoute = {
  path: '/product/:id',
  name: 'Piece',
  nav: 'shop',
  title: ([product]) => product.name,
  load: ({ params }) => Promise.all([getProduct(params.id), getProducts()]),
  prefetch: ({ id }) => Promise.all([getProduct(id), getProducts()]),
  skeleton: gridSkeleton,
  render([product, all], ctx) {
    const off = Math.round((1 - product.price / product.mrp) * 100);
    const oneSize = product.sizes.length === 1;
    const related = all.filter((p) => p.category === product.category && p.id !== product.id);
    const more = [...related, ...all.filter((p) => p.category !== product.category && p.id !== product.id)].slice(0, 4);

    const el = pageShell();
    el.append(
      fragment(html`
        <nav class="breadcrumb" aria-label="Breadcrumb">
          <ol>
            <li><a href="${url('/')}" data-link>Home</a></li>
            <li><a href="${url('/shop')}" data-link>Women</a></li>
            <li><a href="${url(`/shop?category=${product.category}`)}" data-link>${product.category}</a></li>
            <li aria-current="page">${product.name}</li>
          </ol>
        </nav>
        <div class="pdp">
          <div class="pdp__image">
            ${picture({ base: product.image, widths: [480, 626], alt: product.alt, sizes: '(min-width: 48em) 50vw, 100vw', width: 626, height: 798, lazy: false, priority: true })}
          </div>
          <div class="pdp__info">
            <h1>${product.name}</h1>
            <p class="pdp__price">${money(product.price)} <s><span class="visually-hidden">was </span>${money(product.mrp)}</s><em>${off}% off</em></p>
            <p>${product.description}</p>
            <p class="meta">Colours: ${product.colors.join(', ')}</p>
            <form id="buy" novalidate>
              <fieldset>
                <legend>Size</legend>
                <div class="size-options">
                  ${product.sizes.map((size) => html`<label class="size-option"><input type="radio" name="size" value="${size}" ${oneSize ? 'checked' : ''}><span>${size}</span></label>`)}
                </div>
              </fieldset>
              <p class="field-error" id="size-error" role="alert"></p>
              <div class="pdp__actions">
                <button class="button" type="submit">Add to bag</button>
                <button class="button button--light" type="button" id="save" aria-pressed="false">Save to wishlist</button>
              </div>
            </form>
            <details>
              <summary>Details</summary>
              <ul>${product.details.map((d) => html`<li>${d}</li>`)}</ul>
            </details>
            <p class="meta">Free delivery on orders above ${money(500)}. Returns accepted within 14 days.</p>
          </div>
        </div>
        <section class="section section--flush" aria-labelledby="more-title">
          <div class="section__head"><h2 id="more-title">You may also like</h2></div>
          <ul class="product-grid">${more.map((p) => productCard(p))}</ul>
        </section>`)
    );

    const form = $('#buy', el);
    const error = $('#size-error', el);
    form.addEventListener('change', () => {
      error.textContent = '';
    });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const chosen = form.querySelector('input[name="size"]:checked');
      if (!chosen) {
        error.textContent = 'Choose a size to add this piece to your bag.';
        form.querySelector('input[name="size"]').focus();
        return;
      }
      store.addToBag(product.id, chosen.value);
      toast(`Added ${product.name} (${chosen.value}) to your bag`);
    });

    const save = $('#save', el);
    const syncSave = () => {
      const saved = store.isSaved(product.id);
      save.setAttribute('aria-pressed', String(saved));
      save.textContent = saved ? 'Saved to wishlist' : 'Save to wishlist';
    };
    syncSave();
    save.addEventListener('click', () => {
      const saved = store.toggleWish(product.id);
      toast(saved ? `Saved ${product.name} to your wishlist` : `Removed ${product.name} from your wishlist`);
    });
    ctx.onCleanup(store.subscribe(syncSave));
    bindWishlist(el, ctx);
    return { el };
  }
};
