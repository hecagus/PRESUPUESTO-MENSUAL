import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
const indexHtml=await readFile(new URL('../index.html',import.meta.url),'utf8');
const calendarHtml=await readFile(new URL('../calendar.html',import.meta.url),'utf8');
let dom;
function page(html=indexHtml){dom=new JSDOM(html,{url:'https://app.test/index.html'});globalThis.document=dom.window.document;}
page();globalThis.localStorage=dom.window.localStorage;
const Data=await import('../js/02_data.js');
const Life=await import('../js/21_financial_life_v27.js');
const Home=await import('../js/23_home_semantics.js');
const Costs=await import('../js/domain/operating-costs.js');
const Forecast=await import('../js/16_forecast_engine.js');
const UI=await import('../js/14_calendar_ui.js');
const {paymentDueBreakdown,localDay}=await import('../js/domain/financial-rules.js');
const now=new Date('2026-10-02T02:30:00');
const close=(a,b)=>assert.ok(Math.abs(a-b)<0.005,`${a} != ${b}`);
const at=date=>new Date(`${date}T02:30:00`);
function reset(){
  page();Data.restaurar(JSON.stringify({...Data.createEmptyState(),profile:{onboarded:true,transportMode:'none'},savingsGoals:[{id:'goal',name:'Moto',targetAmount:47000,targetDate:'2027-02-16',reserved:807,active:true}]}));
  Life.ensureFinancialLife();Data.saldoInicial(4830.66);
}
const food=(date='2026-10-15')=>Home.createHouseholdExpense({name:'Comida',amount:3000,kind:'obligation',frequency:'biweekly',nextDueDate:date});
test.beforeEach(t=>{t.mock.timers.enable({apis:['Date'],now});reset();});

test('captura: $6000 del 15 y 31 son futuros; disponible hoy $4023.66 y plan original -$1976.34',()=>{
  food();const p=Life.financialPosition(now);
  close(p.cash,4830.66);close(p.reserved,807);close(p.dueNow,0);close(p.dueToday,0);close(p.overdue,0);close(p.futureDue,6000);
  close(p.availableToday,4023.66);close(p.committed,6000);close(p.free,-1976.34);
  assert.equal(p.planningDays,30);assert.equal(localDay(p.planningUntil),'2026-10-31');
  assert.ok(Life.upcomingFinancialEvents({days:30,now}).filter(e=>e.household).every(e=>!e.overdue));
});

test('vencimientos separan día original, hoy y futuro; ingresos, metas e importes inválidos no son exigibles',()=>{
  const events=[
    {type:'expense',amount:400,dueDate:'2026-09-30',date:now.toISOString(),overdue:true},
    {type:'debt',amount:123,dueDate:'2026-10-02T09:00:00',date:'2026-10-02T09:00:00'},
    {type:'expense',amount:777,dueDate:'2026-10-15'},
    {type:'income',amount:9900,date:'2026-10-02'},
    {type:'goal',amount:10000,date:'2026-10-02'},
    {type:'expense',amount:-50,date:'2026-10-02'},
    {type:'expense',amount:5,date:'2026-02-30'},
    {type:'expense',amount:5,date:'invalid'}
  ],before=structuredClone(events);
  assert.deepEqual(paymentDueBreakdown(events,now),{overdue:400,dueToday:123,futureDue:777,dueNow:523});
  assert.deepEqual(events,before);assert.throws(()=>paymentDueBreakdown(events,new Date('invalid')),/FECHA_INVALIDA/);
});

test('fecha civil del vencimiento conserva el día en México, incluso cuando cambia el día UTC',()=>{
  const instant=new Date('2026-10-15T00:30:00Z'),isFifteenth=localDay(instant)==='2026-10-15';
  const p=paymentDueBreakdown([{type:'expense',amount:100,date:'2026-10-15'}],instant);
  assert.equal(p.dueToday,isFifteenth?100:0);assert.equal(p.futureDue,isFifteenth?0:100);assert.equal(p.overdue,0);
  if(process.env.TZ==='America/Mexico_City')assert.equal(p.futureDue,100);
  if(process.env.TZ==='UTC')assert.equal(p.dueToday,100);
});

