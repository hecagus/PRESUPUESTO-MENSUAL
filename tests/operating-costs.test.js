import test from 'node:test';
import { historicalOpening } from './helpers/ledger.js';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
class Storage{data=new Map();getItem(k){return this.data.get(k)||null;}setItem(k,v){this.data.set(k,String(v));}}
globalThis.localStorage=new Storage();
const Data=await import('../js/02_data.js');
const Life=await import('../js/21_financial_life_v27.js');
const Costs=await import('../js/domain/operating-costs.js');
const Accounts=await import('../js/15_accounts_engine.js');
const Forecast=await import('../js/16_forecast_engine.js');
const {mergeStates}=await import('../js/26_sync_merge.js');
const now=new Date('2026-10-01T12:00:00');
const config={name:'Mottu',amount:490,frequency:'weekly',nextDueDate:'2026-10-01',category:'Renta',sourceId:'gig',accountId:'acct-personal'};
const upcoming=options=>Costs.operatingUpcomingEvents({now,days:30,...options});
const make=(patch={},options)=>Costs.createOperatingObligation({...config,...patch},options);
function reset(){
  Data.restaurar(JSON.stringify({profile:{onboarded:true,transportMode:'none'},workSources:[{id:'gig',name:'Uber',compensation:'per_shift',status:'active',active:true,transportMode:'none'}],movimientos:[],turnos:[],accounts:[],wallet:{saldo:0,sobres:[]},parametros:{},financialPlan:{householdExpenses:[],householdKinds:{},commitments:[],livingBudgets:{},householdSemanticsVersion:1,householdCanonicalMigrationVersion:3,householdDirectRepairVersion:1}}));
  Life.ensureFinancialLife();historicalOpening(Data,2223);
}
test.beforeEach(t=>{t.mock.timers.enable({apis:['Date'],now:new Date('2026-11-30T12:00:00')});reset();});

test('Mottu pendiente programa $490 cada jueves sin descontar efectivo ni crear Hogar',()=>{
  const item=make(),events=upcoming();
  assert.deepEqual(events.map(e=>Costs.localDay(new Date(e.dueDate))),['2026-10-01','2026-10-08','2026-10-15','2026-10-22','2026-10-29']);
  assert.ok(events.every(e=>e.amount===490&&e.operational&&e.sourceId==='gig'));
  assert.equal(Data.getState().wallet.saldo,2223);assert.equal(Data.getState().movimientos.length,1);
  assert.equal(Data.getState().financialPlan.householdExpenses.length,0);assert.equal(Data.getState().financialPlan.commitments.length,0);
  const pos=Life.financialPosition(now);assert.equal(pos.cash,2223);assert.equal(pos.committed,2450);assert.equal(pos.free,-227);
  assert.equal(Life.upcomingFinancialEvents({days:30,now}).filter(e=>e.refId===item.id).length,5);
});

test('cada pago real descuenta una sola vez, liquida su semana y conserva la siguiente',()=>{
  const item=make(),first=upcoming()[0];
  Costs.payOperatingObligation(item.id,{period:first.operatingPeriod,amount:490,date:now});
  assert.equal(Data.getState().wallet.saldo,1733);assert.equal(Accounts.personalCashTotal(),1733);
  assert.equal(upcoming().length,4);assert.equal(Costs.localDay(new Date(upcoming()[0].dueDate)),'2026-10-08');
  assert.throws(()=>Costs.payOperatingObligation(item.id,{period:first.operatingPeriod,amount:490,date:now}),/YA_PAGADO/);
  assert.equal(Data.getState().movimientos.filter(m=>m.operatingObligationId===item.id).length,1);
  assert.equal(Life.financialPosition(now).committed,1960);assert.equal(Life.financialPosition(now).free,-227);
  const forecast=Forecast.cashFlowForecast({days:30,now});assert.equal(forecast.totalExpectedOutflow,1960);assert.equal(forecast.endingCash,-227);
  assert.equal(Life.sourceCostProfile('gig',now).actualCosts,490);
});

test('primer pago ya realizado registra un movimiento y no vuelve a programar esa semana',()=>{
  const item=make({}, {paid:true,date:now});
  assert.equal(Data.getState().wallet.saldo,1733);assert.equal(upcoming().length,4);
  assert.equal(Data.getState().movimientos.filter(m=>m.operatingObligationId===item.id).length,1);
});

