/* Game review: analyse every position with Stockfish (default), Maia, or the built-in engine (variant surfaces),
   then grade each move by how much win-probability it gave away. Loaded after app.js and shares its globals. */
const RV={on:false,eng:'sf',ml:1500,tok:0,i:0,POS:[],MV:[],data:null,cache:{},gid:'',saved:null,arrow:null};
try{RV.eng=localStorage.cos_rveng||'sf';RV.ml=+localStorage.cos_rvml||1500}catch(e){}
const $r=id=>document.getElementById(id);
const CLS=[['Best','#2e9e5b','Best moves'],['Good','#6aa84f','Good moves'],['Inaccuracy','#d9a400','Inaccuracies'],['Mistake','#e67e22','Mistakes'],['Blunder','#d9392b','Blunders']];
/* Maia has no search, so its value head misses tactics: add an exact mate-in-1 check */
function mate1(P,L){for(const m of L){const Q=apply(P,m);if(!legal(Q).length&&check(Q,Q.t==='w'))return true}return false}
const rvEngine=()=>mode!=='flat'?'bi':RV.eng==='mj'?'mj':'sf';
const sameMv=(a,b)=>a&&b&&a.fx===b.fx&&a.fy===b.fy&&a.tx===b.tx&&a.ty===b.ty&&(a.pr||'q')===(b.pr||'q');
const NAMES={sf:'Stockfish',mj:'Maia',bi:'Built-in'};

