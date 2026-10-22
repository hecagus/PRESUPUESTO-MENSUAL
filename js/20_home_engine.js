/* v3.1.0 - Motor de hogar: obligaciones, presupuestos, vencidos, reservas y pagos idempotentes. Cero DOM. */
import { safeFloat, uuid } from './01_consts_utils.js';
import { getState, saveData } from './02_data.js';
import { monthlyAmount, normalizeFrequency, horizonEnd, inObservedPeriod, localDay, actualPaymentDate } from './domain/financial-rules.js';

const PERSONAL_ACCOUNT_ID='acct-personal';
const DAY=86400000;
const HOME_MODEL_VERSION=2;

export const HOME_PRIORITIES=Object.freeze({
  obligatory:{label:'Obligatorio',icon:'🔴'},
  budgeted:{label:'Presupuestado',icon:'🟡'},
  discretionary:{label:'Discrecional',icon:'🔵'}
});
export const HOME_FREQUENCIES=Object.freeze({
  daily:'Diario',weekly:'Semanal',biweekly:'Quincenal',monthly:'Mensual',bimonthly:'Bimestral',quarterly:'Trimestral',yearly:'Anual',variable:'Variable / sin fecha',one_time:'Ocasional / una sola vez'
});
export const HOME_CATEGORIES=Object.freeze([
  'Vivienda','Servicios','Alimentación','Suscripciones','Higiene y belleza','Ropa','Compras','Salud','Educación','Mascotas','Transporte personal','Ocio','Otros'
]);

const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
const text=v=>{const s=String(v??'').trim();if(!s)throw new Error('NOMBRE_INVALIDO');return s;};
const positive=v=>{const n=safeFloat(v);if(!(n>0))throw new Error('MONTO_INVALIDO');return n;};
const monthKey=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
const isoDay=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const lastDay=(y,m)=>new Date(y,m+1,0).getDate();
const normalizedFrequency=f=>HOME_FREQUENCIES[normalizeFrequency(f)]?normalizeFrequency(f):'monthly';
const normalizedPriority=p=>HOME_PRIORITIES[p]?p:'budgeted';
const startOfDay=value=>{const d=new Date(value);d.setHours(0,0,0,0);return d;};
const validDate=value=>{
  if(!value)return null;
  const raw=String(value).slice(0,10),d=new Date(`${raw}T09:00:00`);
  return Number.isNaN(d.getTime())||localDay(d)!==raw?null:d;
};
const normalizedDate=value=>validDate(value)?String(value).slice(0,10):null;
const assertOptionalDate=value=>{if(value&&String(value).trim()&&!validDate(value))throw new Error('FECHA_HOGAR_INVALIDA');return normalizedDate(value);};

function normalizeItem(raw={}){
  const frequency=normalizedFrequency(raw.frequency||raw.frecuencia);
  const priority=normalizedPriority(raw.priority||raw.level);
  const createdAt=raw.createdAt||new Date().toISOString();
  return {
    ...raw,
    id:raw.id||uuid(),name:String(raw.name||raw.desc||'Gasto del hogar').trim()||'Gasto del hogar',
    category:HOME_CATEGORIES.includes(raw.category)?raw.category:(raw.category||'Otros'),
    amount:Math.max(0,safeFloat(raw.amount??raw.monto)),frequency,priority,
    dueDay:clamp(Math.round(safeFloat(raw.dueDay??raw.diaPago??1)),1,31),
    nextDueDate:normalizedDate(raw.nextDueDate||raw.dueDate),active:raw.active!==false,createdAt,
    notes:String(raw.notes||'').trim(),
    ...(raw.initialBudget && /^\d{4}-\d{2}$/.test(raw.initialBudget.month) ? {initialBudget:{month:raw.initialBudget.month,amount:Math.max(0,safeFloat(raw.initialBudget.amount)),startDate:normalizedDate(raw.initialBudget.startDate),endDate:normalizedDate(raw.initialBudget.endDate)}} : {})
  };
}

function addMigrated(plan,item){
  if(!(safeFloat(item.amount)>0)||plan.householdExpenses.some(x=>x.id===item.id))return;
  plan.householdExpenses.push(normalizeItem(item));
}

