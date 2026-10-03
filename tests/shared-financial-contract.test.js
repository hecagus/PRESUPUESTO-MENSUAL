import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
const dom=new JSDOM('<body data-page="admin"><div id="sourcePaymentZone"></div><div id="appModal"><h2 id="modalTitle"></h2><div id="modalBody"></div><button id="modalConfirm"></button><button id="modalCancel"></button></div></body>',{url:'https://app.test/admin.html'});
globalThis.document=dom.window.document;globalThis.localStorage=dom.window.localStorage;globalThis.Option=dom.window.Option;
const Data=await import('../js/02_data.js');
const Life=await import('../js/21_financial_life_v27.js');
const Home=await import('../js/23_home_semantics.js');
const Goals=await import('../js/11_savings_goals.js');
const Forecast=await import('../js/16_forecast_engine.js');
const Automation=await import('../js/17_automation_engine.js');
const Health=await import('../js/18_health_goals.js');
const Costs=await import('../js/domain/operating-costs.js');
const Context=await import('../js/app/financial-context.js');
const Options=await import('../js/app/financial-options.js');
const Rules=await import('../js/domain/financial-rules.js');
const Payments=await import('../js/ui/source-payments.js');
const {mergeStates}=await import('../js/26_sync_merge.js');
const Charts=await import('../js/04_charts.js');
const now=new Date('2026-10-02T18:00:00'),at=day=>new Date(`${day}T18:00:00`);
const close=(a,b)=>assert.ok(Math.abs(a-b)<0.005,`${a} != ${b}`);
const food=()=>Home.createHouseholdExpense({name:'Comida',amount:3000,frequency:'biweekly',kind:'obligation',nextDueDate:'2026-10-15'});
const goal=()=>Goals.createSavingsGoal({name:'Moto',targetAmount:47000,targetDate:'2027-02-16'});
function income(id,amount,date=now,extra={}){return {id,fecha:new Date(date).toISOString(),tipo:'ingreso',monto:amount,categoria:'Trabajo',accountId:'acct-personal',affectsPersonal:true,...extra};}
function history(){
  for(let i=28;i>=1;i--){const date=new Date(now);date.setDate(date.getDate()-i);Data.getState().movimientos.push(income(`gig-${i}`,400,date,{sourceId:'gig'}),{...income(`cost-${i}`,100,date,{sourceId:'gig'}),tipo:'gasto',categoria:'Transporte'});}
  Data.sanearDatos();
}
test.beforeEach(t=>{
  t.mock.timers.enable({apis:['Date'],now});localStorage.clear();
  Data.restaurar(JSON.stringify({...Data.createEmptyState(),profile:{onboarded:true,transportMode:'none'},
    workSources:[{id:'salary',name:'Empleo',kind:'employment',compensation:'biweekly',active:true,status:'active'},{id:'gig',name:'Plataforma',kind:'gig',compensation:'per_shift',active:true,status:'active'}]}));
  Life.ensureFinancialLife();
});

