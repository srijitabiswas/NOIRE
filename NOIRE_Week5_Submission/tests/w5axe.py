import asyncio, json
from playwright.async_api import async_playwright
B='http://localhost:5010'
AXE=open('/home/claude/w4tools/node_modules/axe-core/axe.min.js').read()
TAGS=['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa','best-practice']
async def run(pg,label,res):
    await pg.add_script_tag(content=AXE)
    r=await pg.evaluate("async(tags)=>await axe.run(document,{runOnly:{type:'tag',values:tags}})",TAGS)
    v=[{'id':x['id'],'impact':x['impact'],'nodes':len(x['nodes']),'targets':[n['target'][-1] for n in x['nodes']][:3]} for x in r['violations']]
    res[label]={'violations':v,'incomplete':[i['id'] for i in r['incomplete']],'passes':len(r['passes'])}
    print(f"[{label}] violations={len(v)} incomplete={res[label]['incomplete']} passes={len(r['passes'])}", [(x['id'],x['nodes'],x['targets']) for x in v])
async def main():
    res={}
    async with async_playwright() as p:
        b=await p.chromium.launch()
        for name,w,h in (('desktop',1280,800),('phone',390,844)):
            ctx=await b.new_context(viewport={'width':w,'height':h},reduced_motion='reduce'); pg=await ctx.new_page()
            await pg.goto(B+'/'); await pg.wait_for_timeout(500)
            # seed store so bag/wishlist have content
            await pg.goto(B+'/product/pleated-mini-dress'); await pg.wait_for_timeout(500)
            await pg.click('.size-option:has-text("M")'); await pg.click('button[type=submit]'); await pg.click('#save'); await pg.wait_for_timeout(300)
            for path in ['/','/shop','/shop?category=Dresses&sort=price-asc','/shop?q=zzzz','/product/pleated-mini-dress','/product/leather-shoulder-bag','/journal','/journal/draped-not-dressed','/wishlist','/bag','/about','/nope']:
                await pg.goto(B+path); await pg.wait_for_timeout(700); await run(pg,f'{name} {path}',res)
            if name=='phone':
                await pg.goto(B+'/'); await pg.wait_for_timeout(400); await pg.click('.nav-button'); await pg.wait_for_timeout(200); await run(pg,'phone menu open',res)
            await ctx.close()
        ctx=await b.new_context(viewport={'width':1280,'height':800},reduced_motion='reduce'); pg=await ctx.new_page()
        await pg.goto(B+'/journal?fail=journal'); await pg.wait_for_timeout(600); await run(pg,'desktop error view',res)
        await pg.goto(B+'/?latency=2500'); await pg.wait_for_timeout(300)
        await pg.click('a[data-nav=shop]'); await pg.wait_for_timeout(700); await run(pg,'desktop skeleton view',res)
        await ctx.close(); await b.close()
    tot=sum(len(v['violations']) for v in res.values()); print('TOTAL states:',len(res),'| total violations:',tot)
    json.dump(res,open('/home/claude/w5_axe.json','w'),indent=1)
asyncio.run(main())
