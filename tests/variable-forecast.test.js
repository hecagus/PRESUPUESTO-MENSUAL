import test from 'node:test';
import assert from 'node:assert/strict';
class Storage{data=new Map();getItem(k){return this.data.get(k)||null;}setItem(k,v){this.data.set(k,String(v));}}
globalThis.localStorage=new Storage();
const Data=await import('../js/02_data.js');
const {cashFlowForecast,variableIncomeEvents,expectedIncomeForSource}=await import('../js/16_forecast_engine.js');
const now=new Date(2026,8,29,12);
function reset({paused=false,short=false}={}){
  const movimientos=[];
  for(let i=short?3:28;i>=1;i--){const d=new Date(now);d.setDate(d.getDate()-i);if(d.getDay()===0)continue;
    movimientos.push({id:`income-${i}`,fecha:d.toISOString(),tipo:'ingreso',monto:400,sourceId:'gig',affectsPersonal:true,categoria:'Trabajo'});
    movimientos.push({id:`cost-${i}`,fecha:d.toISOString(),tipo:'gasto',monto:100,sourceId:'gig',affectsPersonal:true,categoria:'Transporte'});
  }
  Data.restaurar(JSON.stringify({profile:{onboarded:true,transportMode:'none'},workSources:[{id:'gig',name:'Uber',compensation:'per_shift',status:paused?'paused':'active',active:!paused}],movimientos,turnos:[],wallet:{saldo:0,sobres:[]},parametros:{},financialPlan:{householdExpenses:[],householdKinds:{},commitments:[],livingBudgets:{},householdSemanticsVersion:1,householdCanonicalMigrationVersion:3,householdDirectRepairVersion:1}}));
}
test('variable forecast is opt-in, uses net income and includes zero-work weekdays',()=>{
  reset();const events=variableIncomeEvents({days:7,now});assert.equal(events.length,6);assert.ok(events.every(e=>e.amount===300&&e.estimated));
  assert.equal(cashFlowForecast({days:7,now}).totalExpectedIncome,0);
  const projected=cashFlowForecast({days:7,now,includeVariable:true});assert.equal(projected.totalExpectedIncome,1800);assert.equal(projected.totalExpectedOutflow,0);
  assert.ok(projected.events.every(e=>e.estimated));
});
test('paused sources and insufficient history produce no estimated income',()=>{
  reset({paused:true});assert.deepEqual(variableIncomeEvents({days:7,now}),[]);
  reset({short:true});assert.deepEqual(variableIncomeEvents({days:7,now}),[]);
});
test('future income and initial balance cannot inflate salary estimates',()=>{
  reset();Data.getState().workSources.push({id:'salary',compensation:'monthly'});
  Data.getState().movimientos.push({id:'s1',sourceId:'salary',tipo:'ingreso',monto:5000,fecha:new Date(2026,8,1).toISOString(),paymentKind:'source_period'}, {id:'s2',sourceId:'salary',tipo:'ingreso',monto:999999,fecha:new Date(2027,0,1).toISOString(),paymentKind:'source_period'}, {id:'s3',sourceId:'salary',tipo:'ingreso',monto:999999,fecha:new Date(2026,8,1).toISOString(),categoria:'Sistema'});
  assert.equal(expectedIncomeForSource('salary',now),5000);
});
test('unprofitable weekdays remain forecast expenses rather than being clamped to zero',()=>{
  reset();const s=Data.getState();
  for(let i=1;i<=28;i++){const d=new Date(now);d.setDate(d.getDate()-i);if(d.getDay()!==0)continue;s.movimientos.push({id:`sunday-cost-${i}`,tipo:'gasto',monto:100,sourceId:'gig',fecha:d.toISOString(),categoria:'Transporte'});}
  const events=variableIncomeEvents({days:7,now});assert.equal(events.length,7);assert.equal(events.find(e=>e.type==='expense').amount,100);
  assert.equal(cashFlowForecast({days:7,now,includeVariable:true}).totalExpectedOutflow,100);
});
