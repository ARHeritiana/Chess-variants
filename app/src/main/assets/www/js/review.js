/* Game review: every position is analysed (Stockfish by default, Maia, or the built-in engine on the variant surfaces),
   then each move is graded by the win probability it gave away. The review drives the normal move browser (viewTo), so the
   board, the move list and the keys behave the same in and out of review. Loaded after app.js and games.js and shares their globals. */
const RV={on:false,eng:'sf',ml:1500,q:1,tok:0,i:0,POS:[],MV:[],data:null,cache:{},gid:'',saved:null,arrow:null,arrow2:null,stage:'sum',key:''};
try{RV.eng=localStorage.cos_rveng||'sf';RV.ml=+localStorage.cos_rvml||1500;RV.q=+localStorage.cos_rvq;if(!(RV.q>=0&&RV.q<=2))RV.q=1}catch(e){}
const $r=id=>document.getElementById(id);
/* name, colour, plural, badge symbol */
const CLS=[['Best','#2e9e5b','Best moves','★'],['Excellent','#62a84a','Excellent moves','!'],['Good','#98ad3a','Good moves','✓'],
 ['Inaccuracy','#d9a400','Inaccuracies','?!'],['Mistake','#e67e22','Mistakes','?'],['Blunder','#d9392b','Blunders','??']];
const QUAL=[['Fast',250,10],['Standard',600,14],['Deep',1500,18]];
const rvEngine=()=>mode!=='flat'?'bi':RV.eng==='mj'?'mj':'sf';
const sameMv=(a,b)=>a&&b&&a.fx===b.fx&&a.fy===b.fy&&a.tx===b.tx&&a.ty===b.ty&&(a.pr||'q')===(b.pr||'q');
const NAMES={sf:'Stockfish',mj:'Maia',bi:'Built-in'};
const rvKey=eg=>eg==='mj'?'mj'+RV.ml:eg+'q'+RV.q;
/* Maia has no search, so its value head misses tactics: add an exact mate-in-1 check */
function mate1(P,L){for(const m of L){const Q=apply(P,m);if(!legal(Q).length&&check(Q,Q.t==='w'))return true}return false}

