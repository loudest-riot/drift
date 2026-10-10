const FIELD_KEY='lr-drift-v03';
const OLD_KEYS=['lr-field-relay-v01'];
const START_HINT_KEY='lr-drift-start-hint-v04';
const INTERCEPT_RADIUS=140;
const DETECT_RADIUS=2500;
const MAX_LOCATION_ACCURACY=250;
const JP_ARCHIVE_KEY='lr-drift-jp-archive-v01';
const HINES_BOUNDS=L.latLngBounds([42.300,-83.520],[42.455,-83.225]);

const defaultSignals=[
  {
    id:'hpr-001', code:'HPR-001', name:'Newburgh Pointe', region:'HINES PARK // NEWBURGH',
    lat:42.36733,lng:-83.42335, type:'SONIC ARTIFACT', status:'ACTIVE', jp:false,
    transmission:'Hines Park Relay 001',
    clue:'Follow the waterline. Let the path choose the pace. The relay sharpens when the lake comes into view.',
    link:'https://ditto.fm/hines-park-relay'
  },
  {
    id:'mrr-001', code:'MRR-001', name:'Helms Haven', region:'MIDDLE ROUGE // HELMS',
    lat:42.3402,lng:-83.2638, type:'FIELD TRANSMISSION', status:'ACTIVE', jp:false,
    transmission:'Middle Rouge Relay',
    clue:'Stay with the Rouge. Traffic should become background radiation. Find the point where the green wins.',
    link:''
  },
  {
    id:'jp-01', code:'JP-01', name:'JP PICK 01', region:'HINES PARK // UNASSIGNED',
    lat:null,lng:null,type:'JP FIELD PICK',status:'UNASSIGNED',jp:true,transmission:'UNASSIGNED',
    clue:'Awaiting a JP field decision.',link:''
  },
  {
    id:'jp-02', code:'JP-02', name:'JP PICK 02', region:'HINES PARK // UNASSIGNED',
    lat:null,lng:null,type:'JP FIELD PICK',status:'UNASSIGNED',jp:true,transmission:'UNASSIGNED',
    clue:'Awaiting a JP field decision.',link:''
  }
];

const landmarks=[
  {name:'Cass Benton',lat:42.41545,lng:-83.4766,kind:'PARK',note:'Western Hines reference point // disc golf + wooded terrain.'},
  {name:'Wilcox Lake',lat:42.38436,lng:-83.45971,kind:'WATER',note:'Middle Rouge water node // lake + Hines bikeway.'},
  {name:'Old Village / York Street Cemetery',lat:42.3811029,lng:-83.4574955,kind:'BURIAL',sensitive:true,note:'Historic Plymouth burial ground at York + Pearl. Reference only // no cache placement.'},
  {name:'Riverside Cemetery',lat:42.37225,lng:-83.452708,kind:'BURIAL',sensitive:true,note:'City of Plymouth cemetery, established 1880. Reference only // no cache placement.'},
  {name:'Nankin Mills',lat:42.348981,lng:-83.369991,kind:'HISTORY',note:'Historic mill / interpretive center // central Hines reference node.'},
  {name:'Chief Tonquish Burial Site marker',lat:42.351151,lng:-83.38575,kind:'BURIAL',sensitive:true,note:'Michigan historical marker for the nearby Potawatomi burial site. Memorial reference only // never a cache or approach target.'},
  {name:"Dead Man's Hill / Middlebelt Hill",lat:42.3451,lng:-83.3246,kind:'LANDMARK',note:'Middlebelt Hill in Westland, locally known as Dead Man\'s Hill. Check and obey posted access restrictions.'},
  {name:'Boy Scout Shelter',lat:42.34413,lng:-83.271,kind:'SHELTER',note:'Eastern Hines reference point near the Middle Rouge.'},
  {name:'Newburgh Pointe',lat:42.36733,lng:-83.42335,kind:'WATER',note:'Newburgh Lake shoreline / trail node. Also hosts HPR-001.'},
  {name:'Helms Haven',lat:42.3402,lng:-83.2638,kind:'PARK',note:'Eastern field node along the Rouge. Also hosts MRR-001.'}
];

let hinesCatalog=[];
const officialLandmarks=()=>hinesCatalog.length?hinesCatalog:landmarks;
const landmarkMarkers=new Map();
async function loadHinesCatalog(){
  try{
    const r=await fetch('data/hines-places.json',{cache:'no-cache'});
    if(!r.ok)throw new Error('catalog unavailable');
    const payload=await r.json();
    if(!Array.isArray(payload.entries))throw new Error('invalid catalog');
    hinesCatalog=payload.entries.filter(p=>
      p&&typeof p.id==='string'&&typeof p.name==='string'&&
      (p.position==='awaiting_verification'||(
        p.position==='reference'&&Number.isFinite(p.lat)&&Number.isFinite(p.lng)&&
        p.lat>=42.30&&p.lat<=42.46&&p.lng>=-83.53&&p.lng<=-83.22
      )));
    if(!hinesCatalog.length)throw new Error('empty catalog');
    renderLandmarks();
    populateHinesPlaceSelect();
    const params=new URLSearchParams(location.search);
    const chosen=params.get('place');
    if(chosen)focusHinesPlace(chosen);
    const suggested=params.get('suggest_place');
    if(suggested){
      const p=hinesCatalog.find(item=>item.id===suggested);
      if(p){
        toggleHelp(false);
        showWaypointEditor();
        document.getElementById('waypointName').value=p.name;
        document.getElementById('waypointKind').value=p.kind==='WATER'?'WATER':p.kind==='HISTORY'?'HISTORY':'PLACE';
        document.getElementById('waypointNote').value='Location suggestion for DRIFT. Please verify public access and place the pin accurately.';
        document.getElementById('waypointFormStatus').textContent='Place a pin on the map or use precise location at this spot. Save privately, then use SUBMIT WAYPOINT in JOURNAL to request public review.';
      }
    }
  }catch(error){console.warn('Hines catalog unavailable; using existing reference points.',error);}
}
function populateHinesPlaceSelect(){
  const select=document.getElementById('hinesPlaceSelect');
  if(!select||!hinesCatalog.length)return;
  select.replaceChildren();
  select.add(new Option('PLACES ▾',''));
  const groups=new Map();
  for(const p of hinesCatalog){
    const area=p.area||'HINES PARK';
    if(!groups.has(area)){const g=document.createElement('optgroup');g.label=area;groups.set(area,g);select.add(g);}
    const label=p.name.toUpperCase()+(p.position!=='reference'?' · VERIFY PIN':'');
    groups.get(area).append(new Option(label,p.id));
  }
  select.add(new Option('ALL HINES PLACES / BROWSE →','__all__'));
}
function focusHinesPlace(id){
  const p=hinesCatalog.find(place=>place.id===id);
  if(!p)return;
  if(p.position!=='reference'){
    location.href='places.html#'+encodeURIComponent(p.id);
    return;
  }
  centerOnNextFix=false;map.closePopup();
  showView('fieldView');
  landmarkLayer.addTo(map);
  setLayerButton(document.getElementById('landmarksToggle'),true);
  map.setView([p.lat,p.lng],15);
  const marker=landmarkMarkers.get(p.id);
  if(marker)marker.openPopup();
  else toast('REFERENCE LOCATION // OPEN LANDMARKS FOR DETAILS');
}

// Labels are orientation cues, not municipal boundary polygons.
const municipalities=[
  {name:'NORTHVILLE',lat:42.424,lng:-83.483},
  {name:'PLYMOUTH / PLYMOUTH TWP',lat:42.389,lng:-83.454},
  {name:'LIVONIA',lat:42.371,lng:-83.414},
  {name:'WESTLAND',lat:42.351,lng:-83.368},
  {name:'GARDEN CITY',lat:42.339,lng:-83.334},
  {name:'DEARBORN HEIGHTS',lat:42.342,lng:-83.278}
];

const guideStars=[
  {name:'POLARIS',ra:2.5303,dec:89.2641},
  {name:'VEGA',ra:18.6156,dec:38.7837},
  {name:'DENEB',ra:20.6905,dec:45.2803},
  {name:'ALTAIR',ra:19.8464,dec:8.8683},
  {name:'ARCTURUS',ra:14.2610,dec:19.1824},
  {name:'CAPELLA',ra:5.2782,dec:45.9980},
  {name:'FOMALHAUT',ra:22.9608,dec:-29.6222},
  {name:'REGULUS',ra:10.1395,dec:11.9672}
];

