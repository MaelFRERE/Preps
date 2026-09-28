const CACHE='runprep-v3-0-0';
const ASSETS=['./','./index.html','./styles.css?v=3.0.0','./engine.js?v=3.0.0','./calendar.js?v=3.0.0','./app.js?v=3.0.0','./manifest.webmanifest','./icons/icon.svg','./icons/icon-192.png','./icons/icon-512.png','./METHODE.md'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{for(const name of await caches.keys())if(name.startsWith('runprep')&&name!==CACHE)await caches.delete(name);await self.clients.claim();})());});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    try{const response=await fetch(event.request);if(response.ok&&ASSETS.some(path=>new URL(path,self.registration.scope).pathname===new URL(event.request.url).pathname))await cache.put(event.request,response.clone());return response;}
    catch{const cached=await cache.match(event.request,{ignoreSearch:true});if(cached)return cached;if(event.request.mode==='navigate')return await cache.match('./index.html');return new Response('Ressource indisponible hors ligne',{status:503});}
  })());
});
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil((async()=>{const windows=await clients.matchAll({type:'window',includeUncontrolled:true});const app=windows.find(w=>w.url.startsWith(self.registration.scope));if(app)await app.focus();else await clients.openWindow(self.registration.scope);})());});
