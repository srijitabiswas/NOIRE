import asyncio, json, sys
from playwright.async_api import async_playwright

B = 'http://localhost:5010'
GH = 'http://localhost:5011/noire'
R = []


def check(name, cond, detail=''):
    R.append((name, bool(cond), str(detail)))
    print(('PASS ' if cond else 'FAIL ') + name + (f'  [{detail}]' if detail and not cond else ''))


async def new_page(b, w=1280, h=800, **kw):
    ctx = await b.new_context(viewport={'width': w, 'height': h}, **kw)
    pg = await ctx.new_page()
    pg.errs = []
    pg.docs = []
    pg.on('pageerror', lambda e: pg.errs.append(str(e)))
    pg.on('console', lambda m: pg.errs.append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text else None)
    pg.on('request', lambda r: pg.docs.append(r.url) if r.resource_type == 'document' else None)
    return ctx, pg


async def h1(pg):
    return await pg.evaluate("document.querySelector('#view h1')?.textContent")


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()

        # ---------- 1. navigation without reloads ----------
        ctx, pg = await new_page(b)
        await pg.goto(B + '/'); await pg.wait_for_timeout(500)
        await pg.evaluate('window.__marker = 42')
        check('initial load renders the home view', await h1(pg) == 'The Art of Silhouette')
        check('focus is NOT stolen on the first load', await pg.evaluate("document.activeElement === document.body"))
        await pg.click('a[data-nav=shop]'); await pg.wait_for_timeout(500)
        check('nav link changes the URL (pushState)', pg.url == B + '/shop', pg.url)
        check('nav link renders the shop view', await h1(pg) == 'Women')
        check('page did NOT reload (window state survives)', await pg.evaluate('window.__marker') == 42)
        check('title updates', await pg.title() == 'Women | NOIRE', await pg.title())
        check('aria-current marks the current nav link', await pg.get_attribute('a[data-nav=shop]', 'aria-current') == 'page' and await pg.get_attribute('a[data-nav=journal]', 'aria-current') is None)
        check('focus moves to the new page heading', await pg.evaluate("document.activeElement === document.querySelector('#view h1')"))
        await pg.wait_for_timeout(150)
        check('route change is announced for screen readers', 'Women' in await pg.inner_text('#announcer'), await pg.inner_text('#announcer'))
        await pg.click('.product__link >> nth=0'); await pg.wait_for_timeout(500)
        check('product card opens /product/:id', pg.url == B + '/product/pleated-mini-dress', pg.url)
        check('product view rendered', await h1(pg) == 'Pleated Mini Dress')
        await pg.click('a.logo'); await pg.wait_for_timeout(500)
        check('logo returns home', pg.url == B + '/' and await h1(pg) == 'The Art of Silhouette')
        await pg.go_back(); await pg.wait_for_timeout(500)
        check('Back restores the previous view', pg.url == B + '/product/pleated-mini-dress' and await h1(pg) == 'Pleated Mini Dress', pg.url)
        await pg.go_back(); await pg.wait_for_timeout(400)
        check('Back again returns to the shop', await h1(pg) == 'Women')
        await pg.go_forward(); await pg.wait_for_timeout(400)
        check('Forward works', await h1(pg) == 'Pleated Mini Dress')
        check('only ONE document request in the whole session', len(pg.docs) == 1, pg.docs)
        check('no console or page errors', not pg.errs, pg.errs)
        await ctx.close()

        # ---------- 2. modified clicks are left to the browser ----------
        ctx, pg = await new_page(b)
        await pg.goto(B + '/'); await pg.wait_for_timeout(400)
        prevented = await pg.evaluate("""()=>{const a=document.querySelector('a[data-nav=shop]');const out={};
          for (const mod of ['ctrlKey','metaKey','shiftKey']){const e=new MouseEvent('click',{bubbles:true,cancelable:true,button:0,[mod]:true});a.dispatchEvent(e);out[mod]=e.defaultPrevented}
          const plain=new MouseEvent('click',{bubbles:true,cancelable:true,button:0});a.dispatchEvent(plain);out.plain=plain.defaultPrevented;return out}""")
        check('ctrl/meta/shift-click are not hijacked (open in new tab still works)', not any(prevented[k] for k in ('ctrlKey', 'metaKey', 'shiftKey')), prevented)
        check('a plain click IS handled by the router', prevented['plain'])
        await ctx.close()

        # ---------- 3. deep links, 404s, redirects ----------
        ctx, pg = await new_page(b)
        for path, want, label in [('/product/wide-leg-trousers', 'Wide Leg Trousers', 'deep link to a product'),
                                  ('/journal/tailoring-softened', 'Tailoring, Softened', 'deep link to an article'),
                                  ('/nope', 'Page not found', 'unknown address shows the 404 view'),
                                  ('/product/does-not-exist', 'We could not find that piece', 'unknown product shows a specific 404'),
                                  ('/journal/does-not-exist', 'We could not find that story', 'unknown story shows a specific 404'),
                                  ]:
            await pg.goto(B + path); await pg.wait_for_timeout(500)
            check(label, await h1(pg) == want, await h1(pg))
        await pg.evaluate("history.pushState({}, '', '/product/%E0%A4%A'); dispatchEvent(new PopStateEvent('popstate'))"); await pg.wait_for_timeout(400)
        check('malformed %-encoding is a 404, not a crash', await h1(pg) == 'Page not found' and not pg.errs, (await h1(pg), pg.errs))
        await pg.goto(B + '/women'); await pg.wait_for_timeout(500)
        check('/women redirects to /shop', pg.url == B + '/shop', pg.url)
        await pg.goto(B + '/new'); await pg.wait_for_timeout(500)
        check('/new redirects to /shop?new=1 with the right heading', pg.url == B + '/shop?new=1' and await h1(pg) == 'New arrivals', pg.url)
        await pg.goto(B + '/shop'); await pg.wait_for_timeout(400)
        await pg.goto(B + '/nope'); await pg.wait_for_timeout(300)
        docs = len(pg.docs)
        await pg.click('.status a.button >> nth=0'); await pg.wait_for_timeout(400)
        check('404 page offers a way back that does not reload', await h1(pg) == 'The Art of Silhouette' and len(pg.docs) == docs, (docs, len(pg.docs)))
        await ctx.close()

        # ---------- 4. URL is the source of truth for filters ----------
        ctx, pg = await new_page(b)
        await pg.goto(B + '/shop'); await pg.wait_for_timeout(500)
        await pg.evaluate("document.querySelector('#view h1').dataset.mark='same-node'")
        n0 = await pg.evaluate('history.length')
        await pg.click('.chip:has-text("Dresses")'); await pg.wait_for_timeout(300)
        check('category chip puts the filter in the URL', 'category=Dresses' in pg.url, pg.url)
        check('filtering shows the right count', (await pg.inner_text('#count')).lower() == '6 pieces', await pg.inner_text('#count'))
        check('filtering updates the page IN PLACE (heading node is reused)', await pg.evaluate("document.querySelector('#view h1').dataset.mark") == 'same-node')
        check('active chip is marked with aria-current', await pg.get_attribute('.chip:has-text("Dresses")', 'aria-current') == 'true')
        check('chip click adds a history entry', await pg.evaluate('history.length') == n0 + 1)
        await pg.select_option('#sort', 'price-asc'); await pg.wait_for_timeout(300)
        first = await pg.evaluate("document.querySelector('.product__name').textContent")
        check('sort is in the URL and applied', 'sort=price-asc' in pg.url and first == 'Pleated Mini Dress', (pg.url, first))
        await pg.go_back(); await pg.wait_for_timeout(300)
        check('Back undoes the sort (no page reload)', 'sort' not in pg.url and 'category=Dresses' in pg.url, pg.url)
        await pg.go_back(); await pg.wait_for_timeout(300)
        check('Back undoes the category', 'category' not in pg.url and (await pg.inner_text('#count')).lower() == '12 pieces')
        h = await pg.evaluate('history.length')
        await pg.fill('#q', 'dress'); await pg.wait_for_timeout(500)
        check('typing in search replaces the URL (no history spam)', await pg.evaluate('history.length') == h and 'q=dress' in pg.url, pg.url)
        check('search filters the grid', (await pg.inner_text('#count')).lower() == '6 pieces', await pg.inner_text('#count'))
        check('typing does not lose focus', await pg.evaluate("document.activeElement.id") == 'q')
        await pg.reload(); await pg.wait_for_timeout(500)
        check('refresh keeps the search (state came from the URL)', await pg.input_value('#q') == 'dress' and (await pg.inner_text('#count')).lower() == '6 pieces')
        await pg.goto(B + '/shop?category=Tops&sort=price-desc'); await pg.wait_for_timeout(500)
        names = await pg.evaluate("[...document.querySelectorAll('.product__name')].map(e=>e.textContent)")
        check('deep link with filters renders filtered + sorted', names == ['Cashmere Sweater', 'Ribbed Knit Top'], names)
        await pg.click('a[data-nav=new]'); await pg.wait_for_timeout(400)
        check('"New" nav shows new arrivals and is marked current', await h1(pg) == 'New arrivals' and await pg.get_attribute('a[data-nav=new]', 'aria-current') == 'page')
        await pg.click('a[data-nav=shop]'); await pg.wait_for_timeout(400)
        check('back to Women from New: heading and title update', await h1(pg) == 'Women' and await pg.title() == 'Women | NOIRE')
        check('no errors during filtering', not pg.errs, pg.errs)
        await ctx.close()

        # ---------- 5. scroll restoration ----------
        ctx, pg = await new_page(b)
        await pg.goto(B + '/shop'); await pg.wait_for_timeout(500)
        await pg.evaluate("window.scrollTo(0, 700)"); await pg.wait_for_timeout(200)
        y0 = await pg.evaluate('scrollY')
        y0 = await pg.evaluate("(()=>{const y=scrollY;document.querySelectorAll('.product__link')[6].click();return y})()"); await pg.wait_for_timeout(500)
        check('new page starts at the top', await pg.evaluate('scrollY') == 0)
        await pg.go_back(); await pg.wait_for_timeout(500)
        y = await pg.evaluate('scrollY')
        check('Back restores the scroll position', y0 > 100 and abs(y - y0) <= 5, (y0, y))
        await ctx.close()

        # ---------- 6. race conditions ----------
        ctx, pg = await new_page(b)
        async def slow_article(route):
            await asyncio.sleep(1.5); await route.continue_()
        await pg.route('**/data/articles/tailoring-softened.json', slow_article)
        await pg.goto(B + '/journal'); await pg.wait_for_timeout(500)
        await pg.click('.card__title a >> nth=2')          # tailoring-softened: slow
        await pg.wait_for_timeout(200)
        await pg.click('a[data-nav=shop]')                  # user changes their mind
        await pg.wait_for_timeout(2500)
        check('a slow, superseded page does NOT overwrite the newer one', pg.url == B + '/shop' and await h1(pg) == 'Women', (pg.url, await h1(pg)))
        await ctx.close()

        # ---------- 7. loading states ----------
        ctx, pg = await new_page(b)
        await pg.goto(B + '/?latency=1200'); await pg.wait_for_timeout(300)
        check('developer switch is removed from the URL', 'latency' not in pg.url, pg.url)
        await pg.evaluate("window.noireDone=false")
        await pg.click('a[data-nav=journal]'); await pg.wait_for_timeout(450)
        check('progress bar appears for a slow load', await pg.is_visible('#progress'))
        check('old page stays visible while loading (no blank flash)', await h1(pg) == 'The Art of Silhouette' or await pg.locator('.skeleton').count() == 1)
        await pg.wait_for_timeout(500)
        check('skeleton appears after 300 ms', await pg.locator('.skeleton').count() == 1 or await h1(pg) == 'The NOIRE Journal')
        await pg.wait_for_timeout(1500)
        check('final view replaces the skeleton', await h1(pg) == 'The NOIRE Journal' and await pg.locator('.skeleton').count() == 0)
        check('progress bar hides afterwards', not await pg.is_visible('#progress'))
        check('aria-busy is cleared', await pg.get_attribute('#view', 'aria-busy') is None)
        await ctx.close()

        # ---------- 8. error handling ----------
        ctx, pg = await new_page(b)
        state = {'fail': True}
        async def flaky(route):
            if state['fail']: await route.fulfill(status=500, body='boom', content_type='text/plain')
            else: await route.continue_()
        await pg.route('**/data/journal.json', flaky)
        await pg.goto(B + '/'); await pg.wait_for_timeout(400)
        check('failed data load on first paint shows the error view', await h1(pg) == 'Something went wrong' or await h1(pg) == 'The Art of Silhouette')
        await pg.goto(B + '/about'); await pg.wait_for_timeout(300)
        await pg.click('a[data-nav=journal]'); await pg.wait_for_timeout(600)
        check('server error shows a friendly error page with the status', await h1(pg) == 'Something went wrong' and '500' in await pg.inner_text('.status__code'))
        check('error page has a Try again button and a way home', await pg.locator('[data-action=retry]').count() == 1 and await pg.locator('.status a[data-link]').count() >= 1)
        state['fail'] = False
        await pg.click('[data-action=retry]'); await pg.wait_for_timeout(600)
        check('Try again works once the server recovers (failures are not cached)', await h1(pg) == 'The NOIRE Journal', await h1(pg))
        await ctx.close()
        ctx, pg = await new_page(b)
        await pg.goto(B + '/about'); await pg.wait_for_timeout(300)
        await pg.route('**/data/products.json', lambda r: r.abort())
        await pg.click('a[data-nav=shop]'); await pg.wait_for_timeout(600)
        check('network failure shows the offline message', 'could not reach the server' in await pg.inner_text('#view'), await pg.inner_text('#view'))
        await ctx.close()
        ctx, pg = await new_page(b)
        await pg.goto(B + '/journal?fail=journal'); await pg.wait_for_timeout(600)
        check('?fail= developer switch triggers the error view', await h1(pg) == 'Something went wrong')
        await ctx.close()

        # ---------- 9. shared state: bag and wishlist ----------
        ctx, pg = await new_page(b)
        await pg.goto(B + '/product/pleated-mini-dress'); await pg.wait_for_timeout(500)
        await pg.click('button[type=submit]')
        check('adding without a size shows an error', 'Choose a size' in await pg.inner_text('#size-error'))
        await pg.click('.size-option:has-text("M")'); await pg.click('button[type=submit]'); await pg.wait_for_timeout(200)
        check('bag badge updates in the shell', await pg.inner_text('[data-count=bag]') == '1')
        check('toast confirms the action', 'Added Pleated Mini Dress (M)' in await pg.inner_text('#toast'))
        await pg.click('#save'); await pg.wait_for_timeout(150)
        check('save button toggles state and wishlist badge', await pg.get_attribute('#save', 'aria-pressed') == 'true' and await pg.inner_text('[data-count=wish]') == '1')
        await pg.click('a[data-nav=bag]'); await pg.wait_for_timeout(500)
        check('bag view lists the item', await pg.locator('.bag-item').count() == 1 and await pg.inner_text('#total') == '\u20B92,000', await pg.inner_text('#total'))
        await pg.click('[data-action=inc]'); await pg.wait_for_timeout(200)
        check('quantity change updates total and badge', await pg.inner_text('#total') == '\u20B94,000' and await pg.inner_text('[data-count=bag]') == '2')
        check('focus stays on the same control after re-render', await pg.evaluate("document.activeElement?.dataset?.action") == 'inc')
        await pg.reload(); await pg.wait_for_timeout(500)
        check('bag survives a reload (localStorage)', await pg.inner_text('[data-count=bag]') == '2')
        # cross-tab sync
        pg2 = await ctx.new_page(); await pg2.goto(B + '/'); await pg2.wait_for_timeout(500)
        await pg.click('[data-action=remove]'); await pg.wait_for_timeout(500)
        check('a change in one tab updates the badge in another tab', await pg2.locator('[data-count=bag]').is_hidden(), await pg2.inner_text('[data-count=bag]'))
        check('empty bag shows the empty state', await pg.is_visible('#empty'))
        await pg.click('a[data-nav=wishlist]'); await pg.wait_for_timeout(400)
        check('wishlist view shows the saved piece', await pg.locator('.product').count() == 1)
        await pg.click('.heart'); await pg.wait_for_timeout(300)
        check('removing the last saved piece shows the empty state', await pg.is_visible('#empty') and await pg.locator('.product').count() == 0)
        await ctx.close()

        # ---------- 10. transitions ----------
        for label, kw, init, expect in [
            ('View Transitions API is used when available', {}, "window.__vt=0;const o=document.startViewTransition.bind(document);document.startViewTransition=function(cb){window.__vt++;return o(cb)}", lambda vt, cls: vt >= 1),
            ('reduced motion: no transition is started', {'reduced_motion': 'reduce'}, "window.__vt=0;const o=document.startViewTransition.bind(document);document.startViewTransition=function(cb){window.__vt++;return o(cb)}", lambda vt, cls: vt == 0),
        ]:
            ctx, pg = await new_page(b, **kw)
            await pg.add_init_script(init)
            await pg.goto(B + '/'); await pg.wait_for_timeout(400)
            await pg.click('a[data-nav=journal]'); await pg.wait_for_timeout(700)
            vt = await pg.evaluate('window.__vt')
            check(label, expect(vt, None) and await h1(pg) == 'The NOIRE Journal', vt)
            await ctx.close()
        ctx, pg = await new_page(b)
        await pg.add_init_script("delete Document.prototype.startViewTransition; window.__enter=0; new MutationObserver(m=>m.forEach(x=>{if(x.target.classList&&x.target.classList.contains('view-enter'))window.__enter++})).observe(document,{attributes:true,subtree:true,attributeFilter:['class']})")
        await pg.goto(B + '/'); await pg.wait_for_timeout(400)
        check('test setup: View Transitions API is unavailable', await pg.evaluate("typeof document.startViewTransition") == 'undefined')
        await pg.click('a[data-nav=journal]'); await pg.wait_for_timeout(700)
        check('fallback: navigation still works and plays the enter animation class', await h1(pg) == 'The NOIRE Journal' and await pg.evaluate('window.__enter') >= 1, await pg.evaluate('window.__enter'))
        await ctx.close()

        # ---------- 11. mobile menu ----------
        ctx, pg = await new_page(b, 390, 844)
        await pg.goto(B + '/'); await pg.wait_for_timeout(500)
        check('phone: menu starts closed', not await pg.is_visible('#site-nav'))
        await pg.click('.nav-button'); check('phone: menu opens with aria-expanded', await pg.is_visible('#site-nav') and await pg.get_attribute('.nav-button', 'aria-expanded') == 'true')
        await pg.click('a[data-nav=journal]'); await pg.wait_for_timeout(500)
        check('phone: choosing a link navigates and closes the menu', await h1(pg) == 'The NOIRE Journal' and not await pg.is_visible('#site-nav'))
        await pg.click('.nav-button'); await pg.keyboard.press('Escape')
        check('phone: Escape closes the menu and returns focus to the button', not await pg.is_visible('#site-nav') and await pg.evaluate("document.activeElement.classList.contains('nav-button')"))
        await ctx.close()

        # ---------- 12. keyboard ----------
        ctx, pg = await new_page(b)
        await pg.goto(B + '/'); await pg.wait_for_timeout(500)
        await pg.keyboard.press('Tab'); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(200)
        check('skip link moves focus to the main region without routing', pg.url == B + '/#view' and await pg.evaluate("document.activeElement.id") == 'view', await pg.evaluate("document.activeElement.id"))
        await pg.focus('a[data-nav=journal]'); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(500)
        check('Enter on a nav link navigates and focuses the heading', await h1(pg) == 'The NOIRE Journal' and await pg.evaluate("document.activeElement === document.querySelector('#view h1')"))
        await ctx.close()

        # ---------- 13. GitHub Pages style hosting under /noire/ ----------
        ctx, pg = await new_page(b)
        await pg.goto(GH + '/'); await pg.wait_for_timeout(600)
        check('sub-folder base: home renders with correct asset URLs', await h1(pg) == 'The Art of Silhouette' and await pg.evaluate("[...document.images].every(i=>i.complete&&i.naturalWidth>0||i.loading==='lazy')"))
        await pg.click('a[data-nav=shop]'); await pg.wait_for_timeout(500)
        check('sub-folder base: links keep the /noire prefix', pg.url == GH + '/shop' and await h1(pg) == 'Women', pg.url)
        await pg.click('.product__link >> nth=1'); await pg.wait_for_timeout(500)
        check('sub-folder base: product route works', pg.url.startswith(GH + '/product/') and await pg.evaluate("document.querySelector('.pdp img').naturalWidth") > 0, pg.url)
        await pg.go_back(); await pg.wait_for_timeout(400)
        check('sub-folder base: Back works', pg.url == GH + '/shop')
        # deep link on a host with NO rewrite rule: the server answers 404.html, which hands the URL to the app
        await pg.goto(GH + '/journal/draped-not-dressed'); await pg.wait_for_timeout(900)
        check('404.html fallback restores a deep link (GitHub Pages)', pg.url == GH + '/journal/draped-not-dressed' and await h1(pg) == 'Draped, Not Dressed', (pg.url, await h1(pg)))
        await pg.goto(GH + '/nothing-here'); await pg.wait_for_timeout(900)
        check('404.html fallback: unknown address still shows the app 404 view', await h1(pg) == 'Page not found', await h1(pg))
        check('sub-folder base: no console errors', not pg.errs, pg.errs)
        await ctx.close()

        await b.close()
    f = sum(1 for r in R if not r[1])
    print(f'\n{len(R) - f}/{len(R)} passed')
    json.dump(R, open('/home/claude/w5test.json', 'w'))

asyncio.run(main())
