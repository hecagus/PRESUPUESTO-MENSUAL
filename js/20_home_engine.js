/* v2.7.0 - Motor de hogar: obligaciones, presupuestos y gastos ocasionales. Cero DOM. */
import { safeFloat, uuid } from './01_consts_utils.js';
import { getState, saveData } from './02_data.js';

const PERSONAL_ACCOUNT_ID='acct-personal';
const DAY=86400000;

export const HOME_PRIORITIES=Object.freeze({
  obligatory:{label:'Obligatorio',icon:'🔴'},
  budgeted:{label:'Presupuestado',icon:'🟡'},
  discretionary:{label:'Discrecional',icon:'🔵'}
});
export const HOME_FREQUENCIES=Object.freeze({
  daily:'Diario',weekly:'Semanal',biweekly:'Quincenal',monthly:'Mensual',bimonthly:'Bimestral',yearly:'Anual',variable:'Variable / sin fecha',one_time:'Ocasional / una sola vez'
});
export const HOME_CATEGORIES=Object.freeze([
  'Vivienda','Servicios','Alimentación','Suscripciones','Higiene y belleza','Ropa','Compras','Salud','Educación','Mascotas','Transporte personal','Ocio','Otros'
]);

const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
const text=v=>{const s=String(v??'').trim();if(!s)throw new Error('NOMBRE_INVALIDO');return s;};
const positive=v=>{const n=safeFloat(v);if(!(n>0))throw new Error('MONTO_INVALIDO');return n;};
const monthKey=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
const isoDay=d=>d.toISOString().slice(0,10);
const lastDay=(y,m)=>new Date(y,m+1,0).getDate();
const normalizedFrequency=f=>HOME_FREQUENCIES[f]?f:'monthly';
const normalizedPriority=p=>HOME_PRIORITIES[p]?p:'budgeted';

function normalizeItem(raw={}){
  const frequency=normalizedFrequency(raw.frequency||raw.frecuencia);
  const priority=normalizedPriority(raw.priority||raw.level);
  const createdAt=raw.createdAt||new Date().toISOString();
  return {
    id:raw.id||uuid(),name:String(raw.name||raw.desc||'Gasto del hogar').trim()||'Gasto del hogar',
    category:HOME_CATEGORIES.includes(raw.category)?raw.category:(raw.category||'Otros'),
    amount:Math.max(0,safeFloat(raw.amount??raw.monto)),frequency,priority,
    dueDay:clamp(Math.round(safeFloat(raw.dueDay??raw.diaPago??1)),1,31),
    nextDueDate:raw.nextDueDate||raw.dueDate||null,active:raw.active!==false,createdAt,
    notes:String(raw.notes||'').trim()
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
    if(housing?.active!==false&&safeFloat(housing.amount)>0)addMigrated(plan,{id:'home-housing',name:housing.name||'Renta / vivienda',category:'Vivienda',amount:housing.amount,frequency:'monthly',priority:'obligatory',dueDay:housing.dueDay||1});
    if(services?.active!==false&&safeFloat(services.amount)>0)addMigrated(plan,{id:'home-services',name:services.name||'Servicios del hogar',category:'Servicios',amount:services.amount,frequency:'monthly',priority:'obligatory',dueDay:services.dueDay||10});
    if(housing)housing.active=false;if(services)services.active=false;
    const living=plan.livingBudgets||{};
    const seeds=[['groceries','home-groceries','Despensa / comida','Alimentación'],['health','home-health','Salud','Salud'],['leisure','home-leisure','Ocio / salidas','Ocio'],['other','home-other','Otros gastos personales','Otros']];
    for(const [key,id,name,category] of seeds){if(safeFloat(living[key])>0)addMigrated(plan,{id,name,category,amount:living[key],frequency:'monthly',priority:'budgeted'});if(living[key]!==undefined)living[key]=0;}
    plan.livingBudgets=living;plan.householdModelVersion=1;changed=true;
  }
  if(changed)saveData();return plan.householdExpenses;
}

export function householdItems({activeOnly=false}={}){const items=ensureHousehold();return activeOnly?items.filter(x=>x.active!==false):items;}
export function householdById(id){return ensureHousehold().find(x=>x.id===id)||null;}

