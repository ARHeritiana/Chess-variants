/* Runs the built-in engine (Rust/WASM, JS fallback) off the UI thread. Messages are handled one at a time, in order. */
importScripts('engine.js','engine-wasm.js');
let chain=Promise.resolve();
async function handle(m){
 if(m.cmd==='init'){
  try{const r=await fetch(m.base+'js/rs/engine.wasm');if(r.ok)await Eng.initWasm(await r.arrayBuffer())}catch(e){}
  postMessage({id:m.id,r:Eng.engine});return;
 }
 if(m.cmd==='search'){
  let r=null,err=null;
  try{Eng.setMode(m.mode);r=Eng.search(m.s,m.opts)}catch(e){err=String(e)}
  postMessage({id:m.id,r,err});
 }
}
onmessage=e=>{chain=chain.then(()=>handle(e.data))};
