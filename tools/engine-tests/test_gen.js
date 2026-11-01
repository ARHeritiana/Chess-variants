const R=require('./ref.js');global.window=undefined;require('../../app/src/main/assets/www/js/engine.js');
const Eng=globalThis.Eng;
const start=()=>{const b=Array(64).fill(null);'rnbqkbnr'.split('').forEach((c,i)=>{b[i]=c;b[56+i]=c.toUpperCase()});for(let i=0;i<8;i++){b[8+i]='p';b[48+i]='P'}return{b,t:'w',c:'KQkq',ep:null,hm:0}};
const key=m=>[m.fx,m.fy,m.tx,m.ty].join(',')+(m.k||'')+(m.pr||'');
let bad=0,pos=0,perftBad=0;
for(const mode of['flat','cyl','bs','ba']){
 R.setMode(mode);Eng.setMode(mode);let games=0,checked=0;
 for(let g=0;g<40;g++){
  let s=start();
  for(let ply=0;ply<120;ply++){
   const ref=R.legal(s);
   const mine=Eng.legalMoves(s);
   // compare sets ignoring promo piece (ref has one move per promo square; mine has 4)
   const A=new Set(ref.map(m=>[m.fx,m.fy,m.tx,m.ty,m.k||''].join()));
   const B=new Set(mine.map(m=>[m.fx,m.fy,m.tx,m.ty,m.k||''].join()));
   const missing=[...A].filter(x=>!B.has(x)),extra=[...B].filter(x=>!A.has(x));
   checked++;
   if(missing.length||extra.length){bad++;if(bad<6)console.log(mode,'MISMATCH ply',ply,'missing',missing,'extra',extra,JSON.stringify(s.b.map(x=>x||'.').join('')),s.t,s.c,s.ep)}
   if(!ref.length)break;
   const m=ref[Math.random()*ref.length|0];s=R.apply(s,m);
   if(R.insuffB(s.b)||s.hm>=100)break;
  }
 }
 // perft vs reference on a few positions
 let s=start();R.setMode(mode);Eng.setMode(mode);
 const refPerft=(s,d)=>{if(!d)return 1;let n=0;for(const m of R.legal(s)){if(d===1){const p=(s.b[m.fy*8+m.fx]==='P'&&m.ty===0)||(s.b[m.fy*8+m.fx]==='p'&&m.ty===7);n+=p?4:1}else n+=refPerft(R.apply(s,m),d-1)}return n};
 for(let k=0;k<3;k++){const d=3;const a=refPerft(s,d),b=Eng.perft(s,d);if(a!==b){perftBad++;console.log(mode,'perft',d,'ref',a,'mine',b)}
  const L=R.legal(s);s=R.apply(s,L[Math.random()*L.length|0]);const L2=R.legal(s);s=R.apply(s,L2[Math.random()*L2.length|0])}
 console.log(mode,'positions compared',checked);
}
console.log('mismatching positions:',bad,'perft mismatches:',perftBad);