let state=loadState();
let userPos=null;
let map, userMarker, signalLayer, landmarkLayer, waypointLayer, municipalityLayer, routeLayer;
let guidanceLine=null;
let baseLayer,locationWatchId=null,centerOnNextFix=false;
let trailData=null,trailLayer,trailFilter='all';
let showMTB=true,showPaved=true;
const TRAIL_SAVED_KEY='lr-drift-trails-v01';
let savedTrails=new Set();
try{const saved=JSON.parse(localStorage.getItem(TRAIL_SAVED_KEY));if(Array.isArray(saved))savedTrails=new Set(saved.filter(id=>typeof id==='string'));}catch{}
let tracking=false, trackStartedAt=null, trackPoints=[], trackDistanceM=0, trackTimer=null;
const markers=new Map();

function esc(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function clone(v){return JSON.parse(JSON.stringify(v));}
function loadState(){
  let raw=null;
  try{raw=JSON.parse(localStorage.getItem(FIELD_KEY));}catch(e){}
  if(!raw){
    for(const key of OLD_KEYS){try{raw=JSON.parse(localStorage.getItem(key)); if(raw)break;}catch(e){}}
  }
  if(!raw?.signals) return {signals:clone(defaultSignals),intercepts:{},routes:[]};
  // Merge the current canonical signal definitions with any locally assigned JP coordinates/clues.
  const merged=clone(defaultSignals).map(base=>{
    const prior=raw.signals.find(s=>s.id===base.id);
    if(!prior)return base;
    if(base.jp && prior.lat!=null) return {...base,...prior,jp:true};
    return {...base,...prior,name:base.name,code:base.code,region:prior.region||base.region};
  });
  return {signals:merged,intercepts:raw.intercepts||{},routes:Array.isArray(raw.routes)?raw.routes:[]};
}
function saveState(){localStorage.setItem(FIELD_KEY,JSON.stringify(state));}
function toRad(x){return x*Math.PI/180;}
function toDeg(x){return x*180/Math.PI;}
function norm360(x){return (x%360+360)%360;}
function signedAngle(from,to){return ((to-from+540)%360)-180;}
function distanceM(a,b){
  const R=6371e3,p1=toRad(a.lat),p2=toRad(b.lat),dp=toRad(b.lat-a.lat),dl=toRad(b.lng-a.lng);
  const q=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;
  return R*2*Math.atan2(Math.sqrt(q),Math.sqrt(1-q));
}
function bearingDeg(a,b){
  const p1=toRad(a.lat),p2=toRad(b.lat),dl=toRad(b.lng-a.lng);
  const y=Math.sin(dl)*Math.cos(p2);
  const x=Math.cos(p1)*Math.sin(p2)-Math.sin(p1)*Math.cos(p2)*Math.cos(dl);
  return norm360(toDeg(Math.atan2(y,x)));
}
function cardinal(deg){const dirs=['N','NE','E','SE','S','SW','W','NW'];return dirs[Math.round(norm360(deg)/45)%8];}
function signalState(sig){
  if(sig.lat==null) return {label:'UNASSIGNED',bars:'░░░░░',pct:0,d:null,unlocked:false};
  if(!reliableLocation(userPos)) return {label:'DORMANT',bars:'░░░░░',pct:8,d:null,unlocked:false};
  const d=distanceM(userPos,sig);
  if(d<=INTERCEPT_RADIUS) return {label:'INTERCEPT',bars:'█████',pct:100,d,unlocked:true};
  if(d<=450) return {label:'ACQUIRED',bars:'████░',pct:78,d,unlocked:false};
  if(d<=DETECT_RADIUS) return {label:'DETECTED',bars:'███░░',pct:52,d,unlocked:false};
  if(d<=8000) return {label:'WEAK',bars:'█░░░░',pct:26,d,unlocked:false};
  return {label:'OUT OF RANGE',bars:'░░░░░',pct:10,d,unlocked:false};
}
function fmtDistance(d){if(d==null)return '—';return d<1000?`${Math.round(d)} m`:`${(d/1609.344).toFixed(1)} mi`;}
function fmtTrackDistance(d){return `${(d/1609.344).toFixed(2)} MI`;}
function fmtDuration(ms){const sec=Math.max(0,Math.floor(ms/1000)),m=Math.floor(sec/60),s=sec%60,h=Math.floor(m/60);return h?`${String(h).padStart(2,'0')}:${String(m%60).padStart(2,'0')}:${String(s).padStart(2,'0')}`:`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;}
function toast(msg){const t=document.createElement('div');t.className='toast';t.textContent=msg;document.body.append(t);setTimeout(()=>t.remove(),2600);}

function initMap(){
  map=L.map('map',{zoomControl:false,attributionControl:true,minZoom:10,maxZoom:19}).setView([42.3775,-83.3725],12);
  setMapStyle('minimal');
  signalLayer=L.layerGroup();
  landmarkLayer=L.layerGroup();
  waypointLayer=L.layerGroup();
  municipalityLayer=L.layerGroup();
  routeLayer=L.layerGroup().addTo(map);
  map.fitBounds(HINES_BOUNDS,{padding:[18,18],animate:false});

  renderLandmarks();renderMunicipalities();renderMarkers();renderSavedRoute();
  // Safari viewport and orientation changes must not leave blank map strips.
  new ResizeObserver(()=>map.invalidateSize({pan:false})).observe(document.getElementById('map'));
  initWaypointTools();
  loadCommunityWaypoints();
  loadHinesCatalog();
  loadTrails();
}
function setMapStyle(style){
  const minimal=style!=='standard';
  if(baseLayer)map.removeLayer(baseLayer);
  baseLayer=null;
  if(!minimal)baseLayer=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
    maxZoom:19,attribution:'© OpenStreetMap contributors'
  }).addTo(map);
  document.querySelectorAll('.map-style').forEach(btn=>{
    const active=btn.dataset.mapStyle===(minimal?'minimal':'standard');
    btn.classList.toggle('active',active);btn.setAttribute('aria-pressed',String(active));
  });
}
function bindLocationInfo(marker,html){
  marker.bindPopup(html,{autoPan:false,maxWidth:240,className:'location-info'});
  // Touch uses Leaflet's normal click-to-toggle; no synthetic hover on Safari.
  if(window.matchMedia('(hover: hover) and (pointer: fine)').matches){
    let closeTimer;
    marker.on('mouseover',()=>{clearTimeout(closeTimer);marker.openPopup();});
    marker.on('mouseout',()=>{closeTimer=setTimeout(()=>marker.closePopup(),250);});
    marker.on('popupopen',()=>{
      const popup=marker.getPopup().getElement();
      popup.addEventListener('mouseenter',()=>clearTimeout(closeTimer));
      popup.addEventListener('mouseleave',()=>marker.closePopup());
    });
  }
}
async function loadTrails(){
  try{
    const response=await fetch('./data/hines-trails.json');
    if(!response.ok)throw new Error('Trail data unavailable');
    const data=await response.json();
    if(data.geometry?.type!=='FeatureCollection'||!Array.isArray(data.trails)||!Array.isArray(data.accessPoints))throw new Error('Invalid trail data');
    trailData=data;renderTrails();renderTrailCollection();
    document.getElementById('trailMapStatus').textContent='';
  }catch{
    document.getElementById('trailMapStatus').textContent='TRAILS UNAVAILABLE';
    document.getElementById('trailCollection').innerHTML='<p class="lede">Trail data could not load. Reload to try again, or use the MCMBA guide below.</p>';
  }
}
function renderTrails(){
  if(trailLayer)map.removeLayer(trailLayer);
  if(!trailData)return;
  trailLayer=L.geoJSON(trailData.geometry,{
    attribution:'Trails: <a href="https://www.waynecounty.com/gisserver/rest/services/ParkFinder/Trails/MapServer/0">Wayne County</a>',
    filter:feature=>feature.properties.kind==='mtb'?showMTB:showPaved,
    style:feature=>({color:feature.properties.kind==='mtb'?'#344d36':'#899488',weight:feature.properties.kind==='mtb'?3:2,opacity:.9,dashArray:feature.properties.kind==='mtb'?null:'5 5'}),
    onEachFeature:(feature,line)=>{
      const p=feature.properties;
      bindLocationInfo(line,`<div class="map-popup"><div class="eyebrow">${esc(p.kind.toUpperCase())} // ${esc(p.surface)}</div><strong>${esc(p.name)}</strong><button type="button" class="popup-details" data-trail="${esc(p.trailId)}">VIEW TRAIL →</button></div>`);
    }
  }).addTo(map);
}
function renderTrailCollection(){
  if(!trailData)return;
  const list=document.getElementById('trailCollection');
  const cards=trailData.trails.map(trail=>{
    const mapped=trailData.geometry.features.some(f=>f.properties.trailId===trail.id);
    return {id:trail.id,html:`<article class="trail-card" id="trail-${esc(trail.id)}"><div class="eyebrow">${esc(trail.kind.toUpperCase())}${trail.miles?' // '+trail.miles+' MI':''}</div><h3>${esc(trail.name)}</h3><p>${esc(trail.note)}</p><div class="trail-actions">${mapped?`<button type="button" data-show-trail="${esc(trail.id)}">SHOW ON MAP</button>`:'<span class="trail-unmapped">Route not drawn</span>'}<a href="${esc(trail.source)}" target="_blank" rel="noreferrer">${mapped?'TRAIL GUIDE':'MAP + GUIDE'} ↗</a><button type="button" data-save-trail="${esc(trail.id)}" aria-pressed="${savedTrails.has(trail.id)}">${savedTrails.has(trail.id)?'SAVED ✓':'SAVE'}</button></div></article>`};
  }).concat(trailData.accessPoints.map(point=>({id:point.id,html:`<article class="trail-card"><div class="eyebrow">ACCESS POINT</div><h3>${esc(point.name)}</h3><p>${esc(point.address)}</p><p>${esc(point.note)}</p><div class="trail-actions"><a href="https://maps.apple.com/?q=${encodeURIComponent(point.address)}" target="_blank" rel="noreferrer">DIRECTIONS ↗</a><a href="${esc(point.source)}" target="_blank" rel="noreferrer">SOURCE ↗</a><button type="button" data-save-trail="${esc(point.id)}" aria-pressed="${savedTrails.has(point.id)}">${savedTrails.has(point.id)?'SAVED ✓':'SAVE'}</button></div></article>`})));
  list.innerHTML=cards.filter(card=>trailFilter==='all'||savedTrails.has(card.id)).map(card=>card.html).join('')||'<p class="lede">No saved picks yet. Choose ALL and save a trail or access point.</p>';
}
function showTrail(id){
  const features=trailData?.geometry.features.filter(f=>f.properties.trailId===id);
  if(!features?.length)return;
  showMTB=true;showPaved=true;renderTrails();
  setLayerButton(document.getElementById('mtbToggle'),true);setLayerButton(document.getElementById('pavedToggle'),true);
  showView('fieldView');centerOnNextFix=false;
  map.fitBounds(L.geoJSON({type:'FeatureCollection',features}).getBounds(),{padding:[24,24],maxZoom:16,animate:false});
}
function renderLandmarks(){
  landmarkLayer.clearLayers();landmarkMarkers.clear();
  officialLandmarks().filter(lm=>Number.isFinite(lm.lat)&&Number.isFinite(lm.lng)).forEach(lm=>{
    // A signal already represents these coordinates; don't stack two tap targets.
    if(state.signals.some(s=>!s.jp&&s.lat!=null&&distanceM(s,lm)<5))return;
    const sensitive=!!lm.sensitive;
    const symbol=sensitive?'✦':lm.kind==='WATER'?'≈':lm.kind==='HISTORY'?'◇':'○';
    const html=`<div class="landmark-dot ${sensitive?'sensitive':''}">${symbol}</div>`;
    const m=L.marker([lm.lat,lm.lng],{icon:L.divIcon({className:'',html,iconSize:[24,24],iconAnchor:[12,12]})}).addTo(landmarkLayer);
    const source=typeof lm.source==='string'&&lm.source.startsWith('https://')?'<a href="'+esc(lm.source)+'" target="_blank" rel="noopener noreferrer">SOURCE ↗</a>':'';
    bindLocationInfo(m,`<div class="map-popup"><div class="eyebrow">${esc(lm.kind)} // AREA REFERENCE${sensitive?' // SENSITIVE':''}</div><strong>${esc(lm.name)}</strong><p>${esc(lm.note||'')}</p><p>Reference point only. Confirm public access and parking on site.</p>${source}</div>`);
    if(lm.id)landmarkMarkers.set(lm.id,m);
  });
}
function renderMunicipalities(){
  municipalityLayer.clearLayers();
  municipalities.forEach(c=>L.marker([c.lat,c.lng],{interactive:false,icon:L.divIcon({className:'city-label-wrap',html:`<div class="city-label">${esc(c.name)}</div>`,iconSize:[160,20],iconAnchor:[80,10]})}).addTo(municipalityLayer));
}
function renderMarkers(){
  signalLayer.clearLayers();markers.clear();
  state.signals.filter(s=>s.lat!=null).forEach(sig=>{
    const st=signalState(sig);
    const html=`<div class="signal-dot ${sig.jp?'jp':''} ${st.unlocked?'unlocked':''}"></div>`;
    const marker=L.marker([sig.lat,sig.lng],{icon:L.divIcon({className:'',html,iconSize:[22,22],iconAnchor:[11,11]})}).addTo(signalLayer);
    bindLocationInfo(marker,`<div class="map-popup"><div class="eyebrow">${esc(sig.code)} // ${esc(st.label)}</div><strong>${esc(sig.name)}</strong><p>${esc(sig.region)}</p><button type="button" class="popup-details" data-signal="${esc(sig.id)}">VIEW FIND →</button></div>`);
    markers.set(sig.id,marker);
  });
}

