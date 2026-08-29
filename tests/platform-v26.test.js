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
const Savings=await import('../js/11_savings_goals.js');
const Life=await import('../js/13_financial_life.js');
const Accounts=await import('../js/15_accounts_engine.js');
const Forecast=await import('../js/16_forecast_engine.js');
const Automation=await import('../js/17_automation_engine.js');
const Health=await import('../js/18_health_goals.js');

function reset(){
  Data.restaurar(JSON.stringify({
    schemaVersion:26,
    profile:{onboarded:true,displayName:'',useCases:['personal'],transportMode:'none',capabilities:['personal_finance'],currency:'MXN'},
    workSources:[],accounts:[{id:'acct-personal',name:'Caja personal',type:'cash',ownership:'personal',active:true}],assets:[],turnos:[],movimientos:[],cargasCombustible:[],fondosCombustibleEmpresa:[],
    deudas:[],gastosFijosMensuales:[],ingresosFijos:[],business:{ingredients:[],products:[],sales:[]},
    wallet:{saldo:0,sobres:[]},savingsGoals:[],financialPlan:{livingBudgets:{groceries:0,health:0,leisure:0,other:0},commitments:[]},
    automationRules:[],ruleApplications:[],automationPreferences:{minFreeCash:0,alertsEnabled:true},
    parametros:{ultimoKM:0,costoPorKm:0,metaDiaria:0,metaBase:0,deficitTotal:0,moraVencida:0,kmInicialConfigurado:false,saldoInicialConfigurado:false},
    categoriasPersonalizadas:{operativo:[],hogar:[]},activeActivity:null,turnoActivo:null
  }));
  Savings.ensureSavingsGoals();Life.ensureFinancialLife();Accounts.ensureAccountsEngine();Automation.ensureAutomationEngine();
}

test.beforeEach(reset);

test('v2.3 transferir entre cuentas no cambia patrimonio y sí cambia dónde está el dinero',()=>{
  Data.saldoInicial(10000);
  const bank=Accounts.createPersonalAccount({name:'BBVA',type:'bank'});
  Accounts.transferBetweenAccounts({fromAccountId:'acct-personal',toAccountId:bank.id,amount:6000});
  assert.equal(Accounts.accountBalance('acct-personal'),4000);
  assert.equal(Accounts.accountBalance(bank.id),6000);
  assert.equal(Accounts.personalCashTotal(),10000);
  assert.equal(Data.getState().wallet.saldo,10000);
});

test('v2.3 movimiento universal afecta la cuenta elegida y el saldo total',()=>{
  Data.saldoInicial(5000);
  const bank=Accounts.createPersonalAccount({name:'Nu',type:'bank'});
  Accounts.transferBetweenAccounts({fromAccountId:'acct-personal',toAccountId:bank.id,amount:2000});
  Accounts.recordUniversalMovement({type:'expense',description:'Despensa',amount:750,accountId:bank.id,category:'Comida'});
  assert.equal(Accounts.accountBalance(bank.id),1250);
  assert.equal(Accounts.personalCashTotal(),4250);
  assert.equal(Data.getState().wallet.saldo,4250);
});

test('v2.4 proyección usa pagos históricos para estimar próximos ingresos fijos',()=>{
  Data.saldoInicial(2000);
  Data.crearFuenteTrabajo({name:'Empresa',kind:'employment',compensation:'monthly',trackTime:false,fuelPayer:'none'});
  const source=Data.getState().workSources[0];
  Data.getState().movimientos.push({id:'pay-old',fecha:'2026-08-01T12:00:00.000Z',tipo:'ingreso',desc:'Pago · Empresa',monto:8000,categoria:'Trabajo',sourceId:source.id,accountId:'acct-personal',affectsPersonal:true,paymentKind:'source_period'});
  Data.saveData();
  Life.createCommitment({name:'Renta',amount:4000,dueDay:5,category:'Vivienda'});
  const forecast=Forecast.cashFlowForecast({days:40,now:new Date('2026-08-29T12:00:00')});
  assert.ok(forecast.totalExpectedIncome>=8000);
  assert.ok(forecast.totalExpectedOutflow>=4000);
  assert.ok(forecast.events.some(e=>e.type==='income'&&e.estimated));
});

test('v2.5 una regla aparta porcentaje de un ingreso nuevo hacia una meta',()=>{
  Data.saldoInicial(1000);
  const goal=Savings.createSavingsGoal({name:'Emergencia',targetAmount:10000,targetDate:'2027-02-28',priority:'high'});
  Automation.createReserveRule({goalId:goal.id,percent:10,name:'Diez por ciento'});
  Accounts.recordUniversalMovement({type:'income',description:'Cobro',amount:5000,accountId:'acct-personal',category:'Trabajo'});
  const applied=Automation.runAutomationEngine();
  assert.equal(applied,1);
  assert.equal(Math.round(Savings.savingsGoalSummary(goal.id).reserved),500);
  assert.equal(Data.getState().ruleApplications.length,1);
  assert.equal(Automation.runAutomationEngine(),0);
});

test('v2.5 alertas detectan cuando el dinero libre cae bajo el colchón configurado',()=>{
  Data.saldoInicial(1000);
  Automation.setMinFreeCashAlert(1500);
  const alerts=Automation.smartAlerts();
  assert.ok(alerts.some(a=>a.id==='free-floor'));
});

test('v2.6 salud financiera explica cuatro componentes y meta inteligente da estado',()=>{
  Data.saldoInicial(10000);
  Accounts.recordUniversalMovement({type:'income',description:'Ingreso',amount:12000,accountId:'acct-personal',category:'Trabajo'});
  Accounts.recordUniversalMovement({type:'expense',description:'Comida',amount:3000,accountId:'acct-personal',category:'Comida'});
  const goal=Savings.createSavingsGoal({name:'Laptop',targetAmount:12000,targetDate:'2027-02-28',priority:'normal'});
  const health=Health.financialHealth();
  const plan=Health.smartGoalPlan(goal.id);
  assert.equal(health.breakdown.length,4);
  assert.ok(health.score>=0&&health.score<=100);
  assert.ok(['on_track','at_risk','blocked','complete'].includes(plan.status));
  assert.ok(plan.requiredMonthly>0);
});
