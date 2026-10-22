import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
const dom=new JSDOM('<section id="syncCard"><div id="syncPanel"></div></section>',{url:'https://audit.example/'});
globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.localStorage=dom.window.localStorage;globalThis.CustomEvent=dom.window.CustomEvent;
Object.defineProperty(globalThis,'navigator',{value:{onLine:false},configurable:true});
globalThis.setTimeout=()=>1;globalThis.clearTimeout=()=>{};globalThis.setInterval=()=>1;globalThis.clearInterval=()=>{};
const Data=await import('../js/02_data.js');
test('conflict UI renders safe values and writes only after every incompatible field is selected',async()=>{
  Data.restaurar(JSON.stringify({profile:{onboarded:true},movimientos:[{id:'a',tipo:'ingreso',monto:100,desc:'Original',fecha:'2026-09-01T12:00:00Z'}],workSources:[],turnos:[],wallet:{saldo:100,sobres:[]},parametros:{}}));
  const base=structuredClone(Data.getState()),remote=structuredClone(base);remote.movimientos[0].monto=300;remote.movimientos[0].desc='<img src=x onerror=alert(1)>';
  localStorage.setItem('presupuesto_sync_meta_v2_alice',JSON.stringify({baseRevision:1,baseState:base,dirty:true,lastSync:'2026-09-01'}));
  let cloud={state:remote,revision:2},writes=0;
  globalThis.__sdk={doc:()=>({}),onAuthStateChanged:(_a,cb)=>cb({uid:'alice'}),runTransaction:async(_db,fn)=>fn({get:async()=>({exists:()=>true,data:()=>cloud}),set:(_ref,value)=>{cloud=structuredClone(value);writes++;}})};
  let source=await readFile(new URL('../js/07_sync.js',import.meta.url),'utf8');
  source=source.replace(/from '(\.\/[^']+)'/g,(_all,path)=>`from '${new URL(path,new URL('../js/07_sync.js',import.meta.url)).href}'`);
  const start=source.indexOf('async function loadFirebase()'),end=source.indexOf('\nasync function signIn',start);
  source=source.slice(0,start)+'async function loadFirebase(){firebase=globalThis.__sdk;auth={};db={};return firebase;}'+source.slice(end)+'\nexport {resolveMerge};';
  const Sync=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  await Sync.initSync();Data.getState().movimientos[0].monto=200;Data.getState().movimientos[0].desc='Local';navigator.onLine=true;
  await Sync.syncNow();assert.equal(document.querySelectorAll('#syncPanel select').length,2);assert.equal(document.querySelectorAll('#syncPanel img').length,0);
  await Sync.resolveMerge();assert.equal(writes,0);
  for(const select of document.querySelectorAll('#syncPanel select')){select.value='remote';select.dispatchEvent(new dom.window.Event('change'));}
  await Sync.resolveMerge();assert.equal(writes,1);assert.equal(Data.getState().movimientos[0].monto,300);
  assert.equal(document.getElementById('syncCard').classList.contains('hidden'),true);
});

