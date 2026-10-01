import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
const dom=new JSDOM(await readFile(new URL('../admin.html',import.meta.url),'utf8'),{url:'https://app.test/admin.html'});
globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.localStorage=dom.window.localStorage;globalThis.Option=dom.window.Option;globalThis.confirm=()=>true;
const Data=await import('../js/02_data.js');
const Life=await import('../js/21_financial_life_v27.js');
const Costs=await import('../js/domain/operating-costs.js');
const UI=await import('../js/ui/operating-costs.js');
const safe=fn=>fn();
const input=key=>document.querySelector(`#modalBody [data-k="${key}"]`);
function set(key,value){input(key).value=value;input(key).dispatchEvent(new dom.window.Event('change'));}
function reset(){
  Data.restaurar(JSON.stringify({profile:{onboarded:true,transportMode:'none'},workSources:[{id:'gig',name:'Uber',compensation:'per_shift',active:true,status:'active'}],movimientos:[],turnos:[],wallet:{saldo:0,sobres:[]},parametros:{}}));Life.ensureFinancialLife();Data.saldoInicial(2223);
}
test.beforeEach(reset);
test('formulario y botón de pago crean Mottu semanal pendiente y registran el pago sin otra captura',()=>{
  UI.initOperatingCostEvents(safe);document.getElementById('btnGastoOperativo').click();
  assert.equal(input('frequency').value,'one_time');assert.equal(input('dueDate').parentElement.hidden,true);
  set('frequency','weekly');assert.equal(input('dueDate').parentElement.hidden,false);assert.equal(input('firstPayment').value,'pending');
  set('name','Mottu');set('amount','490');set('category','Renta');set('dueDate',Costs.localDay(new Date()));
  document.getElementById('modalConfirm').click();assert.equal(Data.getState().wallet.saldo,2223);assert.equal(Costs.operatingObligations().length,1);
  UI.renderOperatingCosts();const box=document.getElementById('operatingObligationRows');assert.match(box.textContent,/Mottu.*Semanal/s);assert.match(box.textContent,/490/);
  box.querySelector('[data-operating-action="pay"]').click();assert.equal(input('amount').value,'490');set('amount','400');document.getElementById('modalConfirm').click();
  assert.equal(Data.getState().wallet.saldo,1823);UI.renderOperatingCosts();assert.match(box.textContent,/Pendiente:.*90/s);
});
test('una sola vez conserva el comportamiento anterior y no crea una programación',()=>{
  UI.showOperatingCostModal(safe);set('name','Aceite');set('amount','100');set('category','Mantenimiento');document.getElementById('modalConfirm').click();
  assert.equal(Costs.operatingObligations().length,0);assert.equal(Data.getState().wallet.saldo,2123);assert.ok(Data.getState().movimientos.at(-1).tags.includes('operational'));
});
