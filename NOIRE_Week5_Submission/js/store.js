/* store.js: the app's shared state (wishlist and bag).
   - a tiny publish/subscribe store: views call subscribe() and re-render when state changes
   - saved in localStorage, and kept in sync between browser tabs with the "storage" event
   - state is never edited in place: each action builds a new object, so changes are easy to detect */
const KEY = 'noire.spa.v1';
const MAX_QTY = 9;

const empty = () => ({ wish: [], bag: [] });

function sanitize(raw) {
  const state = empty();
  if (!raw || typeof raw !== 'object') return state;
  if (Array.isArray(raw.wish)) state.wish = [...new Set(raw.wish.filter((id) => typeof id === 'string'))];
  if (Array.isArray(raw.bag)) {
    state.bag = raw.bag
      .filter((i) => i && typeof i.id === 'string' && typeof i.size === 'string' && Number.isInteger(i.qty) && i.qty > 0 && i.qty <= MAX_QTY)
      .map((i) => ({ id: i.id, size: i.size, qty: i.qty }));
  }
  return state;
}
function load() {
  try {
    return sanitize(JSON.parse(localStorage.getItem(KEY)));
  } catch {
    return empty();
  }
}

let state = load();
const listeners = new Set();

function commit(next) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* private mode or quota: the app still works for this visit */
  }
  listeners.forEach((listener) => listener(state));
}

export const getState = () => state;
export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener); /* call the result to unsubscribe */
}

/* another tab changed the saved data: adopt it */
window.addEventListener('storage', (event) => {
  if (event.key !== KEY) return;
  state = load();
  listeners.forEach((listener) => listener(state));
});

/* ---- actions ------------------------------------------------------------------- */
export function toggleWish(id) {
  const saved = state.wish.includes(id);
  commit({ ...state, wish: saved ? state.wish.filter((x) => x !== id) : [...state.wish, id] });
  return !saved;
}
export function addToBag(id, size) {
  const found = state.bag.some((i) => i.id === id && i.size === size);
  const bag = found
    ? state.bag.map((i) => (i.id === id && i.size === size ? { ...i, qty: Math.min(MAX_QTY, i.qty + 1) } : i))
    : [...state.bag, { id, size, qty: 1 }];
  commit({ ...state, bag });
}
export function changeQty(id, size, delta) {
  const bag = state.bag
    .map((i) => (i.id === id && i.size === size ? { ...i, qty: Math.min(MAX_QTY, i.qty + delta) } : i))
    .filter((i) => i.qty > 0);
  commit({ ...state, bag });
}
export function removeFromBag(id, size) {
  commit({ ...state, bag: state.bag.filter((i) => !(i.id === id && i.size === size)) });
}

/* ---- selectors -------------------------------------------------------------------- */
export const bagCount = (s = state) => s.bag.reduce((n, i) => n + i.qty, 0);
export const isSaved = (id, s = state) => s.wish.includes(id);
