import test from 'node:test';
import assert from 'node:assert/strict';
class Storage{
  data=new Map();fail=false;
  getItem(key){return this.data.get(key)??null;}
  setItem(key,value){if(this.fail)throw new Error('QUOTA_EXCEEDED');this.data.set(key,String(value));}
}
globalThis.localStorage=new Storage();
const Data=await import('../js/02_data.js');
const Life=await import('../js/21_financial_life_v27.js');
const Costs=await import('../js/domain/operating-costs.js');
const Accounts=await import('../js/15_accounts_engine.js');
const {STORAGE_KEY}=await import('../js/01_consts_utils.js');
const {mergeStates}=await import('../js/26_sync_merge.js');
const now=new Date('2026-10-01T12:00:00');
const futureDates=['2026-10-15','2026-10-29','2026-10-29','2026-11-05'];
const payments=()=>Data.getState().movimientos.filter(m=>m.operatingObligationId);
const preview=()=>Costs.operatingPaymentDateRepairPreview();
const repair=()=>Costs.repairOperatingPaymentDates(preview().payments);

function reset(){
  localStorage.fail=false;
  Data.restaurar(JSON.stringify({profile:{onboarded:true,transportMode:'none'},workSources:[{id:'work',name:'Trabajo',compensation:'biweekly',status:'active',active:true}],movimientos:[],turnos:[],accounts:[],wallet:{saldo:0,sobres:[]},parametros:{}}));
  Life.ensureFinancialLife();Data.saldoInicial(2223);
}
function storedFuturePayments(amount=499){
  const item=Costs.createOperatingObligation({name:'Renta de vehículo',amount,frequency:'weekly',nextDueDate:'2026-10-15',category:'Renta',sourceId:'work'});
  const events=Costs.operatingUpcomingEvents({days:40,now});
  futureDates.forEach((date,i)=>Data.getState().movimientos.push({id:`payment-${i}`,tipo:'gasto',monto:amount,desc:item.name,categoria:'Renta',sourceId:'work',accountId:'acct-personal',affectsPersonal:true,tags:['operational'],fecha:new Date(`${date}T12:00:00`).toISOString(),operatingObligationId:item.id,operatingPeriod:events[i].operatingPeriod,operatingDueDate:Costs.localDay(events[i].dueDate),operatingExpectedAmount:amount}));
  Data.sanearDatos();return item;
}
test.beforeEach(t=>{t.mock.timers.enable({apis:['Date'],now});reset();});

test('preview is read-only and shows four real payments, including two on the same mistaken date',()=>{
  storedFuturePayments();const before=structuredClone(Data.getState()),persisted=localStorage.getItem(STORAGE_KEY);
  const p=preview();assert.equal(p.used,false);assert.equal(p.payments.length,4);assert.equal(p.total,1996);
  assert.equal(p.payments[1].fecha,p.payments[2].fecha);p.payments[0].monto=1;
  assert.deepEqual(Data.getState(),before);assert.equal(localStorage.getItem(STORAGE_KEY),persisted);
});

test('repair changes only actual dates, keeps all four IDs/amounts/periods, and deducts each payment once today',()=>{
  const item=storedFuturePayments(),before=structuredClone(Data.getState()),p=preview(),result=Costs.repairOperatingPaymentDates(p.payments);
  const expected=structuredClone(before);expected.movimientos.filter(m=>m.operatingObligationId).forEach(m=>m.fecha=now.toISOString());
  expected.wallet.saldo=227;expected.financialPlan.operatingPaymentDateRepair=result;
  assert.deepEqual(Data.getState(),expected);assert.equal(payments().length,4);
  assert.equal(Life.financialPosition(now).cash,227);assert.equal(Accounts.accountBalance('acct-personal',now),227);
  assert.equal(Costs.operatingUpcomingEvents({days:50,now}).find(e=>e.refId===item.id).dueDate.slice(0,10),'2026-11-12');
  assert.deepEqual(result.payments,p.payments.map(m=>({id:m.id,previousDate:m.fecha})));
  assert.equal(result.appliedAt,now.toISOString());assert.equal(result.version,1);
});

