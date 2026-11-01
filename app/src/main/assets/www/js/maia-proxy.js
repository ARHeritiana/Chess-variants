/* Maia API used by the app: load(elo) -> handle, pick(handle,hist,legal), analyse(handle,hist,legal,played). All async.
   Work happens in js/maia-worker.js; if workers are unavailable it runs on the UI thread through MaiaCore. */
(function(){
 let w=null,seq=0,off=false;const pending=new Map();
 function kill(why){const p=[...pending.values()];pending.clear();try{w&&w.terminate()}catch(e){}w=null;for(const q of p)q.rej(new Error(why))}
 function start(){
  if(w||off)return;
  try{
   w=new Worker('js/maia-worker.js');
   w.onmessage=ev=>{const m=ev.data,p=pending.get(m.id);if(!p)return;pending.delete(m.id);m.err?p.rej(new Error(m.err)):p.res(m.r)};
   w.onerror=()=>{off=true;kill('maia worker failed')};
   w.postMessage({cmd:'init',id:0,base:new URL('./',location.href).href});
  }catch(e){off=true;w=null}
 }
 function call(cmd,args,local){
  start();
  if(!w)return Promise.resolve().then(local);
  return new Promise((res,rej)=>{const id=++seq;pending.set(id,{res,rej});w.postMessage({cmd,id,...args})}).catch(e=>{if(off)return local();throw e});
 }
 window.Maia={
  load:elo=>call('load',{elo},()=>MaiaCore.load(elo)).then(()=>elo),
  pick:(elo,hist,legal,opt)=>call('pick',{elo,hist,legal,opt},()=>MaiaCore.load(elo).then(n=>{const p=MaiaCore.pick(n,hist,legal,opt);return p&&{move:p.move}})),
  analyse:(elo,hist,legal,played)=>call('analyse',{elo,hist,legal,played},()=>MaiaCore.load(elo).then(n=>MaiaCore.analyse(n,hist,legal,played)))
 };
})();
