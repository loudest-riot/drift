const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const entries=document.getElementById('fieldEntries'),stats=document.getElementById('fieldStats');
async function loadFieldLog(){
  try{
    const r=await fetch('/api/intercepts?limit=50',{headers:{accept:'application/json'}});
    if(!r.ok)throw new Error('field log unavailable');
    const {intercepts=[]}=await r.json();
    const signals=new Set(intercepts.map(x=>x.signal_id));
    stats.innerHTML=`<div class="fieldlog-stat"><strong>${intercepts.length}</strong><span>PUBLIC INTERCEPTS</span></div><div class="fieldlog-stat"><strong>${signals.size}</strong><span>SIGNALS REACHED</span></div>`;
    if(!intercepts.length){entries.innerHTML='<div class="fieldlog-empty">NO PUBLIC INTERCEPTS YET. THE FIELD IS QUIET.</div>';return;}
    entries.innerHTML=intercepts.map(x=>`<article class="field-entry" id="${esc(x.id)}">
      <div class="field-entry-head"><div><div class="code">${esc(x.code)} · VERIFIED</div><h2>${esc(x.name)}</h2><button class="share-action" type="button" data-share-find="${esc(x.id)}">SHARE…</button></div><time datetime="${esc(x.created_at)}">${new Date(x.created_at+'Z').toLocaleString([], {dateStyle:'medium',timeStyle:'short'})}</time></div>
      ${x.alias?`<p class="alias">${esc(x.alias)}</p>`:''}
      ${x.note?`<p class="note">${esc(x.note)}</p>`:''}
      ${x.photo_key?`<img loading="lazy" src="/api/intercepts/${encodeURIComponent(x.id)}/photo" alt="Shared field photo from ${esc(x.name)}" />`:''}
    </article>`).join('');
  }catch(e){stats.innerHTML='';entries.innerHTML='<div class="fieldlog-empty">FIELD LOG TEMPORARILY OFFLINE.</div>';}
}
loadFieldLog();
entries.addEventListener('click',event=>{const button=event.target.closest('[data-share-find]');if(button)DriftShare.open({title:'DRIFT field find',text:'A find from the DRIFT public field log',url:'https://drift.loudestriot.com/field-log.html#'+encodeURIComponent(button.dataset.shareFind)});});
