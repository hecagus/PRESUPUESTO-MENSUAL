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
    schemaVersion:20,
    profile:{onboarded:false,displayName:'',useCases:['personal'],transportMode:'none',capabilities:['personal_finance'],currency:'MXN'},
    workSources:[],accounts:[],assets:[],turnos:[],movimientos:[],cargasCombustible:[],fondosCombustibleEmpresa:[],
    deudas:[],gastosFijosMensuales:[],ingresosFijos:[],business:{ingredients:[],products:[],sales:[]},
    wallet:{saldo:0,sobres:[]},
    parametros:{ultimoKM:0,costoPorKm:0,metaDiaria:0,metaBase:0,deficitTotal:0,moraVencida:0,kmInicialConfigurado:false,saldoInicialConfigurado:false},
    categoriasPersonalizadas:{operativo:[],hogar:[]},activeActivity:null,turnoActivo:null
  }));
}

function setupHybrid(){
  Data.configurarOnboarding({
    displayName:'Usuario',useCases:['employment','gig'],transportMode:'motorcycle',openingBalance:1000,
    sources:[
      {name:'Empresa principal',kind:'employment',compensation:'biweekly',trackTime:true,trackDistance:true,fuelPayer:'company'},
      {name:'Plataforma extra',kind:'gig',compensation:'per_shift',trackTime:true,trackDistance:true,fuelPayer:'personal'}
    ]
  });
  Data.configurarKM(1000);
  const s=Data.getState();return {employment:s.workSources.find(x=>x.kind==='employment'),gig:s.workSources.find(x=>x.kind==='gig')};
}

test.beforeEach(reset);

test('onboarding genera capacidades, fuentes y fondo de tercero sin nombres hardcodeados',()=>{
  const {employment,gig}=setupHybrid();const s=Data.getState();
  assert.equal(s.profile.onboarded,true);
  assert.equal(s.profile.transportMode,'motorcycle');
  assert.equal(s.workSources.length,2);
  assert.equal(employment.compensation,'biweekly');
  assert.equal(gig.compensation,'per_shift');
  assert.ok(employment.fundAccountId);
  assert.equal(Data.cuentaById(employment.fundAccountId).ownership,'third_party');
  assert.ok(s.profile.capabilities.includes('third_party_funds'));
});

test('empleo registra jornada sin inventar ingreso y el pago entra después',()=>{
  const {employment}=setupHybrid();
  Data.iniciarActividad(employment.id);
  Data.finalizarActividad({kmFinal:1025});
  assert.equal(Data.getState().turnos[0].sourceId,employment.id);
  assert.equal(Data.getState().turnos[0].ganancia,null);
  assert.equal(Data.getState().wallet.saldo,1000);
  Data.registrarPagoFuente(employment.id,6000);
  assert.equal(Data.getState().wallet.saldo,7000);
  assert.throws(()=>Data.registrarPagoFuente(employment.id,6000),/COBRO_DUPLICADO/);
});

test('fuente por turno registra ingreso, horas y km',()=>{
  const {gig}=setupHybrid();
  Data.iniciarActividad(gig.id);
  const state=Data.finalizarActividad({kmFinal:1012,income:480});
  assert.equal(state.turnos.at(-1).sourceId,gig.id);
  assert.equal(state.turnos.at(-1).kmRecorrido,12);
  assert.equal(state.turnos.at(-1).ganancia,480);
  assert.equal(state.movimientos.at(-1).sourceId,gig.id);
  assert.equal(state.wallet.saldo,1480);
});

test('actividad de empresa enruta combustible a fondo tercero y no toca patrimonio',()=>{
  const {employment}=setupHybrid();
  Data.registrarFondoFuente(employment.id,500);
  Data.iniciarActividad(employment.id);
  Data.registrarCombustible({litros:5,costo:200,km:1005,gasolinera:'Estación X'});
  const fuel=Data.saldoFondoFuente(employment.id),carga=Data.getState().cargasCombustible.at(-1);
  assert.deepEqual(fuel,{depositado:500,utilizado:200,disponible:300});
  assert.equal(carga.pagador,'empresa');
  assert.equal(carga.sourceId,employment.id);
  assert.equal(Data.getState().wallet.saldo,1000);
});