test('un abono de $400 conserva $90 pendientes y admite liquidarlos mañana',()=>{
  const item=make(),period=upcoming()[0].operatingPeriod;
  Costs.payOperatingObligation(item.id,{period,amount:400,date:now});
  assert.equal(upcoming()[0].amount,90);assert.equal(Life.financialPosition(now).committed,2050);assert.equal(Data.getState().wallet.saldo,1823);
  const tomorrow=new Date('2026-10-02T12:00:00');
  assert.equal(upcoming({now:tomorrow})[0].overdue,true);
  Costs.payOperatingObligation(item.id,{period,amount:90,date:tomorrow});
  assert.equal(upcoming({now:tomorrow})[0].amount,490);assert.equal(Data.getState().wallet.saldo,1733);
});

test('liquidar por menos requiere una elección explícita y conserva el importe habitual',()=>{
  const item=make(),period=upcoming()[0].operatingPeriod;
  Costs.payOperatingObligation(item.id,{period,amount:400,date:now,settled:true});
  assert.equal(Data.getState().wallet.saldo,1823);assert.equal(upcoming()[0].amount,490);assert.equal(item.amount,490);
  assert.equal(upcoming().length,4);
});

test('las semanas vencidas siguen pendientes aunque pase la ventana de dos semanas',()=>{
  make();const later=new Date('2026-11-12T12:00:00'),events=upcoming({now:later,days:0});
  assert.equal(events.filter(e=>e.overdue).length,6);assert.equal(events.length,7);
  assert.equal(events.reduce((sum,e)=>sum+e.amount,0),3430);
});

test('finalizar detiene vencimientos futuros y conserva pagos vencidos aunque la fuente se pause',()=>{
  const item=make();Data.getState().workSources[0].status='paused';Data.getState().workSources[0].active=false;
  assert.equal(upcoming().length,5);
  Costs.endOperatingObligation(item.id,new Date('2026-10-09T12:00:00'));
  Costs.endOperatingObligation(item.id,new Date('2026-10-20T12:00:00'));assert.equal(item.endedOn,'2026-10-10');
  const pending=upcoming({now:new Date('2026-10-20T12:00:00')});assert.equal(pending.length,2);assert.ok(pending.every(e=>e.overdue));
  Costs.payOperatingObligation(item.id,{period:pending[0].operatingPeriod,amount:490,date:new Date('2026-10-20T12:00:00')});
  assert.equal(upcoming({now:new Date('2026-10-20T12:00:00')}).length,1);
});

test('frecuencias comparten calendario, fin de mes y cambio de año con las obligaciones existentes',()=>{
  for(const [frequency,start,days,expected] of [
    ['daily','2026-10-01',3,['2026-10-01','2026-10-02','2026-10-03']],
    ['biweekly','2026-10-01',31,['2026-10-15','2026-10-31']],
    ['monthly','2026-10-31',93,['2026-10-31','2026-11-30','2026-12-31','2027-01-31']],
    ['bimonthly','2026-10-31',92,['2026-10-31','2026-12-31']],
    ['yearly','2026-10-01',366,['2026-10-01','2027-10-01']],
    ['weekly','2026-12-31',8,['2026-12-31','2027-01-07']]
  ]){
    reset();make({frequency,nextDueDate:start});
    assert.deepEqual(upcoming({now:new Date(`${start}T12:00:00`),days}).map(e=>Costs.localDay(new Date(e.dueDate))),expected,frequency);
  }
});

test('obligación y abonos sobreviven al respaldo sin migrarse a Hogar ni perder metadata',()=>{
  const item=make(),period=upcoming()[0].operatingPeriod;Costs.payOperatingObligation(item.id,{period,amount:400,date:now});
  const before=structuredClone(Data.getState()),json=JSON.stringify(before);Data.restaurar(json);Life.ensureFinancialLife();Life.ensureFinancialLife();
  assert.deepEqual(Data.getState().financialPlan.operatingObligations,before.financialPlan.operatingObligations);
  assert.deepEqual(Data.getState().movimientos,before.movimientos);assert.equal(upcoming()[0].amount,90);assert.equal(Data.getState().financialPlan.householdExpenses.length,0);
});

test('sync fusiona obligaciones y pagos por ID y exige elección ante importes incompatibles',()=>{
  make();const base=structuredClone(Data.getState()),local=structuredClone(base),remote=structuredClone(base);
  local.financialPlan.operatingObligations[0].name='Mottu moto';remote.movimientos.push({id:'remote-payment',tipo:'gasto',monto:100,operatingObligationId:base.financialPlan.operatingObligations[0].id,operatingPeriod:upcoming()[0].operatingPeriod,fecha:now.toISOString()});
  const merged=mergeStates(local,remote,base);assert.deepEqual(merged.conflicts,[]);Data.restaurar(JSON.stringify(merged.state));assert.equal(upcoming()[0].amount,390);
  local.financialPlan.operatingObligations[0].amount=500;remote.financialPlan.operatingObligations[0].amount=600;
  const conflict=mergeStates(local,remote,base);assert.equal(conflict.conflicts.length,1);assert.match(conflict.conflicts[0].path,/operatingObligations.*amount/);
});

