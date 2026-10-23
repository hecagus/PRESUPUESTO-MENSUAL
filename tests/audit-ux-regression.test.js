import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {STORAGE_KEY} from '../js/01_consts_utils.js';

class Storage{
  data=new Map();fail=false;writes=0;
  getItem(key){return this.data.get(key)??null;}
  setItem(key,value){if(this.fail)throw new Error('quota');this.data.set(key,String(value));this.writes++;}
  clear(){this.data.clear();this.fail=false;this.writes=0;}
}
globalThis.localStorage=new Storage();
const Data=await import('../js/02_data.js');
const Home=await import('../js/23_home_semantics.js');
const Accounts=await import('../js/15_accounts_engine.js');
const Goals=await import('../js/11_savings_goals.js');
const Health=await import('../js/18_health_goals.js');
const Forecast=await import('../js/16_forecast_engine.js');
const Automation=await import('../js/17_automation_engine.js');
const Costs=await import('../js/domain/operating-costs.js');
const Render=await import('../js/03_render.js');
const Platform=await import('../js/19_platform_ui.js');
const Quick=await import('../js/ui/quick-expense.js');
const OpUI=await import('../js/ui/operating-costs.js');
const Recovery=await import('../js/ui/storage-recovery.js');
const now=new Date('2026-10-01T18:00:00');
const income=(id,amount,extra={})=>({id,tipo:'ingreso',monto:amount,desc:'Ingreso de prueba',fecha:now.toISOString(),accountId:'acct-personal',affectsPersonal:true,categoria:'Sistema',...extra});
function reset(extra={}){
  Data.restaurar(JSON.stringify({...Data.createEmptyState(),profile:{onboarded:true,transportMode:'none'},movimientos:[income('opening',5000)],...extra}));Home.ensureHousehold();
}
function page(name,html=''){
  const dom=new JSDOM(`<body data-page="${name}"><button id="launcher">Abrir</button><main>${html}</main></body>`,{url:'https://app.test/'+name+'.html'});
  globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.Option=dom.window.Option;globalThis.CustomEvent=dom.window.CustomEvent;globalThis.alert=()=>{};globalThis.confirm=()=>true;
  return dom;
}
test.beforeEach(t=>{t.mock.timers.enable({apis:['Date'],now});localStorage.clear();reset();page('home');});

test('restaurar un respaldo anidado inválido conserva memoria y presupuesto guardado',()=>{
  const before=structuredClone(Data.getState()),disk=localStorage.getItem(STORAGE_KEY);
  assert.throws(()=>Data.restaurar('{"deudas":[null]}'));
  assert.deepEqual(Data.getState(),before);assert.equal(localStorage.getItem(STORAGE_KEY),disk);
  Data.loadData();assert.equal(Data.getState().movimientos.length,1);
});

test('arranque con dato ilegible ofrece recuperación sin sobrescribirlo',async()=>{
  const backup=JSON.stringify(Data.getState()),before=structuredClone(Data.getState());localStorage.setItem(STORAGE_KEY,'{"deudas":[null]}');
  assert.throws(()=>Data.loadData(),/STORAGE_DATA_INVALIDA/);assert.deepEqual(Data.getState(),before);assert.equal(localStorage.getItem(STORAGE_KEY),'{"deudas":[null]}');
  let restored=false;Recovery.showStorageRecovery(()=>{restored=true;});assert.match(document.body.textContent,/presupuesto guardado se conserva/);
  const input=document.getElementById('restoreRecoveryFile');Object.defineProperty(input,'files',{value:[{text:async()=>backup}]});await input.onchange({target:input});
  assert.equal(restored,true);assert.ok([...localStorage.data.keys()].some(k=>k.startsWith(STORAGE_KEY+'_unreadable_')));Data.loadData();assert.equal(Accounts.accountBalance('acct-personal'),5000);
});

