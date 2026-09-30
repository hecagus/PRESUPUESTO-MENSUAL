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
