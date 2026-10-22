import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';

const adminHtml=await readFile(new URL('../admin.html',import.meta.url),'utf8');
let dom,alerts,job,gig;
function page(){
  dom=new JSDOM(adminHtml,{url:'https://app.test/admin.html'});
  globalThis.document=dom.window.document;globalThis.localStorage=dom.window.localStorage;
  globalThis.Option=dom.window.Option;alerts=[];globalThis.alert=message=>alerts.push(message);
}
page();
const Data=await import('../js/02_data.js');
const Accounts=await import('../js/15_accounts_engine.js');
const Life=await import('../js/21_financial_life_v27.js');
const Charts=await import('../js/04_charts.js');
const Platform=await import('../js/19_platform_ui.js');
const {showFuelModal}=await import('../js/ui/fuel.js');
const {mergeStates}=await import('../js/26_sync_merge.js');
const {fuelFundTotals}=await import('../js/domain/financial-rules.js');
const close=(a,b)=>assert.ok(Math.abs(a-b)<0.005,`${a} != ${b}`);
const fill=extra=>Data.registrarCombustible({litros:3.21,costo:74.79,km:33173,...extra});
const field=key=>document.querySelector(`[data-k="${key}"]`);
const open=()=>showFuelModal(fn=>fn());
const enter=(key,value)=>{field(key).value=String(value);};
const save=()=>document.getElementById('modalConfirm').click();
const ticket=()=>Data.cuentaById(job.fundAccountId);

test.beforeEach(t=>{
  t.mock.timers.enable({apis:['Date'],now:new Date('2026-10-02T16:30:00')});page();
  Data.restaurar(JSON.stringify(Data.createEmptyState()));
  Data.configurarOnboarding({transportMode:'motorcycle',openingBalance:1000,sources:[
    {id:'job',name:'Empresa principal',kind:'employment',compensation:'biweekly',fuelPayer:'company'},
    {id:'gig',name:'Plataforma',kind:'gig',compensation:'per_shift',fuelPayer:'personal'}
  ]});
  job=Data.fuenteById('job');gig=Data.fuenteById('gig');ticket().name='Ticket Car';
  Data.configurarKM(33000);Data.registrarFondoFuente(job.id,500);Life.ensureFinancialLife();
});

test('Uber activo y Ticket Car: consume el fondo, conserva efectivo y no crea gasto personal',()=>{
  Data.iniciarActividad(gig.id);const active=structuredClone(Data.getState().activeActivity),count=Data.getState().movimientos.length;
  fill({accountId:job.fundAccountId});const state=Data.getState(),c=state.cargasCombustible.at(-1);
  assert.equal(c.pagador,'empresa');assert.equal(c.sourceId,gig.id);assert.equal(c.accountId,job.fundAccountId);
  close(c.costo,74.79);close(c.costo/c.litros,23.30);close(state.wallet.saldo,1000);
  assert.equal(state.movimientos.length,count);assert.deepEqual(state.activeActivity,active);assert.equal(Data.fuenteById(gig.id).fuelPayer,'personal');
  close(Data.saldoFondoFuente(job.id).utilizado,74.79);close(Data.saldoFondoFuente(job.id).disponible,425.21);
  close(Data.saldoCuenta(job.fundAccountId),425.21);close(Accounts.accountBalance(job.fundAccountId),425.21);
  close(Life.financialPosition().cash,1000);close(Life.sourceCostProfile(gig.id).actualCosts,0);close(Charts.metricasFuente(state,gig.id).combustible,0);
  close(Charts.resumenJaimau(state).gasDisponible,425.21);assert.equal(state.parametros.ultimoKM,33173);
});

test('actividad de empresa pagada de caja: sólo descuenta efectivo personal y no consume fondo',()=>{
  Data.iniciarActividad(job.id);fill({accountId:'acct-personal'});const state=Data.getState();
  assert.equal(state.cargasCombustible.at(-1).pagador,'personal');close(state.wallet.saldo,925.21);
  close(Data.saldoFondoFuente(job.id).utilizado,0);close(Data.saldoFondoFuente(job.id).disponible,500);
  close(Accounts.accountBalance(job.fundAccountId),500);close(Charts.resumenJaimau(state).gasUtilizado,0);
  assert.equal(state.movimientos.filter(m=>m.tipo==='gasto').length,1);close(Life.sourceCostProfile(job.id).actualCosts,74.79);
});