test('no usa fondos de empresa ni modifica patrimonio al transferir entre cuentas',()=>{
  Data.getState().accounts.push({id:'company',ownership:'third_party',active:true,name:'Empresa'});
  assert.throws(()=>make({accountId:'company'}),/CUENTA_NO_ENCONTRADA/);assert.equal(Costs.operatingObligations().length,0);
  const bank=Accounts.createPersonalAccount({name:'Banco',type:'bank'});Accounts.transferBetweenAccounts({fromAccountId:'acct-personal',toAccountId:bank.id,amount:1000});
  const item=make({accountId:bank.id}),period=upcoming()[0].operatingPeriod;
  assert.throws(()=>Costs.payOperatingObligation(item.id,{period,amount:490,accountId:'company',date:now}),/CUENTA_NO_ENCONTRADA/);
  assert.equal(Data.getState().wallet.saldo,2223);assert.equal(Data.getState().movimientos.filter(m=>m.operatingObligationId).length,0);
  Costs.payOperatingObligation(item.id,{period,amount:490,date:now});assert.equal(Accounts.accountBalance(bank.id),510);assert.equal(Accounts.personalCashTotal(),1733);
});

test('rechaza importes, fechas y frecuencias inválidas sin crear una obligación ni cobrar',()=>{
  for(const patch of [{amount:0},{nextDueDate:''},{nextDueDate:'2026-02-30'},{frequency:'unknown'}])assert.throws(()=>make(patch));
  assert.equal(Costs.operatingObligations().length,0);assert.equal(Data.getState().wallet.saldo,2223);
});

test('proyección variable no resta un pago recurrente de nuevo dentro del ingreso neto estimado',()=>{
  const item=make({nextDueDate:'2026-09-03'});
  for(let i=28;i>=1;i--){const d=new Date(now);d.setDate(d.getDate()-i);d.setHours(12);Data.getState().movimientos.push({id:`income-${i}`,fecha:d.toISOString(),tipo:'ingreso',monto:700,categoria:'Trabajo',sourceId:'gig',affectsPersonal:true});}
  for(const event of upcoming({now:new Date('2026-09-03T12:00:00'),days:27}))Costs.payOperatingObligation(item.id,{period:event.operatingPeriod,amount:490,date:new Date(event.dueDate)});
  const variable=Forecast.variableIncomeEvents({days:8,now});assert.equal(variable.length,7);assert.ok(variable.every(e=>e.amount===700));
  const forecast=Forecast.cashFlowForecast({days:8,now,includeVariable:true});assert.equal(forecast.totalExpectedIncome,4900);assert.equal(forecast.totalExpectedOutflow,980);
});

test('PWA calienta los nuevos módulos, los sirve offline y elimina la caché anterior al activar',async()=>{
  const source=await readFile(new URL('../sw.js',import.meta.url),'utf8'),listeners={},entries=new Map(),deleted=[];
  const cache={put:async(request,response)=>entries.set(request.url,response),match:async(request)=>entries.get(request.url||request)};
  const ctx={self:{location:{origin:'https://app.test'},addEventListener:(type,fn)=>listeners[type]=fn,skipWaiting:async()=>{},clients:{claim:async()=>{}}},caches:{open:async()=>cache,keys:async()=>['hecagus-finance-3.1.1-shell-v10-operating-obligations','other-cache'],delete:async key=>deleted.push(key),match:async request=>cache.match(request)},Request:class{constructor(path){this.url=`https://app.test${path}`;}},Response,URL,console,fetch:async()=>new Response('export const loaded=true;')};
  vm.runInNewContext(source,ctx);let pending;listeners.install({waitUntil:p=>pending=p});await pending;
  for(const path of ['/js/domain/financial-rules.js','/js/domain/operating-costs.js','/js/ui/operating-costs.js'])assert.ok(entries.has(`https://app.test${path}`));
  ctx.fetch=async()=>{throw new Error('offline');};
  let response;listeners.fetch({request:{method:'GET',url:'https://app.test/js/domain/operating-costs.js'},respondWith:p=>response=p});assert.equal((await response).status,200);
  listeners.activate({waitUntil:p=>pending=p});await pending;assert.deepEqual(deleted,['hecagus-finance-3.1.1-shell-v10-operating-obligations']);
});
