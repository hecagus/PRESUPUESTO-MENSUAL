import test from 'node:test';
import assert from 'node:assert/strict';
import * as Rules from '../js/domain/financial-rules.js';
import { mergeStates } from '../js/26_sync_merge.js';
import { STORAGE_KEY } from '../js/01_consts_utils.js';

class Storage {
  data = new Map();
  getItem(k) { return this.data.has(k) ? this.data.get(k) : null; }
  setItem(k,v) { this.data.set(k,String(v)); }
  clear() { this.data.clear(); }
}
globalThis.localStorage = new Storage();
const Data = await import('../js/02_data.js');
const Life = await import('../js/21_financial_life_v27.js');
const Base = await import('../js/13_financial_life.js');
const Home = await import('../js/23_home_semantics.js');
const Costs = await import('../js/domain/operating-costs.js');
const Health = await import('../js/18_health_goals.js');
const Accounts = await import('../js/15_accounts_engine.js');
const Forecast = await import('../js/16_forecast_engine.js');
const Goals = await import('../js/11_savings_goals.js');
const Charts = await import('../js/04_charts.js');
const Automation = await import('../js/17_automation_engine.js');
const now = new Date('2026-10-01T18:00:00');
const close = (a,b) => assert.ok(Math.abs(a-b)<0.005,`${a} != ${b}`);
function entry(id,tipo,monto,extra={}) {
  return {id,tipo,monto,fecha:new Date('2026-10-01T10:00:00').toISOString(),accountId:'acct-personal',affectsPersonal:true,categoria:'Trabajo',...extra};
}
function reset(extra={}) {
  Data.restaurar(JSON.stringify({...Data.createEmptyState(),profile:{onboarded:true,transportMode:'none'},
    workSources:[{id:'salary',name:'Empleo',compensation:'biweekly',status:'active',active:true},{id:'gig',name:'Plataforma',compensation:'per_shift',status:'active',active:true}],
    movimientos:[entry('opening','ingreso',2223,{categoria:'Sistema',fecha:new Date('2026-09-30T10:00:00').toISOString()})],
    savingsGoals:[],financialPlan:{householdExpenses:[],householdKinds:{},commitments:[],livingBudgets:{},householdCanonicalMigrationVersion:3,householdDirectRepairVersion:2},...extra}));
  Life.ensureFinancialLife();
}
const food=()=>Home.createHouseholdExpense({name:'Alimentación obligatoria',amount:3000,frequency:'biweekly',kind:'obligation',nextDueDate:'2026-09-30'});
const rent=(patch={})=>Costs.createOperatingObligation({name:'Renta de vehículo',amount:490,frequency:'weekly',nextDueDate:'2026-10-01',sourceId:'gig',accountId:'acct-personal',...patch});
test.beforeEach(t=>{t.mock.timers.enable({apis:['Date'],now});localStorage.clear();reset();});

test('A / I: una quincena cobrada proyecta dos, sin confundir patrimonio ni ingreso variable',()=>{
  Data.getState().movimientos.push(entry('pay','ingreso',9900,{sourceId:'salary',paymentKind:'source_period',periodo:'2026-10-Q1'}),entry('uber','ingreso',421.97,{sourceId:'gig'}));
  const h=Health.financialHealth(now);
  close(h.ingresoMensualProyectado,19800);close(h.ingresoRealPeriodo,10321.97);
  assert.equal(h.ingresoVariableEstimado,0);assert.equal(h.observed.monthlyIncome,null);
  assert.ok(h.projection.insufficientSources.includes('gig'));
  assert.equal(Data.getState().workSources.find(s=>s.id==='gig').compensation,'per_shift');
});

