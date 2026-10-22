/* v3.1.7 - Shell requerido completo antes de activar; recursos no críticos toleran fallos. */
const CACHE='hecagus-finance-3.1.7-shell-v16-financial-contract';
const APP_SHELL=[
  '/','/index.html','/onboarding.html','/admin.html','/home.html','/wallet.html','/stats.html','/historial.html','/calendar.html','/offline.html',
  '/style.css','/manifest.webmanifest','/hecagus-finance-192.png','/hecagus-finance-512.png','/js/pwa-bootstrap.js',
  '/js/01_consts_utils.js','/js/02_data.js','/js/03_render.js','/js/04_charts.js','/js/05_init.js','/js/07_sync.js','/js/08_pwa.js','/js/10_onboarding.js',
  '/js/11_savings_goals.js','/js/12_savings_ui.js','/js/13_financial_life.js','/js/14_calendar_ui.js','/js/15_accounts_engine.js','/js/16_forecast_engine.js',
  '/js/17_automation_engine.js','/js/18_health_goals.js','/js/19_platform_ui.js','/js/20_home_engine.js','/js/21_financial_life_v27.js','/js/22_home_ui.js',
  '/js/23_home_semantics.js','/js/24_home_ui_v28.js','/js/25_activity_insights.js','/js/26_sync_merge.js','/js/27_legacy_migrations.js','/js/28_onboarding_living.js','/js/firebase-config.js',
  '/js/domain/financial-rules.js','/js/domain/operating-costs.js','/js/ui/operating-costs.js','/js/ui/fuel.js','/js/ui/source-payments.js','/js/app/financial-options.js','/js/app/financial-context.js'
];

async function warmShell(){
  const cache=await caches.open(CACHE);
  await Promise.allSettled(APP_SHELL.map(async path=>{
    try{
      const request=new Request(path,{cache:'reload'}),response=await fetch(request);
      if(response.ok)await cache.put(request,response.clone());
    }catch(error){console.warn('PWA shell omitió',path,error);}
  }));
  // Keep the previous worker active if a required page/module failed to load.
  // Activating a partial JS graph would break an installed app offline.
  for(const path of APP_SHELL.filter(p=>/\.(?:js|html)$/.test(p))){
    if(!await cache.match(path))throw new Error(`PWA shell incompleto: ${path}`);
  }
}

self.addEventListener('install',event=>{event.waitUntil(warmShell().then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('hecagus-finance-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});

async function networkFirst(request){
  const cache=await caches.open(CACHE);
  try{
    const response=await fetch(request,{cache:'no-store'});
    if(response.ok)await cache.put(request,response.clone());
    return response;
  }catch{
    return await cache.match(request)||await caches.match(request);
  }
}

self.addEventListener('fetch',event=>{
  const request=event.request;if(request.method!=='GET')return;
  const url=new URL(request.url);if(url.origin!==self.location.origin)return;
  if(request.mode==='navigate'){
    event.respondWith((async()=>{
      const response=await networkFirst(request);if(response)return response;
      return await caches.match('/index.html')||await caches.match('/offline.html')||Response.error();
    })());return;
  }
  const fresh=/\.(?:js|webmanifest)$/.test(url.pathname)||url.pathname==='/sw.js';
  if(fresh){event.respondWith(networkFirst(request).then(r=>r||Response.error()));return;}
  event.respondWith(caches.match(request).then(hit=>hit||fetch(request).then(async response=>{if(response.ok){const cache=await caches.open(CACHE);await cache.put(request,response.clone());}return response;})));
});