test('fallo de almacenamiento revierte pago y el mismo reintento queda persistido una sola vez',()=>{
  const item=Costs.createOperatingObligation({name:'Herramienta',amount:125,frequency:'weekly',nextDueDate:'2026-10-08'}),before=structuredClone(Data.getState());
  localStorage.fail=true;
  assert.throws(()=>Costs.payOperatingObligation(item.id,{amount:125,operationId:'payment-once'}),/quota/);
  assert.deepEqual(Data.getState(),before);localStorage.fail=false;
  Costs.payOperatingObligation(item.id,{amount:125,operationId:'payment-once'});
  Costs.payOperatingObligation(item.id,{amount:125,operationId:'payment-once'});
  Data.loadData();assert.equal(Data.getState().movimientos.filter(m=>m.operationId==='payment-once').length,1);assert.equal(Accounts.accountBalance('acct-personal'),4875);
});

test('crear una obligación con primer pago es una sola transacción recuperable',()=>{
  const before=structuredClone(Data.getState());localStorage.fail=true;
  assert.throws(()=>Costs.createOperatingObligation({name:'Servicio',amount:150,frequency:'weekly',nextDueDate:'2026-10-08',operationId:'create-paid'},{paid:true}),/quota/);
  assert.deepEqual(Data.getState(),before);localStorage.fail=false;
  Costs.createOperatingObligation({name:'Servicio',amount:150,frequency:'weekly',nextDueDate:'2026-10-08',operationId:'create-paid'},{paid:true});
  Data.loadData();assert.equal(Costs.operatingObligations().length,1);assert.equal(Accounts.accountBalance('acct-personal'),4850);
});

test('gasto directo valida fecha antes de crear, debita la cuenta elegida y es idempotente',()=>{
  Data.crearCuenta({id:'bank',name:'Banco',type:'bank'});Data.getState().movimientos.push(income('bank-opening',300,{accountId:'bank'}));Data.sanearDatos();
  const before=structuredClone(Data.getState());
  assert.throws(()=>Home.recordDirectHouseholdExpense({name:'Compra',amount:40,date:'2026-10-03'}),/PAGO_FECHA_FUTURA/);assert.deepEqual(Data.getState(),before);
  assert.throws(()=>Home.recordDirectHouseholdExpense({name:'Compra',amount:40,date:'2026-02-30'}),/FECHA_HOGAR_INVALIDA/);assert.deepEqual(Data.getState(),before);
  const payload={name:'Compra',amount:40,accountId:'bank',operationId:'quick-once'};
  const writes=localStorage.writes;Home.recordDirectHouseholdExpense(payload);assert.equal(localStorage.writes-writes,1);
  Home.recordDirectHouseholdExpense(payload);assert.equal(Accounts.accountBalance('bank'),260);assert.equal(Accounts.accountBalance('acct-personal'),5000);
  assert.equal(Home.householdSummary().spent,40);assert.equal(Home.householdItems().filter(x=>x.kind==='spent').length,1);
  assert.throws(()=>Home.recordDirectHouseholdExpense({...payload,amount:41}),/OPERACION_INCOMPATIBLE/);
  Data.loadData();assert.equal(Data.getState().movimientos.filter(m=>m.operationId==='quick-once').length,1);
});

test('gasto directo no deja un plan o saldo fantasma al fallar la escritura',()=>{
  const before=structuredClone(Data.getState());localStorage.fail=true;
  assert.throws(()=>Home.recordDirectHouseholdExpense({name:'Compra',amount:40}),/quota/);assert.deepEqual(Data.getState(),before);
});

test('consejo de ahorro protege el mínimo de flujo de 45 días aunque hoy haya más efectivo',()=>{
  const goal=Goals.createSavingsGoal({name:'Objetivo',targetAmount:6000});Goals.contributeToSavingsGoal(goal.id,1000);
  Home.createHouseholdExpense({name:'Pago próximo',amount:3000,kind:'obligation',frequency:'one_time',nextDueDate:'2026-10-04'});
  const advice=Goals.savingsCapacity(goal.id);assert.equal(advice.safeFreeCash,4000);assert.equal(advice.suggestedNow,1000);
  Goals.contributeToSavingsGoal(goal.id,advice.suggestedNow);assert.equal(Forecast.cashFlowForecast({includeVariable:false}).endingFree,0);
});