function julianDate(date){return date.getTime()/86400000+2440587.5;}
function starAltAz(star,pos,date=new Date()){
  const jd=julianDate(date),T=(jd-2451545.0)/36525;
  const gmst=norm360(280.46061837+360.98564736629*(jd-2451545.0)+0.000387933*T*T-(T*T*T)/38710000);
  const lst=norm360(gmst+pos.lng),ha=norm360(lst-star.ra*15);
  const H=toRad(ha>180?ha-360:ha),dec=toRad(star.dec),lat=toRad(pos.lat);
  const sinAlt=Math.sin(dec)*Math.sin(lat)+Math.cos(dec)*Math.cos(lat)*Math.cos(H);
  const alt=Math.asin(Math.max(-1,Math.min(1,sinAlt)));
  const y=-Math.sin(H)*Math.cos(dec);
  const x=Math.sin(dec)*Math.cos(lat)-Math.cos(dec)*Math.sin(lat)*Math.cos(H);
  return {alt:toDeg(alt),az:norm360(toDeg(Math.atan2(y,x)))};
}
function celestialGuide(sig){
  if(!userPos||sig.lat==null)return null;
  const course=bearingDeg(userPos,sig),now=new Date();
  const options=guideStars.map(s=>({...s,...starAltAz(s,userPos,now)})).filter(s=>s.alt>5);
  if(!options.length)return {course,star:null};
  options.forEach(s=>{s.delta=signedAngle(s.az,course);s.score=Math.abs(s.delta)+(s.alt<15?25:0);});
  options.sort((a,b)=>a.score-b.score);
  return {course,star:options[0],when:now};
}
function celestialHTML(sig){
  const g=celestialGuide(sig);
  if(!g)return `<div class="nav-panel"><div class="eyebrow">CELESTIAL COURSE</div><p>Enable location to calculate a star-referenced course to this signal.</p></div>`;
  if(!g.star)return `<div class="nav-panel"><div class="eyebrow">CELESTIAL COURSE</div><p>No guide star in the preset list is high enough right now. Use MAP or WRITTEN CLUE.</p></div>`;
  const s=g.star,delta=s.delta,turn=Math.abs(Math.round(delta)),side=delta>0?'RIGHT':'LEFT';
  const courseAngle=g.course,starAngle=s.az;
  const targetX=50+34*Math.sin(toRad(courseAngle)),targetY=50-34*Math.cos(toRad(courseAngle));
  const starX=50+34*Math.sin(toRad(starAngle)),starY=50-34*Math.cos(toRad(starAngle));
  return `<div class="nav-panel celestial-panel">
    <div class="eyebrow">CELESTIAL COURSE // LIVE SKY</div>
    <div class="sky-compass" aria-label="Star and target bearings">
      <span class="north">N</span><span class="south">S</span><span class="east">E</span><span class="west">W</span>
      <i class="target-mark" style="left:${targetX}%;top:${targetY}%">SIGNAL</i>
      <i class="star-mark" style="left:${starX}%;top:${starY}%">★ ${esc(s.name)}</i>
    </div>
    <h3>FACE ${esc(s.name)} → TURN ${turn}° ${side}</h3>
    <p>${esc(s.name)} is currently about ${Math.round(s.alt)}° above the horizon at azimuth ${Math.round(s.az)}° (${cardinal(s.az)}). Your signal course is ${Math.round(g.course)}° (${cardinal(g.course)}).</p>
    <small>Star guidance is an orientation aid, not a substitute for trails, signs, daylight, or common sense. Tragically, the stars decline liability.</small>
  </div>`;
}
function openSignal(id){
  const sig=state.signals.find(s=>s.id===id);if(!sig)return;
  const st=signalState(sig),intercepted=!!state.intercepts[sig.id],unlock=st.unlocked||intercepted;
  showView('signalView',false);
  const d=document.getElementById('signalDetail');
  d.innerHTML=`
    <div class="detail-hero">
      <div><div class="detail-id">${esc(sig.code)}${sig.jp?' // JP':''}</div><h2>${esc(sig.name)}</h2><div class="eyebrow">${esc(sig.region)}</div></div>
      <div class="signal-meter"><div class="row"><span class="eyebrow">SIGNAL ${st.label}</span><span>${st.bars}</span></div><div class="meter"><div class="fill" style="width:${st.pct}%"></div></div></div>
    </div>
    <div class="detail-grid">
      <div class="detail-cell"><span>TYPE</span><strong>${esc(sig.type)}</strong></div>
      <div class="detail-cell"><span>RANGE</span><strong>${st.d==null?'UNKNOWN':fmtDistance(st.d)}</strong></div>
      <div class="detail-cell"><span>STATUS</span><strong>${esc(sig.status)}</strong></div>
      <div class="detail-cell"><span>INTERCEPT</span><strong>${intercepted?'LOGGED':unlock?'AVAILABLE':'LOCKED'}</strong></div>
    </div>
    ${sig.lat!=null?`<div class="nav-mode-tabs">
      <button class="nav-mode active" data-nav="celestial">CELESTIAL</button>
      <button class="nav-mode" data-nav="map">MAP</button>
      <button class="nav-mode" data-nav="written">WRITTEN CLUE</button>
    </div>
    <div id="navContent">${celestialHTML(sig)}</div>`:''}
    ${sig.lat==null?`<div class="lockbox">JP PICK UNASSIGNED<br><small>Assign it in JP PICKS after the field decision.</small></div>`:
      unlock?`<div class="transmission"><div class="eyebrow">TRANSMISSION ACQUIRED</div><h3>${esc(sig.transmission)}</h3><p>You are close enough to save this find. If you find a DRIFT card, scan it to open its linked sound.</p>${sig.link?`<a class="primary" href="${esc(sig.link)}" target="_blank" rel="noreferrer">LISTEN ↗</a>`:''}<button class="primary" id="logBtn">${intercepted?'FIND SAVED ✓':'SAVE FIND'}</button></div>`:
      `<div class="lockbox">TRANSMISSION LOCKED<br><small>Move within ${INTERCEPT_RADIUS} m to acquire.</small></div>`}
  `;
  document.querySelectorAll('.nav-mode').forEach(btn=>btn.onclick=()=>{
    document.querySelectorAll('.nav-mode').forEach(x=>x.classList.toggle('active',x===btn));
    const content=document.getElementById('navContent');
    if(btn.dataset.nav==='celestial')content.innerHTML=celestialHTML(sig);
    if(btn.dataset.nav==='written')content.innerHTML=`<div class="nav-panel"><div class="eyebrow">WRITTEN CLUE</div><p class="written-clue">${esc(sig.clue)}</p></div>`;
    if(btn.dataset.nav==='map'){
      content.innerHTML=`<div class="nav-panel"><div class="eyebrow">MAP</div><p>Opening the real Hines map and drawing a straight reference line to the signal. Trails, closures and river crossings still win.</p><button class="primary" id="openMapBtn">OPEN MAP</button></div>`;
      document.getElementById('openMapBtn').onclick=()=>focusSignalOnMap(sig);
    }
  });
  const log=document.getElementById('logBtn');
  if(log)log.onclick=()=>{state.intercepts[sig.id]={time:new Date().toISOString(),name:sig.name};saveState();renderArchive();openSignal(sig.id);toast('INTERCEPT LOGGED');};
}
function focusSignalOnMap(sig){
  signalLayer.addTo(map);setLayerButton(document.getElementById('signalsToggle'),true);
  showView('fieldView');
  if(guidanceLine){map.removeLayer(guidanceLine);guidanceLine=null;}
  if(reliableLocation(userPos)&&distanceM(userPos,sig)<=8000){
    guidanceLine=L.polyline([[userPos.lat,userPos.lng],[sig.lat,sig.lng]],{weight:2,dashArray:'5,7',opacity:.8}).addTo(map);
    map.fitBounds(L.latLngBounds([[userPos.lat,userPos.lng],[sig.lat,sig.lng]]),{padding:[55,55],maxZoom:16});
  }else map.setView([sig.lat,sig.lng],15);
  markers.get(sig.id)?.openPopup?.();
}

