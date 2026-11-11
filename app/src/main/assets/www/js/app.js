
const S=560,P=28,C=(S-2*P)/8;
const cv=document.getElementById('cv'),ctx=cv.getContext('2d');
let DPR=Math.min(2,Math.max(1,window.devicePixelRatio||1));cv.width=cv.height=Math.round(S*DPR);ctx.setTransform(DPR,0,0,DPR,0,0);
/* keep the canvas sharp at any board size: backing store = on-screen size x device pixel ratio (the board is drawn on a 560-unit grid) */
function fitCanvas(){
 const r=cv.getBoundingClientRect();if(!r.width)return;
 const d=Math.min(3.2,Math.max(1,r.width*(window.devicePixelRatio||1)/S));
 if(Math.abs(d-DPR)<.04)return;
 DPR=d;cv.width=cv.height=Math.round(S*DPR);BGC=null;if(typeof s!=='undefined'&&s)draw();
}
const MODES={
 flat:{name:'Classical',info:'The ordinary board: all four edges are walls.'},
 bs:{name:'Bounce · sides',info:'Diagonal slides (bishop, queen) bounce off the a- and h-file walls and keep going, like a billiard ball. Top and bottom stay walls. A slide ends if it comes back to its start square.'},
 ba:{name:'Bounce · all walls',info:'Diagonal slides (bishop, queen) bounce off all four edges, like a billiard ball. A slide ends if it comes back to its start square. Rooks and other pieces move as usual.'},
 cyl:{name:'Cylinder',info:'The a- and h-files are glued straight: pieces slide, jump and capture across that seam. Top and bottom stay walls.'}
};
let mode='flat',s,sel=null,moves=[],over=false,pend=null,hist={},vsAI=true,blv=3,mlv=1500,slv=0,mlog=[],busy=false,last=null,sans=[],caps=[],side='w',hw=true,FLP=false,KI=-1,showHints=true,prevSt='',snd=true,flipT=false,flipP=false,keep=true,mate=false,bn=true;
try{showHints=localStorage.getItem('cos_hints')!=='0';snd=localStorage.getItem('cos_snd')!=='0';flipT=localStorage.getItem('cos_flip')==='1';keep=localStorage.getItem('cos_wake')!=='0';flipP=localStorage.getItem('cos_fp')==='1'}catch(e){}

function step(x,y,dx,dy){
 let nx=x+dx,ny=y+dy,f=1;
 if(nx<0||nx>7){if(mode!=='cyl')return null;nx=(nx+8)%8}
 if(ny<0||ny>7)return null;
 return [nx,ny,f];
}
const MAIAS=['m1100','m1500','m1900'],SFIDS=['s1500','s2000','s2500','s3190'],BIDS=['b1','b3','b10','b30'],LAST={m:'m1500',s:'s2000',b:'b3'},
 oid=()=>slv?'s'+slv:mlv?'m'+mlv:'b'+blv,
 setOpp=o=>{mlv=slv=0;if(o[0]==='m')mlv=+o.slice(1);else if(o[0]==='s')slv=+o.slice(1);else blv=BIDS.includes(o)?+o.slice(1):3},
 engOf=o=>o==='h'?'h':o[0]==='m'?'m':o[0]==='s'?'s':'b';
const tcl=(m,i)=>(m%1?m:m|0)+' | '+i,TCS=[[0,0,'No clock'],[5,0,'5 | 0']];
let tc=0,clk=[0,0],tk=Date.now(),snaps=[],mf=false,viewI=-1,HINT=null,startFen='',startPly=0,autoQ=false,coords=true,archived=false,hintBusy=false;
try{autoQ=localStorage.getItem('cos_aq')==='1';coords=localStorage.getItem('cos_crd')!=='0'}catch(e){}
try{const v=JSON.parse(localStorage.getItem('cos_tcv')||'null');if(v)TCS[1]=[v[0],v[1],tcl(v[0],v[1])];tc=+localStorage.getItem('cos_tc2')===1?1:0}catch(e){}
const fmt=ms=>ms>0&&ms<20000?(ms/1000).toFixed(1):((Math.ceil(Math.max(0,ms)/1000)/60|0)+':'+String(Math.ceil(Math.max(0,ms)/1000)%60).padStart(2,'0'));
function tickClock(){const n=Date.now(),d=n-tk;tk=n;if(!TCS[tc][0]||over||sans.length<1||(typeof RV!=='undefined'&&RV.on))return;const i=s.t==='w'?0:1;clk[i]-=d;if(clk[i]<=0){clk[i]=0;const w=i===0;end((w?'White':'Black')+' ran out of time \u2014 '+(w?'Black':'White')+' wins')}}
function updClk(){for(const c of['w','b']){const e=document.getElementById('clk_'+c);if(!e)continue;const i=c==='w'?0:1;e.textContent=fmt(clk[i]);e.classList.toggle('act',!over&&s.t===c&&sans.length>=1);e.classList.toggle('low',clk[i]<20000)}}
setInterval(()=>{tickClock();updClk()},100);
/* the WebView freezes timers while the app is in the background: don't charge that time to the player on move */
window.__resume=()=>{tk=Date.now()};
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')tk=Date.now()});
function undo(){
 if(busy||!snaps.length)return;
 let sn;do{sn=snaps.pop()}while(vsAI&&snaps.length&&sn.s.t!==(hw?'w':'b'));
 ANIM=null;viewI=-1;HINT=null;s=sn.s;hist=sn.h;gameH=sn.g;last=sn.l;sans.length=sn.n;mlog.length=sn.n;caps.length=sn.c;clk=sn.k;tk=Date.now();
 over=false;sel=null;pend=null;hidePromo();moves=legal(s);hist[posKey()]--;status();draw();sfx('move');maybeAI();
}
function fen(){let r=[];for(let y=0;y<8;y++){let t='',n=0;for(let x=0;x<8;x++){const p=s.b[y*8+x];if(p){if(n)t+=n;n=0;t+=p}else n++}if(n)t+=n;r.push(t)}return r.join('/')+' '+s.t+' '+(s.c||'-')+' '+(s.ep?'abcdefgh'[s.ep.sq[0]]+(8-s.ep.sq[1]):'-')+' '+s.hm+' '+(((sans.length+startPly)>>1)+1)}
function resText(){return typeof RV!=='undefined'&&RV.on&&RV.saved?RV.saved.txt:document.getElementById('st').textContent}
function pgn(){const t=resText(),res=over?(/White wins/.test(t)?'1-0':/Black wins/.test(t)?'0-1':'1/2-1/2'):'*',d=new Date(),H=(k,v)=>'['+k+' "'+v+'"]\n',ai=mlv?'Maia '+mlv:slv?'Stockfish'+(slv<3190?' ('+slv+')':''):'Built-in engine ('+blv+' s)';
 let o=H('Event','Chess Variants')+H('Site','?')+H('Date',d.getFullYear()+'.'+String(d.getMonth()+1).padStart(2,'0')+'.'+String(d.getDate()).padStart(2,'0'))+H('White',vsAI?(hw?'You':ai):'White')+H('Black',vsAI?(hw?ai:'You'):'Black')+H('Result',res);
 if(startFen)o+=H('SetUp','1')+H('FEN',startFen);if(mode!=='flat')o+=H('Variant',MODES[mode].name);if(TCS[tc][0])o+=H('TimeControl',TCS[tc][0]*60+(TCS[tc][1]?'+'+TCS[tc][1]:''));
 let m='';for(let i=0;i<sans.length;i++){const pl=i+startPly;m+=(pl%2?(i?'':((pl>>1)+1)+'... '):((pl>>1)+1)+'. ')+sans[i]+' '}return o+'\n'+m+res}
let sM=mode,sO=vsAI?oid():'h',sS=side,sT=tc,sMin=TCS[1][0],sInc=TCS[1][1],hapt=true,lastTab='set';
try{hapt=localStorage.getItem('cos_hap')!=='0';lastTab=localStorage.getItem('cos_tab')||'set';
 const j=JSON.parse(localStorage.getItem('cos_new')||'null');
 if(j){if(MODES[j.m])sM=j.m;if(/^[123]$/.test(j.o))j.o='b3';/* the old easy/medium/hard levels became a thinking time */
  if(['h'].concat(BIDS,MAIAS,SFIDS).includes(j.o))sO=j.o;if(['w','b','r'].includes(j.s))sS=j.s;sT=j.t?1:0;if(j.n>0)sMin=j.n;if(j.i>=0)sInc=j.i;
  if(sM!=='flat'&&'ms'.includes(sO[0]))sO='b3';mode=sM;vsAI=sO!=='h';if(vsAI)setOpp(sO);side=sS;tc=sT;TCS[1]=[sMin,sInc,tcl(sMin,sInc)]}}catch(e){}
function swr(b,l,v,on){b.innerHTML='<span>'+l+'</span><b class="sw'+(on?' on':'')+'">'+v+'</b>'}
function updHint(){swr(hb,'Show valid moves',showHints?'On':'Off',showHints)}
function updSnd(){swr(sb,'Sound effects',snd?'On':'Off',snd)}
function updHap(){const ok=!!navigator.vibrate||!!NA;swr(document.getElementById('hap'),'Haptic feedback',!ok?'N/A':hapt?'On':'Off',ok&&hapt)}
function updFlip(){swr(fb,'Flip board each turn',vsAI?'2 players':flipT?'On':'Off',flipT&&!vsAI)}
function updFP(){swr(pb,'Flip pieces each turn',vsAI?'2 players':flipP?'On':'Off',flipP&&!vsAI)}
function updFS(){swr(fsb,'Fullscreen',!fsOK?'N/A':inFS()?'On':'Off',inFS())}
function updWake(){swr(wb,'Keep screen awake',!keep?'Off':wakeErr?'N/A':'On',keep&&!wakeErr)}
function vib(k){if(!hapt)return;const p=k==='mate'?[30,40,60]:k==='check'?[15,30,15]:k==='cap'?18:k==='draw'?[20,30,20]:10;try{if(NA)NA.vibrate(JSON.stringify(p));else if(navigator.vibrate)navigator.vibrate(p)}catch(e){}}
const sv_=p=>'<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+p+'</svg>',
 dots=n=>[[12],[10.5,13.5],[9,12,15]][n-1].map(x=>'<circle cx="'+x+'" cy="15.3" r=".9" fill="currentColor" stroke="none"/>').join(''),
 cpu=n=>sv_('<rect x="4" y="6" width="16" height="13" rx="3"/><path d="M12 6V3"/><circle cx="9" cy="11" r=".9" fill="currentColor" stroke="none"/><circle cx="15" cy="11" r=".9" fill="currentColor" stroke="none"/>'+dots(n)),
 ICO={h:sv_('<circle cx="8" cy="8" r="3"/><circle cx="17" cy="9" r="2.4"/><path d="M2.5 20c0-3.5 2.5-6 5.5-6s5.5 2.5 5.5 6M14.5 14.4c.8-.3 1.6-.4 2.5-.4 2.6 0 4.5 2 4.5 5"/>'),1:cpu(1),2:cpu(2),3:cpu(3),
 flat:sv_('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18" opacity=".45"/>'),
 cyl:sv_('<path d="M7 5h10M7 19h10M7 5C3 8 3 16 7 19M17 5c4 3 4 11 0 14"/><path d="M12 8v8" opacity=".45"/>'),
 bs:sv_('<path d="M3 3v18M21 3v18" stroke-dasharray="3 2.5"/><path d="M6 20l12-8L6 4"/>'),
 ba:sv_('<rect x="3" y="3" width="18" height="18" rx="2" stroke-dasharray="3 2.5"/><path d="M6 18L11 7l5 10 2-4"/>'),
 t:sv_('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 3h6"/>'),
 snd:sv_('<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 9c1.3 1.3 1.3 4.7 0 6M18.5 6.5c3 3 3 8 0 11"/>'),
 scr:sv_('<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>')},
 ddsum=(i,t,v)=>'<span class="si">'+i+'</span><span>'+t+'<br><span class="sub">'+v+'</span></span>',
 sw5=p=>'<span class="sw5">'+p.map(c=>'<i style="background:#'+c+'"></i>').join('')+'</span>',
 SIDES=[['w','Play White'],['b','Play Black'],['r','Random side']];
