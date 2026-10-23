import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';

class Storage{data=new Map();fail=false;getItem(k){return this.data.get(k)??null;}setItem(k,v){if(this.fail)throw new Error('quota');this.data.set(k,String(v));}clear(){this.data.clear();this.fail=false;}}
globalThis.localStorage=new Storage();
const Data=await import('../js/02_data.js');
const UI=await import('../js/30_financial_audit_ui.js');
const Fresh=await import('../js/29_financial_freshness.js');
const Rules=await import('../js/domain/financial-rules.js');
const Charts=await import('../js/04_charts.js');
const Goals=await import('../js/11_savings_goals.js');
const {financialContext}=await import('../js/app/financial-context.js');
const now=new Date('2026-10-21T18:00:00Z');
function reset(extra={}){
  Data.restaurar(JSON.stringify({...Data.createEmptyState(),profile:{onboarded:true,currency:'MXN',transportMode:'none'},
    accounts:[{id:'acct-personal',name:'Efectivo de prueba',ownership:'personal',type:'cash',active:true}],
    movimientos:[{id:'old',fecha:'2026-10-04T18:00:00Z',tipo:'ingreso',desc:'Cobro antiguo',monto:1000,categoria:'Trabajo',sourceId:'job',accountId:'acct-personal',affectsPersonal:true}],
    savingsGoals:[{id:'goal',name:'Objetivo de prueba',targetAmount:2000,reserved:200,active:true,history:[{id:'h',fecha:'2026-10-04T18:00:00Z',type:'reserve',amount:200}]}],
    workSources:[{id:'job',name:'Trabajo de prueba',kind:'employment',compensation:'biweekly',status:'active',active:true}],...extra}));
}
function page(){const dom=new JSDOM('<body data-page="index"><main><p id="mainSummaryValue">sin-render</p></main></body>',{url:'https://audit.test/index.html'});globalThis.document=dom.window.document;globalThis.window=dom.window;globalThis.CustomEvent=dom.window.CustomEvent;globalThis.Option=dom.window.Option;globalThis.alert=()=>{};globalThis.confirm=()=>true;Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});return dom;}
const label=name=>[...document.querySelectorAll('input,select')].find(el=>el.getAttribute('aria-label')===name);
const clickText=text=>[...document.querySelectorAll('button')].find(el=>el.textContent===text).click();
const fill=(name,value)=>{const el=label(name);el.value=String(value);el.dispatchEvent(new window.Event('input',{bubbles:true}));return el;};
const submit=()=>{const form=document.querySelector('.audit-form');form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));return form;};
test.beforeEach(t=>{t.mock.timers.enable({apis:['Date'],now});localStorage.clear();reset();page();});

test('retorno automático pide datos actuales vacíos, incluye metas y mantiene sincronización fuera del formulario',()=>{
  assert.equal(UI.showFinancialAudit(),true);assert.match(document.body.textContent,/Bienvenido de vuelta/);
  assert.equal(label('Efectivo de prueba').value,'');assert.equal(label('Objetivo de prueba').value,'');assert.equal(label('Estado actual de Trabajo de prueba').value,'');
  assert.equal(document.querySelector('[aria-label="Volver sin guardar"]'),null);assert.equal(document.getElementById('auditSyncPanel').closest('form'),null);
  assert.equal(Data.getState().movimientos.length,1);assert.equal(document.body.style.overflow,'hidden');
});

test('actualización manual abre aunque hubo registros recientes y cancelar no modifica el presupuesto',()=>{
  reset({financialPlan:{freshness:{lastConfirmedAt:now.toISOString()}}});assert.equal(Fresh.financialFreshness().stale,false);
  const before=structuredClone(Data.getState());assert.equal(UI.showFinancialAudit(()=>{},{manual:true}),true);clickText('Volver sin guardar');
  // ensureSavingsGoals may normalize; no money, account or goal changes occur.
  assert.deepEqual(Data.getState().movimientos,before.movimientos);assert.equal(Data.getState().savingsGoals[0].reserved,200);assert.equal(UI.isFinancialAuditOpen(),false);assert.equal(document.body.style.overflow,'');
});

