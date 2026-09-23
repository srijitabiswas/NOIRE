/* views/about.js: a static page. It has no load() step, so it appears immediately. */
import { html, fragment } from '../utils.js';
import { pageShell } from './shared.js';

export const aboutRoute = {
  path: '/about',
  name: 'About',
  nav: 'about',
  title: () => 'Our story',
  render() {
    const el = pageShell('page page--narrow about');
    el.append(
      fragment(html`
        <h1 class="page__title">Our story</h1>
        <p>NOIRE is a fashion label built around one idea: the shape of a garment should feel calm and certain. We design a small number of pieces each season and make them to last.</p>
        <p>This site is a demonstration storefront. It shows a single page application: the header and footer stay in place while each page loads into the middle of the screen, and the address bar and Back button keep working as you browse.</p>
        <p>Nothing here is for sale, and no orders are placed.</p>`)
    );
    return { el };
  }
};
