const R=require('./ref.js');global.window=undefined;require('../../app/src/main/assets/www/js/engine.js');
const Eng=globalThis.Eng;
const b=Array(64).fill(null);'rnbqkbnr'.split('').forEach((c,i)=>{b[i]=c;b[56+i]=c.toUpperCase()});for(let i=0;i<8;i++){b[8+i]='p';b[48+i]='P'}
let s={b,t:'w',c:'KQkq',ep:null,hm:0};
for(const mode of['flat','cyl','ba']){R.setMode(mode);Eng.setMode(mode);
 let p=s;for(const u of[0,0,0,0,0,0]){const L=R.legal(p);p=R.apply(p,L[(u+7*p.hm+3)%L.length])}
 const r=Eng.search(p,{ms:1500});console.log(mode,'new engine 1.5s: depth',r.depth,'nodes',r.nodes,'nps',Math.round(r.nodes/1.5));}
