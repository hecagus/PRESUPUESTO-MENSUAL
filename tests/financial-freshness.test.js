import test from 'node:test';
import assert from 'node:assert/strict';
class Storage {
  data=new Map();
  getItem(key){return this.data.has(key)?this.data.get(key):null;}
  setItem(key,value){this.data.set(key,String(value));}
  removeItem(key){this.data.delete(key);}
}
globalThis.localStorage=new Storage();
const Data=await import('../js/02_data.js');
const Fresh=await import('../js/29_financial_freshness.js');
const Rules=await import('../js/domain/financial-rules.js');
const Accounts=await import('../js/15_accounts_engine.js');
const oldDate=()=>new Date(Date.now()-17*86400000).toISOString();
function reset(){
  Data.restaurar(JSON.stringify({
    profile:{onboarded:true,displayName:'Test',transportMode:'none'},
    accounts:[{id:'acct-personal',name:'Efectivo',type:'cash',ownership:'personal',active:true}],
    movimientos:[{id:'old-real',fecha:oldDate(),tipo:'ingreso',desc:'Ingreso cobrado',monto:1000,accountId:'acct-personal',affectsPersonal:true,categoria:'Trabajo'}],
    turnos:[],deudas:[{id:'d1',desc:'Préstamo',montoTotal:600,montoCuota:100,saldo:600,frecuencia:'Mensual',diaPago:15}],
    workSources:[{id:'job',name:'Jaimau',kind:'employment',compensation:'biweekly',status:'active',active:true}],
    parametros:{},wallet:{saldo:0,sobres:[]},
    financialPlan:{commitments:[],householdExpenses:[],operatingObligations:[]}
  }));
}
const choices=()=>({accounts:{'acct-personal':'650.00'},debts:{d1:'450'},sources:{job:'paused'},expectedFingerprint:Fresh.auditFingerprint()});
test.beforeEach(reset);

test('17 días sin movimientos reales bloquean las previsiones sin registrar ingresos ficticios',()=>{
  const f=Fresh.financialFreshness();
  assert.equal(f.stale,true);
  assert.ok(f.daysWithoutRecords>=16);
  assert.equal(Data.getState().movimientos.length,1);
});

test('la auditoría concilia saldo, deuda y trabajo, conserva historial y no cuenta el ajuste como gasto observado',()=>{
  const before=structuredClone(Data.getState().movimientos[0]);
  const result=Fresh.completeFinancialAudit(choices());
  const s=Data.getState();
  assert.equal(result.adjustments,1);
  assert.deepEqual(s.movimientos[0],before);
  assert.equal(Rules.accountLedgerBalance(s,'acct-personal'),650);
  assert.equal(s.deudas[0].saldo,450);
  assert.equal(s.workSources[0].status,'paused');
  assert.equal(s.movimientos.length,2);
  assert.equal(s.movimientos[1].monto,350);
  assert.equal(s.movimientos[1].tipo,'gasto');
  assert.equal(s.movimientos[1].movementKind,'reconciliation');
  assert.equal(s.movimientos[1].categoria,'Sistema');
  assert.equal(Rules.observedTotals(s).expense,0);
  assert.equal(Fresh.financialFreshness().stale,false);
  assert.ok(s.financialPlan.freshness.lastAuditedAt);
});

test('repetir una conciliación no duplica importes ni modifica movimientos previos',()=>{
  Fresh.completeFinancialAudit(choices());
  const prev=Data.getState().movimientos.length;
  Fresh.completeFinancialAudit({accounts:{'acct-personal':650},debts:{d1:450},sources:{job:'paused'},expectedFingerprint:Fresh.auditFingerprint()});
  assert.equal(Data.getState().movimientos.length,prev);
  assert.equal(Rules.personalCash(Data.getState()),650);
});

test('importe inválido y edición concurrente no cambian registros',()=>{
  const before=Fresh.auditFingerprint();
  assert.throws(()=>Fresh.completeFinancialAudit({...choices(),debts:{d1:-2}}),/fuera de rango/);
  assert.equal(Fresh.auditFingerprint(),before);
  assert.throws(()=>Fresh.completeFinancialAudit({...choices(),expectedFingerprint:'old'}),/cambiaron/);
  assert.equal(Fresh.auditFingerprint(),before);
});

test('la vigencia se renueva con un registro auténtico, pero no con guardar automáticamente',()=>{
  Data.saveData();
  assert.equal(Fresh.financialFreshness().stale,true);
  Accounts.recordUniversalMovement({type:'expense',description:'Comida',amount:20,accountId:'acct-personal'});
  assert.equal(Fresh.financialFreshness().stale,false);
});

test('restaurar respaldo antiguo no lo convierte silenciosamente en información actual',()=>{
  const snapshot=JSON.stringify(Data.getState());
  Data.restaurar(snapshot);
  assert.equal(Fresh.financialFreshness().stale,true);
  assert.equal(Data.getState().movimientos.length,1);
});

test('corregir el periodo de un cobro real renueva la vigencia sin inventar ingresos',()=>{
  const m=Data.getState().movimientos[0];
  m.sourceId='job';
  m.paymentKind='source_period';
  m.periodo=Rules.sourcePeriodId('biweekly',m.fecha);
  Data.restaurar(JSON.stringify(Data.getState()));
  assert.equal(Fresh.financialFreshness().stale,true);
  const oldCount=Data.getState().movimientos.length;
  const previousPeriod=Data.getState().movimientos[0].periodo;
  Data.actualizarPeriodoPagoFuente('old-real',new Date(Date.now()-45*86400000),{expectedPeriod:previousPeriod});
  assert.equal(Fresh.financialFreshness().stale,false);
  assert.equal(Data.getState().movimientos.length,oldCount);
  assert.notEqual(Data.getState().movimientos[0].periodo,previousPeriod);
  assert.equal(Data.getState().movimientos[0].periodHistory.length,1);
});