function rvSync(){
 const ok=over&&sans.length>0;
 $r('rvb').hidden=!(ok&&!RV.on);$r('rvg').disabled=!ok;
}
function openReview(){
 if(!over||!sans.length||RV.on)return;
 const POS=[...snaps.map(z=>z.s),s];
 if(POS.length!==mlog.length+1)return;
 closeMenu();
 const st=$r('st');
 RV.saved={s,last,moves,sel,pend,mate,txt:st.textContent,cls:st.className};
 RV.POS=POS;RV.MV=mlog.slice();
 const gid=sans.join(' ')+'|'+mode;if(gid!==RV.gid){RV.gid=gid;RV.cache={}}
 RV.on=true;RV.i=POS.length-1;sel=null;pend=null;
 document.body.classList.add('rvm');$r('rv').hidden=false;rvSync();
 rvStart();
}
function closeReview(){
 if(!RV.on)return;
 RV.tok++;if(typeof SF!=='undefined')SF.stop();
 const v=RV.saved;s=v.s;last=v.last;moves=v.moves;sel=v.sel;pend=v.pend;mate=v.mate;
 const st=$r('st');st.textContent=v.txt;st.className=v.cls;
 RV.on=false;RV.arrow=null;document.body.classList.remove('rvm');$r('rv').hidden=true;
 rvSync();draw();
}
function rvButtons(){
 const eg=rvEngine(),b=$r('rvEng');
 b.innerHTML='';
 const mk=(k,t)=>{const e=document.createElement('button');e.textContent=t;e.className=eg===k?'on':'';e.onclick=()=>{if(k==='bi'||eg===k)return;RV.eng=k;try{localStorage.cos_rveng=k}catch(x){}rvStart()};b.appendChild(e)};
 if(eg==='bi')mk('bi','Built-in engine');else{mk('sf','Stockfish');mk('mj','Maia')}
 const l=$r('rvLv');l.hidden=eg!=='mj';l.innerHTML='';
 for(const v of[1100,1500,1900]){const e=document.createElement('button');e.textContent='Maia '+v;e.className=RV.ml===v?'on':'';e.onclick=()=>{RV.ml=v;try{localStorage.cos_rvml=v}catch(x){}rvStart()};l.appendChild(e)}
}
async function rvStart(){
 const eg=rvEngine(),key=eg==='mj'?'mj'+RV.ml:eg,tok=++RV.tok;
 if(typeof SF!=='undefined')SF.stop();
 rvButtons();RV.key=key;
 if(RV.cache[key]){RV.data=RV.cache[key];return rvShow()}
 RV.data=null;RV.arrow=null;$r('rvR').hidden=true;$r('rvP').hidden=false;$r('rvBar').style.width='0';$r('rvPt').textContent='Starting '+NAMES[eg]+'…';
 let d=null;
 try{d=await rvAnalyse(eg,tok)}catch(e){
  if(tok!==RV.tok)return;
  $r('rvPt').textContent=NAMES[eg]+' could not run here'+(eg==='sf'?'. Try Maia instead.':'.');$r('rvBar').style.width='0';return;
 }
 if(!d||tok!==RV.tok)return;
 RV.cache[key]=d;RV.data=d;rvShow();
}
async function rvAnalyse(eg,tok){
 const n=RV.POS.length,ev=new Array(n),best=new Array(n),ex=new Array(n);
 const prog=i=>{if(tok!==RV.tok)return;$r('rvBar').style.width=(100*i/n)+'%';$r('rvPt').textContent='Analysing position '+i+' of '+n+' · '+NAMES[eg]+(eg==='mj'?' '+RV.ml:'')};
 let net=null;
 if(eg==='mj')net=await Maia.load(RV.ml);
 if(eg==='sf')await SF.init();
 try{
  for(let i=0;i<n;i++){
   if(tok!==RV.tok)return null;
   const P=RV.POS[i],L=legal(P),w=P.t==='w';
   if(!L.length){ev[i]=check(P,w)?(w?0:100):50;best[i]=null;ex[i]={term:check(P,w)?(w?'0–1':'1–0'):'½–½'};prog(i+1);continue}
   const mv=i<n-1?RV.MV[i]:null;
   if(eg==='sf'){
    const r=await SF.search(SF.toFen(P,i),{depth:14,movetime:600});if(tok!==RV.tok)return null;
    const wp=SF.winPct(r);ev[i]=w?wp:100-wp;best[i]=SF.fromUci(r.best);
    ex[i]={cp:r.cp==null?null:(w?r.cp:-r.cp),mate:r.mate==null?null:(w?r.mate:-r.mate)};
   }else if(eg==='mj'){
    const a=Maia.analyse(net,RV.POS.slice(Math.max(0,i-7),i+1),L,mv),m1=mate1(P,L),sc=m1?100:(a.wdl[0]+a.wdl[1]/2)*100;
    ev[i]=w?sc:100-sc;best[i]=a.best;ex[i]={m1,wdl:w?a.wdl:[a.wdl[2],a.wdl[1],a.wdl[0]],pp:a.pPlayed,rank:a.rank,bp:a.best&&a.best.p};
    await new Promise(r=>setTimeout(r,0));
   }else{
    Eng.setMode(mode);const r=Eng.search(P,{ms:350}),wp=SF.winPct({cp:r.cp});ev[i]=w?wp:100-wp;best[i]=r.move;ex[i]={cp:w?r.cp:-r.cp};
    await new Promise(r=>setTimeout(r,0));
   }
   prog(i+1);
  }
 }finally{}
 return rvFinish({ev,best,ex},eg);
}
function rvFinish(d,eg){
 const n=RV.POS.length;d.loss=[];d.cls=[];d.acc=[0,0];d.nm=[0,0];d.cnt=[[0,0,0,0,0],[0,0,0,0,0]];
 for(let j=0;j<n-1;j++){
  const w=RV.POS[j].t==='w',l=Math.max(0,w?d.ev[j]-d.ev[j+1]:d.ev[j+1]-d.ev[j]);
  d.loss[j]=l;
  const c=(sameMv(d.best[j],RV.MV[j])&&l<5)||l<1?0:l<5?1:l<10?2:l<20?3:4;
  d.cls[j]=c;const sd=w?0:1;
  d.acc[sd]+=Math.max(0,Math.min(100,103.1668*Math.exp(-0.04354*l)-3.1669));d.nm[sd]++;d.cnt[sd][c]++;
 }
 d.acc=d.acc.map((v,i)=>d.nm[i]?v/d.nm[i]:null);
 return d;
}
function rvEv(i){
 const e=RV.data.ex[i],eg=rvEngine();
 if(e.term)return e.term;
 if(e.mate!=null)return(e.mate>0?'M':'−M')+Math.abs(e.mate);
 if(e.cp!=null){const v=e.cp/100;return(v>0?'+':v<0?'−':'')+Math.abs(v).toFixed(1)}
 if(e.m1)return(RV.POS[i].t==='w'?'White':'Black')+' mates in 1';
 if(e.wdl)return Math.round(RV.data.ev[i])+'% White';
 return'';
}
function rvShow(){
 const d=RV.data;$r('rvP').hidden=true;$r('rvR').hidden=false;
 const f=v=>v==null?'–':Math.round(v)+'%',row=(l,a,b,c)=>'<span'+(c?' style="color:'+c+'"':'')+'>'+l+'</span><b>'+a+'</b><b>'+b+'</b>';
 $r('rvS').innerHTML='<span></span><b>White</b><b>Black</b>'+row('Accuracy',f(d.acc[0]),f(d.acc[1]))+[4,3,2].map(k=>row(CLS[k][2],d.cnt[0][k],d.cnt[1][k],CLS[k][1])).join('');
 rvGo(RV.i);
}
function rvGraph(){
 const cv=$r('rvG'),w=cv.clientWidth||300,h=64,dpr=window.devicePixelRatio||1,d=RV.data,n=RV.POS.length;
 cv.width=w*dpr;cv.height=h*dpr;const g=cv.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);
 const X=i=>n>1?i/(n-1)*w:0,Y=v=>h-v/100*h;
 g.fillStyle='#3a3a38';g.fillRect(0,0,w,h);
 g.fillStyle='#f1efe8';g.beginPath();g.moveTo(0,h);for(let i=0;i<n;i++)g.lineTo(X(i),Y(d.ev[i]));g.lineTo(w,h);g.closePath();g.fill();
 g.strokeStyle='rgba(128,128,128,.7)';g.beginPath();g.moveTo(0,h/2);g.lineTo(w,h/2);g.stroke();
 for(let j=0;j<n-1;j++)if(d.cls[j]>=3){g.fillStyle=CLS[d.cls[j]][1];g.beginPath();g.arc(X(j+1),Y(d.ev[j+1]),3.2,0,7);g.fill()}
 g.strokeStyle='#2e7dd7';g.lineWidth=2;g.beginPath();g.moveTo(X(RV.i),0);g.lineTo(X(RV.i),h);g.stroke();
}
function rvSan(P,bm){
 const L=legal(P),m=L.find(x=>x.fx===bm.fx&&x.fy===bm.fy&&x.tx===bm.tx&&x.ty===bm.ty);
 return m?san(P,bm.pr?{...m,pr:bm.pr}:m,L):'?';
}
function rvGo(i){
 const n=RV.POS.length,d=RV.data;if(!d)return;
 i=Math.max(0,Math.min(n-1,i));RV.i=i;
 const j=i-1,mv=j>=0?RV.MV[j]:null,st=$r('st');
 s=RV.POS[i];last=mv?[mv.fx,mv.fy,mv.tx,mv.ty]:null;moves=[];sel=null;pend=null;mate=false;
 st.className='';st.textContent=i===0?'Start position':(j>>1)+1+(j%2?'… ':'. ')+sans[j];
 let h='',arrow=null;
 if(j>=0){
  const c=d.cls[j],bm=d.best[j],eg=rvEngine(),P=RV.POS[j],lossT=d.loss[j]>=1?' (−'+d.loss[j].toFixed(0)+'% win chance)':'';
  h='<b style="color:'+CLS[c][1]+'">'+CLS[c][0]+'</b>'+lossT+' · eval '+rvEv(i);
  if(eg==='mj'){
   const e=d.ex[j];
   h+='<br>'+Math.round(e.pp*100)+'% of Maia '+RV.ml+' players would play '+sans[j];
   if(bm&&e.rank!==0){h+='<br>Most likely: <b>'+rvSan(P,bm)+'</b> ('+Math.round(e.bp*100)+'%)';arrow=[bm.fx,bm.fy,bm.tx,bm.ty]}
  }else if(c>0&&bm){h+='<br>Best was <b>'+rvSan(P,bm)+'</b>';arrow=[bm.fx,bm.fy,bm.tx,bm.ty]}
 }else h='Start position · eval '+rvEv(0);
 if(i===n-1&&d.ex[i].term)h+='<br>'+d.ex[i].term;
 $r('rvC').innerHTML=h;RV.arrow=arrow;
 rvGraph();draw();
}
function drawRev(){
 if(!RV.on||!RV.arrow)return;
 const a=RV.arrow,f=dc(a[0],a[1]),t=dc(a[2],a[3]),x1=P+(f[0]+.5)*C,y1=P+(f[1]+.5)*C,x2=P+(t[0]+.5)*C,y2=P+(t[1]+.5)*C;
 const g=Math.atan2(y2-y1,x2-x1),hl=C*.36,ex=x2-Math.cos(g)*hl*.8,ey=y2-Math.sin(g)*hl*.8;
 ctx.save();ctx.globalAlpha=.85;ctx.strokeStyle=ctx.fillStyle='#2e9e5b';ctx.lineWidth=C*.13;ctx.lineCap='round';
 ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(ex,ey);ctx.stroke();
 ctx.beginPath();ctx.moveTo(x2,y2);ctx.lineTo(x2-Math.cos(g-.5)*hl,y2-Math.sin(g-.5)*hl);ctx.lineTo(x2-Math.cos(g+.5)*hl,y2-Math.sin(g+.5)*hl);ctx.closePath();ctx.fill();ctx.restore();
}
function rvNextMistake(){
 const d=RV.data;if(!d)return;const m=d.cls.length;
 for(let k=0;k<m;k++){const j=(RV.i+k)%m;if(d.cls[j]>=3&&j+1!==RV.i){rvGo(j+1);return}}
 $r('rvC').innerHTML='No mistakes or blunders found.';
}
$r('rvb').onclick=openReview;$r('rvg').onclick=openReview;$r('rvX').onclick=closeReview;
$r('rvFirst').onclick=()=>rvGo(0);$r('rvPrev').onclick=()=>rvGo(RV.i-1);$r('rvNext').onclick=()=>rvGo(RV.i+1);$r('rvLast').onclick=()=>rvGo(RV.POS.length-1);
$r('rvM').onclick=rvNextMistake;
$r('rvG').onclick=e=>{const r=e.currentTarget.getBoundingClientRect();rvGo(Math.round((e.clientX-r.left)/r.width*(RV.POS.length-1)))};
rvSync();