test('B / C / D / E: comida + obligación operativa usan el promedio calendario, sin metas en carga fija',()=>{
  food();rent();Data.getState().movimientos.push(entry('pay','ingreso',9900,{sourceId:'salary',paymentKind:'source_period',periodo:'2026-10-Q1'}));
  const before=Health.financialHealth(now);
  close(Home.householdSummary(now).mandatory,6000);close(before.essentialMonthly,6000+490*52/12);
  close(before.breakdown.find(b=>b.key==='commitments').value,(6000+490*52/12)/19800);
  Data.getState().savingsGoals.push({id:'moto',name:'Moto',targetAmount:47000,reserved:0,targetDate:'2027-02-16T23:59:59',active:true,history:[]});
  const after=Health.financialHealth(now);close(after.essentialMonthly,before.essentialMonthly);
  close(after.breakdown.find(b=>b.key==='commitments').value,before.breakdown.find(b=>b.key==='commitments').value);
  assert.match(after.breakdown[1].detail,/mensual proyectado/);
});

test('todas las frecuencias normalizan una sola vez, incluidos bimestre, trimestre, año y pago único',()=>{
  for(const [freq,value] of [['Semanal',1000*52/12],['Quincenal',2000],['Mensual',1000],['Bimestral',500],['Trimestral',1000/3],['Anual',1000/12],['Unico',0],['Diario',31000]])close(Rules.monthlyAmount(1000,freq,now),value);
  const item=Home.createHouseholdExpense({name:'Seguro',amount:1200,frequency:'Trimestral',kind:'obligation',nextDueDate:'2026-10-31'});
  close(Home.householdMonthlyEquivalent(item,now),400);
  const dates=Home.householdUpcomingEvents({days:140,now}).filter(e=>e.refId===item.id).map(e=>Rules.localDay(e.dueDate));
  assert.deepEqual(dates,['2026-10-31','2027-01-31']);
});

test('un salario dividido en varios movimientos se estima por período, no por movimiento',()=>{
  Data.getState().movimientos.push(entry('a','ingreso',5000,{sourceId:'salary',paymentKind:'source_period',periodo:'2026-10-Q1'}),entry('b','ingreso',4900,{sourceId:'salary',paymentKind:'source_period',periodo:'2026-10-Q1'}));
  close(Forecast.expectedIncomeForSource('salary',now),9900);close(Health.financialHealth(now).monthlyIncome,19800);
});

test('sin historial no se inventa ni ingreso ni carga de 200%',()=>{
  food();const h=Health.financialHealth(now),load=h.breakdown.find(b=>b.key==='commitments');
  assert.equal(load.value,null);assert.equal(load.score,null);assert.equal(h.projection.available,false);
  assert.equal(Forecast.cashFlowForecast({now}).totalExpectedIncome,0);
});

test('ingreso variable suficiente es una estimación optativa, separada de lo cobrado',()=>{
  for(let i=28;i>=1;i--){const d=new Date(now);d.setDate(d.getDate()-i);Data.getState().movimientos.push(entry(`gig-${i}`,'ingreso',700,{sourceId:'gig',fecha:d.toISOString()}));}
  const state=JSON.stringify(Data.getState()),a=Health.financialHealth(now),b=Health.financialHealth(now,{includeVariable:true});
  assert.equal(a.monthlyIncome,0);assert.ok(a.ingresoVariableEstimado>0);close(b.monthlyIncome,a.ingresoVariableEstimado);
  close(a.position.cash,b.position.cash);assert.equal(JSON.stringify(Data.getState()),state);
});

test('F: $2,600 pagados dejan $400 del período anterior + $3,000 próximos, no otra carga mensual',()=>{
  const item=food();Home.recordHouseholdExpense(item.id,2600,new Date('2026-09-30T19:19:00'));
  const pos=Life.financialPosition(now);close(pos.committed,3400);close(pos.cash,2223-2600);close(Home.householdSummary(now).mandatory,6000);
  const events=Home.householdUpcomingEvents({days:30,now}).filter(e=>e.refId===item.id);
  assert.deepEqual(events.map(e=>e.amount),[400,3000]);assert.equal(new Set(events.map(e=>e.householdPeriod)).size,2);
  Home.recordHouseholdExpense(item.id,null,now);close(Data.getState().movimientos.at(-1).monto,400);
});