test('tarjetas y plan comparten un único fondo entre metas y entre fuentes',()=>{
  reset({workSources:[{id:'a',name:'Fuente A',kind:'freelance',compensation:'variable',active:true},{id:'b',name:'Fuente B',kind:'freelance',compensation:'variable',active:true}],movimientos:[income('a-income',1000,{categoria:'Trabajo',sourceId:'a'}),income('b-income',1000,{categoria:'Trabajo',sourceId:'b'})]});
  const first=Goals.createSavingsGoal({name:'Objetivo A',targetAmount:1000}),second=Goals.createSavingsGoal({name:'Objetivo B',targetAmount:1000});
  const advice=Goals.savingsAdvicePortfolio(),plans=Health.goalPortfolioPlan();
  assert.equal(advice.reduce((sum,p)=>sum+p.suggestedNow,0),2000);
  for(const id of ['a','b'])assert.equal(advice.flatMap(p=>p.sources).filter(s=>s.id===id).reduce((sum,s)=>sum+s.suggested,0),1000);
  assert.deepEqual(plans.map(p=>p.suggestedNow),[Goals.savingsCapacity(first.id).suggestedNow,Goals.savingsCapacity(second.id).suggestedNow]);
});

test('dos automatizaciones de 100% nunca apartan más que el ingreso que las dispara',()=>{
  const a=Goals.createSavingsGoal({name:'Objetivo A',targetAmount:2000}),b=Goals.createSavingsGoal({name:'Objetivo B',targetAmount:2000});
  Automation.createReserveRule({goalId:a.id,percent:100});Automation.createReserveRule({goalId:b.id,percent:100});
  Accounts.recordUniversalMovement({type:'income',description:'Cobro',amount:100,accountId:'acct-personal'});
  Automation.runAutomationEngine();Automation.runAutomationEngine();
  assert.equal(Goals.totalReservedSavings(),100);assert.equal(Data.getState().ruleApplications.filter(a=>a.status==='applied').reduce((sum,a)=>sum+a.amount,0),100);
});

test('modal conserva los campos ante error y una confirmación exitosa sólo se ejecuta una vez',()=>{
  let calls=0;Render.Modal.show('Prueba',[{key:'name',label:'Concepto',value:'Compra'}],()=>{calls++;return Render.Modal.error('Corrige el importe.');});
  document.getElementById('modalConfirm').click();assert.equal(document.getElementById('appModal').style.display,'flex');assert.equal(document.querySelector('[data-k="name"]').value,'Compra');assert.equal(document.getElementById('modalError').textContent,'Corrige el importe.');
  Render.Modal.show('Guardar',[],()=>{calls++;});document.getElementById('modalConfirm').click();document.getElementById('modalConfirm').click();assert.equal(calls,2);
});

test('registro rápido funciona desde las cinco pestañas y conserva el gasto al fallar almacenamiento',()=>{
  for(const name of ['index','home','wallet','admin','historial']){page(name);Quick.initQuickExpense();document.getElementById('btnQuickExpense').click();assert.equal(document.getElementById('modalTitle').textContent,'Registrar gasto');assert.equal(document.querySelector('[data-k="kind"]'),null);assert.equal(document.querySelector('[data-k="frequency"]'),null);}
  document.querySelector('[data-k="amount"]').value='25.50';document.querySelector('[data-k="name"]').value='Pasaje';
  localStorage.fail=true;document.getElementById('modalConfirm').click();assert.equal(document.getElementById('appModal').style.display,'flex');assert.equal(document.querySelector('[data-k="amount"]').value,'25.50');
  localStorage.fail=false;document.getElementById('modalConfirm').click();document.getElementById('modalConfirm').click();Data.loadData();assert.equal(Home.householdSummary().spent,25.5);assert.equal(Data.getState().movimientos.length,2);
});

