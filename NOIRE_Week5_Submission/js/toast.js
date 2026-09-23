/* toast.js: a short message at the bottom of the screen (role="status", so it is also announced) */
import { $ } from './utils.js';

let timer;
export function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('is-visible');
  clearTimeout(timer);
  timer = setTimeout(() => el.classList.remove('is-visible'), 2600);
}
