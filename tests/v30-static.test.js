import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access, readdir } from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('todas las pantallas cargan el bootstrap PWA antes del motor',async()=>{
  for(const page of ['index.html','onboarding.html','admin.html','home.html','wallet.html','stats.html','historial.html','calendar.html']){
    const html=await read(page);assert.match(html,/pwa-bootstrap\.js/,page);assert.match(html,/manifest\.webmanifest/,page);
  }
});

test('navegación principal se genera desde un único renderer',async()=>{
  for(const page of ['index.html','admin.html','home.html','wallet.html','stats.html','historial.html','calendar.html']){
    const html=await read(page);assert.match(html,/<nav class="bottom-nav"[^>]*><\/nav>/,page);
  }
  const init=await read('js/05_init.js');assert.match(init,/function renderBottomNav/);assert.match(init,/\['home','home\.html','⌂','Hogar'\]/);
});

test('Calendario es vista y no vuelve a crear compromisos paralelos',async()=>{
  const html=await read('calendar.html');
  assert.doesNotMatch(html,/id="btnNewCommitment"/);assert.doesNotMatch(html,/Compromisos recurrentes/);assert.doesNotMatch(html,/Presupuesto variable del mes/);
  assert.match(html,/Los gastos de vida se administran en Hogar/);
});

test('sincronización fusiona también la semántica de Hogar',async()=>{
  const sync=await read('js/07_sync.js');assert.match(sync,/householdKinds:\{\.\.\.\(remote\?\.financialPlan\?\.householdKinds/);assert.match(sync,/1800/);
});

test('v3 mantiene storage histórico y eleva esquema sin borrar datos',async()=>{
  const constants=await read('js/01_consts_utils.js'),pkg=JSON.parse(await read('package.json'));
  assert.match(constants,/APP_VERSION = '3\.0\.0'/);assert.match(constants,/STORAGE_KEY = 'moto_finanzas_vFinal'/);assert.match(constants,/SCHEMA_VERSION = 30/);assert.equal(pkg.version,'3.0.0');
});

test('onboarding no contiene el falso botón Comprobar instalación',async()=>{
  const onboarding=await read('onboarding.html'),index=await read('index.html'),pwa=await read('js/08_pwa.js');
  assert.doesNotMatch(onboarding,/id="btnInstallApp"/);assert.doesNotMatch(onboarding,/Comprobar instalación/);
  assert.match(index,/id="btnInstallApp"[^>]*hidden/);assert.doesNotMatch(pwa,/Comprobar instalación/);
});

test('el shell PWA no referencia archivos inexistentes',async()=>{
  const sw=await read('sw.js'),match=sw.match(/const APP_SHELL=\[([\s\S]*?)\];/);assert.ok(match,'No se encontró APP_SHELL');
  const resources=[...match[1].matchAll(/['"]([^'"]+)['"]/g)].map(x=>x[1]);
  assert.ok(resources.length>10);
  for(const resource of resources){
    if(resource==='/')continue;
    const path=resource.replace(/^\//,'');
    await assert.doesNotReject(()=>access(new URL(`../${path}`,import.meta.url)),`Falta recurso PWA: ${resource}`);
  }
});

test('todos los imports relativos de módulos JS apuntan a archivos existentes',async()=>{
  const dir=new URL('../js/',import.meta.url),files=(await readdir(dir)).filter(x=>x.endsWith('.js'));
  for(const file of files){
    const fileUrl=new URL(file,dir),source=await readFile(fileUrl,'utf8');
    const imports=[...source.matchAll(/(?:from\s*|import\s*\()\s*['"](\.[^'"]+)['"]/g)].map(x=>x[1]);
    for(const specifier of imports)await assert.doesNotReject(()=>access(new URL(specifier,fileUrl)),`${file} importa ${specifier}, pero no existe`);
  }
});
