/* views/bag.js: the bag page. The list is rebuilt from the store on every change. */
import { getProducts } from '../api.js';
import { html, fragment, url, money, $ } from '../utils.js';
import * as store from '../store.js';
import { pageShell } from './shared.js';
import { gridSkeleton } from './skeleton.js';

export const bagRoute = {
  path: '/bag',
  name: 'Bag',
  nav: 'bag',
  title: () => 'Your bag',
  load: () => getProducts(),
  prefetch: () => getProducts(),
  skeleton: gridSkeleton,
  render(products, ctx) {
    const byId = new Map(products.map((p) => [p.id, p]));
    const el = pageShell();
    el.append(
      fragment(html`
        <h1 class="page__title">Your bag</h1>
        <div class="empty-state" id="empty" hidden>
          <p>Your bag is empty.</p>
          <a class="button button--small" href="${url('/shop')}" data-link>Continue shopping</a>
        </div>
        <div class="bag" id="bag">
          <ul id="list"></ul>
          <aside class="summary" aria-labelledby="summary-title">
            <h2 id="summary-title">Summary</h2>
            <p class="summary__row"><span>Items</span><span id="items"></span></p>
            <p class="summary__row"><span>Delivery</span><span>Free</span></p>
            <p class="summary__row summary__total"><span>Total</span><span id="total"></span></p>
            <button class="button" type="button" id="checkout">Checkout</button>
            <p class="field-error" id="note" role="status"></p>
          </aside>
        </div>`)
    );

    function paint(focusKey) {
      const rows = store.getState().bag.map((item) => ({ item, product: byId.get(item.id) })).filter((r) => r.product);
      $('#empty', el).hidden = rows.length > 0;
      $('#bag', el).hidden = rows.length === 0;
      $('#note', el).textContent = '';
      $('#list', el).replaceChildren(
        fragment(html`${rows.map(({ item, product }) => html`
          <li class="bag-item" data-id="${item.id}" data-size="${item.size}">
            <img class="bag-item__img" src="${url(`/images/${product.image}-320.webp`)}" alt="" width="320" height="408">
            <p class="bag-item__name"><a href="${url(`/product/${product.id}`)}" data-link>${product.name}</a></p>
            <p class="bag-item__price">Size: ${item.size} &middot; ${money(product.price)} each</p>
            <div>
              <div class="qty" role="group" aria-label="Quantity of ${product.name}">
                <button type="button" data-action="dec" aria-label="Decrease quantity of ${product.name}">&minus;</button>
                <output aria-live="polite">${item.qty}</output>
                <button type="button" data-action="inc" aria-label="Increase quantity of ${product.name}">+</button>
              </div>
              <button class="bag-item__remove" type="button" data-action="remove" aria-label="Remove ${product.name} from bag">Remove</button>
            </div>
          </li>`)}`)
      );
      const count = rows.reduce((n, r) => n + r.item.qty, 0);
      $('#items', el).textContent = String(count);
      $('#total', el).textContent = money(rows.reduce((sum, r) => sum + r.product.price * r.item.qty, 0));
      /* the buttons were replaced, so put keyboard focus back on the same control */
      if (focusKey) {
        const [id, size, action] = focusKey.split('|');
        const again = el.querySelector(`.bag-item[data-id="${id}"][data-size="${size}"] [data-action="${action}"]`);
        (again || el.querySelector('#checkout, a.button')).focus();
      }
    }
    paint();

    el.addEventListener('click', (event) => {
      const button = event.target.closest('[data-action]');
      const li = button?.closest('.bag-item');
      if (!li) return;
      const { id, size } = li.dataset;
      const action = button.dataset.action;
      if (action === 'remove') store.removeFromBag(id, size);
      else store.changeQty(id, size, action === 'inc' ? 1 : -1);
      paint(`${id}|${size}|${action === 'remove' ? 'inc' : action}`);
    });
    $('#checkout', el).addEventListener('click', () => {
      $('#note', el).textContent = 'Checkout is not part of this demo.';
    });
    /* changes made in another tab */
    ctx.onCleanup(store.subscribe(() => paint()));
    return { el };
  }
};