function pendNote(){
 const el=document.getElementById('pend'),go=document.getElementById('ng');if(!el||!go)return;
 const now_=(vsAI?OPS.find(o=>o[0]===oid())[1].split(':')[0]:'Two players')+' · '+MODES[mode].name+' · '+(tc?TCS[1][2]:'No clock');
 const diff=String(sO)!==(vsAI?oid():'h')||sM!==mode||(sO!=='h'&&sS!==side)||sT!==tc||(sT&&(sMin!==TCS[1][0]||sInc!==TCS[1][1]));
 el.hidden=!diff;el.textContent='Playing now: '+now_+'. Your new choices only apply when you start a new game.';
 go.textContent=diff?'Start new game with these settings':'Start game';go.classList.toggle('attn',diff);
}
function stg(){if(sM!=='flat'&&'ms'.includes(sO[0]))sO='b3';pendNote();
 try{localStorage.setItem('cos_new',JSON.stringify({m:sM,o:sO,s:sS,t:sT,n:sMin,i:sInc}))}catch(e){}
 const $=i=>document.getElementById(i);
 for(const k in MODES)$('m_'+k).classList.toggle('on',k===sM);
 const eg=engOf(sO);if(eg!=='h')LAST[eg]=sO;
 for(const [k,n] of LV){const e=$('o_'+k);e.classList.toggle('on',k===sO);e.style.display=eg!=='h'&&engOf(k)===eg?'':'none';if(k===sO)$('ocap').textContent=n}
 if(eg==='h')$('ocap').textContent='Two players on this device';
 for(const e of['h','m','s','b']){const b=$('e_'+e);b.classList.toggle('on',e===eg);b.style.display=(e==='m'||e==='s')&&sM!=='flat'?'none':''}
 $('tm2').style.display=$('lvbox').style.display=eg==='h'?'none':'';$('lvlb').textContent=eg==='b'?'Thinking time':'Level';
 $('mcap').textContent=sM!=='flat'?(eg==='h'?'':'The built-in engine plays this surface. The longer it may think, the stronger it plays.'):eg==='m'?'Maia: a neural net trained on human games. It plays like a person of that rating, mistakes included.':eg==='s'?'Stockfish: the strongest open-source engine. Pick an Elo to weaken it, or Max for full strength.':eg==='b'?'The app\'s own search engine: the longer it may think, the stronger it plays. It also plays the Cylinder and Bounce surfaces.':'';
 for(const [k,n] of SIDES){$('c_'+k).classList.toggle('on',k===sS);if(k===sS)$('scap').textContent=n}
 $('sc').style.display=sO!=='h'?'block':'none';
 $('sinfo').textContent=MODES[sM].info;
 document.querySelectorAll('.pre').forEach(b=>{const m=+b.dataset.m;b.classList.toggle('on',m===0?!sT:!!sT&&m===sMin&&+b.dataset.i===sInc)});
 const a=$('tmin'),c=$('tinc');if(document.activeElement!==a)a.value=sMin;if(document.activeElement!==c)c.value=sInc;$('tcs').classList.toggle('dim',!sT);
}
function moveInd(){const t=document.getElementById('tabs'),b=t.querySelector('button.on'),i=t.querySelector('.ind');if(!b)return;i.style.left=b.offsetLeft+'px';i.style.width=b.offsetWidth+'px'}
function stag(p){[...p.children].forEach((c,i)=>c.style.setProperty('--i',i));p.classList.remove('in');void p.offsetWidth;p.classList.add('in')}
function stagCur(){const p=document.querySelector('.pane:not([hidden])');if(p)stag(p)}
function tab(t){
 lastTab=t;try{localStorage.setItem('cos_tab',t)}catch(e){}
 for(const x of['new','game','lib','set'])document.getElementById('p_'+x).hidden=x!==t;
 document.querySelectorAll('.tabs button').forEach(b=>b.classList.toggle('on',b.dataset.t===t));
 moveInd();if(document.getElementById('menu').classList.contains('open'))stagCur();
}
function openMenu(t){stg();tab(t);document.getElementById('menu').classList.add('open');document.getElementById('sbg').classList.add('show');document.getElementById('mn').setAttribute('aria-expanded','true');stagCur();if(NA)try{NA.menuState(true)}catch(e){}}
function adv(x,y,dx,dy){
 if(mode!=='bs'&&mode!=='ba'){const r=step(x,y,dx,dy);return r&&[r[0],r[1],dx,dy]}
 let nx=x+dx,ny=y+dy;
 if(nx<0||nx>7){if(!dy)return null;dx=-dx;nx=x+dx}
 if(ny<0||ny>7){if(mode==='bs'||!dx)return null;dy=-dy;ny=y+dy}
 return [nx,ny,dx,dy];
}
function gen(s,x,y,att){
 const b=s.b,p=b[y*8+x],w=p<'a',t=p.toLowerCase(),o=[];
 const enemy=q=>q&&((q<'a')!==w);
 const add=r=>{const q=b[r[1]*8+r[0]];if(!q||enemy(q)){if(mode[0]==='b'&&o.some(m=>m[0]===r[0]&&m[1]===r[1]))return !q;o.push([r[0],r[1]]);return !q}return false};
 const ray=(dx,dy)=>{let cx=x,cy=y;for(let i=0;i<40;i++){const r=adv(cx,cy,dx,dy);if(!r)return;cx=r[0];cy=r[1];dx=r[2];dy=r[3];if(cx===x&&cy===y)return;if(!add([cx,cy]))return}};
 if(t==='p'){
  const f=w?-1:1;
  if(!att){
   const a=step(x,y,0,f);
   if(a&&!b[a[1]*8+a[0]]){
    o.push([a[0],a[1]]);
    if(y===(w?6:1)){const c=step(a[0],a[1],0,f);if(c&&!b[c[1]*8+c[0]])o.push([c[0],c[1],'d',a[0],a[1]])}
   }
  }
  for(const dx of[-1,1]){
   const r=step(x,y,dx,f);if(!r)continue;
   const q=b[r[1]*8+r[0]];
   if(att)o.push([r[0],r[1]]);
   else if(q){if(enemy(q))o.push([r[0],r[1]])}
   else if(s.ep&&s.ep.sq[0]===r[0]&&s.ep.sq[1]===r[1])o.push([r[0],r[1],'e']);
  }
 }else if(t==='n'){
  for(const [a,c] of[[2,1],[1,2]])for(const sx of[-1,1])for(const sy of[-1,1]){
   let cx=x,cy=y,k=1,ok=true;
   for(let i=0;i<a;i++){const r=step(cx,cy,sx,0);if(!r){ok=false;break}cx=r[0];cy=r[1];k*=r[2]}
   if(!ok)continue;
   const ny=cy+sy*c*k;if(ny<0||ny>7)continue;
   add([cx,ny]);
  }
 }else if(t==='k'){
  for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){if(!dx&&!dy)continue;const r=step(x,y,dx,dy);if(r)add(r)}
 }else{
  if(t!=='b')for(const d of[[1,0],[-1,0],[0,1],[0,-1]])ray(...d);
  if(t!=='r')for(const d of[[1,1],[1,-1],[-1,1],[-1,-1]])ray(...d);
 }
 return o;
}
function attacked(s,x,y,byW){
 const b=s.b,f=byW?1:-1,pc=byW?'P':'p',nc=byW?'N':'n',kc=byW?'K':'k',rc=byW?'R':'r',bc=byW?'B':'b',qc=byW?'Q':'q';
 for(const dx of[-1,1]){const r=step(x,y,dx,f);if(r&&b[r[1]*8+r[0]]===pc)return true}
 for(const [a,c] of[[2,1],[1,2]])for(const sx of[-1,1])for(const sy of[-1,1]){
  let cx=x,ok=true;
  for(let i=0;i<a;i++){const r=step(cx,y,sx,0);if(!r){ok=false;break}cx=r[0]}
  if(!ok)continue;
  const ny=y+sy*c;if(ny>=0&&ny<8&&b[ny*8+cx]===nc)return true;
 }
 for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){
  if(!dx&&!dy)continue;
  const r=step(x,y,dx,dy);if(r&&b[r[1]*8+r[0]]===kc)return true;
  let cx=x,cy=y,ex=dx,ey=dy;
  for(let i=0;i<40;i++){
   const q=adv(cx,cy,ex,ey);if(!q)break;
   cx=q[0];cy=q[1];ex=q[2];ey=q[3];if(cx===x&&cy===y)break;
   const z=b[cy*8+cx];if(!z)continue;
   if(z===qc||z===(ex&&ey?bc:rc))return true;
   break;
  }
 }
 return false;
}
function check(s,w){const i=s.b.indexOf(w?'K':'k');return i<0||attacked(s,i%8,i>>3,!w)}
function apply(s,m){
 const b=s.b.slice(),p=b[m.fy*8+m.fx],w=p<'a',t=p.toLowerCase();let c=s.c,ep=null;
 const cap=b[m.ty*8+m.tx]||m.k==='e';b[m.fy*8+m.fx]=null;b[m.ty*8+m.tx]=p;
 if(m.k==='e'){const q=s.ep.pawn;b[q[1]*8+q[0]]=null}
 if(m.k==='d')ep={sq:[m.mx,m.my],pawn:[m.tx,m.ty]};
 if(m.k==='c'){const r=m.ty;if(m.tx===6){b[r*8+5]=b[r*8+7];b[r*8+7]=null}else{b[r*8+3]=b[r*8];b[r*8]=null}}
 if((p==='P'&&m.ty===0)||(p==='p'&&m.ty===7)){const z=m.pr||'q';b[m.ty*8+m.tx]=w?z.toUpperCase():z}
 const rm=(x,y)=>{const k={'0,7':'Q','7,7':'K','0,0':'q','7,0':'k'}[x+','+y];if(k)c=c.replace(k,'')};
 rm(m.fx,m.fy);rm(m.tx,m.ty);
 if(t==='k')c=c.replace(w?/[KQ]/g:/[kq]/g,'');
 return {b,t:s.t==='w'?'b':'w',c,ep,hm:(t==='p'||cap)?0:s.hm+1};
}
function legal(s){
 const w=s.t==='w',L=[];
 for(let i=0;i<64;i++){
  const p=s.b[i];if(!p||(p<'a')!==w)continue;
  const x=i%8,y=i>>3,seen=new Set();
  for(const g of gen(s,x,y,false)){
   const key=g[0]*8+g[1];if(seen.has(key))continue;seen.add(key);
   const m={fx:x,fy:y,tx:g[0],ty:g[1],k:g[2],mx:g[3],my:g[4]};
   if(!check(apply(s,m),w))L.push(m);
  }
 }
 const r=w?7:0,K=w?'K':'k',R=w?'R':'r',e=n=>!s.b[r*8+n];
 if(s.b[r*8+4]===K&&!check(s,w)){
  const tryC=(tx,ok)=>{if(!ok)return;const m={fx:4,fy:r,tx,ty:r,k:'c'};if(!check(apply(s,m),w))L.push(m)};
  tryC(6,s.c.includes(K)&&s.b[r*8+7]===R&&e(5)&&e(6)&&!attacked(s,5,r,!w));
  tryC(2,s.c.includes(w?'Q':'q')&&s.b[r*8]===R&&e(1)&&e(2)&&e(3)&&!attacked(s,3,r,!w));
 }
 return L;
}
const START='rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
/* FEN -> {s:state, ply:half-moves before the position}, or null when it is not a usable position */
function parseFEN(f){
 if(typeof f!=='string')return null;const p=f.trim().split(/\s+/);if(p.length<2)return null;
 const rows=p[0].split('/');if(rows.length!==8)return null;const b=[];
 for(const r of rows){let n=0;for(const ch of r){if(ch>='1'&&ch<='8'){for(let i=0;i<+ch;i++)b.push(null);n+=+ch}else if('PNBRQKpnbrqk'.includes(ch)){b.push(ch);n++}else return null}if(n!==8)return null}
 if(b.filter(c=>c==='K').length!==1||b.filter(c=>c==='k').length!==1)return null;
 for(let i=0;i<8;i++)if(/p/i.test(b[i]||'')||/p/i.test(b[56+i]||''))return null;
 const t=p[1]==='b'?'b':p[1]==='w'?'w':null;if(!t)return null;
 let c=p[2]||'';
 if(b[60]!=='K'){c=c.replace(/[KQ]/g,'')}if(b[4]!=='k'){c=c.replace(/[kq]/g,'')}
 if(b[63]!=='R')c=c.replace('K','');if(b[56]!=='R')c=c.replace('Q','');if(b[7]!=='r')c=c.replace('k','');if(b[0]!=='r')c=c.replace('q','');
 c=['K','Q','k','q'].filter(x=>c.includes(x)).join('');
 let ep=null;const e=p[3];
 if(e&&/^[a-h][36]$/.test(e)){const x='abcdefgh'.indexOf(e[0]),y=8-+e[1];if((t==='w'&&y===2)||(t==='b'&&y===5))ep={sq:[x,y],pawn:[x,y===2?3:4]}}
 const hm=Math.max(0,parseInt(p[4])||0),fm=Math.max(1,parseInt(p[5])||1);
 return{s:{b,t,c,ep,hm},ply:(fm-1)*2+(t==='b'?1:0)};
}
function newGame(f0){
 if(typeof RV!=='undefined'&&RV.on)closeReview();
 if(typeof voiceCancel==='function')voiceCancel();
 if(mode!=='flat'&&(mlv||slv)){mlv=slv=0}
 if(mlv)Maia.load(mlv).catch(()=>{});
 if(slv)SF.init().catch(()=>{});
 if(typeof Eng.cancel==='function')Eng.cancel();if(typeof SF!=='undefined')SF.reset();busy=false;
 mlog=[];
 hw=side==='r'?Math.random()<.5:side==='w';
 const p0=(typeof f0==='string'&&parseFEN(f0))||parseFEN(START);
 startFen=p0.s.b.join('')===parseFEN(START).s.b.join('')&&p0.s.t==='w'?'':f0;startPly=p0.ply;viewI=-1;HINT=null;archived=false;if(typeof curArchId!=='undefined')curArchId=null;
 ANIM=null;FXL=[];s=p0.s;sel=null;over=false;pend=null;hist={};last=null;sans=[];caps=[];gameH=new Map();gameH.set(hashOf(s),1);hidePromo();clk=[TCS[tc][0]*60000,TCS[tc][0]*60000];tk=Date.now();snaps=[];
 document.getElementById('info').textContent=MODES[mode].info+' Castling uses the usual squares. Automatic draws: stalemate, insufficient material, fivefold repetition, 75-move rule. Claimable: threefold repetition, 50-move rule.'+(mode==='flat'?'':' On this surface only bare kings count as insufficient material, since the usual dead-position analysis assumes the flat board.');
 for(const k in MODES)document.getElementById('m_'+k).classList.toggle('on',k===mode);
 for(const [k] of LV)document.getElementById('o_'+k).classList.toggle('on',vsAI&&k===oid());
 for(const k of['w','b','r'])document.getElementById('c_'+k).classList.toggle('on',k===side);
 document.getElementById('sc').style.display=vsAI?'block':'none';fb.disabled=pb.disabled=vsAI;updFlip();updFP();
 setTimeout(maybeAI,50);
 moves=legal(s);status();draw();
}
/* Resume the game in progress (cos_game) after the app was closed or killed: replay the saved moves silently. */
function saveGame(){
 try{
  if(over||!mlog.length){localStorage.removeItem('cos_game');return}
  localStorage.setItem('cos_game',JSON.stringify({f:startFen,m:mode,o:vsAI?oid():'h',hw,s:side,t:tc,n:TCS[1][0],i:TCS[1][1],mv:mlog,k:clk,ks:snaps.map(z=>z.k)}));
 }catch(e){}
}
/* Replays moves [{fx,fy,tx,ty,pr}] from the current (freshly set up) position without sounds or clocks. false if one is illegal. */
function replayMoves(list){
 for(const q of list){
  const m=moves.find(x=>x.fx===q.fx&&x.fy===q.fy&&x.tx===q.tx&&x.ty===q.ty);
  if(!m)return false;
  const mv=q.pr?{...m,pr:q.pr}:m;
  snaps.push({s,h:{...hist},g:new Map(gameH),l:last,n:sans.length,c:caps.length,k:clk.slice()});
  const sn=san(s,mv,moves),cp=mv.k==='e'?(s.t==='w'?'p':'P'):s.b[mv.ty*8+mv.tx];
  if(cp)caps.push(cp);
  last=[mv.fx,mv.fy,mv.tx,mv.ty];mlog.push({fx:mv.fx,fy:mv.fy,tx:mv.tx,ty:mv.ty,pr:mv.pr,k:mv.k});
  s=apply(s,mv);{const hh=hashOf(s);gameH.set(hh,(gameH.get(hh)||0)+1)}
  moves=legal(s);
  sans.push(sn+(check(s,s.t==='w')?(moves.length?'+':'#'):''));
  if(q!==list[list.length-1])rec();/* the last position is counted by status() */
 }
 return true;
}
function loadGame(){
 let j;
 try{j=JSON.parse(localStorage.getItem('cos_game')||'null')}catch(e){return false}
 if(j&&/^[123]$/.test(j.o))j.o='b3';
 if(!j||!MODES[j.m]||!Array.isArray(j.mv)||!j.mv.length||!['h'].concat(BIDS,MAIAS,SFIDS).includes(j.o))return false;
 if(j.m!=='flat'&&'ms'.includes(j.o[0]))return false;
 mode=j.m;vsAI=j.o!=='h';if(vsAI)setOpp(j.o);side=['w','b','r'].includes(j.s)?j.s:'w';tc=j.t?1:0;
 if(j.n>0&&j.i>=0)TCS[1]=[j.n,j.i,tcl(j.n,j.i)];
 newGame(j.f&&parseFEN(j.f)?j.f:undefined);hw=!!j.hw;
 if(!replayMoves(j.mv)){newGame();return false}
 if(Array.isArray(j.ks)&&j.ks.length===snaps.length)snaps.forEach((z,i)=>{if(Array.isArray(j.ks[i]))z.k=j.ks[i]});
 if(Array.isArray(j.k)&&j.k.length===2&&j.k.every(Number.isFinite))clk=j.k;
 tk=Date.now();sel=null;ANIM=null;FXL=[];
 status();draw();
 return true;
}
/* piece artwork that lives in the DOM (side picker); runs again whenever the theme swaps piece sets */
function pieceUI(){
 const im=c=>'<img alt="" draggable="false" src="'+Pieces.url(c)+'">',d=(id,h)=>{const e=document.querySelector('#'+id+' .disc');if(e)e.innerHTML=h};
 d('c_w',im('K'));d('c_b',im('k'));d('c_r',im('K')+im('k'));
}
function status(){
 rec();const w=s.t==='w',c=check(s,w);let t=(w?'White':'Black')+' to move';mate=!moves.length&&c;if(mate)bn=true;
 if(!moves.length){over=true;t=c?'Checkmate — '+(w?'Black':'White')+' wins':'Stalemate — draw'}
 else if(drawReason()){over=true;t='Draw — '+drawReason()}
 else if(c)t+=' (check)';
 document.getElementById('st').className=mate?'mate':'';
 document.getElementById('st').textContent=t;
 cv.setAttribute('aria-label','Chess board. '+t+(sans.length?'. Last move: '+sans[sans.length-1]:''));
 updBtns();renderList();saveGame();
}
function doMove(m){
 tickClock();if(over)return;HINT=null;const mv=s.t;snaps.push({s,h:{...hist},g:new Map(gameH),l:last,n:sans.length,c:caps.length,k:clk.slice()});
 const sn=san(s,m,moves),q=m.k==='e'?(s.t==='w'?'p':'P'):s.b[m.ty*8+m.tx];
 if(q)caps.push(q);
 last=[m.fx,m.fy,m.tx,m.ty];mlog.push({fx:m.fx,fy:m.fy,tx:m.tx,ty:m.ty,pr:m.pr,k:m.k});
 if(TCS[tc][0])clk[mv==='w'?0:1]+=TCS[tc][1]*1000;startAnim(m,s.b[m.fy*8+m.fx],q,m.k==='e'?s.ep.pawn:[m.tx,m.ty]);s=apply(s,m);{const hh=hashOf(s);gameH.set(hh,(gameH.get(hh)||0)+1)}sel=null;moves=legal(s);
 sans.push(sn+(check(s,s.t==='w')?(moves.length?'+':'#'):''));
 const kd=sn.includes('=')?'promo':m.k==='c'?'castle':q?'cap':'move',ck=check(s,s.t==='w');
 status();const dl=animDelay(),fm=mate,fo=over;if(fm)mT0=now()+dl;draw();
 setTimeout(()=>{if(fm)sfx('mate');else if(fo)sfx('draw');else{sfx(kd);if(ck)setTimeout(()=>sfx('check'),140)}},dl*.85);
 maybeAI()}
