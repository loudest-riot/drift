// Public photographs only: editorially approved manifest entries and explicitly public, verified intercept photos.
const grid=document.getElementById('photoGrid');
const count=document.getElementById('photoCount');
const status=document.getElementById('photoStatus');
const empty=document.getElementById('photoEmpty');
const loadMore=document.getElementById('loadMorePhotos');
const viewer=document.getElementById('photoViewer');
const viewerImage=document.getElementById('viewerImage');
const viewerPlace=document.getElementById('viewerPlace');
const viewerText=document.getElementById('viewerText');
const viewerCredit=document.getElementById('viewerCredit');
const viewerIndex=document.getElementById('viewerIndex');
const viewerPrev=document.getElementById('viewerPrev');
const viewerNext=document.getElementById('viewerNext');
const filters=[...document.querySelectorAll('.photo-filter')];
const pageSize=24;

let curated=[];
let shared=[];
let visible=[];
let selected=0;
let activeFilter='all';
let offset=0;
let hasMore=false;
let loading=false;
let lastFocus=null;

function safeImageUrl(value){
  if(typeof value!=='string'||!value.trim())return null;
  try{
    const url=new URL(value,location.href);
    if(!['https:','http:'].includes(url.protocol))return null;
    if(url.protocol==='http:'&&url.origin!==location.origin)return null;
    return url.href;
  }catch{return null;}
}

function niceDate(value){
  if(!value)return '';
  const source=String(value).trim();
  const normalized=/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(source)
    ?source.replace(' ','T')+'Z'
    :(/^\d{4}-\d{2}-\d{2}$/.test(source)?source+'T12:00:00Z':source);
  const date=new Date(normalized);
  return Number.isFinite(date.getTime())
    ?new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(date)
    :'';
}

function timeValue(value){
  if(!value)return 0;
  const source=String(value).trim();
  const date=new Date(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(source)
    ?source.replace(' ','T')+'Z'
    :(/^\d{4}-\d{2}-\d{2}$/.test(source)?source+'T12:00:00Z':source));
  return Number.isFinite(date.getTime())?date.getTime():0;
}

function showStatus(message){
  status.textContent=message||'';
  status.hidden=!message;
}

function allPhotos(){
  return [...curated,...shared].sort((a,b)=>timeValue(b.date)-timeValue(a.date));
}

function render(){
  visible=allPhotos().filter(p=>activeFilter==='all'||p.kind===activeFilter);
  grid.replaceChildren();
  const fragment=document.createDocumentFragment();
  visible.forEach((photo,i)=>{
    const article=document.createElement('article');
    article.className='photo-card';
    const button=document.createElement('button');
    button.type='button';
    button.className='photo-card-button';
    button.setAttribute('aria-label','Open photograph: '+photo.place);
    const frame=document.createElement('span');
    frame.className='photo-img-frame';
    const img=document.createElement('img');
    img.src=photo.src;
    img.alt=photo.alt||('Photograph at '+photo.place);
    img.loading='lazy';
    img.decoding='async';
    frame.appendChild(img);
    const info=document.createElement('span');
    info.className='photo-info';
    const type=document.createElement('span');
    type.className='photo-type';
    type.textContent=photo.kind==='dispatch'?'FIELD DISPATCH':'SHARED FIND';
    const title=document.createElement('span');
    title.className='photo-title';
    title.textContent=photo.place;
    const meta=document.createElement('span');
    meta.className='photo-meta';
    meta.textContent=[niceDate(photo.date),photo.credit].filter(Boolean).join(' · ');
    info.append(type,title,meta);
    button.append(frame,info);
    button.addEventListener('click',()=>openViewer(i,button));
    article.appendChild(button);
    fragment.appendChild(article);
  });
  grid.appendChild(fragment);
  const label=activeFilter==='dispatch'?'CURATED PHOTOGRAPHS':activeFilter==='find'?'SHARED FIND PHOTOGRAPHS':'PUBLIC PHOTOGRAPHS';
  count.textContent=visible.length+' '+label+(hasMore&&activeFilter!=='dispatch'?' // MORE AVAILABLE':'');
  empty.hidden=visible.length!==0;
  loadMore.hidden=!hasMore||activeFilter==='dispatch';
  loadMore.disabled=loading;
  loadMore.textContent=loading?'LOADING…':'LOAD MORE FIELD PHOTOS ↓';
}

