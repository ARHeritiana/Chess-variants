const vm=require('vm'),fs=require('fs');
const W=require('path').join(__dirname,'../../app/src/main/assets/www/js/');
const store={};
const ls={getItem:k=>k in store?store[k]:null,setItem:(k,v)=>{store[k]=String(v)},removeItem:k=>{delete store[k]}};
function stub(){const f=function(){};return new Proxy(f,{get:(t,k)=>k===Symbol.toPrimitive?()=>0:k==='length'?0:k==='style'||k==='dataset'||k==='classList'?stub():stub(),set:()=>true,apply:()=>stub(),construct:()=>stub(),has:()=>true})}
function run(){
 const doc=stub();doc.getElementById=()=>stub();doc.querySelectorAll=()=>[];doc.querySelector=()=>stub();doc.createElement=()=>stub();doc.addEventListener=()=>{};doc.documentElement=stub();doc.fonts=undefined;
 const ctxs={Pieces:{url:()=>'',img:()=>null,use(){},svgOf(){}},document:doc,localStorage:ls,performance:{now:()=>Date.now()},navigator:{},setInterval:()=>0,setTimeout:()=>0,clearTimeout(){},requestAnimationFrame:()=>0,console,getComputedStyle:()=>({getPropertyValue:()=>''}),addEventListener(){},Date,Math,JSON,Promise,Map,Set,Array,Object,String,Number,Float32Array,Int16Array,Uint16Array,Int32Array,TextDecoder,fetch:()=>Promise.reject(new Error('x')),Worker:function(){throw new Error('no')}};
 const c=vm.createContext(ctxs);c.window=c;c.globalThis=c;
 for(const f of['theme.js','maia.js','maia-proxy.js','sf.js','engine.js','engine-proxy.js']){try{vm.runInContext(fs.readFileSync(W+f,'utf8'),c,{filename:f})}catch(e){console.log('load',f,e.message)}}
 return c;
}
const src=fs.readFileSync(W+'app.js','utf8');
const c1=run();vm.runInContext(src,c1,{filename:'app.js'});
const ev=(c,x)=>vm.runInContext(x,c);
ev(c1,'vsAI=false;newGame()');
// play a game with a promotion-free line incl. castling + en passant-ish: pick pseudo-random legal moves
let seed=7;const r=()=>(seed=(seed*1103515245+12345)&0x7fffffff)/0x7fffffff;
for(let i=0;i<60;i++){ if(!ev(c1,'moves.length')||ev(c1,'over'))break; ev(c1,`doMove(moves[${Math.floor(r()*1000)}%moves.length])`);}
const snap=c=>JSON.stringify(ev(c,'({fen:fen(),sans,caps,last,mlog,hk:Object.keys(hist).length,hv:Object.values(hist).join(),g:[...gameH].join(),n:snaps.length,over,mode,hw,vsAI})'));
const a=snap(c1);console.log('saved key present:',!!store.cos_game,'plies',ev(c1,'sans.length'),'over',ev(c1,'over'));
const c2=run();vm.runInContext(src,c2,{filename:'app.js'});
const b=snap(c2);console.log('restore identical:',a===b);
if(a!==b){const A=JSON.parse(a),B=JSON.parse(b);for(const k in A)if(JSON.stringify(A[k])!==JSON.stringify(B[k]))console.log("DIFF",k,JSON.stringify(A[k]).slice(0,200),"|",JSON.stringify(B[k]).slice(0,200))}
// undo works after restore
ev(c2,'undo()');console.log('undo after restore plies:',ev(c2,'sans.length'),'(expected',ev(c1,'sans.length')-1+')');
// game that starts from a FEN (castling rights, black to move second) survives a restart
{
 const a1=run();vm.runInContext(src,a1,{filename:'app.js'});
 ev(a1,"vsAI=false;newGame('r3k2r/pppp1ppp/8/8/8/8/PPPP1PPP/R3K2R w KQkq - 0 1')");
 const mvs=['e1g1','e8c8','a1e1','d7d5'];
 for(const u of mvs)ev(a1,`(()=>{const f='abcdefgh'.indexOf('${u}'[0]),fy=8-'${u}'[1],t='abcdefgh'.indexOf('${u}'[2]),ty=8-'${u}'[3];doMove(moves.find(m=>m.fx===f&&m.fy===fy&&m.tx===t&&m.ty===ty))})()`);
 const a2=run();vm.runInContext(src,a2,{filename:'app.js'});
 console.log('FEN start restored:',snap(a1)===snap(a2),'| plies',ev(a2,'sans.length'),'| castles',ev(a2,'sans.slice(0,2).join(" ")'));
}
// parseFEN rejects junk and keeps valid rights only
console.log('parseFEN junk rejected:',ev(c1,"[parseFEN('hello'),parseFEN('8/8/8/8/8/8/8/8 w - - 0 1'),parseFEN('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')&&1].map(x=>x?1:0).join('')")==='001');
// finished game removes key
ev(c1,'end("x")');console.log('key removed on end:',!('cos_game' in store));
// corrupt save falls back
store.cos_game='{"m":"flat","o":"h","mv":[{"fx":0,"fy":0,"tx":5,"ty":5}]}';const c3=run();vm.runInContext(src,c3,{filename:'app.js'});console.log('corrupt -> fresh game plies:',ev(c3,'sans.length'));
