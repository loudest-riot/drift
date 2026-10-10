const list=document.getElementById('placeList');
const count=document.getElementById('placeCount');
const search=document.getElementById('placeSearch');
const status=document.getElementById('placeStatus');
let places=[];

function link(href,label,primary=false){
 const a=document.createElement('a');a.href=href;a.textContent=label;
 if(primary)a.className='primary';
 if(/^https:\/\//.test(href)){a.target='_blank';a.rel='noopener noreferrer';}
 return a;
}
function render(){
 const term=search.value.trim().toLocaleLowerCase();
 const matches=places.filter(p=>[p.name,p.note,p.area,p.kind].join(' ').toLocaleLowerCase().includes(term));
 list.replaceChildren();
 const frag=document.createDocumentFragment();
 for(const p of matches){
  const li=document.createElement('li');
  li.className='place-card'+(p.featured?' featured':'');
  li.id=p.id;
  const meta=document.createElement('div');meta.className='place-meta';
  meta.textContent=[p.area||'HINES PARK',p.kind,p.position==='reference'?'REFERENCE PIN':'PIN TO VERIFY'].join(' // ');
  const title=document.createElement('h2');title.textContent=p.name;
  const desc=document.createElement('p');desc.textContent=p.note||'';
  const actions=document.createElement('div');actions.className='place-actions';
  if(p.position==='reference'&&Number.isFinite(p.lat)&&Number.isFinite(p.lng)){
    actions.append(link('./?place='+encodeURIComponent(p.id),'VIEW ON DRIFT MAP',true));
  }else{
    const warning=document.createElement('span');warning.className='pin-pending';warning.textContent='EXACT COORDINATE NOT YET VERIFIED';
    li.append(meta,title,warning,desc);
    actions.append(link('./?suggest_place='+encodeURIComponent(p.id),'HELP LOCATE / SUBMIT A WAYPOINT',true));
  }
  if(p.source&&/^https:\/\//.test(p.source))actions.append(link(p.source,'LOCATION SOURCE ↗'));
  if(p.position==='reference')li.append(meta,title,desc);
  li.append(actions);frag.append(li);
 }
 list.append(frag);
 count.textContent=matches.length+' / '+places.length+' PLACES';
 status.textContent=matches.length?'':'No matching places. Try another term.';
}
search.addEventListener('input',render);
(async()=>{
 try{
  const r=await fetch('data/hines-places.json',{cache:'no-cache'});
  if(!r.ok)throw new Error('catalog unavailable');
  const data=await r.json();
  if(!Array.isArray(data.entries))throw new Error('bad catalog');
  places=data.entries.filter(p=>p&&typeof p.name==='string'&&typeof p.id==='string');
  render();
  if(location.hash){
   const id=decodeURIComponent(location.hash.slice(1));
   const target=document.getElementById(id);
   if(target){target.scrollIntoView({block:'start'});target.setAttribute('tabindex','-1');target.focus({preventScroll:true});}
  }
 }catch{count.textContent='UNAVAILABLE';status.textContent='The field directory could not load. Try reloading when connected.';}
})();