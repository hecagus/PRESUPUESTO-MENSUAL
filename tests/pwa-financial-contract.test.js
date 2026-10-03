import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const code=await readFile(new URL('../sw.js',import.meta.url),'utf8');
const origin='https://app.test',key=value=>new URL(typeof value==='string'?value:value.url,origin).href;
function serviceWorker({failPath=null}={}){
  const stores=new Map([['hecagus-finance-3.1.6-shell-v15-fuel-payment',new Map()]]),listeners={},control={online:true,waiting:0,claimed:0};
  const caches={open:async name=>{
    if(!stores.has(name))stores.set(name,new Map());const store=stores.get(name);
    return {put:async(request,response)=>store.set(key(request),response),match:async request=>store.get(key(request))?.clone()};
  },keys:async()=>[...stores.keys()],delete:async name=>stores.delete(name),match:async request=>{
    for(const store of stores.values())if(store.has(key(request)))return store.get(key(request)).clone();
  }};
  class LocalRequest extends Request{constructor(value,options){super(key(value),options);}}
  const self={location:{origin},addEventListener:(event,fn)=>listeners[event]=fn,skipWaiting:async()=>control.waiting++,clients:{claim:async()=>control.claimed++}};
  vm.runInNewContext(code,{self,caches,Request:LocalRequest,Response,URL,console:{warn:()=>{}},fetch:async request=>{
    const path=new URL(request.url).pathname;if(!control.online||path===failPath)throw new Error('offline');
    const bytes=await readFile(new URL(`..${path==='/'?'/index.html':path}`,import.meta.url));return new Response(bytes,{status:200});
  }});
  const install=()=>{let promise;listeners.install({waitUntil:p=>promise=p});return promise;};
  const activate=()=>{let promise;listeners.activate({waitUntil:p=>promise=p});return promise;};
  const offlineResponse=(path,mode='same-origin')=>{let promise;listeners.fetch({request:{url:origin+path,method:'GET',mode},respondWith:p=>promise=p});return promise;};
  return {control,stores,install,activate,offlineResponse};
}
test('actualización precarga páginas y módulos nuevos, conserva rutas offline y retira el caché anterior',async()=>{
  const sw=serviceWorker();await sw.install();assert.equal(sw.control.waiting,1);await sw.activate();assert.equal(sw.control.claimed,1);
  assert.equal(sw.stores.has('hecagus-finance-3.1.6-shell-v15-fuel-payment'),false);sw.control.online=false;
  for(const path of ['/index.html','/home.html','/admin.html','/wallet.html','/historial.html','/calendar.html','/stats.html','/onboarding.html','/offline.html']){
    const response=await sw.offlineResponse(path,'navigate');assert.equal(response.status,200);assert.ok((await response.text()).includes('<html'),path);
  }
  for(const path of ['/js/app/financial-context.js','/js/app/financial-options.js','/js/ui/source-payments.js','/js/domain/financial-rules.js']){
    const response=await sw.offlineResponse(path);assert.equal(response.status,200);assert.match(await response.text(),/export|import/);
  }
});
test('una actualización incompleta no sustituye al worker instalado ni borra su caché',async()=>{
  const sw=serviceWorker({failPath:'/js/app/financial-context.js'});
  await assert.rejects(sw.install(),/PWA shell incompleto/);assert.equal(sw.control.waiting,0);assert.equal(sw.control.claimed,0);
  assert.ok(sw.stores.has('hecagus-finance-3.1.6-shell-v15-fuel-payment'));
});
test('el shell contiene todo el grafo de imports relativo, incluyendo subdirectorios',async()=>{
  const paths=new Set([...code.match(/const APP_SHELL=\[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map(m=>m[1]));
  for(const path of paths){
    if(!path.endsWith('.js'))continue;
    const source=await readFile(new URL(`..${path}`,import.meta.url),'utf8');
    for(const match of source.matchAll(/(?:from\s+|import\s*\()(['"])(\.[^'"]+)\1/g)){
      const dependency=new URL(match[2],origin+path).pathname;assert.ok(paths.has(dependency),`${path} necesita ${dependency} offline`);
    }
  }
});
