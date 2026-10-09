const API_HEADERS={
  'content-type':'application/json; charset=utf-8',
  'cache-control':'no-store',
  'x-content-type-options':'nosniff'
};

const schemaStatements=[
  `CREATE TABLE IF NOT EXISTS landmarks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  note TEXT,
  lat REAL NOT NULL CHECK(lat BETWEEN -90 AND 90),
  lng REAL NOT NULL CHECK(lng BETWEEN -180 AND 180),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`,
  `CREATE INDEX IF NOT EXISTS idx_landmarks_status ON landmarks(status,created_at)`,
  `CREATE TABLE IF NOT EXISTS signals (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    region TEXT NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    transmission TEXT,
    clue TEXT,
    link TEXT,
    intercept_radius_m INTEGER NOT NULL DEFAULT 140,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS intercepts (
    id TEXT PRIMARY KEY,
    signal_id TEXT NOT NULL,
    alias TEXT,
    note TEXT,
    public INTEGER NOT NULL DEFAULT 0,
    verified INTEGER NOT NULL DEFAULT 1,
    photo_key TEXT,
    photo_upload_token TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(signal_id) REFERENCES signals(id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_intercepts_signal_time ON intercepts(signal_id,created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_intercepts_public_time ON intercepts(public,created_at DESC)`,
  `INSERT OR IGNORE INTO signals
    (id,code,name,region,lat,lng,type,status,transmission,clue,link,intercept_radius_m,active)
   VALUES
    ('hpr-001','HPR-001','Newburgh Pointe','HINES PARK // NEWBURGH',42.36733,-83.42335,'SONIC ARTIFACT','ACTIVE','Hines Park Relay 001','Follow the waterline. Let the path choose the pace. The relay sharpens when the lake comes into view.','https://ditto.fm/hines-park-relay',140,1)`,
  `INSERT OR IGNORE INTO signals
    (id,code,name,region,lat,lng,type,status,transmission,clue,link,intercept_radius_m,active)
   VALUES
    ('mrr-001','MRR-001','Helms Haven','MIDDLE ROUGE // HELMS',42.3402,-83.2638,'FIELD TRANSMISSION','ACTIVE','Middle Rouge Relay','Stay with the Rouge. Traffic should become background radiation. Find the point where the green wins.','',140,1)`
];

let schemaReady=false;

function json(data,status=200,headers={}){
  return new Response(JSON.stringify(data),{status,headers:{...API_HEADERS,...headers}});
}

async function ensureSchema(env){
  if(schemaReady||!env.DB)return;
  await env.DB.batch(schemaStatements.map(sql=>env.DB.prepare(sql)));
  // Existing deployments predate one-time photo upload capabilities.
  const columns=await env.DB.prepare('PRAGMA table_info(intercepts)').all();
  if(!(columns.results||[]).some(c=>c.name==='photo_upload_token')){
    try{await env.DB.prepare('ALTER TABLE intercepts ADD COLUMN photo_upload_token TEXT').run();}
    catch(error){
      const current=await env.DB.prepare('PRAGMA table_info(intercepts)').all();
      if(!(current.results||[]).some(c=>c.name==='photo_upload_token'))throw error;
    }
  }
  schemaReady=true;
}

function finiteCoord(v,min,max){
  const n=Number(v);return Number.isFinite(n)&&n>=min&&n<=max?n:null;
}

function distanceM(a,b){
  const r=6371000,rad=x=>x*Math.PI/180;
  const p1=rad(a.lat),p2=rad(b.lat),dp=rad(b.lat-a.lat),dl=rad(b.lng-a.lng);
  const h=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;
  return r*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));
}

function cleanText(value,max){
  if(value==null)return null;
  const text=String(value).trim().replace(/[\u0000-\u001f\u007f]/g,'');
  return text?text.slice(0,max):null;
}

async function listSignals(env){
  await ensureSchema(env);
  const {results=[]}=await env.DB.prepare(`SELECT id,code,name,region,lat,lng,type,status,transmission,clue,link,intercept_radius_m FROM signals WHERE active=1 ORDER BY code`).all();
  return json({signals:results});
}

async function listIntercepts(request,env){
  await ensureSchema(env);
  const url=new URL(request.url);
  const limit=Math.min(Math.max(Number(url.searchParams.get('limit'))||20,1),50);
  const signalId=cleanText(url.searchParams.get('signal_id'),64);
  const photosOnly=url.searchParams.get('photos_only')==='1';
  const offset=Math.min(Math.max(Number(url.searchParams.get('offset'))||0,0),10000);
  let query=`SELECT i.id,i.signal_id,i.alias,i.note,i.photo_key,i.created_at,s.code,s.name
             FROM intercepts i JOIN signals s ON s.id=i.signal_id
             WHERE i.public=1 AND i.verified=1`;
  const bindings=[];
  if(signalId){query+=' AND i.signal_id=?';bindings.push(signalId);}
  if(photosOnly)query+=' AND i.photo_key IS NOT NULL';
  query+=' ORDER BY i.created_at DESC, i.id DESC LIMIT ? OFFSET ?';
  bindings.push(limit+1,offset);
  const {results=[]}=await env.DB.prepare(query).bind(...bindings).all();
  return json({intercepts:results.slice(0,limit),has_more:results.length>limit});
}