test('las obligaciones completas vencidas se conservan todas, incluso fuera del antiguo lookback',()=>{
  const item=Home.createHouseholdExpense({name:'Servicio',amount:100,frequency:'monthly',kind:'obligation',nextDueDate:'2026-07-05'});
  const overdue=Home.householdUpcomingEvents({days:0,now}).filter(e=>e.refId===item.id);
  assert.equal(overdue.length,3);assert.ok(overdue.every(e=>e.overdue));
  Home.recordHouseholdExpense(item.id,100,now);assert.equal(Data.getState().movimientos.at(-1).householdPeriod,'M:2026-07');
});

test('G: programar/recargar no crea gastos y reintentar un abono con la misma operación es idempotente',()=>{
  const item=rent({operationId:'create-vehicle'});assert.equal(rent({operationId:'create-vehicle'}).id,item.id);assert.equal(Costs.operatingObligations().length,1);
  const first=Costs.operatingUpcomingEvents({days:30,now}),before=Data.getState().movimientos.length;
  assert.deepEqual(Costs.operatingUpcomingEvents({days:30,now}),first);assert.equal(Data.getState().movimientos.length,before);
  const opts={period:first[0].operatingPeriod,amount:100,date:now,operationId:'abono-one'};
  const payment=Costs.payOperatingObligation(item.id,opts);assert.equal(Costs.payOperatingObligation(item.id,opts).id,payment.id);
  assert.equal(Data.getState().movimientos.length,before+1);close(Costs.operatingUpcomingEvents({days:30,now})[0].amount,390);
});

test('H: cambiar $499 a $490 no modifica pagos anteriores ni el objetivo de un período ya abonado',()=>{
  const item=rent({amount:499}),period=Costs.operatingUpcomingEvents({days:30,now})[0].operatingPeriod;
  Costs.payOperatingObligation(item.id,{period,amount:100,date:now});const old=structuredClone(Data.getState().movimientos);
  item.amount=490;Data.saveData();
  const events=Costs.operatingUpcomingEvents({days:30,now});close(events[0].amount,399);close(events[1].amount,490);
  assert.deepEqual(Data.getState().movimientos,old);
});

test('un pago histórico completo de $499 permanece en $499 al configurar $490 para los próximos pagos',()=>{
  const item=rent({amount:499}),period=Costs.operatingUpcomingEvents({days:30,now})[0].operatingPeriod;
  Costs.payOperatingObligation(item.id,{period,amount:499,date:now});const old=structuredClone(Data.getState().movimientos);
  item.amount=490;Data.saveData();assert.deepEqual(Data.getState().movimientos,old);
  close(Data.getState().movimientos.at(-1).monto,499);close(Costs.operatingUpcomingEvents({days:30,now})[0].amount,490);
});

test('todos los saldos y gastos observados excluyen movimientos futuros conservando el historial',()=>{
  Data.getState().movimientos.push(entry('future','gasto',499,{sourceId:'gig',fecha:'2026-10-29T12:00:00'}));Data.sanearDatos();
  close(Data.getState().wallet.saldo,2223);close(Life.financialPosition(now).cash,2223);close(Accounts.personalCashTotal(now),2223);close(Data.saldoCuenta('acct-personal',now),2223);close(Forecast.cashFlowForecast({now}).startCash,2223);
  close(Base.sourceCostProfile('gig',now).actualCosts,0);close(Charts.metricasFuente(Data.getState(),'gig',{days:90,now}).costosOperativos,0);
  assert.ok(Data.getState().movimientos.some(m=>m.id==='future'));
});

