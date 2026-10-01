/* v2.7.1 - Situación financiera, ciclo de vida laboral, transporte y calendario base. */
import { safeFloat, uuid, TRANSPORT_MODES } from './01_consts_utils.js';
import { getState, saveData } from './02_data.js';
import { occurrenceDates, occurrenceKey } from './20_home_engine.js';
import { personalCash, goalReserved, reservedSavings, normalizeFrequency, horizonEnd, inObservedPeriod, isPersonalMovement, actualPaymentDate, debtPeriodId, sourcePeriodId, localDay, sourceObservedTotals, debtOutstanding, storedDebtPeriod } from './domain/financial-rules.js';

const PERSONAL_ACCOUNT_ID='acct-personal';
const DEFAULT_PLAN=Object.freeze({livingBudgets:{groceries:0,health:0,leisure:0,other:0},commitments:[]});
const clone=v=>JSON.parse(JSON.stringify(v));
const monthId=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
const positive=(v,code='MONTO_INVALIDO')=>{const n=safeFloat(v);if(!(n>0))throw new Error(code);return n;};
const text=(v,code='NOMBRE_INVALIDO')=>{const s=String(v??'').trim();if(!s)throw new Error(code);return s;};
const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
const lastDay=(year,month)=>new Date(year,month+1,0).getDate();

function normalizeCommitment(c){return {...c,id:c?.id||uuid(),name:String(c?.name||c?.desc||'Compromiso').trim()||'Compromiso',amount:Math.max(0,safeFloat(c?.amount??c?.monto)),frequency:c?.frequency||c?.frecuencia||'monthly',dueDay:c?.dueDay??c?.diaPago??1,category:c?.category||c?.categoria||'Vida',active:c?.active!==false,createdAt:c?.createdAt||new Date().toISOString(),lastPaidPeriod:c?.lastPaidPeriod||null};}

function normalizeTransport(source,state){
  const fallback=source?.transportMode||state.profile?.transportMode||'none',mode=TRANSPORT_MODES[source?.transport?.mode]?source.transport.mode:(TRANSPORT_MODES[fallback]?fallback:'none'),pub=source?.transport?.public||source?.publicTransport||{};
  return {mode,public:{outboundRides:Math.max(0,Math.round(safeFloat(pub.outboundRides??pub.ridesOut))),returnRides:Math.max(0,Math.round(safeFloat(pub.returnRides??pub.ridesBack))),fare:Math.max(0,safeFloat(pub.fare)),daysPerWeek:clamp(safeFloat(pub.daysPerWeek??5),0,7)}};
}

export function ensureFinancialLife(){
  const state=getState();let changed=false;if(!state.financialPlan||typeof state.financialPlan!=='object'){state.financialPlan=clone(DEFAULT_PLAN);changed=true;}
  state.financialPlan.livingBudgets={...DEFAULT_PLAN.livingBudgets,...(state.financialPlan.livingBudgets||{})};state.financialPlan.commitments=Array.isArray(state.financialPlan.commitments)?state.financialPlan.commitments.map(normalizeCommitment):[];
  for(const source of state.workSources||[]){
    const nextStatus=source.status||((source.active===false)?(source.endedAt?'ended':'paused'):'active'),shouldActive=nextStatus==='active';
    if(source.status!==nextStatus){source.status=nextStatus;changed=true;}if(source.active!==shouldActive){source.active=shouldActive;changed=true;}
    const transport=normalizeTransport(source,state);if(JSON.stringify(source.transport||null)!==JSON.stringify(transport)){source.transport=transport;changed=true;}
    if(!source.startedAt){source.startedAt=source.createdAt||null;}
  }
  if(changed)saveData();return state.financialPlan;
}

export function setSourceStatus(sourceId,status){ensureFinancialLife();const state=getState(),source=state.workSources.find(s=>s.id===sourceId);if(!source)throw new Error('FUENTE_NO_ENCONTRADA');if(!['active','paused','ended'].includes(status))throw new Error('ESTADO_FUENTE_INVALIDO');source.status=status;source.active=status==='active';if(status==='ended')source.endedAt=new Date().toISOString();else if(status==='paused')source.pausedAt=new Date().toISOString();else{source.endedAt=null;source.pausedAt=null;source.reactivatedAt=new Date().toISOString();}saveData();return source;}