test('actividad personal por turnos descuenta combustible de caja personal',()=>{
  const {gig}=setupHybrid();
  Data.iniciarActividad(gig.id);
  Data.registrarCombustible({litros:4,costo:180,km:1004,gasolinera:'Pemex'});
  const gasto=Data.getState().movimientos.at(-1);
  assert.equal(gasto.tipo,'gasto');
  assert.equal(gasto.sourceId,gig.id);
  assert.equal(gasto.monto,180);
  assert.equal(Data.getState().wallet.saldo,820);
});

test('sin actividad combustible exige contexto',()=>{
  setupHybrid();
  assert.throws(()=>Data.registrarCombustible({litros:4,costo:150,km:1000}),/ORIGEN_COMBUSTIBLE_REQUERIDO/);
  Data.registrarCombustible({litros:4,costo:150,km:1000,payer:'personal'});
  assert.equal(Data.getState().wallet.saldo,850);
});

test('costeo de receta se recalcula al cambiar costo de ingrediente',()=>{
  Data.configurarOnboarding({useCases:['business'],transportMode:'none',openingBalance:0,sources:[{name:'Panadería',kind:'business',compensation:'per_sale',trackTime:false,trackDistance:false,fuelPayer:'none'}]});
  Data.crearIngrediente('Harina','g',0.02);Data.crearIngrediente('Huevo','pieza',4);
  Data.crearProducto('Pastel',200);
  const s=Data.getState(),p=s.business.products[0],harina=s.business.ingredients[0],huevo=s.business.ingredients[1];
  Data.agregarIngredienteProducto(p.id,harina.id,500);Data.agregarIngredienteProducto(p.id,huevo.id,3);
  assert.equal(Data.costoProducto(p.id),22);
  Data.actualizarCostoIngrediente(harina.id,0.03);
  assert.equal(Data.costoProducto(p.id),27);
  Data.registrarVentaProducto(p.id,2);
  assert.equal(Data.getState().business.sales.at(-1).total,400);
  assert.equal(Data.getState().wallet.saldo,400);
});

test('migración v1 convierte Jaimau/Uber en datos configurables',()=>{
  Data.restaurar(JSON.stringify({
    schemaVersion:12,
    turnos:[{id:'t1',fecha:new Date().toISOString(),tipoTrabajo:'jaimau',fuente:'jaimau',inicio:1,fin:2,kmFinal:1000,kmRecorrido:10}],
    movimientos:[],cargasCombustible:[],fondosCombustibleEmpresa:[],deudas:[],gastosFijosMensuales:[],ingresosFijos:[],
    wallet:{saldo:0,sobres:[]},parametros:{ultimoKM:1000,kmInicialConfigurado:true,saldoInicialConfigurado:false},categoriasPersonalizadas:{operativo:[],hogar:[]}
  }));
  const s=Data.getState();
  assert.equal(s.profile.onboarded,true);
  assert.equal(s.workSources.length,2);
  assert.equal(s.turnos[0].sourceId,s.workSources.find(x=>x.kind==='employment').id);
});

test('deuda y gasto único siguen afectando caja personal',()=>{
  Data.saldoInicial(1000);
  Data.nuevoGasto('Comida',200,'Comida','Unico');
  assert.equal(Data.getState().wallet.saldo,800);
  Data.nuevaDeuda('Tarjeta',1000,250,'Mensual','15');const id=Data.getState().deudas[0].id;Data.abonarDeuda(id);
  assert.equal(Data.getState().deudas[0].saldo,750);
  assert.equal(Data.getState().wallet.saldo,550);
});

test('restaurar rechaza JSON inválido o ajeno',()=>{
  assert.throws(()=>Data.restaurar('{no-json'),/BACKUP_INVALIDO/);
  assert.throws(()=>Data.restaurar(JSON.stringify({foo:'bar'})),/BACKUP_INVALIDO/);
});