function renderArchive(){
  const vals=Object.entries(state.intercepts),assigned=state.signals.filter(s=>s.lat!=null).length;
  document.getElementById('archiveStats').innerHTML=`<div class="stat"><strong>${vals.length}</strong><span>INTERCEPTED</span></div><div class="stat"><strong>${assigned}</strong><span>ACTIVE POINTS</span></div><div class="stat"><strong>${state.routes.length}</strong><span>SAVED DRIFTS</span></div>`;
  document.getElementById('archiveList').innerHTML=vals.length?vals.sort((a,b)=>b[1].time.localeCompare(a[1].time)).map(([id,v])=>{const s=state.signals.find(x=>x.id===id);return `<article class="archive-item"><div class="meta">${new Date(v.time).toLocaleString()}</div><h3>${esc(s?.name||v.name)}</h3><span class="tag">${esc(s?.code||id)}</span>${s?.jp?' <span class="tag jp">JP</span>':''}</article>`}).join(''):`<div class="lockbox">NO INTERCEPTS YET</div>`;
  const routes=[...state.routes].reverse();
  document.getElementById('routeList').innerHTML=routes.length?routes.map((r,i)=>`<article class="archive-item"><div class="meta">${new Date(r.startedAt).toLocaleString()}</div><h3>ROUTE ${String(state.routes.length-i).padStart(2,'0')}</h3><span class="tag">${fmtTrackDistance(r.distanceM||0)}</span> <span class="tag">${fmtDuration(r.durationMs||0)}</span> <button class="inline-btn" onclick="window.showSavedDrift('${esc(r.id)}')">SHOW ON MAP</button></article>`).join(''):`<div class="lockbox">NO SAVED PATHS YET</div>`;
}
window.showSavedDrift=id=>{const r=state.routes.find(x=>x.id===id);if(!r)return;showView('fieldView');drawRoute(r.points||[],false);if(r.points?.length)map.fitBounds(L.latLngBounds(r.points.map(p=>[p.lat,p.lng])),{padding:[50,50]});};
function renderJP(){
  const list=document.getElementById('jpList');
  list.innerHTML=state.signals.filter(s=>s.jp).map(s=>`<article class="jp-item"><div class="meta">${esc(s.code)} // SHARED FIELD SIGNATURE</div><h3>${esc(s.name)}</h3><div><span class="tag jp">JP PICK</span> <span class="tag">${s.lat==null?'UNASSIGNED':'ASSIGNED'}</span></div><p class="lede">${esc(s.clue)}</p>${s.lat!=null?`<button class="back-btn" onclick="window.focusJP('${esc(s.id)}')">VIEW ON FIELD</button>`:''}</article>`).join('');
}
window.focusJP=id=>{const s=state.signals.find(x=>x.id===id);if(!s||s.lat==null)return;showView('fieldView');map.setView([s.lat,s.lng],15);};
function showView(id,updateTabs=true){
  document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id===id));
  if(updateTabs)document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t.dataset.view===id));
  if(id==='fieldView')map.invalidateSize({pan:false});
  if(id==='archiveView')renderArchive();if(id==='jpView')renderJP();if(id==='trailsView')renderTrailCollection();
}

