/* Chess Variants — game archive and PGN / FEN import.
   Finished games are saved to localStorage (cos_hist, newest first). Any PGN, saved game or FEN pasted into Import
   goes through importGame(). Loaded after app.js and shares its globals. */
const HKEY='cos_hist',HMAX=40;
const $g=id=>document.getElementById(id);
let curArchId=null;

/* ───────── archive ───────── */
function histRead(){try{const a=JSON.parse(localStorage.getItem(HKEY)||'[]');return Array.isArray(a)?a:[]}catch(e){return[]}}
function histWrite(a){try{localStorage.setItem(HKEY,JSON.stringify(a.slice(0,HMAX)))}catch(e){}}
/* the review of a saved game is stored with it (one analysis per game: the latest) */
function histRvGet(key){const r=histRead().find(x=>x.id===curArchId);return r&&r.rv&&r.rv.key===key?r.rv.data:null}
function histRvSet(key,data){if(!curArchId)return;const a=histRead(),r=a.find(x=>x.id===curArchId);if(!r)return;r.rv={key,data};histWrite(a)}
function oppName(){return !vsAI?'Two players':mlv?'Maia '+mlv:slv?'Stockfish'+(slv<3190?' '+slv:' max'):'Built-in engine'}
function archiveGame(){
 const t=$g('st').textContent,res=/White wins/.test(t)?'1-0':/Black wins/.test(t)?'0-1':'1/2-1/2';
 const a=histRead(),id=Date.now();curArchId=id;a.unshift({id,pgn:pgn(),res,txt:t,n:sans.length,opp:oppName(),mode,you:vsAI?(hw?'w':'b'):''});
 histWrite(a);histRender();
}
function histRender(){
 const a=histRead(),el=$g('hl');if(!el)return;
 $g('hcount').textContent=a.length?'('+a.length+')':'';
 el.innerHTML=a.length?'':'<div class="cap">No finished games yet.</div>';
 for(const r of a){
  const d=new Date(r.id),w=r.you?(r.res==='1/2-1/2'?'Draw':(r.res==='1-0')===(r.you==='w')?'Won':'Lost'):r.res;
  const row=document.createElement('div');row.className='hr';
  row.innerHTML='<div class="hm"><b class="r'+(w==='Won'?' win':w==='Lost'?' loss':'')+'">'+w+'</b><span>'+r.opp+(r.mode&&r.mode!=='flat'?' · '+MODES[r.mode].name:'')+'</span><small>'+Math.ceil(r.n/2)+' moves · '+d.toLocaleDateString(undefined,{day:'numeric',month:'short'})+'</small></div>'+
   '<button data-a="o">Open</button><button data-a="r">Review</button><button data-a="c" aria-label="Copy PGN">PGN</button><button data-a="d" aria-label="Delete">✕</button>';
  row.onclick=e=>{
   const b=e.target.closest('button');if(!b)return;
   if(b.dataset.a==='o')guardGo(b,()=>importGame(r.pgn,{from:'history',id:r.id}));
   else if(b.dataset.a==='r')guardGo(b,()=>{if(importGame(r.pgn,{from:'history',id:r.id}))openReview()});
   else if(b.dataset.a==='c'){b.dataset.l='PGN';cpt(r.pgn,b)}
   else if(b.dataset.a==='d'){histWrite(histRead().filter(x=>x.id!==r.id));histRender()}
  };
  el.appendChild(row);
 }
}