test('dates shared by two payments, or even a shared covered period, never cause a deletion',()=>{
  storedFuturePayments();payments()[2].operatingPeriod=payments()[1].operatingPeriod;payments()[2].operatingDueDate=payments()[1].operatingDueDate;
  const before=structuredClone(payments());repair();
  assert.deepEqual(payments(),before.map(m=>({...m,fecha:now.toISOString()})));assert.equal(Data.getState().wallet.saldo,227);
});

test('one-use marker and original dates survive reload and backup restoration; retry cannot charge or shift dates again',t=>{
  storedFuturePayments();const result=repair(),backup=JSON.stringify(Data.getState());
  Data.loadData();Life.ensureFinancialLife();assert.equal(preview().used,true);assert.equal(preview().payments.length,0);
  Data.restaurar(backup);Life.ensureFinancialLife();assert.deepEqual(Data.getState().financialPlan.operatingPaymentDateRepair,result);
  const before=structuredClone(Data.getState());t.mock.timers.setTime(new Date('2026-10-02T12:00:00').getTime());
  assert.deepEqual(Costs.repairOperatingPaymentDates([]),result);assert.deepEqual(Data.getState(),before);
});

test('changing the current obligation amount does not rewrite historical payments during the repair',()=>{
  const item=storedFuturePayments();item.amount=490;repair();
  assert.ok(payments().every(m=>m.monto===499&&m.operatingExpectedAmount===499));assert.equal(item.amount,490);assert.equal(Data.getState().wallet.saldo,227);
});

test('future home costs, income, transfers, goal movements and company funds stay unchanged',()=>{
  storedFuturePayments();const state=Data.getState(),future=new Date('2026-10-20T12:00:00').toISOString();
  state.accounts.push({id:'company',ownership:'third_party',active:true});
  const unrelated=[
    {id:'home',tipo:'gasto',monto:400,householdExpenseId:'food'},
    {id:'income',tipo:'ingreso',monto:9900},
    {id:'transfer',tipo:'transferencia',monto:100,fromAccountId:'acct-personal',toAccountId:'bank'},
    {...payments()[0],id:'company',accountId:'company'},
    {...payments()[0],id:'non-personal',affectsPersonal:false},
    {...payments()[0],id:'goal',goalTransfer:true},
    {id:'one-time',tipo:'gasto',monto:100,tags:['operational']}
  ].map(m=>({accountId:'acct-personal',fecha:future,...m}));
  state.movimientos.push(...unrelated);Data.saveData();const before=structuredClone(unrelated);
  assert.equal(preview().payments.length,4);repair();
  assert.deepEqual(state.movimientos.filter(m=>before.some(x=>x.id===m.id)),before);
});

test('no eligible payments means no mutation or consumption of the one-use correction',()=>{
  const state=Data.getState();state.movimientos.push({id:'invalid',tipo:'gasto',monto:499,operatingObligationId:'old',operatingPeriod:'old',fecha:'invalid'});Data.saveData();
  const before=structuredClone(state),stored=localStorage.getItem(STORAGE_KEY);
  assert.equal(preview().payments.length,0);assert.equal(repair(),null);assert.deepEqual(state,before);assert.equal(localStorage.getItem(STORAGE_KEY),stored);
});

test('sync/edit changing a reviewed amount, a new payment or an account switch requires a fresh review',()=>{
  for(const change of [()=>{payments()[0].monto=490;},()=>{Data.getState().movimientos.push({...payments()[0],id:'new-payment'});},()=>{reset();}]){
    reset();storedFuturePayments();const p=preview();change();Data.saveData();const before=structuredClone(Data.getState());
    assert.throws(()=>Costs.repairOperatingPaymentDates(p.payments),/PAGOS_OPERATIVOS_CAMBIARON/);assert.deepEqual(Data.getState(),before);
  }
});

