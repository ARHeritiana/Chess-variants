/* Chess Variants — theme engine.
   A theme is a whole design language, not a palette:
     c/L/D  colours            f  typefaces & text case
     s      shape, borders, shadows
     v      component styles (buttons, menu type, tabs, toolbar) + board look (frame, texture, hints)
     m      motion (easing, durations, entrances, how pieces travel, capture effects)
     pc     piece colours, outline, glow
     k      sound kit + pitch                                                                   */

const NA=window.NativeApp||null;           // Android bridge (null in a plain browser)
let theme='auto',TH=null,BGC=null,animOn=true,menuPref='theme';
try{
  theme=localStorage.getItem('cos_theme')||'auto';
  menuPref=localStorage.getItem('cos_menu')||'theme';
  const a=localStorage.getItem('cos_anim');
  animOn=a===null?!matchMedia('(prefers-reduced-motion:reduce)').matches:a!=='0';
}catch(e){}

const THEMES=[
{id:'auto',name:'Classic',sw:['ECDCB8','B58863','2F7D5B','F6F5F1','17181A'],
 L:{bg:'#f6f5f1',card:'#ffffff',ls:'#ecdcb8',ds:'#b58863',ac:'#2f7d5b',hl:'#ffd600',ha:.4,eb:'#2b6cb0'},
 D:{bg:'#17181a',card:'#222427',ls:'#ecdcb8',ds:'#b58863',ac:'#4fb98a',hl:'#ffd600',ha:.4,eb:'#66a8f0'},
 f:{u:'Inter',d:'Fraunces',m:'JetBrains Mono',dw:600,tls:'-.01em',serif:1},
 s:{r:14,rb:10,rs:99,bw:1,sh:'0 1px 2px rgba(0,0,0,.06),0 6px 20px rgba(0,0,0,.08)'},
 v:{btn:'soft',sheet:'bottom',tabs:'seg',tb:'dock',frame:'line',tex:'none',hint:'dot',lm:'fill',
    bgi:'radial-gradient(1200px 500px at 50% -140px,color-mix(in srgb,var(--accent) 14%,var(--bg)),var(--bg))'},
 m:{ease:'cubic-bezier(.2,.8,.2,1)',dur:260,stg:30,ent:'rise',move:'glide',mdur:260,cap:'ring',pulse:0},
 pc:{wf:'#f7f5ef',ws:'#1b1b1b',bf:'#1b1b1b',bs:'#f7f5ef',lw:3},
 k:['wood',1]},

{id:'warm',name:'Warm',sw:['C1383F','FE675C','F8A03D','FFD17B','C0683C'],
 c:{bg:'#fff5e3',card:'#fffbf3',ls:'#ffd17b',ds:'#c0683c',ac:'#c1383f',hl:'#f8a03d'},
 f:{u:'Nunito',d:'Fredoka',m:'Fredoka',dw:700,tls:'0'},
 s:{r:22,rb:16,rs:99,bw:1.5,sh:'0 2px 0 rgba(192,104,60,.12),0 10px 26px rgba(192,104,60,.16)'},
 v:{btn:'soft',sheet:'bottom',tabs:'fill',tb:'island',frame:'thick',fc:'ds',tex:'sheen',hint:'dot',lm:'fill',
    bgi:'linear-gradient(180deg,#ffeccb,var(--bg) 55%)'},
 m:{ease:'cubic-bezier(.3,1.2,.4,1)',sheetEase:'cubic-bezier(.34,1.45,.55,1)',dur:340,stg:45,ent:'pop',move:'spring',mdur:340,
    cap:'burst',pulse:1,pcols:['#c1383f','#f8a03d','#ffd17b'],pshape:'c'},
 pc:{wf:'#fff4dc',ws:'#7a2c25',bf:'#8a2f2c',bs:'#ffe7bd',lw:3,sh:1},
 k:['wood',1.3]},

{id:'cool',name:'Cool',sw:['83A6C0','A9C3D4','CFDBE9','E4F0F5','F7C3DE'],
 c:{bg:'#e9f2f7',card:'#f6fafc',ls:'#cfdbe9',ds:'#83a6c0',ac:'#4f7fa3',hl:'#f7c3de'},
 f:{u:'Manrope',d:'Manrope',m:'Manrope',dw:800,tls:'-.02em'},
 s:{r:20,rb:14,rs:99,bw:1,sh:'0 8px 32px rgba(79,127,163,.16),inset 0 1px 0 rgba(255,255,255,.7)'},
 v:{btn:'glass',sheet:'modal',tabs:'seg',tb:'dock',frame:'soft',tex:'sheen',hint:'ring',lm:'fill',bgi:'none'},
 m:{ease:'cubic-bezier(.25,.8,.25,1)',dur:320,stg:40,ent:'blurin',move:'float',mdur:420,cap:'ring',pulse:1,
    scrim:'rgba(120,160,190,.3)',blur:10},
 pc:{wf:'#fbfdff',ws:'#3d6a8a',bf:'#35566e',bs:'#e9f4fb',lw:2.5,sh:1},
 k:['glass',1]},

{id:'soft',name:'Soft',sw:['C89D8E','DAC0B8','F2E4DD','D6D5BC','B9B5B5'],
 c:{bg:'#f6efeb',card:'#fcf8f6',ls:'#f2e4dd',ds:'#c89d8e',ac:'#a5766a',hl:'#d6d5bc'},
 f:{u:'Quicksand',d:'DM Serif Display',m:'Quicksand',dw:400,tls:'0',serif:1},
 s:{r:26,rb:20,rs:99,bw:1,sh:'0 10px 30px rgba(165,118,106,.18)'},
 v:{btn:'neu',sheet:'bottom',tabs:'seg',tb:'island',frame:'soft',tex:'none',hint:'dot',lm:'fill',
    bgi:'linear-gradient(180deg,#fbf1ea,var(--bg) 60%)'},
 m:{ease:'cubic-bezier(.3,.7,.3,1)',dur:440,stg:60,ent:'fade',move:'float',mdur:480,cap:'ring',pulse:1},
 pc:{wf:'#fffaf6',ws:'#a5766a',bf:'#8a625a',bs:'#f2e4dd',lw:2.5,sh:1},
 k:['felt',1]},

{id:'powerful',name:'Powerful',dk:1,sw:['141516','46954D','FFE900','10398C','CF1A1A'],
 c:{bg:'#141516',card:'#1f2122',ls:'#fff27a',ds:'#10398c',ac:'#ffe900',hl:'#46954d',hc:'#cf1a1a'},
 f:{u:'Barlow Condensed',d:'Barlow Condensed',m:'Barlow Condensed',dw:700,tt:'uppercase',tls:'.04em',btt:'uppercase',bls:'.05em',fsz:17.5},
 s:{r:0,rb:2,rs:0,bw:2.5,sh:'none',msh:'-8px 0 0 var(--accent)'},
 v:{btn:'brutal',sheet:'drawer',tabs:'fill',tb:'bar',frame:'thick',fc:'ac',tex:'none',hint:'square',lm:'edge',bgi:'none'},
 m:{ease:'cubic-bezier(.7,0,.2,1)',dur:230,stg:28,ent:'slidex',move:'snap',mdur:150,cap:'shake',shk:7,pulse:1,
    pcols:['#ffe900','#cf1a1a','#ffffff'],pshape:'sq',scrim:'rgba(0,0,0,.62)'},
 pc:{wf:'#ffffff',ws:'#141516',bf:'#cf1a1a',bs:'#ffffff',lw:3.5},
 k:['deep',1]},

{id:'modern',name:'Modern',sw:['232324','4D4D4D','F2F2F2','FBFBFD','E09B5F'],
 c:{bg:'#f2f2f2',card:'#fbfbfd',ls:'#ebebed',ds:'#4d4d4d',ac:'#e09b5f',hl:'#e09b5f'},
 f:{u:'Space Grotesk',d:'Space Grotesk',m:'JetBrains Mono',dw:700,tls:'-.03em'},
 s:{r:8,rb:6,rs:6,bw:1,sh:'none'},
 v:{btn:'outline',sheet:'top',tabs:'under',tb:'bar',frame:'line',tex:'none',hint:'dot',lm:'edge',bgi:'none'},
 m:{ease:'cubic-bezier(.3,.7,.1,1)',dur:210,stg:22,ent:'drop',move:'glide',mdur:170,cap:'ring',pulse:0,scrim:'rgba(0,0,0,.3)'},
 pc:{wf:'#fbfbfd',ws:'#232324',bf:'#232324',bs:'#f2f2f2',lw:2},
 k:['click',1]},

{id:'futuristic',name:'Futuristic',dk:1,sw:['FE2468','6A1AF4','476DEF','24C0E9','13C9B1'],
 c:{bg:'#0f0d24',card:'#1a1740',ls:'#476def',ds:'#2b1b7a',ac:'#13c9b1',hl:'#fe2468'},
 f:{u:'Rajdhani',d:'Orbitron',m:'Orbitron',dw:800,tt:'uppercase',tls:'.12em',btt:'uppercase',bls:'.08em',fsz:17.5},
 s:{r:4,rb:3,rs:2,bw:1,sh:'0 0 0 1px rgba(19,201,177,.35),0 0 26px rgba(19,201,177,.18)',msh:'0 0 40px rgba(19,201,177,.25)'},
 v:{btn:'neon',sheet:'full',tabs:'box',tb:'bar',frame:'glow',tex:'grid',hint:'bracket',lm:'edge',
    bgi:'radial-gradient(900px 500px at 85% -10%,rgba(254,36,104,.2),transparent),radial-gradient(900px 600px at 0% 110%,rgba(106,26,244,.28),transparent)'},
 m:{ease:'cubic-bezier(.2,.9,.1,1)',dur:340,stg:35,ent:'wipe',move:'glide',mdur:210,trail:1,cap:'glitch',shk:4,pulse:1,
    pcols:['#13c9b1','#fe2468','#24c0e9'],pshape:'sq',scrim:'rgba(5,3,20,.72)',blur:6},
 pc:{wf:'#e8fbff',ws:'#0a2a4a',bf:'#fe2468',bs:'#ffe6ef',lw:2.5,wg:'#24c0e9',bg:'#fe2468',gb:12},
 k:['synth',1]},

{id:'popular',name:'Popular',sw:['549F59','8FCC65','FFF251','EB7293','054A8D'],
 c:{bg:'#f6f9ea',card:'#fdfef6',ls:'#fff68a',ds:'#549f59',ac:'#054a8d',hl:'#eb7293'},
 f:{u:'Poppins',d:'Fredoka',m:'Fredoka',dw:700,tls:'0',fsz:15.5},
 s:{r:22,rb:16,rs:99,bw:2,sh:'0 10px 26px rgba(5,74,141,.14)'},
 v:{btn:'candy',sheet:'bottom',tabs:'fill',tb:'island',frame:'thick',fc:'ac',tex:'sheen',hint:'dot',lm:'fill',
    bgi:'linear-gradient(180deg,#e8f5cf,var(--bg) 50%)'},
 m:{ease:'cubic-bezier(.3,1.4,.5,1)',sheetEase:'cubic-bezier(.3,1.5,.5,1)',dur:380,stg:55,ent:'pop',move:'arc',mdur:400,land:1,
    cap:'burst',pulse:1,pcols:['#eb7293','#fff251','#054a8d','#8fcc65'],pshape:'r'},
 pc:{wf:'#ffffff',ws:'#054a8d',bf:'#eb7293',bs:'#ffffff',lw:3.2,sh:1},
 k:['arcade',1]},

{id:'romantic',name:'Romantic',sw:['A47DA1','E591AE','F6B1C3','F5E2CA','B0CEE3'],
 c:{bg:'#fbf1ee',card:'#fffaf8',ls:'#f5e2ca',ds:'#e591ae',ac:'#a47da1',hl:'#b0cee3'},
 f:{u:'Cormorant Garamond',d:'Playfair Display',m:'Cormorant Garamond',dw:700,tls:'0',fsz:17,uw:500,serif:1},
 s:{r:24,rb:26,rs:99,bw:1,sh:'0 12px 34px rgba(164,125,161,.2)'},
 v:{btn:'outline',bbd:'color-mix(in srgb,var(--accent) 65%,transparent)',sheet:'modal',tabs:'under',tb:'island',frame:'double',fc:'ac',
    tex:'sheen',hint:'heart',lm:'fill',bgi:'linear-gradient(180deg,#fde4ec,var(--bg) 60%)'},
 m:{ease:'cubic-bezier(.4,.1,.2,1)',dur:440,stg:60,ent:'rise',move:'float',mdur:520,cap:'burst',pulse:1,
    pcols:['#e591ae','#f6b1c3','#b0cee3'],pshape:'h',scrim:'rgba(164,125,161,.28)',blur:8},
 pc:{wf:'#fffaf5',ws:'#a47da1',bf:'#a47da1',bs:'#fff2f6',lw:2.5,sh:1},
 k:['harp',1]},

{id:'natural',name:'Natural',sw:['D58568','30402F','577160','9CB6A8','DCE0C3'],
 c:{bg:'#eef1e1',card:'#f8f9f0',ls:'#dce0c3',ds:'#577160',ac:'#30402f',hl:'#d58568'},
 f:{u:'Nunito',d:'Lora',m:'Nunito',dw:600,tls:'0',serif:1},
 s:{r:24,rb:16,rs:99,bw:1,sh:'0 6px 22px rgba(48,64,47,.14)'},
 v:{btn:'flat',sheet:'bottom',tabs:'seg',tb:'island',frame:'thick',fc:'ds',tex:'grain',hint:'dot',lm:'fill',bgi:'none'},
 m:{ease:'cubic-bezier(.3,.6,.3,1)',dur:360,stg:45,ent:'blurin',move:'glide',mdur:330,cap:'ring',pulse:0},
 pc:{wf:'#f4efd8',ws:'#30402f',bf:'#30402f',bs:'#dce0c3',lw:3,sh:1},
 k:['wood',.85]},

{id:'exclusive',name:'Exclusive',dk:1,sw:['332C48','4D453C','D89467','92181F','51394C'],
 c:{bg:'#1c1829',card:'#2a2340',ls:'#d89467',ds:'#51394c',ac:'#d89467',hl:'#92181f',hc:'#fff1c9'},
 f:{u:'Cormorant Garamond',d:'Cinzel',m:'Cinzel',dw:700,tt:'uppercase',tls:'.1em',fsz:17,uw:500,serif:1},
 s:{r:6,rb:2,rs:2,bw:1,sh:'0 20px 50px rgba(0,0,0,.45)'},
 v:{btn:'double',sheet:'modal',tabs:'under',tb:'bar',frame:'double',fc:'ac',tex:'sheen',hint:'diamond',lm:'edge',bgi:'none'},
 m:{ease:'cubic-bezier(.45,.05,.2,1)',dur:440,stg:70,ent:'fade',move:'glide',mdur:470,cap:'ring',pulse:1,scrim:'rgba(8,6,16,.72)',blur:3},
 pc:{wf:'#f6e8cc',ws:'#2a2340',bf:'#1c1829',bs:'#e8cfa4',lw:2.5,sh:1,wg:'rgba(216,148,103,.55)',gb:7},
 k:['harp',.7]},

{id:'traditional',name:'Traditional',sw:['3B3B3B','BA3C3A','DF9448','455A9E','B0D8C0'],
 c:{bg:'#f1f1ea',card:'#fbfbf7',ls:'#b0d8c0',ds:'#455a9e',ac:'#ba3c3a',hl:'#df9448'},
 f:{u:'Crimson Pro',d:'Playfair Display',m:'Crimson Pro',dw:700,tls:'0',fsz:17.5,serif:1},
 s:{r:3,rb:3,rs:3,bw:1,sh:'0 1px 0 rgba(0,0,0,.08),0 8px 18px rgba(60,40,10,.12)'},
 v:{btn:'outline',sheet:'drawerL',tabs:'under',tb:'bar',frame:'double',fc:'fg',tex:'none',hint:'dot',lm:'fill',bgi:'none'},
 m:{ease:'cubic-bezier(.3,.7,.2,1)',dur:330,stg:50,ent:'slidexl',move:'arc',mdur:340,cap:'ring',pulse:0},
 pc:{wf:'#fbfbf7',ws:'#3b3b3b',bf:'#3b3b3b',bs:'#fbfbf7',lw:3,sh:1},
 k:['wood',1]},

{id:'dark',name:'Dark',dk:1,sw:['2E323C','2A4150','45405D','4A3937','3C2F2C'],
 c:{bg:'#1d2027',card:'#2e323c',ls:'#5d5880',ds:'#2a4150',ac:'#8a84b8',hl:'#c9a27e'},
 f:{u:'IBM Plex Sans',d:'IBM Plex Sans',m:'JetBrains Mono',dw:600,tls:'-.01em'},
 s:{r:10,rb:7,rs:8,bw:1,sh:'0 6px 22px rgba(0,0,0,.35)'},
 v:{btn:'flat',sheet:'drawer',tabs:'box',tb:'dock',frame:'line',tex:'none',hint:'ring',lm:'edge',bgi:'none'},
 m:{ease:'cubic-bezier(.2,.8,.2,1)',dur:230,stg:24,ent:'slidex',move:'glide',mdur:200,cap:'ring',pulse:1},
 pc:{wf:'#ece9f7',ws:'#14161b',bf:'#14161b',bs:'#b7b2d9',lw:2.5,sh:1},
 k:['click',1]}
];