function hidePromo(){document.getElementById('pk').style.display='none'}
function placePromo(){
 if(!pend)return;
 const pk=document.getElementById('pk'),pl=document.getElementById('pkp'),r=cv.getBoundingClientRect(),k=r.width/S,
  dx=FLP?7-pend.tx:pend.tx,dy=FLP?7-pend.ty:pend.ty,
  cx=(P+(dx+.5)*C)*k,top=(P+dy*C)*k;
 const left=Math.max(2,Math.min(r.width-pl.offsetWidth-2,cx-pl.offsetWidth/2));
 pl.style.left=left+'px';pl.style.top=(top-pl.offsetHeight-2)+'px';
}
function cancelPromo(){
 if(!pend)return;
 hidePromo();pend=null;document.getElementById('st').textContent=prevSt;draw();
}
function askPromo(m){
 pend=m;sel=null;
 const st=document.getElementById('st'),pk=document.getElementById('pk'),pl=document.getElementById('pkp'),
  w=s.b[m.fy*8+m.fx]<'a',cell=Math.round(cv.getBoundingClientRect().width/S*C*.92);
 prevSt=st.textContent;st.textContent='Choose a promotion piece';
 pl.innerHTML='';
 for(const [z,n] of[['q','Queen'],['r','Rook'],['b','Bishop'],['n','Knight']]){
  const b=document.createElement('button'),g=document.createElement('img');
  b.title=n;b.setAttribute('aria-label',n);b.style.width=b.style.height=cell+'px';
  g.src=Pieces.url(w?z.toUpperCase():z);g.alt=n;g.draggable=false;
  b.style.background=w?'var(--ds)':'var(--ls)';b.appendChild(g);
  b.onclick=e=>{e.stopPropagation();hidePromo();const mm={...pend,pr:z};pend=null;doMove(mm)};
  pl.appendChild(b);
 }
 pk.style.display='block';placePromo();draw();
}
function posKey(){const ep=moves.some(m=>m.k==='e')?s.ep.sq.join():'-';return s.b.map(p=>p||'.').join('')+s.t+s.c+ep}
function rec(){const k=posKey();hist[k]=(hist[k]||0)+1}
function insuffB(b){
 let n=0,cnt=0,bs=0,col=-1,mixed=false;
 for(let i=0;i<64;i++){
  const p=b[i];if(!p)continue;const t=p.toLowerCase();if(t==='k')continue;
  if(++n>6)return false;
  if(t==='b'){const c=(i%8+(i>>3))%2;if(col<0)col=c;else if(c!==col)mixed=true;bs++}
  else if(t==='n')cnt++;else return false;
 }
 if(!n)return true;
 if(mode!=='flat')return false;
 if(n===1)return true;
 return cnt===0&&!mixed;
}
function insuff(){return insuffB(s.b)}
function drawReason(){
 if(insuff())return 'insufficient material';
 const n=hist[posKey()]||0;
 if(n>=5)return 'fivefold repetition';
 if(s.hm>=150)return 'seventy-five-move rule';
 return null;
}
function claimReason(){return (hist[posKey()]||0)>=3?'threefold repetition':s.hm>=100?'fifty-move rule':''}
function updBtns(){
 const r=claimReason(),cl=document.getElementById('cl'),ag=document.getElementById('ag');
 cl.disabled=over||!r;cl.textContent=r?'Claim draw ('+r+')':'Claim draw';
 ag.disabled=over;ag.textContent='Draw by agreement';delete ag.dataset.c;
 document.getElementById('mn').classList.toggle('alert',!over&&!!r);ubt.disabled=busy||snaps.length<(vsAI&&!hw?2:1);rsb.disabled=over;
 const rs=document.getElementById('res');if(rs){rs.hidden=!over;document.getElementById('rt').textContent=document.getElementById('st').textContent}
 if(over&&!archived&&sans.length){archived=true;if(typeof archiveGame==='function')archiveGame()}
 if(typeof rvSync==='function')rvSync();
}
function end(t){over=true;sel=null;pend=null;hidePromo();closeMenu();sfx('draw');document.getElementById('st').textContent=t;updBtns();renderList();saveGame();draw()}
let gameH=new Map(),seed=88172645;
function rnd(){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return seed>>>0}
const ZK=Array.from({length:768},()=>[rnd(),rnd()]),ZS=[rnd(),rnd()],ZC=[rnd(),rnd(),rnd(),rnd()],ZE=Array.from({length:64},()=>[rnd(),rnd()]);
function hashOf(t){
 let a=0,b=0;
 for(let i=0;i<64;i++){const p=t.b[i];if(p){const z=ZK['PNBRQKpnbrqk'.indexOf(p)*64+i];a^=z[0];b^=z[1]}}
 if(t.t==='b'){a^=ZS[0];b^=ZS[1]}
 for(let i=0;i<4;i++)if(t.c.includes('KQkq'[i]))a^=ZC[i];
 if(t.ep){const z=ZE[t.ep.sq[1]*8+t.ep.sq[0]];a^=z[0];b^=z[1]}
 return (a>>>0)+(b>>>11)*4294967296;
}
const aiT=()=>vsAI&&s.t!==(hw?'w':'b');
function maybeAI(){if(!over&&aiT()){busy=true;document.getElementById('st').textContent='Computer is thinking…';setTimeout(aiMove,30+animDelay())}}
function maiaMove(){
 const s0=s,st=document.getElementById('st'),el=mlv;busy=true;st.textContent='Maia '+el+' is thinking\u2026';
 const h=[...snaps.map(z=>z.s),s].slice(-8);
 Maia.load(el).then(net=>{
  if(s!==s0||over||!aiT()){busy=false;return null}
  return Maia.pick(net,h,moves).then(r=>{
   if(s!==s0||over||!aiT()){busy=false;return}
   if(!r)throw new Error('no move');
   busy=false;doMove(moves.find(m=>m.fx===r.move.fx&&m.fy===r.move.fy&&m.tx===r.move.tx&&m.ty===r.move.ty&&(m.pr||'')===(r.move.pr||''))||r.move);
  });
 }).catch(e=>{
  busy=false;if(s!==s0)return;
  mlv=0;st.textContent='Maia could not load \u2014 using the built-in engine';setTimeout(()=>{if(s===s0&&!over)engMove()},600);
 });
}
function sfMove(){
 const s0=s,st=document.getElementById('st'),elo=slv;busy=true;st.textContent='Stockfish is thinking…';
 const mt=TCS[tc][0]?Math.max(100,Math.min(900,clk[hw?1:0]/30)):900;
 SF.search(SF.toFen(s,sans.length+startPly),{movetime:mt,elo:elo>=3190?0:elo}).then(r=>{
  if(s!==s0||over||!aiT()){busy=false;return}
  const u=SF.fromUci(r.best),m=moves.find(m=>m.fx===u.fx&&m.fy===u.fy&&m.tx===u.tx&&m.ty===u.ty);
  if(!m)throw new Error('engine move not legal: '+r.best);
  busy=false;doMove(u.pr?{...m,pr:u.pr}:m);
 }).catch(e=>{
  busy=false;if(s!==s0)return;
  slv=0;st.textContent='Stockfish could not start — using the built-in engine';setTimeout(()=>{if(s===s0&&!over)engMove()},600);
 });
}
function aiMove(){
 busy=false;
 if(!aiT()||over||pend)return;
 if(mlv&&mode==='flat')return maiaMove();
 if(slv&&mode==='flat')return sfMove();
 engMove();
}
function engMove(){
 const cf={d:64,t:blv*1000,n:0},s0=s;busy=true;
 const ms=TCS[tc][0]?Math.max(80,Math.min(cf.t,clk[hw?1:0]/30)):cf.t;
 const play=r=>{
  busy=false;if(s!==s0||over||!aiT())return;
  let m=r&&moves.find(x=>x.fx===r.move.fx&&x.fy===r.move.fy&&x.tx===r.move.tx&&x.ty===r.move.ty);
  if(!m)m=moves[Math.random()*moves.length|0];
  else if(r.move.pr)m={...m,pr:r.move.pr};
  doMove(m);
 };
 Eng.searchAsync(mode,s,{ms,maxDepth:cf.d,noise:cf.n,hist:snaps.map(z=>z.s)}).then(play,e=>{if(String(e&&e.message)!=='cancelled')play(null);else busy=false});
}
const FL='abcdefgh',sq=(x,y)=>FL[x]+(8-y);
function san(t,m,ms){
 if(m.k==='c')return m.tx===6?'O-O':'O-O-O';
 const p=t.b[m.fy*8+m.fx],k=p.toLowerCase(),cap=t.b[m.ty*8+m.tx]||m.k==='e';
 let r='';
 if(k==='p'){if(cap)r=FL[m.fx]}
 else{
  r=k.toUpperCase();
  const o=ms.filter(n=>(n.fx!==m.fx||n.fy!==m.fy)&&n.tx===m.tx&&n.ty===m.ty&&t.b[n.fy*8+n.fx]===p);
  if(o.length)r+=o.some(n=>n.fx===m.fx)?(o.some(n=>n.fy===m.fy)?sq(m.fx,m.fy):8-m.fy):FL[m.fx];
 }
 r+=(cap?'x':'')+sq(m.tx,m.ty);
 if(k==='p'&&(m.ty===0||m.ty===7))r+='='+(m.pr||'q').toUpperCase();
 return r;
}
function renderList(){
 const ml=document.getElementById('ml'),V={p:1,n:3,b:3,r:5,q:9};let h='';
 const shown=viewI<0?sans.length:viewI;
 for(let i=0;i<sans.length;i++){const pl=i+startPly;if(pl%2===0)h+='<b>'+((pl>>1)+1)+'.</b>';else if(i===0)h+='<b>'+((pl>>1)+1)+'\u2026</b>';
  const rc=typeof RV!=='undefined'&&RV.on&&RV.data&&RV.data.cls[i]!=null?' k'+RV.data.cls[i]:'';
  h+='<span class="pl'+rc+(i+1===shown?' cur':'')+'" data-p="'+(i+1)+'">'+sans[i]+'</span>'}
 if(over){const t=resText();h+='<b class="rz">'+(/White wins/.test(t)?'1-0':/Black wins/.test(t)?'0-1':'\u00BD-\u00BD')+'</b>'}
 ml.innerHTML=h||'<span class="mt">Moves will appear here.</span>';
 const c=ml.querySelector('.pl.cur');ml.scrollLeft=c?c.offsetLeft-ml.clientWidth/2+c.offsetWidth/2:sans.length?ml.scrollWidth:0;
 syncView();
 let bal=0;for(const p of s.b)if(p&&p.toLowerCase()!=='k')bal+=(p<'a'?1:-1)*V[p.toLowerCase()];
 const strip=(id,white,name)=>{
  const g=caps.filter(q=>white?q>='a':q<'a').sort((a,b)=>V[b.toLowerCase()]-V[a.toLowerCase()]),adv=white?bal:-bal;
  document.getElementById(id).innerHTML='<img class="av" alt="" draggable="false" src="'+Pieces.url(white?'K':'k')+'"><span class="nm">'+name+'</span>'+g.map(q=>'<img class="cp" alt="" draggable="false" src="'+Pieces.url(q)+'">').join('')+(adv>0?'<i>+'+adv+'</i>':'')+(TCS[tc][0]?'<span class="clk" id="clk_'+(white?'w':'b')+'"></span>':'');
 };
 const hb=flipped();
 strip(hb?'bs2':'ts2',false,vsAI?(hw?'Black · Computer':'Black · You'):'Black');strip(hb?'ts2':'bs2',true,vsAI?(hw?'White · You':'White · Computer'):'White');updClk();
}
function css(v){return getComputedStyle(document.documentElement).getPropertyValue(v).trim()}
function edge(ax,ay,bx,by,col,n){
 ctx.strokeStyle=col;ctx.fillStyle=col;ctx.lineWidth=3;
 ctx.beginPath();ctx.moveTo(ax,ay);ctx.lineTo(bx,by);ctx.stroke();
 const ang=Math.atan2(by-ay,bx-ax),ux=Math.cos(ang),uy=Math.sin(ang);
 for(let i=0;i<n;i++){
  const t=.5+(i-(n-1)/2)*.06,mx=ax+(bx-ax)*t,my=ay+(by-ay)*t;
  ctx.beginPath();ctx.moveTo(mx+ux*7,my+uy*7);
  ctx.lineTo(mx-ux*5-uy*6,my-uy*5+ux*6);ctx.lineTo(mx-ux*5+uy*6,my-uy*5-ux*6);ctx.fill();
 }
}
function mir(m){return {...m,fx:7-m.fx,fy:7-m.fy,tx:7-m.tx,ty:7-m.ty}}
function flipped(){return (vsAI?!hw:(flipT&&s.t==='b'))!==mf}
/* ───────── theme-aware, animated board renderer ───────── */
let ANIM=null,FXL=[],mT0=0,raf=0;
const now=()=>performance.now(),clamp01=v=>v<0?0:v>1?1:v,dc=(x,y)=>FLP?[7-x,7-y]:[x,y];
const EASE={
 glide:t=>1-Math.pow(1-t,3),
 spring:t=>{const c1=1.9,c3=c1+1;return 1+c3*Math.pow(t-1,3)+c1*Math.pow(t-1,2)},
 snap:t=>1-Math.pow(1-t,4),
 float:t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2,
 arc:t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2
};
function kick(){if(!raf)raf=requestAnimationFrame(frame)}
function frame(){
 raf=0;const t=now();
 if(ANIM&&t>=ANIM.t0+ANIM.dur){const a=ANIM;ANIM=null;landFx(a)}
 FXL=FXL.filter(f=>t<f.t0+f.dur);
 draw();
}
function needLoop(){
 if(!animOn||!TH)return false;
 return !!(ANIM||FXL.length||(TH.m.pulse&&((sel&&sel.length)||(KI>=0&&!over)))||(mate&&bn&&now()-mT0<600));
}
function animDelay(){return ANIM?Math.max(0,ANIM.t0+ANIM.dur-now()):0}
function startAnim(m,p,q,cp){
 ANIM=null;if(!animOn||!TH)return;
 const it=[{p,fx:m.fx,fy:m.fy,tx:m.tx,ty:m.ty}];
 if(m.k==='c'){const k=m.tx===6;it.push({p:p<'a'?'R':'r',fx:k?7:0,fy:m.ty,tx:k?5:3,ty:m.ty})}
 ANIM={t0:now(),dur:TH.m.mdur,it,cap:q?{p:q,x:cp[0],y:cp[1]}:null,mv:TH.m.move};
 kick();
}
function burst(x,y,M,n){
 const ps=[],cols=M.pcols||[TH.pal.ac];
 for(let i=0;i<n;i++)ps.push({a:Math.random()*6.283,v:.45+Math.random()*1.1,r:2.5+Math.random()*3.5,c:cols[i%cols.length],rot:Math.random()*6.28,sp:(Math.random()-.5)*8});
 FXL.push({type:'burst',x,y,t0:now(),dur:700,ps,shape:M.pshape||'c'});
}
function landFx(a){
 const M=TH.m,T=a.it[0];
 if(a.cap){
  const c=M.cap;
  if(c==='ring'||c==='burst')FXL.push({type:'ring',x:T.tx,y:T.ty,t0:now(),dur:480});
  if(c==='burst'||c==='shake'||c==='glitch')burst(T.tx,T.ty,M,c==='burst'?16:10);
  if(c==='glitch')FXL.push({type:'glitch',t0:now(),dur:320});
  if(M.shk){const bw=document.querySelector('.bw');bw.classList.remove('hit');void bw.offsetWidth;bw.classList.add('hit');setTimeout(()=>bw.classList.remove('hit'),360)}
 }else if(M.land)FXL.push({type:'ring',x:T.tx,y:T.ty,t0:now(),dur:320,small:1});
}
function heartPath(cx,cy,r){ctx.beginPath();ctx.moveTo(cx,cy+r*.9);ctx.bezierCurveTo(cx-r*1.6,cy-r*.1,cx-r*.9,cy-r*1.2,cx,cy-r*.45);ctx.bezierCurveTo(cx+r*.9,cy-r*1.2,cx+r*1.6,cy-r*.1,cx,cy+r*.9);ctx.closePath()}
function drawPiece(p,cx,cy,o){
 o=o||{};const im=Pieces.img(p);if(!im)return;
 const PC=TH.pc,z=C*1.04;
 ctx.save();ctx.translate(cx,cy-C*.05-(o.lift||0));
 if(o.rot)ctx.rotate(o.rot);
 if(o.sc||o.sx)ctx.scale(o.sx||o.sc||1,o.sc||1);
 ctx.globalAlpha=o.al==null?1:o.al;
 if(PC.sh){ctx.shadowColor='rgba(0,0,0,.3)';ctx.shadowBlur=4;ctx.shadowOffsetY=2+(o.lift?o.lift*.12:0)}
 ctx.drawImage(im,-z/2,-z/2,z,z);
 ctx.restore();
}
function bgLayer(){
 const key=TH.id+'|'+TH.dark+'|'+FLP+'|'+DPR;
 if(BGC&&BGC.k===key)return BGC.c;
 const c=(BGC&&BGC.c)||document.createElement('canvas');c.width=c.height=Math.round(S*DPR);
 const g=c.getContext('2d'),Q=TH.pal,V=TH.v;g.setTransform(DPR,0,0,DPR,0,0);
 g.fillStyle=Q.card;g.fillRect(0,0,S,S);
 for(let y=0;y<8;y++)for(let x=0;x<8;x++){
  const px=P+x*C,py=P+y*C;g.fillStyle=(x+y)%2?Q.ds:Q.ls;g.fillRect(px,py,C,C);
  if(V.tex==='sheen'){const gr=g.createLinearGradient(0,py,0,py+C);gr.addColorStop(0,'rgba(255,255,255,.17)');gr.addColorStop(.55,'rgba(255,255,255,0)');gr.addColorStop(1,'rgba(0,0,0,.08)');g.fillStyle=gr;g.fillRect(px,py,C,C)}
  else if(V.tex==='grain'){g.strokeStyle='rgba(60,35,10,.11)';g.lineWidth=1;for(let k=0;k<6;k++){const r=((x*7+y*13+k*31)*9301%233280)/233280,yy=py+C*(.08+.84*(k+r*.8)/6);g.beginPath();g.moveTo(px,yy);g.bezierCurveTo(px+C*.3,yy+(r-.5)*7,px+C*.7,yy-(r-.5)*7,px+C,yy);g.stroke()}}
  else if(V.tex==='grid'){g.strokeStyle='rgba(255,255,255,.13)';g.lineWidth=1;g.strokeRect(px+.5,py+.5,C-1,C-1)}
 }
 BGC={k:key,c};return c;
}
function hintMark(cx,cy,cap,st,AC){
 ctx.save();ctx.lineJoin='round';ctx.shadowColor='rgba(0,0,0,.45)';ctx.shadowBlur=3;
 const a9=AC(.95),a8=AC(.9);
 if(st==='ring'){ctx.strokeStyle=a9;ctx.lineWidth=cap?4:3;ctx.beginPath();ctx.arc(cx,cy,C*(cap?.42:.16),0,7);ctx.stroke()}
 else if(st==='diamond'){const r=C*(cap?.44:.16);ctx.beginPath();ctx.moveTo(cx,cy-r);ctx.lineTo(cx+r,cy);ctx.lineTo(cx,cy+r);ctx.lineTo(cx-r,cy);ctx.closePath();if(cap){ctx.strokeStyle=a9;ctx.lineWidth=3;ctx.stroke()}else{ctx.fillStyle=a8;ctx.fill()}}
 else if(st==='bracket'){
  if(cap){const r=C*.42,l=C*.2;ctx.strokeStyle=a9;ctx.lineWidth=4;ctx.beginPath();for(const sx of[-1,1])for(const sy of[-1,1]){ctx.moveTo(cx+sx*r,cy+sy*(r-l));ctx.lineTo(cx+sx*r,cy+sy*r);ctx.lineTo(cx+sx*(r-l),cy+sy*r)}ctx.stroke()}
  else{ctx.strokeStyle=a9;ctx.lineWidth=2.5;ctx.strokeRect(cx-C*.1,cy-C*.1,C*.2,C*.2)}}
 else if(st==='heart'){heartPath(cx,cy,C*(cap?.36:.15));if(cap){ctx.strokeStyle=a9;ctx.lineWidth=3;ctx.stroke()}else{ctx.fillStyle=a8;ctx.fill()}}
 else if(st==='square'){if(cap){ctx.strokeStyle=a9;ctx.lineWidth=5;ctx.strokeRect(cx-C*.5+3,cy-C*.5+3,C-6,C-6)}else{ctx.fillStyle=a8;ctx.fillRect(cx-C*.12,cy-C*.12,C*.24,C*.24)}}
 else{ctx.beginPath();if(cap){ctx.strokeStyle=a9;ctx.lineWidth=4;ctx.arc(cx,cy,C*.42,0,7);ctx.stroke()}else{ctx.fillStyle=a8;ctx.arc(cx,cy,C*.14,0,7);ctx.fill()}}
 ctx.restore();
}
function drawFx(t){
 const AC=TH.pal.ac;
 for(const f of FXL){
  const u=clamp01((t-f.t0)/f.dur);
  if(f.type==='ring'){const d=dc(f.x,f.y);ctx.save();ctx.globalAlpha=(1-u)*.9;ctx.strokeStyle=AC;ctx.lineWidth=f.small?2:5*(1-u)+1;ctx.beginPath();ctx.arc(P+(d[0]+.5)*C,P+(d[1]+.5)*C,C*(f.small?.25+.35*u:.2+.8*u),0,7);ctx.stroke();ctx.restore()}
  else if(f.type==='burst'){
   const d=dc(f.x,f.y),cx=P+(d[0]+.5)*C,cy=P+(d[1]+.5)*C;
   for(const p of f.ps){
    const r=p.v*C*(1-Math.pow(1-u,2));
    ctx.save();ctx.globalAlpha=1-u*u;ctx.fillStyle=p.c;ctx.translate(cx+Math.cos(p.a)*r,cy+Math.sin(p.a)*r+u*u*C*.7);ctx.rotate(p.rot+p.sp*u);
    if(f.shape==='sq')ctx.fillRect(-p.r,-p.r,p.r*2,p.r*2);
    else if(f.shape==='r')ctx.fillRect(-p.r*1.6,-p.r*.7,p.r*3.2,p.r*1.4);
    else if(f.shape==='h'){heartPath(0,0,p.r*1.5);ctx.fill()}
    else{ctx.beginPath();ctx.arc(0,0,p.r,0,7);ctx.fill()}
    ctx.restore();
   }
  }else if(f.type==='glitch'){
   const q=Math.floor(t/70);ctx.save();
   for(let k=0;k<6;k++){ctx.globalAlpha=(1-u)*.4;ctx.fillStyle=k%2?'#fe2468':'#24c0e9';ctx.fillRect(P+((q*53+k*29)%16-8),P+((q*131+k*977)%800)/800*8*C,8*C,3+k*2)}
   ctx.restore();
  }
 }
}
function draw(){
 if(viewI<0||viewI>=snaps.length){draw0();return}
 const s0=s,l0=last,v0=sel,m0=moves,p0=pend,t0=mate,h0=HINT,a0=ANIM;
 s=snaps[viewI].s;const mv=mlog[viewI-1];last=mv?[mv.fx,mv.fy,mv.tx,mv.ty]:null;sel=null;moves=[];pend=null;mate=false;HINT=null;ANIM=null;
 try{draw0()}finally{s=s0;last=l0;sel=v0;moves=m0;pend=p0;mate=t0;HINT=h0;ANIM=a0}
}
let FW=0;
function draw0(){
 if(cv.offsetWidth!==FW){FW=cv.offsetWidth;fitCanvas()}/* a layout change (rotation, tablet, window resize) re-fits the backing store */
 FLP=flipped();
 const ki=s.b.indexOf(s.t==='w'?'K':'k'),inc=check(s,s.t==='w');
 KI=inc?(FLP?63-ki:ki):-1;
 const s0=s,l0=last,v0=sel,m0=moves;
 let bd=s.b;
 if(pend){bd=bd.slice();bd[pend.ty*8+pend.tx]=bd[pend.fy*8+pend.fx];bd[pend.fy*8+pend.fx]=null;last=[pend.fx,pend.fy,pend.tx,pend.ty]}
 if(!FLP){
  try{s={...s,b:bd};drawBase()}finally{s=s0;last=l0}
 }else{
  s={...s,b:bd.slice().reverse()};last=last&&last.map(n=>7-n);sel=sel&&sel.map(n=>7-n);moves=moves.map(mir);
  try{drawBase()}finally{s=s0;last=l0;sel=v0;moves=m0}
 }
 if(needLoop())kick();
}
function drawBase(){
 const Q=TH.pal,V=TH.v,M=TH.m,t=now(),A=animOn,ki=KI,AC=a=>'rgba('+Q.hrgb+','+a+')';
 ctx.setTransform(DPR,0,0,DPR,0,0);ctx.globalAlpha=1;ctx.shadowColor='transparent';
 ctx.drawImage(bgLayer(),0,0,S,S);
 const pls=A&&M.pulse?Math.sin(t/230):0;
 for(let y=0;y<8;y++)for(let x=0;x<8;x++){
  const px=P+x*C,py=P+y*C,dk=(x+y)%2;
  if(last&&((x===last[0]&&y===last[1])||(x===last[2]&&y===last[3]))){
   if(V.lm==='edge'){ctx.fillStyle=Q.hlc;ctx.globalAlpha=.4;ctx.fillRect(px,py,C,C);ctx.globalAlpha=1;ctx.strokeStyle=Q.hls;ctx.lineWidth=3;ctx.strokeRect(px+1.5,py+1.5,C-3,C-3)}
   else{ctx.fillStyle=Q.hlc;ctx.fillRect(px,py,C,C)}
  }
  ctx.font='bold 12px '+TH.fu;ctx.fillStyle=dk?Q.ls:Q.ds;
  if(coords&&x===0){ctx.textAlign='left';ctx.textBaseline='top';ctx.fillText(FLP?y+1:8-y,P+3,py+2)}
  if(coords&&y===7){ctx.textAlign='right';ctx.textBaseline='bottom';ctx.fillText(FL[FLP?7-x:x],P+(x+1)*C-3,P+8*C-2)}
  if(y*8+x===ki){ctx.fillStyle=mate?'rgba(217,40,40,.92)':'rgba(217,83,79,'+(.5+.16*pls)+')';ctx.fillRect(px,py,C,C)}
  if(sel&&sel[0]===x&&sel[1]===y){ctx.fillStyle=AC(.5+.14*pls);ctx.fillRect(px,py,C,C)}
 }
 ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';
 const rot=!vsAI&&flipP&&s.t==='b'?{rot:Math.PI}:null,AN=A?ANIM:null,skip=new Set();
 if(AN)for(const it of AN.it){const d=dc(it.tx,it.ty);skip.add(d[1]*8+d[0])}
 if(drag.on&&sel)skip.add(sel[1]*8+sel[0]);
 s.b.forEach((p,i)=>{if(!p||skip.has(i))return;drawPiece(p,P+(i%8+.5)*C,P+((i>>3)+.55)*C,rot)});
 if(AN){
  const u=clamp01((t-AN.t0)/AN.dur),e=EASE[AN.mv](u);
  if(AN.cap){const g=dc(AN.cap.x,AN.cap.y);drawPiece(AN.cap.p,P+(g[0]+.5)*C,P+(g[1]+.55)*C,{al:clamp01(1-u*2.4),sc:1-u*.3})}
  for(const it of AN.it){
   const f=dc(it.fx,it.fy),d=dc(it.tx,it.ty);
   const at=ee=>[f[0]+(d[0]-f[0])*ee,f[1]+(d[1]-f[1])*ee];
   if(M.trail)for(let k=3;k>=1;k--){const p=at(EASE[AN.mv](clamp01(u-k*.09)));drawPiece(it.p,P+(p[0]+.5)*C,P+(p[1]+.55)*C,{al:.13*(4-k)})}
   const p=at(e);let lift=0,sc=1,sx=1;
   if(AN.mv==='arc'){
    const h=Math.sin(Math.PI*u);lift=h*C*.5;sc=1+h*.12;
    ctx.save();ctx.globalAlpha=.22*(1-h*.5);ctx.fillStyle='#000';ctx.beginPath();ctx.ellipse(P+(p[0]+.5)*C,P+(p[1]+.82)*C,C*.28*(1-h*.35),C*.07,0,0,7);ctx.fill();ctx.restore();
    if(u>.86){const q=Math.sin(Math.PI*(u-.86)/.14);sx=1+.13*q;sc=1-.1*q}
   }
   drawPiece(it.p,P+(p[0]+.5)*C,P+(p[1]+.55)*C,{lift,sc,sx,rot:rot&&rot.rot});
  }
 }
 if(drag.on&&drag.p&&sel){
  const hx=Math.floor((drag.cx-P)/C),hy=Math.floor((drag.cy-P)/C);
  if(hx>=0&&hy>=0&&hx<8&&hy<8&&moves.some(m=>m.fx===sel[0]&&m.fy===sel[1]&&m.tx===hx&&m.ty===hy)){ctx.fillStyle=AC(.38);ctx.fillRect(P+hx*C,P+hy*C,C,C)}
 }
 if(sel&&showHints)for(const m of moves)if(m.fx===sel[0]&&m.fy===sel[1])
  hintMark(P+(m.tx+.5)*C,P+(m.ty+.5)*C,!!(s.b[m.ty*8+m.tx]||m.k==='e'),V.hint,AC);
 if(mate&&bn){
  const wn=s.t==='w'?'Black':'White',y0=P+3*C,mp=A?clamp01((t-mT0)/520):1,ez=1-Math.pow(1-mp,3);
  if(mp>0){
   ctx.save();ctx.globalAlpha=ez;ctx.translate(S/2,y0+C);ctx.scale(.9+.1*ez,.55+.45*ez);ctx.translate(-S/2,-(y0+C));
   ctx.fillStyle='rgba(20,20,20,.7)';ctx.fillRect(P,y0,8*C,2*C);
   ctx.fillStyle='#d9534f';ctx.fillRect(P,y0,8*C,3);ctx.fillRect(P,y0+2*C-3,8*C,3);
   ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#fff';
   ctx.font=TH.f.dw+' '+Math.round(C*.6)+'px '+TH.fd;ctx.fillText(TH.f.tt==='uppercase'?'CHECKMATE':'CHECKMATE',S/2,y0+C*.78);
   ctx.font='500 '+Math.round(C*.34)+'px '+TH.fu;ctx.fillText(wn+' wins · tap board to hide',S/2,y0+C*1.4);
   ctx.restore();
  }
 }
 const L=P,R=P+8*C,T=P,B=R,o=10,fc=Q[V.fc==='ds'?'ds':V.fc==='fg'?'fg':'ac'];
 ctx.save();
 if(V.frame==='line'){ctx.strokeStyle=Q.fg;ctx.lineWidth=2;ctx.strokeRect(L,T,8*C,8*C)}
 else if(V.frame==='double'){ctx.strokeStyle=fc;ctx.lineWidth=2;ctx.strokeRect(L,T,8*C,8*C);ctx.lineWidth=1;ctx.strokeRect(L-5,T-5,8*C+10,8*C+10)}
 else if(V.frame==='glow'){ctx.strokeStyle=Q.ac;ctx.lineWidth=2;ctx.shadowColor=Q.ac;ctx.shadowBlur=16+(A?6*pls:0);ctx.strokeRect(L,T,8*C,8*C)}
 else if(V.frame==='thick'){ctx.strokeStyle=fc;ctx.lineWidth=7;ctx.lineJoin='miter';ctx.strokeRect(L-3.5,T-3.5,8*C+7,8*C+7)}
 else if(V.frame==='soft'){ctx.strokeStyle='rgba(0,0,0,.14)';ctx.lineWidth=1.5;ctx.strokeRect(L,T,8*C,8*C)}
 ctx.restore();
 const b=Q.b;
 if(mode==='bs'||mode==='ba'){ctx.strokeStyle=b;ctx.lineWidth=3;ctx.setLineDash([6,5]);ctx.beginPath();ctx.moveTo(L-o,T);ctx.lineTo(L-o,B);ctx.moveTo(R+o,T);ctx.lineTo(R+o,B);if(mode==='ba'){ctx.moveTo(L,T-o);ctx.lineTo(R,T-o);ctx.moveTo(L,B+o);ctx.lineTo(R,B+o)}ctx.stroke();ctx.setLineDash([])}
 if(mode==='cyl'){
  edge(L-o,FLP?T:B,L-o,FLP?B:T,b,2);
  edge(R+o,FLP?T:B,R+o,FLP?B:T,b,2);
 }
 if(typeof drawRev==='function')drawRev();
 drawHint();
 if(drag.on&&drag.p)drawPiece(drag.p,drag.cx,drag.cy+C*.05,{sc:1.2,lift:drag.touch?C*.55:0,rot:rot&&rot.rot});
 drawFx(t);
}
/* Board input: tap a piece then a target, or drag a piece onto its target. */
const drag={on:false,p:null,cx:0,cy:0,touch:false,dn:null,wasSel:false,raf:0};
function sqAt(e){
 const r=cv.getBoundingClientRect(),k=S/r.width,cx=(e.clientX-r.left)*k,cy=(e.clientY-r.top)*k,fx=cx-P,fy=cy-P;
 if(fx<0||fy<0||fx>=8*C||fy>=8*C)return null;
 let x=fx/C|0,y=fy/C|0;if(FLP){x=7-x;y=7-y}
 return{x,y,cx,cy};
}
function canPlay(){return !over&&!pend&&!busy&&!aiT()&&viewI<0&&!(typeof RV!=='undefined'&&RV.on)}
function playMove(m){
 HINT=null;const p=s.b[m.fy*8+m.fx];
 if((p==='P'&&m.ty===0)||(p==='p'&&m.ty===7)){if(autoQ)doMove({...m,pr:'q'});else askPromo(m)}else doMove(m);
}
function dragEnd(){drag.on=false;drag.p=null;drag.dn=null}
cv.addEventListener('pointerdown',e=>{
 if(over){if(mate){bn=!bn;draw()}return}
 if(e.button>0||!canPlay())return;
 const q=sqAt(e);if(!q)return;
 HINT=null;
 if(sel){const m=moves.find(m=>m.fx===sel[0]&&m.fy===sel[1]&&m.tx===q.x&&m.ty===q.y);if(m){playMove(m);return}}
 if(moves.some(m=>m.fx===q.x&&m.fy===q.y)){
  drag.wasSel=!!sel&&sel[0]===q.x&&sel[1]===q.y;sel=[q.x,q.y];drag.p=s.b[q.y*8+q.x];drag.dn={x:e.clientX,y:e.clientY,id:e.pointerId};drag.touch=e.pointerType!=='mouse';drag.cx=q.cx;drag.cy=q.cy;
  try{cv.setPointerCapture(e.pointerId)}catch(_){}
 }else{sel=null}
 draw();
});
cv.addEventListener('pointermove',e=>{
 if(!drag.dn||e.pointerId!==drag.dn.id)return;
 if(!drag.on){if(Math.hypot(e.clientX-drag.dn.x,e.clientY-drag.dn.y)<8)return;drag.on=true;if(typeof vib==='function')vib('lift')}
 const r=cv.getBoundingClientRect(),k=S/r.width;drag.cx=(e.clientX-r.left)*k;drag.cy=(e.clientY-r.top)*k;
 if(!drag.raf)drag.raf=requestAnimationFrame(()=>{drag.raf=0;if(drag.on)draw()});
});
cv.addEventListener('pointerup',e=>{
 if(!drag.dn||e.pointerId!==drag.dn.id)return;
 const was=drag.on,from=sel,q=sqAt(e);dragEnd();
 if(was&&from){
  const m=q&&moves.find(m=>m.fx===from[0]&&m.fy===from[1]&&m.tx===q.x&&m.ty===q.y);
  if(m){playMove(m);return}
  if(!(q&&q.x===from[0]&&q.y===from[1]))sel=null;
 }else if(drag.wasSel&&from&&q&&q.x===from[0]&&q.y===from[1])sel=null;
 draw();
});
cv.addEventListener('pointercancel',()=>{if(drag.dn){dragEnd();draw()}});

