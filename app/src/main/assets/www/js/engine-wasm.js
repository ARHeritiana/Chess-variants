/* Rust/WebAssembly build of the built-in engine (engine-rs/). Loads asynchronously and then replaces
   Eng.search / legalMoves / perft / evalState with the WASM versions. The pure-JS engine in engine.js stays
   in place as the fallback: it plays until the module has loaded, and takes over again if WASM fails. */
(function(root){
'use strict';
const Eng=root.Eng;if(!Eng)return;
const JS={search:Eng.search,legalMoves:Eng.legalMoves,perft:Eng.perft,evalState:Eng.evalState,setMode:Eng.setMode};
const MODE={flat:0,cyl:1,bs:2,ba:3},PCH='PNBRQK',POS=68,HIST=72,O_MOVE=40000,O_CP=40001,O_DEPTH=40002,O_NODES=40003,O_LIST=40010,IO_LEN=48000;
let X=null,mem=null,cur='flat';
function io(){return new Int32Array(mem.buffer,X.io_ptr(),IO_LEN)}
function enc(a,s,off){
 const b=s.b;
 for(let i=0;i<64;i++){const c=b[i];a[off+i]=c?PCH.indexOf(c.toUpperCase())+1+(c<'a'?0:8):0}
 const cs=s.c||'';
 a[off+64]=s.t==='w'?0:1;
 a[off+65]=(cs.includes('K')?1:0)|(cs.includes('Q')?2:0)|(cs.includes('k')?4:0)|(cs.includes('q')?8:0);
 a[off+66]=s.ep?s.ep.sq[1]*8+s.ep.sq[0]:-1;
 a[off+67]=s.hm||0;
}
function toApp(m){
 const f=m&63,t=(m>>6)&63,fl=m>>12,o={fx:f&7,fy:f>>3,tx:t&7,ty:t>>3};
 if(fl===1){const q=(f+t)>>1;o.k='d';o.mx=q&7;o.my=q>>3}
 else if(fl===2)o.k='e';
 else if(fl===3||fl===4)o.k='c';
 else if(fl>=5&&fl!==8)o.pr='nbr'[fl-5];
 return o;
}
function fail(e){try{console.error('WASM engine disabled, using JS engine:',e)}catch(_){}X=null;Eng.engine='js'}
Eng.setMode=function(m){cur=m;JS.setMode(m);if(X)try{X.set_mode(MODE[m]|0)}catch(e){fail(e)}};
Eng.search=function(s,opts){
 if(!X)return JS.search(s,opts);
 try{
  opts=opts||{};
  const H=opts.hist||[],lim=Math.min(H.length,Math.max(0,Math.min(s.hm||0,400)));
  const a=io();enc(a,s,0);
  for(let i=0;i<lim;i++)enc(a,H[H.length-lim+i],HIST+i*POS);
  X.set_seed((Math.random()*4294967296)>>>0,(Math.random()*4294967296)>>>0);
  const ok=X.search(opts.ms||1000,opts.maxDepth||0,opts.noise||0,lim);
  if(!ok)return null;
  const o=io();
  return{move:toApp(o[O_MOVE]),cp:o[O_CP],depth:o[O_DEPTH],nodes:o[O_NODES]>>>0};
 }catch(e){fail(e);return JS.search(s,opts)}
};
Eng.legalMoves=function(s){
 if(!X)return JS.legalMoves(s);
 try{const a=io();enc(a,s,0);const n=X.legal_moves(),o=io(),r=[];for(let i=0;i<n;i++)r.push(toApp(o[O_LIST+i]));return r}
 catch(e){fail(e);return JS.legalMoves(s)}
};
Eng.perft=function(s,d){
 if(!X)return JS.perft(s,d);
 try{const a=io();enc(a,s,0);return X.perft(d)}catch(e){fail(e);return JS.perft(s,d)}
};
Eng.evalState=function(s){
 if(!X)return JS.evalState(s);
 try{const a=io();enc(a,s,0);return X.eval()}catch(e){fail(e);return JS.evalState(s)}
};
Eng.engine='js';
/* bytes: ArrayBuffer/Uint8Array of engine.wasm. Resolves true when active. */
Eng.initWasm=async function(bytes){
 try{
  const r=await WebAssembly.instantiate(bytes,{env:{now_ms:()=>Date.now()+(typeof performance!=='undefined'?performance.now()%1:0)}});
  const x=r.instance.exports;mem=x.memory;x.init();X=x;
  x.set_mode(MODE[cur]|0);Eng.engine='rust-wasm';
  return true;
 }catch(e){fail(e);return false}
};
if(typeof fetch==='function'&&typeof window!=='undefined'&&root===window){
 fetch('js/rs/engine.wasm').then(r=>{if(!r.ok)throw new Error('HTTP '+r.status);return r.arrayBuffer()}).then(b=>Eng.initWasm(b)).catch(fail);
}
})(typeof window!=='undefined'?window:globalThis);