/* ───────── colour helpers ───────── */
const hx=c=>[1,3,5].map(i=>parseInt(c.slice(i,i+2),16)),
 mix=(a,b,t)=>'#'+hx(a).map((v,i)=>Math.round(v*(1-t)+hx(b)[i]*t).toString(16).padStart(2,'0')).join(''),
 lum=c=>{const[a,b,d]=hx(c).map(v=>{v/=255;return v<=.04?v/12.92:Math.pow((v+.055)/1.055,2.4)});return .2126*a+.7152*b+.0722*d};
const sysDark=()=>{try{return NA?!!NA.systemDark():matchMedia('(prefers-color-scheme:dark)').matches}catch(e){return false}};

function palOf(t,dark){
  const c=t.c||(dark?t.D:t.L),dk=t.c?!!t.dk:dark,fg=dk?'#f2f0ed':'#1d1d1b';
  const P={bg:c.bg,card:c.card,ls:c.ls,ds:c.ds,ac:c.ac,fg,dk,
    muted:mix(fg,c.bg,.42),line:mix(fg,c.card,.84),onacc:lum(c.ac)>.33?'#161616':'#ffffff',
    acc2:mix(c.ac,'#000000',.32),b:c.eb||c.ac,hls:'rgb('+hx(c.hl).join(',')+')',hrgb:hx(c.hc||c.ac).join(','),hlc:'rgba('+hx(c.hl).join(',')+','+(c.ha||.55)+')',
    accrgb:hx(c.ac).join(','),pkbg:mix(c.ls,c.ds,.35)};
  P.glow='rgba('+P.accrgb+',.5)';
  return P;
}
const SHN={bottom:'slide-up sheet',modal:'pop-up card',drawer:'side drawer',drawerL:'index drawer',top:'drop-down panel',full:'full-screen takeover'};
const MVN={glide:'gliding',arc:'hopping',spring:'springy',snap:'snappy',float:'floating'};
const descr=t=>t.f.d+' · '+SHN[t.v.sheet]+' · '+MVN[t.m.move]+' pieces';
const FB="system-ui,-apple-system,'Segoe UI',Roboto,sans-serif";
const stackU=t=>"'"+t.f.u+"',"+FB, stackD=t=>"'"+t.f.d+"',"+(t.f.serif?'Georgia,serif':FB);