/* ───────── browse the game: tap a move, or use the arrows / keys ───────── */
function syncView(){
 const n=sans.length,cur=viewI<0?n:viewI,vb=document.getElementById('vb');if(!vb)return;
 vb.hidden=viewI<0;
 if(viewI>=0){const j=viewI-1,pl=j+startPly;vb.textContent=viewI===0?'Start position \u00B7 tap to return':'Move '+((pl>>1)+1)+(pl%2?'\u2026 ':'. ')+sans[j]+' \u00B7 tap to return'}
 for(const [id,off] of[['vf',cur<=0],['vp',cur<=0],['vn',cur>=n],['vl',cur>=n]])document.getElementById(id).disabled=off;
}
function viewTo(p){
 if(pend)cancelPromo();
 const n=sans.length;p=Math.max(0,Math.min(n,p));viewI=p>=n?-1:p;sel=null;HINT=null;dragEnd();
 if(typeof rvView==='function')rvView();/* sets the review arrow and eval bar before the board is drawn */
 draw();renderList();
}
const curView=()=>viewI<0?sans.length:viewI;
document.getElementById('vf').onclick=()=>viewTo(0);
document.getElementById('vp').onclick=()=>viewTo(curView()-1);
document.getElementById('vn').onclick=()=>viewTo(curView()+1);
document.getElementById('vl').onclick=()=>viewTo(sans.length);
document.getElementById('vb').onclick=()=>viewTo(sans.length);
document.getElementById('ml').onclick=e=>{const c=e.target.closest('.pl');if(c)viewTo(+c.dataset.p)};

