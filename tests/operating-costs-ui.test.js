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
const now=new Date('2026-10-01T12:00:00');
UI.initOperatingCostEvents(safe);
function set(key,value){input(key).value=value;input(key).dispatchEvent(new dom.window.Event('change'));}
function reset(){
  Data.restaurar(JSON.stringify({profile:{onboarded:true,transportMode:'none'},workSources:[{id:'gig',name:'Uber',compensation:'per_shift',active:true,status:'active'}],movimientos:[],turnos:[],wallet:{saldo:0,sobres:[]},parametros:{}}));Life.ensureFinancialLife();Data.saldoInicial(2223);
}
test.beforeEach(t=>{t.mock.timers.enable({apis:['Date'],now});reset();});
test('formulario y botón de pago crean Mottu semanal pendiente y registran el pago sin otra captura',()=>{
  document.getElementById('btnGastoOperativo').click();
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

const futureObligation=(date='2026-10-29')=>Costs.createOperatingObligation({name:'Renta de vehículo',amount:490,frequency:'weekly',nextDueDate:date,sourceId:'gig'});
function openPayment(){UI.renderOperatingCosts();document.querySelector('[data-operating-action="pay"]').click();}
const payments=()=>Data.getState().movimientos.filter(m=>m.operatingObligationId);

test('pagar un vencimiento dentro de cuatro semanas descuenta hoy y no ofrece cambiar la fecha del pago',()=>{
  futureObligation();openPayment();
  assert.equal(input('date'),null);assert.equal(document.querySelector('#modalBody input[type="date"]'),null);
  assert.match(document.getElementById('modalBody').textContent,/se registra hoy.*Cubre el vencimiento/s);
  document.getElementById('modalConfirm').click();
  assert.equal(Data.getState().wallet.saldo,1733);assert.equal(Life.financialPosition(now).cash,1733);
  assert.equal(payments()[0].fecha,now.toISOString());assert.equal(payments()[0].operatingDueDate,'2026-10-29');
  assert.equal(Costs.operatingUpcomingEvents({now}).some(e=>e.operatingPeriod===payments()[0].operatingPeriod),false);
});

test('cuatro semanas pagadas hoy descuentan los cuatro pagos hoy y conservan períodos distintos al recargar',()=>{
  futureObligation('2026-10-08');
  for(let i=0;i<4;i++){openPayment();document.getElementById('modalConfirm').click();}
  assert.deepEqual(payments().map(m=>m.operatingDueDate),['2026-10-08','2026-10-15','2026-10-22','2026-10-29']);
  assert.ok(payments().every(m=>m.fecha===now.toISOString()));assert.equal(new Set(payments().map(m=>m.operatingPeriod)).size,4);
  assert.equal(Data.getState().wallet.saldo,2223-4*490);assert.equal(Life.financialPosition(now).cash,2223-4*490);
  Data.loadData();Life.ensureFinancialLife();UI.renderOperatingCosts();
  assert.equal(payments().length,4);assert.equal(Data.getState().wallet.saldo,263);
  assert.equal(Costs.operatingUpcomingEvents({now})[0].dueDate.slice(0,10),'2026-11-05');
});

test('crear un primer vencimiento futuro ya pagado descuenta hoy y conserva la fecha cubierta',()=>{
  UI.showOperatingCostModal(safe);set('name','Renta de vehículo');set('amount','490');set('frequency','weekly');set('dueDate','2026-10-29');set('firstPayment','paid');
  assert.match(input('firstPayment').selectedOptions[0].textContent,/hoy/);
  assert.match(document.getElementById('modalBody').textContent,/descontará hoy, aunque el vencimiento sea futuro/);
  document.getElementById('modalConfirm').click();
  assert.equal(Data.getState().wallet.saldo,1733);assert.equal(payments()[0].fecha,now.toISOString());assert.equal(payments()[0].operatingDueDate,'2026-10-29');
});

test('un abono adelantado descuenta sólo lo pagado hoy y deja la diferencia en el mismo vencimiento',()=>{
  futureObligation();openPayment();set('amount','400');document.getElementById('modalConfirm').click();
  assert.equal(Data.getState().wallet.saldo,1823);assert.equal(Costs.operatingUpcomingEvents({now})[0].amount,90);
  openPayment();assert.equal(input('amount').value,'90');document.getElementById('modalConfirm').click();
  assert.equal(Data.getState().wallet.saldo,1733);assert.ok(payments().every(m=>m.fecha===now.toISOString()));
  assert.equal(new Set(payments().map(m=>m.operatingPeriod)).size,1);
});