export function ensureHousehold(){
  const state=getState();state.financialPlan=state.financialPlan&&typeof state.financialPlan==='object'?state.financialPlan:{};
  const plan=state.financialPlan;let changed=false;
  if(!Array.isArray(plan.householdExpenses)){plan.householdExpenses=[];changed=true;}
  plan.householdExpenses=plan.householdExpenses.map(normalizeItem);
  if(Number(plan.householdModelVersion||0)<1){
    const commitments=Array.isArray(plan.commitments)?plan.commitments:[];
    const housing=commitments.find(c=>c.id==='life-housing'),services=commitments.find(c=>c.id==='life-services');
    if(housing&&housing.active!==false&&safeFloat(housing.amount)>0)addMigrated(plan,{id:'home-housing',name:housing.name||'Renta / vivienda',category:'Vivienda',amount:housing.amount,frequency:'monthly',priority:'obligatory',dueDay:housing.dueDay||1,createdAt:housing.createdAt});
    if(services&&services.active!==false&&safeFloat(services.amount)>0)addMigrated(plan,{id:'home-services',name:services.name||'Servicios del hogar',category:'Servicios',amount:services.amount,frequency:'monthly',priority:'obligatory',dueDay:services.dueDay||10,createdAt:services.createdAt});
    if(housing)housing.active=false;if(services)services.active=false;
    const living=plan.livingBudgets||{};
    const seeds=[['groceries','home-groceries','Despensa / comida','Alimentación'],['health','home-health','Salud','Salud'],['leisure','home-leisure','Ocio / salidas','Ocio'],['other','home-other','Otros gastos personales','Otros']];
    for(const [key,id,name,category] of seeds){if(safeFloat(living[key])>0)addMigrated(plan,{id,name,category,amount:living[key],frequency:'monthly',priority:'budgeted'});if(living[key]!==undefined)living[key]=0;}
    plan.livingBudgets=living;plan.householdModelVersion=1;changed=true;
  }
  if(Number(plan.householdModelVersion||0)<HOME_MODEL_VERSION){
    /* v2 sólo corrige invariantes; no duplica ni recategoriza datos del usuario. */
    plan.householdModelVersion=HOME_MODEL_VERSION;changed=true;
  }
  if(changed)saveData();return plan.householdExpenses;
}

export function householdItems({activeOnly=false}={}){const items=ensureHousehold();return activeOnly?items.filter(x=>x.active!==false):items;}
export function householdById(id){return ensureHousehold().find(x=>x.id===id)||null;}

export function createHouseholdExpense(config={}){
  const list=ensureHousehold(),nextDueDate=assertOptionalDate(config.nextDueDate),item=normalizeItem({...config,nextDueDate,name:text(config.name),amount:positive(config.amount)});list.push(item);saveData();return item;
}
export function updateHouseholdExpense(id,patch={}){
  const item=householdById(id);if(!item)throw new Error('GASTO_HOGAR_NO_ENCONTRADO');
  if(patch.name!==undefined)item.name=text(patch.name);
  if(patch.amount!==undefined)item.amount=positive(patch.amount);
  if(patch.category!==undefined)item.category=HOME_CATEGORIES.includes(patch.category)?patch.category:'Otros';
  if(patch.frequency!==undefined)item.frequency=normalizedFrequency(patch.frequency);
  if(patch.priority!==undefined)item.priority=normalizedPriority(patch.priority);
  if(patch.dueDay!==undefined)item.dueDay=clamp(Math.round(safeFloat(patch.dueDay||1)),1,31);
  if(patch.nextDueDate!==undefined)item.nextDueDate=assertOptionalDate(patch.nextDueDate);
  if(patch.notes!==undefined)item.notes=String(patch.notes||'').trim();
  if(patch.initialBudget!==undefined)item.initialBudget=patch.initialBudget;
  if(patch.active!==undefined)item.active=Boolean(patch.active);
  saveData();return item;
}
export function setHouseholdExpenseActive(id,active){return updateHouseholdExpense(id,{active});}

function monthlyEquivalent(item,now=new Date()){
  return monthlyAmount(item.amount,item.frequency,now);
}
export function householdMonthlyEquivalent(item,now=new Date()){return monthlyEquivalent(normalizeItem(item),now);}