/* can a review be started right now? (any game with moves, as long as the computer is not mid-move) */
function rvAllowed(){return !RV.on&&sans.length>0&&!busy&&!(aiT()&&!over)}
function rvSync(){
 $r('rvb').hidden=!(over&&sans.length>0&&!RV.on);
 $r('rvg').disabled=!rvAllowed();
}
function openReview(){
 if(!rvAllowed())return;
 const POS=[...snaps.map(z=>z.s),s];
 if(POS.length!==mlog.length+1)return;
 closeMenu();if(pend)cancelPromo();
 const st=$r('st');
 RV.saved={txt:st.textContent,cls:st.className};
 RV.POS=POS;RV.MV=mlog.slice();
 const gid=sans.join(' ')+'|'+mode+'|'+startFen;if(gid!==RV.gid){RV.gid=gid;RV.cache={}}
 RV.on=true;RV.i=0;RV.data=null;RV.arrow=RV.arrow2=null;RV.stage='sum';sel=null;HINT=null;
 document.body.classList.add('rvm');$r('rv').hidden=false;rvSync();
 rvStart();
}
function closeReview(){
 if(!RV.on)return;
 RV.tok++;if(typeof SF!=='undefined')SF.stop();if(Eng.cancel)Eng.cancel();
 RV.on=false;RV.arrow=RV.arrow2=null;document.body.classList.remove('rvm');$r('rv').hidden=true;
 const st=$r('st');st.textContent=RV.saved.txt;st.className=RV.saved.cls;
 tk=Date.now();rvSync();viewTo(sans.length);
}
function rvButtons(){
 const eg=rvEngine(),b=$r('rvEng'),l=$r('rvLv');
 b.innerHTML='';l.innerHTML='';
 const mk=(host,t,on,fn)=>{const e=document.createElement('button');e.textContent=t;e.className=on?'on':'';e.onclick=fn;host.appendChild(e)};
 if(eg==='bi')mk(b,'Built-in engine',true,()=>{});
 else for(const [k,t] of[['sf','Stockfish'],['mj','Maia']])mk(b,t,eg===k,()=>{if(eg===k)return;RV.eng=k;try{localStorage.cos_rveng=k}catch(x){}rvStart()});
 if(eg==='mj')for(const v of[1100,1500,1900])mk(l,'Maia '+v,RV.ml===v,()=>{RV.ml=v;try{localStorage.cos_rvml=v}catch(x){}rvStart()});
 else QUAL.forEach((q,i)=>mk(l,q[0],RV.q===i,()=>{RV.q=i;try{localStorage.cos_rvq=i}catch(x){}rvStart()}));
}
async function rvStart(){
 const eg=rvEngine(),key=rvKey(eg),tok=++RV.tok;
 if(typeof SF!=='undefined')SF.stop();
 rvButtons();RV.key=key;
 let d=RV.cache[key]||rvSaved(key,eg);
 if(d){RV.cache[key]=d;RV.data=d;return rvShow()}
 RV.data=null;RV.arrow=null;$r('rvR').hidden=true;$r('rvP').hidden=false;$r('rvBar').style.width='0';$r('rvPt').textContent='Starting '+NAMES[eg]+'…';
 try{d=await rvAnalyse(eg,tok)}catch(e){
  if(tok!==RV.tok)return;
  $r('rvPt').textContent=NAMES[eg]+' could not run here'+(eg==='sf'?'. Try Maia instead.':'.');$r('rvBar').style.width='0';return;
 }
 if(!d||tok!==RV.tok)return;
 RV.cache[key]=d;RV.data=d;rvSave(key,d);rvShow();
}
/* analysed games are kept with their saved game, so reopening a review is instant */
function rvSaved(key,eg){
 try{const raw=typeof histRvGet==='function'&&histRvGet(key);return raw&&raw.ev&&raw.ev.length===RV.POS.length?rvFinish(raw,eg):null}catch(e){return null}
}
function rvSave(key,d){
 try{if(typeof histRvSet==='function')histRvSet(key,{ev:d.ev.map(v=>Math.round(v*10)/10),best:d.best,ex:d.ex})}catch(e){}
}
async function rvAnalyse(eg,tok){
 const n=RV.POS.length,ev=new Array(n),best=new Array(n),ex=new Array(n),Q=QUAL[RV.q];
 const prog=i=>{if(tok!==RV.tok)return;$r('rvBar').style.width=(100*i/n)+'%';$r('rvPt').textContent='Analysing position '+i+' of '+n+' · '+NAMES[eg]+(eg==='mj'?' '+RV.ml:'')};
 let net=null;
 if(eg==='mj')net=await Maia.load(RV.ml);
 if(eg==='sf')await SF.init();
 for(let i=0;i<n;i++){
  if(tok!==RV.tok)return null;
  const P=RV.POS[i],L=legal(P),w=P.t==='w';
  if(!L.length){ev[i]=check(P,w)?(w?0:100):50;best[i]=null;ex[i]={term:check(P,w)?(w?'0–1':'1–0'):'½–½'};prog(i+1);continue}
  const mv=i<n-1?RV.MV[i]:null;
  if(eg==='sf'){
   const r=await SF.search(SF.toFen(P,i+startPly),{depth:Q[2],movetime:Q[1]});if(tok!==RV.tok)return null;
   const wp=SF.winPct(r);ev[i]=w?wp:100-wp;best[i]=SF.fromUci(r.best);
   ex[i]={cp:r.cp==null?null:(w?r.cp:-r.cp),mate:r.mate==null?null:(w?r.mate:-r.mate),pv:(r.pv||[]).slice(0,8)};
  }else if(eg==='mj'){
   const a=await Maia.analyse(net,RV.POS.slice(Math.max(0,i-7),i+1),L,mv);if(tok!==RV.tok)return null;const m1=mate1(P,L),sc=m1?100:(a.wdl[0]+a.wdl[1]/2)*100;
   ev[i]=w?sc:100-sc;best[i]=a.best;ex[i]={m1,wdl:w?a.wdl:[a.wdl[2],a.wdl[1],a.wdl[0]],pp:a.pPlayed,rank:a.rank,bp:a.best&&a.best.p};
  }else{
   const r=await Eng.searchAsync(mode,P,{ms:[150,350,900][RV.q]});if(tok!==RV.tok)return null;
   const wp=SF.winPct({cp:r.cp});ev[i]=w?wp:100-wp;best[i]=r.move;ex[i]={cp:w?r.cp:-r.cp};
  }
  prog(i+1);
 }
 return rvFinish({ev,best,ex},eg);
}
/* ev = White's win % per position; a move's loss is how much the mover's win % fell */
function rvFinish(d,eg){
 const n=RV.POS.length;d.loss=[];d.cls=[];d.acc=[0,0];d.nm=[0,0];d.cnt=[[0,0,0,0,0,0],[0,0,0,0,0,0]];
 for(let j=0;j<n-1;j++){
  const w=RV.POS[j].t==='w',l=Math.max(0,w?d.ev[j]-d.ev[j+1]:d.ev[j+1]-d.ev[j]);
  d.loss[j]=l;
  const c=(sameMv(d.best[j],RV.MV[j])&&l<5)||l<.5?0:l<2?1:l<5?2:l<10?3:l<20?4:5;
  d.cls[j]=c;const sd=w?0:1;
  d.acc[sd]+=Math.max(0,Math.min(100,103.1668*Math.exp(-0.04354*l)-3.1669));d.nm[sd]++;d.cnt[sd][c]++;
 }
 d.acc=d.acc.map((v,i)=>d.nm[i]?v/d.nm[i]:null);
 return d;
}
function rvEv(i){
 const e=RV.data.ex[i];
 if(e.term)return e.term;
 if(e.mate!=null)return(e.mate>0?'M':'−M')+Math.abs(e.mate);
 if(e.cp!=null){const v=e.cp/100;return(v>0?'+':v<0?'−':'')+Math.abs(v).toFixed(1)}
 if(e.m1)return(RV.POS[i].t==='w'?'White':'Black')+' mates in 1';
 if(e.wdl)return Math.round(RV.data.ev[i])+'% White';
 return'';
}
/* stage 'sum': accuracy, graph, counts, key moments.  stage 'walk': step through the game with feedback and arrows. */
function rvStage(st){
 RV.stage=st;
 $r('rvSumBox').hidden=st!=='sum';$r('rvWalk').hidden=st!=='walk';
 requestAnimationFrame(rvGraph);
}
function rvShow(){
 const d=RV.data;$r('rvP').hidden=true;$r('rvR').hidden=false;
 const f=v=>v==null?'\u2013':Math.round(v),row=(l,a,b,c)=>'<span style="color:'+c+'"><i class="dot" style="background:'+c+'"></i>'+l+'</span><b>'+a+'</b><b>'+b+'</b>';
 const card=(who,a)=>'<div class="ac"><span>'+who+'</span><b>'+f(a)+'</b><small>accuracy</small></div>';
 $r('rvAcc').innerHTML=card('White',d.acc[0])+card('Black',d.acc[1]);
 $r('rvOverview').innerHTML=['w','b'].map(side=>{
  const js=d.loss.map((loss,j)=>({loss,j})).filter(x=>RV.POS[x.j].t===side).sort((a,b)=>b.loss-a.loss);
  if(!js.length)return '';
  const {j,loss}=js[0],who=side==='w'?'White':'Black',bm=d.best[j];
  return '<div class="rl"><b>'+who+'</b>: '+(loss<5?'no major loss of winning chances.':'largest loss at <button class="lnk" data-p="'+(j+1)+'">'+rvMoveLabel(j)+'</button> (−'+Math.round(loss)+' percentage points).'+(bm&&!sameMv(bm,RV.MV[j])?' Review '+rvSan(RV.POS[j],bm)+' as an alternative.':''))+'</div>';
 }).join('');
 $r('rvOverview').onclick=e=>{const b=e.target.closest('[data-p]');if(b){rvStage('walk');viewTo(+b.dataset.p)}};
 $r('rvS').innerHTML='<span></span><b>White</b><b>Black</b>'+CLS.map((c,k)=>row(c[2],d.cnt[0][k],d.cnt[1][k],c[1])).join('');
 const km=rvMoments();
 $r('rvM').disabled=$r('rvPM').disabled=!km.length;
 $r('rvK').innerHTML=km.length?'<div class="lb">Key moments</div>'+km.map(j=>{const pl=j+startPly;
   return '<button class="km" data-p="'+(j+1)+'" style="border-color:'+CLS[d.cls[j]][1]+'"><b style="color:'+CLS[d.cls[j]][1]+'">'+CLS[d.cls[j]][3]+'</b> '+((pl>>1)+1)+(pl%2?'\u2026':'.')+' '+sans[j]+'</button>'}).join(''):'<div class="rl dim">No critical moments found.</div>';
 $r('rvK').onclick=e=>{const b=e.target.closest('.km');if(b){rvStage('walk');viewTo(+b.dataset.p)}};
 $r('rvNotes').innerHTML=d.cls.map((c,j)=>'<button class="rvnote" data-p="'+(j+1)+'"><b>'+rvMoveLabel(j)+' · '+CLS[c][0]+'</b><small>'+rvComment(j)+'</small></button>').join('');
 $r('rvNotes').onclick=e=>{const b=e.target.closest('[data-p]');if(b){rvStage('walk');viewTo(+b.dataset.p)}};
 rvStage('sum');viewTo(0);
}
function rvGraph(){for(const id of['rvG','rvG2'])rvGraph1($r(id))}
function rvGraph1(cv){
 const box=cv.getBoundingClientRect(),w=box.width,h=box.height,dpr=Math.min(3,window.devicePixelRatio||1),d=RV.data,n=RV.POS.length;if(!RV.on||!d||!w||!h)return;
 cv.width=Math.round(w*dpr);cv.height=Math.round(h*dpr);const g=cv.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);
 const X=i=>4+(n>1?i/(n-1)*(w-8):0),Y=v=>h-4-Math.max(0,Math.min(100,v))/100*(h-8);
 g.fillStyle='#3a3a38';g.fillRect(0,0,w,h);
 g.fillStyle='#f1efe8';g.beginPath();g.moveTo(0,h);for(let i=0;i<n;i++)g.lineTo(X(i),Y(d.ev[i]));g.lineTo(w,h);g.closePath();g.fill();
 g.strokeStyle='rgba(128,128,128,.7)';g.beginPath();g.moveTo(0,h/2);g.lineTo(w,h/2);g.stroke();
 for(let j=0;j<n-1;j++)if(d.cls[j]>=3){g.fillStyle=CLS[d.cls[j]][1];g.beginPath();g.arc(X(j+1),Y(d.ev[j+1]),d.cls[j]===5?3.6:3,0,7);g.fill()}
 if(RV.stage==='walk'||RV.i>0){g.strokeStyle=(TH&&TH.pal.ac)||'#2e7dd7';g.lineWidth=2;g.beginPath();g.moveTo(X(RV.i),0);g.lineTo(X(RV.i),h);g.stroke()}
}
function rvSan(P,bm){
 const L=legal(P),m=L.find(x=>x.fx===bm.fx&&x.fy===bm.fy&&x.tx===bm.tx&&x.ty===bm.ty);
 return m?san(P,bm.pr?{...m,pr:bm.pr}:m,L):'?';
}
/* a UCI line from position P as numbered SAN, e.g. "12. Nf3 Nc6 13. Bb5" */
function rvLine(P,ply,uci){
 let st=P,out=[],pl=ply;
 for(const u of uci||[]){
  const L=legal(st),m=L.find(x=>x.fx==='abcdefgh'.indexOf(u[0])&&x.fy===8-u[1]&&x.tx==='abcdefgh'.indexOf(u[2])&&x.ty===8-u[3]);
  if(!m)break;const mm=u[4]?{...m,pr:u[4]}:m;
  out.push((pl%2===0?((pl>>1)+1)+'. ':out.length?'':((pl>>1)+1)+'… ')+san(st,mm,L));st=apply(st,mm);pl++;
 }
 return out.join(' ');
}
/* called by viewTo while a review is open: commentary, arrow, graph and status for the position on the board */
function rvView(){
 const d=RV.data;if(!RV.on||!d)return;
 const n=RV.POS.length,i=Math.min(curView(),n-1),j=i-1,st=$r('st');RV.i=i;
 st.className='';
 if(RV.stage==='sum'&&i>0)rvStage('walk');
 if(RV.stage==='sum'){st.textContent='Game review';RV.arrow=RV.arrow2=null;rvGraph();return}
 let h='',arrow=null,arrow2=null;
 if(j>=0){
  const c=d.cls[j],bm=d.best[j],eg=rvEngine(),P=RV.POS[j],pl=j+startPly,ex=d.ex[j],mv=RV.MV[j];
  st.textContent=((pl>>1)+1)+(pl%2?'\u2026 ':'. ')+sans[j];
  const lossT=d.loss[j]>=1?' <span class="dim">(\u2212'+d.loss[j].toFixed(0)+'% win chance)</span>':'';
  h='<div class="rh"><span class="bdg" style="background:'+CLS[c][1]+'">'+CLS[c][3]+'</span><div><b>'+sans[j]+'</b> \u00B7 <b style="color:'+CLS[c][1]+'">'+CLS[c][0]+'</b>'+lossT+'<br><span class="dim">'+(P.t==='w'?'White':'Black')+' \u00B7 evaluation '+rvEv(i)+'</span></div></div>';
  if(eg==='mj'){
   h+='<div class="rl">'+Math.round(ex.pp*100)+'% of Maia '+RV.ml+' players would play '+sans[j]+'.</div>';
   if(bm&&ex.rank!==0){h+='<div class="rl">The most likely move was <b>'+rvSan(P,bm)+'</b> ('+Math.round(ex.bp*100)+'%).</div>';arrow=[bm.fx,bm.fy,bm.tx,bm.ty]}
  }else{
   const alt=bm&&!sameMv(bm,mv)?rvSan(P,bm):'';
   h+='<div class="rl">'+[
    'This was the best move.',
    alt?'Excellent, almost as good as <b>'+alt+'</b>.':'Excellent.',
    alt?'A fine move. The engine preferred <b>'+alt+'</b>.':'A fine move.',
    'An inaccuracy. <b>'+alt+'</b> was better.',
    'A mistake. <b>'+alt+'</b> was better.',
    'A blunder. <b>'+alt+'</b> was best.'][c]+'</div>';
   if(alt){arrow=[bm.fx,bm.fy,bm.tx,bm.ty];if(c>=3)arrow2=[mv.fx,mv.fy,mv.tx,mv.ty]}
   const ln=c>0&&ex.pv&&ex.pv.length>1?rvLine(P,pl,ex.pv):'';
   if(ln)h+='<div class="rl dim">Best line: '+ln+'</div>';
   else if(c===0){const e2=d.ex[i],l2=e2&&e2.pv&&e2.pv.length?rvLine(RV.POS[i],i+startPly,e2.pv):'';if(l2)h+='<div class="rl dim">Then: '+l2+'</div>'}
   if(c>=3&&(ex.mate>0&&P.t==='w'||ex.mate<0&&P.t==='b'))h+='<div class="rl"><b>This missed a forced mate.</b></div>';
  }
 }else{
  st.textContent='Start position';
  h='<div class="rh"><div><b>Start position</b><br><span class="dim">Evaluation '+rvEv(0)+'. Press Next to see each move.</span></div></div>';
 }
 if(j>=0)h+='<div class="rl">'+rvComment(j)+'</div>';
 if(i===n-1){h+='<div class="rl">'+(d.ex[i].term?'<b>'+d.ex[i].term+'</b> \u00B7 ':'')+'End of the game. <button class="lnk" id="rvEnd">Back to the summary</button></div>'}
 $r('rvC').innerHTML=h;RV.arrow=arrow;RV.arrow2=arrow2;
 const be=$r('rvEnd');if(be)be.onclick=()=>{rvStage('sum');viewTo(0)};
 $r('rvPrev').disabled=i<=0;$r('rvNext').disabled=i>=n-1;
 rvGraph();
}
/* eval bar in the board's left margin, best-move arrow and the grade badge on the moved piece */
function drawRev(){
 if(!RV.on)return;
 const d=RV.data;
 if(d){
  const wp=Math.max(0,Math.min(100,d.ev[RV.i]))/100,x=4,w=10,y=P,h=8*C,wh=h*wp;
  ctx.save();
  ctx.fillStyle='#2b2b2b';ctx.fillRect(x,y,w,h);
  ctx.fillStyle='#f4f2ea';if(FLP)ctx.fillRect(x,y,w,wh);else ctx.fillRect(x,y+h-wh,w,wh);
  ctx.strokeStyle='rgba(128,128,128,.8)';ctx.lineWidth=1;ctx.strokeRect(x+.5,y+.5,w-1,h-1);
  ctx.beginPath();ctx.moveTo(x,y+h/2);ctx.lineTo(x+w,y+h/2);ctx.stroke();
  ctx.restore();
 }
 if(RV.arrow2)arrowAt(RV.arrow2,'#d9392b');
 if(RV.arrow)arrowAt(RV.arrow,'#2e9e5b');
 if(d&&RV.i>0){
  const j=RV.i-1,c=d.cls[j],mv=RV.MV[j];
  if(mv&&(c===0||c>=3)){
   const t=dc(mv.tx,mv.ty),cx=P+(t[0]+1)*C-C*.2,cy=P+t[1]*C+C*.2;
   ctx.save();ctx.fillStyle=CLS[c][1];ctx.strokeStyle='rgba(255,255,255,.9)';ctx.lineWidth=2;
   ctx.beginPath();ctx.arc(cx,cy,C*.19,0,7);ctx.fill();ctx.stroke();
   ctx.fillStyle='#fff';ctx.font='700 '+Math.round(C*.2)+'px '+(TH.fu||'sans-serif');ctx.textAlign='center';ctx.textBaseline='middle';
   ctx.fillText(CLS[c][3],cx,cy+1);ctx.restore();
  }
 }
}
/* Critical moves include errors, changes in the favourite, mate and promotions. */
function rvMoments(){
 const d=RV.data;if(!d)return[];
 return d.cls.map((c,j)=>c>=3||(d.ev[j]<=40&&d.ev[j+1]>=60)||(d.ev[j]>=60&&d.ev[j+1]<=40)||
  /[=#]/.test(sans[j])||d.ex[j+1].term&&!d.ex[j].term||d.ex[j+1].mate!=null&&d.ex[j].mate==null?j:-1).filter(j=>j>=0);
}
function rvMoveLabel(j){const pl=j+startPly;return ((pl>>1)+1)+(pl%2?'… ':'. ')+sans[j]}
function rvComment(j){
 const d=RV.data,P=RV.POS[j],Q=RV.POS[j+1],m=RV.MV[j],who=P.t==='w'?'White':'Black';
 const names={p:'pawn',n:'knight',b:'bishop',r:'rook',q:'queen',k:'king'},pc=P.b[m.fy*8+m.fx].toLowerCase(),piece=names[pc];
 const target='abcdefgh'[m.tx]+(8-m.ty),captured=P.b[m.ty*8+m.tx],parts=[];
 const checked=check(Q,Q.t==='w'),replies=legal(Q);
 if(checked&&!replies.length)return 'Checkmate. '+who+' wins with '+sans[j]+'.';
 if(!checked&&!replies.length)return 'Stalemate. The side to move has no legal move, so the game is drawn.';
 if(m.k==='c')parts.push(who+' castles, moving the king and rook together.');
 else if(m.pr)parts.push(who+' promotes to a '+names[m.pr.toLowerCase()]+(captured?', capturing the '+names[captured.toLowerCase()]:'')+'.');
 else if(captured||m.k==='e')parts.push(who+' captures '+(m.k==='e'?'a pawn en passant':'the '+names[captured.toLowerCase()])+' on '+target+'.');
 else if(check(P,P.t==='w'))parts.push(who+' answers the check with '+sans[j]+'.');
 else if((pc==='n'||pc==='b')&&m.fy===(P.t==='w'?7:0))parts.push(who+' develops the '+piece+' to '+target+'.');
 else parts.push(who+' moves the '+piece+' to '+target+'.');
 if(checked)parts.push('This gives check.');
 const loss=d.loss[j],bm=d.best[j],alt=bm&&!sameMv(bm,m)?rvSan(P,bm):'',before=d.ex[j].mate,after=d.ex[j+1].mate;
 const hadMate=before!=null&&(P.t==='w'?before>0:before<0);
 if(hadMate&&(after==null||(P.t==='w'?after<0:after>0)))parts.push('Misses a forced mate'+(alt?'; '+alt+' was the way to keep it.':'.'));
 else if(loss>=5)parts.push('Gives up about '+Math.round(loss)+' percentage points of winning chances.'+(alt?' '+(rvEngine()==='mj'?'Maia preferred ':'Better: ')+alt+'.':''));
 else if(d.ev[j]>=40&&d.ev[j]<=60&&d.ev[j+1]>=40&&d.ev[j+1]<=60&&!checked)parts.push('The position stays balanced.');
 else if(alt&&d.cls[j]>0)parts.push((rvEngine()==='mj'?'Maia preferred ':'The engine preferred ')+alt+'.');
 return parts.join(' ');
}
function rvJump(dir){
 const km=rvMoments(),current=RV.i-1;if(!km.length)return;
 const j=dir>0?km.find(j=>j>current):km.slice().reverse().find(j=>j<current);
 rvStage('walk');viewTo((j==null?(dir>0?km[0]:km[km.length-1]):j)+1);
}
$r('rvb').onclick=openReview;$r('rvg').onclick=openReview;$r('rvX').onclick=closeReview;
$r('rvM').onclick=()=>rvJump(1);$r('rvPM').onclick=()=>rvJump(-1);
$r('rvGo').onclick=()=>{rvStage('walk');viewTo(1)};
$r('rvBack').onclick=()=>{rvStage('sum');viewTo(0)};
$r('rvPrev').onclick=()=>viewTo(curView()-1);$r('rvNext').onclick=()=>viewTo(curView()+1);
for(const id of['rvG','rvG2'])$r(id).onclick=e=>{const b=e.currentTarget.getBoundingClientRect();rvStage('walk');if(RV.data&&b.width)viewTo(Math.round((e.clientX-b.left)/b.width*(RV.POS.length-1)))};
rvSync();

addEventListener('resize',rvGraph);
if(window.ResizeObserver){const ro=new ResizeObserver(rvGraph);for(const id of ['rvG','rvG2'])ro.observe($r(id))}
