
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
const Data=await import('../js/02_data.js');
let serial=0;
async function fixture({fail=false}={}){
  const dom=new JSDOM('<section id="syncCard"><div id="syncPanel"></div></section>',{url:'https://reset.example/'});
  globalThis.document=dom.window.document;globalThis.window=dom.window;globalThis.localStorage=dom.window.localStorage;globalThis.CustomEvent=dom.window.CustomEvent;
  Object.defineProperty(globalThis,'navigator',{value:{onLine:false},configurable:true});
  globalThis.location={replace:()=>{}};globalThis.confirm=()=>false;
  globalThis.setTimeout=()=>1;globalThis.clearTimeout=()=>{};globalThis.setInterval=()=>1;globalThis.clearInterval=()=>{};
  Data.restaurar(JSON.stringify({profile:{onboarded:true},movimientos:[{id:'old',tipo:'ingreso',monto:500,fecha:'2026-09-01T12:00:00Z'}],workSources:[],wallet:{saldo:500,sobres:[]},parametros:{},deudas:[{id:'debt',saldo:100,montoCuota:100}]}));
  const old=structuredClone(Data.getState());let cloud={state:old,revision:7},writes=0,stateAtWrite=null;
  globalThis.__resetSDK={doc:(_db,...path)=>{assert.equal(path.join('/'),'users/alice/budget/state');return{};},onAuthStateChanged:(_a,callback)=>callback({uid:'alice'}),runTransaction:async(_db,fn)=>{
    if(fail)throw new Error('Network failure');
    let staged=null;const result=await fn({get:async()=>({exists:()=>true,data:()=>structuredClone(cloud)}),set:(_ref,payload)=>{stateAtWrite=structuredClone(Data.getState());staged=structuredClone(payload);}});
    if(staged){cloud=staged;writes++;}return result;
  }};
  let source=await readFile(new URL('../js/07_sync.js',import.meta.url),'utf8');
  source=source.replace(/from '(\.\/[^']+)'/g,(_all,path)=>`from '${new URL(path,new URL('../js/07_sync.js',import.meta.url)).href}'`);
  const start=source.indexOf('async function loadFirebase()'),end=source.indexOf('\nasync function signIn',start);
  source=source.slice(0,start)+'async function loadFirebase(){firebase=globalThis.__resetSDK;auth={};db={};return firebase;}'+source.slice(end);
  source+='\n// reset fixture '+serial++;
  const Sync=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  await Sync.initSync();
  return {Sync,old,cloud:()=>cloud,writes:()=>writes,stateAtWrite:()=>stateAtWrite};
}
test('reset writes zero cloud state before erasing local data and removes its button',async()=>{
  const f=await fixture();navigator.onLine=true;
  localStorage.setItem('presupuesto_local_backup_alice','old');localStorage.setItem('presupuesto_local_backup_bob','keep');
  await f.Sync.resetBudgetOnce();
  assert.equal(f.writes(),1);assert.equal(f.stateAtWrite().movimientos.length,1);
  assert.equal(f.cloud().revision,8);assert.ok(f.cloud().oneTimeResetUsedAt);
  assert.equal(Data.getState().wallet.saldo,0);assert.equal(Data.getState().profile.onboarded,false);
  for(const key of ['movimientos','turnos','deudas','workSources','assets','ingresosFijos','gastosFijosMensuales','cargasCombustible'])assert.equal(Data.getState()[key].length,0,key);
  assert.equal(document.getElementById('btnResetOnce'),null);
  assert.equal(localStorage.getItem('presupuesto_local_backup_alice'),null);assert.equal(localStorage.getItem('presupuesto_local_backup_bob'),'keep');
});
test('offline reset and failed transaction preserve the complete local budget',async()=>{
  let f=await fixture();await assert.rejects(f.Sync.resetBudgetOnce(),/internet/);assert.deepEqual(Data.getState(),f.old);assert.equal(f.writes(),0);
  f=await fixture({fail:true});navigator.onLine=true;await assert.rejects(f.Sync.resetBudgetOnce(),/Network failure/);assert.deepEqual(Data.getState(),f.old);assert.equal(f.writes(),0);
});
test('a second reset is rejected by the cloud marker, even after restoring an old backup',async()=>{
  const f=await fixture();navigator.onLine=true;await f.Sync.resetBudgetOnce();Data.restaurar(JSON.stringify(f.old));
  await assert.rejects(f.Sync.resetBudgetOnce(),/ya se utilizó/);assert.equal(f.writes(),1);assert.equal(Data.getState().movimientos.length,1);
});
test('ordinary writes preserve the one-use marker after reconfiguration',async()=>{
  const f=await fixture();navigator.onLine=true;await f.Sync.resetBudgetOnce();const marker=f.cloud().oneTimeResetUsedAt;
  Data.getState().profile.onboarded=true;Data.getState().movimientos.push({id:'new',tipo:'ingreso',monto:10,fecha:'2026-09-30T12:00:00Z'});
  await f.Sync.syncNow();assert.equal(f.writes(),2);assert.equal(f.cloud().oneTimeResetUsedAt,marker);assert.equal(f.cloud().state.resetGeneration,marker);
});
test('a stale local budget is replaced by the reset cloud state instead of resurrecting records',async()=>{
  const f=await fixture();navigator.onLine=true;await f.Sync.resetBudgetOnce();Data.restaurar(JSON.stringify(f.old));
  await f.Sync.syncNow({forceLocal:true});assert.equal(f.writes(),1);assert.equal(Data.getState().wallet.saldo,0);assert.equal(Data.getState().movimientos.length,0);
});
test('cancelling the confirmation performs no writes and retains local records',async()=>{
  const f=await fixture();navigator.onLine=true;document.getElementById('btnResetOnce').click();
  assert.equal(f.writes(),0);assert.deepEqual(Data.getState(),f.old);
});