test('cuenta bancaria elegida: descuenta de esa cuenta una vez, conserva caja y atribuye costo a la actividad',()=>{
  const bank=Accounts.createPersonalAccount({name:'Banco',type:'bank'});
  Accounts.transferBetweenAccounts({fromAccountId:'acct-personal',toAccountId:bank.id,amount:300});
  Data.iniciarActividad(gig.id);fill({accountId:bank.id});
  close(Accounts.accountBalance(bank.id),225.21);close(Accounts.accountBalance('acct-personal'),700);
  close(Accounts.personalCashTotal(),925.21);close(Data.getState().wallet.saldo,925.21);
  assert.equal(Data.getState().movimientos.at(-1).accountId,bank.id);close(Life.sourceCostProfile(gig.id).actualCosts,74.79);
  close(Charts.metricasFuente(Data.getState(),gig.id).costosOperativos,74.79);close(Data.saldoFondoFuente(job.id).disponible,500);
});

test('varios fondos: se consume únicamente la cuenta elegida, aunque esté activa otra empresa',()=>{
  Data.crearFuenteTrabajo({id:'other-job',name:'Otra empresa',kind:'employment',compensation:'monthly',fuelPayer:'company'});
  const other=Data.fuenteById('other-job');Data.registrarFondoFuente(other.id,200);Data.iniciarActividad(job.id);
  fill({accountId:other.fundAccountId});
  close(Data.saldoFondoFuente(job.id).disponible,500);close(Data.saldoFondoFuente(other.id).disponible,125.21);
  close(Accounts.accountBalance(other.fundAccountId),125.21);close(Data.getState().wallet.saldo,1000);
  assert.equal(Data.getState().cargasCombustible.at(-1).sourceId,job.id);
});

test('uso personal explícito conserva la actividad en marcha y no le atribuye el repostaje',()=>{
  Data.iniciarActividad(gig.id);const active=structuredClone(Data.getState().activeActivity);
  fill({sourceId:null,accountId:'acct-personal'});
  assert.equal(Data.getState().cargasCombustible.at(-1).sourceId,null);assert.equal(Data.getState().movimientos.at(-1).sourceId,null);
  assert.deepEqual(Data.getState().activeActivity,active);close(Life.sourceCostProfile(gig.id).actualCosts,0);close(Data.getState().wallet.saldo,925.21);
});

test('la actividad elegida no es sustituida por la actividad que está en marcha',()=>{
  Data.iniciarActividad(gig.id);fill({sourceId:job.id,accountId:'acct-personal'});
  assert.equal(Data.getState().cargasCombustible.at(-1).sourceId,job.id);assert.equal(Data.getState().movimientos.at(-1).sourceId,job.id);
  assert.equal(Data.getState().activeActivity.sourceId,gig.id);close(Life.sourceCostProfile(job.id).actualCosts,74.79);
});

test('cuenta vacía, inexistente o archivada y fuente inválida se rechazan sin guardar una carga ni alterar saldos',()=>{
  Data.iniciarActividad(gig.id);ticket().active=false;Data.saveData();
  const before=structuredClone(Data.getState());
  for(const [options,error] of [
    [{accountId:''},/CUENTA_COMBUSTIBLE_REQUERIDA/],
    [{accountId:'missing'},/CUENTA_NO_ENCONTRADA/],
    [{accountId:job.fundAccountId},/CUENTA_NO_ENCONTRADA/],
    [{accountId:'acct-personal',sourceId:'missing'},/FUENTE_NO_ENCONTRADA/]
  ]){assert.throws(()=>fill(options),error);assert.deepEqual(Data.getState(),before);}
});

