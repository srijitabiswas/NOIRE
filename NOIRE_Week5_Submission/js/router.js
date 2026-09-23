/* router.js: client-side routing with the History API.

   What it does
   - matches the address bar against a route table (with :params) and shows the matching view
   - links marked data-link change the URL with history.pushState, so the page never reloads
   - the back and forward buttons work (popstate), and each history entry remembers its scroll position
   - loads a route's data BEFORE swapping the view, so the old page stays put until the new one is ready;
     a progress bar appears if it takes a moment, and a skeleton if it takes longer
   - ignores stale results: if you click again while a page is loading, only the latest click wins
   - shows a 404 view for unknown addresses and an error view (with Retry) when loading fails
   - moves focus to the new page heading and announces the change to screen readers
   - animates the swap with the View Transitions API when the browser has it

   Route shape: { path, name, nav, title(data, params), load({params, query}), skeleton(), render(data, ctx), prefetch(params), redirect(params, query) }
   render() returns { el, onQuery?(query) } where onQuery lets a view update itself when only the query string
   changes (for example a filter), so the page is not rebuilt. */
import { BASE, $, reduceMotion, debounce } from './utils.js';

function compile(route) {
  const keys = [];
  const source = route.path
    .split('/')
    .filter(Boolean)
    .map((segment) => {
      if (segment.startsWith(':')) {
        keys.push(segment.slice(1));
        return '([^/]+)';
      }
      return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/');
  return { route, keys, regex: new RegExp(`^/${source}/?$`) };
}

const sameParams = (a, b) => Object.keys(a).length === Object.keys(b).length && Object.keys(a).every((k) => a[k] === b[k]);

export function createRouter({ routes, outlet, isNotFound, notFoundView, errorView, formatTitle, onNavigate, announce, progress }) {
  const compiled = routes.map(compile);
  let current = null; /* { route, params, query, view } of what is on screen */
  let navId = 0; /* increases with every navigation; lets us drop stale results */
  let cleanups = [];
  let progressTimer;
  let skeletonTimer;
  let activeTransition = null;
  const prefetched = new Set();
  let lastKey = ''; /* path + query of the last render, used to ignore hash-only history changes */

  history.scrollRestoration = 'manual'; /* we restore scroll ourselves, after the new view exists */

  /* ---- matching ------------------------------------------------------------- */
  function match(pathname) {
    let path = pathname;
    if (BASE && path.startsWith(BASE)) path = path.slice(BASE.length) || '/';
    for (const { route, keys, regex } of compiled) {
      const found = regex.exec(path);
      if (!found) continue;
      try {
        const params = Object.fromEntries(keys.map((key, i) => [key, decodeURIComponent(found[i + 1])]));
        return { route, params };
      } catch {
        return null; /* malformed %-encoding in the address: treat as not found */
      }
    }
    return null;
  }

  /* ---- progress bar ----------------------------------------------------------- */
  function showProgress() {
    clearTimeout(progressTimer);
    progressTimer = setTimeout(() => {
      progress.hidden = false;
    }, 150); /* quick pages never flash a loading bar */
  }
  function hideProgress() {
    clearTimeout(progressTimer);
    progress.hidden = true;
    outlet.removeAttribute('aria-busy');
  }

  const runCleanups = () => {
    cleanups.forEach((fn) => fn());
    cleanups = [];
  };

  /* ---- swapping the view -------------------------------------------------------- */
  async function swap(update, animate) {
    activeTransition?.skipTransition?.();
    if (animate && !reduceMotion() && document.startViewTransition) {
      activeTransition = document.startViewTransition(update);
      try {
        await activeTransition.updateCallbackDone;
      } catch {
        /* a skipped transition is fine: the update still ran */
      }
      return;
    }
    update();
    if (animate && !reduceMotion()) {
      /* fallback for browsers without View Transitions: play an enter animation on the new view */
      outlet.classList.remove('view-enter');
      void outlet.offsetWidth; /* restart the animation */
      outlet.classList.add('view-enter');
      outlet.addEventListener('animationend', () => outlet.classList.remove('view-enter'), { once: true });
    }
  }

  function present({ route, params, query, view, title, localCleanups }, source, id) {
    const animate = source !== 'initial' && outlet.childElementCount > 0;
    return swap(() => {
      if (id !== navId) return; /* superseded while the transition was starting */
      runCleanups();
      cleanups = localCleanups;
      outlet.replaceChildren(view.el);
      current = { route, params, query, view };

      const text = formatTitle(title);
      document.title = text;
      onNavigate?.({ route, params, query, title });

      /* scroll: restore on back/forward, otherwise go to the top (or to the #anchor) */
      const anchor = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (source === 'pop') window.scrollTo({ top: history.state?.scrollY ?? 0, behavior: 'instant' });
      else if (anchor) anchor.scrollIntoView({ behavior: 'instant' });
      else window.scrollTo({ top: 0, behavior: 'instant' });

      /* accessibility: a single-page app must move focus and announce the change itself */
      if (source !== 'initial') {
        const heading = $('h1', outlet) || outlet;
        heading.setAttribute('tabindex', '-1');
        heading.focus({ preventScroll: true });
      }
      announce(title);
    }, animate);
  }

  /* ---- the main routine: run on every navigation ---------------------------------- */
  async function render(source) {
    const id = ++navId;
    clearTimeout(skeletonTimer);
    lastKey = location.pathname + location.search;
    const location_ = new URL(location.href);
    const hit = match(location_.pathname);

    if (hit?.route.redirect) {
      const target = hit.route.redirect(hit.params, location_.searchParams);
      history.replaceState(history.state, '', BASE + target);
      return render(source);
    }

    const query = Object.fromEntries(location_.searchParams);
    const route = hit?.route ?? null;
    const params = hit?.params ?? {};

    /* Same page, different query (for example another filter): let the view update itself */
    if (current && route && current.route === route && sameParams(current.params, params) && current.view.onQuery && source !== 'retry') {
      current.query = query;
      current.view.onQuery(query);
      const title = current.view.getTitle?.() ?? current.route.name;
      document.title = formatTitle(title);
      onNavigate?.({ route: current.route, params, query, title });
      announce(title);
      if (source === 'pop') window.scrollTo({ top: history.state?.scrollY ?? 0, behavior: 'instant' });
      return;
    }

    showProgress();
    outlet.setAttribute('aria-busy', 'true');
    if (route?.skeleton) {
      skeletonTimer = setTimeout(() => {
        if (id !== navId) return;
        runCleanups(); /* the old view is going away */
        current = null;
        outlet.replaceChildren(route.skeleton());
      }, 300); /* only slow loads get a skeleton */
    }

    const localCleanups = [];
    const ctx = { params, query, router: api, onCleanup: (fn) => localCleanups.push(fn) };
    try {
      if (!route) throw Object.assign(new Error('No route matches this address.'), { unmatched: true });
      const data = await route.load?.({ params, query });
      if (id !== navId) return; /* the visitor already clicked something else */
      const view = route.render(data, ctx);
      clearTimeout(skeletonTimer);
      await present({ route, params, query, view, title: route.title?.(data, params, query) ?? route.name, localCleanups }, source, id);
    } catch (error) {
      if (id !== navId) return;
      clearTimeout(skeletonTimer);
      localCleanups.length = 0;
      const missing = error.unmatched || isNotFound(error);
      const view = missing ? notFoundView(error, ctx) : errorView(error, () => render('retry'), ctx);
      await present({ route: null, params, query, view, title: missing ? 'Page not found' : 'Something went wrong', localCleanups }, source, id);
    } finally {
      if (id === navId) hideProgress();
    }
  }

  /* ---- public API --------------------------------------------------------------------- */
  function saveScroll() {
    history.replaceState({ ...history.state, scrollY: window.scrollY }, '');
  }
  function navigate(to, { replace = false } = {}) {
    const target = new URL(to, location.href);
    if (target.origin !== location.origin) {
      location.assign(target.href);
      return Promise.resolve();
    }
    if (target.href === location.href) return Promise.resolve(); /* already here */
    saveScroll();
    history[replace ? 'replaceState' : 'pushState']({}, '', target.pathname + target.search + target.hash);
    return render(replace ? 'replace' : 'push');
  }
  /* change the query string without navigating (used while typing in the search box) */
  function replaceQuery(patch) {
    const params = new URLSearchParams(location.search);
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === undefined || value === '') params.delete(key);
      else params.set(key, value);
    }
    const query = params.toString();
    history.replaceState(history.state, '', location.pathname + (query ? `?${query}` : '') + location.hash);
    if (current) current.query = Object.fromEntries(params);
  }
  const api = { navigate, replaceQuery, reload: () => render('retry'), match };

  function onClick(event) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest('a[data-link]');
    if (!link || (link.target && link.target !== '_self') || link.hasAttribute('download')) return;
    const target = new URL(link.href);
    if (target.origin !== location.origin) return;
    /* a link to an #anchor on this same page is left to the browser (for example the skip link) */
    if (target.pathname === location.pathname && target.search === location.search && target.hash) return;
    event.preventDefault();
    navigate(link.href);
  }

  /* start loading a page's data as soon as the visitor shows interest in its link */
  const prefetch = debounce((link) => {
    const target = new URL(link.href);
    if (target.origin !== location.origin || prefetched.has(target.href)) return;
    prefetched.add(target.href);
    const found = match(target.pathname);
    Promise.resolve(found?.route.prefetch?.(found.params)).catch(() => prefetched.delete(target.href));
  }, 60);
  function onIntent(event) {
    const link = event.target.closest?.('a[data-link]');
    if (link) prefetch(link);
  }

  function start() {
    window.addEventListener('popstate', () => {
      /* Following an in-page #anchor (such as the skip link) also fires popstate. Only the hash changed,
         so leave scrolling and focus to the browser instead of rebuilding the page. */
      if (location.pathname + location.search === lastKey) return;
      render('pop');
    });
    document.addEventListener('click', onClick);
    document.addEventListener('pointerover', onIntent);
    document.addEventListener('focusin', onIntent);
    window.addEventListener('pagehide', saveScroll);
    return render('initial');
  }

  return { ...api, start, current: () => current };
}