test('pagos concurrentes de un período requieren elegir una versión o confirmar ambos antes de escribir',async()=>{
  navigator.onLine=false;
  Data.restaurar(JSON.stringify({...Data.createEmptyState(),profile:{onboarded:true},workSources:[],movimientos:[{id:'opening',tipo:'ingreso',monto:10000,categoria:'Sistema',fecha:'2026-09-01T12:00:00Z',accountId:'acct-personal',affectsPersonal:true}]}));
  const base=structuredClone(Data.getState()),remote=structuredClone(base);
  const payment={tipo:'gasto',monto:490,categoria:'Renta',fecha:'2026-09-30T12:00:00Z',accountId:'acct-personal',affectsPersonal:true,operatingObligationId:'vehicle',operatingPeriod:'D:2026-09-30',operatingExpectedAmount:490};
  remote.movimientos.push({...payment,id:'remote-payment'});
  localStorage.setItem('presupuesto_sync_meta_v2_bob',JSON.stringify({baseRevision:1,baseState:base,dirty:true,lastSync:'2026-09-01'}));
  let cloud={state:remote,revision:2},writes=0;
  globalThis.__sdk={doc:()=>({}),onAuthStateChanged:(_a,cb)=>cb({uid:'bob'}),runTransaction:async(_db,fn)=>fn({get:async()=>({exists:()=>true,data:()=>cloud}),set:(_ref,value)=>{cloud=structuredClone(value);writes++;}})};
  let source=await readFile(new URL('../js/07_sync.js',import.meta.url),'utf8');
  source=source.replace(/from '(\.\/[^']+)'/g,(_all,path)=>`from '${new URL(path,new URL('../js/07_sync.js',import.meta.url)).href}'`);
  const start=source.indexOf('async function loadFirebase()'),end=source.indexOf('\nasync function signIn',start);
  source=source.slice(0,start)+'async function loadFirebase(){firebase=globalThis.__sdk;auth={};db={};return firebase;}'+source.slice(end)+'\nexport {resolveMerge}; // financial period fixture';
  const Sync=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  await Sync.initSync();Data.getState().movimientos.push({...payment,id:'local-payment'});navigator.onLine=true;
  await Sync.syncNow();await Sync.resolveMerge();assert.equal(writes,0);
  const selects=[...document.querySelectorAll('#syncPanel select')];assert.equal(selects.length,1);
  assert.ok(selects[0].querySelector('option[value="both"]'));
  selects[0].value='both';selects[0].dispatchEvent(new dom.window.Event('change'));
  await Sync.resolveMerge();assert.equal(writes,1);
  assert.equal(cloud.state.movimientos.filter(m=>m.operatingObligationId==='vehicle').length,2);
  assert.equal(Data.getState().movimientos.filter(m=>m.operatingObligationId==='vehicle').length,2);
});

test('la UI impide fusionar reservas superiores al efectivo hasta liberar el exceso, sin borrar aportes',async()=>{
  navigator.onLine=false;localStorage.setItem('presupuesto_state_owner_v1','carol');
  Data.restaurar(JSON.stringify({...Data.createEmptyState(),profile:{onboarded:true},
    movimientos:[{id:'opening',tipo:'ingreso',monto:1000,categoria:'Sistema',fecha:'2026-09-01T12:00:00Z',accountId:'acct-personal',affectsPersonal:true}],
    savingsGoals:[{id:'g',name:'Meta',targetAmount:10000,reserved:0,history:[],active:true}]}));
  const base=structuredClone(Data.getState()),remote=structuredClone(base);
  remote.savingsGoals[0].reserved=700;remote.savingsGoals[0].history.push({id:'remote',type:'reserve',amount:700,fecha:'2026-09-02T12:00:00Z'});
  localStorage.setItem('presupuesto_sync_meta_v2_carol',JSON.stringify({baseRevision:1,baseState:base,dirty:true,lastSync:'2026-09-01'}));
  let cloud={state:remote,revision:2},writes=0;
  globalThis.__sdk={doc:()=>({}),onAuthStateChanged:(_a,cb)=>cb({uid:'carol'}),runTransaction:async(_db,fn)=>fn({get:async()=>({exists:()=>true,data:()=>cloud}),set:(_ref,value)=>{cloud=structuredClone(value);writes++;}})};
  let source=await readFile(new URL('../js/07_sync.js',import.meta.url),'utf8');
  source=source.replace(/from '(\.\/[^']+)'/g,(_all,path)=>`from '${new URL(path,new URL('../js/07_sync.js',import.meta.url)).href}'`);
  const start=source.indexOf('async function loadFirebase()'),end=source.indexOf('\nasync function signIn',start);
  source=source.slice(0,start)+'async function loadFirebase(){firebase=globalThis.__sdk;auth={};db={};return firebase;}'+source.slice(end)+'\nexport {resolveMerge}; // reservation capacity fixture';
  const Sync=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  await Sync.initSync();const goal=Data.getState().savingsGoals[0];goal.reserved=700;goal.history.push({id:'local',type:'reserve',amount:700,fecha:'2026-09-02T12:00:00Z'});navigator.onLine=true;
  await Sync.syncNow();await Sync.resolveMerge();assert.equal(writes,0);assert.match(document.getElementById('syncPanel').textContent,/reservas combinadas.*superan el efectivo/);
  goal.reserved=300;goal.history.push({id:'release',type:'release',amount:400,fecha:'2026-09-03T12:00:00Z'});
  await Sync.resolveMerge();await Sync.resolveMerge();assert.equal(writes,1);assert.equal(cloud.state.savingsGoals[0].reserved,1000);assert.equal(cloud.state.savingsGoals[0].history.length,3);
});
