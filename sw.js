const CACHE='drift-v08';
const CORE=['./','./index.html','./styles.css','./landscape.css','./ui.css','./app.js','./map-init-fix.js','./ui-fix.js','./manifest.webmanifest','./assets/drift-logo-light.png','./icons/signal-glyph-180.png','./icons/signal-glyph-192.png','./icons/signal-glyph-512.png'];

self.addEventListener('install',e=>{
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)));
});

self.addEventListener('activate',e=>{
  e.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const url=new URL(e.request.url);

  /* Navigation and same-origin code prefer the network so GitHub/Cloudflare
     deployments actually appear without ritual cache exorcisms. */
  const appCode=url.origin===self.location.origin && (
    e.request.mode==='navigate' || /\.(?:html|js|css|webmanifest)$/.test(url.pathname)
  );

  if(appCode){
    e.respondWith(
      fetch(e.request)
        .then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r;})
        .catch(()=>caches.match(e.request).then(hit=>hit||caches.match('./index.html')))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(hit=>hit||fetch(e.request).then(r=>{
      if(url.origin===self.location.origin){const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));}
      return r;
    }))
  );
});
