const R=require('./ref.js'),{JSE,RS,init}=require('./rs_common.js');
const b=Array(64).fill(null);'rnbqkbnr'.split('').forEach((c,i)=>{b[i]=c;b[56+i]=c.toUpperCase()});for(let i=0;i<8;i++){b[8+i]='p';b[48+i]='P'}
const s0={b,t:'w',c:'KQkq',ep:null,hm:0};
(async()=>{await init();
 const MS=+process.argv[2]||1500;
 for(const mode of['flat','cyl','bs','ba']){R.setMode(mode);RS.setMode(mode);
  const poss=[];let p=s0;for(let k=0;k<3;k++){for(let i=0;i<8;i++){const L=R.legal(p);p=R.apply(p,L[(7*i+3*k+p.hm)%L.length])}poss.push(p)}
  JSE.setMode(mode);JSE.search(poss[0],{ms:300}); // JIT warm-up
  let nj=0,nr=0,dj=0,dr=0;
  for(const p of poss){const a=JSE.search(p,{ms:MS}),c=RS.search(p,{ms:MS});nj+=a.nodes;nr+=c.nodes;dj+=a.depth;dr+=c.depth}
  console.log(`${mode.padEnd(4)} JS ${Math.round(nj/(3*MS/1000)/1000)}k nps depth ${(dj/3).toFixed(1)}  |  Rust/WASM ${Math.round(nr/(3*MS/1000)/1000)}k nps depth ${(dr/3).toFixed(1)}  |  x${(nr/nj).toFixed(1)} nodes/s`);
 }
 process.exit(0)})();
