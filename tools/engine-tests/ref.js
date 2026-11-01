// Loads the ORIGINAL rules + engine from app.js (unchanged copy) as ground truth.
const fs=require('fs'),vm=require('vm');
const src=fs.readFileSync(process.env.APPJS||__dirname+'/app.old.js','utf8');
function fn(name){const i=src.indexOf('function '+name+'(');if(i<0)throw new Error('no '+name);let j=src.indexOf('{',i),d=0,k=j;for(;k<src.length;k++){if(src[k]==='{')d++;else if(src[k]==='}'){d--;if(!d)break}}return src.slice(i,k+1)}
function line(starts){const l=src.split('\n').find(l=>l.startsWith(starts));if(!l)throw new Error('no line '+starts);return l}
const code=['let mode="flat";',fn('step'),fn('adv'),fn('gen'),fn('attacked'),fn('check'),fn('apply'),fn('legal'),fn('insuffB'),
 line('const VAL='),line('let T0=0'),fn('rnd'),line('const ZK='),fn('hashOf'),fn('evalS'),fn('mscore'),fn('pseudo'),fn('tick'),fn('qs'),fn('search'),
 `function oldBest(s,ms,maxD,noise){const cf={d:maxD,t:ms,n:noise||0},mvs=legal(s);T0=Date.now();TL=ms;abort=false;TT.clear();KIL=[];HI.fill(0);path=new Set([hashOf(s)]);
  gameH=new Map(); for(const h of (globalThis.__hist||[]))gameH.set(h,1);
  let best=mvs[Math.random()*mvs.length|0];
  for(let d=1;d<=cf.d;d++){for(const m of mvs)m.s=m===best?1e9:mscore(s,m,null,0);mvs.sort((a,b)=>b.s-a.s);let bm=null,bv=-1e9,al=-1e9;
   for(const m of mvs){const v=-search(apply(s,m),d-1,-1e9,-al,1)+Math.random()*cf.n;if(abort)break;if(v>bv){bv=v;bm=m}if(v>al)al=v}
   if(abort)break;best=bm;if(bv>29000)break}
  return best}`,
 'globalThis.R={setMode:m=>{mode=m},legal,apply,check,insuffB,oldBest,hashOf,setHist:h=>{gameH=new Map();for(const x of h)gameH.set(hashOf(x),(gameH.get(hashOf(x))||0)+1)}};'].join('\n');
const ctx=vm.createContext({console,Math,Date,Map,Set,Array,Int32Array,globalThis:null});ctx.globalThis=ctx;
vm.runInContext(code,ctx);
module.exports=ctx.R;