// Shared scheduling helpers: operational obligations use these dates without creating household data.
export function occurrenceKey(item,date){
  if(item.frequency==='daily')return `D:${isoDay(date)}`;
  if(item.frequency==='weekly'){
    const d=new Date(date),day=d.getDay()||7;d.setDate(d.getDate()-day+1);return `W:${isoDay(d)}`;
  }
  if(item.frequency==='biweekly')return `Q:${monthKey(date)}:${date.getDate()<=15?1:2}`;
  if(item.frequency==='monthly')return `M:${monthKey(date)}`;
  if(item.frequency==='bimonthly')return `B:${monthKey(date)}`;
  if(item.frequency==='quarterly')return `T:${monthKey(date)}`;
  if(item.frequency==='yearly')return `Y:${date.getFullYear()}`;
  if(item.frequency==='one_time')return `O:${item.id}`;
  return `V:${monthKey(date)}`;
}
function occurrenceBalance(state,item,key,now=new Date()){
  const legacyIds=[...(item.legacyCommitmentIds||[]),...(item.id==='home-housing'?['life-housing']:item.id==='home-services'?['life-services']:item.id.startsWith('home-commitment-')?[item.id.slice(16)]:[])];
  const legacyPeriod=key.startsWith('Q:')?`${key.slice(2,9)}-Q${key.slice(-1)}`:key.replace(/^[DMBTY]:/,'');
  const payments=(state.movimientos||[]).filter(m=>{
    if(m.tipo!=='gasto'||m.affectsPersonal===false||!inObservedPeriod(m.fecha,0,now))return false;
    if(m.householdExpenseId===item.id&&m.householdPeriod===key)return true;
    if(!legacyIds.includes(m.commitmentId))return false;
    if(m.periodo===legacyPeriod||m.periodo===key)return true;
    const legacyMonth=/^\d{4}-\d{2}$/.test(m.periodo||'');
    return (!m.periodo||legacyMonth&&['daily','weekly','biweekly','yearly'].includes(item.frequency))&&occurrenceKey(item,new Date(m.fecha))===key;
  });
  const target=payments.find(m=>Number.isFinite(m.householdExpectedAmount))?.householdExpectedAmount??safeFloat(item.amount);
  const paid=payments.reduce((sum,m)=>sum+safeFloat(m.monto),0);
  if(!payments.length&&legacyIds.some(id=>(state.financialPlan?.commitments||[]).some(c=>c.id===id&&(c.lastPaidPeriod===legacyPeriod||c.lastPaidPeriod===key))))return {target,paid:target,remaining:0};
  return {target,paid,remaining:payments.some(m=>m.householdSettled===true)?0:Math.max(0,target-paid)};
}
const paidOccurrence=(state,item,key,now)=>occurrenceBalance(state,item,key,now).remaining<=0.005;
const itemAnchor=item=>validDate(item.nextDueDate)||new Date(item.createdAt||Date.now());

function monthlyOccurrences(item,start,end,step=1){
  const out=[],anchor=itemAnchor(item),notBefore=startOfDay(anchor);
  for(let cursor=new Date(start.getFullYear(),start.getMonth(),1,9);cursor<=end;cursor.setMonth(cursor.getMonth()+1)){
    const monthDiff=(cursor.getFullYear()*12+cursor.getMonth())-(anchor.getFullYear()*12+anchor.getMonth());
    if(monthDiff<0||step>1&&((monthDiff%step)+step)%step!==0)continue;
    const day=Math.min(item.dueDay,lastDay(cursor.getFullYear(),cursor.getMonth())),d=new Date(cursor.getFullYear(),cursor.getMonth(),day,9);
    if(d<notBefore)continue;if(d>=start&&d<=end)out.push(d);
  }return out;
}
export function occurrenceDates(item,start,end){
  const notBefore=startOfDay(itemAnchor(item));
  if(item.frequency==='variable')return [];
  if(item.frequency==='one_time'){
    const d=validDate(item.nextDueDate);return d&&d>=start&&d<=end?[d]:[];
  }
  if(item.frequency==='daily'){
    const out=[];for(let d=new Date(Math.max(start.getTime(),notBefore.getTime()));d<=end;d.setDate(d.getDate()+1)){const x=new Date(d);x.setHours(9,0,0,0);if(x>=notBefore&&x>=start&&x<=end)out.push(x);}return out;
  }
  if(item.frequency==='weekly'){
    const out=[],anchor=itemAnchor(item),target=anchor.getDay();let d=new Date(Math.max(start.getTime(),notBefore.getTime()));d.setHours(9,0,0,0);d.setDate(d.getDate()+((target-d.getDay()+7)%7));for(;d<=end;d.setDate(d.getDate()+7))if(d>=notBefore)out.push(new Date(d));return out;
  }
  if(item.frequency==='biweekly'){
    const out=[];for(let cur=new Date(start.getFullYear(),start.getMonth(),1,9);cur<=end;cur.setMonth(cur.getMonth()+1)){for(const day of [15,lastDay(cur.getFullYear(),cur.getMonth())]){const d=new Date(cur.getFullYear(),cur.getMonth(),day,9);if(d>=notBefore&&d>=start&&d<=end)out.push(d);}}return out;
  }
  if(item.frequency==='monthly')return monthlyOccurrences(item,start,end,1);
  if(item.frequency==='bimonthly')return monthlyOccurrences(item,start,end,2);
  if(item.frequency==='quarterly')return monthlyOccurrences(item,start,end,3);
  if(item.frequency==='yearly'){
    const anchor=itemAnchor(item),out=[];
    for(let y=start.getFullYear();y<=end.getFullYear();y++){const d=new Date(y,anchor.getMonth(),Math.min(anchor.getDate()||item.dueDay,lastDay(y,anchor.getMonth())),9);if(d>=notBefore&&d>=start&&d<=end)out.push(d);}return out;
  }
  return [];
}