export function updateSourceLife(sourceId,{status,transportMode,outboundRides,returnRides,fare,daysPerWeek}={}){
  ensureFinancialLife();const state=getState(),source=state.workSources.find(s=>s.id===sourceId);if(!source)throw new Error('FUENTE_NO_ENCONTRADA');if(status)setSourceStatus(sourceId,status);
  const mode=TRANSPORT_MODES[transportMode]?transportMode:(source.transport?.mode||state.profile.transportMode||'none');source.transport=normalizeTransport({...source,transport:{mode,public:{...(source.transport?.public||{}),...(outboundRides!==undefined?{outboundRides}:{}),...(returnRides!==undefined?{returnRides}:{}),...(fare!==undefined?{fare}:{}),...(daysPerWeek!==undefined?{daysPerWeek}:{})}}},state);source.transportMode=mode;saveData();return source;
}

export function publicTransportDailyCost(source){const state=getState(),t=normalizeTransport(source,state);if(t.mode!=='public')return 0;return(t.public.outboundRides+t.public.returnRides)*t.public.fare;}
export function publicTransportMonthlyCost(source){const state=getState(),t=normalizeTransport(source,state);if(t.mode!=='public')return 0;return publicTransportDailyCost(source)*t.public.daysPerWeek*(52/12);}

export function setLivingBudgets(values={}){const plan=ensureFinancialLife();for(const key of Object.keys(DEFAULT_PLAN.livingBudgets))if(values[key]!==undefined)plan.livingBudgets[key]=Math.max(0,safeFloat(values[key]));saveData();return plan.livingBudgets;}
export function upsertCoreCommitment(id,{name,amount,dueDay,category='Vida'}={}){const plan=ensureFinancialLife();let c=plan.commitments.find(x=>x.id===id);const m=Math.max(0,safeFloat(amount));if(!(m>0)){if(c)c.active=false;saveData();return c||null;}if(!c){c=normalizeCommitment({id,name,amount:m,frequency:'monthly',dueDay,category});plan.commitments.push(c);}c.name=text(name);c.amount=m;c.frequency='monthly';c.dueDay=clamp(Math.round(safeFloat(dueDay||1)),1,31);c.category=category;c.active=true;saveData();return c;}
export function configureLivingSetup({housing,housingDay=1,services,servicesDay=10,groceries,health,leisure,other}={}){setLivingBudgets({groceries,health,leisure,other});upsertCoreCommitment('life-housing',{name:'Vivienda',amount:housing,dueDay:housingDay,category:'Vivienda'});upsertCoreCommitment('life-services',{name:'Servicios del hogar',amount:services,dueDay:servicesDay,category:'Servicios'});return ensureFinancialLife();}
export function createCommitment({name,amount,frequency='monthly',dueDay=1,category='Vida'}={}){const plan=ensureFinancialLife(),c=normalizeCommitment({name:text(name),amount:positive(amount),frequency,dueDay,category});plan.commitments.push(c);saveData();return c;}
export function setCommitmentActive(id,active){const c=ensureFinancialLife().commitments.find(x=>x.id===id);if(!c)throw new Error('COMPROMISO_NO_ENCONTRADO');c.active=Boolean(active);saveData();return c;}

export function payCommitment(id,fecha=Date.now()){const state=getState(),c=ensureFinancialLife().commitments.find(x=>x.id===id&&x.active!==false);if(!c)throw new Error('COMPROMISO_NO_ENCONTRADO');const amount=positive(c.amount),d=actualPaymentDate(fecha),period=normalizeFrequency(c.frequency)==='monthly'?monthId(d):occurrenceKey({...c,frequency:normalizeFrequency(c.frequency)},d);if(c.lastPaidPeriod===period)throw new Error('COMPROMISO_YA_PAGADO');state.movimientos.push({id:uuid(),fecha:d.toISOString(),tipo:'gasto',desc:c.name,monto:amount,categoria:c.category||'Vida',accountId:PERSONAL_ACCOUNT_ID,affectsPersonal:true,commitmentId:c.id,periodo:period});c.lastPaidPeriod=period;saveData();return c;}