test('se puede apartar $328 cobrados aunque las obligaciones futuras superen el efectivo actual',()=>{
  Data.saldoInicial(5083.87);food();const g=goal();Goals.contributeToSavingsGoal(g.id,807);
  const before=Life.financialPosition();assert.ok(before.free<0);close(before.availableToday,4276.87);
  Goals.contributeToSavingsGoal(g.id,328,{sourceId:'gig'});
  const after=Life.financialPosition();close(after.cash,before.cash);close(after.reserved,1135);close(after.availableToday,3948.87);
  close(Goals.savingsCapacity(g.id).safeFreeCash,after.savingsAvailableNow);close(Health.smartGoalPlan(g.id).suggestedNow,Math.min(after.savingsAvailableNow,Goals.savingsGoalSummary(g.id).requiredMonthly));
});
test('los ingresos esperados nunca autorizan a apartar efectivo inexistente',()=>{
  Data.registrarPagoFuente('salary',1000,now,{periodDate:'2026-09-30'});food();const g=goal();
  assert.ok(Forecast.cashFlowForecast().totalExpectedIncome>0);
  assert.throws(()=>Goals.contributeToSavingsGoal(g.id,1001),/SALDO_DISPONIBLE_INSUFICIENTE/);close(Life.financialPosition().reserved,0);
});
test('las reservas explícitas y presupuestos elegidos siguen protegidos separadamente de obligaciones futuras',()=>{
  Data.saldoInicial(5000);food();Home.createHouseholdExpense({name:'Despensa',amount:1000,kind:'budget',frequency:'monthly'});
  Home.createHouseholdExpense({name:'Compra prevista',amount:500,kind:'reserve'});const g=goal(),p=Life.financialPosition();
  close(p.availableToday,5000);close(p.planningReserve,1500);close(p.savingsAvailableNow,3500);
  assert.throws(()=>Goals.contributeToSavingsGoal(g.id,3501),/SALDO_DISPONIBLE_INSUFICIENTE/);
});
test('un saldo exigible parcial protege sólo los $400 pendientes, sin sumar otra obligación mensual',()=>{
  Data.saldoInicial(10000);const item=Home.createHouseholdExpense({name:'Comida',amount:3000,kind:'obligation',frequency:'biweekly',nextDueDate:'2026-09-30'});
  Home.recordHouseholdExpense(item.id,2600,at('2026-09-30').getTime());
  const p=Life.financialPosition();close(p.dueNow,400);close(p.savingsAvailableNow,7000);close(Context.financialContext().monthly.essential,6000);
});
test('un flujo balanceado no lanza una alerta crítica por obligaciones aún futuras',()=>{
  Data.saldoInicial(3000);Data.registrarPagoFuente('salary',2000,now,{periodDate:'2026-09-30'});food();
  const context=Context.financialContext({days:30});close(context.position.cashOnlyPlanFree,-1000);close(context.forecast.endingFree,3000);
  assert.equal(context.forecast.risk,'ok');assert.equal(context.forecast.firstNegativeDate,null);
  assert.ok(!Automation.smartAlerts(now,context).some(a=>a.id==='free-negative'||a.id==='forecast-negative'));
});
test('una falta real de efectivo o reservas se detecta desde hoy incluso sin eventos futuros',()=>{
  Data.getState().movimientos.push({...income('overspent',100),tipo:'gasto'});
  const f=Forecast.cashFlowForecast();assert.equal(f.risk,'negative');assert.equal(f.firstNegativeDate,now.toISOString());
  assert.ok(Automation.smartAlerts().some(a=>a.id==='free-negative'));
});
test('cobro y pago del mismo día se equilibran al cierre sin faltantes por horas artificiales',()=>{
  history();Data.getState().movimientos.push({...income('spent',8300),tipo:'gasto'});
  Home.createHouseholdExpense({name:'Pago de mañana',amount:300,kind:'obligation',frequency:'one_time',nextDueDate:'2026-10-03'});
  const f=Forecast.cashFlowForecast({days:2,includeVariable:true});close(f.startCash,100);close(f.totalExpectedIncome,300);close(f.endingCash,100);
  close(f.minCash,100);assert.equal(f.firstNegativeDate,null);assert.equal(f.risk,'ok');
  assert.equal(f.events.length,2);for(const event of f.events){close(event.projectedCash,100);assert.equal(event.balanceBasis,'end_of_day');}
});
test('un cobro de otro día no oculta el faltante anterior aunque el saldo final sea positivo',()=>{
  const source=Data.getState().workSources.find(s=>s.id==='salary');source.compensation='weekly';source.paySchedule={weekDay:0};
  Data.registrarPagoFuente('salary',1000,at('2026-09-27'),{periodDate:'2026-09-27'});
  Data.getState().movimientos.push({...income('spent',900),tipo:'gasto'});
  Home.createHouseholdExpense({name:'Pago de mañana',amount:300,kind:'obligation',frequency:'one_time',nextDueDate:'2026-10-03'});
  const f=Forecast.cashFlowForecast({days:3});close(f.endingCash,800);close(f.minCash,-200);assert.equal(f.risk,'negative');
  assert.equal(Rules.localDay(f.firstNegativeDate),'2026-10-03');
});
test('la convención mensual compara comida y Mottu con dos quincenas; las metas no aumentan la carga fija',()=>{
  Data.registrarPagoFuente('salary',9900,now,{periodDate:'2026-09-30'});food();
  Costs.createOperatingObligation({name:'Vehículo',amount:490,frequency:'weekly',nextDueDate:'2026-11-12'});
  const before=Health.financialHealth();close(before.monthlyIncome,19800);close(before.essentialMonthly,6000+490*52/12);close(before.breakdown.find(b=>b.key==='commitments').value,(6000+490*52/12)/19800);
  goal();close(Health.financialHealth().essentialMonthly,before.essentialMonthly);
});
test('la preferencia variable se comparte en forecast, salud, metas y capacidad sin aumentar el saldo actual',()=>{
  history();const g=goal(),before=Health.smartGoalPlan(g.id),cash=Life.financialPosition().cash;
  Options.setVariableIncomeScenario(true);
  const ctx=Context.financialContext(),health=Health.financialHealth(),plan=Health.smartGoalPlan(g.id);
  assert.equal(ctx.scenario.includeVariable,true);assert.equal(health.forecast.includeVariable,true);assert.equal(plan.forecast.includeVariable,true);
  assert.equal(Goals.savingsCapacity(g.id).incomeProjection.includeVariable,true);
  close(health.monthlyIncome,ctx.monthly.income);assert.ok(plan.availableMonthly>before.availableMonthly);close(Life.financialPosition().cash,cash);
  assert.equal(Forecast.cashFlowForecast({includeVariable:false}).totalExpectedIncome,0);
});
test('con sólo tres jornadas el efectivo cobrado existe pero no se inventa una estimación de Uber',()=>{
  for(let i=2;i>=0;i--){const date=new Date(now);date.setDate(date.getDate()-i);Data.getState().movimientos.push(income(`short-${i}`,328,date,{sourceId:'gig'}));}
  Options.setVariableIncomeScenario(true);const ctx=Context.financialContext();close(ctx.position.cash,984);close(ctx.forecast.totalExpectedIncome,0);
  assert.ok(ctx.monthly.projection.insufficientSources.includes('gig'));
});
test('gastos directos de Hogar influyen en capacidad observada; pagos programados no se duplican',()=>{
  history();food();const before=Context.financialContext();
  Home.recordDirectHouseholdExpense({name:'Compra ocasional',amount:990,date:Rules.localDay(now),category:'Ropa'});
  const after=Context.financialContext();close(after.monthly.additionalObserved-before.monthly.additionalObserved,990);assert.ok(after.monthly.outflow>before.monthly.outflow);
  Home.recordHouseholdExpense(Data.getState().financialPlan.householdExpenses.find(x=>x.name==='Comida').id,3000,now.getTime());
  close(Context.financialContext().monthly.additionalObserved,after.monthly.additionalObserved);
});
test('la nueva política no procesa ingresos antiguos bloqueados y sí aplica una sola vez a un ingreso nuevo',()=>{
  Data.saldoInicial(5000);food();const g=goal();
  Data.getState().automationRules=[{id:'old-rule',goalId:g.id,percent:100,active:true,type:'reserve_income_percent',createdAt:at('2026-09-01').toISOString()}];
  Data.getState().movimientos.push(income('blocked-income',328,at('2026-10-01')));
  Automation.runAutomationEngine();close(Goals.savingsGoalSummary(g.id).reserved,0);assert.ok(Data.getState().ruleApplications.some(a=>a.movementId==='blocked-income'&&a.status==='before_policy'));
  Data.getState().movimientos.push(income('new-income',328));assert.equal(Automation.runAutomationEngine(),1);close(Goals.savingsGoalSummary(g.id).reserved,328);assert.equal(Automation.runAutomationEngine(),0);
});
test('un intento sin efectivo no se reactiva sobre ingresos viejos al pagar una obligación',()=>{
  Data.saldoInicial(100);const g=goal();Automation.createReserveRule({goalId:g.id,percent:100});
  const item=Home.createHouseholdExpense({name:'Pago de hoy',amount:100,kind:'obligation',frequency:'one_time',nextDueDate:Rules.localDay(now)});
  Data.getState().movimientos.push(income('earned',100));Home.recordDirectHouseholdExpense({name:'Otro gasto',amount:100,date:Rules.localDay(now)});
  Automation.runAutomationEngine();assert.ok(Data.getState().ruleApplications.some(a=>a.movementId==='earned'&&a.status==='insufficient_today'));
  Home.setHouseholdExpenseActive(item.id,false);Automation.runAutomationEngine();close(Goals.savingsGoalSummary(g.id).reserved,0);
});
test('el cobro del 1 que cubre septiembre conserva fecha e importe y deja el 15 y 31 pendientes',()=>{
  Data.registrarPagoFuente('salary',9900,at('2026-10-01'),{periodDate:'2026-09-30'});
  const payment=Data.getState().movimientos.at(-1);assert.equal(payment.periodo,'2026-09-Q2');assert.equal(payment.fecha,at('2026-10-01').toISOString());
  close(Charts.resumenPeriodoFuente(Data.getState(),'salary',now).receivedMonth,9900);assert.equal(Charts.resumenPeriodoFuente(Data.getState(),'salary',now).pagado,false);
  assert.deepEqual(Life.upcomingFinancialEvents({days:30,now}).filter(e=>e.type==='income').map(e=>Rules.localDay(e.date)),['2026-10-15','2026-10-31']);
  close(Context.financialContext({days:30}).forecast.totalExpectedIncome,19800);
});
test('si falla el guardado de la corrección se conserva el período y el historial anterior',()=>{
  Data.registrarPagoFuente('salary',9900,at('2026-10-01'));const payment=Data.getState().movimientos.at(-1),before=structuredClone(payment);
  const proto=Object.getPrototypeOf(localStorage),saved=proto.setItem;proto.setItem=()=>{throw new Error('storage full');};
  try{assert.throws(()=>Data.actualizarPeriodoPagoFuente(payment.id,'2026-09-30'),/storage full/);assert.deepEqual(payment,before);}
  finally{proto.setItem=saved;}
});
test('preferencias y reglas conservan su versión al restaurar un respaldo, sin reprocesar ingresos',()=>{
  Data.saldoInicial(1000);const g=goal();Automation.createReserveRule({goalId:g.id,percent:10});Options.setVariableIncomeScenario(true);
  const before=structuredClone(Data.getState());Data.restaurar(JSON.stringify(before));Life.ensureFinancialLife();Automation.ensureAutomationEngine();
  assert.equal(Options.financialScenario().includeVariable,true);assert.deepEqual(Data.getState().movimientos,before.movimientos);assert.deepEqual(Data.getState().automationRules,before.automationRules);
  assert.deepEqual(Data.getState().ruleApplications,before.ruleApplications);
});
test('corregir un período conserva IDs, efectivo y fecha real, registra la corrección y rechaza colisiones',()=>{
  Data.registrarPagoFuente('salary',9900,at('2026-10-01'));const payment=Data.getState().movimientos.at(-1),before=structuredClone(payment);
  Data.actualizarPeriodoPagoFuente(payment.id,'2026-09-30',{expectedPeriod:before.periodo});
  close(Life.financialPosition().cash,9900);assert.equal(payment.id,before.id);assert.equal(payment.fecha,before.fecha);assert.equal(payment.monto,before.monto);assert.equal(payment.periodHistory[0].from,'2026-10-Q1');
  assert.throws(()=>Data.actualizarPeriodoPagoFuente(payment.id,'2026-10-15',{expectedPeriod:before.periodo}),/COBRO_CAMBIO/);
  Data.registrarPagoFuente('salary',8800,now,{periodDate:'2026-10-15'});
  assert.throws(()=>Data.actualizarPeriodoPagoFuente(payment.id,'2026-10-15'),/COBRO_DUPLICADO/);
});
test('el formulario pide el período cubierto y registra el dinero hoy, sin perder el fin de mes en México',()=>{
  Payments.showSourcePayment('salary',fn=>fn());
  const date=document.querySelector('[data-k="periodDate"]');assert.equal(date.value,'2026-09-30');document.querySelector('[data-k="amount"]').value='9900';
  document.getElementById('modalConfirm').click();const payment=Data.getState().movimientos.at(-1);
  assert.equal(payment.periodo,'2026-09-Q2');assert.equal(payment.fecha,now.toISOString());
  assert.throws(()=>Rules.incomePeriodDate('2026-02-30'),/FECHA_INVALIDA/);
});
test('Mottu y Comida comparten programado, mañana, hoy y vencido sin exigir importes antes del día',()=>{
  const operating=Costs.createOperatingObligation({name:'Mottu',amount:499,frequency:'weekly',nextDueDate:'2026-11-12'});
  const event=Costs.operatingUpcomingEvents({days:60,now}).find(e=>e.refId===operating.id);
  assert.equal(Rules.paymentDueState(event,at('2026-11-10')),'scheduled');assert.equal(Rules.paymentDueState(event,at('2026-11-11')),'due_tomorrow');assert.equal(Rules.paymentDueState(event,at('2026-11-12')),'due_today');assert.equal(Rules.paymentDueState(event,at('2026-11-13')),'overdue');
  food();for(const day of ['2026-10-14','2026-10-15','2026-10-16']){
    const alerts=Automation.smartAlerts(at(day));assert.ok(alerts.some(a=>a.title.includes(day.endsWith('14')?'Vence mañana':day.endsWith('15')?'Vence hoy':'Pago vencido')));
  }
  assert.equal(Life.financialPosition(now).dueNow,0);
});
test('dos dispositivos no consolidan $1400 de reserva contra $1000 de efectivo y no borran historiales',()=>{
  Data.saldoInicial(1000);goal();const base=structuredClone(Data.getState()),local=structuredClone(base),remote=structuredClone(base);
  for(const [s,id] of [[local,'local'],[remote,'remote']]){s.savingsGoals[0].reserved=700;s.savingsGoals[0].history=[{id,fecha:now.toISOString(),type:'reserve',amount:700}];}
  const before=structuredClone({local,remote}),result=mergeStates(local,remote,base);
  assert.ok(result.conflicts.some(c=>c.kind==='reservation_capacity'));close(result.state.savingsGoals[0].reserved,1400);assert.equal(result.state.savingsGoals[0].history.length,2);assert.deepEqual({local,remote},before);
  assert.ok(mergeStates(local,remote,base,{'/financial-reservations/capacity':'both'}).conflicts.some(c=>c.kind==='reservation_capacity'));
  local.savingsGoals[0].reserved=300;local.savingsGoals[0].history.push({id:'release',fecha:now.toISOString(),type:'release',amount:400});
  const resolved=mergeStates(local,remote,base);assert.equal(resolved.conflicts.length,0);close(resolved.state.savingsGoals[0].reserved,1000);assert.equal(resolved.state.savingsGoals[0].history.length,3);
});
test('una ventana de 30 días entrega exactamente 30 días y el mismo final en todos los consumidores',()=>{
  const context=Context.financialContext({days:30}),rows=Forecast.forecastDaily({days:30,now});
  assert.equal(rows.length,30);assert.equal(Rules.localDay(rows.at(-1).date),Rules.localDay(context.planning.until));assert.equal(Rules.localDay(rows.at(-1).date),'2026-10-31');
});
