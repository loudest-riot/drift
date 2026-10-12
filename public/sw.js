// Release 27: app code is network-first; only static images are cache-first.
const CACHE='drift-v27';
const LEAFLET=['https://unpkg.com/leaflet@1.9.4/dist/leaflet.js','https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'];
const CORE=['./journal-media.js?v=27','./share.js?v=27','./','./index.html','./field-log.html','./field-log.js?v=27','./contact.html','./privacy.html','./features.html','./updates.html','./places.html','./places.js?v=27','./data/hines-places.json','./photo-log.html','./photo-log.css?v=27','./photo-log.js?v=27','./data/photo-log.json','./walter.html','./assets/walter-w2-memory.jpg','./styles.css?v=27','./app.js?v=27','./data/hines-trails.json','./manifest.webmanifest','./assets/drift-logo-light.png','./icons/signal-glyph-180.png','./icons/signal-glyph-192.png','./icons/signal-glyph-512.png',...LEAFLET];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE.filter(url=>!LEAFLET.includes(url))).then(()=>Promise.allSettled(LEAFLET.map(async url=>{try{await cache.add(url);}catch{const prior=await caches.match(url);if(prior)await cache.put(url,prior);}})))).then(()=>self.skipWaiting()));
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
      if(request.mode==='navigate'){
        const page=await caches.match(url.origin+url.pathname);
        if(page)return page;
        if(url.pathname==='/'||url.pathname.endsWith('/index.html'))return (await caches.match('./index.html'))||Response.error();
      }
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

