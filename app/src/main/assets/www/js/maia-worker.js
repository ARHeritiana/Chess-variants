/* Maia's network runs here so the 25M-multiply forward pass never blocks the UI thread. */
let chain=Promise.resolve();
importScripts('maia.js');
async function handle(m){
 let r=null,err=null;
 try{
  if(m.cmd==='init'){self.MAIA_BASE=m.base;r=true}
  else{
   const net=await MaiaCore.load(m.elo);
   if(m.cmd==='load')r=true;
   else if(m.cmd==='pick'){const p=MaiaCore.pick(net,m.hist,m.legal,m.opt);r=p&&{move:p.move}}
   else if(m.cmd==='analyse')r=MaiaCore.analyse(net,m.hist,m.legal,m.played);
  }
 }catch(e){err=String(e&&e.message||e)}
 postMessage({id:m.id,r,err});
}
onmessage=e=>{chain=chain.then(()=>handle(e.data))};
