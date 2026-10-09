// Release 23: app code is network-first; only static images are cache-first.
const CACHE='drift-v23';
const LEAFLET=['https://unpkg.com/leaflet@1.9.4/dist/leaflet.js','https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'];
const CORE=['./','./index.html','./features.html','./updates.html','./walter.html','./assets/walter-w2-memory.jpg','./styles.css?v=23','./app.js?v=23','./data/hines-trails.json','./manifest.webmanifest','./assets/drift-logo-light.png','./icons/signal-glyph-180.png','./icons/signal-glyph-192.png','./icons/signal-glyph-512.png',...LEAFLET];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('drift-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET'||(url.origin!==self.location.origin&&!LEAFLET.includes(url.href))||url.pathname.startsWith('/api/'))return;
  const appCode=request.mode==='navigate'||/\.(?:html|js|css|json|webmanifest)$/.test(url.pathname);
  if(appCode){
    event.respondWith(fetch(request,{cache:'no-cache'}).then(response=>{
      if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(request,copy)));}
      return response;
    }).catch(async()=>{
      const cached=await caches.match(request);
      if(cached)return cached;
      if(request.mode==='navigate')return (await caches.match('./index.html'))||Response.error();
      return Response.error();
    }));
    return;
  }
  if(/\.(?:png|jpg|jpeg|svg|webp|ico)$/.test(url.pathname)){
    event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{
      if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(request,copy)));}
      return response;
    })));
  }
});