test('un pago nuevo no admite fecha futura; pagar anticipadamente hoy sí cubre un vencimiento futuro',()=>{
  const item=rent({nextDueDate:'2026-10-08'}),period=Costs.operatingUpcomingEvents({days:30,now})[0].operatingPeriod;
  assert.throws(()=>Costs.payOperatingObligation(item.id,{period,amount:490,date:'2026-10-08T12:00:00'}),/PAGO_FECHA_FUTURA/);
  assert.equal(Data.getState().movimientos.length,1);
  Costs.payOperatingObligation(item.id,{period,amount:490,date:now});close(Life.financialPosition(now).cash,1733);
  assert.ok(!Costs.operatingUpcomingEvents({days:30,now}).some(e=>e.operatingPeriod===period));
});

test('un cobro ya recibido no se vuelve a sumar en el calendario ni en la proyección de esa quincena',()=>{
  Data.registrarPagoFuente('salary',9900,now);
  const income=Life.upcomingFinancialEvents({days:31,now}).filter(e=>e.sourceId==='salary'&&e.type==='income');
  assert.deepEqual(income.map(e=>Rules.localDay(e.dueDate)),['2026-10-31']);close(Forecast.cashFlowForecast({days:31,now}).totalExpectedIncome,9900);
});

test('un pago atrasado puede identificar su período cubierto sin cambiar la fecha real de cobro',()=>{
  Data.registrarPagoFuente('salary',9900,now,{periodDate:'2026-09-30T12:00:00'});
  assert.equal(Data.getState().movimientos.at(-1).periodo,'2026-09-Q2');assert.equal(Data.getState().movimientos.at(-1).fecha,now.toISOString());
  close(Forecast.cashFlowForecast({days:31,now}).totalExpectedIncome,19800);
});

test('deudas nunca proyectan más que su saldo y la última cuota semanal conserva su frecuencia',()=>{
  Data.getState().deudas.push({id:'d',desc:'Préstamo',montoTotal:1000,montoCuota:100,saldo:150,frecuencia:'Semanal',diaPago:4,creadaEn:new Date('2026-10-01T00:00:00').toISOString()});
  const rows=Life.upcomingFinancialEvents({days:40,now}).filter(e=>e.type==='debt');
  assert.deepEqual(rows.map(e=>e.amount),[100,50]);assert.deepEqual(rows.map(e=>Rules.localDay(e.dueDate)),['2026-10-01','2026-10-08']);
  close(rows.reduce((s,e)=>s+e.amount,0),150);
});

test('periodos civiles son estables a medianoche: deuda semanal y cobros diarios no usan el día UTC',()=>{
  const monday=new Date('2026-10-05T23:30:00'),morning=new Date('2026-10-05T00:01:00');
  assert.equal(Rules.debtPeriodId({frecuencia:'Semanal'},monday),'W:2026-10-05');
  assert.equal(Rules.sourcePeriodId('daily',monday),'2026-10-05');assert.equal(Rules.sourcePeriodId('weekly',monday),Rules.sourcePeriodId('weekly',morning));
});

test('periodos de deuda legacy con día UTC se adaptan sin reescribirlos',()=>{
  const monday=new Date('2026-10-05T23:30:00'),debt={id:'d',frecuencia:'Semanal'};
  const legacy={fecha:monday.toISOString(),debtPeriod:`W:${monday.toISOString().slice(0,10)}`},before=structuredClone(legacy);
  assert.equal(Rules.storedDebtPeriod(debt,legacy),'W:2026-10-05');assert.deepEqual(legacy,before);
});

test('un compromiso legado pagado tarde sólo liquida el período expresamente cubierto',()=>{
  const old=entry('payment','gasto',100,{commitmentId:'c',periodo:'2026-09-Q2',fecha:now.toISOString()});
  reset({movimientos:[old],financialPlan:{commitments:[{id:'c',name:'Servicio',amount:100,frequency:'biweekly',createdAt:'2026-09-30T09:00:00',active:true}],householdCanonicalMigrationVersion:0}});
  const item=Home.householdItems().find(i=>i.id==='home-commitment-c');
  const events=Home.householdUpcomingEvents({days:30,now}).filter(e=>e.refId===item.id);
  assert.deepEqual(events.map(e=>e.householdPeriod),['Q:2026-10:1']);
});