async function createIntercept(request,env){
  await ensureSchema(env);
  const length=Number(request.headers.get('content-length')||0);
  if(length>20000)return json({error:'payload_too_large'},413);
  let body;
  try{body=await request.json();}catch{return json({error:'invalid_json'},400);}

  const signalId=cleanText(body.signal_id,64);
  const lat=finiteCoord(body.lat,-90,90),lng=finiteCoord(body.lng,-180,180);
  if(!signalId||lat==null||lng==null)return json({error:'signal_and_live_location_required'},400);

  const signal=await env.DB.prepare(`SELECT id,name,lat,lng,intercept_radius_m FROM signals WHERE id=? AND active=1`).bind(signalId).first();
  if(!signal)return json({error:'signal_not_found'},404);

  const d=distanceM({lat,lng},{lat:signal.lat,lng:signal.lng});
  const radius=Math.max(25,Number(signal.intercept_radius_m)||140);
  if(d>radius)return json({error:'outside_intercept_radius',distance_m:Math.round(d),radius_m:radius},403);

  const id=crypto.randomUUID();
  const alias=cleanText(body.alias,40);
  const note=cleanText(body.note,500);
  const isPublic=body.public===true?1:0;
  const uploadToken=crypto.randomUUID()+crypto.randomUUID();
  await env.DB.prepare(`INSERT INTO intercepts (id,signal_id,alias,note,public,verified,photo_upload_token) VALUES (?,?,?,?,?,1,?)`)
    .bind(id,signalId,alias,note,isPublic,uploadToken).run();

  // The upload capability is delivered once to the finder, never in the public API.
  return json({ok:true,id,signal_id:signalId,verified:true,public:!!isPublic,photo_upload_token:uploadToken},201);
}

const LANDMARK_KINDS=new Set(['COOL_SPOT','GEOLOGY','ROCK','BIRD','PLANT','PLACE','LANDMARK','PARK','WATER','HISTORY','SHELTER','BURIAL']);
async function listLandmarks(env,key='landmarks'){
  await ensureSchema(env);
  const {results=[]}=await env.DB.prepare(`SELECT id,name,kind,note,lat,lng FROM landmarks WHERE status='approved' ORDER BY created_at DESC LIMIT 500`).all();
  return json({[key]:results});
}
async function createLandmark(request,env){
  // Bound the actual body, including chunked requests without Content-Length.
  if(Number(request.headers.get('content-length'))>8192)return json({error:'payload_too_large'},413);
  if(!request.body)return json({error:'invalid_json'},400);
  const reader=request.body.getReader();let size=0,chunks=[];
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>8192){await reader.cancel();return json({error:'payload_too_large'},413);}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  let body;try{body=JSON.parse(new TextDecoder().decode(bytes));}catch{return json({error:'invalid_json'},400);}
  if(!body||Array.isArray(body)||typeof body!=='object')return json({error:'invalid_landmark'},400);
  const id=body.id;
  if(typeof id!=='string'||!/^[-0-9a-f]{36}$/i.test(id)||typeof body.name!=='string'||!body.name.trim()||body.name.length>80||!LANDMARK_KINDS.has(body.kind)||typeof body.lat!=='number'||!Number.isFinite(body.lat)||Math.abs(body.lat)>90||typeof body.lng!=='number'||!Number.isFinite(body.lng)||Math.abs(body.lng)>180||(body.note!=null&&(typeof body.note!=='string'||body.note.length>500)))return json({error:'invalid_landmark'},400);
  const name=cleanText(body.name,80);if(!name)return json({error:'invalid_landmark'},400);
  await ensureSchema(env);
  // Client UUID makes a retry safe when a response or local status save is lost.
  // A caller can never update a reviewed record or choose public visibility.
  await env.DB.prepare(`INSERT OR IGNORE INTO landmarks (id,name,kind,note,lat,lng,status) VALUES (?,?,?,?,?,?,'pending')`).bind(id,name,body.kind,cleanText(body.note,500),body.lat,body.lng).run();
  return json({ok:true,id,submitted:true},201);
}

