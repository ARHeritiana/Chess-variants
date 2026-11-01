// usage: node match_rs.js <mode> <openings> <ms>   — Rust/WASM engine vs the pure-JS engine, equal time per move
const R=require('./ref.js'),{JSE,RS,init}=require('./rs_common.js');
const mode=process.argv[2]||'flat',N=+process.argv[3]||4,MS=+process.argv[4]||100;
const start=()=>{const b=Array(64).fill(null);'rnbqkbnr'.split('').forEach((c,i)=>{b[i]=c;b[56+i]=c.toUpperCase()});for(let i=0;i<8;i++){b[8+i]='p';b[48+i]='P'}return{b,t:'w',c:'KQkq',ep:null,hm:0}};
const posKey=s=>s.b.map(x=>x||'.').join('')+s.t+s.c+(s.ep?s.ep.sq.join():'');
function game(rsWhite,opening){
 let s=start();const hist=[],seen={};let plies=0;
 for(const m of opening){hist.push(s);s=R.apply(s,m)}
 seen[posKey(s)]=1;
 for(;;){
  const L=R.legal(s);
  if(!L.length)return R.check(s,s.t==='w')?((s.t==='w')===rsWhite?0:1):0.5;
  if(R.insuffB(s.b)||s.hm>=100||plies>240)return 0.5;
  const rsTurn=(s.t==='w')===rsWhite,E=rsTurn?RS:JSE;
  const r=E.search(s,{ms:MS,hist});
  let m=r&&L.find(x=>x.fx===r.move.fx&&x.fy===r.move.fy&&x.tx===r.move.tx&&x.ty===r.move.ty);
  if(!m){console.log('ILLEGAL move from',rsTurn?'rust':'js',JSON.stringify(r&&r.move));return rsTurn?0:1}
  if(r.move.pr)m={...m,pr:r.move.pr};
  hist.push(s);s=R.apply(s,m);plies++;
  const k=posKey(s);seen[k]=(seen[k]||0)+1;if(seen[k]>=3)return 0.5;
 }
}
(async()=>{await init();R.setMode(mode);RS.setMode(mode);
 let score=0,w=0,d=0,l=0;const t0=Date.now();
 for(let g=0;g<N;g++){
  let s=start();const op=[];for(let i=0;i<4;i++){const L=R.legal(s);const m=L[Math.random()*L.length|0];op.push(m);s=R.apply(s,m)}
  for(const white of[true,false]){const r=game(white,op);score+=r;if(r===1)w++;else if(r===0)l++;else d++}
 }
 console.log(`${mode} ${MS}ms: Rust +${w} =${d} -${l}  score ${score}/${2*N} (${(100*score/(2*N)).toFixed(0)}%)  ${((Date.now()-t0)/1000).toFixed(0)}s`);
 process.exit(0)})();