export function createHouseholdExpense(config={}){
  const list=ensureHousehold(),item=normalizeItem({...config,name:text(config.name),amount:positive(config.amount)});list.push(item);saveData();return item;
}
export function updateHouseholdExpense(id,patch={}){
  const item=householdById(id);if(!item)throw new Error('GASTO_HOGAR_NO_ENCONTRADO');
  if(patch.name!==undefined)item.name=text(patch.name);
  if(patch.amount!==undefined)item.amount=positive(patch.amount);
  if(patch.category!==undefined)item.category=HOME_CATEGORIES.includes(patch.category)?patch.category:'Otros';
  if(patch.frequency!==undefined)item.frequency=normalizedFrequency(patch.frequency);
  if(patch.priority!==undefined)item.priority=normalizedPriority(patch.priority);
  if(patch.dueDay!==undefined)item.dueDay=clamp(Math.round(safeFloat(patch.dueDay||1)),1,31);
  if(patch.nextDueDate!==undefined)item.nextDueDate=String(patch.nextDueDate||'').trim()||null;
  if(patch.notes!==undefined)item.notes=String(patch.notes||'').trim();
  if(patch.active!==undefined)item.active=Boolean(patch.active);
  saveData();return item;
}
export function setHouseholdExpenseActive(id,active){return updateHouseholdExpense(id,{active});}

function monthlyEquivalent(item,now=new Date()){
  const amount=safeFloat(item.amount),days=lastDay(now.getFullYear(),now.getMonth());
  if(item.frequency==='daily')return amount*days;
  if(item.frequency==='weekly')return amount*(52/12);
  if(item.frequency==='biweekly')return amount*2;
  if(item.frequency==='monthly'||item.frequency==='variable')return amount;
  if(item.frequency==='bimonthly')return amount/2;
  if(item.frequency==='yearly')return amount/12;
  return 0;
}
export function householdMonthlyEquivalent(item,now=new Date()){return monthlyEquivalent(normalizeItem(item),now);}

function occurrenceKey(item,date){
  if(item.frequency==='daily')return `D:${isoDay(date)}`;
  if(item.frequency==='weekly'){
    const d=new Date(date),day=d.getDay()||7;d.setDate(d.getDate()-day+1);return `W:${isoDay(d)}`;
  }
  if(item.frequency==='biweekly')return `Q:${monthKey(date)}:${date.getDate()<=15?1:2}`;
  if(item.frequency==='monthly')return `M:${monthKey(date)}`;
  if(item.frequency==='bimonthly')return `B:${monthKey(date)}`;
  if(item.frequency==='yearly')return `Y:${date.getFullYear()}`;
  if(item.frequency==='one_time')return `O:${item.id}`;
  return `V:${monthKey(date)}`;
}
const paidOccurrence=(state,item,key)=>(state.movimientos||[]).some(m=>m.householdExpenseId===item.id&&m.householdPeriod===key);

function monthlyOccurrences(item,start,end,step=1){
  const out=[];for(let cursor=new Date(start.getFullYear(),start.getMonth(),1,9);cursor<=end;cursor.setMonth(cursor.getMonth()+1)){
    const monthDiff=(cursor.getFullYear()*12+cursor.getMonth())-(new Date(item.nextDueDate||item.createdAt).getFullYear()*12+new Date(item.nextDueDate||item.createdAt).getMonth());
    if(step>1&&((monthDiff%step)+step)%step!==0)continue;
    const day=Math.min(item.dueDay,lastDay(cursor.getFullYear(),cursor.getMonth())),d=new Date(cursor.getFullYear(),cursor.getMonth(),day,9);if(d>=start&&d<=end)out.push(d);
  }return out;
}
function occurrenceDates(item,start,end){
  if(item.frequency==='variable')return [];
  if(item.frequency==='one_time'){
    const d=item.nextDueDate?new Date(`${item.nextDueDate}T09:00:00`):null;return d&&!Number.isNaN(d.getTime())&&d>=start&&d<=end?[d]:[];
  }
  if(item.frequency==='daily'){const out=[];for(let d=new Date(start);d<=end;d=new Date(d.getTime()+DAY)){const x=new Date(d);x.setHours(9,0,0,0);out.push(x);}return out;}
  if(item.frequency==='weekly'){
    const out=[],anchor=item.nextDueDate?new Date(`${item.nextDueDate}T09:00:00`):new Date(item.createdAt),target=anchor.getDay();let d=new Date(start);d.setHours(9,0,0,0);d.setDate(d.getDate()+((target-d.getDay()+7)%7));for(;d<=end;d=new Date(d.getTime()+7*DAY))out.push(new Date(d));return out;
  }
  if(item.frequency==='biweekly'){
    const out=[];for(let cur=new Date(start.getFullYear(),start.getMonth(),1,9);cur<=end;cur.setMonth(cur.getMonth()+1)){for(const day of [15,lastDay(cur.getFullYear(),cur.getMonth())]){const d=new Date(cur.getFullYear(),cur.getMonth(),day,9);if(d>=start&&d<=end)out.push(d);}}return out;
  }
  if(item.frequency==='monthly')return monthlyOccurrences(item,start,end,1);
  if(item.frequency==='bimonthly')return monthlyOccurrences(item,start,end,2);
  if(item.frequency==='yearly'){
    const anchor=item.nextDueDate?new Date(`${item.nextDueDate}T09:00:00`):new Date(item.createdAt),out=[];
    for(let y=start.getFullYear();y<=end.getFullYear();y++){const d=new Date(y,anchor.getMonth(),Math.min(anchor.getDate()||item.dueDay,lastDay(y,anchor.getMonth())),9);if(d>=start&&d<=end)out.push(d);}return out;
  }
  return [];
}

