// usage: node match.js <mode> <games> <ms> [newOpts-json]
const R=require('./ref.js');global.window=undefined;require('../../app/src/main/assets/www/js/engine.js');
const Eng=globalThis.Eng,mode=process.argv[2]||'flat',N=+process.argv[3]||6,MS=+process.argv[4]||100,OPT=JSON.parse(process.argv[5]||'{}');
R.setMode(mode);Eng.setMode(mode);Object.assign(Eng.CFG,JSON.parse(process.env.CFG||'{}'));
const start=()=>{const b=Array(64).fill(null);'rnbqkbnr'.split('').forEach((c,i)=>{b[i]=c;b[56+i]=c.toUpperCase()});for(let i=0;i<8;i++){b[8+i]='p';b[48+i]='P'}return{b,t:'w',c:'KQkq',ep:null,hm:0}};
const posKey=s=>s.b.map(x=>x||'.').join('')+s.t+s.c+(s.ep?s.ep.sq.join():'');
function game(newIsWhite,opening){
 let s=start();const hist=[],seen={};let plies=0;
 for(const m of opening){hist.push(s);s=R.apply(s,m)}
 seen[posKey(s)]=1;
 for(;;){
  const L=R.legal(s);
  if(!L.length)return R.check(s,s.t==='w')?((s.t==='w')===newIsWhite?0:1):0.5;
  if(R.insuffB(s.b)||s.hm>=100||plies>200)return 0.5;
  const newTurn=(s.t==='w')===newIsWhite;let m;
  if(newTurn){
   const r=Eng.search(s,{ms:MS,hist,...OPT});
   m=L.find(x=>x.fx===r.move.fx&&x.fy===r.move.fy&&x.tx===r.move.tx&&x.ty===r.move.ty);
   if(!m){console.log('ILLEGAL move from new engine',JSON.stringify(r.move));return 0}
   if(r.move.pr)m={...m,pr:r.move.pr};
  }else{R.setHist([...hist]);m=R.oldBest(s,MS,14,0)}
  hist.push(s);s=R.apply(s,m);plies++;
  const k=posKey(s);seen[k]=(seen[k]||0)+1;if(seen[k]>=3)return 0.5;
 }
}
let score=0,w=0,d=0,l=0;const t0=Date.now();
for(let g=0;g<N;g++){
 // shared random 4-ply opening, played with both colours
 let s=start();const op=[];for(let i=0;i<4;i++){const L=R.legal(s);const m=L[Math.random()*L.length|0];op.push(m);s=R.apply(s,m)}
 for(const white of[true,false]){const r=game(white,op);score+=r;if(r===1)w++;else if(r===0)l++;else d++}
}
console.log(`${mode} ${MS}ms: new engine +${w} =${d} -${l}  score ${score}/${2*N} (${(100*score/(2*N)).toFixed(0)}%)  ${((Date.now()-t0)/1000).toFixed(0)}s`);
