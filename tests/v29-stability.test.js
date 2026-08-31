import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { rendimientoCombustible, gastosOperativosRecientes } from '../js/04_charts.js';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('rendimiento de gasolina usa kilómetros entre cargas y litros de la carga actual',()=>{
  const store={cargasCombustible:[
    {id:'a',fecha:'2026-08-01T12:00:00',km:1000,litros:5,costo:120},
    {id:'b',fecha:'2026-08-10T12:00:00',km:1100,litros:4,costo:100},
    {id:'c',fecha:'2026-08-20T12:00:00',km:1220,litros:5,costo:125}
  ]};
  const r=rendimientoCombustible(store);
  assert.equal(r.segments.length,2);
  assert.equal(r.last.km,120);
  assert.equal(r.last.kmL,24);
  assert.equal(Math.round(r.avgKmL*10)/10,24.4);
  assert.equal(Math.round(r.last.costoKm*100)/100,1.04);
});

test('costos operativos recientes no mezclan Hogar, deuda ni gasolina',()=>{
  const store={movimientos:[
    {id:'op',fecha:'2026-08-31T12:00:00',tipo:'gasto',desc:'Aceite',monto:150,categoria:'Mantenimiento',affectsPersonal:true,tags:['operational']},
    {id:'home',fecha:'2026-08-31T11:00:00',tipo:'gasto',desc:'Despensa',monto:650,categoria:'Alimentación',affectsPersonal:true,householdExpenseId:'h1'},
    {id:'debt',fecha:'2026-08-31T10:00:00',tipo:'gasto',desc:'Abono',monto:480,categoria:'Deuda',affectsPersonal:true,debtId:'d1'},
    {id:'fuel',fecha:'2026-08-31T09:00:00',tipo:'gasto',desc:'⛽ Combustible',monto:120,categoria:'Transporte',affectsPersonal:true}
  ]};
  const rows=gastosOperativosRecientes(store);
  assert.deepEqual(rows.map(x=>x.id),['op']);
});

test('Actividad queda enfocada en trabajo y recupera gastos/rendimiento',async()=>{
  const html=await read('admin.html'),init=await read('js/05_init.js'),insights=await read('js/25_activity_insights.js');
  assert.match(html,/id="fuelEfficiencySummary"/);
  assert.match(html,/id="operationalExpenseRows"/);
  assert.match(html,/id="activityPerformanceZone"/);
  assert.doesNotMatch(html,/id="valSaldoAdmin"/);
  assert.doesNotMatch(html,/id="metaDiariaValor"/);
  assert.doesNotMatch(html,/id="appInstallCard"/);
  assert.match(init,/recordUniversalMovement/);
  assert.match(init,/tags:\['operational'\]/);
  assert.doesNotMatch(init,/function operationalExpenseModal\([\s\S]*?Frecuencia[\s\S]*?\n\}/);
  assert.match(insights,/rendimientoCombustible/);
  assert.match(insights,/gastosOperativosRecientes/);
});

test('PWA captura el prompt temprano y centraliza instalación en Panel',async()=>{
  const html=await read('index.html'),bootstrap=await read('js/pwa-bootstrap.js'),pwa=await read('js/08_pwa.js'),manifest=JSON.parse(await read('manifest.webmanifest')),admin=await read('admin.html');
  assert.match(html,/pwa-bootstrap\.js/);
  assert.match(html,/id="appInstallCard"/);
  assert.match(html,/id="installStatus"/);
  assert.match(bootstrap,/beforeinstallprompt/);
  assert.match(pwa,/window\.__hecagusInstallPrompt/);
  assert.match(pwa,/register\('\/sw\.js',\{scope:'\/'\}\)/);
  assert.equal(manifest.id,'/index.html');
  assert.equal(manifest.start_url,'/index.html');
  assert.equal(manifest.scope,'/');
  assert.ok(manifest.icons.some(x=>x.purpose==='any'));
  assert.ok(manifest.icons.some(x=>x.purpose==='maskable'));
  assert.doesNotMatch(admin,/id="appInstallCard"/);
});
