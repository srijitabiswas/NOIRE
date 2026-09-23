/* views/status.js: the 404 page and the "something went wrong" page */
import { html, fragment, url } from '../utils.js';
import { HttpError } from '../api.js';

export function notFoundView(error) {
  const what = error?.what ?? 'page';
  const el = document.createElement('div');
  el.className = 'status';
  el.append(
    fragment(html`<p class="status__code">404</p>
      <h1>${what === 'page' ? 'Page not found' : `We could not find that ${what}`}</h1>
      <p>The address may be wrong, or the ${what} may no longer be available.</p>
      <div class="status__actions">
        <a class="button" href="${url('/')}" data-link>Back to the home page</a>
        <a class="button button--light" href="${url('/shop')}" data-link>Browse the collection</a>
      </div>`)
  );
  return { el };
}

export function errorView(error, retry) {
  const offline = error instanceof HttpError && error.status === 0;
  const el = document.createElement('div');
  el.className = 'status';
  el.append(
    fragment(html`<p class="status__code">${error instanceof HttpError && error.status ? error.status : 'Error'}</p>
      <h1>Something went wrong</h1>
      <p>${offline ? 'We could not reach the server. Check your connection and try again.' : 'We could not load this page. Please try again in a moment.'}</p>
      <div class="status__actions">
        <button class="button" type="button" data-action="retry">Try again</button>
        <a class="button button--light" href="${url('/')}" data-link>Back to the home page</a>
      </div>`)
  );
  el.querySelector('[data-action="retry"]').addEventListener('click', retry);
  return { el };
}
