import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
class Storage{
  data=new Map();fail=false;
  getItem(key){return this.data.get(key)??null;}
  setItem(key,value){if(this.fail)throw new Error('QUOTA_EXCEEDED');this.data.set(key,String(value));}
}
const dom=new JSDOM(await readFile(new URL('../admin.html',import.meta.url),'utf8'),{url:'https://app.test/admin.html'});
globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.Option=dom.window.Option;globalThis.localStorage=new Storage();
const Data=await import('../js/02_data.js');
const Life=await import('../js/21_financial_life_v27.js');
const Accounts=await import('../js/15_accounts_engine.js');
const Costs=await import('../js/domain/operating-costs.js');
const UI=await import('../js/ui/operating-costs.js');
const {STORAGE_KEY}=await import('../js/01_consts_utils.js');
const now=new Date('2030-03-07T12:00:00');
let safeCalls=0;
UI.initOperatingCostEvents(action=>{safeCalls++;return Data.withTransaction(action);});
const upcoming=()=>Costs.operatingUpcomingEvents({days:30,now});
const make=()=>Costs.createOperatingObligation({name:'Arrendamiento sintético',amount:120,frequency:'weekly',nextDueDate:'2030-03-07',category:'Renta',sourceId:'work'});
const input=()=>document.querySelector('#modalBody [data-k="amount"]');
function openCorrection(){UI.renderOperatingCosts(now);document.querySelector('[data-operating-action="edit-amount"]').click();}
test.beforeEach(t=>{
  t.mock.timers.enable({apis:['Date'],now});localStorage.fail=false;safeCalls=0;
  Data.restaurar(JSON.stringify({profile:{onboarded:true,transportMode:'none'},workSources:[{id:'work',name:'Trabajo de prueba',compensation:'per_shift',active:true,status:'active'}],movimientos:[],turnos:[],accounts:[],wallet:{saldo:0,sobres:[]},parametros:{}}));
  Life.ensureFinancialLife();Data.saldoInicial(1000);
});

test('corregir el importe conserva pagos completos, abonos, coberturas y saldo; sólo los vencimientos sin pago usan el nuevo importe',()=>{
  const item=make(),events=upcoming(),partial=events[0].operatingPeriod,complete=events[1].operatingPeriod,unpaid=events[2].operatingPeriod;
  Costs.payOperatingObligation(item.id,{period:partial,amount:40,date:now});
  Costs.payOperatingObligation(item.id,{period:complete,amount:120,date:now});
  const before=structuredClone(Data.getState()),result=Costs.updateOperatingObligationAmount(item.id,100);
  const expected=structuredClone(before);expected.financialPlan.operatingObligations[0].amount=100;
  assert.equal(result.id,item.id);assert.deepEqual(Data.getState(),expected);
  assert.deepEqual(Data.getState().movimientos,before.movimientos);
  assert.equal(Data.getState().wallet.saldo,840);assert.equal(Accounts.personalCashTotal(now),840);
  assert.equal(upcoming().find(event=>event.operatingPeriod===partial).amount,80);
  assert.equal(upcoming().some(event=>event.operatingPeriod===complete),false);
  assert.equal(upcoming().find(event=>event.operatingPeriod===unpaid).amount,100);
  assert.equal(Data.getState().movimientos.find(m=>m.operatingPeriod===partial).operatingExpectedAmount,120);
  Data.loadData();Life.ensureFinancialLife();
  assert.equal(Costs.operatingObligationById(item.id).amount,100);assert.deepEqual(Data.getState().movimientos,before.movimientos);
  Costs.payOperatingObligation(item.id,{period:partial,amount:80,date:now});
  assert.equal(upcoming().some(event=>event.operatingPeriod===partial),false);
  assert.equal(Data.getState().movimientos.at(-1).operatingExpectedAmount,120);
});

test('corregir una obligación sin pagos conserva su calendario y no crea movimientos de dinero',()=>{
  const item=make(),before=structuredClone(Data.getState()),dates=upcoming().map(event=>[event.id,event.dueDate,event.operatingPeriod]);
  Costs.updateOperatingObligationAmount(item.id,'100');
  assert.deepEqual(Costs.operatingObligationById(item.id),{...before.financialPlan.operatingObligations[0],amount:100});
  assert.deepEqual(upcoming().map(event=>[event.id,event.dueDate,event.operatingPeriod]),dates);
  assert.ok(upcoming().every(event=>event.amount===100));assert.deepEqual(Data.getState().movimientos,before.movimientos);
  assert.equal(Data.getState().wallet.saldo,before.wallet.saldo);
});

test('importes inválidos y obligaciones inexistentes no cambian el estado ni el respaldo',()=>{
  const item=make(),before=structuredClone(Data.getState()),stored=localStorage.getItem(STORAGE_KEY);
  for(const amount of [0,-10,'',NaN,Infinity,'inválido'])assert.throws(()=>Costs.updateOperatingObligationAmount(item.id,amount),/MONTO_INVALIDO/);
  assert.throws(()=>Costs.updateOperatingObligationAmount('missing',100),/COSTO_OPERATIVO_NO_ENCONTRADO/);
  assert.deepEqual(Data.getState(),before);assert.equal(localStorage.getItem(STORAGE_KEY),stored);
});

test('si falla el guardado, la transacción restaura el importe anterior y conserva el respaldo',()=>{
  const item=make(),before=structuredClone(Data.getState()),stored=localStorage.getItem(STORAGE_KEY);
  localStorage.fail=true;
  assert.throws(()=>Costs.updateOperatingObligationAmount(item.id,100),/QUOTA_EXCEEDED/);
  localStorage.fail=false;
  assert.deepEqual(Data.getState(),before);assert.equal(localStorage.getItem(STORAGE_KEY),stored);
});

test('el modal precarga el importe y explica la conservación de pagos; cancelar no cambia datos',()=>{
  make();const before=structuredClone(Data.getState());openCorrection();
  assert.equal(input().value,'120');assert.match(document.getElementById('modalTitle').textContent,/Corregir importe/);
  const text=document.getElementById('modalBody').textContent;
  assert.match(text,/vencimientos sin pagos registrados/);assert.match(text,/pagos previos quedarán intactos/);
  assert.match(text,/importes, fechas y períodos cubiertos/);assert.match(text,/no registra un pago ni modifica tu saldo/);
  input().value='100';document.getElementById('modalCancel').click();
  assert.deepEqual(Data.getState(),before);assert.equal(safeCalls,0);
});

test('guardar desde el modal usa safe y actualiza el importe sin cobrar ni reescribir abonos',()=>{
  const item=make(),period=upcoming()[0].operatingPeriod;Costs.payOperatingObligation(item.id,{period,amount:40,date:now});
  const payments=structuredClone(Data.getState().movimientos),cash=Data.getState().wallet.saldo;
  openCorrection();input().value='100';document.getElementById('modalConfirm').click();
  assert.equal(safeCalls,1);assert.equal(Costs.operatingObligationById(item.id).amount,100);
  assert.deepEqual(Data.getState().movimientos,payments);assert.equal(Data.getState().wallet.saldo,cash);
  assert.equal(document.getElementById('appModal').style.display,'none');
  assert.equal(upcoming()[0].amount,80);assert.equal(upcoming()[1].amount,100);
});