test('ambiguous duplicate IDs cannot be silently used to change another record',()=>{
  storedFuturePayments();Data.getState().movimientos.push({...payments()[0],fecha:now.toISOString()});Data.saveData();
  const before=structuredClone(Data.getState());assert.throws(repair,/PAGOS_OPERATIVOS_CAMBIARON/);assert.deepEqual(Data.getState(),before);
});

test('storage failure rolls back dates, cash and the one-use marker; the same review can then succeed',()=>{
  storedFuturePayments();const p=preview(),before=structuredClone(Data.getState()),stored=localStorage.getItem(STORAGE_KEY);
  localStorage.fail=true;assert.throws(()=>Costs.repairOperatingPaymentDates(p.payments),/QUOTA_EXCEEDED/);
  assert.deepEqual(Data.getState(),before);assert.equal(localStorage.getItem(STORAGE_KEY),stored);assert.equal(preview().used,false);
  localStorage.fail=false;Costs.repairOperatingPaymentDates(p.payments);assert.equal(Data.getState().wallet.saldo,227);
});

test('repair and one-use marker sync to another device with unchanged IDs and no double counting',()=>{
  storedFuturePayments();const base=structuredClone(Data.getState());repair();const local=structuredClone(Data.getState()),remote=structuredClone(base);
  remote.profile.displayName='Otro dispositivo';const result=mergeStates(local,remote,base);
  assert.deepEqual(result.conflicts,[]);Data.restaurar(JSON.stringify(result.state));Life.ensureFinancialLife();
  assert.equal(preview().used,true);assert.equal(payments().length,4);assert.equal(Data.getState().wallet.saldo,227);
  assert.equal(Data.getState().profile.displayName,'Otro dispositivo');assert.deepEqual(Data.getState().financialPlan.operatingPaymentDateRepair,local.financialPlan.operatingPaymentDateRepair);
  const again=mergeStates(Data.getState(),local,result.state);assert.equal(again.conflicts.length,0);assert.equal(again.state.movimientos.length,5);
});

test('two independent date repairs need an explicit sync choice rather than creating new payments',t=>{
  storedFuturePayments();const base=structuredClone(Data.getState());repair();const local=structuredClone(Data.getState());
  Data.restaurar(JSON.stringify(base));t.mock.timers.setTime(now.getTime()+60000);repair();const remote=structuredClone(Data.getState());
  const result=mergeStates(local,remote,base);assert.ok(result.conflicts.some(c=>c.path.endsWith('/fecha')));assert.equal(result.state.movimientos.length,5);
  const choices=Object.fromEntries(result.conflicts.map(c=>[c.path,'local'])),resolved=mergeStates(local,remote,base,choices);
  assert.equal(resolved.conflicts.length,0);Data.restaurar(JSON.stringify(resolved.state));assert.equal(Data.getState().wallet.saldo,227);assert.equal(preview().used,true);
});

test('the actual repair uses the current local day at confirmation, including midnight UTC',t=>{
  storedFuturePayments();const p=preview(),confirmed=new Date('2026-10-02T00:30:00Z');t.mock.timers.setTime(confirmed.getTime());
  Costs.repairOperatingPaymentDates(p.payments);
  assert.ok(payments().every(m=>m.fecha===confirmed.toISOString()));
  const localDate=new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit'}).format(confirmed);
  assert.equal(Costs.localDay(payments()[0].fecha),localDate);assert.equal(Data.getState().wallet.saldo,227);
  if(process.env.TZ==='UTC')assert.equal(localDate,'2026-10-02');
  if(process.env.TZ==='America/Mexico_City')assert.equal(localDate,'2026-10-01');
});

test('new future records after the one-use repair are not automatically rewritten',()=>{
  storedFuturePayments();const result=repair();const row={...payments()[0],id:'later-import',fecha:new Date('2026-11-20T12:00:00').toISOString()};
  Data.getState().movimientos.push(row);Data.saveData();assert.equal(preview().used,true);assert.equal(preview().payments.length,0);
  Costs.repairOperatingPaymentDates([structuredClone(row)]);assert.equal(row.fecha,new Date('2026-11-20T12:00:00').toISOString());assert.deepEqual(Data.getState().financialPlan.operatingPaymentDateRepair,result);
});
