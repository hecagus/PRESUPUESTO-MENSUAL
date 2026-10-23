import test from 'node:test';
import assert from 'node:assert/strict';
import { STORAGE_KEY } from '../js/01_consts_utils.js';

class Storage {
  data=new Map();writes=0;failWrites=false;failReadOnce=false;
  getItem(key){if(this.failReadOnce){this.failReadOnce=false;throw new Error('read');}return this.data.get(key)??null;}
  setItem(key,value){if(this.failWrites)throw new Error('quota');this.data.set(key,String(value));this.writes++;}
  clear(){this.data.clear();this.writes=0;this.failWrites=false;this.failReadOnce=false;}
}
globalThis.localStorage=new Storage();
const Data=await import('../js/02_data.js');
const Costs=await import('../js/domain/operating-costs.js');
const NOW=Date.parse('2026-10-23T12:00:00.000Z'),DAY=86400000;
const iso=time=>new Date(time).toISOString();
const movement=(id='old',extra={})=>({id,tipo:'ingreso',monto:100,fecha:iso(NOW-8*DAY),categoria:'Trabajo',accountId:'acct-personal',affectsPersonal:true,...extra});
function seed(extra={}){
  Data.restaurar(JSON.stringify({...Data.createEmptyState(),profile:{onboarded:true,transportMode:'none'},movimientos:[movement()],...extra}));
}
const freshness=()=>Data.getState().financialPlan?.freshness;
const saved=()=>JSON.parse(localStorage.getItem(STORAGE_KEY));
const capture=()=>Data.withTransaction(()=>Data.nuevoGasto('Compra de prueba',10,'Hogar','Unico'));

test.beforeEach(t=>{t.mock.timers.enable({apis:['Date'],now:NOW});localStorage.clear();seed();});

test('abrir, sanear y guardar sin cambios conserva la antigüedad del presupuesto',()=>{
  seed({financialPlan:{freshness:{lastConfirmedAt:iso(NOW-8*DAY),lastAuditedAt:iso(NOW-10*DAY)}}});
  const original=structuredClone(freshness());
  Data.loadData();Data.sanearDatos();Data.saveData();
  assert.deepEqual(freshness(),original);assert.deepEqual(saved().financialPlan.freshness,original);
});

test('restaurar o aplicar un presupuesto remoto antiguo no crea una confirmación',()=>{
  capture();assert.equal(freshness().lastConfirmedAt,iso(NOW));
  seed({movimientos:[movement('remote')],financialPlan:{freshness:{lastConfirmedAt:iso(NOW-9*DAY)}}});
  assert.deepEqual(freshness(),{lastConfirmedAt:iso(NOW-9*DAY)});
  seed({movimientos:[movement('historical')]});Data.loadData();
  assert.equal(freshness(),undefined);assert.equal(saved().financialPlan,undefined);
  capture();assert.equal(freshness().lastConfirmedAt,iso(NOW));assert.equal(freshness().requiresAudit,true);
});

test('un movimiento real confirma la captura y conserva la auditoría pendiente tras siete días exactos',()=>{
  seed({financialPlan:{freshness:{lastConfirmedAt:iso(NOW-7*DAY),lastAuditedAt:iso(NOW-8*DAY)}},movimientos:[movement('older',{fecha:iso(NOW-9*DAY)})]});
  capture();
  assert.equal(freshness().lastConfirmedAt,iso(NOW));assert.equal(freshness().requiresAudit,true);
  Data.nuevoGasto('Otra compra',5,'Hogar','Unico');Data.saveData();Data.loadData();
  assert.equal(freshness().requiresAudit,true);assert.equal(freshness().lastAuditedAt,iso(NOW-8*DAY));
});

test('el registro previo más reciente decide la vigencia antes de añadir la nueva captura',()=>{
  seed({financialPlan:{freshness:{lastConfirmedAt:iso(NOW-12*DAY)}},movimientos:[movement('recent',{recordedAt:iso(NOW-2*DAY)})]});
  capture();assert.equal(freshness().lastConfirmedAt,iso(NOW));assert.notEqual(freshness().requiresAudit,true);
  seed({financialPlan:{freshness:{lastAuditedAt:iso(NOW-DAY)}},movimientos:[movement()]});
  capture();assert.notEqual(freshness().requiresAudit,true);
});

test('un registro histórico futuro no oculta el intervalo sin confirmar',()=>{
  seed({movimientos:[movement(),movement('future',{fecha:iso(NOW+DAY)})]});
  capture();assert.equal(freshness().requiresAudit,true);
});

test('corregir manualmente una fecha de pago no oculta diecisiete días pendientes de auditar',()=>{
  seed({movimientos:[movement('older',{fecha:iso(NOW-17*DAY)}),movement('operating-payment',{
    tipo:'gasto',fecha:iso(NOW+DAY),categoria:'Transporte',operatingObligationId:'operating',operatingPeriod:'week-test',
  })]});
  const preview=Costs.operatingPaymentDateRepairPreview(new Date());
  assert.equal(preview.payments.length,1);Costs.repairOperatingPaymentDates(preview.payments);
  assert.equal(Data.getState().movimientos.at(-1).fecha,iso(NOW));
  assert.equal(freshness().lastConfirmedAt,iso(NOW));assert.equal(freshness().requiresAudit,true);
});