/* ───────── hint: ask an engine for a good move and draw it as an arrow ───────── */
async function giveHint(){
 if(over||busy||pend||aiT()||viewI>=0||hintBusy)return;
 hintBusy=true;const s0=s,b=document.getElementById('ht');if(b)b.classList.add('wait');
 let u=null;
 if(mode==='flat'){try{await SF.init();const r=await SF.search(SF.toFen(s,sans.length+startPly),{movetime:700});u=SF.fromUci(r.best)}catch(e){u=null}}
 if(!u&&s===s0){try{const r=await Eng.searchAsync(mode,s,{ms:500,maxDepth:64,noise:0,hist:snaps.map(z=>z.s)});u=r&&r.move}catch(e){u=null}}
 hintBusy=false;if(b)b.classList.remove('wait');
 if(s!==s0||!u||over)return;
 sel=null;HINT=[u.fx,u.fy,u.tx,u.ty];draw();
}
function arrowAt(a,col){
 const f=dc(a[0],a[1]),t=dc(a[2],a[3]),x1=P+(f[0]+.5)*C,y1=P+(f[1]+.5)*C,x2=P+(t[0]+.5)*C,y2=P+(t[1]+.5)*C;
 const g=Math.atan2(y2-y1,x2-x1),hl=C*.36,ex=x2-Math.cos(g)*hl*.8,ey=y2-Math.sin(g)*hl*.8;
 ctx.save();ctx.globalAlpha=.85;ctx.strokeStyle=ctx.fillStyle=col;ctx.lineWidth=C*.13;ctx.lineCap='round';
 ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(ex,ey);ctx.stroke();
 ctx.beginPath();ctx.moveTo(x2,y2);ctx.lineTo(x2-Math.cos(g-.5)*hl,y2-Math.sin(g-.5)*hl);ctx.lineTo(x2-Math.cos(g+.5)*hl,y2-Math.sin(g+.5)*hl);ctx.closePath();ctx.fill();ctx.restore();
}
function drawHint(){if(HINT&&!(typeof RV!=='undefined'&&RV.on))arrowAt(HINT,TH.pal.b||'#2e9e5b')}
document.getElementById('ht').onclick=giveHint;

