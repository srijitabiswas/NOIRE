/* ==========================================================================
   NOIRE: women's collection page (Week 3 interactivity, Week 4 accessibility and performance updates)
   Plain JavaScript, no libraries. The page works without this file; this
   script only enhances it (progressive enhancement).

   Contents
   1. Helpers
   2. State (with localStorage)
   3. Toast
   4. Header: mobile menu, shadow on scroll
   5. Product grid: filter, sort, wishlist
   6. Quick view dialog
   7. Bag drawer
   8. Size finder
   9. Newsletter form validation
   10. Scroll reveal animation
   11. Start-up
   ========================================================================== */
(() => {
  'use strict';

  /* 1. Helpers ----------------------------------------------------------- */
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const money = (n) => '\u20B9' + n.toLocaleString('en-IN');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dialogsSupported = typeof HTMLDialogElement === 'function';

  /* Safe wrapper: localStorage can throw (private mode, quota, disabled). */
  const store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem('noire.' + key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem('noire.' + key, JSON.stringify(value));
      } catch {
        /* storage unavailable: features still work for this visit */
      }
    }
  };

  /* Builds DOM nodes with textContent, never innerHTML, so text can never be
     interpreted as markup. */
  function h(tag, props = {}, ...children) {
    const el = document.createElement(tag);
    for (const [key, value] of Object.entries(props)) {
      if (value === false || value === null || value === undefined) continue;
      if (key === 'class') el.className = value;
      else if (key === 'text') el.textContent = value;
      else if (value === true) el.setAttribute(key, '');
      else el.setAttribute(key, value);
    }
    el.append(...children.flat().filter((c) => c !== null && c !== undefined));
    return el;
  }

  /* 2. State ------------------------------------------------------------- */
  const grid = $('.product-grid');
  const feature = $('.feature', grid);

  /* Product data is read from data-* attributes in the HTML, so the markup is
     the single source of truth. */
  const products = $$('.product', grid).map((el, index) => ({
    el,
    index,
    id: el.dataset.id,
    name: el.dataset.name,
    price: Number(el.dataset.price),
    mrp: Number(el.dataset.mrp),
    category: el.dataset.category,
    desc: el.dataset.desc,
    img: el.dataset.img,
    alt: el.dataset.alt /* full description for the quick view; grid images are decorative (the link text names the product) */
  }));
  const byId = new Map(products.map((p) => [p.id, p]));

  /* The size guide table is also the source for the size finder. */
  const sizeRows = $$('.size-table tbody tr').map((tr) => {
    const cell = (label) => Number($(`[data-label="${label}"]`, tr).textContent);
    return { tr, size: $('th', tr).textContent.trim(), bust: cell('Bust (cm)'), waist: cell('Waist (cm)'), hips: cell('Hips (cm)') };
  });

  const state = {
    category: 'all',
    sort: 'recommended',
    wishOnly: false,
    wish: new Set(sanitizeWish(store.get('wishlist', []))),
    bag: sanitizeBag(store.get('bag', [])),
    mySize: store.get('size', null)
  };

  function sanitizeWish(raw) {
    return Array.isArray(raw) ? raw.filter((id) => byId.has(id)) : [];
  }
  function sanitizeBag(raw) {
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((i) => i && byId.has(i.id) && typeof i.size === 'string' && Number.isInteger(i.qty) && i.qty > 0 && i.qty <= 9)
      .map((i) => ({ id: i.id, size: i.size, qty: i.qty }));
  }

  /* 3. Toast ------------------------------------------------------------- */
  const toastEl = $('#toast');
  let toastTimer;
  function toast(message) {
    toastEl.textContent = message;
    toastEl.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-visible'), 2600);
  }

  /* Counters in the header ------------------------------------------------ */
  const wishLink = $('#wish-link');
  const bagLink = $('#bag-link');
  function setBadge(name, n) {
    $$(`[data-count="${name}"]`).forEach((badge) => {
      badge.textContent = String(n);
      badge.hidden = n === 0;
    });
  }
  function updateBadges() {
    const bagCount = state.bag.reduce((sum, item) => sum + item.qty, 0);
    setBadge('wish', state.wish.size);
    setBadge('bag', bagCount);
    /* the visible number is not read clearly next to the word, so give the link a full name */
    wishLink.setAttribute('aria-label', state.wish.size ? `Wishlist, ${state.wish.size} saved` : 'Wishlist');
    bagLink.setAttribute('aria-label', bagCount ? `Bag, ${bagCount} ${bagCount === 1 ? 'item' : 'items'}` : 'Bag');
  }

  /* Dialog helpers (native <dialog>: focus trap, Escape and backdrop for free) */
  function openDialog(dialog) {
    dialog.showModal();
    document.documentElement.classList.add('has-dialog');
  }
  function initDialogs() {
    $$('dialog').forEach((dialog) => {
      dialog.addEventListener('click', (e) => {
        /* a click on the backdrop targets the dialog element itself */
        if (e.target === dialog || e.target.closest('[data-close]')) dialog.close();
      });
      dialog.addEventListener('close', () => document.documentElement.classList.remove('has-dialog'));
    });
  }

  /* 4. Header ------------------------------------------------------------ */
  function initNav() {
    const button = $('.nav-button');
    const nav = $('#site-nav');
    const desktop = window.matchMedia('(min-width: 48em)');

    const setOpen = (open) => {
      button.setAttribute('aria-expanded', String(open));
      nav.classList.toggle('is-open', open);
    };
    button.addEventListener('click', () => setOpen(button.getAttribute('aria-expanded') !== 'true'));
    nav.addEventListener('click', (e) => {
      if (e.target.closest('a')) setOpen(false);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) {
        setOpen(false);
        button.focus();
      }
    });
    document.addEventListener('click', (e) => {
      if (nav.classList.contains('is-open') && !e.target.closest('.site-header')) setOpen(false);
    });
    desktop.addEventListener('change', () => setOpen(false));
  }

  /* An observer on a 1px sentinel is cheaper than a scroll listener. */
  function initHeaderShadow() {
    const header = $('.site-header');
    const sentinel = h('div', { class: 'sentinel', 'aria-hidden': 'true' });
    document.body.prepend(sentinel);
    new IntersectionObserver(([entry]) => header.classList.toggle('is-stuck', !entry.isIntersecting)).observe(sentinel);
  }

  /* 5. Product grid ------------------------------------------------------ */
  const countEl = $('#count');
  const emptyBox = $('#empty');
  const emptyText = $('#empty-text');
  const sortSelect = $('#sort');
  const chips = $$('.chip');

  const sorters = {
    recommended: (a, b) => a.index - b.index,
    'price-asc': (a, b) => a.price - b.price,
    'price-desc': (a, b) => b.price - a.price,
    name: (a, b) => a.name.localeCompare(b.name)
  };

  function getVisible() {
    return products
      .filter((p) => (state.category === 'all' || p.category === state.category) && (!state.wishOnly || state.wish.has(p.id)))
      .sort(sorters[state.sort]);
  }

  /* One render function: state in, DOM out. Every control only changes state
     and calls render(). */
  function render({ animate = true } = {}) {
    const list = getVisible();
    const shown = new Set(list);
    const showFeature = state.category === 'all' && !state.wishOnly;

    /* final order: visible products (feature card after the 8th), then hidden ones */
    const order = [];
    list.forEach((p, i) => {
      order.push(p.el);
      if (showFeature && i === 7) order.push(feature);
    });
    if (showFeature && list.length < 8) order.push(feature);
    products.forEach((p) => {
      if (!shown.has(p)) order.push(p.el);
    });
    if (!showFeature) order.push(feature);
    grid.append(...order); /* one batch of moves instead of many */

    products.forEach((p) => {
      p.el.hidden = !shown.has(p);
    });
    feature.hidden = !showFeature;

    const n = list.length;
    const noun = n === 1 ? 'piece' : 'pieces';
    countEl.textContent = state.wishOnly ? `${n} saved ${noun}` : `${n} ${noun}`;
    emptyBox.hidden = n > 0;
    if (n === 0) {
      emptyText.textContent =
        state.wishOnly && state.wish.size === 0
          ? 'You have not saved anything yet. Tap the heart on a piece to keep it here.'
          : 'No pieces match your choices.';
    }
    if (animate && !reduceMotion && grid.animate) {
      grid.animate([{ opacity: 0.35 }, { opacity: 1 }], { duration: 280, easing: 'ease-out' });
    }
  }

  function resetFilters() {
    state.category = 'all';
    state.sort = 'recommended';
    state.wishOnly = false;
    sortSelect.value = 'recommended';
    chips.forEach((chip) => chip.setAttribute('aria-pressed', String(chip.dataset.category === 'all')));
    wishLink.setAttribute('aria-pressed', 'false');
    render();
  }

  function toggleWish(id) {
    const product = byId.get(id);
    const saving = !state.wish.has(id);
    if (saving) state.wish.add(id);
    else state.wish.delete(id);
    store.set('wishlist', [...state.wish]);
    products.forEach((p) => $('.heart', p.el).setAttribute('aria-pressed', String(state.wish.has(p.id))));
    updateBadges();
    toast(saving ? `Saved ${product.name} to your wishlist` : `Removed ${product.name} from your wishlist`);
    if (state.wishOnly) render({ animate: false });
  }

  const HEART_SVG =
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 20.5s-7.5-4.6-9.2-9.4C1.6 7.6 3.6 4.5 6.9 4.5c2 0 3.4 1.1 5.1 3 1.7-1.9 3.1-3 5.1-3 3.3 0 5.3 3.1 4.1 6.6-1.7 4.8-9.2 9.4-9.2 9.4z"/></svg>';

  function initGrid() {
    /* hearts are added by script because they do nothing without it */
    products.forEach((p) => {
      const heart = h('button', {
        class: 'heart',
        type: 'button',
        'aria-pressed': String(state.wish.has(p.id)),
        'aria-label': `Save ${p.name} to wishlist`
      });
      heart.innerHTML = HEART_SVG; /* constant string, no user data */
      p.el.append(heart);
    });

    /* product links open a dialog, so say so to assistive technology */
    $$('.product__link').forEach((link) => link.setAttribute('aria-haspopup', 'dialog'));

    /* one listener on the grid instead of one per product (event delegation) */
    grid.addEventListener('click', (e) => {
      const heart = e.target.closest('.heart');
      if (heart) {
        toggleWish(heart.closest('.product').dataset.id);
        return;
      }
      const link = e.target.closest('.product__link');
      if (link && dialogsSupported) {
        e.preventDefault();
        openQuickView(byId.get(link.closest('.product').dataset.id));
      }
    });

    chips.forEach((chip) =>
      chip.addEventListener('click', () => {
        state.category = chip.dataset.category;
        chips.forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
        render();
      })
    );
    sortSelect.addEventListener('change', () => {
      state.sort = sortSelect.value;
      render();
    });
    $('#empty-reset').addEventListener('click', resetFilters);

    /* the header Wishlist link becomes a "show saved pieces" toggle */
    wishLink.setAttribute('role', 'button');
    wishLink.setAttribute('aria-pressed', 'false');
    const toggleWishOnly = (e) => {
      e.preventDefault();
      state.wishOnly = !state.wishOnly;
      wishLink.setAttribute('aria-pressed', String(state.wishOnly));
      render();
      $('#shop').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
      toast(state.wishOnly ? 'Showing your saved pieces' : 'Showing all pieces');
    };
    wishLink.addEventListener('click', toggleWishOnly);
    wishLink.addEventListener('keydown', (e) => {
      if (e.key === ' ') toggleWishOnly(e); /* role="button" must answer to Space as well as Enter */
    });

    render({ animate: false });
  }

  /* 6. Quick view -------------------------------------------------------- */
  const qv = {
    dialog: $('#quickview'),
    img: $('#qv-img'),
    title: $('#qv-title'),
    price: $('#qv-price'),
    desc: $('#qv-desc'),
    sizes: $('#qv-sizes'),
    options: $('#qv-size-options'),
    hint: $('#qv-hint'),
    error: $('#qv-error'),
    add: $('#qv-add'),
    product: null
  };

  function openQuickView(product) {
    qv.product = product;
    const needsSize = product.category !== 'Accessories';
    const preselect = needsSize && sizeRows.some((r) => r.size === state.mySize) ? state.mySize : null;

    qv.img.src = product.img;
    qv.img.alt = product.alt;
    qv.title.textContent = product.name;
    qv.price.replaceChildren(
      money(product.price),
      h('s', {}, h('span', { class: 'visually-hidden', text: 'Original price ' }), money(product.mrp))
    );
    qv.desc.textContent = product.desc;
    qv.sizes.hidden = !needsSize;
    qv.hint.hidden = !preselect;
    qv.options.replaceChildren(
      ...sizeRows.map(({ size }) =>
        h(
          'label',
          { class: 'size-option' },
          h('input', { type: 'radio', name: 'qv-size', value: size, checked: size === preselect }),
          h('span', { text: size })
        )
      )
    );
    qv.error.textContent = '';
    openDialog(qv.dialog);
  }

  function initQuickView() {
    qv.options.addEventListener('change', () => {
      qv.error.textContent = '';
    });
    qv.add.addEventListener('click', () => {
      const product = qv.product;
      let size = 'One size';
      if (product.category !== 'Accessories') {
        const chosen = $('input[name="qv-size"]:checked', qv.dialog);
        if (!chosen) {
          qv.error.textContent = 'Choose a size to add this piece to your bag.';
          $('input[name="qv-size"]', qv.dialog).focus();
          return;
        }
        size = chosen.value;
      }
      addToBag(product.id, size);
      qv.dialog.close();
      toast(`Added ${product.name} (${size}) to your bag`);
    });
  }

  /* 7. Bag --------------------------------------------------------------- */
  const bag = {
    dialog: $('#bag'),
    list: $('#bag-list'),
    empty: $('#bag-empty'),
    foot: $('#bag-foot'),
    total: $('#bag-total'),
    note: $('#bag-note')
  };

  function saveBag() {
    store.set('bag', state.bag);
    updateBadges();
    if (bag.dialog.open) renderBag();
  }
  function addToBag(id, size) {
    const item = state.bag.find((i) => i.id === id && i.size === size);
    if (item) item.qty = Math.min(9, item.qty + 1);
    else state.bag.push({ id, size, qty: 1 });
    saveBag();
  }

  function renderBag(focusKey) {
    const rows = state.bag.map((item) => ({ item, product: byId.get(item.id) }));
    bag.empty.hidden = rows.length > 0;
    bag.list.hidden = bag.foot.hidden = rows.length === 0;
    bag.note.textContent = '';
    bag.list.replaceChildren(
      ...rows.map(({ item, product }) =>
        h(
          'li',
          { class: 'bag-item', 'data-id': item.id, 'data-size': item.size },
          h('img', { class: 'bag-item__img', src: product.img.replace('-626', '-320'), alt: '', width: 320, height: 408 }),
          h(
            'div',
            { class: 'bag-item__info' },
            h('p', { class: 'bag-item__name', text: product.name }),
            h('p', { class: 'bag-item__meta', text: `Size: ${item.size}` }),
            h('p', { class: 'bag-item__price', text: money(product.price * item.qty) })
          ),
          h(
            'div',
            { class: 'bag-item__qty' },
            h('button', { type: 'button', class: 'bag-item__step', 'data-action': 'dec', 'aria-label': `Decrease quantity of ${product.name}`, text: '\u2212' }),
            h('span', { class: 'bag-item__count', text: String(item.qty) }),
            h('button', { type: 'button', class: 'bag-item__step', 'data-action': 'inc', 'aria-label': `Increase quantity of ${product.name}`, text: '+' })
          ),
          h('button', { type: 'button', class: 'bag-item__remove', 'data-action': 'remove', 'aria-label': `Remove ${product.name} from bag`, text: 'Remove' })
        )
      )
    );
    bag.total.textContent = money(rows.reduce((sum, { item, product }) => sum + product.price * item.qty, 0));

    /* the buttons were replaced, so put keyboard focus back where it was */
    if (focusKey) {
      const [id, size, action] = focusKey.split('|');
      const again = $(`.bag-item[data-id="${id}"][data-size="${size}"] [data-action="${action}"]`, bag.list);
      (again || $('.dialog__close', bag.dialog)).focus();
    }
  }

  function initBag() {
    bag.list.addEventListener('click', (e) => {
      const button = e.target.closest('button[data-action]');
      if (!button) return;
      const li = button.closest('li');
      const item = state.bag.find((i) => i.id === li.dataset.id && i.size === li.dataset.size);
      if (!item) return;
      const action = button.dataset.action;
      if (action === 'remove' || (action === 'dec' && item.qty === 1)) {
        state.bag.splice(state.bag.indexOf(item), 1);
      } else {
        item.qty = Math.max(1, Math.min(9, item.qty + (action === 'inc' ? 1 : -1)));
      }
      store.set('bag', state.bag);
      updateBadges();
      renderBag(`${item.id}|${item.size}|${action === 'remove' ? 'inc' : action}`);
    });

    $('#bag-checkout').addEventListener('click', () => {
      bag.note.textContent = 'Checkout is not part of this demo.';
    });

    if (dialogsSupported) {
      /* an anchor that opens a dialog is really a button: give it that role and Space key support */
      bagLink.setAttribute('role', 'button');
      bagLink.setAttribute('aria-haspopup', 'dialog');
      const openBag = (e) => {
        e.preventDefault();
        renderBag();
        openDialog(bag.dialog);
      };
      bagLink.addEventListener('click', openBag);
      bagLink.addEventListener('keydown', (e) => {
        if (e.key === ' ') openBag(e);
      });
    }
  }

  /* 8. Size finder ------------------------------------------------------- */
  /* Rule: the size is the smallest one whose bust, waist AND hips are all at
     least as large as the customer's, i.e. the largest of the three decides. */
  function recommend(m) {
    let index = 0;
    for (const key of ['bust', 'waist', 'hips']) {
      const i = sizeRows.findIndex((row) => m[key] <= row[key]);
      if (i === -1) return null;
      index = Math.max(index, i);
    }
    return sizeRows[index];
  }

  function initSizeFinder() {
    const form = $('#size-finder');
    const result = $('#size-result');
    const fields = ['bust', 'waist', 'hips'].map((name) => ({ name, input: form.elements[name], error: $(`#f-${name}-err`) }));

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      sizeRows.forEach((row) => row.tr.classList.remove('is-match'));
      const values = {};
      let valid = true;
      for (const field of fields) {
        const raw = field.input.value.trim();
        const n = Number(raw);
        let message = '';
        if (raw === '') message = 'Enter your measurement in cm.';
        else if (!Number.isFinite(n) || n < 60 || n > 140) message = 'Enter a number between 60 and 140.';
        field.error.textContent = message;
        field.input.setAttribute('aria-invalid', String(message !== ''));
        if (message) valid = false;
        else values[field.name] = n;
      }
      if (!valid) {
        result.textContent = '';
        fields.find((f) => f.input.getAttribute('aria-invalid') === 'true').input.focus();
        return;
      }
      const match = recommend(values);
      if (!match) {
        result.textContent = 'Your measurements are above our XL range. Contact us for made-to-order sizing.';
        return;
      }
      match.tr.classList.add('is-match');
      state.mySize = match.size;
      store.set('size', match.size);
      result.textContent = `Your size is ${match.size}. It is the smallest size that fits all three measurements.`;
    });
  }

  /* 9. Newsletter -------------------------------------------------------- */
  function initNewsletter() {
    const form = $('.newsletter form');
    const input = $('#email');
    const error = $('#email-error');
    const status = $('#newsletter-status');
    const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

    function validate() {
      const value = input.value.trim();
      let message = '';
      if (!value) message = 'Enter your email address.';
      else if (!pattern.test(value)) message = 'That does not look like an email address. Try name@example.com.';
      error.textContent = message;
      input.setAttribute('aria-invalid', String(message !== ''));
      return message === '';
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      status.textContent = '';
      if (!validate()) {
        input.focus();
        return;
      }
      /* no backend in this project: pretend the request succeeded */
      form.reset();
      error.textContent = '';
      input.removeAttribute('aria-invalid');
      status.textContent = 'Thank you. You are on the list.';
    });
    input.addEventListener('blur', () => {
      if (input.value) validate();
    });
    input.addEventListener('input', () => {
      if (input.getAttribute('aria-invalid') === 'true') validate();
    });
  }

  /* 10. Scroll reveal ---------------------------------------------------- */
  function initReveal() {
    if (reduceMotion || !('IntersectionObserver' in window)) return;
    const targets = $$('.product, .feature, .fit__intro, .fit__table, .services li, .newsletter > *');
    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          obs.unobserve(entry.target); /* animate once, then stop watching */
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
    );
    targets.forEach((el, i) => {
      el.classList.add('reveal');
      el.style.setProperty('--delay', `${(i % 4) * 70}ms`); /* small stagger per row */
      observer.observe(el);
    });

    /* Safety nets: content must never stay invisible. Keyboard focus reveals an
       element at once, and printing reveals everything. */
    const show = (el) => {
      el.classList.add('is-visible');
      observer.unobserve(el);
    };
    document.addEventListener('focusin', (e) => {
      const el = e.target.closest('.reveal');
      if (el) show(el);
    });
    window.addEventListener('beforeprint', () => $$('.reveal').forEach(show));
  }

  /* 11. Start-up --------------------------------------------------------- */
  initDialogs();
  initNav();
  initHeaderShadow();
  initGrid();
  initQuickView();
  initBag();
  initSizeFinder();
  initNewsletter();
  initReveal();
  updateBadges();
})();
