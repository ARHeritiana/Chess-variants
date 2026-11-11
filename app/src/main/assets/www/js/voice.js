/* Match speech only against legal moves. Confirm the interpreted move before playing. */
const Voice={position:null,ply:0,mode:'',recognizer:null,active:false};
const voiceEl=id=>document.getElementById(id);
function voiceNormalize(text){
 const words={one:'1',two:'2',three:'3',four:'4',five:'5',six:'6',seven:'7',eight:'8',won:'1',too:'2',for:'4',ate:'8',bee:'b',be:'b',see:'c',sea:'c',dee:'d',eee:'e',gee:'g',aitch:'h'};
 return String(text).toLowerCase().replace(/[.,!?+#]/g,' ').replace(/\b(?:to|from|on|at|takes|take|captures|capture|move|the|please|promote|promotes|equals|into)\b/g,' ')
  .split(/\s+/).filter(Boolean).map(x=>words[x]||x).join('').replace(/-/g,'').replace(/knight/g,'n').replace(/bishop/g,'b').replace(/rook/g,'r').replace(/queen/g,'q').replace(/king/g,'k').replace(/pawn/g,'p');
}
function voiceMatches(P,L,text){
 const key=voiceNormalize(text),out=[],sq=(x,y)=>'abcdefgh'[x]+(8-y);
 for(const m of L){
  const piece=P.b[m.fy*8+m.fx].toLowerCase(),promo=piece==='p'&&(m.ty===0||m.ty===7);
  for(const pr of promo?['q','r','b','n']:[null]){
   const mm=pr?{...m,pr}:m,a=sq(m.fx,m.fy),b=sq(m.tx,m.ty),suffix=pr||'';
   const aliases=[a+b+suffix,piece+b+suffix,piece+a+b+suffix,piece+a[0]+b+suffix,piece+a[1]+b+suffix,
    voiceNormalize(san(P,mm,L)).replace(/x/g,'')];
   if(piece==='p')aliases.push(b+suffix);
   if(m.k==='c')aliases.push(m.tx===6?'castlekingside':'castlequeenside',m.tx===6?'shortcastle':'longcastle',m.tx===6?'castleshort':'castlelong',m.tx===6?'castleskingside':'castlesqueenside','castle');
   if(aliases.some(alias=>voiceNormalize(alias).replace(/=/g,'')===key.replace(/=/g,'')))out.push(mm);
  }
 }
 return out;
}
function voiceMessage(t){voiceEl('voiceStatus').textContent=t}
function voiceCancel(){
 Voice.active=false;Voice.position=null;if(Voice.recognizer){Voice.recognizer.abort();Voice.recognizer=null}
 voiceEl('voicePanel').hidden=true;voiceEl('voiceChoices').replaceChildren();
}
function voiceCurrent(){return Voice.position===s&&Voice.ply===sans.length&&Voice.mode===mode&&canPlay()}
window.__voiceResult=texts=>{
 if(!Voice.active)return;
 if(!voiceCurrent()){voiceEl('voiceChoices').replaceChildren();voiceMessage('The position changed. Start voice input again.');return}
 const choices=new Map();
 for(const text of texts||[])for(const m of voiceMatches(s,moves,text))choices.set([m.fx,m.fy,m.tx,m.ty,m.pr||''].join(','),m);
 const host=voiceEl('voiceChoices');host.replaceChildren();
 voiceMessage(choices.size?(choices.size===1?'Confirm your move:':'Several legal moves match. Choose one:'):'No legal move matched. Try “knight to f3” or “e2 to e4”.');
 for(const m of choices.values()){
  const b=document.createElement('button');b.textContent='Play '+san(s,m,moves);b.onclick=()=>{
   if(!voiceCurrent()){host.replaceChildren();voiceMessage('The position changed. Start voice input again.');return}
   voiceCancel();doMove(m);
  };host.appendChild(b);
 }
};
window.__voiceError=message=>{if(Voice.active)voiceMessage(message||'Speech recognition was cancelled. Tap Speak a move to retry.')};
voiceEl('voiceCancel').onclick=voiceCancel;
voiceEl('voiceStart').onclick=()=>{
 voiceCancel();voiceEl('voicePanel').hidden=false;
 if(!canPlay()){voiceMessage('Return to the live board on your turn to speak a move.');return}
 Voice.active=true;Voice.position=s;Voice.ply=sans.length;Voice.mode=mode;
 voiceMessage('Listening in English… Say “knight to f3”, “e2 to e4”, or “castle kingside”. You will confirm before playing.');
 if(NA&&typeof NA.speakMove==='function'){NA.speakMove();return}
 const Speech=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(!Speech){voiceMessage('Speech recognition is unavailable in this browser. Use the Android app or a browser with speech support.');return}
 const r=Voice.recognizer=new Speech();r.lang='en-US';r.maxAlternatives=5;
 r.onresult=e=>{if(Voice.recognizer===r)window.__voiceResult(Array.from(e.results[0],x=>x.transcript))};
 r.onerror=e=>{if(Voice.recognizer===r)window.__voiceError(e.error==='not-allowed'?'Microphone access was denied. Allow it in browser settings to use voice input.':'Speech recognition failed. Check your connection and try again.')};
 r.onend=()=>{if(Voice.recognizer===r&&Voice.active&&!voiceEl('voiceChoices').children.length)voiceMessage('No move recognised. Tap Speak a move to try again.')};
 try{r.start()}catch(e){window.__voiceError('Could not start speech recognition. Try again.')}
};
