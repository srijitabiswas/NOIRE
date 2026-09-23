# NOIRE, Week 4: performance and accessibility

The Week 3 collection page, audited and optimised. `src/` is the readable source; `dist/` is the production build.

## Run it
- Open `dist/index.html` in a browser, or run `npm install && npm run serve` and visit the printed address.
- Edit the files in `src/`, then run `npm run build` to regenerate `dist/`.

## Folders
| Path | What it is |
|---|---|
| `src/index.html` | Semantic, accessible page structure |
| `src/css/critical.css` | Above-the-fold CSS (inlined into the HTML by the build) |
| `src/css/style.css` | Everything else (loaded without blocking rendering) |
| `src/js/main.js` | Behaviour from Week 3, with accessibility updates |
| `src/fonts/` | Self-hosted, subset Ubuntu Sans (woff2) |
| `src/images/` | Every image in AVIF, WebP and JPEG, at several widths |
| `build.mjs` | Minifies CSS/JS/HTML, inlines critical CSS, hashes file names, writes `_headers` |
| `dist/` | Production build |

## Scripts
- `npm run build` builds `dist/`.
- `npm run lint` runs html-validate, stylelint and ESLint on the sources.
- `npm run check` runs lint, build, then validates the built HTML.

## Results (Lighthouse, mobile, median of 3 runs)
| | Week 3 | Week 4 |
|---|---|---|
| Performance / Accessibility / Best practices / SEO | 99 / 100 / 96 / 100 | 99 / 100 / 100 / 100 |
| First Contentful Paint | 1.39 s | 0.77 s |
| Cumulative Layout Shift | 0.016 | 0 |
| Transfer size | 190 KiB | 121 KiB |
| axe-core violations across 15 page states | 7 states with 1 violation | 0 |

See the report (NOIRE_Week4_Report.docx) for the full analysis, the trade-offs (Total Blocking Time went up in Lighthouse's simulation) and what was not tested.
