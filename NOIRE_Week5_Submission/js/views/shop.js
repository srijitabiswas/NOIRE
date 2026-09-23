/* views/shop.js: the collection page.
   The address bar is the single source of truth for the filters:
     /shop?category=Dresses&sort=price-asc&q=silk&new=1
   so a filtered page can be bookmarked, shared, refreshed, and stepped through with Back and Forward.
   Changing a filter does not rebuild the page: the router calls onQuery() and this view repaints the grid. */
import { getProducts } from '../api.js';
import { html, fragment, url, debounce, $ } from '../utils.js';
import { productCard, bindWishlist, pageShell } from './shared.js';
import { gridSkeleton } from './skeleton.js';

const CATEGORIES = ['Dresses', 'Tops', 'Trousers', 'Outerwear', 'Accessories'];
const SORTS = { recommended: 'Recommended', 'price-asc': 'Price: low to high', 'price-desc': 'Price: high to low', name: 'Name: A to Z' };

function filterProducts(products, query) {
  let list = products;
  if (query.new === '1') list = list.filter((p) => p.isNew);
  if (CATEGORIES.includes(query.category)) list = list.filter((p) => p.category === query.category);
  const text = (query.q || '').trim().toLowerCase();
  if (text) list = list.filter((p) => [p.name, p.category, p.style, p.material, p.occasion, ...p.colors].join(' ').toLowerCase().includes(text));
  const sorters = {
    'price-asc': (a, b) => a.price - b.price,
    'price-desc': (a, b) => b.price - a.price,
    name: (a, b) => a.name.localeCompare(b.name)
  };
  return [...list].sort(sorters[query.sort] ?? ((a, b) => a.order - b.order));
}

/* builds /shop?... from a query object, leaving out empty values and defaults */
export function shopUrl(query) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value && !(key === 'sort' && value === 'recommended')) params.set(key, value);
  }
  const qs = params.toString();
  return url('/shop') + (qs ? `?${qs}` : '');
}

export const shopRoute = {
  path: '/shop',
  name: 'Women',
  nav: 'shop',
  navKey: (query) => (query.new === '1' ? 'new' : 'shop'),
  title: (_data, _params, query) => (query.new === '1' ? 'New arrivals' : 'Women'),
  load: () => getProducts(),
  prefetch: () => getProducts(),
  skeleton: gridSkeleton,
  render(products, ctx) {
    let query = { ...ctx.query };
    const el = pageShell();
    el.append(
      fragment(html`
        <h1 class="page__title" id="shop-title"></h1>
        <div class="toolbar">
          <p class="toolbar__count" id="count" aria-live="polite" aria-atomic="true"></p>
          <div class="toolbar__search">
            <label class="visually-hidden" for="q">Search pieces</label>
            <input class="search" id="q" type="search" placeholder="Search pieces" autocomplete="off" enterkeyhint="search">
          </div>
          <nav aria-label="Filter by category"><ul class="chips" id="chips"></ul></nav>
          <div class="toolbar__sort">
            <label for="sort">Sort by</label>
            <select class="select" id="sort">${Object.entries(SORTS).map(([value, label]) => html`<option value="${value}">${label}</option>`)}</select>
          </div>
        </div>
        <h2 class="visually-hidden">Pieces</h2>
        <ul class="product-grid" id="grid"></ul>
        <div class="empty-state" id="empty" hidden>
          <p>No pieces match your choices.</p>
          <a class="button button--small" href="${url('/shop')}" data-link>Clear filters</a>
        </div>`)
    );
    const grid = $('#grid', el);
    const heading = $('#shop-title', el);
    const search = $('#q', el);
    const select = $('#sort', el);

    /* one function turns the current query into what is on screen */
    function paint() {
      const list = filterProducts(products, query);
      const isNew = query.new === '1';
      heading.textContent = isNew ? 'New arrivals' : 'Women';
      $('#count', el).textContent = `${list.length} ${list.length === 1 ? 'piece' : 'pieces'}`;
      const chip = (label, category) => {
        const active = (query.category || '') === category;
        return html`<li><a class="chip" href="${shopUrl({ ...query, category })}" data-link aria-current="${String(active)}">${label}</a></li>`;
      };
      $('#chips', el).replaceChildren(fragment(html`${chip('All', '')}${CATEGORIES.map((c) => chip(c, c))}`));
      select.value = SORTS[query.sort] ? query.sort : 'recommended';
      if (document.activeElement !== search) search.value = query.q || '';
      grid.replaceChildren(fragment(html`${list.map((p) => productCard(p))}`));
      $('#empty', el).hidden = list.length > 0;
    }
    paint();
    bindWishlist(el, ctx);

    select.addEventListener('change', () => ctx.router.navigate(shopUrl({ ...query, sort: select.value })));
    /* typing replaces the URL (no new history entry per keystroke) and repaints in place */
    const applySearch = debounce(() => {
      query = { ...query, q: search.value.trim() };
      ctx.router.replaceQuery({ q: query.q });
      paint();
    }, 250);
    search.addEventListener('input', applySearch);
    ctx.onCleanup(() => applySearch.cancel());

    return {
      el,
      onQuery(next) {
        query = { ...next };
        paint();
      },
      getTitle: () => (query.new === '1' ? 'New arrivals' : 'Women')
    };
  }
};