test('vence hoy entra desde el inicio del día, sin marcar como vencido por su hora de presentación',()=>{
  Home.createHouseholdExpense({name:'Pago de hoy',amount:500,kind:'obligation',frequency:'one_time',nextDueDate:'2026-10-02'});
  const p=Life.financialPosition(now);close(p.dueToday,500);close(p.overdue,0);close(p.dueNow,500);close(p.availableToday,3523.66);
  assert.equal(Life.upcomingFinancialEvents({now}).find(e=>e.title==='Pago de hoy').overdue,false);
});

test('el 15 pasa de programado a exigible; el 16 pasa a vencido si sigue sin pagar',()=>{
  food();const before=Life.financialPosition(at('2026-10-14')),today=Life.financialPosition(at('2026-10-15')),late=Life.financialPosition(at('2026-10-16'));
  close(before.dueNow,0);close(before.futureDue,6000);
  close(today.dueToday,3000);close(today.overdue,0);close(today.futureDue,3000);close(today.availableToday,1023.66);
  close(late.overdue,3000);close(late.dueToday,0);close(late.dueNow,3000);close(late.availableToday,1023.66);
});

test('abono parcial deja sólo $400 vencidos y las dos quincenas futuras por separado',()=>{
  const item=food('2026-09-30');Home.recordHouseholdExpense(item.id,2600,new Date('2026-09-30T18:00:00').getTime());
  const p=Life.financialPosition(now);close(p.cash,2230.66);close(p.overdue,400);close(p.dueNow,400);close(p.futureDue,6000);
  close(p.availableToday,1023.66);close(p.committed,6400);close(Home.householdSummary(now).mandatory,6000);
});

test('pagar hoy un vencimiento futuro descuenta una vez del efectivo y deja la planificación original coherente',()=>{
  const item=food(),before=Life.financialPosition(now);Home.recordHouseholdExpense(item.id,3000,now.getTime());
  const after=Life.financialPosition(now);close(after.cash,before.cash-3000);close(after.availableToday,before.availableToday-3000);
  close(after.dueNow,0);close(after.futureDue,3000);close(after.committed,before.committed-3000);close(after.free,before.free);
  assert.equal(Data.getState().movimientos.filter(m=>m.householdExpenseId===item.id).length,1);
});

test('obligaciones operativas y cuotas de deuda también esperan su vencimiento',()=>{
  const item=Costs.createOperatingObligation({name:'Renta de vehículo',amount:490,frequency:'weekly',nextDueDate:'2026-10-08'});
  Data.getState().deudas.push({id:'debt',desc:'Pago único',montoTotal:200,montoCuota:200,saldo:200,frecuencia:'Unico',creadaEn:now.toISOString(),dueDate:'2026-10-09'});Data.saveData();
  const current=Life.financialPosition(now);close(current.dueNow,0);close(current.futureDue,2160);close(current.availableToday,4023.66);
  const due=Life.financialPosition(at('2026-10-08'));close(due.dueToday,490);close(due.availableToday,3533.66);
  assert.ok(Life.upcomingFinancialEvents({now,days:30}).filter(e=>e.refId===item.id).every(e=>!e.overdue));
});

test('presupuestos y reservas siguen afectando el plan y las metas; no se presentan como recibos vencidos',()=>{
  Home.createHouseholdExpense({name:'Presupuesto salud',amount:800,kind:'budget',frequency:'monthly'});
  Home.createHouseholdExpense({name:'Compra necesaria',amount:200,kind:'reserve',frequency:'one_time'});
  const p=Life.financialPosition(now);close(p.dueNow,0);close(p.futureDue,0);close(p.planningReserve,1000);
  close(p.availableToday,4023.66);close(p.committed,1000);close(p.free,3023.66);
});