function reliableLocation(pos){
  return !!pos&&Number.isFinite(pos.lat)&&Number.isFinite(pos.lng)&&Math.abs(pos.lat)<=90&&Math.abs(pos.lng)<=180&&Number.isFinite(pos.accuracy)&&pos.accuracy>0&&pos.accuracy<=MAX_LOCATION_ACCURACY;
}
function clearLocation(){
  userPos=null;
  if(userMarker){map.removeLayer(userMarker);userMarker=null;}
  if(guidanceLine){map.removeLayer(guidanceLine);guidanceLine=null;}
}
function acceptLocation(pos){
  const fix={lat:pos.coords.latitude,lng:pos.coords.longitude,accuracy:pos.coords.accuracy};
  if(!reliableLocation(fix)){
    clearLocation();
    locationMessage('PRECISE LOCATION NEEDED','Your phone supplied only an approximate location. Enable Precise Location for your browser or try outdoors. The map stays unchanged.');
    renderMarkers();return;
  }
  userPos=fix;
  locationMessage(`LOCATION ON // ±${Math.round(fix.accuracy)} m`);
  if(userMarker)userMarker.setLatLng([fix.lat,fix.lng]);
  else userMarker=L.marker([fix.lat,fix.lng],{icon:L.divIcon({className:'',html:'<div class="user-dot"></div>',iconSize:[14,14],iconAnchor:[7,7]})}).addTo(map);
  if(centerOnNextFix){map.setView([fix.lat,fix.lng],14);centerOnNextFix=false;}
  if(tracking)appendTrackPoint(fix);
  renderMarkers();
}
function startLocation(recenter=false){
  if(recenter)showView('fieldView');
  if(!navigator.geolocation){locationMessage('LOCATION UNAVAILABLE','This browser cannot provide location. Try opening DRIFT directly in Safari or Chrome.');return;}
  centerOnNextFix=recenter;
  if(recenter&&reliableLocation(userPos)){map.setView([userPos.lat,userPos.lng],14);centerOnNextFix=false;}
  locationMessage('FINDING YOUR LOCATION','Allow location when your browser asks. A precise fix may take a few seconds outdoors.');
  const failed=err=>{
    clearLocation();centerOnNextFix=false;
    if(locationWatchId!==null)navigator.geolocation.clearWatch(locationWatchId);
    locationWatchId=null;
    const message=err.code===1?'Location permission is blocked. Allow location for this site in your browser settings, then tap LOCATE again.':err.code===3?'Location timed out. Step outside with a clear view of the sky, then tap LOCATE again.':'Your phone could not get a location. Check Location Services and your connection, then tap LOCATE again.';
    locationMessage(err.code===1?'LOCATION BLOCKED':'LOCATION UNAVAILABLE',message);
    renderMarkers();toast(message);
  };
  const options={enableHighAccuracy:true,maximumAge:0,timeout:20000};
  // A repeat tap requests a fresh fix instead of silently waiting on an old watcher.
  if(locationWatchId!==null){navigator.geolocation.getCurrentPosition(acceptLocation,failed,options);return;}
  locationWatchId=navigator.geolocation.watchPosition(acceptLocation,failed,options);
}
function locationMessage(status,message=''){
  document.getElementById('geoStatus').textContent=status;
  const notice=document.getElementById('locationNotice');
  notice.textContent=message;notice.hidden=!message;
}

const PROFILE_KEY='lr-drift-profile-v01';
let deviceProfile={nickname:''};
try{
  const storedProfile=JSON.parse(localStorage.getItem(PROFILE_KEY));
  if(typeof storedProfile?.nickname==='string')deviceProfile.nickname=storedProfile.nickname.slice(0,40);
}catch{}
document.getElementById('deviceNickname').value=deviceProfile.nickname;
document.getElementById('deviceProfileForm').onsubmit=e=>{
  e.preventDefault();
  const next={nickname:document.getElementById('deviceNickname').value.trim().slice(0,40)};
  const status=document.getElementById('deviceProfileStatus');
  try{localStorage.setItem(PROFILE_KEY,JSON.stringify(next));deviceProfile=next;status.textContent='Profile saved on this device.';}
  catch{status.textContent='This browser could not save your profile. Check whether site storage is allowed.';}
};
function buildDeviceExport(includeCoordinates=false){
  return {
    format:'drift-device-export',version:1,exportedAt:new Date().toISOString(),
    includesExactCoordinates:includeCoordinates,
    profile:{...deviceProfile},finds:clone(state.intercepts),favorites:[...savedTrails],
    waypoints:personalWaypoints.map(lm=>{const {lat,lng,...details}=lm;return includeCoordinates?{...details,lat,lng}:details;}),
    routes:state.routes.map(route=>{
      const {points,...summary}=route;
      return includeCoordinates?{...summary,points:clone(points||[])}:{...summary,pointCount:points?.length||0};
    })
  };
}
document.getElementById('exportDataBtn').onclick=()=>{
  const status=document.getElementById('deviceProfileStatus');
  try{
    const data=buildDeviceExport(document.getElementById('exportCoordinates').checked);
    const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download=`drift-data-${new Date().toISOString().slice(0,10)}.json`;
    document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
    status.textContent='Export requested. Save the JSON file in Files or Downloads. Import and account sync are not available yet.';
  }catch{status.textContent='Export failed. Please try again in Safari or Chrome.';}
};

function appendTrackPoint(pos){
  if(!reliableLocation(pos)||pos.accuracy>100)return;
  const p={lat:pos.lat,lng:pos.lng,t:Date.now()};
  const last=trackPoints[trackPoints.length-1];
  if(last){const d=distanceM(last,p);if(d<3)return;trackDistanceM+=d;}
  trackPoints.push(p);drawRoute(trackPoints,true);updateTracker();
}
function drawRoute(points,current=true){
  routeLayer.clearLayers();
  if(!points?.length)return;
  L.polyline(points.map(p=>[p.lat,p.lng]),{weight:4,opacity:.9,dashArray:current?null:'7,6'}).addTo(routeLayer);
}
function renderSavedRoute(){
  const last=state.routes[state.routes.length-1];if(last?.points?.length)drawRoute(last.points,false);
}
function updateTracker(){
  document.getElementById('routeSummary').textContent=tracking?'RECORDING':'ROUTE';
  document.getElementById('trackDistance').textContent=fmtTrackDistance(trackDistanceM);
  document.getElementById('trackTime').textContent=trackStartedAt?fmtDuration(Date.now()-trackStartedAt):'00:00';
}
function startTracking(){
  if(tracking)return;
  startLocation(false);
  tracking=true;trackStartedAt=Date.now();trackPoints=[];trackDistanceM=0;routeLayer.clearLayers();
  document.getElementById('tracker').classList.add('is-tracking');
  document.getElementById('trackStatus').textContent='RECORDING';document.getElementById('trackStartBtn').disabled=true;document.getElementById('trackStopBtn').disabled=false;
  if(userPos)appendTrackPoint(userPos);
  trackTimer=setInterval(updateTracker,1000);updateTracker();toast('RECORDING YOUR ROUTE');
}
function stopTracking(){
  if(!tracking)return;
  tracking=false;clearInterval(trackTimer);trackTimer=null;
  const durationMs=Date.now()-trackStartedAt;
  if(trackPoints.length>1){
    state.routes.push({id:`drift-${Date.now()}`,startedAt:new Date(trackStartedAt).toISOString(),endedAt:new Date().toISOString(),distanceM:trackDistanceM,durationMs,points:trackPoints.slice()});
    state.routes=state.routes.slice(-12);saveState();renderArchive();toast('DRIFT SAVED');
  }else toast('NOT ENOUGH PATH DATA TO SAVE');
  document.getElementById('trackStatus').textContent='SAVED';document.getElementById('trackStartBtn').disabled=false;document.getElementById('trackStopBtn').disabled=true;updateTracker();
}
function clearTrack(){
  if(tracking){toast('STOP THE CURRENT DRIFT FIRST');return;}
  trackPoints=[];trackDistanceM=0;trackStartedAt=null;routeLayer.clearLayers();document.getElementById('trackStatus').textContent='READY';updateTracker();
  document.getElementById('tracker').classList.remove('is-tracking');
}

function setLayerButton(btn,on){btn.classList.toggle('active',on);btn.setAttribute('aria-pressed',String(on));}
function toggleHelp(show){const m=document.getElementById('quickStart');m.hidden=!show;if(show)document.body.classList.add('modal-open');else document.body.classList.remove('modal-open');}

