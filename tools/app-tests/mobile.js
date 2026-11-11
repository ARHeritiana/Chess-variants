/* Run with Playwright installed and the static app served on localhost:8000. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
 const page=await browser.newPage({viewport:{width:360,height:800},deviceScaleFactor:3,hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.APP_URL||'http://127.0.0.1:8000');
 await page.evaluate(()=>{vsAI=false;newGame()});
 const match=async(text,fen)=>page.evaluate(({text,fen})=>{if(fen)newGame(fen);return voiceMatches(s,moves,text).map(m=>san(s,m,moves))},{text,fen});
 assert.deepEqual(await match('e two to e four'),['e4']);
 assert.deepEqual(await match('knight to f three'),['Nf3']);
 assert.deepEqual(await match('Nf3'),['Nf3']);
 assert.deepEqual(await match('pawn to e5'),[]);
 assert.deepEqual(await match('castle kingside','r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1'),['O-O']);
 assert.deepEqual(await match('a seven to a eight promote to knight','7k/P7/8/8/8/8/8/7K w - - 0 1'),['a8=N']);
 assert.equal((await match('knight to d two','7k/8/8/8/8/8/8/1N2KN2 w - - 0 1')).length,2);
 await page.evaluate(()=>newGame());await page.click('#voiceStart');
 await page.evaluate(()=>window.__voiceResult(['e2 to e4']));
 assert.equal(await page.evaluate(()=>sans.length),0);
 await page.click('#voiceChoices button');
 assert.equal(await page.evaluate(()=>sans.join(' ')),'e4');
 await page.click('#voiceStart');await page.evaluate(()=>{doMove(moves[0]);window.__voiceResult(['knight f3'])});
 assert.equal(await page.locator('#voiceChoices button').count(),0);
 await page.evaluate(()=>{
  voiceCancel();importGame('1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# 1-0');RV.q=0;RV.eng='sf';openReview();
 });
 await page.waitForFunction(()=>RV.data!=null,{},{timeout:30000});
 assert.equal(await page.locator('.rvnote').count(),7);
 assert.match(await page.locator('#rvNotes').textContent(),/checkmate/i);
 const geometry=async id=>page.evaluate(id=>{const c=document.getElementById(id),b=c.getBoundingClientRect();return{width:b.width,height:b.height,pixels:c.width,pixelHeight:c.height,dpr:devicePixelRatio,touch:getComputedStyle(c).touchAction}},id);
 for(const [width,height] of [[280,640],[320,568],[360,800],[390,844],[412,915],[640,360],[844,390],[768,1024]]){
  await page.setViewportSize({width,height});
  for(const theme of ['classic','heritage','modern','neon']){
   await page.evaluate(theme=>{themeCore(theme);rvStage('sum');viewTo(0)},theme);
   await page.waitForTimeout(80);
   const check=async()=>{
    const dimensions=await page.evaluate(()=>({viewport:innerWidth,scroll:document.documentElement.scrollWidth,body:document.body.scrollWidth}));
    assert.ok(dimensions.scroll<=width&&dimensions.body<=width,JSON.stringify({width,height,theme,...dimensions}));
   };
   await check();
   const g=await geometry('rvG');assert.equal(g.height,80);assert.ok(Math.abs(g.pixels-g.width*3)<=1);assert.equal(g.touch,'pan-y');
   await page.evaluate(()=>{rvStage('walk');viewTo(3)});await page.waitForTimeout(30);
   const g2=await geometry('rvG2');assert.equal(g2.height,80);assert.ok(Math.abs(g2.pixelHeight-240)<=1);
   await check();
   for(const tab of ['new','game','lib','set']){await page.evaluate(tab=>openMenu(tab),tab);await page.waitForTimeout(10);await check()}
   await page.evaluate(()=>closeMenu());
  }
 }
 await page.setViewportSize({width:360,height:800});
 await page.evaluate(()=>{rvStage('walk');viewTo(0);rvJump(1)});
 assert.ok(await page.evaluate(()=>RV.i>0));
 await page.locator('#rvG2').scrollIntoViewIfNeeded();
 const chartBox=await page.locator('#rvG2').boundingBox(),scrollBefore=await page.evaluate(()=>scrollY);
 const cdp=await page.context().newCDPSession(page);
 const point={x:chartBox.x+chartBox.width/2,y:chartBox.y+chartBox.height/2};
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});
 for(let i=1;i<=10;i++){
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:point.x,y:point.y+i*15}]});
  await page.waitForTimeout(30);
 }
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await page.waitForTimeout(300);
 assert.ok(await page.evaluate(()=>scrollY)<scrollBefore,'vertical swiping on graph must scroll page');
 await page.screenshot({path:'/tmp/chess-review-mobile.png',fullPage:true});
 await page.evaluate(()=>{closeReview();mode='cyl';newGame()});
 assert.equal(await page.locator('#rv').isVisible(),false);
 assert.equal(await page.evaluate(()=>RV.on),false);
 assert.equal(await page.evaluate(()=>canPlay()),true);
 const comments=await page.evaluate(()=>{
  mode='flat';
  const test=(fen,token)=>{
   newGame(fen);const before=s,m=moveFromToken(s,moves,token);if(!m)throw new Error('invalid fixture '+token);
   doMove(m);RV.POS=[before,s];RV.MV=mlog.slice();RV.data={ev:[50,50],loss:[0],cls:[0],best:[m],ex:[{},{}]};return rvComment(0);
  };
  return {
   castle:test('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1','O-O'),
   passant:test('7k/8/8/8/3Pp3/8/8/7K b - d3 0 1','e4d3'),
   promotion:test('7k/P7/8/8/8/8/8/7K w - - 0 1','a7a8n'),
   development:test(START,'Nf3')
  };
 });
 assert.match(comments.castle,/castles/);assert.match(comments.passant,/en passant/);
 assert.match(comments.promotion,/promotes to a knight/);assert.match(comments.development,/develops the knight/);
 await page.evaluate(()=>{window.__updateAvailable({version_name:'2.2'});});
 assert.equal(await page.locator('#updateNotice').isVisible(),true);await page.click('#updateLater');
 assert.equal(await page.locator('#updateNotice').isVisible(),false);
 assert.deepEqual(errors,[]);
 console.log('PASS: speech parsing/confirmation, real Stockfish review, key moments, chart DPR, 32 viewport/theme combinations and menu tabs, review → Cylinder cleanup.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