test('Hogar, trabajo, calendario y forecast comparten el mismo fin de ventana',()=>{
  const item=Home.createHouseholdExpense({name:'Servicio',amount:100,frequency:'monthly',kind:'obligation',nextDueDate:'2026-10-31'}),op=rent({nextDueDate:'2026-10-31'});
  assert.equal(Home.householdUpcomingEvents({days:30,now}).filter(e=>e.refId===item.id).length,0);
  assert.equal(Costs.operatingUpcomingEvents({days:30,now}).filter(e=>e.refId===op.id).length,0);
  close(Forecast.cashFlowForecast({days:30,now}).totalExpectedOutflow,0);
  close(Forecast.cashFlowForecast({days:31,now}).totalExpectedOutflow,590);
});

test('sync exige elección ante dos pagos completos concurrentes, pero conserva abonos legítimos',()=>{
  const item=rent(),base=structuredClone(Data.getState()),period=Costs.operatingUpcomingEvents({now})[0].operatingPeriod;
  const payment=(id,amount)=>entry(id,'gasto',amount,{operatingObligationId:item.id,operatingPeriod:period,operatingExpectedAmount:490});
  const local=structuredClone(base),remote=structuredClone(base);local.movimientos.push(payment('l',490));remote.movimientos.push(payment('r',490));
  const result=mergeStates(local,remote,base);assert.equal(result.conflicts.length,1);assert.equal(result.conflicts[0].kind,'financial_period');
  const path=result.conflicts[0].path;assert.equal(mergeStates(local,remote,base,{[path]:'remote'}).state.movimientos.filter(m=>m.operatingObligationId).length,1);
  assert.equal(mergeStates(local,remote,base,{[path]:'both'}).state.movimientos.filter(m=>m.operatingObligationId).length,2);
  local.movimientos.at(-1).monto=400;remote.movimientos.at(-1).monto=90;assert.equal(mergeStates(local,remote,base).conflicts.length,0);
});

test('concurrente: dos aportaciones distintas actualizan saldo reservado sin reutilizar sólo uno de los totales',()=>{
  const base={savingsGoals:[{id:'g',reserved:0,history:[]}],movimientos:[],deudas:[]},l=structuredClone(base),r=structuredClone(base);
  l.savingsGoals[0].reserved=100;l.savingsGoals[0].history.push({id:'l',type:'reserve',amount:100});
  r.savingsGoals[0].reserved=200;r.savingsGoals[0].history.push({id:'r',type:'reserve',amount:200});
  const merged=mergeStates(l,r,base);assert.deepEqual(merged.conflicts,[]);close(merged.state.savingsGoals[0].reserved,300);
});

test('concurrente: dos abonos distintos de deuda reducen el saldo por ambos importes',()=>{
  const base={deudas:[{id:'d',saldo:1000}],movimientos:[]},l=structuredClone(base),r=structuredClone(base);
  l.deudas[0].saldo=900;l.movimientos.push({id:'l',tipo:'gasto',debtId:'d',monto:100});
  r.deudas[0].saldo=800;r.movimientos.push({id:'r',tipo:'gasto',debtId:'d',monto:200});
  const merged=mergeStates(l,r,base);assert.deepEqual(merged.conflicts,[]);close(merged.state.deudas[0].saldo,700);
});

test('un respaldo moderno con fuentes vacías no recrea empleos legacy',()=>{
  reset({workSources:[]});Data.loadData();assert.deepEqual(Data.getState().workSources,[]);
});