/* ───────── apply a theme: variables + data-attributes + canvas palette ───────── */
function themeCore(id){
  const t=THEMES.find(x=>x.id===id)||THEMES[0],dark=t.c?!!t.dk:sysDark(),P=palOf(t,dark);
  const R=document.documentElement,st=R.style,v=t.v,m=t.m,sp=t.s,f=t.f;
  theme=t.id;
  const SH=menuPref==='theme'?v.sheet:menuPref,r=sp.r,sheetR={bottom:(r*1.6)+'px '+(r*1.6)+'px 0 0',top:'0 0 '+(r*1.6)+'px '+(r*1.6)+'px',modal:(r*1.4)+'px',
    drawer:(r*1.4)+'px 0 0 '+(r*1.4)+'px',drawerL:'0 '+(r*1.4)+'px '+(r*1.4)+'px 0',full:'0'}[SH];
  const V={'--bg':P.bg,'--fg':P.fg,'--muted':P.muted,'--card':P.card,'--line':P.line,'--accent':P.ac,'--onacc':P.onacc,'--acc2':P.acc2,
    '--b':P.b,'--ls':P.ls,'--ds':P.ds,'--hl':P.hlc,'--accrgb':P.accrgb,'--glow':P.glow,'--pkbg':P.pkbg,
    '--pw':t.pc.wf,'--pwo':t.pc.ws,'--pb':t.pc.bf,'--pbo':t.pc.bs,
    '--r':r+'px','--rb':sp.rb+'px','--rs':sp.rs+'px','--rsh':sheetR,'--bw':sp.bw+'px','--sh':sp.sh,
    '--msh':sp.msh||(SH==='bottom'?'0 -10px 40px rgba(0,0,0,.28)':'0 20px 60px rgba(0,0,0,.35)'),
    '--neu':P.dk?'6px 6px 14px rgba(0,0,0,.45),-5px -5px 12px rgba(255,255,255,.04)':'7px 7px 16px rgba(165,118,106,.2),-7px -7px 16px rgba(255,255,255,.85)',
    '--neui':P.dk?'inset 4px 4px 9px rgba(0,0,0,.45),inset -4px -4px 9px rgba(255,255,255,.04)':'inset 4px 4px 9px rgba(165,118,106,.22),inset -4px -4px 9px rgba(255,255,255,.85)',
    '--fu':stackU(t),'--fd':stackD(t),'--fm':"'"+f.m+"',ui-monospace,Menlo,monospace",'--fdw':f.dw,'--fw':f.uw||400,
    '--tt':f.tt||'none','--tls':f.tls||'0','--btt':f.btt||'none','--bls':f.bls||'0','--fsz':(f.fsz||16)+'px','--lbs':f.tt?'.1em':'.04em',
    '--ease':m.ease,'--sheet-ease':m.sheetEase||m.ease,'--dur':m.dur+'ms','--stg':m.stg+'ms','--ent':m.ent,'--shk':(m.shk||0)+'px',
    '--scrim':m.scrim||'rgba(0,0,0,.42)','--sblur':(m.blur||0)+'px','--bgimg':v.bgi||'none'};
  for(const k in V)st.setProperty(k,V[k]);
  if(v.bbd)st.setProperty('--bbd',v.bbd);else st.removeProperty('--bbd');
  Object.assign(R.dataset,{theme:t.id,mode:P.dk?'dark':'light',btn:v.btn,sheet:SH,tabs:v.tabs,tb:v.tb,fx:animOn?'on':'off'});
  document.body.style.fontWeight=f.uw||400;
  const mt=document.querySelector('meta[name=theme-color]');if(mt)mt.content=P.bg;
  TH=Object.assign({},t,{pal:P,dark:P.dk,fu:stackU(t),fd:stackD(t)});BGC=null;
  if(NA)try{NA.setBars(P.bg,P.dk)}catch(e){}
  try{localStorage.setItem('cos_theme',theme)}catch(e){}
  document.querySelectorAll('#thg .opt').forEach(b=>b.classList.toggle('on',b.id==='th_'+theme));
  const se=document.getElementById('s_theme');if(se)se.innerHTML=ddsum(sw5(t.sw),'Theme',t.name);
  // webfonts are local; redraw canvas once they are ready
  const need=['400 16px "'+f.u+'"','700 16px "'+f.u+'"',f.dw+' 20px "'+f.d+'"','500 16px "'+f.m+'"','40px ChessSym'];
  if(document.fonts)Promise.all(need.map(x=>document.fonts.load(x))).then(()=>{BGC=null;if(typeof s!=='undefined'&&s){draw();renderList();if(typeof moveInd==='function')moveInd()}}).catch(()=>{});
  if(typeof s!=='undefined'&&s){draw();renderList()}
  if(typeof moveInd==='function')requestAnimationFrame(moveInd);
}