test('nombres importados se muestran como texto sin crear elementos ejecutables',()=>{
  const hostile='<img src=x onerror=alert(1)>';
  reset({workSources:[{id:'source',name:hostile,kind:'employment',compensation:'biweekly',trackTime:true,active:true}],deudas:[{id:'debt',desc:hostile,saldo:100,montoCuota:10,frecuencia:'Mensual'}]});
  page('index','<div id="sourceSummaryZone"></div><div id="todayActivityZone"></div><div id="panelAlerts"></div>');Render.renderIndex();assert.equal(document.querySelector('img'),null);assert.match(document.getElementById('sourceSummaryZone').textContent,/<img src/);
  page('admin','<div id="activitySourceZone"></div><div id="listaDeudasAdmin"></div><div id="debtPaymentForm"><select id="abonoDeudaSelect"></select></div><button id="btnConfigKM">KM inicial</button>');Render.renderAdmin();assert.equal(document.querySelector('img'),null);assert.match(document.getElementById('listaDeudasAdmin').textContent,/<img src/);assert.equal(document.getElementById('debtPaymentForm').hidden,false);
  Data.getState().deudas=[];Data.getState().parametros.kmInicialConfigurado=true;Render.renderAdmin();assert.equal(document.getElementById('debtPaymentForm').hidden,true);assert.equal(document.getElementById('btnConfigKM').hidden,true);
});

test('historial muestra vencimientos, reservas neutrales y permite leer más de 150 eventos',()=>{
  const rows=Array.from({length:170},(_,i)=>({...income(`expense-${i}`,10),tipo:'gasto',desc:'Compra '+i}));
  rows.push({...income('weekly-a',125),tipo:'gasto',desc:'Servicio',operatingDueDate:'2026-10-08'},{...income('weekly-b',125),tipo:'gasto',desc:'Servicio',operatingDueDate:'2026-10-15'}, {...income('reserve',50),tipo:'gasto',desc:'Reserva',categoria:'Meta',goalId:'g',affectsPersonal:false},{...income('audit',200),tipo:'gasto',desc:'Ajuste de conciliación',categoria:'Sistema',movementKind:'reconciliation',reconciliation:{previousBalance:500,confirmedBalance:300}});reset({movimientos:rows});
  page('historial','<table><tbody id="tablaBody"></tbody></table>');Platform.initFinancialPlatformEvents();Platform.renderFinancialPlatform();assert.equal(document.querySelectorAll('#tablaBody tr').length,100);
  document.querySelector('[data-platform-action="history-more"]').click();assert.equal(document.querySelectorAll('#tablaBody tr').length,174);assert.match(document.getElementById('tablaBody').textContent,/Cubre vencimiento del 8 oct/);assert.match(document.getElementById('tablaBody').textContent,/Cubre vencimiento del 15 oct/);
  const reserve=[...document.querySelectorAll('tr')].find(tr=>tr.textContent.includes('Reserva'));assert.match(reserve.lastElementChild.textContent,/⇄/);assert.doesNotMatch(reserve.lastElementChild.textContent,/-/);assert.equal(document.querySelector('[data-platform-action="history-more"]'),null);
  const adjustment=[...document.querySelectorAll('tr')].find(tr=>tr.textContent.includes('Ajuste de conciliación'));assert.match(adjustment.textContent,/\$500.00 → \$300.00/);assert.match(adjustment.lastElementChild.textContent,/↻ -\$200.00/);assert.equal(adjustment.lastElementChild.style.color,'rgb(99, 102, 241)');
});

test('anticipos operativos indican cobertura y fecha real sin borrar pagos iguales',()=>{
  const item=Costs.createOperatingObligation({name:'Servicio',amount:125,frequency:'weekly',nextDueDate:'2026-10-08'});
  for(let i=0;i<4;i++)Costs.payOperatingObligation(item.id,{operationId:'week-'+i});
  page('admin','<div id="operatingObligationRows"></div>');OpUI.renderOperatingCosts(now);
  assert.equal(document.querySelectorAll('[data-operating-payment]').length,4);assert.match(document.getElementById('operatingObligationRows').textContent,/Cubre el vencimiento/);assert.equal(document.querySelector('[data-operating-action="pay"]').textContent,'Registrar anticipo');assert.equal(Costs.operatingUpcomingEvents({now})[0].dueDate.slice(0,10),'2026-11-05');
});