function pushMonthly(events,base,now,end){const {id,title,amount,type,category,dueDay,sourceId}=base;for(let offset=0;offset<=(end.getFullYear()-now.getFullYear())*12+end.getMonth()-now.getMonth();offset++){const y=now.getFullYear(),m=now.getMonth()+offset,yy=y+Math.floor(m/12),mm=((m%12)+12)%12,day=dueDay==='fin_mes'?lastDay(yy,mm):clamp(Math.round(safeFloat(dueDay||1)),1,lastDay(yy,mm)),d=new Date(yy,mm,day,9,0,0);if(d>=now&&d<=end)events.push({id:`${id}-${d.toISOString().slice(0,10)}`,refId:base.refId||id,date:d.toISOString(),dueDate:d.toISOString(),title,amount,type,category,sourceId:sourceId||null});}}
function pushBiweekly(events,base,now,end){for(let offset=0;offset<=(end.getFullYear()-now.getFullYear())*12+end.getMonth()-now.getMonth();offset++){const raw=now.getMonth()+offset,y=now.getFullYear()+Math.floor(raw/12),m=((raw%12)+12)%12;for(const day of[15,lastDay(y,m)]){const d=new Date(y,m,day,9,0,0);if(d>=now&&d<=end)events.push({...base,id:`${base.id}-${d.toISOString().slice(0,10)}`,date:d.toISOString(),dueDate:d.toISOString()});}}}
function pushWeekly(events,base,weekDay,now,end){const target=Number(weekDay),normalized=Number.isFinite(target)?target:5,start=new Date(now);start.setHours(9,0,0,0);const diff=(normalized-start.getDay()+7)%7;start.setDate(start.getDate()+diff);for(let d=new Date(start);d<=end;d.setDate(d.getDate()+7))events.push({...base,id:`${base.id}-${d.toISOString().slice(0,10)}`,date:d.toISOString(),dueDate:d.toISOString()});}
function recurrence(events,base,frequency,dueDay,now,end){
  const f=normalizeFrequency(frequency);
  if(f==='monthly')return pushMonthly(events,{...base,dueDay},now,end);
  if(f==='biweekly')return pushBiweekly(events,base,now,end);
  if(f==='weekly')return pushWeekly(events,base,dueDay,now,end);
  if(f==='daily'){for(let d=new Date(now);d<=end;d.setDate(d.getDate()+1)){const due=new Date(d);due.setHours(9,0,0,0);events.push({...base,id:`${base.id}-${localDay(due)}`,date:due.toISOString(),dueDate:due.toISOString()});}return;}
  const anchor=new Date(base.anchor||now),item={id:base.refId||base.id,frequency:f,dueDay:dueDay==='fin_mes'?31:Number(dueDay)||anchor.getDate(),createdAt:anchor.toISOString(),nextDueDate:localDay(anchor)};
  for(const d of occurrenceDates(item,now,end))events.push({...base,id:`${base.id}-${localDay(d)}`,date:d.toISOString(),dueDate:d.toISOString()});
}

function monthlyDueDate(dueDay,now){const d=dueDay==='fin_mes'?lastDay(now.getFullYear(),now.getMonth()):clamp(Math.round(safeFloat(dueDay||1)),1,lastDay(now.getFullYear(),now.getMonth()));return new Date(now.getFullYear(),now.getMonth(),d,9,0,0);}
function addMonthlyOverdue(events,base,dueDay,start,isPaid){const due=monthlyDueDate(dueDay,start);if(due>=start||isPaid)return;const shown=new Date(start);shown.setHours(9,0,0,0);events.push({...base,id:`${base.id}-overdue-${due.toISOString().slice(0,10)}`,date:shown.toISOString(),dueDate:due.toISOString(),overdue:true});}

