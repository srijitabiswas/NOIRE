/* views/journal.js: the story list (/journal) and a single story (/journal/:slug).
   Each story is its own JSON file, fetched only when it is opened. */
import { getJournal, getArticle, getProducts } from '../api.js';
import { html, fragment, url, picture, formatDate } from '../utils.js';
import { journalCard, productCard, bindWishlist, pageShell } from './shared.js';
import { gridSkeleton } from './skeleton.js';

export const journalRoute = {
  path: '/journal',
  name: 'Journal',
  nav: 'journal',
  title: () => 'Journal',
  load: () => getJournal(),
  prefetch: () => getJournal(),
  skeleton: gridSkeleton,
  render(articles) {
    const el = pageShell();
    el.append(
      fragment(html`
        <h1 class="page__title">The NOIRE Journal</h1>
        <p class="meta lede">Notes from the studio on silhouette, fabric and getting dressed.</p>
        <h2 class="visually-hidden">Stories</h2>
        <ul class="journal-grid">${articles.map(journalCard)}</ul>`)
    );
    return { el };
  }
};

const block = (b) => {
  if (b.type === 'h2') return html`<h2>${b.text}</h2>`;
  if (b.type === 'quote') return html`<blockquote>${b.text}</blockquote>`;
  return html`<p>${b.text}</p>`;
};

export const articleRoute = {
  path: '/journal/:slug',
  name: 'Story',
  nav: 'journal',
  title: ([article]) => article.title,
  load: ({ params }) => Promise.all([getArticle(params.slug), getJournal(), getProducts()]),
  prefetch: ({ slug }) => getArticle(slug),
  skeleton: gridSkeleton,
  render([article, articles, products], ctx) {
    const picks = article.products.map((id) => products.find((p) => p.id === id)).filter(Boolean);
    const index = articles.findIndex((a) => a.slug === article.slug);
    const next = articles[(index + 1) % articles.length];
    const el = pageShell();
    el.append(
      fragment(html`
        <nav class="breadcrumb" aria-label="Breadcrumb">
          <ol>
            <li><a href="${url('/')}" data-link>Home</a></li>
            <li><a href="${url('/journal')}" data-link>Journal</a></li>
            <li aria-current="page">${article.title}</li>
          </ol>
        </nav>
        <article>
          <header class="article__head">
            <p class="eyebrow">${formatDate(article.date)} &middot; ${article.readMinutes} min read</p>
            <h1>${article.title}</h1>
          </header>
          <div class="article__hero">${picture({ base: article.image.base, widths: article.image.widths, alt: article.image.alt, sizes: '(min-width: 90em) 1400px, 100vw', width: article.image.ratio[0], height: article.image.ratio[1], lazy: false, priority: true })}</div>
          <div class="prose">${article.body.map(block)}</div>
        </article>
        <section class="section section--flush" aria-labelledby="pieces-title">
          <div class="section__head"><h2 id="pieces-title">Pieces from this story</h2></div>
          <ul class="product-grid">${picks.map((p) => productCard(p))}</ul>
        </section>
        <div class="article__foot">
          <a class="link" href="${url('/journal')}" data-link><span aria-hidden="true">&larr;</span> All stories</a>
          <a class="link" href="${url(`/journal/${next.slug}`)}" data-link>Next: ${next.title} <span aria-hidden="true">&rarr;</span></a>
        </div>`)
    );
    bindWishlist(el, ctx);
    return { el };
  }
};