function unpaidPast(item,now,state){
  if(item.frequency==='variable')return [];
  const boundary=startOfDay(now),from=startOfDay(itemAnchor(item));
  const dates=occurrenceDates(item,from,new Date(boundary.getTime()-1));
  return dates.filter(d=>!paidOccurrence(state,item,occurrenceKey(item,d),now)).sort((a,b)=>a-b);
}
function nextUnpaidFuture(item,now,state,days=400){
  const start=startOfDay(now),end=new Date(start.getTime()+days*DAY);
  return occurrenceDates(item,start,end).find(d=>!paidOccurrence(state,item,occurrenceKey(item,d),now))||null;
}
function nextScheduledFuture(item,now,days=400){
  const start=startOfDay(now),end=new Date(start.getTime()+days*DAY);
  return occurrenceDates(item,start,end)[0]||null;
}

export function householdUpcomingEvents({days=45,now=new Date()}={}){
  const state=getState(),start=startOfDay(now),end=horizonEnd(now,days),events=[];
  for(const item of householdItems()){
    if(item.active===false&&!(item.frequency==='one_time'&&(state.movimientos||[]).some(m=>m.householdExpenseId===item.id&&new Date(m.fecha)>now)))continue;
    if(item.priority!=='obligatory'||item.frequency==='variable')continue;
    for(const overdue of unpaidPast(item,now,state)){const shown=new Date(start);shown.setHours(9,0,0,0);events.push({id:`home-${item.id}-${occurrenceKey(item,overdue)}`,refId:item.id,date:shown.toISOString(),dueDate:overdue.toISOString(),overdue:true,title:item.name,amount:occurrenceBalance(state,item,occurrenceKey(item,overdue),now).remaining,type:'expense',category:item.category,household:true,householdPeriod:occurrenceKey(item,overdue)});}
    for(const date of occurrenceDates(item,start,end)){
      const key=occurrenceKey(item,date);if(paidOccurrence(state,item,key,now))continue;
      events.push({id:`home-${item.id}-${key}`,refId:item.id,date:date.toISOString(),dueDate:date.toISOString(),overdue:false,title:item.name,amount:occurrenceBalance(state,item,key,now).remaining,type:'expense',category:item.category,household:true,householdPeriod:key});
    }
    // Un abono pendiente debe sobrevivir a la ventana de búsqueda de vencimientos.
    for(const movement of state.movimientos||[]){
      const key=movement.householdPeriod;
      if(movement.tipo!=='gasto'||movement.householdExpenseId!==item.id||!key||!inObservedPeriod(movement.fecha,0,now)||paidOccurrence(state,item,key,now)||events.some(e=>e.refId===item.id&&e.householdPeriod===key))continue;
      const paidAt=new Date(movement.fecha);if(paidAt>end)continue;
      const scheduled=occurrenceDates(item,new Date(paidAt.getTime()-400*DAY),new Date(paidAt.getTime()+400*DAY)).find(d=>occurrenceKey(item,d)===key)||paidAt;
      if(scheduled>end)continue;
      const overdue=scheduled<start,shown=overdue?new Date(start):scheduled;
      shown.setHours(9,0,0,0);
      events.push({id:`home-${item.id}-${key}`,refId:item.id,date:shown.toISOString(),dueDate:scheduled.toISOString(),overdue,title:item.name,amount:occurrenceBalance(state,item,key,now).remaining,type:'expense',category:item.category,household:true,householdPeriod:key});
    }
  }
  return events.sort((a,b)=>new Date(a.date)-new Date(b.date));
}