function pushSingleDebt(events,base,debt,now,end){const createdRaw=debt.creadaEn||debt.createdAt||now;let created=new Date(createdRaw);if(Number.isNaN(created.getTime()))created=new Date(now);let due=debt.dueDate?new Date(/^\d{4}-\d{2}-\d{2}$/.test(debt.dueDate)?`${debt.dueDate}T09:00:00`:debt.dueDate):null;if(!due||Number.isNaN(due.getTime())){const target=clamp(Math.round(safeFloat(debt.diaPago||created.getDate())),1,31);let y=created.getFullYear(),m=created.getMonth();due=new Date(y,m,Math.min(target,lastDay(y,m)),9,0,0);if(due<created){m+=1;y+=Math.floor(m/12);m=((m%12)+12)%12;due=new Date(y,m,Math.min(target,lastDay(y,m)),9,0,0);}}if(due>end)return;const overdue=due<now,shown=overdue?new Date(now):new Date(due);shown.setHours(9,0,0,0);events.push({...base,id:`${base.id}-${due.toISOString().slice(0,10)}`,date:shown.toISOString(),dueDate:due.toISOString(),overdue});}
const debtPeriodPaid=(state,debt,date,now)=>{const period=debtPeriodId(debt,date);return(state.movimientos||[]).some(m=>m.debtId===debt.id&&inObservedPeriod(m.fecha,0,now)&&storedDebtPeriod(debt,m)===period);};

export function upcomingFinancialEvents({days=45,now=new Date()}={}){
  ensureFinancialLife();const state=getState(),start=new Date(now);start.setHours(0,0,0,0);const end=horizonEnd(now,days),events=[];
  for(const c of state.financialPlan.commitments.filter(x=>x.active!==false)){
    const base={id:`commitment-${c.id}`,refId:c.id,title:c.name,amount:safeFloat(c.amount),type:'expense',category:c.category||'Vida'};recurrence(events,base,c.frequency,c.dueDay,start,end);
    if(['monthly','mensual'].includes(String(c.frequency).toLowerCase()))addMonthlyOverdue(events,base,c.dueDay,start,c.lastPaidPeriod===monthId(start));
  }
  for(const d of state.deudas||[]){
    const saldo=debtOutstanding(state,d,now);if(!(saldo>0))continue;const cuota=Math.min(safeFloat(d.montoCuota),saldo),total=safeFloat(d.montoTotal),frequency=String(d.frecuencia||'').toLowerCase(),base={id:`debt-${d.id}`,refId:d.id,title:`Deuda · ${d.desc}`,amount:cuota,type:'debt',category:'Deuda'},single=['unico','único','single','one_time'].includes(frequency)||(total>0&&safeFloat(d.montoCuota)>=total-0.005);
    const tmp=[];
    if(single)pushSingleDebt(tmp,base,d,start,end);else{
      const created=new Date(d.creadaEn||d.createdAt||start),from=Number.isFinite(created.getTime())&&created<start?new Date(created.getFullYear(),created.getMonth(),created.getDate()):start;
      recurrence(tmp,{...base,anchor:created},d.frecuencia,d.diaPago,from,end);
    }
    let remaining=saldo;
    for(const event of tmp.sort((a,b)=>new Date(a.dueDate)-new Date(b.dueDate))){
      const due=new Date(event.dueDate||event.date);if(debtPeriodPaid(state,d,due,now)||remaining<=0.005)continue;
      if(d.creadaEn&&due<new Date(d.creadaEn))continue;
      const amount=Math.min(cuota,remaining),overdue=due<start,shown=overdue?new Date(start):due;shown.setHours(9,0,0,0);
      events.push({...event,amount,date:shown.toISOString(),overdue,debtPeriod:debtPeriodId(d,due)});remaining-=amount;
    }
  }
  for(const g of state.gastosFijosMensuales||[]){if(['Ahorro','Meta'].includes(g.categoria))continue;recurrence(events,{id:`fixed-${g.id}`,refId:g.id,title:g.desc,amount:safeFloat(g.monto),type:'expense',category:g.categoria||'Gasto'},g.frecuencia,g.diaPago||1,start,end);}
  for(const source of state.workSources||[]){
    if(source.active===false||source.status==='ended'||source.status==='paused')continue;
    const base={id:`income-${source.id}`,refId:source.id,title:`Ingreso esperado · ${source.name}`,amount:null,type:'income',category:'Trabajo',sourceId:source.id},tmp=[];
    if(['daily','weekly','biweekly','monthly'].includes(source.compensation))recurrence(tmp,base,source.compensation,source.compensation==='weekly'?(source.paySchedule?.weekDay??5):(source.paySchedule?.day||30),start,end);
    for(const event of tmp){
      const period=sourcePeriodId(source.compensation,event.dueDate);
      const paid=(state.movimientos||[]).some(m=>m.tipo==='ingreso'&&m.sourceId===source.id&&m.paymentKind==='source_period'&&inObservedPeriod(m.fecha,0,now)&&(m.periodo||sourcePeriodId(source.compensation,m.fecha))===period);
      if(!paid)events.push({...event,sourcePeriod:period});
    }
  }
  for(const goal of state.savingsGoals||[]){const reserved=goalReserved(goal,now);if(goal.active===false||!goal.targetDate||reserved>=safeFloat(goal.targetAmount))continue;const d=new Date(goal.targetDate);if(d>=start&&d<=end)events.push({id:`goal-${goal.id}`,refId:goal.id,date:d.toISOString(),title:`Meta · ${goal.name}`,amount:Math.max(0,safeFloat(goal.targetAmount)-reserved),type:'goal',category:'Meta'});}
  const unique=new Map();for(const e of events)unique.set(`${e.id}|${e.date}`,e);return[...unique.values()].sort((a,b)=>new Date(a.date)-new Date(b.date));
}