/* ───────── result card: rematch / review / new game ───────── */
document.getElementById('rm').onclick=()=>{if(vsAI)side=hw?'b':'w';newGame();sfx('start')};
document.getElementById('rn').onclick=()=>openMenu('new');
const tm=document.getElementById('tm');
for(const k in MODES){const b=document.createElement('button');b.id='m_'+k;b.className='opt';b.innerHTML=ICO[k]+'<span>'+MODES[k].name+'</span>';b.onclick=()=>{sM=k;stg()};tm.appendChild(b)}
document.getElementById('ng').onclick=newGame;
document.getElementById('cl').onclick=()=>{const r=claimReason();if(r&&!over)end('Draw by '+r+' (claimed)')};
document.getElementById('ag').onclick=e=>{const ag=e.currentTarget;if(ag.dataset.c)end('Draw by agreement');else{ag.dataset.c=1;ag.textContent='Both agree? Click again'}};
const LV=[['b1','Built-in · thinks up to 1 s per move'],['b3','Built-in · thinks up to 3 s per move'],['b10','Built-in · thinks up to 10 s per move'],['b30','Built-in · thinks up to 30 s per move'],['m1100','Maia 1100 · plays like a club beginner'],['m1500','Maia 1500 · plays like a club player'],['m1900','Maia 1900 · plays like a strong club player'],['s1500','Stockfish · limited to about 1500 Elo'],['s2000','Stockfish · limited to about 2000 Elo'],['s2500','Stockfish · limited to about 2500 Elo'],['s3190','Stockfish · full strength']],OPS=[['h','Two players']].concat(LV);
Object.assign(ICO,{hist:sv_('<path d="M3 12a9 9 0 109-9 9 9 0 00-6.4 2.6L3 8M3 3v5h5M12 7v5l3 2"/>'),imp:sv_('<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>')});
for(const k of MAIAS)ICO[k]='<span class="mt">'+k.slice(1)+'</span><span class="ms">Maia</span>';
const CPU2=ICO[2];
for(const k of BIDS)ICO[k]='<span class="mt">'+k.slice(1)+' s</span><span class="ms">per move</span>';
for(const k of SFIDS)ICO[k]='<span class="mt">'+(k==='s3190'?'Max':k.slice(1))+'</span><span class="ms">'+(k==='s3190'?'Stockfish':'Elo')+'</span>';
for(const [k,n] of LV){const b=document.createElement('button');b.id='o_'+k;b.className='ib mi';b.title=n;b.setAttribute('aria-label',n);b.innerHTML=ICO[k];b.onclick=()=>{sO=k;stg()};document.getElementById('tm2').appendChild(b)}
for(const [e,h,n] of[['h',ICO.h+'<span class="ms">friend</span>','Two players'],['m','<span class="mt sm">Maia</span><span class="ms">human-like</span>','Maia'],['s','<span class="mt sm">Stockfish</span><span class="ms">engine</span>','Stockfish'],['b',CPU2+'<span class="ms">built-in</span>','Built-in engine']]){const b=document.createElement('button');b.id='e_'+e;b.className='ib mi';b.title=n;b.setAttribute('aria-label',n);b.innerHTML=h;b.onclick=()=>{sO=e==='h'?'h':LAST[e];stg()};document.getElementById('to').appendChild(b)}
for(const [k,n] of SIDES){const b=document.createElement('button');b.id='c_'+k;b.className='ib';b.title=n;b.setAttribute('aria-label',n);b.innerHTML='<span class="disc '+(k==='b'?'k':k)+'"></span>';b.onclick=()=>{sS=k;stg()};document.getElementById('tc').appendChild(b)}
const mn=document.getElementById('mn'),mu=document.getElementById('menu'),hb=document.getElementById('hint');
mn.onclick=()=>openMenu(mn.classList.contains('alert')?'game':lastTab);
hb.onclick=()=>{showHints=!showHints;try{localStorage.setItem('cos_hints',showHints?'1':'0')}catch(e){}updHint();draw()};
updHint();
const sb=document.getElementById('snd'),fb=document.getElementById('flip'),wb=document.getElementById('wake');
let AC=null,wake=null,wakeErr=!NA&&!navigator.wakeLock;
function sv(k,v){try{localStorage.setItem(k,v?'1':'0')}catch(e){}}
function closeMenu(){if(NA)try{NA.menuState(false)}catch(e){}document.getElementById('menu').classList.remove('open');document.getElementById('sbg').classList.remove('show');document.getElementById('mn').setAttribute('aria-expanded','false')}
const pb=document.getElementById('fp'),fsb=document.getElementById('fs'),FSE=document.documentElement,fsOK=!!NA||!!(FSE.requestFullscreen||FSE.webkitRequestFullscreen);let nfs=false;
const inFS=()=>NA?nfs:!!(document.fullscreenElement||document.webkitFullscreenElement);
function ac(){try{if(!AC)AC=new(window.AudioContext||window.webkitAudioContext)();if(AC.state==='suspended')AC.resume()}catch(e){AC=null}return AC}
function tn(f,t,d,ty,v,f2){const a=ac();if(!a)return;const o=a.createOscillator(),g=a.createGain(),T=a.currentTime+t;o.type=ty;o.frequency.setValueAtTime(f,T);if(f2)o.frequency.exponentialRampToValueAtTime(f2,T+d);g.gain.setValueAtTime(.0001,T);g.gain.exponentialRampToValueAtTime(v,T+.008);g.gain.exponentialRampToValueAtTime(.0001,T+d);o.connect(g);g.connect(a.destination);o.start(T);o.stop(T+d+.02)}
function ns(t,d,v,fc){const a=ac();if(!a)return;const n=a.sampleRate*d|0,buf=a.createBuffer(1,n,a.sampleRate),da=buf.getChannelData(0);for(let i=0;i<n;i++)da[i]=(Math.random()*2-1)*(1-i/n);const sr=a.createBufferSource(),fl=a.createBiquadFilter(),g=a.createGain();sr.buffer=buf;fl.type='bandpass';fl.frequency.value=fc;g.gain.value=v;sr.connect(fl);fl.connect(g);g.connect(a.destination);sr.start(a.currentTime+t)}
function sfx(k){vib(k);if(!snd||!TH)return;(KITS[TH.k[0]]||KITS.wood)(k,TH.k[1])}
async function wl(){
 if(NA){try{NA.keepAwake(!!keep)}catch(e){}wakeErr=false;updWake();return}
 if(!keep){if(wake){try{await wake.release()}catch(e){}wake=null}updWake();return}
 if(wake||document.visibilityState!=='visible')return;
 if(!navigator.wakeLock){wakeErr=true;updWake();return}
 try{wake=await navigator.wakeLock.request('screen');wakeErr=false;wake.addEventListener('release',()=>{wake=null;if(keep&&document.visibilityState==='visible')setTimeout(wl,300)})}catch(e){wake=null;wakeErr=true}
 updWake();
}
sb.onclick=()=>{snd=!snd;sv('cos_snd',snd);updSnd();sfx('move')};
fb.onclick=()=>{flipT=!flipT;sv('cos_flip',flipT);updFlip();draw();renderList()};
pb.onclick=()=>{flipP=!flipP;sv('cos_fp',flipP);updFP();draw()};
fsb.onclick=async()=>{if(NA){nfs=!nfs;try{NA.setFullscreen(nfs)}catch(e){}updFS();closeMenu();return}try{if(inFS())await(document.exitFullscreen||document.webkitExitFullscreen).call(document);else await(FSE.requestFullscreen||FSE.webkitRequestFullscreen).call(FSE);closeMenu()}catch(e){fsb.textContent='Fullscreen: Blocked here'}};
document.addEventListener('fullscreenchange',()=>{updFS();wl()});document.addEventListener('webkitfullscreenchange',updFS);
wb.onclick=()=>{keep=!keep;sv('cos_wake',keep);wl()};
document.getElementById('ng').onclick=()=>{mode=sM;vsAI=sO!=='h';if(vsAI)setOpp(sO);side=sS;TCS[1]=[sMin,sInc,tcl(sMin,sInc)];tc=sT;try{localStorage.setItem('cos_tc2',tc);localStorage.setItem('cos_tcv',JSON.stringify([sMin,sInc]))}catch(e){}newGame();sfx('start');closeMenu()};
document.addEventListener('visibilitychange',wl);
document.addEventListener('pointerdown',()=>{ac();wl()});
const ubt=document.getElementById('ub'),rsb=document.getElementById('rs'),fmb=document.getElementById('fm'),lab=(b,t)=>b.querySelector('span').textContent=t;
ubt.onclick=undo;fmb.onclick=()=>{mf=!mf;draw();renderList()};
rsb.onclick=()=>{if(over)return;if(!rsb.dataset.c){rsb.dataset.c=1;lab(rsb,'Sure?');setTimeout(()=>{delete rsb.dataset.c;lab(rsb,'Resign')},2500);return}delete rsb.dataset.c;lab(rsb,'Resign');const w=vsAI?hw:s.t==='w';end((w?'White':'Black')+' resigns \u2014 '+(w?'Black':'White')+' wins')};
for(const [m,i] of[[0,0],[1,0],[3,2],[5,0],[10,0],[15,10]]){const b=document.createElement('button');b.className='pre';b.dataset.m=m;b.dataset.i=i;b.textContent=m?tcl(m,i):'\u221E';b.setAttribute('aria-label',m?m+' minutes plus '+i+' seconds':'No clock');b.onclick=()=>{if(m)sT=1,sMin=m,sInc=i;else sT=0;stg()};document.getElementById('tpre').appendChild(b)}
document.getElementById('tcs').innerHTML='<div class="step"><span>Minutes</span><div><button data-f="m" data-d="-1" aria-label="Less minutes">\u2212</button><input id="tmin" type="number" inputmode="decimal" min="0.5" max="180" step="0.5"><button data-f="m" data-d="1" aria-label="More minutes">+</button></div></div><div class="step"><span>Increment (sec)</span><div><button data-f="i" data-d="-1" aria-label="Less increment">\u2212</button><input id="tinc" type="number" inputmode="numeric" min="0" max="60" step="1"><button data-f="i" data-d="1" aria-label="More increment">+</button></div></div>';
document.querySelectorAll('#tcs button').forEach(b=>b.onclick=()=>{const d=+b.dataset.d;if(b.dataset.f==='m')sMin=Math.min(180,Math.max(.5,Math.round((sMin+d)*2)/2));else sInc=Math.min(60,Math.max(0,sInc+d));sT=1;stg()});
document.getElementById('tmin').oninput=e=>{const v=parseFloat(e.target.value);if(v>0){sMin=Math.min(180,Math.max(.5,v));sT=1;stg()}};
document.getElementById('tinc').oninput=e=>{const v=parseInt(e.target.value);if(v>=0){sInc=Math.min(60,v);sT=1;stg()}};
document.querySelectorAll('details.dd').forEach(d=>d.addEventListener('toggle',()=>{if(d.open)d.parentNode.querySelectorAll('details.dd').forEach(o=>{if(o!==d)o.open=false})}));
async function cpt(t,b){try{if(NA)NA.copy(t);else await navigator.clipboard.writeText(t)}catch(e){const a=document.createElement('textarea');a.value=t;document.body.appendChild(a);a.select();try{document.execCommand('copy')}catch(_){}a.remove()}b.textContent='Copied \u2713';setTimeout(()=>b.textContent=b.dataset.l,1200)}
document.getElementById('cpg').onclick=e=>cpt(pgn(),e.currentTarget);document.getElementById('cfn').onclick=e=>cpt(fen(),e.currentTarget);
document.getElementById('nw').onclick=()=>openMenu('new');
document.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>tab(b.dataset.t));
document.getElementById('sbg').onclick=closeMenu;
{let p0=null;const g=document.getElementById('menu');
g.addEventListener('touchstart',e=>{const t=e.touches[0];p0={x:t.clientX,y:t.clientY,top:g.scrollTop<=0}},{passive:true});
g.addEventListener('touchend',e=>{if(!p0)return;const t=e.changedTouches[0],dx=t.clientX-p0.x,dy=t.clientY-p0.y,sh=document.documentElement.dataset.sheet,H=Math.abs(dx)>Math.abs(dy)*1.5;
 const ok=sh==='drawer'?dx>90&&H:sh==='drawerL'?dx<-90&&H:sh==='top'?dy<-80&&Math.abs(dy)>Math.abs(dx):sh==='full'?false:(dy>80&&p0.top&&Math.abs(dy)>Math.abs(dx));
 if(ok)closeMenu();p0=null},{passive:true})}