export function householdBudgetStatus(now=new Date()){
  const state=getState(),start=new Date(now.getFullYear(),now.getMonth(),1),rows=[];
  for(const item of householdItems({activeOnly:true}).filter(x=>x.priority==='budgeted')){
    let periodStart=new Date(start),periodEnd=new Date(now.getFullYear(),now.getMonth()+1,1),budget=monthlyEquivalent(item,now);
    if(item.frequency==='biweekly'){
      periodStart=new Date(now.getFullYear(),now.getMonth(),now.getDate()<=15?1:16);
      periodEnd=now.getDate()<=15?new Date(now.getFullYear(),now.getMonth(),16):periodEnd;budget=safeFloat(item.amount);
    }else if(item.frequency==='weekly'){
      periodStart=new Date(now.getFullYear(),now.getMonth(),now.getDate()-((now.getDay()+6)%7));
      periodEnd=new Date(periodStart);periodEnd.setDate(periodEnd.getDate()+7);budget=safeFloat(item.amount);
    }
    const initial=item.initialBudget;
    if(initial?.startDate&&isoDay(now)>=initial.startDate&&isoDay(now)<(initial.endDate||isoDay(new Date(now.getFullYear(),now.getMonth()+1,1)))){
      budget=safeFloat(initial.amount);periodStart=new Date(`${initial.startDate}T00:00:00`);
    }
    if(!(budget>=0))continue;
    const spent=(state.movimientos||[]).filter(m=>m.tipo==='gasto'&&m.affectsPersonal!==false&&m.householdExpenseId===item.id&&inObservedPeriod(m.fecha,periodStart,now)&&new Date(m.fecha)<periodEnd).reduce((a,m)=>a+safeFloat(m.monto),0);
    rows.push({item,budget,spent,remaining:Math.max(0,budget-spent)});
  }
  return rows;
}
export function householdCommittedRemaining(now=new Date()){return householdBudgetStatus(now).reduce((a,x)=>a+x.remaining,0);}

export function householdReserveNeed(now=new Date(),horizonDays=30){
  const state=getState(),rows=[];
  for(const item of householdItems({activeOnly:true}).filter(x=>x.priority==='obligatory')){
    if(item.frequency==='variable'){
      const amount=monthlyEquivalent(item,now);if(amount>0)rows.push({item,amount,reason:'variable'});continue;
    }
    const due=nextUnpaidFuture(item,now,state,740);if(!due)continue;
    if(due<=horizonEnd(now,horizonDays))continue;
    const lastPayment=[...(state.movimientos||[])].filter(m=>m.householdExpenseId===item.id&&inObservedPeriod(m.fecha,0,now)).sort((a,b)=>new Date(b.fecha)-new Date(a.fecha))[0];
    const cycleStart=lastPayment?new Date(lastPayment.fecha):itemAnchor(item),startMs=Math.min(startOfDay(cycleStart).getTime(),startOfDay(now).getTime()),endMs=startOfDay(due).getTime();
    if(endMs<=startMs)continue;
    const ratio=clamp((startOfDay(now).getTime()-startMs)/(endMs-startMs),0,1),amount=safeFloat(item.amount)*ratio;
    if(amount>0.005)rows.push({item,amount,dueDate:due.toISOString(),reason:'accrued',ratio});
  }
  return {total:rows.reduce((a,x)=>a+x.amount,0),rows};
}

export function householdSummary(now=new Date()){
  const state=getState(),start=new Date(now.getFullYear(),now.getMonth(),1),items=householdItems({activeOnly:true});
  const spent=(state.movimientos||[]).filter(m=>m.tipo==='gasto'&&m.affectsPersonal!==false&&m.householdExpenseId&&inObservedPeriod(m.fecha,start,now)).reduce((a,m)=>a+safeFloat(m.monto),0);
  const mandatory=items.filter(x=>x.priority==='obligatory').reduce((a,x)=>a+monthlyEquivalent(x,now),0);
  const budgeted=items.filter(x=>x.priority==='budgeted').reduce((a,x)=>a+monthlyEquivalent(x,now),0);
  const discretionarySpent=(state.movimientos||[]).filter(m=>m.tipo==='gasto'&&m.affectsPersonal!==false&&inObservedPeriod(m.fecha,start,now)&&items.some(x=>x.id===m.householdExpenseId&&x.priority==='discretionary')).reduce((a,m)=>a+safeFloat(m.monto),0);
  const reserve=householdReserveNeed(now).total;
  return {spent,mandatory,budgeted,discretionarySpent,reserve,planned:mandatory+budgeted};
}

