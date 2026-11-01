// Loads the pure-JS engine (copied as JSE) and then the Rust/WASM wrapper (global Eng).
const fs=require('fs'),path=require('path');
const WWW=path.join(__dirname,'../../app/src/main/assets/www');
global.window=undefined;
require(WWW+'/js/engine.js');
const JSE={...globalThis.Eng};
require(WWW+'/js/engine-wasm.js');
const RS=globalThis.Eng;
async function init(){const ok=await RS.initWasm(fs.readFileSync(WWW+'/js/rs/engine.wasm'));if(!ok)throw new Error('wasm failed');return RS}
module.exports={JSE,RS,init};
