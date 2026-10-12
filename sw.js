// Service worker: permite instalar o app e abrir a "casca" mesmo com internet fraca. Dados vêm sempre do Supabase.
const V='presidente-v4',F=['./','index.html','css/style.css','js/ui.js','js/supabase.js','js/app.js','manifest.webmanifest','assets/icones/icon-192.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(V).then(c=>c.addAll(F)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!=V).map(x=>caches.delete(x)))).then(()=>clients.claim())));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!='GET'||u.origin!=location.origin)return;
 e.respondWith(fetch(e.request).then(r=>{const c=r.clone();caches.open(V).then(x=>x.put(e.request,c));return r}).catch(()=>caches.match(e.request)))});