/* ───────── PGN parsing ───────── */
function parsePGN(text){
 const tags={};text.replace(/\[(\w+)\s+"([^"]*)"\]/g,(m,k,v)=>{tags[k]=v;return m});
 let b=text.replace(/\[[^\]]*\]/g,' ').replace(/\{[^}]*\}/g,' ').replace(/;[^\n]*/g,' ');
 for(let i=0;i<8&&/\(/.test(b);i++)b=b.replace(/\([^()]*\)/g,' ');
 b=b.replace(/\$\d+/g,' ').replace(/\d+\s*\.(\s*\.\.)?/g,' ');
 let res=tags.Result||'*';const tk=[];
 for(let t of b.split(/\s+/)){
  if(!t)continue;
  if(/^(1-0|0-1|1\/2-1\/2|\*)$/.test(t)){res=t;continue}
  t=t.replace(/[!?]+$/,'');if(t)tk.push(t);
 }
 return{tags,moves:tk,res};
}
function sanKey(t){
 return t.replace(/0/g,'O').replace(/[+#]/g,'').replace(/[!?]/g,'').replace(/([a-h][18])([qrbnQRBN])$/,'$1=$2').replace(/=([qrbn])$/,(m,c)=>'='+c.toUpperCase());
}
/* The legal move in state st that a SAN (or coordinate) token names, or null. */
function moveFromToken(st,L,tok){
 const m0=/^([a-h][1-8])([a-h][1-8])([qrbnQRBN])?$/.exec(tok);
 if(m0){
  const f='abcdefgh'.indexOf(m0[1][0]),fy=8-m0[1][1],t='abcdefgh'.indexOf(m0[2][0]),ty=8-m0[2][1];
  const m=L.find(x=>x.fx===f&&x.fy===fy&&x.tx===t&&x.ty===ty);
  return m?(m0[3]?{...m,pr:m0[3].toLowerCase()}:m):null;
 }
 const key=sanKey(tok);
 for(const m of L){
  const p=st.b[m.fy*8+m.fx],promo=(p==='P'&&m.ty===0)||(p==='p'&&m.ty===7);
  for(const z of promo?['q','r','b','n']:[null]){
   const mm=z?{...m,pr:z}:m;
   if(san(st,mm,L)===key)return mm;
  }
 }
 return null;
}
const VARIANT_OF=n=>Object.keys(MODES).find(k=>MODES[k].name===n)||'flat';

/* ───────── import ───────── */
function setMsg(t,bad){const e=$g('impMsg');if(e){e.textContent=t;e.className='cap'+(bad?' bad':'')}}
function importGame(text,opt){
 opt=opt||{};text=String(text||'').trim();
 if(!text){setMsg('Paste a PGN or a FEN first.',1);return false}
 const looksPGN=/\[\w+\s+"/.test(text)||/\d+\s*\.\s*[A-Za-hO0]/.test(text);
 if(!looksPGN){
  const first=text.split('\n')[0],p=parseFEN(first);
  if(!p){setMsg('That is not a valid FEN or PGN.',1);return false}
  side=p.s.t;newGame(first);
  closeMenu();setMsg('');sfx('start');
  return true;
 }
 const g=parsePGN(text),M=VARIANT_OF(g.tags.Variant),m0=mode;
 const fen0=g.tags.FEN&&parseFEN(g.tags.FEN)?g.tags.FEN:undefined;
 /* dry run on a scratch position so a bad PGN never disturbs the current game */
 mode=M;
 const st0=parseFEN(fen0||START).s;let st=st0;const list=[];
 for(let i=0;i<g.moves.length;i++){
  const L=legal(st),m=moveFromToken(st,L,g.moves[i]);
  if(!m){mode=m0;setMsg('Could not read move '+(i+1)+' ("'+g.moves[i]+'").',1);return false}
  list.push({fx:m.fx,fy:m.fy,tx:m.tx,ty:m.ty,pr:m.pr});st=apply(st,m);
 }
 if(!list.length&&!fen0){mode=m0;setMsg('No moves found in that PGN.',1);return false}
 vsAI=false;tc=0;newGame(fen0);
 if(!replayMoves(list)){newGame();setMsg('Could not replay that game.',1);return false}
 archived=opt.from==='history';curArchId=opt.id||null;sel=null;ANIM=null;FXL=[];tk=Date.now();
 status();
 if(!over){
  const w=g.res==='1-0'?'White wins':g.res==='0-1'?'Black wins':g.res==='1/2-1/2'?'Draw':'';
  if(w)end(w+(opt.from==='history'?'':' — imported game'));
 }
 viewTo(0);
 closeMenu();setMsg('');sfx('start');
 return true;
}
const impTxt=$g('imp');
/* loading replaces the game in progress, so ask once (confirm() is not available in the WebView) */
function guardGo(b,fn){
 if(over||!sans.length||b.dataset.c){delete b.dataset.c;if(b.dataset.t)b.textContent=b.dataset.t;return fn()}
 b.dataset.t=b.textContent;b.dataset.c='1';b.textContent='Replace game?';
 setTimeout(()=>{if(b.dataset.c){delete b.dataset.c;b.textContent=b.dataset.t}},3000);
}
$g('impGo').onclick=e=>guardGo(e.currentTarget,()=>importGame(impTxt.value));
$g('impPaste').onclick=async()=>{
 try{const t=await navigator.clipboard.readText();if(t){impTxt.value=t;setMsg('')}else setMsg('Clipboard is empty.',1)}
 catch(e){setMsg('Paste is blocked here: long-press the box and choose Paste.',1)}
};
histRender();
