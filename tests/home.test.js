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
  Home.createHouseholdExpense({name:'Renta',category:'Vivienda',amount:4000,frequency:'monthly',priority:'obligatory',dueDay:5});
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

test('gasto bimestral aparece sólo en los meses alineados a su próximo pago',()=>{
  Home.createHouseholdExpense({name:'Luz',category:'Servicios',amount:900,frequency:'bimonthly',priority:'obligatory',dueDay:18,nextDueDate:'2026-09-18'});
  const sep=Home.householdUpcomingEvents({days:30,now:new Date(2026,8,1,12)});
  assert.equal(sep.filter(e=>e.title==='Luz').length,1);
  const oct=Home.householdUpcomingEvents({days:30,now:new Date(2026,9,1,12)});
  assert.equal(oct.filter(e=>e.title==='Luz').length,0);
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