document.querySelectorAll('.tab').forEach(t=>t.onclick=()=>showView(t.dataset.view));
document.getElementById('backBtn').onclick=()=>showView('fieldView');
document.getElementById('locateBtn').onclick=()=>startLocation(true);
document.getElementById('hinesHomeBtn').onclick=()=>{centerOnNextFix=false;map.closePopup();map.fitBounds(HINES_BOUNDS,{padding:[18,18],animate:false});document.getElementById('hinesPlaceSelect').value='';};
document.getElementById('hinesPlaceSelect').onchange=e=>{
  if(hinesCatalog.length){const id=e.target.value;e.target.value='';e.target.blur();if(id==='__all__')location.href='places.html';else if(id)focusHinesPlace(id);return;}
  const option=e.target.selectedOptions[0];
  if(!option?.dataset.lat||!option?.dataset.lng)return;
  centerOnNextFix=false;map.closePopup();map.setView([Number(option.dataset.lat),Number(option.dataset.lng)],14);
  e.target.blur();e.target.value='';
};
document.querySelectorAll('.map-style').forEach(btn=>btn.onclick=()=>setMapStyle(btn.dataset.mapStyle));
document.getElementById('map').addEventListener('click',e=>{
  const button=e.target.closest('[data-signal]');
  if(button){e.preventDefault();e.stopPropagation();openSignal(button.dataset.signal);}
  const trailButton=e.target.closest('[data-trail]');
  if(trailButton){trailFilter='all';document.querySelectorAll('[data-trail-filter]').forEach(b=>setLayerButton(b,b.dataset.trailFilter==='all'));showView('trailsView');document.getElementById('trail-'+trailButton.dataset.trail)?.scrollIntoView({block:'start'});}
});
document.querySelectorAll('[data-trail-filter]').forEach(button=>button.onclick=()=>{
  trailFilter=button.dataset.trailFilter;
  document.querySelectorAll('[data-trail-filter]').forEach(b=>setLayerButton(b,b===button));renderTrailCollection();
});
document.getElementById('trailCollection').addEventListener('click',e=>{
  const save=e.target.closest('[data-save-trail]');
  if(save){
    const id=save.dataset.saveTrail;
    const next=new Set(savedTrails);if(next.has(id))next.delete(id);else next.add(id);
    try{localStorage.setItem(TRAIL_SAVED_KEY,JSON.stringify([...next]));savedTrails=next;renderTrailCollection();}catch{toast('COULD NOT SAVE ON THIS DEVICE');}
  }
  const show=e.target.closest('[data-show-trail]');if(show)showTrail(show.dataset.showTrail);
});
document.getElementById('mtbToggle').onclick=e=>{showMTB=!showMTB;renderTrails();setLayerButton(e.currentTarget,showMTB);};
document.getElementById('pavedToggle').onclick=e=>{showPaved=!showPaved;renderTrails();setLayerButton(e.currentTarget,showPaved);};
document.getElementById('signalsToggle').onclick=e=>{
  const on=map.hasLayer(signalLayer);if(on)map.removeLayer(signalLayer);else signalLayer.addTo(map);setLayerButton(e.currentTarget,!on);
};
document.getElementById('helpBtn').onclick=()=>toggleHelp(true);
document.getElementById('closeHelpBtn').onclick=()=>toggleHelp(false);
document.getElementById('learnConceptBtn').onclick=()=>{toggleHelp(false);showView('infoView');document.getElementById('psychogeocaching').scrollIntoView({block:'start'});};
document.getElementById('gotItBtn').onclick=()=>toggleHelp(false);
document.getElementById('quickStart').addEventListener('click',e=>{if(e.target.id==='quickStart')toggleHelp(false);});
document.getElementById('trackStartBtn').onclick=startTracking;
document.getElementById('trackStopBtn').onclick=stopTracking;
document.getElementById('trackClearBtn').onclick=clearTrack;
const startHint=document.getElementById('startHint');
try{if(localStorage.getItem(START_HINT_KEY)==='1')startHint.classList.add('dismissed');}catch{}
document.getElementById('dismissStartHint').onclick=()=>{localStorage.setItem(START_HINT_KEY,'1');startHint.classList.add('dismissed');};

document.getElementById('waypointsToggle').onclick=e=>{
  const on=map.hasLayer(waypointLayer);if(on)map.removeLayer(waypointLayer);else waypointLayer.addTo(map);setLayerButton(e.currentTarget,!on);
};
document.getElementById('landmarksToggle').onclick=e=>{
  const on=map.hasLayer(landmarkLayer);if(on)map.removeLayer(landmarkLayer);else landmarkLayer.addTo(map);setLayerButton(e.currentTarget,!on);
};
document.getElementById('citiesToggle').onclick=e=>{
  const on=map.hasLayer(municipalityLayer);if(on)map.removeLayer(municipalityLayer);else municipalityLayer.addTo(map);setLayerButton(e.currentTarget,!on);
};

document.getElementById('jpForm').addEventListener('submit',e=>{
  e.preventDefault();const id=document.getElementById('jpPickId').value,s=state.signals.find(x=>x.id===id);
  const lat=parseFloat(document.getElementById('jpLat').value),lng=parseFloat(document.getElementById('jpLng').value);
  if(!Number.isFinite(lat)||!Number.isFinite(lng))return toast('Coordinates are being humans again. Check them.');
  s.name=document.getElementById('jpName').value.trim();s.lat=lat;s.lng=lng;s.region='HINES PARK // JP PICK';s.status='ACTIVE';s.transmission='JP FIELD TRANSMISSION';s.clue=document.getElementById('jpClue').value.trim()||'JP field point acquired.';
  saveState();renderJP();renderMarkers();e.target.reset();toast(`${s.code} ASSIGNED`);
});