const categoryMatch=(key,m)=>{const c=`${m.categoria||''} ${m.desc||''}`.toLowerCase();if(key==='groceries')return/comida|despensa|super|mercado|alimento/.test(c);if(key==='health')return/salud|farmacia|medic|doctor/.test(c);if(key==='leisure')return/ocio|entreten|cine|salida|diversi/.test(c);if(key==='other')return/otro|personal/.test(c);return false;};
export function livingBudgetStatus(now=new Date()){const plan=ensureFinancialLife(),state=getState(),start=new Date(now.getFullYear(),now.getMonth(),1),rows=[];for(const[key,budgetRaw]of Object.entries(plan.livingBudgets)){const budget=Math.max(0,safeFloat(budgetRaw));if(!(budget>0))continue;const spent=(state.movimientos||[]).filter(m=>m.tipo==='gasto'&&m.affectsPersonal!==false&&inObservedPeriod(m.fecha,start,now)&&categoryMatch(key,m)).reduce((a,m)=>a+safeFloat(m.monto),0);rows.push({key,budget,spent,remaining:Math.max(0,budget-spent)});}return rows;}
export function workTransportCommitment(now=new Date()){
  const state=getState(),daysInMonth=lastDay(now.getFullYear(),now.getMonth()),remainingDays=Math.max(0,daysInMonth-now.getDate()+1),fraction=remainingDays/daysInMonth,today=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  return(state.workSources||[]).filter(s=>s.active!==false&&s.status!=='ended'&&s.status!=='paused').reduce((sum,s)=>{
    if(s.transport?.mode!=='public')return sum;
    const spentToday=(state.movimientos||[]).filter(m=>m.tipo==='gasto'&&m.sourceId===s.id&&isPersonalMovement(state,m)&&!m.operatingObligationId&&!m.householdExpenseId&&m.categoria==='Transporte'&&inObservedPeriod(m.fecha,today,now)).reduce((a,m)=>a+safeFloat(m.monto),0);
    return sum+Math.max(0,publicTransportMonthlyCost(s)*fraction-Math.min(spentToday,publicTransportDailyCost(s)));
  },0);
}
export function financialPosition(now=new Date()){const state=getState();ensureFinancialLife();const cash=personalCash(state,now),reserved=reservedSavings(state,now);const due=upcomingFinancialEvents({days:30,now}).filter(e=>['expense','debt'].includes(e.type)&&safeFloat(e.amount)>0).reduce((a,e)=>a+safeFloat(e.amount),0),living=livingBudgetStatus(now).reduce((a,x)=>a+x.remaining,0),workTransport=workTransportCommitment(now),committed=due+living+workTransport;return{cash,reserved,committed,free:cash-reserved-committed,due,living,workTransport};}
export function sourceCostProfile(sourceId,now=new Date()){
  ensureFinancialLife();const state=getState(),source=state.workSources.find(s=>s.id===sourceId);if(!source)return null;
  const start=new Date(now.getFullYear(),now.getMonth(),1),totals=sourceObservedTotals(state,sourceId,start,now),publicTransport=publicTransportMonthlyCost(source);
  return {source,income:totals.income,actualCosts:totals.costs,publicTransport,net:totals.net,estimatedNet:totals.net,basis:'actual_month_to_date'};
}
