/* routes.js: the route table. To add a page, write a view module and add one line here. */
import { homeRoute } from './views/home.js';
import { shopRoute } from './views/shop.js';
import { productRoute } from './views/product.js';
import { journalRoute, articleRoute } from './views/journal.js';
import { wishlistRoute } from './views/wishlist.js';
import { bagRoute } from './views/bag.js';
import { aboutRoute } from './views/about.js';

export const routes = [
  homeRoute,
  shopRoute,
  productRoute,
  journalRoute,
  articleRoute,
  wishlistRoute,
  bagRoute,
  aboutRoute,
  /* old or alternative addresses forward to the real page without adding a history entry */
  { path: '/women', redirect: () => '/shop' },
  { path: '/new', redirect: () => '/shop?new=1' },
  { path: '/story', redirect: () => '/about' }
];