test('compatibilidad: una llamada antigua sin cuenta conserva su comportamiento por defecto',()=>{
  Data.iniciarActividad(job.id);fill();close(Data.saldoFondoFuente(job.id).disponible,425.21);close(Data.getState().wallet.saldo,1000);
  Data.getState().activeActivity=null;Data.getState().turnoActivo=null;Data.iniciarActividad(gig.id);fill({km:33174});
  close(Data.getState().wallet.saldo,925.21);close(Data.saldoFondoFuente(job.id).disponible,425.21);
});

test('compatibilidad: pagador explícito personal prevalece sobre el valor por defecto de empresa',()=>{
  Data.iniciarActividad(job.id);fill({payer:'personal'});
  close(Data.saldoFondoFuente(job.id).disponible,500);close(Data.getState().wallet.saldo,925.21);
});

test('adaptador antiguo de gasolina respeta pago por empresa con actividad personal activa',()=>{
  Data.iniciarActividad(gig.id);Data.registrarGasolina(3.21,74.79,33173,'empresa','Estación');
  assert.equal(Data.getState().cargasCombustible.at(-1).sourceId,gig.id);close(Data.getState().wallet.saldo,1000);close(Data.saldoFondoFuente(job.id).disponible,425.21);
});

test('adaptador antiguo no elige un fondo arbitrario cuando hay varias empresas y ninguna activa',()=>{
  Data.crearFuenteTrabajo({name:'Otra empresa',kind:'employment',fuelPayer:'company'});Data.iniciarActividad(gig.id);
  const before=structuredClone(Data.getState());assert.throws(()=>Data.registrarGasolina(3.21,74.79,33173,'empresa'),/CUENTA_COMBUSTIBLE_REQUERIDA/);
  assert.deepEqual(Data.getState(),before);
});

test('guardado, recarga y respaldo conservan origen, actividad e historial sin reclasificar registros',()=>{
  Data.iniciarActividad(gig.id);fill({accountId:job.fundAccountId});
  const before=structuredClone(Data.getState()),backup=JSON.stringify(before);Data.loadData();
  assert.deepEqual(Data.getState().cargasCombustible,before.cargasCombustible);assert.deepEqual(Data.getState().movimientos,before.movimientos);
  Data.restaurar(backup);assert.deepEqual(Data.getState().cargasCombustible,before.cargasCombustible);
  close(Data.getState().wallet.saldo,1000);close(Data.saldoFondoFuente(job.id).disponible,425.21);
});

test('respaldo legacy sin IDs de combustible conserva fondos y cargas originales',()=>{
  const fecha=new Date().toISOString(),carga={id:'old-fill',fecha,litros:2,costo:50,km:1000,pagador:'empresa'};
  Data.restaurar(JSON.stringify({schemaVersion:12,movimientos:[],turnos:[],cargasCombustible:[carga],fondosCombustibleEmpresa:[{id:'old-fund',fecha,monto:300}],wallet:{saldo:0,sobres:[]},parametros:{}}));
  const legacy=Data.getState().workSources.find(s=>s.legacyKey==='jaimau');
  close(Data.saldoFondoFuente(legacy.id).disponible,250);close(Accounts.accountBalance(legacy.fundAccountId),250);
  assert.deepEqual(Data.getState().cargasCombustible,[carga]);close(Data.getState().wallet.saldo,0);
});

test('sync fusiona la carga por su ID y conserva la cuenta elegida sin duplicar cargos',()=>{
  Data.iniciarActividad(gig.id);const base=structuredClone(Data.getState());fill({accountId:job.fundAccountId});
  const local=structuredClone(Data.getState()),remote=structuredClone(base);
  remote.fondosCombustibleEmpresa.push({id:'remote-fund',fecha:new Date().toISOString(),monto:100,sourceId:job.id,accountId:job.fundAccountId});
  const merged=mergeStates(local,remote,base);assert.equal(merged.conflicts.length,0);Data.restaurar(JSON.stringify(merged.state));
  assert.equal(Data.getState().cargasCombustible.length,1);assert.equal(Data.getState().cargasCombustible[0].accountId,job.fundAccountId);
  close(Data.saldoFondoFuente(job.id).disponible,525.21);close(Data.getState().wallet.saldo,1000);
  const again=mergeStates(Data.getState(),Data.getState(),merged.state);assert.equal(again.state.cargasCombustible.length,1);
});

