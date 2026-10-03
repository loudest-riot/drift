(() => {
  const JP_ARCHIVE_KEY='lr-drift-jp-archive-v01';

  function archiveAndRemoveJP(){
    if(typeof state==='undefined'||!Array.isArray(state.signals))return;
    const jp=state.signals.filter(s=>s.jp);
    if(jp.length){
      try{
        const existing=localStorage.getItem(JP_ARCHIVE_KEY);
        if(!existing)localStorage.setItem(JP_ARCHIVE_KEY,JSON.stringify({archivedAt:new Date().toISOString(),signals:jp}));
      }catch{}
      state.signals=state.signals.filter(s=>!s.jp);
    }
    const legacy=document.getElementById('jpView');
    if(legacy){legacy.hidden=true;legacy.setAttribute('aria-hidden','true');}
    document.querySelectorAll('.tab[data-view="jpView"]').forEach(el=>el.remove());
    try{renderDeck();renderMarkers();renderArchive();}catch{}
  }

  function currentSignal(){
    const detail=document.querySelector('#signalDetail .detail-id');
    if(!detail||typeof state==='undefined')return null;
    const code=detail.textContent.split('//')[0].trim();
    return state.signals.find(s=>s.code===code)||null;
  }

  function localLog(signal){
    state.intercepts[signal.id]={time:new Date().toISOString(),name:signal.name};
    saveState();
    renderArchive();
  }

  function ensureDialog(){
    let dialog=document.getElementById('sharedInterceptDialog');
    if(dialog)return dialog;
    dialog=document.createElement('dialog');
    dialog.id='sharedInterceptDialog';
    dialog.className='shared-dialog';
    dialog.innerHTML=`
      <form method="dialog" class="shared-card" id="sharedInterceptForm">
        <button class="shared-close" value="cancel" aria-label="Close">×</button>
        <div class="eyebrow">FIELD TRANSMISSION</div>
        <h2>LOG INTERCEPT</h2>
        <p class="shared-privacy-note">Your live location is sent only to verify that you are within the signal radius. Exact coordinates are not stored with the intercept.</p>
        <input type="hidden" id="sharedSignalId" />
        <label>FIELD NAME <span>optional</span><input id="sharedAlias" maxlength="40" autocomplete="nickname" placeholder="anonymous is fine" /></label>
        <label>FIELD NOTE <span>optional</span><textarea id="sharedNote" maxlength="500" rows="4" placeholder="What did you notice?"></textarea></label>
        <label>PHOTO <span>optional</span><input id="sharedPhoto" type="file" accept="image/*" capture="environment" /></label>
        <label class="share-check"><input id="sharedPublic" type="checkbox" /> <span>SHOW THIS INTERCEPT IN THE PUBLIC ACTIVITY LOG</span></label>
        <div class="shared-actions">
          <button type="button" class="primary" id="sharedSubmit">TRANSMIT INTERCEPT</button>
          <button value="cancel" class="secondary">CANCEL</button>
        </div>
      </form>`;
    document.body.append(dialog);
    document.getElementById('sharedSubmit').addEventListener('click',submitSharedIntercept);
    return dialog;
  }

  function openSharedDialog(signal){
    const dialog=ensureDialog();
    document.getElementById('sharedSignalId').value=signal.id;
    document.getElementById('sharedAlias').value='';
    document.getElementById('sharedNote').value='';
    document.getElementById('sharedPhoto').value='';
    document.getElementById('sharedPublic').checked=false;
    dialog.showModal();
  }

  async function submitSharedIntercept(){
    const dialog=document.getElementById('sharedInterceptDialog');
    const id=document.getElementById('sharedSignalId').value;
    const signal=state.signals.find(s=>s.id===id);
    if(!signal)return;
    const button=document.getElementById('sharedSubmit');
    button.disabled=true;button.textContent='TRANSMITTING…';

    const payload={
      signal_id:id,
      alias:document.getElementById('sharedAlias').value,
      note:document.getElementById('sharedNote').value,
      public:document.getElementById('sharedPublic').checked,
      lat:userPos?.lat,
      lng:userPos?.lng
    };

    try{
      if(!userPos)throw new Error('live_location_required');
      const response=await fetch('/api/intercepts',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||`HTTP ${response.status}`);

      const photo=document.getElementById('sharedPhoto').files?.[0];
      if(photo&&data.id){
        const photoResponse=await fetch(`/api/intercepts/${encodeURIComponent(data.id)}/photo`,{method:'POST',headers:{'content-type':photo.type||'image/jpeg'},body:photo});
        if(!photoResponse.ok)toast('INTERCEPT SAVED // PHOTO COULD NOT UPLOAD');
      }

      localLog(signal);
      dialog.close();
      openSignal(signal.id);
      toast(payload.public?'INTERCEPT TRANSMITTED TO DRIFT':'PRIVATE INTERCEPT SAVED');
      loadSharedActivity();
    }catch(error){
      localLog(signal);
      dialog.close();
      openSignal(signal.id);
      const reason=String(error?.message||'');
      if(reason==='outside_intercept_radius')toast('OUTSIDE INTERCEPT RADIUS // SAVED ON DEVICE ONLY');
      else if(reason==='live_location_required')toast('LOCATION REQUIRED FOR SHARED LOG // SAVED ON DEVICE');
      else toast('SHARED LOG OFFLINE // SAVED ON DEVICE');
    }finally{
      button.disabled=false;button.textContent='TRANSMIT INTERCEPT';
    }
  }

  async function loadSharedActivity(){
    const target=document.getElementById('sharedActivity');
    if(!target)return;
    try{
      const response=await fetch('/api/intercepts?limit=12',{headers:{accept:'application/json'}});
      if(!response.ok)throw new Error();
      const data=await response.json();
      const rows=Array.isArray(data.intercepts)?data.intercepts:[];
      target.innerHTML=rows.length?rows.map(row=>`
        <article class="shared-activity-item">
          <div class="meta">${esc(new Date(row.created_at).toLocaleString())} // ${esc(row.code||row.signal_id)}</div>
          <h3>${esc(row.name||row.signal_id)}</h3>
          <div class="shared-alias">${esc(row.alias||'ANONYMOUS FIELD UNIT')}</div>
          ${row.note?`<p>${esc(row.note)}</p>`:''}
          ${row.photo_key?'<span class="tag">PHOTO ATTACHED</span>':''}
        </article>`).join(''):'<div class="lockbox">NO PUBLIC INTERCEPTS YET</div>';
    }catch{
      target.innerHTML='<div class="lockbox">SHARED FIELD LOG OFFLINE // LOCAL ARCHIVE STILL WORKS</div>';
    }
  }

  async function updateBackendStatus(){
    const status=document.getElementById('backendStatus');
    if(!status)return;
    try{
      const response=await fetch('/api/health',{headers:{accept:'application/json'}});
      const data=await response.json();
      const db=data.database?'D1 ONLINE':'D1 PROVISIONING';
      const photos=data.photos?'R2 ONLINE':'R2 PROVISIONING';
      status.textContent=`${db} // ${photos}`;
      status.classList.toggle('online',!!data.database);
    }catch{
      status.textContent='SHARED SERVICES OFFLINE // DEVICE MODE ACTIVE';
    }
  }

  document.addEventListener('click',event=>{
    const log=event.target.closest?.('#logBtn');
    if(!log)return;
    const signal=currentSignal();
    if(!signal)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openSharedDialog(signal);
  },true);

  archiveAndRemoveJP();
  loadSharedActivity();
  updateBackendStatus();
  window.addEventListener('online',()=>{loadSharedActivity();updateBackendStatus();});
})();
