const CACHE='hecagus-finance-2.6.1-shell-v1';
const APP_SHELL=[
  './','./index.html','./onboarding.html','./admin.html','./wallet.html','./stats.html','./historial.html','./calendar.html','./offline.html',
  './style.css','./manifest.webmanifest','./hecagus-finance-192.png','./hecagus-finance-512.png',
  './js/01_consts_utils.js','./js/02_data.js','./js/03_render.js','./js/04_charts.js','./js/05_init.js','./js/06_income_ui.js','./js/07_sync.js','./js/08_pwa.js','./js/10_onboarding.js','./js/11_savings_goals.js','./js/12_savings_ui.js','./js/13_financial_life.js','./js/14_calendar_ui.js','./js/15_accounts_engine.js','./js/16_forecast_engine.js','./js/17_automation_engine.js','./js/18_health_goals.js','./js/19_platform_ui.js','./js/firebase-config.js'
];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(APP_SHELL)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});

self.addEventListener('fetch',event=>{
  const req=event.request;if(req.method!=='GET')return;
  const url=new URL(req.url);if(url.origin!==self.location.origin)return;
  if(req.mode==='navigate'){
    event.respondWith(fetch(req).then(res=>{const copy=res.clone();caches.open(CACHE).then(c=>c.put(req,copy));return res;}).catch(async()=>await caches.match(req)||await caches.match('./index.html')||await caches.match('./offline.html')));return;
  }
  const isAppCode=url.pathname.endsWith('.js')||url.pathname.endsWith('.webmanifest');
  if(isAppCode){event.respondWith(fetch(req).then(res=>{if(res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(req,copy));}return res;}).catch(()=>caches.match(req)));return;}
  event.respondWith(caches.match(req).then(hit=>hit||fetch(req).then(res=>{if(res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(req,copy));}return res;})));
});