test('saldo del fondo es una regla pura compartida y excluye futuros y cargas personales',()=>{
  const state=structuredClone(Data.getState());state.cargasCombustible.push(
    {id:'personal',fecha:new Date().toISOString(),costo:40,pagador:'personal',sourceId:job.id,accountId:'acct-personal'},
    {id:'future',fecha:'2026-10-03T12:00:00',costo:60,pagador:'empresa',sourceId:job.id,accountId:job.fundAccountId}
  );const before=structuredClone(state);
  assert.deepEqual(fuelFundTotals(state,job.fundAccountId),{depositado:500,utilizado:0,disponible:500});assert.deepEqual(state,before);
});

test('modal con Uber activo siempre pregunta cómo se pagó y exige selección sin perder los datos',()=>{
  Data.iniciarActividad(gig.id);const before=structuredClone(Data.getState());open();
  assert.equal(field('source').value,gig.id);assert.equal(field('account').value,'');
  const body=document.getElementById('modalBody');assert.match(body.textContent,/¿Con qué pagaste\?/);assert.match(body.textContent,/Ticket Car/);assert.match(body.textContent,/Total pagado \(\$\)/);
  assert.doesNotMatch(body.textContent,/Costo \(\$\)/);enter('l',3.21);enter('c',74.79);enter('k',33173);save();
  assert.deepEqual(alerts,['Selecciona con qué pagaste el combustible.']);assert.equal(document.getElementById('appModal').style.display,'flex');
  assert.equal(field('c').value,'74.79');assert.deepEqual(Data.getState(),before);
  enter('account',job.fundAccountId);save();
  assert.equal(document.getElementById('appModal').style.display,'none');close(Data.getState().wallet.saldo,1000);close(Data.saldoFondoFuente(job.id).disponible,425.21);
});

test('modal sin actividad permite seleccionar uso y cuenta; cancelar no modifica datos',()=>{
  const before=structuredClone(Data.getState());open();assert.equal(field('source').value,'personal');assert.equal(field('account').value,'');
  enter('account',job.fundAccountId);enter('l',3.21);enter('c',74.79);enter('k',33173);document.getElementById('modalCancel').click();
  assert.equal(document.getElementById('appModal').style.display,'none');assert.deepEqual(Data.getState(),before);
  open();enter('source',job.id);enter('account','acct-personal');enter('l',3.21);enter('c',74.79);enter('k',33173);save();
  assert.equal(Data.getState().cargasCombustible.at(-1).sourceId,job.id);close(Data.getState().wallet.saldo,925.21);close(Data.saldoFondoFuente(job.id).disponible,500);
});

test('historial muestra actividad y cuenta de empresa con una sola carga y el importe total',()=>{
  Data.iniciarActividad(gig.id);fill({accountId:job.fundAccountId,gasolinera:'Estación'});
  document.body.dataset.page='historial';document.body.innerHTML='<table><tbody id="tablaBody"></tbody></table>';Platform.renderFinancialPlatform();
  const rows=[...document.querySelectorAll('tr')].filter(r=>r.textContent.includes('Combustible'));
  assert.equal(rows.length,1);assert.match(rows[0].textContent,/Plataforma · Ticket Car/);assert.match(rows[0].textContent,/3\.21 L · fondo de tercero/);assert.match(rows[0].textContent,/-\$74\.79/);
});

test('el shell offline y el orquestador incluyen el formulario de combustible con elección de cuenta',async()=>{
  const shell=await readFile(new URL('../sw.js',import.meta.url),'utf8'),init=await readFile(new URL('../js/05_init.js',import.meta.url),'utf8');
  assert.match(shell,/'\/js\/ui\/fuel\.js'/);assert.match(init,/import \{ showFuelModal \} from '\.\/ui\/fuel\.js'/);assert.match(init,/showFuelModal\(safe\)/);
});