function openViewer(index,button){
  if(!visible[index])return;
  selected=index;
  lastFocus=button||document.activeElement;
  updateViewer();
  viewer.showModal();
  document.getElementById('viewerClose').focus();
}

function updateViewer(){
  const photo=visible[selected];
  if(!photo)return;
  viewerImage.src=photo.src;
  viewerImage.alt=photo.alt||('Photograph at '+photo.place);
  viewerPlace.textContent=photo.place;
  viewerText.textContent=photo.caption||'';
  viewerText.hidden=!photo.caption;
  viewerCredit.textContent=[niceDate(photo.date),photo.credit].filter(Boolean).join(' · ');
  viewerIndex.textContent=String(selected+1).padStart(2,'0')+' / '+String(visible.length).padStart(2,'0');
  viewerPrev.disabled=selected<=0;
  viewerNext.disabled=selected>=visible.length-1;
}

document.getElementById('viewerClose').addEventListener('click',()=>viewer.close());
viewer.addEventListener('close',()=>lastFocus?.focus?.());
viewerPrev.addEventListener('click',()=>{if(selected>0){selected--;updateViewer();}});
viewerNext.addEventListener('click',()=>{if(selected<visible.length-1){selected++;updateViewer();}});
viewer.addEventListener('keydown',event=>{
  if(event.key==='ArrowLeft'&&selected>0){selected--;updateViewer();event.preventDefault();}
  if(event.key==='ArrowRight'&&selected<visible.length-1){selected++;updateViewer();event.preventDefault();}
});
viewer.addEventListener('click',event=>{if(event.target===viewer)viewer.close();});

filters.forEach(button=>button.addEventListener('click',()=>{
  activeFilter=button.dataset.filter;
  filters.forEach(other=>{const pressed=other===button;other.classList.toggle('active',pressed);other.setAttribute('aria-pressed',String(pressed));});
  render();
}));

async function getCurated(){
  try{
    const response=await fetch('data/photo-log.json',{cache:'no-cache'});
    if(!response.ok)throw new Error('manifest');
    const data=await response.json();
    curated=(Array.isArray(data.photos)?data.photos:[]).flatMap(item=>{
      if(!item||typeof item!=='object'||item.public!==true)return [];
      const src=safeImageUrl(item.src);
      if(!src)return [];
      return [{
        kind:'dispatch',
        src,
        place:String(item.place||'From the field').slice(0,120),
        caption:String(item.caption||'').slice(0,500),
        credit:String(item.credit||'DRIFT').slice(0,80),
        alt:String(item.alt||'').slice(0,300),
        date:item.date||''
      }];
    });
  }catch{
    showStatus('Curated field dispatches are temporarily unavailable. Shared finds may still appear.');
  }
  render();
}

async function getShared(){
  if(loading||!hasMore&&offset!==0)return;
  loading=true;
  render();
  try{
    const response=await fetch('/api/intercepts?photos_only=1&limit='+pageSize+'&offset='+offset,{headers:{accept:'application/json'},cache:'no-store'});
    if(!response.ok)throw new Error('field log offline');
    const data=await response.json();
    if(!Array.isArray(data.intercepts))throw new Error('invalid field response');
    const rows=data.intercepts;
    const entries=rows.filter(p=>p&&p.photo_key&&p.id).map(p=>({
      kind:'find',
      src:'/api/intercepts/'+encodeURIComponent(p.id)+'/photo',
      place:String(p.name||'Field find').slice(0,120),
      caption:String(p.note||'').slice(0,500),
      credit:String(p.alias||'Anonymous field unit').slice(0,80),
      alt:'Publicly shared field photograph from '+String(p.name||'a DRIFT signal').slice(0,100),
      date:p.created_at||''
    }));
    shared.push(...entries);
    offset+=rows.length;
    hasMore=data.has_more===true;
    // A successful read clears the shared-service warning, without hiding a curated-manifest warning.
    if(status.textContent.startsWith('Shared field'))showStatus('');
  }catch{
    hasMore=false;
    showStatus('Shared field photographs are temporarily unavailable. Your private journal is unaffected.');
  }finally{
    loading=false;
    render();
  }
}

loadMore.addEventListener('click',getShared);
async function start(){
  await Promise.all([getCurated(),getShared()]);
}
start();