const aqb=document.getElementById('aq'),crb=document.getElementById('crd');
function updAQ(){swr(aqb,'Auto-queen promotions',autoQ?'On':'Off',autoQ)}
function updCrd(){swr(crb,'Board coordinates',coords?'On':'Off',coords)}
aqb.onclick=()=>{autoQ=!autoQ;sv('cos_aq',autoQ);updAQ()};
crb.onclick=()=>{coords=!coords;sv('cos_crd',coords);updCrd();BGC=null;draw()};
updAQ();updCrd();
document.getElementById('hap').onclick=()=>{hapt=!hapt;sv('cos_hap',hapt);updHap();vib('cap')};
for(const t of THEMES){const b=document.createElement('button');b.className='opt th';b.id='th_'+t.id;
 b.innerHTML=chipOf(t)+'<span class="tn"><b style="font-family:'+stackD(t)+';font-weight:'+t.f.dw+';text-transform:'+(t.f.tt||'none')+';letter-spacing:'+(t.f.tls||0)+'">'+t.name+'</b><small>'+descr(t)+'</small></span>'+sw5(t.sw);
 b.onclick=e=>{applyTheme(t.id,e);sfx('start')};document.getElementById('thg').appendChild(b)}
function updAnm(){swr(document.getElementById('anm'),'Animations',animOn?'On':'Off',animOn)}
document.getElementById('anm').onclick=()=>{setAnim(!animOn);if(!animOn){ANIM=null;FXL=[]}updAnm();draw()};
const MP={theme:'Theme',bottom:'Bottom',drawer:'Side'};
function updMnu(){swr(document.getElementById('mst'),'Menu style',MP[menuPref],menuPref!=='theme')}
document.getElementById('mst').onclick=()=>{const k=Object.keys(MP);menuPref=k[(k.indexOf(menuPref)+1)%k.length];try{localStorage.setItem('cos_menu',menuPref)}catch(e){}
 const R=document.documentElement;R.classList.add('nt');themeCore(theme);updMnu();requestAnimationFrame(()=>requestAnimationFrame(()=>R.classList.remove('nt')))};
