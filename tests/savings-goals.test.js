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
const Goals=await import('../js/11_savings_goals.js');
const {resumenGlobal}=await import('../js/04_charts.js');

function reset(){
  Data.restaurar(JSON.stringify({
    schemaVersion:21,
    profile:{onboarded:false,displayName:'',useCases:['personal'],transportMode:'none',capabilities:['personal_finance'],currency:'MXN'},
    workSources:[],accounts:[],assets:[],turnos:[],movimientos:[],cargasCombustible:[],fondosCombustibleEmpresa:[],
    deudas:[],gastosFijosMensuales:[],ingresosFijos:[],savingsGoals:[],business:{ingredients:[],products:[],sales:[]},
    wallet:{saldo:0,sobres:[]},
    parametros:{ultimoKM:0,costoPorKm:0,metaDiaria:0,metaBase:0,deficitTotal:0,moraVencida:0,kmInicialConfigurado:false,saldoInicialConfigurado:false},
    categoriasPersonalizadas:{operativo:[],hogar:[]},activeActivity:null,turnoActivo:null
  }));
  Goals.ensureSavingsGoals();
}

function sixMonths(){const d=new Date();d.setMonth(d.getMonth()+6);return d.toISOString().slice(0,10);}

test.beforeEach(reset);

test('reservar para una meta congela disponible sin reducir patrimonio',()=>{
  Data.configurarOnboarding({useCases:['personal'],transportMode:'none',openingBalance:10000});
  const goal=Goals.createSavingsGoal({name:'Fondo',targetAmount:30000,targetDate:sixMonths()});
  Goals.contributeToSavingsGoal(goal.id,5000);
  const summary=resumenGlobal(Data.getState());
  assert.equal(summary.saldo,10000);
  assert.equal(summary.ahorro,5000);
  assert.equal(summary.disponible,5000);
  assert.equal(Goals.getSavingsGoal(goal.id).reserved,5000);
  const transfer=Data.getState().movimientos.at(-1);
  assert.equal(transfer.affectsPersonal,false);
  assert.equal(transfer.goalTransfer,'reserve');
});

test('usar dinero reservado lo libera sin convertirlo en ingreso nuevo',()=>{
  Data.configurarOnboarding({useCases:['personal'],transportMode:'none',openingBalance:10000});
  const goal=Goals.createSavingsGoal({name:'Viaje',targetAmount:30000,targetDate:sixMonths()});
  Goals.contributeToSavingsGoal(goal.id,5000);
  const preview=Goals.previewSavingsWithdrawal(goal.id,1000);
  assert.equal(preview.afterReserved,4000);
  assert.ok(preview.extraPerMonth>0);
  Goals.withdrawFromSavingsGoal(goal.id,1000);
  const summary=resumenGlobal(Data.getState());
  assert.equal(summary.saldo,10000);
  assert.equal(summary.ahorro,4000);
  assert.equal(summary.disponible,6000);
  assert.equal(Data.getState().movimientos.at(-1).goalTransfer,'release');
  assert.equal(Data.getState().movimientos.at(-1).affectsPersonal,false);
});

test('recomendación usa fuentes con ingreso real y no inventa ingreso en fuentes en cero',()=>{
  Data.configurarOnboarding({
    useCases:['employment','gig'],transportMode:'none',openingBalance:0,
    sources:[
      {name:'Empresa principal',kind:'employment',compensation:'biweekly',trackTime:false,trackDistance:false,fuelPayer:'none'},
      {name:'Plataforma extra',kind:'gig',compensation:'per_shift',trackTime:false,trackDistance:false,fuelPayer:'none'}
    ]
  });
  const employment=Data.getState().workSources.find(s=>s.kind==='employment');
  const gig=Data.getState().workSources.find(s=>s.kind==='gig');
  Data.registrarPagoFuente(employment.id,6000);
  const goal=Goals.createSavingsGoal({name:'Meta 30k',targetAmount:30000,targetDate:sixMonths()});
  const capacity=Goals.savingsCapacity(goal.id);
  const emp=capacity.sources.find(s=>s.id===employment.id),extra=capacity.sources.find(s=>s.id===gig.id);
  assert.equal(emp.income,6000);
  assert.equal(extra.income,0);
  assert.ok(emp.suggested>0);
  assert.equal(extra.suggested,0);
  assert.ok(capacity.suggestedNow>0);
});

test('no permite reservar dinero que no está disponible',()=>{
  Data.configurarOnboarding({useCases:['personal'],transportMode:'none',openingBalance:1000});
  const goal=Goals.createSavingsGoal({name:'Emergencia',targetAmount:10000,targetDate:sixMonths()});
  assert.throws(()=>Goals.contributeToSavingsGoal(goal.id,1500),/SALDO_DISPONIBLE_INSUFICIENTE/);
});