export function householdUpcomingEvents({days=45,now=new Date()}={}){
  const state=getState(),start=new Date(now);start.setHours(0,0,0,0);const end=new Date(start.getTime()+days*DAY),events=[];
  for(const item of householdItems({activeOnly:true})){
    if(item.priority!=='obligatory')continue;
    for(const date of occurrenceDates(item,start,end)){
      const key=occurrenceKey(item,date);if(paidOccurrence(state,item,key))continue;
      events.push({id:`home-${item.id}-${isoDay(date)}`,refId:item.id,date:date.toISOString(),title:item.name,amount:safeFloat(item.amount),type:'expense',category:item.category,household:true,householdPeriod:key});
    }
  }
  return events.sort((a,b)=>new Date(a.date)-new Date(b.date));
}

export function householdBudgetStatus(now=new Date()){
  const state=getState(),start=new Date(now.getFullYear(),now.getMonth(),1),rows=[];
  for(const item of householdItems({activeOnly:true}).filter(x=>x.priority==='budgeted')){
    const budget=monthlyEquivalent(item,now);if(!(budget>0))continue;
    const spent=(state.movimientos||[]).filter(m=>m.tipo==='gasto'&&m.affectsPersonal!==false&&m.householdExpenseId===item.id&&new Date(m.fecha)>=start).reduce((a,m)=>a+safeFloat(m.monto),0);
    rows.push({item,budget,spent,remaining:Math.max(0,budget-spent)});
  }
  return rows;
}
export function householdCommittedRemaining(now=new Date()){return householdBudgetStatus(now).reduce((a,x)=>a+x.remaining,0);}

export function householdSummary(now=new Date()){
  const state=getState(),start=new Date(now.getFullYear(),now.getMonth(),1),items=householdItems({activeOnly:true});
  const spent=(state.movimientos||[]).filter(m=>m.tipo==='gasto'&&m.affectsPersonal!==false&&m.householdExpenseId&&new Date(m.fecha)>=start).reduce((a,m)=>a+safeFloat(m.monto),0);
  const mandatory=items.filter(x=>x.priority==='obligatory').reduce((a,x)=>a+monthlyEquivalent(x,now),0);
  const budgeted=items.filter(x=>x.priority==='budgeted').reduce((a,x)=>a+monthlyEquivalent(x,now),0);
  const discretionarySpent=(state.movimientos||[]).filter(m=>m.tipo==='gasto'&&m.affectsPersonal!==false&&new Date(m.fecha)>=start&&items.some(x=>x.id===m.householdExpenseId&&x.priority==='discretionary')).reduce((a,m)=>a+safeFloat(m.monto),0);
  return {spent,mandatory,budgeted,discretionarySpent,planned:mandatory+budgeted};
}

function paymentPeriod(item,at){
  if(item.frequency==='one_time')return occurrenceKey(item,at);
  const start=new Date(at);start.setHours(0,0,0,0),end=new Date(start.getTime()+70*DAY),dates=occurrenceDates(item,start,end);
  return dates.length?occurrenceKey(item,dates[0]):occurrenceKey(item,at);
}
export function recordHouseholdExpense(id,amount=null,fecha=Date.now()){
  const state=getState(),item=householdById(id);if(!item||item.active===false)throw new Error('GASTO_HOGAR_NO_ENCONTRADO');
  const m=amount===null||amount===''?positive(item.amount):positive(amount),d=new Date(fecha),period=item.priority==='obligatory'?paymentPeriod(item,d):occurrenceKey(item,d);
  if(item.priority==='obligatory'&&paidOccurrence(state,item,period))throw new Error('GASTO_HOGAR_YA_PAGADO');
  state.movimientos.push({id:uuid(),fecha:d.toISOString(),tipo:'gasto',desc:item.name,monto:m,categoria:item.category,accountId:PERSONAL_ACCOUNT_ID,affectsPersonal:true,householdExpenseId:item.id,householdPeriod:period});
  if(item.frequency==='one_time')item.active=false;
  saveData();return item;
}

function seed(id,{name,category,amount,frequency='monthly',priority='budgeted',dueDay=1}){
  if(!(safeFloat(amount)>0))return null;let item=householdById(id);
  if(!item){item=normalizeItem({id,name,category,amount,frequency,priority,dueDay});ensureHousehold().push(item);}else Object.assign(item,{name,category,amount:safeFloat(amount),frequency,priority,dueDay,active:true});
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
