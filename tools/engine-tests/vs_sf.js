// Calibrates the built-in (Rust/WASM) engine against Stockfish (UCI_Elo-limited) on the Classical surface.
// usage: node vs_sf.js <sfElo> <games> <engMs|L1|L2|L3> <sfMs> [workers=8]
// engMs is the built-in engine's time per move; L1/L2/L3 play the app's easy/medium/hard settings (depth, noise and time as in app.js).
// Each opening (4 random plies) is played twice with colours swapped. Prints the score and an Elo estimate
// relative to the nominal Stockfish Elo. Stockfish's UCI_Elo is calibrated for long time controls, so treat the
// absolute number as approximate; it is most useful as a baseline to compare engine changes against.
const fs=require('fs'),path=require('path'),cp=require('child_process');
const FL='abcdefgh';

if(process.argv[2]==='worker'){
 const R=require('./ref.js'),{RS,init}=require('./rs_common.js');
 const SFJS=path.join(__dirname,'../../app/src/main/assets/www/js/sf/stockfish.js');
 const sf=cp.spawn('node',[SFJS],{stdio:['pipe','pipe','inherit']});
 sf.on('exit',c=>{process.stderr.write('stockfish exited ('+c+')\n');process.exit(3)});
 let buf='',waiters=[];
 sf.stdout.on('data',d=>{buf+=d;let i;while((i=buf.indexOf('\n'))>=0){const l=buf.slice(0,i).trim();buf=buf.slice(i+1);waiters=waiters.filter(w=>!w(l))}});
 const send=c=>sf.stdin.write(c+'\n');
 const until=re=>new Promise(res=>{waiters.push(l=>{if(re.test(l)){res(l);return true}return false})});
 const uci=m=>FL[m.fx]+(8-m.fy)+FL[m.tx]+(8-m.ty)+(m.pr||'');
 const start=()=>{const b=Array(64).fill(null);'rnbqkbnr'.split('').forEach((c,i)=>{b[i]=c;b[56+i]=c.toUpperCase()});for(let i=0;i<8;i++){b[8+i]='p';b[48+i]='P'}return{b,t:'w',c:'KQkq',ep:null,hm:0}};
 const posKey=s=>s.b.map(x=>x||'.').join('')+s.t+s.c+(s.ep?s.ep.sq.join():'');
 const [,,,elo,engMs,sfMs]=process.argv;
 async function game(engWhite,opening){
  send('ucinewgame');send('isready');await until(/^readyok/);
  let s=start();const hist=[],seen={},mv=[];let plies=0;
  for(const m of opening){hist.push(s);mv.push(uci(m));s=R.apply(s,m)}
  seen[posKey(s)]=1;
  for(;;){
   const L=R.legal(s);
   if(!L.length)return R.check(s,s.t==='w')?((s.t==='w')===engWhite?0:1):0.5;
   if(R.insuffB(s.b)||s.hm>=100||plies>300)return 0.5;
   const engTurn=(s.t==='w')===engWhite;let m;
   if(engTurn){
    const LV={L1:{ms:400,maxDepth:2,noise:70},L2:{ms:1500,maxDepth:5,noise:6},L3:{ms:3500,maxDepth:64,noise:0}}[engMs]||{ms:+engMs,maxDepth:64,noise:0};
    const r=RS.search(s,{...LV,hist});
    m=r&&L.find(x=>x.fx===r.move.fx&&x.fy===r.move.fy&&x.tx===r.move.tx&&x.ty===r.move.ty);
    if(!m)return 0;
    if(r.move.pr)m={...m,pr:r.move.pr};
   }else{
    send('position startpos'+(mv.length?' moves '+mv.join(' '):''));send('go movetime '+sfMs);
    const b=(await until(/^bestmove/)).split(' ')[1];
    m=L.find(x=>uci(x)===b.slice(0,4));
    if(!m)return 1;
    if(b[4])m={...m,pr:b[4]};
   }
   hist.push(s);mv.push(uci(m));s=R.apply(s,m);plies++;
   const k=posKey(s);seen[k]=(seen[k]||0)+1;if(seen[k]>=3)return 0.5;
  }
 }
 (async()=>{
  await init();R.setMode('flat');RS.setMode('flat');
  send('uci');await until(/^uciok/);
  send('setoption name Hash value 16');send('setoption name UCI_LimitStrength value true');send('setoption name UCI_Elo value '+elo);
  send('isready');await until(/^readyok/);
  process.on('message',async job=>{
   if(job==='quit'){send('quit');process.exit(0)}
   const out=[];
   for(const white of[true,false])out.push(await game(white,job.opening));
   process.send({scores:out});
  });
  process.send({ready:true});
 })();
}else{
 const [,,elo,games,engMs,sfMs,workers]=process.argv;
 if(!elo||!games||!engMs||!sfMs){console.log('usage: node vs_sf.js <sfElo> <games> <engMs> <sfMs> [workers=8]');process.exit(1)}
 const R=require('./ref.js');R.setMode('flat');
 const pairs=Math.ceil(+games/2),W=Math.min(+workers||8,pairs);
 const sstart=()=>{const b=Array(64).fill(null);'rnbqkbnr'.split('').forEach((c,i)=>{b[i]=c;b[56+i]=c.toUpperCase()});for(let i=0;i<8;i++){b[8+i]='p';b[48+i]='P'}return{b,t:'w',c:'KQkq',ep:null,hm:0}};
 const openings=[];for(let g=0;g<pairs;g++){let s=sstart();const op=[];for(let i=0;i<4;i++){const L=R.legal(s);const m=L[Math.random()*L.length|0];op.push({fx:m.fx,fy:m.fy,tx:m.tx,ty:m.ty,k:m.k,mx:m.mx,my:m.my});s=R.apply(s,m)}openings.push(op)}
 const queue=openings.map((o,i)=>i);let done=0,w=0,d=0,l=0,score=0;const t0=Date.now(),kids=new Set();
 function spawn(){
  const k=cp.fork(__filename,['worker',elo,engMs,sfMs]);kids.add(k);k.job=null;
  const feed=()=>{if(queue.length){k.job=queue.shift();k.send({opening:openings[k.job]})}else{k.job=null;k.send('quit')}};
  k.on('message',m=>{
   if(m.ready)return feed();
   for(const r of m.scores){score+=r;if(r===1)w++;else if(r===0)l++;else d++}
   done++;k.job=null;process.stderr.write(`\r${done*2}/${pairs*2} games  +${w} =${d} -${l}   `);
   if(done===pairs){report();for(const x of kids)x.kill();process.exit(0)}else feed();
  });
  k.on('exit',code=>{kids.delete(k);if(code&&code!==0){if(k.job!=null)queue.unshift(k.job);process.stderr.write('\nworker died, restarting\n');if(done<pairs)setTimeout(spawn,500)}});
 }
 for(let i=0;i<W;i++)spawn();
 function report(){
  const n=w+d+l,s=score/n,el=p=>-400*Math.log10(1/Math.min(Math.max(p,.01),.99)-1);
  const se=Math.sqrt((w*(1-s)**2+d*(.5-s)**2+l*s**2)/n/n),lo=s-1.96*se,hi=s+1.96*se;
  console.log(`\nbuilt-in ${engMs}ms vs Stockfish UCI_Elo ${elo} (${sfMs}ms/move), classical: +${w} =${d} -${l}  score ${score}/${n} (${(100*s).toFixed(1)}%)`);
  console.log(`Elo difference ${el(s).toFixed(0)} (95% ${el(lo).toFixed(0)} .. ${el(hi).toFixed(0)}) => built-in ~ ${(+elo+el(s)).toFixed(0)} (range ${(+elo+el(lo)).toFixed(0)}..${(+elo+el(hi)).toFixed(0)})  [${((Date.now()-t0)/1000).toFixed(0)}s]`);
 }
}