/* Theme swap: circular reveal from the tap point (View Transitions), falls back to an instant swap. */
function applyTheme(id,ev,instant){
  const R=document.documentElement;
  if(instant||!animOn||!document.startViewTransition||theme===id){themeCore(id);return}
  const x=ev&&ev.clientX!=null?ev.clientX:innerWidth/2,y=ev&&ev.clientY!=null?ev.clientY:innerHeight/2,
        rad=Math.hypot(Math.max(x,innerWidth-x),Math.max(y,innerHeight-y));
  R.classList.add('nt');
  try{
    const vt=document.startViewTransition(()=>{themeCore(id)});
    vt.ready.then(()=>R.animate({clipPath:['circle(0px at '+x+'px '+y+'px)','circle('+rad+'px at '+x+'px '+y+'px)']},
      {duration:620,easing:'cubic-bezier(.3,.7,.2,1)',pseudoElement:'::view-transition-new(root)'})).catch(()=>{});
    vt.finished.finally(()=>R.classList.remove('nt'));
  }catch(e){R.classList.remove('nt');themeCore(id)}
}
function setAnim(b){
  animOn=b;try{localStorage.setItem('cos_anim',b?'1':'0')}catch(e){}
  document.documentElement.dataset.fx=b?'on':'off';
}
/* Classic follows the system light/dark setting */
function sysModeChanged(){if(theme==='auto')themeCore('auto')}
try{matchMedia('(prefers-color-scheme:dark)').addEventListener('change',sysModeChanged)}catch(e){}
window.__sysMode=sysModeChanged;

