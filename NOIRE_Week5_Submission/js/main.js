/* main.js: starts the app. It wires the shell (header, badges, menu) to the router and the store.
   Everything else lives in router.js, store.js, api.js and views/. */
import { $, $$ } from './utils.js';
import { createRouter } from './router.js';
import { routes } from './routes.js';
import { isNotFound } from './api.js';
import { notFoundView, errorView } from './views/status.js';
import * as store from './store.js';
import { toast } from './toast.js';

/* Static hosts without a "rewrite everything to index.html" rule serve 404.html, which saves the address
   the visitor asked for and sends them here. Put that address back before the router reads it. */
function restoreRedirect() {
  try {
    const wanted = sessionStorage.getItem('noire.redirect');
    if (wanted) {
      sessionStorage.removeItem('noire.redirect');
      history.replaceState(null, '', wanted);
    }
  } catch {
    /* storage unavailable: nothing to restore */
  }
}

/* ---- header: badges and mobile menu ------------------------------------------ */
function updateBadges(state) {
  const bag = store.bagCount(state);
  const wish = state.wish.length;
  for (const [name, n] of [['bag', bag], ['wish', wish]]) {
    $$(`[data-count="${name}"]`).forEach((badge) => {
      badge.textContent = String(n);
      badge.hidden = n === 0;
    });
  }
  $('#bag-link').setAttribute('aria-label', bag ? `Bag, ${bag} ${bag === 1 ? 'item' : 'items'}` : 'Bag');
  $('#wish-link').setAttribute('aria-label', wish ? `Wishlist, ${wish} saved` : 'Wishlist');
}

function initMenu() {
  const button = $('.nav-button');
  const nav = $('#site-nav');
  const desktop = window.matchMedia('(min-width: 48em)');
  const setOpen = (open) => {
    button.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('is-open', open);
  };
  button.addEventListener('click', () => setOpen(button.getAttribute('aria-expanded') !== 'true'));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && nav.classList.contains('is-open')) {
      setOpen(false);
      button.focus();
    }
  });
  desktop.addEventListener('change', () => setOpen(false));
  return () => setOpen(false);
}

/* ---- start ------------------------------------------------------------------------- */
restoreRedirect();
const closeMenu = initMenu();
updateBadges(store.getState());
store.subscribe(updateBadges);

const announcer = $('#announcer');
const router = createRouter({
  routes,
  outlet: $('#view'),
  progress: $('#progress'),
  isNotFound,
  notFoundView,
  errorView,
  formatTitle: (title) => (title === 'Home' ? 'NOIRE | Autumn/Winter 2026' : `${title} | NOIRE`),
  announce(title) {
    /* clearing first makes screen readers repeat the message even if the text is the same */
    announcer.textContent = '';
    setTimeout(() => {
      announcer.textContent = `${title}, page loaded`;
    }, 60);
  },
  onNavigate({ route, query }) {
    const key = route ? route.navKey?.(query) ?? route.nav : '';
    $$('[data-nav]').forEach((link) => {
      if (link.dataset.nav === key) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    closeMenu();
  }
});
router.start();

window.addEventListener('offline', () => toast('You are offline. Pages you have already opened still work.'));
window.addEventListener('online', () => toast('You are back online.'));
