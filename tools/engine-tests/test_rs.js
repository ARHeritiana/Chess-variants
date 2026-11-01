// Rules check of the Rust engine against the ORIGINAL move generator in app.old.js.
const R=require('./ref.js'),{JSE,RS,init}=require('./rs_common.js');
const start=()=>{const b=Array(64).fill(null);'rnbqkbnr'.split('').forEach((c,i)=>{b[i]=c;b[56+i]=c.toUpperCase()});for(let i=0;i<8;i++){b[8+i]='p';b[48+i]='P'}return{b,t:'w',c:'KQkq',ep:null,hm:0}};
(async()=>{
 await init();
 let bad=0,checked=0,perftBad=0,evalBad=0;
 for(const mode of['flat','cyl','bs','ba']){
  R.setMode(mode);RS.setMode(mode);
  for(let g=0;g<60;g++){
   let s=start();
   for(let ply=0;ply<140;ply++){
    const ref=R.legal(s),mine=RS.legalMoves(s);
    const A=new Set(ref.map(m=>[m.fx,m.fy,m.tx,m.ty,m.k||''].join())),B=new Set(mine.map(m=>[m.fx,m.fy,m.tx,m.ty,m.k||''].join()));
    const missing=[...A].filter(x=>!B.has(x)),extra=[...B].filter(x=>!A.has(x));
    checked++;
    if(missing.length||extra.length){bad++;if(bad<6)console.log(mode,'MISMATCH ply',ply,'missing',missing,'extra',extra)}
    if(ply%7===0&&Math.abs(RS.evalState(s)-JSE.evalState(s))>1){evalBad++;if(evalBad<4)console.log(mode,'eval differs',RS.evalState(s),JSE.evalState(s))}
    if(!ref.length)break;
    s=R.apply(s,ref[Math.random()*ref.length|0]);
    if(R.insuffB(s.b)||s.hm>=100)break;
   }
  }
  // perft: Rust vs JS engine vs reference, from the start and a few random positions
  const refPerft=(s,d)=>{if(!d)return 1;let n=0;for(const m of R.legal(s)){if(d===1){const p=(s.b[m.fy*8+m.fx]==='P'&&m.ty===0)||(s.b[m.fy*8+m.fx]==='p'&&m.ty===7);n+=p?4:1}else n+=refPerft(R.apply(s,m),d-1)}return n};
  let s=start();
  for(let k=0;k<4;k++){
   const a=refPerft(s,3),b=RS.perft(s,3),c=JSE.perft(s,3);
   if(a!==b||b!==c){perftBad++;console.log(mode,'perft3 ref',a,'rust',b,'js',c)}
   for(let i=0;i<2;i++){const L=R.legal(s);if(!L.length)break;s=R.apply(s,L[Math.random()*L.length|0])}
  }
  console.log(mode,'positions compared so far',checked);
 }
 console.log('mismatching positions:',bad,' perft mismatches:',perftBad,' eval differences >1cp:',evalBad);
 process.exit(bad||perftBad?1:0);
})();