const WAYPOINT_KEY='lr-drift-landmarks-v01';
const WAYPOINT_KINDS=['COOL_SPOT','GEOLOGY','ROCK','BIRD','PLANT','PLACE','LANDMARK','PARK','WATER','HISTORY','SHELTER','BURIAL'];
const WAYPOINT_LABELS={COOL_SPOT:'Cool spot',GEOLOGY:'Geological feature',ROCK:'Rock',BIRD:'Bird sighting',PLANT:'Plant',PLACE:'Place',LANDMARK:'Place',PARK:'Park',WATER:'Water',HISTORY:'Historic place',SHELTER:'Shelter',BURIAL:'Cemetery or memorial'};
function waypointKindLabel(kind){return WAYPOINT_LABELS[kind]||'Cool spot';}
let personalWaypoints=[],communityWaypoints=[],waypointEditId=null,draftWaypointPin=null,pickingWaypoint=false,waypointLocationRequest=0;
const waypointDialog=document.getElementById('waypointDialog');
const waypointForm=document.getElementById('waypointForm');
const waypointStatus=document.getElementById('waypointFormStatus');
function validWaypoint(lm){return !!lm&&typeof lm.id==='string'&&typeof lm.name==='string'&&lm.name.trim().length>0&&Number.isFinite(lm.lat)&&Math.abs(lm.lat)<=90&&Number.isFinite(lm.lng)&&Math.abs(lm.lng)<=180&&WAYPOINT_KINDS.includes(lm.kind);}
try{const saved=JSON.parse(localStorage.getItem(WAYPOINT_KEY));if(Array.isArray(saved))personalWaypoints=saved.filter(validWaypoint).map(lm=>({...lm,source:'personal',sensitive:lm.kind==='BURIAL',entries:Array.isArray(lm.entries)?lm.entries.filter(e=>typeof e.id==='string'&&typeof e.note==='string'&&Number.isFinite(Date.parse(e.observedAt))):[]}));}catch{}
function savePersonalWaypoints(next){
  try{localStorage.setItem(WAYPOINT_KEY,JSON.stringify(next));personalWaypoints=next;renderWaypoints();renderPersonalWaypoints();return true;}
  catch{toast('Could not save landmarks. Check whether browser storage is allowed.');return false;}
}
function renderWaypoints(){
  waypointLayer.clearLayers();
  [...communityWaypoints.filter(lm=>!personalWaypoints.some(p=>p.submissionId===lm.id)),...personalWaypoints].forEach(lm=>{
    const symbol={GEOLOGY:'◇',ROCK:'◆',BIRD:'B',PLANT:'P',COOL_SPOT:'+'}[lm.kind]||'○';
    const m=L.marker([lm.lat,lm.lng],{icon:L.divIcon({className:'',html:`<div class="waypoint-dot">${symbol}</div>`,iconSize:[28,28],iconAnchor:[14,14]})}).addTo(waypointLayer);
    bindLocationInfo(m,`<div class="map-popup"><div class="eyebrow">${esc(waypointKindLabel(lm.kind))} // ${lm.source==='personal'?'YOUR WAYPOINT':'COMMUNITY WAYPOINT'}</div><strong>${esc(lm.name)}</strong><p>${esc(lm.note||'')}</p>${lm.source==='personal'?`<button class="popup-details" type="button" data-journal-waypoint="${esc(lm.id)}">ADD JOURNAL NOTE</button><button class="popup-details" type="button" data-edit-waypoint="${esc(lm.id)}">EDIT WAYPOINT</button>`:''}</div>`);
  });
}
function entryDate(value){return new Date(value).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'});}
function renderPersonalWaypoints(){
  document.getElementById('savedWaypoints').innerHTML=personalWaypoints.map(lm=>`<article class="archive-item waypoint-card"><div class="meta">${esc(waypointKindLabel(lm.kind))} // ${lm.submissionId?'SUBMITTED FOR REVIEW':'PRIVATE'}</div><h3>${esc(lm.name)}</h3>${lm.note?`<p>${esc(lm.note)}</p>`:''}<div class="waypoint-actions"><button class="chip" type="button" data-journal-waypoint="${esc(lm.id)}">ADD NOTE</button><button class="chip" type="button" data-show-waypoint="${esc(lm.id)}">MAP</button><button class="chip" type="button" data-submit-waypoint="${esc(lm.id)}" ${lm.submissionId?"disabled":""}>${lm.submissionId?"SUBMITTED":"SUBMIT FOR REVIEW"}</button></div><details><summary>Notes + options (${lm.entries?.length||0})</summary><div class="journal-entries">${[...(lm.entries||[])].sort((a,b)=>Date.parse(b.observedAt)-Date.parse(a.observedAt)).map(entry=>`<div class="journal-entry"><time datetime="${esc(entry.observedAt)}">${esc(entryDate(entry.observedAt))}</time><p>${esc(entry.note)}</p><button class="chip" type="button" data-delete-entry="${esc(entry.id)}" data-entry-waypoint="${esc(lm.id)}">REMOVE NOTE</button></div>`).join('')||'<p>No dated notes yet.</p>'}</div><div class="waypoint-actions"><button class="chip" type="button" data-edit-waypoint="${esc(lm.id)}">EDIT WAYPOINT</button><button class="chip" type="button" data-submit-waypoint="${esc(lm.id)}" ${lm.submissionId?'disabled':''}>${lm.submissionId?'SUBMITTED':'SUBMIT WAYPOINT'}</button><button class="chip" type="button" data-delete-waypoint="${esc(lm.id)}">REMOVE WAYPOINT</button></div><p class="journal-privacy">Journal notes stay private, including when you submit a waypoint.</p></details></article>`).join('')||'<p class="lede">Your journal starts with a waypoint. Add a cool spot, rock, bird sighting, plant, or geological feature on the map.</p>';
}
function showWaypointEditor(id=null){
  cancelWaypointPicking();waypointEditId=id;waypointForm.reset();waypointStatus.textContent='';
  const lm=personalWaypoints.find(lm=>lm.id===id);
  document.getElementById('waypointTitle').textContent=lm?'Edit waypoint':'Add a waypoint';
  if(lm){document.getElementById('waypointName').value=lm.name;document.getElementById('waypointKind').value=lm.kind;document.getElementById('waypointNote').value=lm.note||'';setWaypointCoordinates(lm);if(lm.submissionId)waypointStatus.textContent='Edits update your device copy. Your submitted version stays unchanged.';}
  waypointDialog.showModal();
}
function setWaypointCoordinates(pos){document.getElementById('waypointLat').value=pos.lat.toFixed(6);document.getElementById('waypointLng').value=pos.lng.toFixed(6);}
function cancelWaypointPicking(){
  pickingWaypoint=false;document.getElementById('waypointPicker').hidden=true;document.getElementById('fieldView').classList.remove('picking-waypoint');
  if(draftWaypointPin){map.removeLayer(draftWaypointPin);draftWaypointPin=null;}
}
function closeWaypointEditor(){waypointLocationRequest++;waypointDialog.close();cancelWaypointPicking();}
function placeWaypointPin(pos){
  if(draftWaypointPin)draftWaypointPin.setLatLng(pos);
  else{draftWaypointPin=L.marker(pos,{draggable:true,icon:L.divIcon({className:'',html:'<div class="waypoint-draft-dot">+</div>',iconSize:[32,32],iconAnchor:[16,16]})}).addTo(map);draftWaypointPin.on('dragend',updateWaypointPinStatus);}
  updateWaypointPinStatus();
}
function updateWaypointPinStatus(){const pos=draftWaypointPin.getLatLng();document.getElementById('confirmWaypointPin').disabled=false;document.getElementById('waypointPickerStatus').textContent=`Pin: ${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}. Drag to adjust, then choose USE THIS PIN.`;}
function initWaypointTools(){
  renderWaypoints();renderPersonalWaypoints();initJournalTools();
  document.getElementById('addWaypointBtn').onclick=()=>showWaypointEditor();
  document.getElementById('journalAddWaypointBtn').onclick=()=>showWaypointEditor();
  waypointForm.addEventListener('invalid',e=>{if(['waypointLat','waypointLng'].includes(e.target.id))document.querySelector('.coordinate-details').open=true;},true);
  document.getElementById('closeWaypointDialog').onclick=closeWaypointEditor;document.getElementById('cancelWaypointDialog').onclick=closeWaypointEditor;
  waypointDialog.addEventListener('cancel',()=>{waypointLocationRequest++;cancelWaypointPicking();});
  document.getElementById('pickWaypointLocation').onclick=()=>{
    waypointLocationRequest++;waypointDialog.close();showView('fieldView');centerOnNextFix=false;pickingWaypoint=true;
    document.getElementById('waypointPicker').hidden=false;document.getElementById('fieldView').classList.add('picking-waypoint');document.getElementById('confirmWaypointPin').disabled=true;
    document.getElementById('waypointPickerStatus').textContent='Tap the map to place a pin, or drag the pin to adjust it.';
    const lat=document.getElementById('waypointLat'),lng=document.getElementById('waypointLng');
    if(lat.value!==''&&lng.value!==''&&lat.validity.valid&&lng.validity.valid)placeWaypointPin(L.latLng(Number(lat.value),Number(lng.value)));
  };
  map.on('click',e=>{if(pickingWaypoint)placeWaypointPin(e.latlng);});
  document.getElementById('confirmWaypointPin').onclick=()=>{if(!draftWaypointPin)return;setWaypointCoordinates(draftWaypointPin.getLatLng());cancelWaypointPicking();waypointDialog.showModal();};
  document.getElementById('cancelWaypointPin').onclick=()=>{cancelWaypointPicking();waypointDialog.showModal();};
  document.getElementById('useWaypointLocation').onclick=()=>{
    if(!navigator.geolocation){waypointStatus.textContent='Location unavailable. Choose a pin on the map instead.';return;}
    const request=++waypointLocationRequest;waypointStatus.textContent='Finding a precise location…';
    navigator.geolocation.getCurrentPosition(pos=>{if(request!==waypointLocationRequest||!waypointDialog.open)return;const fix={lat:pos.coords.latitude,lng:pos.coords.longitude,accuracy:pos.coords.accuracy};if(!reliableLocation(fix)){waypointStatus.textContent='Only approximate location is available. Choose a pin on the map instead.';return;}setWaypointCoordinates(fix);waypointStatus.textContent=`Location set (±${Math.round(fix.accuracy)} m). Check the pin before saving.`;},()=>{if(request===waypointLocationRequest&&waypointDialog.open)waypointStatus.textContent='Could not get location. Choose a pin on the map instead.';},{enableHighAccuracy:true,maximumAge:0,timeout:15000});
  };
  waypointForm.onsubmit=e=>{
    e.preventDefault();const existing=personalWaypoints.find(lm=>lm.id===waypointEditId);
    const lm={...existing,id:existing?.id||crypto.randomUUID(),name:document.getElementById('waypointName').value.trim(),kind:document.getElementById('waypointKind').value,note:document.getElementById('waypointNote').value.trim(),lat:Number(document.getElementById('waypointLat').value),lng:Number(document.getElementById('waypointLng').value),entries:existing?.entries||[],source:'personal',updatedAt:new Date().toISOString()};lm.sensitive=lm.kind==='BURIAL';
    if(!validWaypoint(lm)||!waypointForm.reportValidity()){waypointStatus.textContent='Enter a name and valid coordinates.';return;}
    if([...officialLandmarks(),...personalWaypoints,...communityWaypoints].some(other=>other.id!==lm.id&&other.name.toLowerCase()===lm.name.toLowerCase()&&distanceM(other,lm)<25)){waypointStatus.textContent='A waypoint with this name is already saved at this location.';return;}
    const next=existing?personalWaypoints.map(p=>p.id===lm.id?lm:p):[...personalWaypoints,lm];
    if(!savePersonalWaypoints(next)){waypointStatus.textContent='Waypoint not saved. Your entries are still here; try again.';return;}
    waypointLayer.addTo(map);setLayerButton(document.getElementById('waypointsToggle'),true);closeWaypointEditor();toast('Waypoint saved on this device.');
  };
  document.addEventListener('click',async e=>{
    const button=e.target.closest('[data-journal-waypoint],[data-edit-waypoint],[data-show-waypoint],[data-delete-waypoint],[data-submit-waypoint]');if(!button)return;
    const id=button.dataset.journalWaypoint||button.dataset.editWaypoint||button.dataset.showWaypoint||button.dataset.deleteWaypoint||button.dataset.submitWaypoint;const lm=personalWaypoints.find(p=>p.id===id);if(!lm)return;
    if(button.hasAttribute('data-journal-waypoint'))showJournalEditor(id);
    if(button.hasAttribute('data-edit-waypoint'))showWaypointEditor(id);
    if(button.hasAttribute('data-show-waypoint')){cancelWaypointPicking();showView('fieldView');centerOnNextFix=false;waypointLayer.addTo(map);setLayerButton(document.getElementById('waypointsToggle'),true);map.setView([lm.lat,lm.lng],16);}
    if(button.hasAttribute('data-delete-waypoint')&&confirm(`Remove “${lm.name}” from this device?${lm.submissionId?' Your submitted version will remain with DRIFT.':''}`))savePersonalWaypoints(personalWaypoints.filter(p=>p.id!==id));
    if(button.hasAttribute('data-submit-waypoint'))await submitPersonalWaypoint(lm,button);
  });
  document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>{if(pickingWaypoint)cancelWaypointPicking();}));
}
async function submitPersonalWaypoint(lm,button){
  if(lm.submissionId||!confirm(`Submit “${lm.name}” for review? Its name, description, type and exact pin location will be sent to DRIFT. Your private journal notes will not be sent. It becomes public only after approval.`))return;
  button.disabled=true;button.textContent='SUBMITTING…';
  try{
    const response=await fetch('/api/waypoints',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:lm.id,name:lm.name,note:lm.note,kind:lm.kind,lat:lm.lat,lng:lm.lng})});
    const result=await response.json();if(!response.ok||!result.id)throw new Error('Could not submit');
    const next=personalWaypoints.map(p=>p.id===lm.id?{...p,submissionId:result.id}:p);
    if(savePersonalWaypoints(next))toast('Submitted for review. Your waypoint is still saved on this device.');else toast('Submitted, but status could not save on this device. Retrying will not create a duplicate.');
  }catch{button.disabled=false;button.textContent='SUBMIT WAYPOINT';toast('Not submitted. Your waypoint is saved on this device; try again when connected.');}
}
async function loadCommunityWaypoints(){
  try{const response=await fetch('/api/waypoints');if(!response.ok)return;const data=await response.json();if(!Array.isArray(data.waypoints))return;communityWaypoints=data.waypoints.filter(validWaypoint).map(lm=>({...lm,source:'community',sensitive:lm.kind==='BURIAL'}));renderWaypoints();}catch{}
}

