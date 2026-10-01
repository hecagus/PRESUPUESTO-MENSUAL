import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
const dom=new JSDOM('<body data-page="stats"><main><section><div id="statsGeneral"></div></section></main></body>',{url:'https://app.test/stats.html'});
globalThis.document=dom.window.document;globalThis.localStorage=dom.window.localStorage;
const Data=await import('../js/02_data.js');
const Life=await import('../js/21_financial_life_v27.js');
const Home=await import('../js/23_home_semantics.js');
const Costs=await import('../js/domain/operating-costs.js');
const UI=await import('../js/19_platform_ui.js');
const now=new Date('2026-10-01T18:00:00');
test.beforeEach(t=>{
  t.mock.timers.enable({apis:['Date'],now});
  Data.restaurar(JSON.stringify({...Data.createEmptyState(),profile:{onboarded:true,transportMode:'none'},workSources:[{id:'job',name:'Empleo',compensation:'biweekly',status:'active',active:true}],savingsGoals:[]}));
  Life.ensureFinancialLife();
});
test('salud muestra proyección mensual y cobros reales separados, con costos de trabajo',()=>{
  Data.registrarPagoFuente('job',9900,now);
  Home.createHouseholdExpense({name:'Comida',amount:3000,kind:'obligation',frequency:'biweekly',nextDueDate:'2026-10-15'});
  Costs.createOperatingObligation({name:'Vehículo',amount:490,frequency:'weekly',nextDueDate:'2026-10-01'});
  UI.renderFinancialPlatform();const text=document.getElementById('platformHealthContent').textContent;
  assert.match(text,/41% del ingreso mensual proyectado/);
  assert.match(text,/Ingreso mensual proyectado.*19,800/);
  assert.match(text,/ingreso realmente cobrado.*9,900/);
  assert.doesNotMatch(text,/174%|NaN|Infinity/);
});
test('sin historial el componente se muestra sin puntuación y no inventa cero de ingreso mensual observado',()=>{
  UI.renderFinancialPlatform();const text=document.getElementById('platformHealthContent').textContent;
  assert.match(text,/Carga fija—\/25/);assert.match(text,/sin historial suficiente/);
  assert.doesNotMatch(text,/NaN|Infinity|200%|null/);
});
