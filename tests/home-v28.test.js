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
const Home=await import('../js/23_home_semantics.js');
const Finance=await import('../js/21_financial_life_v27.js');

function reset(){
  localStorage.clear();
  Data.restaurar(JSON.stringify({
    schemaVersion:26,profile:{onboarded:true,useCases:['personal'],transportMode:'none',capabilities:['personal_finance'],currency:'MXN'},
    workSources:[],accounts:[],assets:[],turnos:[],movimientos:[],cargasCombustible:[],fondosCombustibleEmpresa:[],deudas:[],gastosFijosMensuales:[],ingresosFijos:[],
    business:{ingredients:[],products:[],sales:[]},wallet:{saldo:0,sobres:[]},parametros:{ultimoKM:0,costoPorKm:0,metaDiaria:0,metaBase:0,deficitTotal:0,moraVencida:0,kmInicialConfigurado:false,saldoInicialConfigurado:false},
    categoriasPersonalizadas:{operativo:[],hogar:[]},activeActivity:null,turnoActivo:null,financialPlan:{livingBudgets:{groceries:0,health:0,leisure:0,other:0},commitments:[]}
  }));
  Data.saldoInicial(10000);Home.ensureHousehold();
}
test.beforeEach(reset);

test('presupuesto sólo existe cuando el usuario lo declara',()=>{
  Home.recordDirectHouseholdExpense({name:'Bodega Aurrerá',category:'Alimentación',amount:653,date:'2026-08-31'});
  assert.equal(Home.householdBudgetStatus(new Date(2026,7,31,12)).length,0);
  const pos=Finance.financialPosition(new Date(2026,7,31,12));
  assert.equal(Math.round(pos.cash),9347);
  assert.equal(Math.round(pos.homeBudget),0);
  assert.equal(Math.round(pos.free),9347);
});

test('presupuesto necesario aparta sólo lo que falta por gastar',()=>{
  const food=Home.createHouseholdExpense({name:'Comida',category:'Alimentación',amount:6000,frequency:'monthly',kind:'budget'});
  assert.equal(Math.round(Finance.financialPosition(new Date(2026,8,1,12)).free),4000);
  Home.recordHouseholdExpense(food.id,1500,new Date(2026,8,2,12).getTime());
  const pos=Finance.financialPosition(new Date(2026,8,2,12));
  assert.equal(Math.round(pos.cash),8500);
  assert.equal(Math.round(pos.homeBudget),4500);
  assert.equal(Math.round(pos.free),4000);
});

test('reserva concreta reduce dinero libre y se libera al comprar por menos',()=>{
  const paper=Home.createHouseholdExpense({name:'Papel higiénico',category:'Higiene y belleza',amount:180,kind:'reserve',nextDueDate:'2026-09-05'});
  let pos=Finance.financialPosition(new Date(2026,8,1,12));
  assert.equal(Math.round(pos.homeReserve),180);
  assert.equal(Math.round(pos.free),9820);
  Home.recordHouseholdExpense(paper.id,165,new Date(2026,8,2,12).getTime());
  pos=Finance.financialPosition(new Date(2026,8,2,12));
  assert.equal(Math.round(pos.cash),9835);
  assert.equal(Math.round(pos.homeReserve),0);
  assert.equal(Math.round(pos.free),9835);
});

test('Netflix opcional no compromete dinero hasta que se paga',()=>{
  const netflix=Home.createHouseholdExpense({name:'Netflix',category:'Suscripciones',amount:399,frequency:'monthly',kind:'optional',nextDueDate:'2026-09-10'});
  assert.equal(Math.round(Finance.financialPosition(new Date(2026,8,1,12)).free),10000);
  Home.recordHouseholdExpense(netflix.id,399,new Date(2026,8,10,12).getTime());
  assert.equal(Math.round(Finance.financialPosition(new Date(2026,8,10,12)).free),9601);
});

test('obligación sí entra al calendario y al dinero comprometido',()=>{
  Home.createHouseholdExpense({name:'Renta',category:'Vivienda',amount:4000,frequency:'monthly',kind:'obligation',nextDueDate:'2026-09-05'});
  const events=Home.householdUpcomingEvents({days:10,now:new Date(2026,8,1,12)});
  assert.equal(events.length,1);assert.equal(events[0].title,'Renta');
  const pos=Finance.financialPosition(new Date(2026,8,1,12));
  assert.equal(Math.round(pos.homeDue),4000);
  assert.equal(Math.round(pos.free),6000);
});

test('gasto realizado queda en historial, aparece como reciente y no crea plan activo',()=>{
  const item=Home.recordDirectHouseholdExpense({name:'Despensa',category:'Alimentación',amount:653,date:'2026-08-31'});
  assert.equal(Home.householdById(item.id).kind,'spent');
  assert.equal(Home.householdById(item.id).active,false);
  assert.equal(Home.householdItems({activeOnly:true}).some(x=>x.id===item.id),false);
  assert.equal(Data.getState().movimientos.filter(m=>m.householdExpenseId===item.id).length,1);
  const recent=Home.recentDirectHouseholdExpenses();
  assert.equal(recent.length,1);assert.equal(recent[0].item.id,item.id);assert.equal(recent[0].amount,653);
});

test('doble captura accidental del mismo gasto en pocos minutos se bloquea',()=>{
  Home.recordDirectHouseholdExpense({name:'Despensa',category:'Alimentación',amount:653,date:'2026-08-31'});
  assert.throws(()=>Home.recordDirectHouseholdExpense({name:'Despensa',category:'Alimentación',amount:653,date:'2026-08-31'}),/GASTO_HOGAR_DUPLICADO_RECIENTE/);
  const moves=Data.getState().movimientos.filter(m=>m.desc==='Despensa'&&m.tipo==='gasto');
  assert.equal(moves.length,1);
  assert.equal(Math.round(Finance.financialPosition(new Date(2026,7,31,12)).cash),9347);
});

test('deshacer gasto directo lo quita del historial y devuelve el dinero al saldo',()=>{
  const item=Home.recordDirectHouseholdExpense({name:'Despensa',category:'Alimentación',amount:653,date:'2026-08-31'});
  assert.equal(Math.round(Finance.financialPosition(new Date(2026,7,31,12)).cash),9347);
  assert.equal(Home.undoDirectHouseholdExpense(item.id),true);
  assert.equal(Data.getState().movimientos.some(m=>m.householdExpenseId===item.id),false);
  assert.equal(Home.householdById(item.id),null);
  assert.equal(Home.recentDirectHouseholdExpenses().length,0);
  assert.equal(Math.round(Finance.financialPosition(new Date(2026,7,31,12)).cash),10000);
});
