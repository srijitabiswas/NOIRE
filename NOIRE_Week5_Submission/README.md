# NOIRE, Week 5: single page application

A small fashion storefront built as a **single page application (SPA)** with plain HTML, CSS and JavaScript
(native ES modules, no framework, no build step). The header and footer stay in place; only the middle of the
page (`#view`) changes when you navigate, and the address bar, Back and Forward buttons keep working.

## Run it
An SPA needs a small web server (browsers do not allow ES modules or `fetch` from `file://`), and the server must
send every unknown address to `index.html` so that deep links like `/product/pleated-mini-dress` work after a refresh.

```
npm install
npm run dev          # serves the folder on http://localhost:3000 with that rule ("serve -s")
```

## Routes
| Address | View | Loads |
|---|---|---|
| `/` | Home | products, journal |
| `/shop` | Women (`?category=`, `?sort=`, `?q=`, `?new=1`) | products |
| `/product/:id` | One product (unknown id gives a 404 view) | products |
| `/journal` | Story list | journal |
| `/journal/:slug` | One story (`data/articles/<slug>.json`) | article, journal, products |
| `/wishlist`, `/bag` | Saved pieces, bag | products + saved state |
| `/about` | Static page | nothing |
| `/women`, `/new`, `/story` | Redirects to `/shop`, `/shop?new=1`, `/about` | |
| anything else | 404 view | |

## Folder structure
```
index.html          the shell: header, #view, footer, live regions
404.html            fallback for hosts without rewrite rules (GitHub Pages)
css/                tokens, base (shell), components, views, transitions
js/
  main.js           start-up: wires the shell to the router and store
  router.js         History API routing, loading, errors, focus, scroll, transitions
  routes.js         the route table
  store.js          shared state (bag, wishlist), localStorage + tab sync
  api.js            JSON loading with cache and error types
  utils.js          html`` safe templates, URL and image helpers
  toast.js
  views/            one module per page (home, shop, product, journal, wishlist, bag, about, status, skeleton, shared)
data/               products.json, journal.json, articles/*.json
images/  fonts/     assets (AVIF, WebP, JPEG; subset woff2)
```

## Developer switches (to demo loading and error states)
Add these to any address once; they are remembered for the tab and removed from the URL.
- `?latency=1200` adds 1.2 s to every data request (shows the progress bar and skeleton)
- `?fail=journal` makes any request whose path contains "journal" fail with a 503 (shows the error view)
- `?latency=0` and `?fail=` turn them off

## Deploying to GitHub Pages (or any sub-folder)
1. In `index.html` **and** `404.html` change `<base href="/">` to `<base href="/your-repo-name/">`.
2. Publish the folder. Unknown addresses are served by `404.html`, which hands the address back to the app.

## Add a page
1. Create `js/views/mypage.js` exporting a route `{ path, name, nav, title, load, render }`.
2. Add it to `js/routes.js`, and add a `data-link` anchor to it.

## Checks
`npm run lint` runs html-validate, stylelint and ESLint. The report (NOIRE_Week5_Report.docx) describes the 89 automated
browser tests, the axe-core and Lighthouse results, and the design decisions.
