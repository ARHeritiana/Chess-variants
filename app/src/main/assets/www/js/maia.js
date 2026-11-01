/* Maia (human-like chess net, lc0 format) running in plain JS. Classical rules only.
   Weights: maia/maia-<elo>.bin = BN-folded fp16 (see tools/convert.py). Policy head only; no search. */
(function(){
const FILES='abcdefgh',LAYERS=6,NC=64,SE=8;
let MAP=null;const NETS={};
const P2=new Float32Array(32);for(let e=0;e<32;e++)P2[e]=Math.pow(2,e-15);
function half(h){const e=(h>>10)&31,m=h&1023,s=h&0x8000?-1:1;return e===0?s*m*5.960464477539063e-8:e===31?NaN:s*P2[e]*(1+m/1024)}
async function getBuf(u){const r=await fetch(u);if(!r.ok)throw new Error('HTTP '+r.status+' '+u);return r.arrayBuffer()}
async function load(elo){
 if(NETS[elo])return NETS[elo];
 return NETS[elo]=(async()=>{
  if(!MAP){const j=JSON.parse(new TextDecoder().decode(await getBuf('maia/maia-map.json')));
   const rev=new Int16Array(1858).fill(-1);j.idx.forEach((t,i)=>{if(t>=0)rev[t]=i});
   const mv=new Map();j.moves.forEach((u,i)=>mv.set(u,i));MAP={rev,mv}}
  const u16=new Uint16Array(await getBuf('maia/maia-'+elo+'.bin')),f=new Float32Array(u16.length);
  for(let i=0;i<u16.length;i++)f[i]=half(u16[i]);
  let o=0;const take=n=>{const a=f.subarray(o,o+n);o+=n;return a};
  const net={inW:take(NC*112*9),inB:take(NC),blocks:[]};
  for(let b=0;b<LAYERS;b++)net.blocks.push({w1:take(NC*NC*9),b1:take(NC),w2:take(NC*NC*9),b2:take(NC),sw1:take(SE*NC),sb1:take(SE),sw2:take(2*NC*SE),sb2:take(2*NC)});
  net.p1W=take(NC*NC*9);net.p1B=take(NC);net.pW=take(80*NC*9);net.pB=take(80);
  net.vW=take(32*NC);net.vB=take(32);net.f1W=take(128*2048);net.f1B=take(128);net.f2W=take(3*128);net.f2B=take(3);
  if(o!==f.length)throw new Error('bad weight file');
  return net})();
}
/* activations use a zero-padded 10x10 layout per channel */
function conv(x,ci,W,B,co,relu,out){
 const acc=new Float32Array(64);
 for(let o=0;o<co;o++){
  acc.fill(B[o]);
  for(let i=0;i<ci;i++){
   const xb=i*100;let wi=(o*ci+i)*9;
   for(let dy=0;dy<3;dy++)for(let dx=0;dx<3;dx++,wi++){
    const w=W[wi];if(w===0)continue;
    for(let y=0;y<8;y++){const s=xb+(y+dy)*10+dx,a=y*8;for(let q=0;q<8;q++)acc[a+q]+=w*x[s+q]}
   }
  }
  const ob=o*100;
  for(let y=0;y<8;y++)for(let q=0;q<8;q++){const v=acc[y*8+q];out[ob+(y+1)*10+q+1]=relu&&v<0?0:v}
 }
}
function forward(net,planes){
 const x=new Float32Array(112*100);
 for(let c=0;c<112;c++)for(let y=0;y<8;y++)for(let q=0;q<8;q++)x[c*100+(y+1)*10+q+1]=planes[c*64+y*8+q];
 let cur=new Float32Array(NC*100),t1=new Float32Array(NC*100),t2=new Float32Array(NC*100);
 conv(x,112,net.inW,net.inB,NC,true,cur);
 const pool=new Float32Array(NC),z=new Float32Array(SE),e=new Float32Array(2*NC);
 for(const b of net.blocks){
  conv(cur,NC,b.w1,b.b1,NC,true,t1);conv(t1,NC,b.w2,b.b2,NC,false,t2);
  for(let c=0;c<NC;c++){let s=0;for(let y=0;y<8;y++)for(let q=0;q<8;q++)s+=t2[c*100+(y+1)*10+q+1];pool[c]=s/64}
  for(let k=0;k<SE;k++){let s=b.sb1[k];for(let c=0;c<NC;c++)s+=b.sw1[k*NC+c]*pool[c];z[k]=s>0?s:0}
  for(let k=0;k<2*NC;k++){let s=b.sb2[k];for(let j=0;j<SE;j++)s+=b.sw2[k*SE+j]*z[j];e[k]=s}
  for(let c=0;c<NC;c++){const g=1/(1+Math.exp(-e[c])),bt=e[NC+c];
   for(let y=0;y<8;y++)for(let q=0;q<8;q++){const i=c*100+(y+1)*10+q+1,v=g*t2[i]+bt+cur[i];t2[i]=v>0?v:0}}
  const sw=cur;cur=t2;t2=sw;
 }
 conv(cur,NC,net.p1W,net.p1B,NC,true,t1);
 const po=new Float32Array(80*100);conv(t1,NC,net.pW,net.pB,80,false,po);
 const out=new Float32Array(80*64);
 for(let c=0;c<80;c++)for(let y=0;y<8;y++)for(let q=0;q<8;q++)out[c*64+y*8+q]=po[c*100+(y+1)*10+q+1];
 /* value head: 1x1 conv (64->32) + relu, fc 2048->128 + relu, fc 128->3, softmax => [win,draw,loss] for the side to move */
 const v=new Float32Array(2048);
 for(let o=0;o<32;o++)for(let y=0;y<8;y++)for(let q=0;q<8;q++){let a=net.vB[o];const i=(y+1)*10+q+1;for(let c=0;c<NC;c++)a+=net.vW[o*NC+c]*cur[c*100+i];v[o*64+y*8+q]=a>0?a:0}
 const h=new Float32Array(128);
 for(let k=0;k<128;k++){let a=net.f1B[k];const b=k*2048;for(let i=0;i<2048;i++)a+=net.f1W[b+i]*v[i];h[k]=a>0?a:0}
 const zz=[0,1,2].map(k=>{let a=net.f2B[k];for(let i=0;i<128;i++)a+=net.f2W[k*128+i]*h[i];return a}),mz=Math.max(...zz),ex=zz.map(x=>Math.exp(x-mz)),sm=ex[0]+ex[1]+ex[2];
 return{pol:out,wdl:[ex[0]/sm,ex[1]/sm,ex[2]/sm]};
}
/* state: {b:[64] (index y*8+x, y=0 is rank 8), t:'w'|'b', c:'KQkq' subset, hm}. hist: oldest..newest */
function encode(hist){
 const cur=hist[hist.length-1],us=cur.t,black=us==='b',pl=new Float32Array(112*64),ord='PNBRQK';
 for(let h=0;h<8&&h<hist.length;h++){
  const bd=hist[hist.length-1-h].b;
  for(let i=0;i<64;i++){const p=bd[i];if(!p)continue;
   const mine=(p<'a')===(us==='w'),k=ord.indexOf(p.toUpperCase()),x=i&7,y=i>>3,r=black?y:7-y;
   pl[(h*13+(mine?0:6)+k)*64+r*8+x]=1}
 }
 const cs=cur.c||'',Q=us==='w'?'Q':'q',K=us==='w'?'K':'k',q2=us==='w'?'q':'Q',k2=us==='w'?'k':'K';
 [cs.includes(Q),cs.includes(K),cs.includes(q2),cs.includes(k2)].forEach((v,i)=>{if(v)pl.fill(1,(104+i)*64,(105+i)*64)});
 if(black)pl.fill(1,108*64,109*64);
 pl.fill(Math.min(cur.hm||0,99)/99,109*64,110*64);pl.fill(1,111*64,112*64);
 return pl;
}
function uci(m,black,pr){
 const sq=(x,y)=>FILES[x]+(black?y+1:8-y);
 return sq(m.fx,m.fy)+sq(m.tx,m.ty)+(pr&&pr!=='n'?pr:'');
}
/* Returns {move, probs:[{m,p}]} sampled from Maia's policy over the legal moves (nucleus sampling). */
function pick(net,hist,legal,opt){
 opt=opt||{};const T=opt.temp||1,topP=opt.topP||.95,cur=hist[hist.length-1],black=cur.t==='b';
 const out=forward(net,encode(hist)).pol,c=[];
 for(const m of legal){
  const p=cur.b[m.fy*8+m.fx],promo=(p==='P'&&m.ty===0)||(p==='p'&&m.ty===7);
  for(const z of promo?['q','r','b','n']:[null]){
   const ix=MAP.mv.get(uci(m,black,z));if(ix===undefined)continue;
   const r=MAP.rev[ix];if(r<0)continue;
   c.push({m:z?{...m,pr:z}:m,l:out[r]/T});
  }
 }
 if(!c.length)return null;
 let mx=-1e9;for(const e of c)if(e.l>mx)mx=e.l;
 let sum=0;for(const e of c){e.p=Math.exp(e.l-mx);sum+=e.p}
 for(const e of c)e.p/=sum;
 c.sort((a,b)=>b.p-a.p);
 let cum=0,n=0;while(n<c.length&&(n===0||cum<topP)){cum+=c[n].p;n++}
 let r=Math.random()*cum;for(let i=0;i<n;i++){r-=c[i].p;if(r<=0)return{move:c[i].m,probs:c};}
 return{move:c[0].m,probs:c};
}
/* Review helper: value (side to move: win/draw/loss), most human-likely move, and how likely the played move was. */
function analyse(net,hist,legal,played){
 const cur=hist[hist.length-1],black=cur.t==='b',f=forward(net,encode(hist)),c=[];
 for(const m of legal){
  const p=cur.b[m.fy*8+m.fx],promo=(p==='P'&&m.ty===0)||(p==='p'&&m.ty===7);
  for(const z of promo?['q','r','b','n']:[null]){
   const ix=MAP.mv.get(uci(m,black,z));if(ix===undefined)continue;const r=MAP.rev[ix];if(r<0)continue;
   c.push({m,z,l:f.pol[r]});
  }
 }
 let mx=-1e9;for(const e of c)if(e.l>mx)mx=e.l;let sum=0;for(const e of c){e.p=Math.exp(e.l-mx);sum+=e.p}
 for(const e of c)e.p/=sum;c.sort((a,b)=>b.p-a.p);
 let pp=0,rank=-1;
 if(played)c.forEach((e,i)=>{if(e.m.fx===played.fx&&e.m.fy===played.fy&&e.m.tx===played.tx&&e.m.ty===played.ty){pp+=e.p;if(rank<0)rank=i}});
 return{wdl:f.wdl,best:c[0]?{fx:c[0].m.fx,fy:c[0].m.fy,tx:c[0].m.tx,ty:c[0].m.ty,pr:c[0].z||undefined,p:c[0].p}:null,pPlayed:pp,rank};
}
window.Maia={load,pick,analyse,encode,forward,_dbg:()=>MAP};
})();
