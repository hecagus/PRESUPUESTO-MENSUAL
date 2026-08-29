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

function reset(){
  Data.restaurar(JSON.stringify({
    schemaVersion:11,
    turnos:[],movimientos:[],cargasCombustible:[],deudas:[],gastosFijosMensuales:[],ingresosFijos:[],
    wallet:{saldo:0,sobres:[]},
    parametros:{ultimoKM:1000,costoPorKm:0,metaDiaria:0,metaBase:0,deficitTotal:0,moraVencida:0,kmInicialConfigurado:true,saldoInicialConfigurado:false},
    categoriasPersonalizadas:{operativo:[],hogar:[]},turnoActivo:null
  }));
}

test.beforeEach(reset);

test('un turno crea ingreso, kilometraje y duración',()=>{
  Data.iniciarTurno();
  const state=Data.finalizarTurno(1012,480);
  assert.equal(state.turnos.length,1);
  assert.equal(state.turnos[0].kmRecorrido,12);
  assert.equal(state.turnos[0].ganancia,480);
  assert.equal(state.movimientos.at(-1).tipo,'ingreso');
  assert.equal(state.wallet.saldo,480);
  assert.equal(state.parametros.ultimoKM,1012);
});

test('no permite finalizar un turno inexistente',()=>{
  assert.throws(()=>Data.finalizarTurno(1010,100),/TURNO_NO_ACTIVO/);
});

test('rechaza kilometraje regresivo y gasolina inválida',()=>{
  Data.iniciarTurno();
  assert.throws(()=>Data.finalizarTurno(999,100),/KM_MENOR/);
  assert.throws(()=>Data.registrarGasolina(0,200,1000),/LITROS_INVALIDOS/);
  assert.throws(()=>Data.registrarGasolina(5,-1,1000),/MONTO_INVALIDO/);
});

test('una deuda reduce saldo pendiente con cada abono',()=>{
  Data.nuevaDeuda('Tarjeta',1000,250,'Mensual','15');
  const deuda=Data.getState().deudas[0];
  Data.abonarDeuda(deuda.id);
  assert.equal(Data.getState().deudas[0].saldo,750);
  assert.equal(Data.getState().movimientos.at(-1).monto,250);
  assert.equal(Data.getState().movimientos.at(-1).categoria,'Deuda');
});

test('el ingreso fijo no puede cobrarse dos veces en el mismo periodo',()=>{
  Data.crearIngresoFijo({nombre:'Trabajo fijo',frecuencia:'Mensual',dia1:'15'});
  const ingreso=Data.getState().ingresosFijos[0];
  const pago=ingreso.pagos[0];
  Data.registrarCobroFijo(ingreso.id,pago.id,5000);
  assert.equal(Data.getState().wallet.saldo,5000);
  assert.throws(()=>Data.registrarCobroFijo(ingreso.id,pago.id,5000),/COBRO_DUPLICADO/);
});

test('restaurar rechaza JSON inválido o ajeno a la app',()=>{
  assert.throws(()=>Data.restaurar('{no-json'),/BACKUP_INVALIDO/);
  assert.throws(()=>Data.restaurar(JSON.stringify({foo:'bar'})),/BACKUP_INVALIDO/);
});

test('gastos únicos impactan caja y gastos recurrentes crean obligación',()=>{
  Data.saldoInicial(1000);
  Data.nuevoGasto('Comida',200,'Comida','Unico');
  assert.equal(Data.getState().wallet.saldo,800);
  Data.nuevoGasto('Internet',500,'Internet','Mensual');
  assert.equal(Data.getState().gastosFijosMensuales.length,1);
  assert.equal(Data.getState().gastosFijosMensuales[0].monto,500);
});