test('auditoría permite separar efectivo, dos cuentas y ahorro ya incluido; doble envío no duplica ajustes',()=>{
  let completed=0;UI.showFinancialAudit(()=>completed++);const original=structuredClone(Data.getState().movimientos[0]);
  fill('Efectivo de prueba',100);fill('Objetivo de prueba',250);label('Estado actual de Trabajo de prueba').value='active';
  clickText('+ Agregar otra cuenta');fill('Nombre de la cuenta nueva','Banco de prueba A');fill('Saldo de la cuenta nueva',150);
  clickText('+ Agregar otra cuenta');const names=document.querySelectorAll('[aria-label="Nombre de la cuenta nueva"]'),balances=document.querySelectorAll('[aria-label="Saldo de la cuenta nueva"]');names[1].value='Cuenta de ahorro B';names[1].dispatchEvent(new window.Event('input',{bubbles:true}));balances[1].value='250';balances[1].dispatchEvent(new window.Event('input',{bubbles:true}));
  const goalAccount=label('¿Dónde está el apartado de Objetivo de prueba?');goalAccount.value=[...goalAccount.options].find(o=>o.textContent==='Cuenta de ahorro B').value;
  assert.match(document.querySelector('.audit-summary').textContent,/Dinero total: \$500.00/);assert.match(document.querySelector('.audit-summary').textContent,/Fuera de apartados: \$250.00/);
  const form=submit();form.dispatchEvent(new window.Event('submit',{cancelable:true}));assert.equal(completed,1,document.querySelector('.audit-error')?.textContent);assert.equal(Rules.personalCash(Data.getState()),500);assert.equal(Rules.reservedSavings(Data.getState()),250);assert.equal(Data.getState().accounts.length,3);
  assert.deepEqual(Data.getState().movimientos[0],original);assert.equal(Data.getState().savingsGoals[0].accountId,goalAccount.value);
  assert.equal(Charts.resumenGlobal(Data.getState()).gastos,0);assert.equal(Goals.savingsCapacity('goal').monthlyExpenses,0);assert.equal(financialContext().monthly.additionalObserved,0);
  assert.equal(Fresh.financialFreshness().stale,false);assert.equal(document.body.style.overflow,'');
});

test('escritura fallida conserva captura y vuelve a guardar una sola conciliación',()=>{
  UI.showFinancialAudit();fill('Efectivo de prueba',300);fill('Objetivo de prueba',100);label('Estado actual de Trabajo de prueba').value='active';
  const before=structuredClone(Data.getState());localStorage.fail=true;submit();assert.equal(UI.isFinancialAuditOpen(),true);assert.deepEqual(Data.getState(),before);assert.equal(label('Efectivo de prueba').value,'300');assert.match(document.querySelector('.audit-error').textContent,/espacio disponible/);
  localStorage.fail=false;submit();assert.equal(UI.isFinancialAuditOpen(),false);assert.equal(Data.getState().financialPlan.freshness.auditHistory.length,1);assert.equal(Rules.personalCash(Data.getState()),300);
});

test('un cambio de cuenta mientras se revisa impide certificar el estado obsoleto y permite renovar revisión',()=>{
  UI.showFinancialAudit();fill('Efectivo de prueba',300);fill('Objetivo de prueba',100);label('Estado actual de Trabajo de prueba').value='active';
  Data.getState().accounts[0].name='Cuenta renombrada';submit();assert.match(document.querySelector('.audit-error').textContent,/datos cambiaron/);assert.equal(Data.getState().financialPlan?.freshness?.lastAuditedAt,undefined);
  clickText('Actualizar esta revisión');assert.equal(label('Cuenta renombrada').value,'');assert.equal(document.querySelector('.audit-form input').value,'');
});

test('metas legacy se incluyen antes de tomar el fingerprint',()=>{
  reset({savingsGoals:[],gastosFijosMensuales:[{id:'legacy',desc:'Apartado anterior',monto:800,categoria:'Ahorro',frecuencia:'Unico'}],wallet:{saldo:1000,sobres:[{id:'env',refId:'legacy',acumulado:100}]}});
  UI.showFinancialAudit();assert.ok(label('Apartado anterior'));assert.equal(Data.getState().savingsGoals[0].id,'legacy');
});

test('arranque suspendido presenta auditoría antes de renderizar proyecciones y ejecutar automatizaciones',async()=>{
  const before=structuredClone(Data.getState().movimientos);globalThis.auditStartupSyncCalls=0;
  let source=await readFile(new URL('../js/05_init.js',import.meta.url),'utf8');
  source=source.replace("import { initSync, notifyLocalChange, renderSyncUI } from './07_sync.js';",'const initSync=()=>{globalThis.auditStartupSyncCalls++;return Promise.resolve();},notifyLocalChange=()=>{},renderSyncUI=()=>{};');
  source=source.replace("import { initPWA, promptInstall, canPromptInstall } from './08_pwa.js';",'const initPWA=()=>{},promptInstall=async()=>false,canPromptInstall=()=>false;');
  source=source.replace(/from '(\.\/[^']+)'/g,(_all,path)=>`from '${new URL(path,new URL('../js/05_init.js',import.meta.url)).href}'`);
  await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));document.dispatchEvent(new window.Event('DOMContentLoaded'));
  assert.equal(UI.isFinancialAuditOpen(),true);assert.equal(document.getElementById('mainSummaryValue').textContent,'sin-render');assert.deepEqual(Data.getState().movimientos,before);assert.equal(globalThis.auditStartupSyncCalls,1);
});