test('metas, reservas, ajustes de conciliación y configuración no renuevan la captura',()=>{
  seed({financialPlan:{freshness:{lastConfirmedAt:iso(NOW-8*DAY)}}});
  const state=Data.getState();
  state.accounts[0].name='Cuenta de prueba';state.wallet.saldo=999;
  state.financialPlan.householdExpenses=[{id:'reserve',amount:25}];
  state.movimientos.push(
    movement('system',{categoria:'Sistema',fecha:iso(NOW)}),
    movement('reconciliation',{movementKind:'reconciliation',fecha:iso(NOW)}),
    movement('goal',{goalTransfer:'reserve',fecha:iso(NOW)}),
    movement('legacy-goal',{legacySavingsTransfer:true,fecha:iso(NOW)}),
  );
  Data.sanearDatos();
  assert.deepEqual(freshness(),{lastConfirmedAt:iso(NOW-8*DAY)});
  capture();assert.equal(freshness().requiresAudit,true);
});

test('transferencias entre cuentas personales y cambios de deuda sí confirman registros reales',()=>{
  seed({movimientos:[movement('recent',{fecha:iso(NOW-DAY)})]});
  Data.getState().movimientos.push(movement('transfer',{tipo:'transferencia',categoria:'Transferencia',fecha:iso(NOW),fromAccountId:'acct-personal',toAccountId:'bank',affectsPersonal:false}));
  Data.saveData();assert.equal(freshness().lastConfirmedAt,iso(NOW));
  seed({movimientos:[],deudas:[{id:'debt',desc:'Deuda de prueba',saldo:100,montoCuota:10,frecuencia:'Mensual',creadaEn:iso(NOW-8*DAY)}]});
  Data.withTransaction(()=>{Data.getState().deudas[0].saldo=90;Data.saveData();});
  assert.equal(freshness().lastConfirmedAt,iso(NOW));assert.equal(freshness().requiresAudit,true);
});

test('una escritura fallida no avanza la firma ni la confirmación y el reintento usa su fecha real',t=>{
  seed({financialPlan:{freshness:{lastConfirmedAt:iso(NOW-8*DAY)}}});
  const disk=localStorage.getItem(STORAGE_KEY),original=structuredClone(freshness());
  Data.getState().movimientos.push(movement('new',{tipo:'gasto',fecha:iso(NOW)}));
  localStorage.failWrites=true;assert.throws(()=>Data.saveData(),/quota/);
  assert.deepEqual(freshness(),original);assert.equal(localStorage.getItem(STORAGE_KEY),disk);
  localStorage.failWrites=false;t.mock.timers.setTime(NOW+DAY);Data.saveData();
  assert.equal(freshness().lastConfirmedAt,iso(NOW+DAY));assert.equal(freshness().requiresAudit,true);
  assert.deepEqual(saved().financialPlan.freshness,freshness());
});

test('transacciones anidadas difieren la confirmación y escriben una sola vez al confirmar',()=>{
  seed({financialPlan:{freshness:{lastConfirmedAt:iso(NOW-8*DAY)}}});
  const before=localStorage.writes;
  Data.withTransaction(()=>{
    capture();Data.withTransaction(()=>Data.nuevoGasto('Segunda compra',5,'Hogar','Unico'));Data.saveData();
    assert.equal(freshness().lastConfirmedAt,iso(NOW-8*DAY));assert.equal(localStorage.writes,before);
  });
  assert.equal(localStorage.writes,before+1);assert.equal(freshness().lastConfirmedAt,iso(NOW));assert.equal(freshness().requiresAudit,true);
});

test('el rollback conserva datos, firma y referencia previa para reintentar una captura',()=>{
  seed({financialPlan:{freshness:{lastConfirmedAt:iso(NOW-8*DAY)}}});
  const before=structuredClone(Data.getState()),disk=localStorage.getItem(STORAGE_KEY);
  localStorage.failWrites=true;assert.throws(capture,/quota/);localStorage.failWrites=false;
  assert.deepEqual(Data.getState(),before);assert.equal(localStorage.getItem(STORAGE_KEY),disk);
  capture();assert.equal(freshness().lastConfirmedAt,iso(NOW));assert.equal(freshness().requiresAudit,true);
});

test('restaurar dentro de una transacción establece una referencia sin anticipar el guardado',()=>{
  const writes=localStorage.writes;
  Data.withTransaction(()=>{
    seed({movimientos:[movement('replacement')]});
    assert.equal(freshness(),undefined);assert.equal(localStorage.writes,writes);
    capture();assert.equal(freshness(),undefined);
  });
  assert.equal(localStorage.writes,writes+1);assert.equal(freshness().lastConfirmedAt,iso(NOW));assert.equal(freshness().requiresAudit,true);
});

test('fallar al cargar o restaurar no pierde la firma del presupuesto anterior',()=>{
  const before=structuredClone(Data.getState()),disk=localStorage.getItem(STORAGE_KEY);
  localStorage.failReadOnce=true;assert.throws(()=>Data.loadData(),/STORAGE_DATA_INVALIDA/);
  assert.deepEqual(Data.getState(),before);
  localStorage.failWrites=true;assert.throws(()=>seed({movimientos:[movement('replacement',{fecha:iso(NOW-DAY)})]}),/quota/);localStorage.failWrites=false;
  assert.deepEqual(Data.getState(),before);assert.equal(localStorage.getItem(STORAGE_KEY),disk);
  capture();assert.equal(freshness().lastConfirmedAt,iso(NOW));assert.equal(freshness().requiresAudit,true);
});
