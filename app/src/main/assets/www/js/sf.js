/* Stockfish (WASM, single-thread lite) wrapper: one worker, one search at a time. Classical rules only. */
(function(){
const FL='abcdefgh';
let w=null,ready=null,cur=null,chain=Promise.resolve();
function init(){
 if(ready)return ready;
 ready=new Promise((res,rej)=>{
  let st=0;const to=setTimeout(()=>{rej(new Error('Stockfish did not start'))},20000);
  try{w=new Worker('js/sf/stockfish.js')}catch(e){clearTimeout(to);return rej(e)}
  w.onerror=e=>{clearTimeout(to);rej(new Error(e&&e.message||'worker error'))};
  w.onmessage=ev=>{
   const l=String(ev.data);
   if(st===0&&l==='uciok'){st=1;w.postMessage('setoption name Hash value 16');w.postMessage('isready')}
   else if(st===1&&l==='readyok'){st=2;clearTimeout(to);w.onmessage=on;w.onerror=()=>crash('Stockfish stopped unexpectedly');res()}
  };
  w.postMessage('uci');
 });
 ready.catch(()=>{ready=null;if(w){try{w.terminate()}catch(e){}w=null}});
 return ready;
}
/* the worker died or stopped answering: fail the search in progress and let the next one start a fresh worker */
function crash(msg,quiet){
 const c=cur;cur=null;ready=null;
 if(w){try{w.terminate()}catch(e){}w=null}
 if(c){clearTimeout(c.t);clearTimeout(c.t2);const e=new Error(msg);e.crashed=!quiet;c.rej(e)}
}
function on(ev){
 const l=String(ev.data);if(!cur)return;
 if(l.startsWith('info')&&/ score /.test(l)&&!/ lowerbound| upperbound/.test(l)){
  const m=l.match(/ score (cp|mate) (-?\d+)/),d=l.match(/ depth (\d+)/),pv=l.match(/ pv (.+)$/);
  if(m){cur.cp=m[1]==='cp'?+m[2]:null;cur.mate=m[1]==='mate'?+m[2]:null;cur.depth=d?+d[1]:cur.depth;if(pv)cur.pv=pv[1].split(' ')}
 }else if(l.startsWith('bestmove')){
  const c=cur;cur=null;clearTimeout(c.t);clearTimeout(c.t2);
  c.res({best:l.split(' ')[1],cp:c.cp,mate:c.mate,depth:c.depth,pv:c.pv||[]});
 }
}
/* app state -> FEN. ply = number of half-moves already played (for the move counter). */
function toFen(s,ply){
 const r=[];for(let y=0;y<8;y++){let t='',n=0;for(let x=0;x<8;x++){const p=s.b[y*8+x];if(p){if(n)t+=n;n=0;t+=p}else n++}if(n)t+=n;r.push(t)}
 return r.join('/')+' '+s.t+' '+(s.c||'-')+' '+(s.ep?FL[s.ep.sq[0]]+(8-s.ep.sq[1]):'-')+' '+(s.hm||0)+' '+((ply>>1)+1);
}
/* opt: {movetime, depth, elo (limit strength; omit for full strength)}. Resolves {best,cp,mate,depth,pv} from the side to move's view. */
function search(fen,opt){
 opt=opt||{};
 const run=()=>init().then(()=>new Promise((res,rej)=>{
  const c={res,rej,cp:null,mate:null,pv:null};
  c.t=setTimeout(()=>{try{w.postMessage('stop')}catch(e){}c.t2=setTimeout(()=>crash('Stockfish did not answer'),3000)},(opt.movetime||1000)+8000);
  cur=c;
  w.postMessage('setoption name UCI_LimitStrength value '+(opt.elo?'true':'false'));
  if(opt.elo)w.postMessage('setoption name UCI_Elo value '+Math.max(1320,Math.min(3190,opt.elo)));
  w.postMessage('position fen '+fen);
  w.postMessage('go'+(opt.depth?' depth '+opt.depth:'')+(opt.movetime?' movetime '+opt.movetime:'')+(!opt.depth&&!opt.movetime?' movetime 500':''));
 }));
 /* one retry on a fresh worker if Stockfish crashed mid-search */
 const run2=()=>run().catch(e=>{if(e&&e.crashed)return run();throw e});
 const p=chain.then(run2,run2);chain=p.catch(()=>{});return p;
}
function stop(){if(cur&&w)try{w.postMessage('stop')}catch(e){}}
/* abandon everything: used when a new game starts while the engine is still thinking */
function reset(){if(cur||w)crash('cancelled',true);chain=Promise.resolve()}
/* Convert a Stockfish UCI move to the app's {fx,fy,tx,ty,pr} */
function fromUci(u){return{fx:FL.indexOf(u[0]),fy:8-u[1],tx:FL.indexOf(u[2]),ty:8-u[3],pr:u[4]||undefined}}
/* centipawns / mate -> white's win percentage (lichess curve), from the side to move's view first */
function winPct(r){
 if(r.mate!=null)return r.mate>0?100:r.mate<0?0:50;
 return 50+50*(2/(1+Math.exp(-0.00368208*(r.cp||0)))-1);
}
window.SF={init,search,stop,reset,toFen,fromUci,winPct};
})();