document.getElementById('mx').onclick=closeMenu;
window.__back=()=>{if(document.getElementById('menu').classList.contains('open')){closeMenu();return true}if(typeof RV!=='undefined'&&RV.on){closeReview();return true}if(pend){cancelPromo();return true}return false};
addEventListener('resize',moveInd);if(document.fonts)document.fonts.ready.then(()=>{moveInd();if(typeof s!=='undefined'&&s)draw()});
applyTheme(theme,null,true);updHap();updAnm();updMnu();
updSnd();updFlip();updFP();updFS();updWake();wl();
document.getElementById('pk').addEventListener('click',e=>{if(e.target===e.currentTarget)cancelPromo()});
document.addEventListener('keydown',e=>{if(e.ctrlKey||e.metaKey||e.altKey)return;const k=e.key.toLowerCase();
 if(typeof RV!=='undefined'&&RV.on){/* review open: arrows step through the game, the game shortcuts stay off */
  if(k==='escape')closeReview();else if(k==='arrowleft')viewTo(curView()-1);else if(k==='arrowright')viewTo(curView()+1);else if(k==='home')viewTo(0);else if(k==='end')viewTo(sans.length);
  return}
 if(k==='escape'){cancelPromo();closeMenu()}else if(k==='z'||k==='u')undo();else if(k==='arrowleft')viewTo(curView()-1);else if(k==='arrowright')viewTo(curView()+1);else if(k==='home')viewTo(0);else if(k==='end')viewTo(sans.length);else if(k==='h')giveHint();else if(k==='f')fmb.click();else if(k==='n')openMenu('new');else if(k==='m')openMenu('set')});
addEventListener('resize',placePromo);addEventListener('resize',fitCanvas);addEventListener('orientationchange',()=>setTimeout(fitCanvas,150));
if(window.ResizeObserver)new ResizeObserver(fitCanvas).observe(cv);
if(!loadGame())newGame();
