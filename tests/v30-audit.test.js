import test from 'node:test';
import assert from 'node:assert/strict';

class MemoryStorage{#data=new Map();getItem(k){return this.#data.has(k)?this.#data.get(k):null;}setItem(k,v){this.#data.set(String(k),String(v));}removeItem(k){this.#data.delete(String(k));}clear(){this.#data.clear();}}
globalThis.localStorage=new MemoryStorage();

const Data=await import('../js/02_data.js');
const Life=await import('../js/21_financial_life_v27.js');
const Home=await import('../js/23_home_semantics.js');

function reset(extra={}){
  Data.restaurar(JSON.stringify({
    schemaVersion:30,
    profile:{onboarded:true,displayName:'',useCases:['personal'],transportMode:'none',capabilities:['personal_finance'],currency:'MXN'},
    workSources:[],accounts:[],assets:[],turnos:[],movimientos:[],cargasCombustible:[],fondosCombustibleEmpresa:[],deudas:[],gastosFijosMensuales:[],ingresosFijos:[],
    business:{ingredients:[],products:[],sales:[]},wallet:{saldo:0,sobres:[]},savingsGoals:[],
    parametros:{ultimoKM:0,costoPorKm:0,metaDiaria:0,metaBase:0,deficitTotal:0,moraVencida:0,kmInicialConfigurado:false,saldoInicialConfigurado:false},
    categoriasPersonalizadas:{operativo:[],hogar:[]},activeActivity:null,turnoActivo:null,...extra
  }));
  Life.ensureFinancialLife();
}

test.beforeEach(()=>reset());

test('v3 ignora gastos fijos legacy como motor activo',()=>{
  Data.saldoInicial(10000);const s=Data.getState();
  s.gastosFijosMensuales.push({id:'legacy-netflix',desc:'Netflix viejo',monto:399,categoria:'Otro',frecuencia:'Mensual'});Data.saveData();
  const events=Life.upcomingFinancialEvents({days:45,now:new Date('2026-08-31T12:00:00')});
  assert.equal(events.some(e=>String(e.id).startsWith('fixed-')||e.refId==='legacy-netflix'),false);
  assert.equal(Life.financialPosition(new Date('2026-08-31T12:00:00')).committed,0);
});

test('v3 no cuenta dos veces Hogar al calcular dinero realmente libre',()=>{
  Data.saldoInicial(10000);const s=Data.getState();s.savingsGoals=[{id:'goal',name:'Meta',targetAmount:5000,reserved:1000,active:true}];Data.saveData();
  Home.createHouseholdExpense({name:'Renta',amount:4000,category:'Vivienda',kind:'obligation',frequency:'monthly',nextDueDate:'2026-09-05'});
  Home.createHouseholdExpense({name:'Comida',amount:2000,category:'Alimentación',kind:'budget',frequency:'monthly'});
  const pos=Life.financialPosition(new Date('2026-08-31T12:00:00'));
  assert.equal(pos.cash,10000);assert.equal(pos.reserved,1000);assert.equal(pos.homeBudget,2000);assert.equal(pos.due,4000);assert.equal(pos.committed,6000);assert.equal(pos.free,3000);
});

test('v3 migra compromiso manual antiguo a Hogar y desactiva el duplicado',()=>{
  const s=Data.getState();s.financialPlan={...(s.financialPlan||{}),householdCanonicalMigrationVersion:0,commitments:[{id:'school',name:'Colegiatura',amount:1200,dueDay:5,category:'Educación',frequency:'monthly',active:true}]};Data.saveData();
  Life.ensureFinancialLife();
  assert.equal(Data.getState().financialPlan.commitments.find(x=>x.id==='school').active,false);
  const item=Home.householdItems().find(x=>x.name==='Colegiatura');assert.ok(item);assert.equal(item.kind,'obligation');assert.equal(item.amount,1200);
});

test('v3 repara una doble captura directa idéntica dentro de cinco minutos',()=>{
  reset({
    movimientos:[
      {id:'opening',fecha:'2026-08-31T10:00:00.000Z',tipo:'ingreso',desc:'Saldo Inicial',monto:2000,categoria:'Sistema',accountId:'acct-personal',affectsPersonal:true},
      {id:'m1',fecha:'2026-08-31T12:00:00.000Z',recordedAt:'2026-08-31T12:01:00.000Z',tipo:'gasto',desc:'Despensa',monto:653,categoria:'Otros',accountId:'acct-personal',affectsPersonal:true,householdExpenseId:'h1'},
      {id:'m2',fecha:'2026-08-31T12:00:00.000Z',recordedAt:'2026-08-31T12:02:00.000Z',tipo:'gasto',desc:'Despensa',monto:653,categoria:'Otros',accountId:'acct-personal',affectsPersonal:true,householdExpenseId:'h2'}
    ],
    financialPlan:{householdSemanticsVersion:1,householdCanonicalMigrationVersion:3,householdDirectRepairVersion:0,householdKinds:{h1:'spent',h2:'spent'},commitments:[],livingBudgets:{},householdExpenses:[
      {id:'h1',name:'Despensa',category:'Otros',amount:653,frequency:'one_time',priority:'discretionary',nextDueDate:'2026-08-31',active:false,createdAt:'2026-08-31T12:01:00.000Z'},
      {id:'h2',name:'Despensa',category:'Otros',amount:653,frequency:'one_time',priority:'discretionary',nextDueDate:'2026-08-31',active:false,createdAt:'2026-08-31T12:02:00.000Z'}
    ]}
  });
  Life.ensureFinancialLife();const s=Data.getState();
  assert.equal(s.movimientos.filter(m=>m.desc==='Despensa').length,1);assert.equal(Home.recentDirectHouseholdExpenses(10).length,1);assert.equal(Math.round(s.wallet.saldo),1347);
});