function paymentPeriod(item,at){
  const state=getState();
  const partials=(state.movimientos||[]).filter(m=>m.tipo==='gasto'&&m.householdExpenseId===item.id&&m.householdPeriod&&inObservedPeriod(m.fecha,0,at)&&!paidOccurrence(state,item,m.householdPeriod,at)).sort((a,b)=>new Date(a.fecha)-new Date(b.fecha));
  if(partials.length)return partials[0].householdPeriod;
  if(item.frequency==='variable')return occurrenceKey(item,at);
  const boundary=new Date(at),from=startOfDay(itemAnchor(item)),past=occurrenceDates(item,from,boundary)
    .filter(d=>d<=boundary&&!paidOccurrence(state,item,occurrenceKey(item,d),at)).sort((a,b)=>a-b);
  if(past.length)return occurrenceKey(item,past[0]);
  const future=nextScheduledFuture(item,boundary,740);return future?occurrenceKey(item,future):occurrenceKey(item,boundary);
}
export function recordHouseholdExpense(id,amount=null,fecha=Date.now(),options={}){
  const existing=options.operationId&&(getState().movimientos||[]).find(m=>m.operationId===options.operationId);
  if(existing){if(existing.householdExpenseId!==id)throw new Error('OPERACION_INCOMPATIBLE');return householdById(id);}
  const state=getState(),item=householdById(id);if(!item||item.active===false)throw new Error('GASTO_HOGAR_NO_ENCONTRADO');
  const d=actualPaymentDate(fecha);
  if(item.priority==='obligatory'&&(state.movimientos||[]).some(x=>x.tipo==='gasto'&&x.householdExpenseId===item.id&&isoDay(new Date(x.fecha))===isoDay(d)&&paidOccurrence(state,item,x.householdPeriod)))throw new Error('GASTO_HOGAR_YA_PAGADO');
  const period=options.period||(item.priority==='obligatory'?paymentPeriod(item,d):occurrenceKey(item,d));
  const status=occurrenceBalance(state,item,period,d),m=amount===null||amount===''?positive(item.priority==='obligatory'?status.remaining:item.amount):positive(amount);
  if(item.priority==='obligatory'&&paidOccurrence(state,item,period))throw new Error('GASTO_HOGAR_YA_PAGADO');
  state.movimientos.push({id:options.operationId?`payment-${encodeURIComponent(options.operationId)}`:uuid(),...(options.operationId?{operationId:options.operationId}:{}),fecha:d.toISOString(),tipo:'gasto',desc:item.name,monto:m,categoria:item.category,accountId:PERSONAL_ACCOUNT_ID,affectsPersonal:true,householdExpenseId:item.id,householdPeriod:period,...(item.priority==='obligatory'?{householdExpectedAmount:status.target,...(options.settled===true?{householdSettled:true}:{})}:{})});
  if(item.frequency==='one_time'&&(item.priority!=='obligatory'||paidOccurrence(state,item,period)))item.active=false;
  saveData();return item;
}

function seed(id,{name,category,amount,frequency='monthly',priority='budgeted',dueDay=1}){
  let item=householdById(id);const m=safeFloat(amount);
  if(!(m>0)){if(item)item.active=false;return item||null;}
  if(!item){item=normalizeItem({id,name,category,amount:m,frequency,priority,dueDay});ensureHousehold().push(item);}
  else Object.assign(item,{name,category,amount:m,frequency,priority,dueDay:clamp(Math.round(safeFloat(dueDay||1)),1,31),active:true});
  return item;
}
export function seedHouseholdFromLivingSetup({housing,housingDay=1,services,servicesDay=10,groceries,health,leisure,other}={}){
  ensureHousehold();
  seed('home-housing',{name:'Vivienda / renta',category:'Vivienda',amount:housing,frequency:'monthly',priority:'obligatory',dueDay:housingDay});
  seed('home-services',{name:'Servicios del hogar',category:'Servicios',amount:services,frequency:'monthly',priority:'obligatory',dueDay:servicesDay});
  seed('home-groceries',{name:'Despensa / comida',category:'Alimentación',amount:groceries,frequency:'monthly',priority:'budgeted'});
  seed('home-health',{name:'Salud',category:'Salud',amount:health,frequency:'monthly',priority:'budgeted'});
  seed('home-leisure',{name:'Ocio / salidas',category:'Ocio',amount:leisure,frequency:'monthly',priority:'budgeted'});
  seed('home-other',{name:'Otros gastos personales',category:'Otros',amount:other,frequency:'monthly',priority:'budgeted'});
  saveData();return householdItems();
}
