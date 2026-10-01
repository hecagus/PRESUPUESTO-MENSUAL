import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access,readdir} from 'node:fs/promises';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';
import {renderBottomNav,renderMoneyNav} from '../js/app/navigation.js';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const pages=['index.html','home.html','admin.html','wallet.html','historial.html','calendar.html','stats.html','more.html','settings.html'];
test('every primary and legacy route has exactly five navigation entries and the correct active area',async()=>{
  for(const file of pages){
    const dom=new JSDOM(await read(file),{url:'https://app.example/'+file});
    globalThis.document=dom.window.document;globalThis.location=dom.window.location;
    renderBottomNav();renderMoneyNav();
    const nav=document.querySelector('.bottom-nav'),links=[...nav.querySelectorAll('a')];
    assert.deepEqual(links.map(a=>a.textContent.trim()),['⌂Inicio','▤Presupuesto','▶Actividad','◉Dinero','⋯Más']);
    assert.equal(nav.querySelectorAll('[aria-current="page"]').length,1);
    const expected=file==='historial.html'?'wallet.html':['calendar.html','stats.html','settings.html'].includes(file)?'more.html':file;
    assert.equal(nav.querySelector('[aria-current]').getAttribute('href'),expected);
    if(['wallet.html','historial.html'].includes(file))assert.deepEqual([...document.querySelectorAll('#moneyNav a')].map(a=>a.textContent),['Cuentas','Movimientos','Metas','Deudas']);
  }
});
test('secondary links and legacy routes target existing pages and real anchors',async()=>{
  for(const file of pages){
    const dom=new JSDOM(await read(file),{url:'https://app.example/'+file});
    globalThis.document=dom.window.document;globalThis.location=dom.window.location;
    renderBottomNav();renderMoneyNav();
    const ids=[...document.querySelectorAll('[id]')].map(x=>x.id);assert.equal(new Set(ids).size,ids.length,file);
    for(const link of document.querySelectorAll('a[href]')){
      const url=new URL(link.href);if(url.origin!=='https://app.example')continue;
      const target=url.pathname.slice(1);await access(new URL('../'+target,import.meta.url));
      if(url.hash){const targetDom=new JSDOM(await read(target));assert.ok(targetDom.window.document.getElementById(url.hash.slice(1)),link.href);}
    }
  }
  assert.match(await read('js/10_onboarding.js'),/if\(edit\)location\.replace\('settings\.html'\)/);
  assert.doesNotMatch(await read('settings.html'),/setup-step|setupBalance|10_onboarding\.js/);
});
test('controls are scoped to their domain and dashboard contains no complex capture forms',async()=>{
  const activity=new JSDOM(await read('admin.html')),money=new JSDOM(await read('wallet.html')),settings=new JSDOM(await read('settings.html')),dashboard=new JSDOM(await read('index.html'));
  for(const id of ['btnDeudaNueva','btnAbonoCuota','abonoDeudaSelect','debtList']){assert.ok(money.window.document.getElementById(id));assert.equal(activity.window.document.getElementById(id),null);}
  for(const id of ['btnExportJSON','btnRestoreBackup','syncCard','btnInstallApp']){assert.ok(settings.window.document.getElementById(id));assert.equal(activity.window.document.getElementById(id),null);assert.equal(dashboard.window.document.getElementById(id),null);}
  assert.equal(dashboard.window.document.querySelectorAll('form,input,select').length,0);
  assert.equal(activity.window.document.getElementById('btnGastoHogar'),null);
  assert.doesNotMatch(activity.window.document.body.textContent,/Admin|Administración/);
  assert.match((await read('home.html')),/Presupuesto/);
  assert.doesNotMatch(await read('calendar.html'),/data-platform-action|btnNewCommitment/);
});
test('all nested JavaScript imports and page scripts are resolvable',async()=>{
  const walk=async dir=>{
    for(const entry of await readdir(dir,{withFileTypes:true})){
      const url=new URL(entry.name+(entry.isDirectory()?'/':''),dir);
      if(entry.isDirectory()){await walk(url);continue;}
      if(!entry.name.endsWith('.js'))continue;
      const source=await readFile(url,'utf8');
      for(const match of source.matchAll(/(?:from\s*|import\s*\()\s*['"](\.[^'"]+)['"]/g))await access(new URL(match[1],url));
    }
  };
  await walk(new URL('../js/',import.meta.url));
  for(const page of pages)for(const match of (await read(page)).matchAll(/<script[^>]+src="([^"]+)"/g))await access(new URL('../'+match[1],import.meta.url));
});
test('service worker warms new and legacy routes, survives offline navigation and safely updates its cache',async()=>{
  const handlers={},buckets=new Map([['hecagus-finance-old',new Map()],['unrelated-cache',new Map()]]);let offline=false;
  const key=r=>new URL(typeof r==='string'?r:r.url,'https://app.example').href;
  const match=(map,r,opts={})=>{const target=key(r);for(const [url,response] of map){if(url===target||(opts.ignoreSearch&&new URL(url).pathname===new URL(target).pathname))return response.clone();}};
  const cache=name=>({put:async(r,response)=>buckets.get(name).set(key(r),response),match:async(r,opts)=>match(buckets.get(name),r,opts)});
  const caches={open:async name=>{if(!buckets.has(name))buckets.set(name,new Map());return cache(name);},keys:async()=>[...buckets.keys()],delete:async name=>buckets.delete(name),match:async(r,opts)=>{for(const map of buckets.values()){const hit=match(map,r,opts);if(hit)return hit;}}};
  class BrowserRequest{constructor(path){this.url=key(path);this.method='GET';this.mode='cors';}}
  const context={self:{location:{origin:'https://app.example'},addEventListener:(name,fn)=>{handlers[name]=fn;},skipWaiting:async()=>{},clients:{claim:async()=>{}}},caches,Request:BrowserRequest,Response,URL,console,fetch:async request=>{
    if(offline)throw new Error('Offline');
    const path=new URL(key(request)).pathname;return new Response(await read(path==='/'?'index.html':path.slice(1)));
  }};
  vm.runInNewContext(await read('sw.js'),context);
  let completion;handlers.install({waitUntil:promise=>{completion=promise;}});await completion;
  handlers.activate({waitUntil:promise=>{completion=promise;}});await completion;
  assert.equal(buckets.has('hecagus-finance-old'),false);assert.equal(buckets.has('unrelated-cache'),true);
  offline=true;
  for(const path of [...pages,'onboarding.html?edit=1']){
    let response;handlers.fetch({request:{url:'https://app.example/'+path,method:'GET',mode:'navigate'},respondWith:promise=>{response=promise;}});
    const body=await(await response).text();assert.equal(body,await read(path.split('?')[0]),path);
  }
  for(const path of ['js/app/navigation.js','js/pages/settings.js','js/ui/debt.js']){
    let response;handlers.fetch({request:{url:'https://app.example/'+path,method:'GET',mode:'cors'},respondWith:promise=>{response=promise;}});
    assert.equal(await(await response).text(),await read(path),path);
  }
});