test('ingresos futuros importados o esperados no incrementan el disponible de hoy',()=>{
  food();Data.getState().movimientos.push({id:'future-income',tipo:'ingreso',monto:19800,fecha:'2026-10-31T12:00:00',accountId:'acct-personal',affectsPersonal:true});Data.sanearDatos();
  const p=Life.financialPosition(now);close(p.cash,4830.66);close(p.availableToday,4023.66);close(p.free,-1976.34);
});

test('proyección de la captura conserva ingresos $19800, egresos $9499 y efectivo final $15131.66',()=>{
  food();Data.crearFuenteTrabajo({id:'job',name:'Jaimau',kind:'employment',compensation:'biweekly',fuelPayer:'none'});
  Data.registrarPagoFuente('job',9900,new Date('2026-10-01T12:00:00'));
  Data.getState().movimientos.push({id:'past-expense',tipo:'gasto',monto:9900,fecha:'2026-10-01T13:00:00',accountId:'acct-personal',affectsPersonal:true});Data.sanearDatos();
  Costs.createOperatingObligation({name:'Renta de vehículo',amount:499,frequency:'weekly',nextDueDate:'2026-11-12',sourceId:'job'});
  const p=Life.financialPosition(now),f=Forecast.cashFlowForecast({days:45,now});
  close(p.availableToday,4023.66);close(p.free,-1976.34);close(f.totalExpectedIncome,19800);close(f.totalExpectedOutflow,9499);
  close(f.endingCash,15131.66);close(f.endingFree,14324.66);assert.equal(f.firstNegativeDate,null);
});

test('Inicio muestra disponible hoy y una proyección con ingresos y pagos del mismo horizonte',()=>{
  food();UI.renderFinancialPositionPanel();UI.renderCalendarPreview();
  assert.equal(document.getElementById('mainSummaryValue').textContent,'$4,023.66');
  const summary=document.getElementById('financialPositionZone').textContent,plan=document.getElementById('calendarPreviewZone').textContent;
  assert.match(summary,/Exigible hoy\$0\.00/);assert.match(summary,/Disponible hoy\$4,023\.66/);
  assert.doesNotMatch(document.getElementById('mainSummarySub').textContent,/no cubre/);assert.match(plan,/Pagos previstos · 45 días\$9,000\.00/);
  assert.match(plan,/Disponible proyectado · 45 días-\$4,976\.34/);assert.match(plan,/efectivo actual/);assert.doesNotMatch(plan,/Vencido/);
});

test('un faltante realmente exigible hoy sí mantiene la alerta y el detalle negativo',()=>{
  Home.createHouseholdExpense({name:'Pago de hoy',amount:5000,kind:'obligation',frequency:'one_time',nextDueDate:'2026-10-02'});UI.renderFinancialPositionPanel();
  assert.equal(document.getElementById('mainSummaryValue').textContent,'-$976.34');assert.match(document.getElementById('mainSummarySub').textContent,/pagos exigibles hoy/);
  assert.ok([...document.getElementById('financialPositionZone').querySelectorAll('strong')].some(el=>el.textContent==='-$976.34'&&el.style.color==='var(--danger)'));
});

test('Calendario usa la misma separación y conserva fechas, navegación y datos',()=>{
  food();Life.financialPosition(now);const before=structuredClone(Data.getState());page(calendarHtml);UI.renderCalendarPage();
  const summary=document.getElementById('calendarPosition').textContent,events=document.getElementById('calendarEvents').textContent;
  assert.match(summary,/Disponible hoy\$4,023\.66/);assert.match(summary,/Pagos previstos · 45 días\$9,000\.00/);assert.match(summary,/-\$4,976\.34/);
  assert.doesNotMatch(events,/Vencido/);assert.match(events,/15 de oct|15 oct/);assert.match(events,/31 de oct|31 oct/);
  assert.deepEqual(Data.getState(),before);assert.equal(document.querySelector('a[href="home.html"]').getAttribute('href'),'home.html');
  assert.equal(Object.hasOwn(Data.getState().financialPlan,'availableToday'),false);
});
