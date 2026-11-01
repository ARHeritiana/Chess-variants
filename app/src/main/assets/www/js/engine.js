/* Built-in engine for Classical, Cylinder and Bounce surfaces.
   Mailbox board, tables precomputed per surface (wrap / bounce geometry), make/unmake, PVS + TT + null move + LMR,
   mobility-based evaluation. Pieces: P N B R Q K = 1..6, black = +8. Moves are ints: from | to<<6 | flag<<12
   (flag 1 double push, 2 en passant, 3 castle king side, 4 castle queen side, 5..8 promote N B R Q). */
(function(root){
'use strict';
const MATE=30000,MATEB=29000,MAXP=96,INF=32000;
const VAL=[0,100,320,330,500,900,0];
const PR=[0,0,6,12,22,38,64,0],PP=[0,0,8,16,32,60,100,0];
const DIRS=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
let MODE='flat';
let RAY,KN,KG,PF,PD,PC,PA,MOBB;
const TBL={};

/* ---- geometry (mirrors step()/adv() in app.js) ---- */
function stepF(m,x,y,dx,dy){let nx=x+dx,ny=y+dy;if(nx<0||nx>7){if(m!=='cyl')return -1;nx=(nx+8)%8}if(ny<0||ny>7)return -1;return ny*8+nx}
function advF(m,x,y,dx,dy){
 if(m!=='bs'&&m!=='ba'){const r=stepF(m,x,y,dx,dy);return r<0?null:[r&7,r>>3,dx,dy]}
 let nx=x+dx,ny=y+dy;
 if(nx<0||nx>7){if(!dy)return null;dx=-dx;nx=x+dx}
 if(ny<0||ny>7){if(m==='bs'||!dx)return null;dy=-dy;ny=y+dy}
 return[nx,ny,dx,dy];
}
function build(m){
 const t={ray:new Array(512),kn:new Array(64),kg:new Array(64),pf:[new Int8Array(64).fill(-1),new Int8Array(64).fill(-1)],pd:[new Int8Array(64).fill(-1),new Int8Array(64).fill(-1)],pc:[new Array(64),new Array(64)],pa:[new Array(64),new Array(64)]};
 for(let sq=0;sq<64;sq++){
  const x=sq&7,y=sq>>3;
  for(let d=0;d<8;d++){
   let cx=x,cy=y,ex=DIRS[d][0],ey=DIRS[d][1];const l=[];
   for(let i=0;i<40;i++){const r=advF(m,cx,cy,ex,ey);if(!r)break;cx=r[0];cy=r[1];ex=r[2];ey=r[3];if(cx===x&&cy===y)break;l.push(cy*8+cx)}
   t.ray[sq*8+d]=Int8Array.from(l);
  }
  const kn=[];
  for(const[a,c]of[[2,1],[1,2]])for(const sx of[-1,1])for(const sy of[-1,1]){
   let cx=x,ok=true;
   for(let i=0;i<a;i++){const r=stepF(m,cx,y,sx,0);if(r<0){ok=false;break}cx=r&7}
   if(!ok)continue;const ny=y+sy*c;if(ny<0||ny>7)continue;const q=ny*8+cx;if(!kn.includes(q))kn.push(q);
  }
  t.kn[sq]=Int8Array.from(kn);
  const kg=[];for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){if(!dx&&!dy)continue;const r=stepF(m,x,y,dx,dy);if(r>=0)kg.push(r)}
  t.kg[sq]=Int8Array.from(kg);
  for(let c=0;c<2;c++){
   const f=c===0?-1:1,a=stepF(m,x,y,0,f);t.pf[c][sq]=a;
   if(a>=0&&y===(c===0?6:1)){const d2=stepF(m,a&7,a>>3,0,f);t.pd[c][sq]=d2}
   const cp=[];for(const dx of[-1,1]){const r=stepF(m,x,y,dx,f);if(r>=0)cp.push(r)}
   t.pc[c][sq]=Int8Array.from(cp);
  }
 }
 for(let c=0;c<2;c++)for(let sq=0;sq<64;sq++){const o=[];for(let q=0;q<64;q++)if(t.pc[c][q].includes(sq))o.push(q);t.pa[c][sq]=Int8Array.from(o)}
 /* average empty-board mobility per piece type (normalises mobility for each surface) */
 const mb=[0,0,0,0,0,0,0],stamp=new Int32Array(64);let st=0;
 for(let sq=0;sq<64;sq++){
  mb[2]+=t.kn[sq].length;
  for(const[ty,d0,d1]of[[3,4,8],[4,0,4],[5,0,8]]){st++;let c=0;for(let d=d0;d<d1;d++)for(const q of t.ray[sq*8+d])if(stamp[q]!==st){stamp[q]=st;c++}mb[ty]+=c}
 }
 for(let i=2;i<=5;i++)mb[i]/=64;
 t.mobb=mb;
 return t;
}
function setMode(m){
 if(!TBL[m])TBL[m]=build(m);
 CFG.nmp=m==='cyl'?0:1; /* null-move pruning misjudges the cylinder's wrap-around threats */
 if(MODE===m&&RAY)return;
 MODE=m;CFG.nmp=m==='cyl'?0:1; /* null-move is unsafe on the wrap-around board (tested: 65% -> 97% vs the old engine without it) */
const t=TBL[m];RAY=t.ray;KN=t.kn;KG=t.kg;PF=t.pf;PD=t.pd;PC=t.pc;PA=t.pa;MOBB=t.mobb;
}

/* ---- zobrist ---- */
let zs=0x9e3779b9|0;const zr=()=>{zs^=zs<<13;zs^=zs>>>17;zs^=zs<<5;return zs|0};
const ZP1=new Int32Array(1024),ZP2=new Int32Array(1024),ZS1=zr(),ZS2=zr(),ZC1=new Int32Array(16),ZC2=new Int32Array(16),ZE1=new Int32Array(65),ZE2=new Int32Array(65);
for(let i=0;i<1024;i++){ZP1[i]=zr();ZP2[i]=zr()}
for(let i=0;i<16;i++){ZC1[i]=zr();ZC2[i]=zr()}
for(let i=0;i<64;i++){ZE1[i]=zr();ZE2[i]=zr()}

/* ---- position ---- */
const b=new Int8Array(64),cnt=new Int8Array(16),ksq=[0,0];
let stm=0,cr=0,ep=-1,hm=0,h1=0,h2=0,sp=0,nodes=0,abort=false,T0=0,TL=0;
const U_cap=new Int8Array(2048),U_cr=new Int8Array(2048),U_ep=new Int8Array(2048),U_hm=new Int16Array(2048),U_h1=new Int32Array(2048),U_h2=new Int32Array(2048),U_mv=new Int32Array(2048);
const CRM=new Int8Array(64).fill(15);CRM[63]=15&~1;CRM[56]=15&~2;CRM[7]=15&~4;CRM[0]=15&~8;
const PCH='PNBRQK';
function setPos(s){
 b.fill(0);cnt.fill(0);
 for(let i=0;i<64;i++){const c=s.b[i];if(!c)continue;const k=PCH.indexOf(c.toUpperCase())+1,p=k+(c<'a'?0:8);b[i]=p;cnt[p]++;if(k===6)ksq[c<'a'?0:1]=i}
 stm=s.t==='w'?0:1;cr=(s.c.includes('K')?1:0)|(s.c.includes('Q')?2:0)|(s.c.includes('k')?4:0)|(s.c.includes('q')?8:0);
 ep=s.ep?s.ep.sq[1]*8+s.ep.sq[0]:-1;hm=s.hm||0;sp=0;
 rehash();
}
function rehash(){
 h1=0;h2=0;for(let i=0;i<64;i++)if(b[i]){h1^=ZP1[b[i]*64+i];h2^=ZP2[b[i]*64+i]}
 if(stm){h1^=ZS1;h2^=ZS2}h1^=ZC1[cr];h2^=ZC2[cr];if(ep>=0){h1^=ZE1[ep];h2^=ZE2[ep]}
}
function hashState(s){setPos(s);return[h1,h2]}

function attacked(sq,by){
 const pa=PA[by][sq],pc=1+(by<<3);
 for(let i=0;i<pa.length;i++)if(b[pa[i]]===pc)return true;
 const nc=2+(by<<3),kn=KN[sq];for(let i=0;i<kn.length;i++)if(b[kn[i]]===nc)return true;
 const kc=6+(by<<3),kg=KG[sq];for(let i=0;i<kg.length;i++)if(b[kg[i]]===kc)return true;
 const qc=5+(by<<3),rc=4+(by<<3),bc=3+(by<<3);
 for(let d=0;d<8;d++){
  const r=RAY[sq*8+d],pc2=d<4?rc:bc;
  for(let i=0;i<r.length;i++){const q=b[r[i]];if(q){if(q===qc||q===pc2)return true;break}}
 }
 return false;
}
function make(m){
 const f=m&63,t=(m>>6)&63,fl=m>>12,p=b[f],us=stm;let cap=b[t];
 U_cap[sp]=cap;U_cr[sp]=cr;U_ep[sp]=ep;U_hm[sp]=hm;U_h1[sp]=h1;U_h2[sp]=h2;U_mv[sp]=m;sp++;
 h1^=ZC1[cr];h2^=ZC2[cr];if(ep>=0){h1^=ZE1[ep];h2^=ZE2[ep]}
 let np=p;
 if(fl>=5)np=(fl-3)+(us<<3);
 b[f]=0;h1^=ZP1[p*64+f];h2^=ZP2[p*64+f];
 if(cap){h1^=ZP1[cap*64+t];h2^=ZP2[cap*64+t];cnt[cap]--}
 b[t]=np;h1^=ZP1[np*64+t];h2^=ZP2[np*64+t];
 if(np!==p){cnt[p]--;cnt[np]++}
 ep=-1;
 if(fl===1)ep=(f+t)>>1;
 else if(fl===2){const q=us===0?t+8:t-8,cp=b[q];b[q]=0;h1^=ZP1[cp*64+q];h2^=ZP2[cp*64+q];cnt[cp]--;U_cap[sp-1]=cp}
 else if(fl===3||fl===4){
  const r=us===0?56:0,rf=fl===3?r+7:r,rt=fl===3?r+5:r+3,rk=b[rf];
  b[rf]=0;b[rt]=rk;h1^=ZP1[rk*64+rf]^ZP1[rk*64+rt];h2^=ZP2[rk*64+rf]^ZP2[rk*64+rt];
 }
 if((p&7)===6){ksq[us]=t;cr&=us===0?~3:~12}
 cr&=CRM[f]&CRM[t];
 hm=((p&7)===1||cap||fl===2)?0:hm+1;
 h1^=ZC1[cr];h2^=ZC2[cr];if(ep>=0){h1^=ZE1[ep];h2^=ZE2[ep]}
 stm^=1;h1^=ZS1;h2^=ZS2;
}
function unmake(){
 sp--;const m=U_mv[sp],f=m&63,t=(m>>6)&63,fl=m>>12;stm^=1;const us=stm;
 let p=b[t];if(fl>=5){cnt[p]--;p=1+(us<<3);cnt[p]++}
 b[f]=p;const cap=U_cap[sp];
 if(fl===2){b[t]=0;const q=us===0?t+8:t-8;b[q]=cap;cnt[cap]++}
 else{b[t]=cap;if(cap)cnt[cap]++}
 if(fl===3||fl===4){const r=us===0?56:0,rf=fl===3?r+7:r,rt=fl===3?r+5:r+3;b[rf]=b[rt];b[rt]=0}
 if((p&7)===6)ksq[us]=f;
 cr=U_cr[sp];ep=U_ep[sp];hm=U_hm[sp];h1=U_h1[sp];h2=U_h2[sp];
}
function makeNull(){U_cap[sp]=0;U_cr[sp]=cr;U_ep[sp]=ep;U_hm[sp]=hm;U_h1[sp]=h1;U_h2[sp]=h2;U_mv[sp]=0;sp++;if(ep>=0){h1^=ZE1[ep];h2^=ZE2[ep]}ep=-1;hm++;stm^=1;h1^=ZS1;h2^=ZS2}
function unmakeNull(){sp--;stm^=1;cr=U_cr[sp];ep=U_ep[sp];hm=U_hm[sp];h1=U_h1[sp];h2=U_h2[sp]}

/* ---- move generation ---- */
const MV=Array.from({length:MAXP+8},()=>new Int32Array(256)),SC=Array.from({length:MAXP+8},()=>new Int32Array(256));
const STAMP=new Int32Array(64);let stampN=0;
function gen(L,caps){
 let n=0;const us=stm;
 for(let sq=0;sq<64;sq++){
  const p=b[sq];if(!p||(p>>3)!==us)continue;const pt=p&7;
  if(pt===1){
   const t=PF[us][sq],pr=us===0?(sq<16):(sq>=48);
   if(t>=0&&!b[t]){
    if(t<8||t>=56){if(pr||true){L[n++]=sq|t<<6|8<<12;if(!caps){L[n++]=sq|t<<6|7<<12;L[n++]=sq|t<<6|6<<12;L[n++]=sq|t<<6|5<<12}}}
    else if(!caps){L[n++]=sq|t<<6;const t2=PD[us][sq];if(t2>=0&&!b[t2])L[n++]=sq|t2<<6|1<<12}
   }
   const pc=PC[us][sq];
   for(let i=0;i<pc.length;i++){
    const t2=pc[i],q=b[t2];
    if(q){if((q>>3)!==us){if(t2<8||t2>=56){L[n++]=sq|t2<<6|8<<12;L[n++]=sq|t2<<6|7<<12;L[n++]=sq|t2<<6|6<<12;L[n++]=sq|t2<<6|5<<12}else L[n++]=sq|t2<<6}}
    else if(t2===ep)L[n++]=sq|t2<<6|2<<12;
   }
  }else if(pt===2||pt===6){
   const tl=pt===2?KN[sq]:KG[sq];
   for(let i=0;i<tl.length;i++){const t=tl[i],q=b[t];if(!q){if(!caps)L[n++]=sq|t<<6}else if((q>>3)!==us)L[n++]=sq|t<<6}
  }else{
   stampN++;
   const d0=pt===4?0:pt===3?4:0,d1=pt===4?4:8;
   for(let d=d0;d<d1;d++){
    const r=RAY[sq*8+d];
    for(let i=0;i<r.length;i++){
     const t=r[i],q=b[t];
     if(!q){if(!caps&&STAMP[t]!==stampN){STAMP[t]=stampN;L[n++]=sq|t<<6}}
     else{if((q>>3)!==us&&STAMP[t]!==stampN){STAMP[t]=stampN;L[n++]=sq|t<<6}break}
    }
   }
  }
 }
 if(!caps&&cr){
  const r=us===0?56:0,K=6+(us<<3),R=4+(us<<3);
  if(b[r+4]===K&&!attacked(r+4,us^1)){
   if((cr&(us?4:1))&&b[r+7]===R&&!b[r+5]&&!b[r+6]&&!attacked(r+5,us^1))L[n++]=(r+4)|(r+6)<<6|3<<12;
   if((cr&(us?8:2))&&b[r]===R&&!b[r+1]&&!b[r+2]&&!b[r+3]&&!attacked(r+3,us^1))L[n++]=(r+4)|(r+2)<<6|4<<12;
  }
 }
 return n;
}

/* ---- evaluation (side to move's view) ---- */
const PCNT=[new Int8Array(8),new Int8Array(8)],PSQ=[new Int8Array(8),new Int8Array(8)],PN=[0,0];
const ZN=[new Uint8Array(64),new Uint8Array(64)],PAT=[new Uint8Array(64),new Uint8Array(64)];
const MW=[0,0,4,3,2,1],ZW=[0,0,2,2,3,5];
const KDANGER=[0,0,10,25,50,80,120,160,200,240,280,300,300,300,300,300];
const fdist=(a,c)=>MODE!=='cyl'?Math.abs(a-c):Math.min(Math.abs(a-c),8-Math.abs(a-c));
const fcen=(x,y)=>(MODE!=='cyl'?3.5-Math.abs(x-3.5):1.5)+3.5-Math.abs(y-3.5);
function evaluate(){
 const mat=(cnt[2]+cnt[10])*320+(cnt[3]+cnt[11])*330+(cnt[4]+cnt[12])*500+(cnt[5]+cnt[13])*900;
 const f=Math.max(0,Math.min(1,(mat-1000)/2500));
 let sc0=0,sc1=0;const ku=[0,0],S=[0,0];
 PCNT[0].fill(0);PCNT[1].fill(0);PN[0]=0;PN[1]=0;PAT[0].fill(0);PAT[1].fill(0);ZN[0].fill(0);ZN[1].fill(0);
 for(let c=0;c<2;c++){const k=ksq[c];ZN[c][k]=1;const kg=KG[k];for(let i=0;i<kg.length;i++)ZN[c][kg[i]]=1}
 for(let i=0;i<64;i++){const p=b[i];if((p&7)===1){const c=p>>3;PCNT[c][i&7]++;PSQ[c][PN[c]++]=i;const pc=PC[c][i];for(let j=0;j<pc.length;j++)PAT[c][pc[j]]=1}}
 for(let c=0;c<2;c++){
  const them=c^1;let v=0;
  for(let n=0;n<PN[c];n++){
   const sq=PSQ[c][n],x=sq&7,y=sq>>3,r=c===0?7-y:y;
   v+=VAL[1]+PR[r];
   if(PCNT[c][x]>1)v-=8;
   let iso=true;for(let dx=-1;dx<=1;dx+=2){const nx=MODE==='cyl'?(x+dx+8)%8:x+dx;if(nx>=0&&nx<8&&PCNT[c][nx])iso=false}
   if(iso)v-=10;
   if(PAT[c][sq])v+=4;
   let pass=true;
   for(let j=0;j<PN[them];j++){const e=PSQ[them][j],ey=e>>3,er=c===0?7-ey:ey;if(fdist(x,e&7)<=1&&er>r){pass=false;break}}
   if(pass)v+=PP[r];
  }
  S[c]=v;
 }
 for(let sq=0;sq<64;sq++){
  const p=b[sq];if(!p)continue;const pt=p&7;if(pt===1||pt===6)continue;
  const c=p>>3,them=c^1,x=sq&7,y=sq>>3,r=c===0?7-y:y;let v=0;
  let m=0;
  if(pt===2){
   const tl=KN[sq];for(let i=0;i<tl.length;i++){const t=tl[i],q=b[t];if((q&&(q>>3)===c)||PAT[them][t])continue;m++;if(ZN[them][t])ku[c]+=ZW[2]}
   v+=fcen(x,y)*3-(r===0?10:0);
  }else{
   stampN++;
   const d0=pt===4?0:pt===3?4:0,d1=pt===4?4:8;
   for(let d=d0;d<d1;d++){
    const rr=RAY[sq*8+d];
    for(let i=0;i<rr.length;i++){
     const t=rr[i],q=b[t];
     if(q&&(q>>3)===c)break;
     if(STAMP[t]!==stampN){STAMP[t]=stampN;if(pt!==5&&PAT[them][t]){}else{m++;if(ZN[them][t])ku[c]+=ZW[pt]}}
     if(q)break;
    }
   }
   if(pt===3){v+=fcen(x,y)*1.5-(r===0?10:0)}
   else if(pt===4){if(!PCNT[c][x])v+=PCNT[them][x]?8:16;if(r===6)v+=18}
   else v+=fcen(x,y)*.5;
  }
  v+=MW[pt]*(m-MOBB[pt]);
  S[c]+=v;
 }
 for(let c=0;c<2;c++){
  const sq=ksq[c],x=sq&7,y=sq>>3,r=c===0?7-y:y;let sh=0;
  for(let n=0;n<PN[c];n++){const q=PSQ[c][n],qr=c===0?7-(q>>3):(q>>3);if(qr===r+1&&fdist(x,q&7)<=1)sh++}
  S[c]+=f*(-r*14+sh*12-KDANGER[Math.min(15,ku[c^1])])+(1-f)*fcen(x,y)*9;
 }
 S[0]+=cnt[3]>1?30:0;S[1]+=cnt[11]>1?30:0;
 // material of pieces
 S[0]+=cnt[2]*320+cnt[3]*330+cnt[4]*500+cnt[5]*900;S[1]+=cnt[10]*320+cnt[11]*330+cnt[12]*500+cnt[13]*900;
 const d=S[0]-S[1];
 return(stm===0?d:-d)+8;
}
function insuff(){
 if(cnt[1]||cnt[9]||cnt[4]||cnt[12]||cnt[5]||cnt[13])return false;
 const n=cnt[2]+cnt[10]+cnt[3]+cnt[11];
 if(n===0)return true;
 if(MODE!=='flat')return false;
 if(n===1)return true;
 if(cnt[2]||cnt[10])return false;
 let col=-1;for(let i=0;i<64;i++){const q=b[i]&7;if(q===3){const c=((i&7)+(i>>3))&1;if(col<0)col=c;else if(c!==col)return false}}
 return n<=6;
}
function isRep(){const lim=Math.min(hm,sp);for(let i=2;i<=lim;i+=2)if(U_h1[sp-i]===h1&&U_h2[sp-i]===h2)return true;return false}

/* ---- transposition table ---- */
const TTB=19,TTS=1<<TTB,TTM_=TTS-1;
const TTK=new Int32Array(TTS),TTV=new Int16Array(TTS),TTD=new Int8Array(TTS),TTF=new Int8Array(TTS),TTMV=new Int32Array(TTS);
/* ---- search ---- */
const KIL=Array.from({length:MAXP+8},()=>new Int32Array(2)),HI=new Int32Array(4096);
const LMR=Array.from({length:64},(_,d)=>Array.from({length:64},(_,i)=>d<3||i<2?0:Math.floor(.7+Math.log(d)*Math.log(i)/2.3)));
let rootBest=0,rootScore=0;
const CFG={rfp:1,nmp:1,fut:1,lmp:1,lmr:1};
function scoreMoves(L,n,ply,ttm){
 const S=SC[ply],k0=KIL[ply][0],k1=KIL[ply][1];
 for(let i=0;i<n;i++){
  const m=L[i],f=m&63,t=(m>>6)&63,fl=m>>12,q=b[t];
  if(m===ttm)S[i]=1e9;
  else if(fl>=5)S[i]=fl===8?2e7:-1e6+fl;
  else if(q||fl===2)S[i]=1e7+VAL[(q||1)&7]*16-(b[f]&7);
  else if(m===k0)S[i]=9e6;else if(m===k1)S[i]=8.9e6;
  else S[i]=HI[f*64+t];
 }
}
function pick(L,S,n,i){
 let bi=i,bs=S[i];for(let j=i+1;j<n;j++)if(S[j]>bs){bs=S[j];bi=j}
 if(bi!==i){const m=L[i];L[i]=L[bi];L[bi]=m;const s=S[i];S[i]=S[bi];S[bi]=s}
 return L[i];
}
function qs(alpha,beta,ply,qd){
 if((++nodes&2047)===0&&Date.now()-T0>TL)abort=true;
 if(abort)return 0;
 const us=stm,inChk=attacked(ksq[us],us^1);
 let stand=-INF;
 if(!inChk){
  stand=evaluate();if(stand>=beta)return stand;if(stand>alpha)alpha=stand;
  if(qd<=0||ply>=MAXP-2)return stand;
 }else if(qd<=-4||ply>=MAXP-2)return evaluate();
 const L=MV[ply],S=SC[ply],n=gen(L,!inChk);
 scoreMoves(L,n,ply,0);
 let legal=0,best=stand;
 for(let i=0;i<n;i++){
  const m=pick(L,S,n,i),fl=m>>12;
  if(!inChk&&fl<5&&stand+VAL[(b[(m>>6)&63]||1)&7]+200<alpha&&fl!==2)continue;
  make(m);
  if(attacked(ksq[us],us^1)){unmake();continue}
  legal++;
  const v=-qs(-beta,-alpha,ply+1,qd-1);
  unmake();
  if(abort)return 0;
  if(v>best){best=v;if(v>alpha){alpha=v;if(v>=beta)return v}}
 }
 if(inChk&&!legal)return-MATE+ply;
 return best;
}
function hasNP(c){return cnt[2+(c<<3)]+cnt[3+(c<<3)]+cnt[4+(c<<3)]+cnt[5+(c<<3)]>0}
function negamax(d,alpha,beta,ply,nullOK){
 if((++nodes&2047)===0&&Date.now()-T0>TL)abort=true;
 if(abort)return 0;
 const pv=beta-alpha>1,us=stm;
 if(ply>0){
  if(hm>=100||isRep()||insuff())return 0;
  alpha=Math.max(alpha,-MATE+ply);beta=Math.min(beta,MATE-ply-1);if(alpha>=beta)return alpha;
 }
 if(ply>=MAXP-2)return evaluate();
 const inChk=attacked(ksq[us],us^1);
 if(inChk&&ply<12)d++;
 if(d<=0)return qs(alpha,beta,ply,6);
 const idx=h1&TTM_;let ttm=0;
 if(TTK[idx]===h2){
  ttm=TTMV[idx];
  if(!pv&&ply>0&&TTD[idx]>=d){
   let v=TTV[idx];if(v>MATEB)v-=ply;else if(v<-MATEB)v+=ply;
   const f=TTF[idx];
   if(f===0||(f===1&&v>=beta)||(f===2&&v<=alpha))return v;
  }
 }
 const se=inChk?-INF:evaluate();
 if(CFG.rfp&&!pv&&!inChk&&d<=3&&se-110*d>=beta&&beta>-MATEB)return se-110*d;
 if(CFG.nmp&&!pv&&!inChk&&nullOK&&d>=3&&se>=beta&&hasNP(us)&&beta>-MATEB){
  makeNull();const v=-negamax(d-1-(2+(d>=6?1:0)+(d>=9?1:0)),-beta,-beta+1,ply+1,false);unmakeNull();
  if(abort)return 0;
  if(v>=beta)return v>MATEB?beta:v;
 }
 const L=MV[ply],S=SC[ply],n=gen(L,false);
 scoreMoves(L,n,ply,ttm);
 const a0=alpha;let best=-INF,bm=0,legal=0,qn=0;
 for(let i=0;i<n;i++){
  const m=pick(L,S,n,i),f=m&63,t=(m>>6)&63,fl=m>>12,cap=b[t],quiet=!cap&&fl<2||fl===3||fl===4;
  make(m);
  if(attacked(ksq[us],us^1)){unmake();continue}
  legal++;
  const chk=attacked(ksq[stm],stm^1);
  if(CFG.fut&&!pv&&!inChk&&!chk&&quiet&&legal>1&&d<=2&&se+110*d+90<=alpha&&alpha>-MATEB){unmake();continue}
  if(CFG.lmp&&!pv&&!inChk&&!chk&&quiet&&legal>6+d*d&&d<=4&&alpha>-MATEB){unmake();continue}
  let v;const nd=d-1;
  if(legal===1)v=-negamax(nd,-beta,-alpha,ply+1,true);
  else{
   let red=0;
   if(CFG.lmr&&d>=3&&quiet&&legal>2&&!inChk&&!chk){red=LMR[Math.min(d,63)][Math.min(legal,63)];if(!pv)red++;if(red>nd-1)red=Math.max(0,nd-1)}
   v=-negamax(nd-red,-alpha-1,-alpha,ply+1,true);
   if(v>alpha&&red>0)v=-negamax(nd,-alpha-1,-alpha,ply+1,true);
   if(v>alpha&&v<beta)v=-negamax(nd,-beta,-alpha,ply+1,true);
  }
  unmake();
  if(abort)return 0;
  if(v>best){
   best=v;bm=m;
   if(ply===0){rootBest=m;rootScore=v}
   if(v>alpha){
    alpha=v;
    if(v>=beta){
     if(quiet&&fl<5){const k=KIL[ply];if(k[0]!==m){k[1]=k[0];k[0]=m}HI[f*64+t]=Math.min(HI[f*64+t]+d*d,1e6)}
     break;
    }
   }
  }
  if(quiet)qn++;
 }
 if(!legal)return inChk?-MATE+ply:0;
 const fl2=best<=a0?2:best>=beta?1:0;
 let sv=best;if(sv>MATEB)sv+=ply;else if(sv<-MATEB)sv-=ply;
 if(TTK[idx]!==h2||TTD[idx]<=d){TTK[idx]=h2;TTV[idx]=sv;TTD[idx]=d;TTF[idx]=fl2;TTMV[idx]=bm}
 return best;
}
function toApp(m){
 const f=m&63,t=(m>>6)&63,fl=m>>12,o={fx:f&7,fy:f>>3,tx:t&7,ty:t>>3};
 if(fl===1){const q=(f+t)>>1;o.k='d';o.mx=q&7;o.my=q>>3}
 else if(fl===2)o.k='e';
 else if(fl===3||fl===4)o.k='c';
 else if(fl>=5&&fl!==8)o.pr='nbr'[fl-5];
 return o;
}
function legalMoves(){
 const L=MV[0],n=gen(L,false),out=[];
 for(let i=0;i<n;i++){const m=L[i];make(m);const ok=!attacked(ksq[stm^1],stm);unmake();if(ok)out.push(m)}
 return out;
}
function perft(d,ply){
 if(d===0)return 1;const L=MV[ply],n=gen(L,false);let c=0;
 for(let i=0;i<n;i++){make(L[i]);if(!attacked(ksq[stm^1],stm))c+=perft(d-1,ply+1);unmake()}
 return c;
}
/* opts: {ms, maxDepth, noise, hist:[states before s, oldest first]} -> {move (app format), cp, depth, nodes} */
function search(s,opts){
 opts=opts||{};
 // game history (for repetition detection): hashes of positions before s that are still reachable by reversible moves
 const H=opts.hist||[],lim=Math.min(H.length,Math.max(0,Math.min(s.hm||0,400))),hh=[];
 for(let i=H.length-lim;i<H.length;i++)hh.push(hashState(H[i]));
 setPos(s);
 const keep=sp;
 for(const x of hh){U_h1[sp]=x[0];U_h2[sp]=x[1];U_mv[sp]=0;sp++}
 TTK.fill(0);HI.fill(0);for(const k of KIL){k[0]=0;k[1]=0}
 T0=Date.now();TL=opts.ms||1000;abort=false;nodes=0;
 const maxD=Math.min(opts.maxDepth||64,MAXP-10),noise=opts.noise||0;
 const rl=legalMoves();
 if(!rl.length){sp=keep;return null}
 let best=rl[Math.random()*rl.length|0],bs=0,done=0;
 if(rl.length===1&&!noise){sp=keep;return{move:toApp(rl[0]),cp:0,depth:0,nodes:0}}
 if(noise>0){
  for(let d=1;d<=maxD;d++){
   rl.sort((a,c)=>(a===best?-1:0)-(c===best?-1:0));
   let bm=0,bv=-INF,al=-INF;
   for(const m of rl){
    make(m);const v=-negamax(d-1,-INF,-al,1,true)+Math.random()*noise;unmake();
    if(abort)break;if(v>bv){bv=v;bm=m}if(v>al)al=v;
   }
   if(abort)break;best=bm;bs=bv;done=d;if(bv>MATEB)break;
  }
 }else{
  let prev=0;
  for(let d=1;d<=maxD;d++){
   let al=-INF,be=INF,w=35;
   if(d>=5){al=prev-w;be=prev+w}
   rootBest=0;
   for(;;){
    const v=negamax(d,al,be,0,false);
    if(abort)break;
    if(v<=al){al=Math.max(-INF,al-w*4);w*=4;if(v<=-MATEB)al=-INF}
    else if(v>=be){be=Math.min(INF,be+w*4);w*=4;if(v>=MATEB)be=INF}
    else{prev=v;break}
   }
   if(rootBest){best=rootBest;bs=rootScore}
   if(abort)break;
   done=d;
   if(Math.abs(prev)>MATEB&&d>=Math.min(maxD,12))break;
   // stop early if the clock cannot fit another iteration
   if(Date.now()-T0>TL*.55)break;
  }
 }
 sp=keep;
 return{move:toApp(best),cp:bs,depth:done,nodes};
}
root.Eng={CFG,setMode,search,perft:(s,d)=>{setPos(s);return perft(d,0)},legalMoves:s=>{setPos(s);return legalMoves().map(toApp)},evalState:s=>{setPos(s);return evaluate()},hashState,_x:{tbl:()=>TBL}};
})(typeof window!=='undefined'?window:globalThis);
