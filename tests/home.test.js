import test from 'node:test';
import assert from 'node:assert/strict';

class MemoryStorage {
  #data=new Map();
  getItem(k){return this.#data.has(k)?this.#data.get(k):null;}
  setItem(k,v){this.#data.set(String(k),String(v));}
  removeItem(k){this.#data.delete(String(k));}
  clear(){this.#data.clear();}
}
globalThis.localStorage=new MemoryStorage();

const Data=await import('../js/02_data.js');
const Home=await import('../js/20_home_engine.js');
const Finance=await import('../js/21_financial_life_v27.js');

function reset(){
  localStorage.clear();
  Data.restaurar(JSON.stringify({
    schemaVersion:26,
    profile:{onboarded:true,displayName:'',useCases:['personal'],transportMode:'none',capabilities:['personal_finance'],currency:'MXN'},
    workSources:[],accounts:[],assets:[],turnos:[],movimientos:[],cargasCombustible:[],fondosCombustibleEmpresa:[],
    deudas:[],gastosFijosMensuales:[],ingresosFijos:[],business:{ingredients:[],products:[],sales:[]},wallet:{saldo:0,sobres:[]},
    parametros:{ultimoKM:0,costoPorKm:0,metaDiaria:0,metaBase:0,deficitTotal:0,moraVencida:0,kmInicialConfigurado:false,saldoInicialConfigurado:false},
    categoriasPersonalizadas:{operativo:[],hogar:[]},activeActivity:null,turnoActivo:null,
    financialPlan:{livingBudgets:{groceries:0,health:0,leisure:0,other:0},commitments:[]}
  }));
  Data.saldoInicial(10000);
  Home.ensureHousehold();
}

test.beforeEach(reset);

test('obligaciones y presupuesto del hogar reducen dinero realmente libre',()=>{
  Home.createHouseholdExpense({name:'Renta',category:'Vivienda',amount:4000,frequency:'monthly',priority:'obligatory',dueDay:5,nextDueDate:'2026-09-05'});
  Home.createHouseholdExpense({name:'Despensa',category:'Alimentación',amount:2000,frequency:'monthly',priority:'budgeted'});
  const pos=Finance.financialPosition(new Date(2026,8,1,12));
  assert.equal(Math.round(pos.homeDue),4000);
  assert.equal(Math.round(pos.homeBudget),2000);
  assert.equal(Math.round(pos.committed),6000);
  assert.equal(Math.round(pos.free),4000);
});

test('gastar presupuesto consume efectivo y presupuesto al mismo tiempo',()=>{
  const food=Home.createHouseholdExpense({name:'Despensa',category:'Alimentación',amount:2000,frequency:'monthly',priority:'budgeted'});
  Home.recordHouseholdExpense(food.id,500,new Date(2026,8,2,12).getTime());
  const row=Home.householdBudgetStatus(new Date(2026,8,2,12)).find(x=>x.item.id===food.id);
  assert.equal(row.spent,500);
  assert.equal(row.remaining,1500);
  const pos=Finance.financialPosition(new Date(2026,8,2,12));
  assert.equal(Math.round(pos.cash),9500);
  assert.equal(Math.round(pos.free),8000);
});

test('gasto discrecional no se compromete hasta que realmente ocurre',()=>{
  const clothes=Home.createHouseholdExpense({name:'Ropa',category:'Ropa',amount:1000,frequency:'one_time',priority:'discretionary'});
  const before=Finance.financialPosition(new Date(2026,8,2,12));
  assert.equal(Math.round(before.free),10000);
  Home.recordHouseholdExpense(clothes.id,750,new Date(2026,8,2,12).getTime());
  const after=Finance.financialPosition(new Date(2026,8,2,12));
  assert.equal(Math.round(after.cash),9250);
  assert.equal(Math.round(after.free),9250);
  assert.equal(Home.householdById(clothes.id).active,false);
});

test('gasto bimestral conserva vencido hasta pagarlo y no inventa octubre',()=>{
  const light=Home.createHouseholdExpense({name:'Luz',category:'Servicios',amount:900,frequency:'bimonthly',priority:'obligatory',dueDay:18,nextDueDate:'2026-09-18'});
  const sep=Home.householdUpcomingEvents({days:30,now:new Date(2026,8,1,12)}).filter(e=>e.title==='Luz');
  assert.equal(sep.length,1);
  assert.equal(sep[0].overdue,false);

  const oct=Home.householdUpcomingEvents({days:30,now:new Date(2026,9,1,12)}).filter(e=>e.title==='Luz');
  assert.equal(oct.length,1);
  assert.equal(oct[0].overdue,true);
  assert.match(oct[0].dueDate,/2026-09-18/);

  Home.recordHouseholdExpense(light.id,900,new Date(2026,9,1,12).getTime());
  const movement=Data.getState().movimientos.find(m=>m.householdExpenseId===light.id);
  assert.equal(movement.householdPeriod,'B:2026-09');

  const after=Home.householdUpcomingEvents({days:30,now:new Date(2026,9,2,12)}).filter(e=>e.title==='Luz');
  assert.equal(after.length,0);
});

test('pago quincenal repetido no adelanta la siguiente quincena',()=>{
  const food=Home.createHouseholdExpense({name:'Comida',category:'Alimentación',amount:3000,frequency:'biweekly',priority:'obligatory',nextDueDate:'2026-09-15'});
  Home.recordHouseholdExpense(food.id,3000,new Date(2026,8,1,12).getTime());
  let moves=Data.getState().movimientos.filter(m=>m.householdExpenseId===food.id);
  assert.equal(moves.length,1);
  assert.equal(moves[0].householdPeriod,'Q:2026-09:1');

  assert.throws(()=>Home.recordHouseholdExpense(food.id,3000,new Date(2026,8,1,13).getTime()),/GASTO_HOGAR_YA_PAGADO/);
  assert.throws(()=>Home.recordHouseholdExpense(food.id,3000,new Date(2026,8,2,12).getTime()),/GASTO_HOGAR_YA_PAGADO/);
  moves=Data.getState().movimientos.filter(m=>m.householdExpenseId===food.id);
  assert.equal(moves.length,1);

  Home.recordHouseholdExpense(food.id,3000,new Date(2026,8,16,12).getTime());
  moves=Data.getState().movimientos.filter(m=>m.householdExpenseId===food.id);
  assert.equal(moves.length,2);
  assert.deepEqual(moves.map(m=>m.householdPeriod),['Q:2026-09:1','Q:2026-09:2']);
});

test('migra vivienda, servicios y presupuestos anteriores sin duplicarlos',()=>{
  Data.restaurar(JSON.stringify({
    schemaVersion:26,profile:{onboarded:true,useCases:['personal'],transportMode:'none',capabilities:['personal_finance'],currency:'MXN'},
    workSources:[],accounts:[],assets:[],turnos:[],movimientos:[],cargasCombustible:[],fondosCombustibleEmpresa:[],deudas:[],gastosFijosMensuales:[],ingresosFijos:[],business:{ingredients:[],products:[],sales:[]},wallet:{saldo:0,sobres:[]},parametros:{saldoInicialConfigurado:false},categoriasPersonalizadas:{operativo:[],hogar:[]},
    financialPlan:{livingBudgets:{groceries:1500,health:0,leisure:0,other:0},commitments:[{id:'life-housing',name:'Vivienda',amount:4000,frequency:'monthly',dueDay:5,active:true},{id:'life-services',name:'Servicios',amount:500,frequency:'monthly',dueDay:10,active:true}]}
  }));
  const items=Home.ensureHousehold();
  assert.ok(items.some(x=>x.id==='home-housing'&&x.amount===4000));
  assert.ok(items.some(x=>x.id==='home-services'&&x.amount===500));
  assert.ok(items.some(x=>x.id==='home-groceries'&&x.amount===1500));
  assert.equal(Data.getState().financialPlan.commitments.find(x=>x.id==='life-housing').active,false);
  assert.equal(Data.getState().financialPlan.livingBudgets.groceries,0);
  assert.equal(new Set(items.map(x=>x.id)).size,items.length);
});
test('abono quincenal conserva 400 pendientes y solo descuenta 2600 del efectivo',()=>{
  const food=Home.createHouseholdExpense({name:'Comida',amount:3000,frequency:'biweekly',priority:'obligatory',nextDueDate:'2026-09-30'});
  Home.recordHouseholdExpense(food.id,2600,new Date(2026,8,30,12));
  let pos=Finance.financialPosition(new Date(2026,8,30,13));
  assert.equal(pos.cash,7400);assert.equal(pos.committed,3400);
  const due=Home.householdUpcomingEvents({days:30,now:new Date(2026,8,30,13)}).filter(e=>e.refId===food.id);
  assert.deepEqual(due.map(e=>e.amount),[400,3000]);
  Home.recordHouseholdExpense(food.id,400,new Date(2026,9,1,12));
  pos=Finance.financialPosition(new Date(2026,9,1,13));
  assert.equal(pos.cash,7000);
  assert.equal(Data.getState().movimientos.filter(m=>m.householdExpenseId===food.id).length,2);
  assert.ok(Data.getState().movimientos.filter(m=>m.householdExpenseId===food.id).every(m=>m.householdPeriod==='Q:2026-09:2'));
  assert.ok(!Home.householdUpcomingEvents({days:30,now:new Date(2026,9,1,13)}).some(e=>e.householdPeriod==='Q:2026-09:2'));
});

test('pago completo por menos requiere liquidación explícita y no cambia importe habitual',()=>{
  const food=Home.createHouseholdExpense({name:'Comida',amount:3000,frequency:'biweekly',priority:'obligatory',nextDueDate:'2026-09-30'});
  Home.recordHouseholdExpense(food.id,2600,new Date(2026,8,30,12),{settled:true});
  assert.equal(Finance.financialPosition(new Date(2026,8,30,13)).committed,3000);
  assert.equal(Home.householdById(food.id).amount,3000);
});

test('abonos antiguos sobreviven a backup y a la ventana de vencimientos',()=>{
  const item=Home.createHouseholdExpense({name:'Luz',amount:1000,frequency:'monthly',priority:'obligatory',dueDay:5,nextDueDate:'2026-01-05'});
  Home.recordHouseholdExpense(item.id,600,new Date(2026,0,5,12));
  Data.restaurar(JSON.stringify(Data.getState()));
  assert.ok(Home.householdUpcomingEvents({days:30,now:new Date(2026,8,30,12)}).some(e=>e.householdPeriod==='M:2026-01'&&e.amount===400));
  Home.recordHouseholdExpense(item.id,400,new Date(2026,8,30,13));
  assert.equal(Data.getState().movimientos.at(-1).householdPeriod,'M:2026-01');
});

test('proyección incluye el saldo pendiente de la obligación sin repetir el abono',async()=>{
  const Forecast=await import('../js/16_forecast_engine.js');
  const food=Home.createHouseholdExpense({name:'Comida',amount:3000,frequency:'biweekly',priority:'obligatory',nextDueDate:'2026-09-30'});
  Home.recordHouseholdExpense(food.id,2600,new Date(2026,8,30,12));
  const forecast=Forecast.cashFlowForecast({days:30,now:new Date(2026,8,30,13)});
  assert.equal(forecast.totalExpectedOutflow,3400);
});

test('abonos del mismo día liquidan una obligación única al completar su importe',()=>{
  const item=Home.createHouseholdExpense({name:'Compra obligatoria',amount:3000,frequency:'one_time',priority:'obligatory',nextDueDate:'2026-09-30'});
  Home.recordHouseholdExpense(item.id,2600,new Date(2026,8,30,12));
  assert.equal(Home.householdById(item.id).active,true);
  Home.recordHouseholdExpense(item.id,400,new Date(2026,8,30,13));
  assert.equal(Home.householdById(item.id).active,false);
  assert.equal(Data.getState().movimientos.filter(m=>m.householdExpenseId===item.id).reduce((sum,m)=>sum+m.monto,0),3000);
});

test('pago parcial legacy se reconoce sin cambiar sus movimientos ni duplicarlos',()=>{
  const item=Home.createHouseholdExpense({name:'Comida',amount:3000,frequency:'biweekly',priority:'obligatory',nextDueDate:'2026-09-30'});
  const state=Data.getState();
  state.movimientos.push({id:'legacy-partial',tipo:'gasto',monto:2600,fecha:'2026-09-30T12:00:00.000Z',householdExpenseId:item.id,householdPeriod:'Q:2026-09:2',affectsPersonal:true});
  const before=JSON.stringify(state.movimientos);
  const pos=Finance.financialPosition(new Date(2026,8,30,13));
  assert.equal(pos.committed,3400);
  assert.equal(JSON.stringify(Data.getState().movimientos),before);
});