async function uploadPhoto(request,env,interceptId){
  if(!env.PHOTOS)return json({error:'photo_storage_unavailable'},503);
  await ensureSchema(env);
  const row=await env.DB.prepare(`SELECT photo_key,photo_upload_token FROM intercepts WHERE id=?`).bind(interceptId).first();
  if(!row)return json({error:'intercept_not_found'},404);
  const token=request.headers.get('x-drift-photo-token')||'';
  if(!token||!row.photo_upload_token||token!==row.photo_upload_token)return json({error:'photo_upload_not_authorized'},403);
  if(row.photo_key)return json({error:'photo_already_attached'},409);
  const type=(request.headers.get('content-type')||'').toLowerCase().split(';')[0].trim();
  if(!['image/jpeg','image/png','image/webp'].includes(type))return json({error:'supported_images_are_jpeg_png_webp'},415);
  if(Number(request.headers.get('content-length')||0)>8*1024*1024)return json({error:'image_too_large'},413);
  const bytes=await request.arrayBuffer();
  if(!bytes.byteLength||bytes.byteLength>8*1024*1024)return json({error:'image_too_large'},413);
  const b=new Uint8Array(bytes);
  const jpeg=b.length>=3&&b[0]===255&&b[1]===216&&b[2]===255;
  const png=b.length>=8&&[137,80,78,71,13,10,26,10].every((n,i)=>b[i]===n);
  const webp=b.length>=12&&[82,73,70,70].every((n,i)=>b[i]===n)&&[87,69,66,80].every((n,i)=>b[i+8]===n);
  if(!(type==='image/jpeg'&&jpeg||type==='image/png'&&png||type==='image/webp'&&webp))return json({error:'invalid_image_data'},415);
  const ext=type==='image/png'?'png':type==='image/webp'?'webp':'jpg';
  const key=`intercepts/${interceptId}/${crypto.randomUUID()}.${ext}`;
  await env.PHOTOS.put(key,bytes,{httpMetadata:{contentType:type}});
  const update=await env.DB.prepare(`UPDATE intercepts SET photo_key=?,photo_upload_token=NULL WHERE id=? AND photo_upload_token=? AND photo_key IS NULL`)
    .bind(key,interceptId,token).run();
  if(!update.meta?.changes){
    await env.PHOTOS.delete(key);
    return json({error:'photo_already_attached'},409);
  }
  return json({ok:true},201);
}

async function getPhoto(request,env,interceptId){
  if(!env.PHOTOS)return json({error:'photo_storage_unavailable'},503);
  await ensureSchema(env);
  const row=await env.DB.prepare(`SELECT photo_key FROM intercepts WHERE id=? AND public=1`).bind(interceptId).first();
  if(!row?.photo_key)return json({error:'photo_not_found'},404);
  const object=await env.PHOTOS.get(row.photo_key);
  if(!object)return json({error:'photo_not_found'},404);
  const headers=new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag',object.httpEtag);
  headers.set('cache-control','public, max-age=3600');
  headers.set('x-content-type-options','nosniff');
  return new Response(object.body,{headers});
}

async function api(request,env){
  const url=new URL(request.url),path=url.pathname;
  if(path==='/api/health'){
    if(env.DB)await ensureSchema(env);
    return json({ok:true,database:!!env.DB,photos:!!env.PHOTOS,privacy:'location is verified in memory and exact coordinates are not stored with intercepts'});
  }
  if(!env.DB)return json({error:'database_unavailable'},503);
  if(path==='/api/waypoints'&&request.method==='GET')return listLandmarks(env,'waypoints');
  if(path==='/api/waypoints'&&request.method==='POST')return createLandmark(request,env);
  if(path==='/api/landmarks'&&request.method==='GET')return listLandmarks(env);
  if(path==='/api/landmarks'&&request.method==='POST')return createLandmark(request,env);
  if(path==='/api/signals'&&request.method==='GET')return listSignals(env);
  if(path==='/api/intercepts'&&request.method==='GET')return listIntercepts(request,env);
  if(path==='/api/intercepts'&&request.method==='POST')return createIntercept(request,env);
  const photoMatch=path.match(/^\/api\/intercepts\/([^/]+)\/photo$/);
  if(photoMatch&&request.method==='POST')return uploadPhoto(request,env,decodeURIComponent(photoMatch[1]));
  if(photoMatch&&request.method==='GET')return getPhoto(request,env,decodeURIComponent(photoMatch[1]));
  return json({error:'not_found'},404);
}

export default {
  async fetch(request,env){
    const url=new URL(request.url);
    if(url.pathname.startsWith('/api/')){
      try{return await api(request,env);}catch(error){
        console.error(error);
        return json({error:'server_error'},500);
      }
    }
    return env.ASSETS.fetch(request);
  }
};

