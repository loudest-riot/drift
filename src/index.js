const API_HEADERS={
  'content-type':'application/json; charset=utf-8',
  'cache-control':'no-store',
  'x-content-type-options':'nosniff'
};

const schemaStatements=[
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
  let query=`SELECT i.id,i.signal_id,i.alias,i.note,i.photo_key,i.created_at,s.code,s.name
             FROM intercepts i JOIN signals s ON s.id=i.signal_id
             WHERE i.public=1`;
  const bindings=[];
  if(signalId){query+=' AND i.signal_id=?';bindings.push(signalId);}
  query+=' ORDER BY i.created_at DESC LIMIT ?';bindings.push(limit);
  const {results=[]}=await env.DB.prepare(query).bind(...bindings).all();
  return json({intercepts:results});
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
  await env.DB.prepare(`INSERT INTO intercepts (id,signal_id,alias,note,public,verified) VALUES (?,?,?,?,?,1)`)
    .bind(id,signalId,alias,note,isPublic).run();

  return json({ok:true,id,signal_id:signalId,verified:true,public:!!isPublic},201);
}

async function uploadPhoto(request,env,interceptId){
  if(!env.PHOTOS)return json({error:'photo_storage_unavailable'},503);
  await ensureSchema(env);
  const row=await env.DB.prepare(`SELECT id FROM intercepts WHERE id=?`).bind(interceptId).first();
  if(!row)return json({error:'intercept_not_found'},404);
  const type=(request.headers.get('content-type')||'').toLowerCase();
  if(!type.startsWith('image/'))return json({error:'image_required'},415);
  const bytes=await request.arrayBuffer();
  if(bytes.byteLength>8*1024*1024)return json({error:'image_too_large'},413);
  const ext=type.includes('png')?'png':type.includes('webp')?'webp':'jpg';
  const key=`intercepts/${interceptId}/${crypto.randomUUID()}.${ext}`;
  await env.PHOTOS.put(key,bytes,{httpMetadata:{contentType:type}});
  await env.DB.prepare(`UPDATE intercepts SET photo_key=? WHERE id=?`).bind(key,interceptId).run();
  return json({ok:true,photo_key:key},201);
}

async function api(request,env){
  const url=new URL(request.url),path=url.pathname;
  if(path==='/api/health'){
    if(env.DB)await ensureSchema(env);
    return json({ok:true,database:!!env.DB,photos:!!env.PHOTOS,privacy:'location is verified in memory and exact coordinates are not stored with intercepts'});
  }
  if(!env.DB)return json({error:'database_unavailable'},503);
  if(path==='/api/signals'&&request.method==='GET')return listSignals(env);
  if(path==='/api/intercepts'&&request.method==='GET')return listIntercepts(request,env);
  if(path==='/api/intercepts'&&request.method==='POST')return createIntercept(request,env);
  const photoMatch=path.match(/^\/api\/intercepts\/([^/]+)\/photo$/);
  if(photoMatch&&request.method==='POST')return uploadPhoto(request,env,decodeURIComponent(photoMatch[1]));
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
