/* Chess Variants — piece sets.
   Four looks, one per theme:  classic (flat cburnett)  ·  shaded (carved ivory/ebony)  ·  round (geometric)  ·  angular (neon outlines).
   Each set turns a piece letter (PNBRQK white, pnbrqk black) into an SVG string on a 45x45 grid.
   Colours come from the theme's `pc` block:  wf/ws  white fill/stroke,  bf/bs  black fill/stroke,  bd  black detail,  wg/bg  glow.
   Pieces.use(pc) builds the 12 images once per theme; Pieces.img(p) is what the canvas draws, Pieces.url(p) is for <img> tags. */
(function(){
const NS='xmlns="http://www.w3.org/2000/svg"',KINDS='pnbrqk';

/* ───────── round (Modern): flat geometric silhouettes ───────── */
const ROUND={
 p:'<circle cx="22.5" cy="13.5" r="5.6"/><rect x="16" y="20.5" width="13" height="3.4" rx="1.7"/><path d="M17.5 24 H27.5 L30 34 H15 Z"/>',
 r:'<path d="M14 34V29.5H16.2V19.5H14V10H18.4V13.4H20.8V10H24.2V13.4H26.6V10H31V19.5H28.8V29.5H31V34Z"/>',
 n:'<path d="M14.5 34C15.4 29 17 26.5 20.2 23.8L15.6 25.4C13.6 26 11.6 25 11.6 23.2C11.6 21 15 16 19.6 11.2L21.4 8.2L23.8 10.4C27.5 11.5 31.6 15.5 31.8 23C31.9 27 31.2 30.5 30.5 34Z"/>',
 b:'<circle cx="22.5" cy="7.2" r="2.4"/><path d="M22.5 9.5C27.6 14 30 17.8 30 21.5C30 25 26.6 27.2 22.5 27.2C18.4 27.2 15 25 15 21.5C15 17.8 17.4 14 22.5 9.5Z"/><rect x="16.5" y="27.4" width="12" height="3.2" rx="1.6"/><path d="M17 30.6H28L30 34H15Z"/>',
 q:'<circle cx="10.5" cy="12.6" r="2.4"/><circle cx="16.5" cy="8.8" r="2.4"/><circle cx="22.5" cy="6.2" r="2.4"/><circle cx="28.5" cy="8.8" r="2.4"/><circle cx="34.5" cy="12.6" r="2.4"/><path d="M12.5 34L10.5 14L15.5 23L16.5 10.5L20.5 21L22.5 8L24.5 21L28.5 10.5L29.5 23L34.5 14L32.5 34Z"/>',
 k:'<path d="M21 3.8H24V6.8H27V9.8H24V12.8H21V9.8H18V6.8H21Z"/><path d="M13.5 34C13.5 24 15.5 15.5 22.5 15.5C29.5 15.5 31.5 24 31.5 34Z"/><rect x="13.4" y="21" width="18.2" height="3.2" rx="1.6"/>'
};
const ROUND_BASE='<rect x="11" y="34" width="23" height="4" rx="2"/>';
/* detail strokes drawn in the contrast colour on top of a round piece */
const ROUND_DET={n:'<circle cx="25.6" cy="15.6" r="1.1" class="d"/>',b:'<path d="M22.5 13.5L26 18.4" class="ds"/>',k:'',q:'',r:'',p:''};

/* ───────── angular (Futuristic): straight-edged neon outlines ───────── */
const ANG={
 p:'<path d="M22.5 7L27.5 12.5L22.5 18L17.5 12.5Z"/><path d="M14 35L19 21H26L31 35Z"/>',
 r:'<path d="M13 35L15.4 29.5V18L12 15V7.5H17V11.5H20.4V7.5H24.6V11.5H28V7.5H33V15L29.6 18V29.5L32 35Z"/>',
 n:'<path d="M13.5 35L16 26L12 24.5L11 20.5L18.5 10L21 6.5L23.5 10.5L28 10L33 22L31.5 35Z"/><path d="M21.6 15L24.4 16.6" class="ds"/>',
 b:'<path d="M22.5 5L30.4 19.4L26.2 27.4H18.8L14.6 19.4Z"/><path d="M16.5 30.4H28.5L31.4 35H13.6Z"/><path d="M21.4 12.4L26.4 19" class="ds"/>',
 q:'<path d="M11.5 35L8.6 11.5L16 21.6L22.5 6.5L29 21.6L36.4 11.5L33.5 35Z"/>',
 k:'<path d="M20.4 4H24.6V8H28.6V11.8H24.6V15.4H20.4V11.8H16.4V8H20.4Z"/><path d="M12.6 35L16.2 21L22.5 17.2L28.8 21L32.4 35Z"/>'
};
const ANG_BASE='<path d="M11 35H34V38H11Z"/>';

/* ───────── helpers ───────── */
function svgWrap(inner,defs){return '<svg '+NS+' viewBox="0 0 45 45" width="180" height="180">'+(defs?'<defs>'+defs+'</defs>':'')+inner+'</svg>'}
function classicSVG(p,K,shaded){
 const white=p<'a',src=window.PIECES_CLASSIC[white?p:p.toLowerCase()===p?p:p];
 const g=src&&src.replace(/@([DLM])/g,(m,t)=>white?(t==='D'?K.s:K.f):(t==='D'?K.f:K.d));
 if(!shaded)return svgWrap(g);
 const defs='<radialGradient id="gw" cx=".38" cy=".3" r=".9"><stop offset="0" stop-color="#fffdf6"/><stop offset=".6" stop-color="'+K.f+'"/><stop offset="1" stop-color="'+K.fm+'"/></radialGradient>'+
  '<radialGradient id="gb" cx=".38" cy=".3" r=".9"><stop offset="0" stop-color="'+K.fl+'"/><stop offset=".55" stop-color="'+K.f+'"/><stop offset="1" stop-color="'+K.fm+'"/></radialGradient>'+
  '<filter id="sh" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="1.1" stdDeviation=".9" flood-color="#2a1608" flood-opacity=".42"/></filter>';
 const sh=white?g.split(K.f).join('url(#gw)'):g.split(K.f).join('url(#gb)');
 return svgWrap('<g filter="url(#sh)">'+sh+'</g>',defs);
}
function roundSVG(p,K){
 const k=p.toLowerCase(),fill=p<'a'?K.f:K.f,sk=K.s;
 const body='<g fill="'+fill+'" stroke="'+sk+'" stroke-width="1.5" stroke-linejoin="round">'+ROUND[k]+ROUND_BASE+'</g>';
 const det=ROUND_DET[k].replace(/class="d"/,'fill="'+K.d+'"').replace(/class="ds"/,'fill="none" stroke="'+K.d+'" stroke-width="1.6" stroke-linecap="round"');
 return svgWrap(body+det);
}
function angularSVG(p,K){
 const k=p.toLowerCase(),glow=K.g;
 const defs='<filter id="gl" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>';
 const fill=K.f;
 const body='<g filter="url(#gl)" fill="'+fill+'" stroke="'+K.s+'" stroke-width="1.7" stroke-linejoin="miter" stroke-miterlimit="4">'+ANG[k]+ANG_BASE+'</g>';
 const det=ANG[k].indexOf('class="ds"')<0?'':'';
 return svgWrap(body.replace(/class="ds"/g,'fill="none" stroke="'+K.s+'" stroke-width="1.3"'),defs)+det;
}
const BUILD={
 classic:(p,K)=>classicSVG(p,K,false),
 shaded:(p,K)=>classicSVG(p,K,true),
 round:roundSVG,
 angular:angularSVG
};

/* ───────── per-theme cache ───────── */
let IM={},UR={},cur='';
function colours(pc,white){
 return white?{f:pc.wf,s:pc.ws,d:pc.ws,fm:pc.wm||pc.wf,fl:pc.wf,g:pc.wg||pc.ws}
             :{f:pc.bf,s:pc.bs,d:pc.bd||pc.bs,fm:pc.bm||pc.bf,fl:pc.bl||pc.bf,g:pc.bg||pc.bs};
}
function svgOf(set,p,pc){return (BUILD[set]||BUILD.classic)(p,colours(pc,p<'a'))}
const dataUrl=s=>'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(s);
/* use(pc): (re)builds the 12 piece images for a theme; cb runs once they are decoded */
function use(pc,cb){
 const key=pc.set+'|'+['wf','ws','bf','bs','bd','wg','bg','wm','bm','bl'].map(k=>pc[k]||'').join(','),next={},nu={};
 if(key===cur){if(cb)cb();return}
 cur=key;let left=12;
 for(const c of'PNBRQKpnbrqk'){
  const url=dataUrl(svgOf(pc.set,c,pc)),im=new Image();nu[c]=url;
  const done=()=>{if(--left===0&&cur===key){IM=next;UR=nu;if(cb)cb()}};
  im.onload=done;im.onerror=done;im.src=url;next[c]=im;
 }
 UR=nu;
}
window.Pieces={use,img:p=>IM[p]||null,url:p=>UR[p]||'',svgOf};
})();
