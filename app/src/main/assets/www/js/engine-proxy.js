/* Eng.searchAsync(mode, state, opts): the built-in engine's search in a Web Worker, so the board stays responsive while it thinks.
   Falls back to the synchronous search on the UI thread if workers are unavailable or die. Eng.cancel() abandons a search in progress. */
(function(){
 const Eng=window.Eng;if(!Eng)return;
 let w=null,seq=0,off=false;const pending=new Map();
 function kill(why){
  const p=[...pending.values()];pending.clear();
  try{w&&w.terminate()}catch(e){}w=null;
  for(const q of p)q.rej(new Error(why));
 }
 function start(){
  if(w||off)return;
  try{
   w=new Worker('js/engine-worker.js');
   w.onmessage=ev=>{const m=ev.data,p=pending.get(m.id);if(!p)return;pending.delete(m.id);m.err?p.rej(new Error(m.err)):p.res(m.r)};
   w.onerror=()=>{off=true;kill('engine worker failed')};
   w.postMessage({cmd:'init',id:0,base:new URL('./',location.href).href});
  }catch(e){off=true;w=null}
 }
 Eng.searchAsync=function(mode,s,opts){
  const local=()=>{Eng.setMode(mode);return Eng.search(s,opts)};
  start();
  if(!w)return Promise.resolve().then(local);
  return new Promise((res,rej)=>{const id=++seq;pending.set(id,{res,rej});w.postMessage({cmd:'search',id,mode,s,opts})})
   .catch(e=>{if(String(e.message)==='cancelled')throw e;return local()});
 };
 Eng.cancel=()=>{if(w&&pending.size)kill('cancelled')};
})();