test('JSON local inválido bloquea escrituras y una restauración explícita guarda los bytes dañados',()=>{
  const good=JSON.stringify(Data.getState()),bad='{datos incompletos';localStorage.setItem(STORAGE_KEY,bad);
  assert.throws(()=>Data.loadData(),/STORAGE_DATA_INVALIDA/);assert.equal(localStorage.getItem(STORAGE_KEY),bad);
  assert.throws(()=>Data.saveData(),/STORAGE_DATA_INVALIDA/);assert.equal(localStorage.getItem(STORAGE_KEY),bad);
  Data.restaurar(good);assert.ok([...localStorage.data.entries()].some(([k,v])=>k.startsWith(`${STORAGE_KEY}_unreadable_`)&&v===bad));
  assert.equal(Data.getState().movimientos.length,1);
});

test('migrar un compromiso pagado conserva su frecuencia y reconoce el pago sin tocar el movimiento',()=>{
  const old=entry('old-payment','gasto',1200,{commitmentId:'insurance',periodo:'2026-10',fecha:now.toISOString()});
  reset({movimientos:[old],financialPlan:{commitments:[{id:'insurance',name:'Seguro',amount:1200,frequency:'yearly',dueDay:1,createdAt:now.toISOString(),lastPaidPeriod:'2026-10',active:true}],householdCanonicalMigrationVersion:0}});
  const before=structuredClone(Data.getState().movimientos);Life.ensureFinancialLife();Life.ensureFinancialLife();
  const item=Home.householdItems().find(i=>i.id==='home-commitment-insurance');assert.equal(item.frequency,'yearly');
  assert.deepEqual(Data.getState().movimientos,before);assert.equal(Home.householdUpcomingEvents({days:30,now}).filter(e=>e.refId===item.id).length,0);
});

test('una reserva legacy identificable no descuenta patrimonio por segunda vez',()=>{
  reset({savingsGoals:undefined,gastosFijosMensuales:[{id:'g',desc:'Meta antigua',monto:1000,categoria:'Ahorro',frecuencia:'Unico'}],wallet:{saldo:0,sobres:[{id:'envelope',refId:'g',acumulado:100,categoria:'Ahorro'}]},movimientos:[entry('open','ingreso',1000,{categoria:'Sistema'}),entry('legacy-reserve','gasto',100,{desc:'Abono: Meta antigua',categoria:'Ahorro'})]});
  const raw=structuredClone(Data.getState().movimientos);Goals.ensureSavingsGoals();Data.sanearDatos();
  close(Life.financialPosition(now).cash,1000);close(Life.financialPosition(now).reserved,100);
  assert.deepEqual(Data.getState().movimientos,raw);assert.equal(Data.getState().gastosFijosMensuales.length,1);
});

test('actividad descuenta renta y combustible reales una vez y excluye fondos de terceros',()=>{
  Data.getState().movimientos.push(entry('income','ingreso',1000,{sourceId:'gig'}),entry('rent','gasto',490,{sourceId:'gig',tags:['operational']}),entry('fuel','gasto',100,{sourceId:'gig',desc:'⛽ Combustible'}),entry('company','gasto',400,{sourceId:'gig',affectsPersonal:false}));
  Data.getState().cargasCombustible.push({id:'fill',sourceId:'gig',pagador:'personal',costo:100,fecha:now.toISOString()});
  const stats=Charts.metricasFuente(Data.getState(),'gig',{days:30,now}),profile=Life.sourceCostProfile('gig',now);
  close(stats.neto,410);close(profile.net,410);close(stats.combustible,100);close(profile.actualCosts,590);
});

test('transporte pagado hoy se consume del presupuesto de transporte sin restarlo dos veces del neto',()=>{
  Base.updateSourceLife('salary',{transportMode:'public',outboundRides:1,returnRides:1,fare:10,daysPerWeek:5});
  const before=Life.financialPosition(now);Data.getState().movimientos.push(entry('bus','gasto',20,{sourceId:'salary',categoria:'Transporte'}));Data.sanearDatos();
  const after=Life.financialPosition(now);close(after.cash,before.cash-20);close(after.workTransport,before.workTransport-20);
  close(Life.sourceCostProfile('salary',now).estimatedNet,-20);
});