/* Mini preview chip for the theme picker: the theme's own font, corner radius and button depth */
function chipOf(t){
  const P=palOf(t,false),b=t.v.btn,fg=P.fg;
  const sh={brutal:'3px 3px 0 '+fg,candy:'0 3px 0 '+P.acc2,neon:'0 0 10px '+P.ac,double:'0 0 0 3px '+P.card+',0 0 0 4px '+mix(fg,P.card,.5),neu:'3px 3px 7px rgba(0,0,0,.18)'}[b]||'none';
  const ol=['outline','double'].includes(b),bg=ol?P.card:P.ac,col=ol?P.fg:P.onacc;
  return '<i class="tp" style="font-family:'+stackD(t)+';font-weight:'+t.f.dw+';border-radius:'+Math.min(t.s.rb,18)+'px;background:'+bg+';color:'+col+
    ';border:'+Math.max(1,Math.min(t.s.bw,2.5))+'px solid '+(b==='brutal'?fg:P.ac)+';box-shadow:'+sh+'">Aa</i>';
}

/* ───────── sound kits ─────────
   tn(freq,when,dur,wave,vol,freqEnd)  /  ns(when,dur,vol,filterHz)  come from app.js.   */
function melodic(k,p,w){
  if(k==='promo'){[523,659,784,1047].forEach((f,i)=>tn(f*p,i*.09,i===3?.3:.14,w,.3))}
  else if(k==='check'){tn(880*p,0,.12,w==='triangle'?'square':w,.1);tn(880*p,.15,.14,w==='triangle'?'square':w,.1)}
  else if(k==='mate'){tn(392*p,0,.3,'sawtooth',.16,330*p);tn(311*p,.25,.3,'sawtooth',.16,260*p);tn(233*p,.5,.8,'sawtooth',.18,200*p);tn(70,.5,.9,'sine',.6,40);ns(.5,.3,.7,300)}
  else if(k==='draw'){tn(392*p,0,.25,'sine',.3);tn(330*p,.2,.45,'sine',.3)}
  else if(k==='start'){tn(330*p,0,.1,'sine',.25);tn(440*p,.08,.16,'sine',.25)}
}
const KITS={
  wood(k,p){const K=(t,v)=>{tn(210*p,t,.09,'sine',v,110*p);ns(t,.04,v,1800*p)};
    if(k==='move')K(0,.5);else if(k==='cap'){tn(150*p,0,.14,'sine',.7,70*p);ns(0,.09,.9,1200*p);ns(0,.03,.6,3000)}
    else if(k==='castle'){K(0,.45);K(.15,.45)}else melodic(k,p,'triangle')},
  felt(k,p){const K=(t,v)=>{tn(150*p,t,.16,'sine',v,90*p);ns(t,.06,v*.3,500)};
    if(k==='move')K(0,.55);else if(k==='cap'){tn(110*p,0,.2,'sine',.7,60*p);ns(0,.08,.4,700)}
    else if(k==='castle'){K(0,.5);K(.17,.5)}else melodic(k,p*.9,'sine')},
  glass(k,p){const K=(t,v,f)=>{tn(f*p,t,.28,'sine',v);tn(f*1.5*p,t,.16,'sine',v*.35)};
    if(k==='move')K(0,.3,1180);else if(k==='cap'){K(0,.34,880);ns(0,.025,.25,5000)}
    else if(k==='castle'){K(0,.28,1180);K(.14,.28,1480)}else melodic(k,p*1.3,'sine')},
  harp(k,p){const K=(t,v,f)=>{tn(f*p,t,.4,'triangle',v,f*p*.985);tn(f*2*p,t,.2,'sine',v*.25)};
    if(k==='move')K(0,.32,392);else if(k==='cap'){K(0,.42,196);ns(0,.02,.2,2500)}
    else if(k==='castle'){K(0,.3,392);K(.16,.3,523)}else melodic(k,p,'triangle')},
  synth(k,p){const K=(t,v)=>tn(330*p,t,.07,'square',v,165*p);
    if(k==='move')K(0,.12);else if(k==='cap'){tn(220*p,0,.16,'sawtooth',.18,70*p);ns(0,.06,.3,4000)}
    else if(k==='castle'){K(0,.11);K(.1,.11)}else melodic(k,p,'square')},
  arcade(k,p){const K=(t,v)=>tn(440*p,t,.06,'square',v,880*p);
    if(k==='move')K(0,.13);else if(k==='cap'){tn(660*p,0,.05,'square',.14,220*p);tn(220*p,.05,.1,'square',.14,110*p)}
    else if(k==='castle'){K(0,.12);tn(660*p,.09,.06,'square',.12,1320*p)}else melodic(k,p,'square')},
  click(k,p){const K=(t,v)=>{ns(t,.012,v,3500);tn(900*p,t,.03,'sine',.18,500*p)};
    if(k==='move')K(0,.6);else if(k==='cap'){ns(0,.03,.9,2200);tn(300*p,0,.06,'sine',.4,150*p)}
    else if(k==='castle'){K(0,.55);K(.1,.55)}else melodic(k,p,'sine')},
  deep(k,p){const K=(t,v)=>{tn(95*p,t,.14,'sine',v,50*p);ns(t,.05,v*.5,900)};
    if(k==='move')K(0,.9);else if(k==='cap'){tn(70*p,0,.22,'sine',1,35*p);ns(0,.12,1,700);ns(0,.03,.8,2500)}
    else if(k==='castle'){K(0,.8);K(.17,.8)}else melodic(k,p*.8,'sawtooth')}
};
