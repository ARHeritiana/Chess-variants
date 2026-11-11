/* Native checks run when online, on resume and periodically while in the foreground. */
let availableUpdate=null;
window.__updateStatus=message=>{document.getElementById('updateStatus').textContent=message};
window.__updateCurrent=()=>{availableUpdate=null;document.getElementById('updateNotice').hidden=true};
window.__updateAvailable=update=>{
 availableUpdate=update;document.getElementById('updateText').textContent='Chess Variants '+update.version_name+' is available.';
 document.getElementById('updateNotice').hidden=false;window.__updateStatus('Update available: '+update.version_name);
};
document.getElementById('updateLater').onclick=()=>{document.getElementById('updateNotice').hidden=true};
document.getElementById('updateInstall').onclick=()=>{if(availableUpdate&&NA)NA.openUpdate()};
document.getElementById('updateCheck').onclick=()=>{
 if(NA&&typeof NA.checkUpdates==='function'){window.__updateStatus('Checking for updates…');NA.checkUpdates()}
 else window.__updateStatus('App updates are available in the Android app.');
};