test('fondos de empresa legacy funcionan en ambos lectores y nunca incrementan efectivo personal',()=>{
  Data.getState().accounts.push({id:'acct-ticketcar',name:'Empresa',ownership:'third_party',active:true});
  Data.getState().fondosCombustibleEmpresa.push({id:'deposit',monto:500,fecha:now.toISOString()});
  Data.getState().cargasCombustible.push({id:'fuel',pagador:'empresa',costo:100,fecha:now.toISOString()});
  close(Data.saldoCuenta('acct-ticketcar',now),400);close(Accounts.accountBalance('acct-ticketcar',now),400);close(Accounts.personalCashTotal(now),2223);
});

test('reglas automáticas usan identidad estable entre dispositivos y no duplican aportes',()=>{
  const goal=Goals.createSavingsGoal({name:'Meta',targetAmount:10000,targetDate:'2027-03-01'});Automation.createReserveRule({goalId:goal.id,percent:10});
  Data.getState().movimientos.push(entry('new-income','ingreso',1000));const base=structuredClone(Data.getState());
  Automation.runAutomationEngine();const local=structuredClone(Data.getState());Data.restaurar(JSON.stringify(base));Automation.runAutomationEngine();const remote=structuredClone(Data.getState());
  const merged=mergeStates(local,remote,base);assert.deepEqual(merged.conflicts,[]);close(merged.state.savingsGoals[0].reserved,100);
  assert.equal(merged.state.savingsGoals[0].history.length,1);assert.equal(merged.state.ruleApplications.filter(a=>a.status==='applied').length,1);
});

test('varias metas comparten el efectivo libre; las sugerencias no reutilizan el mismo dinero',()=>{
  Goals.createSavingsGoal({name:'Uno',targetAmount:10000,priority:'high'});Goals.createSavingsGoal({name:'Dos',targetAmount:10000});
  const plans=Health.goalPortfolioPlan(now);close(plans.reduce((s,p)=>s+p.suggestedNow,0),2223);
  assert.equal(plans[1].suggestedNow,0);
});

test('reservas futuras usan la misma fecha de corte en Panel, Wallet, metas y planificación',()=>{
  const goal={id:'future-goal',name:'Meta',targetAmount:1000,reserved:500,targetDate:'2026-10-20T23:59:59',active:true,createdAt:now.toISOString(),history:[{id:'paid-reserve',type:'reserve',amount:200,fecha:now.toISOString()},{id:'future-reserve',type:'reserve',amount:300,fecha:new Date('2026-10-15T12:00:00').toISOString()}]};
  Data.getState().savingsGoals.push(goal);
  close(Life.financialPosition(now).reserved,200);close(Charts.resumenGlobal(Data.getState(),now).ahorro,200);
  close(Goals.totalReservedSavings(now),200);close(Goals.savingsGoalSummary(goal.id,now).remaining,800);
  close(Base.financialPosition(now).reserved,200);close(Life.upcomingFinancialEvents({days:30,now}).find(e=>e.refId===goal.id).amount,800);
  close(Goals.savingsCapacity(goal.id,now).safeFreeCash,2023);
  assert.equal(Data.getState().savingsGoals[0].reserved,500);
});

test('un gasto futuro importado no consume la reserva doméstica de hoy',()=>{
  const item=Home.createHouseholdExpense({name:'Necesidad próxima',amount:500,kind:'reserve',nextDueDate:'2026-10-15'});
  Data.getState().movimientos.push(entry('future-reserve-expense','gasto',500,{householdExpenseId:item.id,fecha:new Date('2026-10-15T12:00:00').toISOString()}));
  close(Home.householdExplicitReserveStatus(now).find(x=>x.item.id===item.id).remaining,500);
  close(Home.householdSummary(now).explicitReserve,500);
  close(Life.financialPosition(now).homeReserve,500);
});
