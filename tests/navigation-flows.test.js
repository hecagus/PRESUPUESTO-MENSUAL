import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import * as Data from '../js/02_data.js';
import * as Home from '../js/23_home_semantics.js';
import * as Accounts from '../js/15_accounts_engine.js';
import * as Savings from '../js/11_savings_goals.js';
import * as Finance from '../js/21_financial_life_v27.js';
import {renderDebt,initDebtEvents} from '../js/ui/debt.js';
import {renderSettings,initSettingsEvents,saveSourceSettings} from '../js/pages/settings.js';
import {renderIndex,renderWallet,renderAdmin,renderStats} from '../js/03_render.js';
import {renderHome} from '../js/22_home_ui.js';
import {renderCalendarPage,renderCalendarPreview,renderFinancialPositionPanel} from '../js/14_calendar_ui.js';
import {renderFinancialPlatform,ensureFinancialPlatform} from '../js/19_platform_ui.js';
import {renderSavingsGoalsUI} from '../js/12_savings_ui.js';
import {renderActivityInsights} from '../js/25_activity_insights.js';
import {initDataTools} from '../js/ui/data-tools.js';
import {setSyncNotice} from '../js/ui/sync-notice.js';
async function surface(file){
  const dom=new JSDOM(await readFile(new URL('../'+file,import.meta.url),'utf8'),{url:'https://app.example/'+file});
  globalThis.document=dom.window.document;globalThis.window=dom.window;globalThis.localStorage=dom.window.localStorage;
  globalThis.Option=dom.window.Option;globalThis.CustomEvent=dom.window.CustomEvent;
  globalThis.confirm=()=>true;globalThis.alert=message=>assert.fail(message);
  return dom;
}
function seed(){
  Data.restaurar(JSON.stringify(Data.createEmptyState()));
  Data.crearFuenteTrabajo({id:'job',name:'Trabajo',kind:'employment',compensation:'biweekly',transportMode:'motorcycle',fuelPayer:'company',trackTime:true,trackDistance:true});
  Data.configurarOnboarding({displayName:'Actual',transportMode:'motorcycle',openingBalance:10000,useCases:['employment']});
  Data.registrarFondoFuente('job',500);
  Data.nuevaDeuda('Equipo',2000,500,'Mensual',10);
  Home.createHouseholdExpense({id:'housing',name:'Renta',kind:'obligation',amount:2000,frequency:'monthly',nextDueDate:'2026-10-10'});
  for(const [id,frequency,amount] of [['weekly-food','weekly',500],['biweekly-food','biweekly',1000],['monthly-food','monthly',2000]])Home.createHouseholdExpense({id,name:id,kind:'budget',amount,frequency,category:'Alimentación'});
  Accounts.ensureAccountsEngine();Savings.ensureSavingsGoals();Finance.ensureFinancialLife();ensureFinancialPlatform();
}
test('existing budget and financial position are unchanged by rendering all reorganized views',async()=>{
  await surface('index.html');seed();
  const baseline=structuredClone(Data.getState()),position=Finance.financialPosition();
  for(const [page,render] of [['index.html',()=>{renderIndex();renderFinancialPositionPanel();renderCalendarPreview();}],['home.html',renderHome],['admin.html',()=>{renderAdmin();renderActivityInsights();}],['wallet.html',()=>{renderWallet();renderDebt();renderSavingsGoalsUI();}],['historial.html',()=>{}],['calendar.html',renderCalendarPage],['stats.html',renderStats],['settings.html',renderSettings]]){
    // Keep one storage account while swapping the document for each route.
    const storage=globalThis.localStorage;await surface(page);globalThis.localStorage=storage;
    render();renderFinancialPlatform();
    assert.deepEqual(Finance.financialPosition(),position,page);
    assert.deepEqual(Data.getState().movimientos,baseline.movimientos,page);
    assert.deepEqual(Data.getState().deudas,baseline.deudas,page);
    assert.deepEqual(Data.getState().financialPlan.householdExpenses,baseline.financialPlan.householdExpenses,page);
    assert.equal(Data.getState().workSources[0].fundAccountId,baseline.workSources[0].fundAccountId,page);
  }
});
test('Dinero debt creation and repayment use the same IDs, cash movement and remaining balance',async()=>{
  await surface('wallet.html');seed();renderDebt();initDebtEvents(fn=>{fn();renderDebt();});
  const debt=Data.getState().deudas[0],before=Data.getState().wallet.saldo;
  document.getElementById('abonoDeudaSelect').value=debt.id;document.getElementById('btnAbonoCuota').click();
  assert.equal(Data.getState().deudas[0].saldo,1500);assert.equal(Data.getState().wallet.saldo,before-500);
  assert.equal(Data.getState().movimientos.filter(m=>m.debtId===debt.id).length,1);
  document.getElementById('btnDeudaNueva').click();
  for(const [key,value] of Object.entries({d:'Compra',t:1000,c:1000,f:'Unico',dp:5}))document.querySelector('[data-k="'+key+'"]').value=value;
  document.getElementById('modalConfirm').click();
  assert.equal(Data.getState().deudas.length,2);assert.match(document.getElementById('debtList').textContent,/Compra.*Una sola vez/);
});
test('Settings edits existing profile and source without replacing history or third-party funds',async()=>{
  await surface('settings.html');seed();renderSettings();initSettingsEvents(fn=>{fn();renderSettings();});
  const state=Data.getState(),history=structuredClone(state.movimientos),fundId=state.workSources[0].fundAccountId,home=structuredClone(state.financialPlan.householdExpenses);
  document.getElementById('profileName').value='Nuevo nombre';
  document.getElementById('profileTransport').value='public';
  document.getElementById('profileForm').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));
  assert.equal(Data.getState().profile.displayName,'Nuevo nombre');
  assert.equal(Data.getState().parametros.saldoInicialConfigurado,true);
  document.querySelector('[data-settings-source]').click();
  assert.equal(document.querySelector('[data-k="compensation"]').value,'biweekly');
  assert.equal(document.querySelector('[data-k="fuelPayer"]').value,'company');
  for(const [key,value] of Object.entries({name:'Trabajo nuevo',compensation:'weekly',status:'paused',transportMode:'public',outboundRides:2,returnRides:2,fare:10,daysPerWeek:5}))document.querySelector('[data-k="'+key+'"]').value=value;
  document.getElementById('modalConfirm').click();
  const source=Data.fuenteById('job');assert.equal(source.compensation,'weekly');assert.equal(source.active,false);assert.equal(source.fundAccountId,fundId);assert.equal(source.transport.public.fare,10);
  assert.deepEqual(Data.getState().movimientos,history);assert.deepEqual(Data.getState().financialPlan.householdExpenses,home);
  assert.equal(Data.getState().fondosCombustibleEmpresa[0].accountId,fundId);
  Data.loadData();assert.equal(Data.fuenteById('job').name,'Trabajo nuevo');assert.equal(Data.getState().wallet.saldo,10000);
});
test('invalid source settings fail before mutating persisted records',async()=>{
  await surface('settings.html');seed();const before=structuredClone(Data.getState());
  assert.throws(()=>saveSourceSettings('job',{name:'Trabajo',kind:'employment',compensation:'weekly',transportMode:'public',outboundRides:1,returnRides:1,fare:-5,daysPerWeek:5}),/CONFIGURACION_INVALIDA/);
  assert.deepEqual(Data.getState(),before);
});
test('transfers and savings in Dinero do not inflate personal cash or count employer funds',async()=>{
  await surface('wallet.html');seed();
  const bank=Accounts.createPersonalAccount({name:'Banco',type:'bank'}),before=Finance.financialPosition();
  Accounts.transferBetweenAccounts({fromAccountId:'acct-personal',toAccountId:bank.id,amount:2000});
  assert.equal(Finance.financialPosition().cash,before.cash);
  const goal=Savings.createSavingsGoal({name:'Meta',targetAmount:1000});Savings.contributeToSavingsGoal(goal.id,100);
  assert.equal(Finance.financialPosition().cash,before.cash);assert.equal(Finance.financialPosition().reserved,100);
  assert.equal(Data.saldoFondoFuente('job').disponible,500);assert.equal(Finance.financialPosition().cash,10000);
});
test('Backup tools round-trip the same state and conflict notices lead to Settings',async()=>{
  await surface('settings.html');seed();const backup=JSON.stringify(Data.getState()),debtId=Data.getState().deudas[0].id;
  initDataTools(fn=>fn());document.getElementById('btnRestoreBackup').click();
  document.querySelector('[data-k="j"]').value=backup;document.getElementById('modalConfirm').click();
  assert.equal(Data.getState().deudas[0].id,debtId);assert.equal(Data.getState().wallet.saldo,10000);
  await surface('admin.html');setSyncNotice('Hay un conflicto pendiente.');
  assert.equal(document.querySelector('#syncNotice a').getAttribute('href'),'settings.html#syncCard');
  setSyncNotice(null);assert.equal(document.getElementById('syncNotice'),null);
});
