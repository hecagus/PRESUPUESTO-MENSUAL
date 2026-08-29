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
const Life=await import('../js/13_financial_life.js');

function reset(){
  Data.restaurar(JSON.stringify({
    schemaVersion:22,
    profile:{onboarded:true,displayName:'',useCases:['personal'],transportMode:'none',capabilities:['personal_finance'],currency:'MXN'},
    workSources:[],accounts:[],assets:[],turnos:[],movimientos:[],cargasCombustible:[],fondosCombustibleEmpresa:[],
    deudas:[],gastosFijosMensuales:[],ingresosFijos:[],business:{ingredients:[],products:[],sales:[]},
    wallet:{saldo:0,sobres:[]},savingsGoals:[],
    parametros:{ultimoKM:0,costoPorKm:0,metaDiaria:0,metaBase:0,deficitTotal:0,moraVencida:0,kmInicialConfigurado:false,saldoInicialConfigurado:false},
    categoriasPersonalizadas:{operativo:[],hogar:[]},activeActivity:null,turnoActivo:null
  }));
  Life.ensureFinancialLife();
}

test.beforeEach(reset);

test('una fuente puede pausarse, finalizarse y reactivarse sin borrar historial',()=>{
  Data.crearFuenteTrabajo({name:'Trabajo A',kind:'employment',compensation:'monthly',trackTime:true,fuelPayer:'none'});
  const source=Data.getState().workSources[0];
  Data.getState().turnos.push({id:'old-turn',sourceId:source.id,fecha:'2026-08-01T12:00:00.000Z'});Data.saveData();
  Life.setSourceStatus(source.id,'paused');
  assert.equal(source.active,false);assert.equal(source.status,'paused');assert.equal(Data.getState().turnos.length,1);
  Life.setSourceStatus(source.id,'ended');
  assert.equal(source.active,false);assert.ok(source.endedAt);assert.equal(Data.getState().turnos[0].id,'old-turn');
  Life.setSourceStatus(source.id,'active');
  assert.equal(source.active,true);assert.equal(source.status,'active');assert.equal(source.endedAt,null);
});

test('transporte público calcula ida y regreso por fuente',()=>{
  Data.crearFuenteTrabajo({name:'Oficina',kind:'employment',compensation:'biweekly',trackTime:true,fuelPayer:'none'});
  const source=Data.getState().workSources[0];
  Life.updateSourceLife(source.id,{transportMode:'public',outboundRides:2,returnRides:2,fare:10,daysPerWeek:5});
  assert.equal(Life.publicTransportDailyCost(source),40);
  assert.ok(Math.abs(Life.publicTransportMonthlyCost(source)-866.6666667)<0.01);
});

test('dinero libre separa efectivo, compromisos y metas',()=>{
  Data.saldoInicial(10000);
  const state=Data.getState();state.savingsGoals=[{id:'goal',name:'Meta',targetAmount:5000,reserved:1000,active:true}];Data.saveData();
  Life.configureLivingSetup({housing:4000,housingDay:30,services:0,groceries:2000,health:0,leisure:0,other:0});
  const pos=Life.financialPosition(new Date('2026-08-29T12:00:00'));
  assert.equal(pos.cash,10000);assert.equal(pos.reserved,1000);assert.equal(pos.living,2000);assert.ok(pos.due>=4000);assert.equal(pos.free,3000);
});

test('calendario combina compromisos, ingresos y metas',()=>{
  Data.crearFuenteTrabajo({name:'Empresa',kind:'employment',compensation:'biweekly',trackTime:false,fuelPayer:'none'});
  Life.createCommitment({name:'Internet',amount:500,dueDay:5,category:'Servicios'});
  const state=Data.getState();state.savingsGoals=[{id:'g1',name:'Laptop',targetAmount:10000,reserved:2000,targetDate:'2026-09-20T23:59:59.000Z',active:true}];Data.saveData();
  const events=Life.upcomingFinancialEvents({days:45,now:new Date('2026-08-29T12:00:00')});
  assert.ok(events.some(e=>e.title==='Internet'));
  assert.ok(events.some(e=>e.title.includes('Ingreso esperado · Empresa')));
  assert.ok(events.some(e=>e.title==='Meta · Laptop'));
});

test('pagar compromiso registra gasto real una sola vez por mes',()=>{
  Data.saldoInicial(3000);const c=Life.createCommitment({name:'Internet',amount:500,dueDay:5,category:'Servicios'});
  Life.payCommitment(c.id,new Date('2026-08-05T10:00:00'));
  assert.equal(Life.financialPosition(new Date('2026-08-05T12:00:00')).cash,2500);
  assert.throws(()=>Life.payCommitment(c.id,new Date('2026-08-20T10:00:00')),/COMPROMISO_YA_PAGADO/);
});
