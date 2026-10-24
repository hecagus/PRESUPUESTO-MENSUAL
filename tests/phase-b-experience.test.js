import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildHistoryEvents,filterHistoryEvents} from '../js/ui/history-filters.js';

const source=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const state={
  accounts:[{id:'personal',name:'Efectivo'},{id:'bank',name:'Cuenta bancaria'}],
  workSources:[{id:'job',name:'Empleo'}],
  movimientos:[
    {id:'in',fecha:'2026-10-20T12:00:00Z',desc:'Pago extra',tipo:'ingreso',monto:1200,categoria:'Otro',accountId:'personal'},
    {id:'out',fecha:'2026-10-21T12:00:00Z',desc:'Café',tipo:'gasto',monto:50,categoria:'Comida',accountId:'personal'},
    {id:'trans',fecha:'2026-10-22T12:00:00Z',tipo:'transferencia',monto:300,fromAccountId:'personal',toAccountId:'bank'},
    {id:'adjust',fecha:'2026-10-23T12:00:00Z',desc:'Conciliación',tipo:'gasto',monto:80,categoria:'Sistema',movementKind:'reconciliation',accountId:'personal'}
  ],
  turnos:[{id:'shift',fecha:'2026-10-19T12:00:00Z',sourceId:'job',duracionHoras:4,kmRecorrido:12}],
  fondosCombustibleEmpresa:[{id:'fund',fecha:'2026-10-23T11:00:00Z',monto:500,sourceId:'job',desc:'Fondo para combustible'}],
  cargasCombustible:[{id:'fuel',fecha:'2026-10-23T10:00:00Z',pagador:'empresa',costo:100,litros:5,sourceId:'job'}]
};
const now=new Date('2026-10-23T20:00:00Z');

test('historial distingue conciliación y dinero de terceros sin duplicar datos',()=>{
  const events=buildHistoryEvents(state);
  assert.equal(events.length,7);
  assert.equal(events.filter(e=>e.kind==='reconciliation').length,1);
  assert.equal(events.filter(e=>e.kind==='transfer').length,1);
  assert.equal(events.filter(e=>e.kind==='thirdparty').length,2);
  assert.ok(events.every((e,i)=>i===0||new Date(events[i-1].fecha)>=new Date(e.fecha)));
  assert.equal(events.find(e=>e.kind==='reconciliation').status,'Ajuste de saldo');
});

test('búsqueda ignora acentos y encuentra categoría o cuenta',()=>{
  const e=buildHistoryEvents(state);
  assert.equal(filterHistoryEvents(e,{query:'conciliacion'},now).length,1);
  assert.equal(filterHistoryEvents(e,{query:'cuenta bancaria'},now).length,1);
  assert.equal(filterHistoryEvents(e,{query:'COMIDA'},now).length,1);
});

test('tipo y período se combinan sin modificar movimientos de origen',()=>{
  const before=JSON.stringify(state);
  const e=buildHistoryEvents(state);
  assert.equal(filterHistoryEvents(e,{kind:'expense',days:30},now).length,1);
  assert.equal(filterHistoryEvents(e,{kind:'reconciliation',days:30},now).length,1);
  assert.equal(filterHistoryEvents(e,{kind:'activity',days:1},now).length,0);
  assert.equal(filterHistoryEvents(e,{kind:'thirdparty',days:7},now).length,2);
  assert.equal(JSON.stringify(state),before);
});

test('UI integra captura canónica, tema oscuro y nuevos módulos al shell offline',async()=>{
  const [init,quick,html,history,bootstrap,sw]=await Promise.all([
    source('js/05_init.js'),source('js/ui/quick-entry.js'),source('index.html'),
    source('historial.html'),source('js/pwa-bootstrap.js'),source('sw.js')
  ]);
  assert.match(init,/initExperienceUI/);
  assert.match(init,/initHistoryFilters/);
  assert.match(quick,/recordUniversalMovement\(/);
  assert.match(quick,/operationId:opId/);
  assert.match(quick,/getPersonalAccounts\(\{activeOnly:true\}\)/);
  assert.match(html,/data-quick-action="expense"/);
  assert.match(html,/data-quick-action="income"/);
  assert.match(history,/id="historySearch"/);
  assert.match(history,/id="historyKind"/);
  assert.match(bootstrap,/hecagus-ux-theme-v1/);
  for(const name of ['quick-entry.js','history-filters.js'])assert.ok(sw.includes(name),'PWA no incluye '+name);
});
