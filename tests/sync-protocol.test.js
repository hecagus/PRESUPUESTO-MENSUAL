import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
class Storage{data=new Map();getItem(k){return this.data.get(k)||null;}setItem(k,v){this.data.set(k,String(v));}}
globalThis.localStorage=new Storage();
Object.defineProperty(globalThis,'navigator',{value:{onLine:false},configurable:true});
globalThis.document={hidden:false,querySelector:()=>null,getElementById:()=>null,dispatchEvent:()=>{},addEventListener:()=>{}};
globalThis.window={addEventListener:()=>{}};
globalThis.CustomEvent=class{constructor(type,options){this.type=type;this.detail=options?.detail;}};
globalThis.setTimeout=()=>1;globalThis.clearTimeout=()=>{};globalThis.setInterval=()=>1;globalThis.clearInterval=()=>{};
const Data=await import('../js/02_data.js');
let serial=0;
async function fixture({remote=null,baseRevision=0,dirty=true,onGet=()=>{},retry=false}={}){
  localStorage.data.clear();navigator.onLine=false;
  Data.restaurar(JSON.stringify({profile:{onboarded:true},movimientos:[{id:'a',tipo:'ingreso',monto:100,fecha:'2026-09-01T12:00:00Z'}],wallet:{saldo:100,sobres:[]},parametros:{},workSources:[],turnos:[]}));
  const baseState=structuredClone(Data.getState());
  localStorage.setItem('presupuesto_sync_meta_v2_alice',JSON.stringify({baseRevision,dirty,baseState,lastSync:'2026-09-01'}));
  const staged=[];let cloud=remote,reads=0;
  globalThis.__firebase={doc:()=>({}),onAuthStateChanged:(_auth,cb)=>cb({uid:'alice'}),runTransaction:async(_db,fn)=>{
    const run=async()=>{let written=null;const result=await fn({get:async()=>{const snapshot=structuredClone(cloud);await onGet(++reads);return{exists:()=>snapshot!==null,data:()=>snapshot};},set:(_ref,value)=>{written=structuredClone(value);}});return {result,written};};
    let attempt=await run();if(retry){cloud={state:baseState,revision:baseRevision+1};attempt=await run();}
    if(attempt.written){cloud=attempt.written;staged.push(cloud);}return attempt.result;
  }};
  let source=await readFile(new URL('../js/07_sync.js',import.meta.url),'utf8');
  source=source.replace(/from '(\.\/[^']+)'/g,(_all,path)=>`from '${new URL(path,new URL('../js/07_sync.js',import.meta.url)).href}'`);
  const start=source.indexOf('async function loadFirebase()'),end=source.indexOf('\nasync function signIn',start);
  source=source.slice(0,start)+'async function loadFirebase(){firebase=globalThis.__firebase;auth={};db={};return firebase;}'+source.slice(end);
  source+=`\nexport const inspect=()=>({meta,conflictRemote});export {resolveUseLocal,resolveMerge,activateUser};\n// fixture ${serial++}`;
  const Sync=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  await Sync.initSync();navigator.onLine=true;return {Sync,staged,baseState,cloud:()=>cloud};
}
test('an edit made while a push awaits Firestore stays pending and is sent next time',async()=>{
  const f=await fixture({onGet:n=>{if(n===1)Data.getState().movimientos[0].monto=200;}});
  await f.Sync.syncNow();assert.equal(f.staged[0].state.movimientos[0].monto,100);assert.equal(f.Sync.inspect().meta.dirty,true);
  await f.Sync.syncNow();assert.equal(f.staged[1].state.movimientos[0].monto,200);assert.equal(f.Sync.inspect().meta.dirty,false);
});
test('an edit during a pull becomes a conflict instead of being erased',async()=>{
  const f=await fixture({baseRevision:1,dirty:false,remote:{state:{profile:{onboarded:true},movimientos:[]},revision:2},onGet:()=>{Data.getState().movimientos[0].monto=200;}});
  await f.Sync.syncNow();assert.equal(Data.getState().movimientos[0].monto,200);assert.ok(f.Sync.inspect().conflictRemote);assert.equal(f.staged.length,0);
});
test('a cloud update during transaction retry blocks even a confirmed local overwrite',async()=>{
  const f=await fixture({baseRevision:1,retry:true});await f.Sync.syncNow({forceLocal:true});
  assert.ok(f.Sync.inspect().conflictRemote);assert.equal(f.staged.length,0);
});
test('unresolved merge cannot write to Firestore',async()=>{
  const f=await fixture({baseRevision:1,remote:{state:{profile:{onboarded:true},movimientos:[{id:'a',tipo:'ingreso',monto:300,fecha:'2026-09-01T12:00:00Z'}]},revision:2}});
  Data.getState().movimientos[0].monto=200;await f.Sync.syncNow();await f.Sync.resolveMerge();
  assert.equal(f.staged.length,0);assert.equal(Data.getState().movimientos[0].monto,200);assert.ok(f.Sync.inspect().conflictRemote);
});

test('switching Google users isolates local budgets and preserves unsynced data',async()=>{
  const f=await fixture({dirty:false});Data.getState().movimientos[0].monto=250;
  f.Sync.activateUser({uid:'bob'});assert.equal(Data.getState().movimientos.length,0);
  assert.equal(f.Sync.inspect().meta.baseRevision,0);assert.ok(localStorage.getItem('presupuesto_local_backup_alice'));
  Data.getState().movimientos.push({id:'bob-only',tipo:'ingreso',monto:20});
  f.Sync.activateUser({uid:'alice'});assert.equal(Data.getState().movimientos[0].monto,250);assert.equal(f.Sync.inspect().meta.dirty,true);
  assert.ok(localStorage.getItem('presupuesto_local_backup_bob'));
});