let journalWaypointId=null;
const journalDialog=document.getElementById('journalDialog');
function showJournalEditor(id){
  const wp=personalWaypoints.find(p=>p.id===id);if(!wp)return;
  journalWaypointId=id;document.getElementById('journalTitle').textContent=wp.name;
  document.getElementById('journalEntryForm').reset();document.getElementById('journalEntryStatus').textContent='';
  const now=new Date();document.getElementById('journalDate').value=new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,16);
  journalDialog.showModal();
}
function initJournalTools(){
  document.getElementById('closeJournalDialog').onclick=()=>journalDialog.close();
  document.getElementById('journalEntryForm').onsubmit=e=>{
    e.preventDefault();const wp=personalWaypoints.find(p=>p.id===journalWaypointId);
    const note=document.getElementById('journalText').value.trim(),date=new Date(document.getElementById('journalDate').value);
    if(!wp||!note||!Number.isFinite(date.getTime())){document.getElementById('journalEntryStatus').textContent='Add a note and a valid observation time.';return;}
    const entry={id:crypto.randomUUID(),observedAt:date.toISOString(),note};
    if(savePersonalWaypoints(personalWaypoints.map(p=>p.id===wp.id?{...p,entries:[...(p.entries||[]),entry]}:p))){journalDialog.close();toast('Private journal note saved.');}
    else document.getElementById('journalEntryStatus').textContent='Note not saved. Your text is still here; try again.';
  };
  document.addEventListener('click',e=>{
    const button=e.target.closest('[data-delete-entry]');if(!button)return;
    const wp=personalWaypoints.find(p=>p.id===button.dataset.entryWaypoint);if(!wp||!confirm('Remove this private journal note?'))return;
    savePersonalWaypoints(personalWaypoints.map(p=>p.id===wp.id?{...p,entries:(p.entries||[]).filter(entry=>entry.id!==button.dataset.deleteEntry)}:p));
  });
}

// Show Quick Start on every fresh opening, including returning visitors.
// Entering the field never depends on browser storage or requests location.
toggleHelp(true);
archiveAndRemoveJP();
initMap();renderArchive();renderJP();
const incomingSignal=new URLSearchParams(location.search).get('signal');if(incomingSignal)openSignal(incomingSignal);
// Location remains an explicit opt-in after entering the field.
if('serviceWorker' in navigator)window.addEventListener('load',()=>{
  let refreshing=false;
  const wasControlled=!!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange',()=>{
    if(tracking){toast('UPDATE READY // RELOAD AFTER SAVING YOUR DRIFT');return;}
    if(wasControlled&&!refreshing){refreshing=true;location.reload();}
  });
  navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(reg=>reg.update()).catch(()=>{});
});

// Shared field services are part of the canonical app, not a UI patch.

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

  }

  function correctDirectoryLinks(){
    document.querySelectorAll('.directory-links a').forEach(link=>{
      if(link.textContent.trim()==='nøfuture')link.href='https://nøfuture.com';
    });
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
        <h2>SAVE FIND</h2>
        <p class="shared-privacy-note">Your location only verifies the find; exact coordinates are not stored with it. Public sharing is optional. Attached photos are resized and their embedded metadata removed before upload.</p>
        <input type="hidden" id="sharedSignalId" />
        <label>DISPLAY NAME <span>optional</span><input id="sharedAlias" maxlength="40" autocomplete="nickname" placeholder="anonymous is fine" /></label>
        <label>NOTE <span>optional</span><textarea id="sharedNote" maxlength="500" rows="4" placeholder="What did you notice?"></textarea></label>
        <label>PHOTO <span>optional</span><input id="sharedPhoto" type="file" accept="image/*" capture="environment" /></label>
        <label class="share-check"><input id="sharedPublic" type="checkbox" /> <span>SHARE MY NAME, NOTE AND ANY ATTACHED PHOTO PUBLICLY IN THE FIELD LOG + PHOTO LOG</span></label>
        <div class="shared-actions">
          <button type="button" class="primary" id="sharedSubmit">SAVE FIND</button>
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

  async function prepareFieldPhoto(file){
    const objectUrl=URL.createObjectURL(file);
    try{
      const image=new Image();
      await new Promise((resolve,reject)=>{
        image.onload=resolve;
        image.onerror=()=>reject(new Error('photo_cannot_decode'));
        image.src=objectUrl;
      });
      const width=image.naturalWidth,height=image.naturalHeight;
      if(!width||!height)throw new Error('photo_empty');
      const scale=Math.min(1,2200/Math.max(width,height));
      const canvas=document.createElement('canvas');
      canvas.width=Math.max(1,Math.round(width*scale));
      canvas.height=Math.max(1,Math.round(height*scale));
      const context=canvas.getContext('2d');
      if(!context)throw new Error('photo_canvas_unavailable');
      context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);
      context.drawImage(image,0,0,canvas.width,canvas.height);
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.86));
      if(!blob||blob.size>8*1024*1024)throw new Error('photo_too_large');
      return blob;
    }finally{URL.revokeObjectURL(objectUrl);}
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

    let photo=null;
    try{
      const source=document.getElementById('sharedPhoto').files?.[0];
      if(source)photo=await prepareFieldPhoto(source);
    }catch{
      toast('PHOTO COULD NOT BE PREPARED // TRY ANOTHER IMAGE');
      button.disabled=false;button.textContent='SAVE FIND';
      return;
    }
    try{
      if(!userPos)throw new Error('live_location_required');
      const response=await fetch('/api/intercepts',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||`HTTP ${response.status}`);

      let photoUploaded=true;
      if(photo&&data.id){
        try{
          const photoResponse=await fetch(`/api/intercepts/${encodeURIComponent(data.id)}/photo`,{
            method:'POST',
            headers:{'content-type':'image/jpeg','x-drift-photo-token':data.photo_upload_token||''},
            body:photo
          });
          photoUploaded=photoResponse.ok;
        }catch{photoUploaded=false;}
      }

      localLog(signal);
      dialog.close();
      openSignal(signal.id);
      toast(!photoUploaded?'FIND SAVED // PHOTO COULD NOT UPLOAD':payload.public?'INTERCEPT TRANSMITTED TO DRIFT':'PRIVATE INTERCEPT SAVED');
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
      button.disabled=false;button.textContent='SAVE FIND';
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
      target.innerHTML='<div class="lockbox">PUBLIC LOG UNAVAILABLE // YOUR SAVED ITEMS STILL WORK</div>';
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

  correctDirectoryLinks();
  loadSharedActivity();
  updateBackendStatus();
  window.addEventListener('online',()=>{loadSharedActivity();updateBackendStatus();});

