/* Operational obligations have one schedule and real payments in the existing ledger. No DOM. */
import { safeFloat, uuid } from '../01_consts_utils.js';
import { getState, saveData } from '../02_data.js';
import { recordUniversalMovement } from '../15_accounts_engine.js';
import { occurrenceDates, occurrenceKey } from '../20_home_engine.js';

export const OPERATING_FREQUENCIES=Object.freeze({
  daily:'Diario',weekly:'Semanal',biweekly:'Quincenal (15 y fin de mes)',monthly:'Mensual',bimonthly:'Bimestral',yearly:'Anual'
});
const EPS=0.005;
export const localDay=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const dayDate=value=>{
  const raw=String(value||''),date=new Date(`${raw}T09:00:00`);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(raw)||Number.isNaN(date.getTime())||localDay(date)!==raw)throw new Error('FECHA_INVALIDA');
  return date;
};
const startOfDay=value=>{const d=new Date(value);d.setHours(0,0,0,0);return d;};
const positive=value=>{const n=safeFloat(value);if(!(n>0))throw new Error('MONTO_INVALIDO');return n;};
const name=value=>{const v=String(value||'').trim();if(!v)throw new Error('DESCRIPCION_INVALIDA');return v;};

export function operatingObligations(){
  const state=getState();state.financialPlan=state.financialPlan||{};
  if(!Array.isArray(state.financialPlan.operatingObligations)){state.financialPlan.operatingObligations=[];saveData();}
  return state.financialPlan.operatingObligations;
}
export const operatingObligationById=id=>operatingObligations().find(item=>item.id===id)||null;

function personalAccount(id){
  const account=getState().accounts.find(a=>a.id===id&&a.active!==false&&a.ownership!=='third_party');
  if(!account)throw new Error('CUENTA_NO_ENCONTRADA');return account;
}
function balance(item,period){
  const payments=(getState().movimientos||[]).filter(m=>m.tipo==='gasto'&&m.affectsPersonal!==false&&m.operatingObligationId===item.id&&m.operatingPeriod===period);
  const target=payments.find(m=>Number.isFinite(m.operatingExpectedAmount))?.operatingExpectedAmount??safeFloat(item.amount);
  const paid=payments.reduce((sum,m)=>sum+safeFloat(m.monto),0);
  return {target,paid,remaining:payments.some(m=>m.operatingSettled===true)?0:Math.max(0,target-paid)};
}
function scheduledDates(item,end){
  const start=startOfDay(dayDate(item.nextDueDate));
  return occurrenceDates(item,start,end).filter(date=>!item.endedOn||localDay(date)<item.endedOn);
}

export function operatingUpcomingEvents({days=45,now=new Date()}={}){
  const start=startOfDay(now),end=new Date(start);end.setDate(end.getDate()+days);end.setHours(23,59,59,999);
  const events=[];
  for(const item of operatingObligations()){
    if(item.active===false&&!item.endedOn)continue;
    for(const date of scheduledDates(item,end)){
      const period=occurrenceKey(item,date),amount=balance(item,period).remaining;if(amount<=EPS)continue;
      const overdue=date<start,shown=overdue?new Date(start):new Date(date);shown.setHours(9,0,0,0);
      events.push({id:`operating-${item.id}-${period}`,refId:item.id,sourceId:item.sourceId,date:shown.toISOString(),dueDate:date.toISOString(),overdue,title:item.name,amount,type:'expense',category:item.category,operational:true,operatingPeriod:period});
    }
  }
  return events.sort((a,b)=>new Date(a.date)-new Date(b.date)||new Date(a.dueDate)-new Date(b.dueDate));
}

export function createOperatingObligation(config={}, {paid=false,date=new Date()}={}){
  const firstDate=dayDate(config.nextDueDate),accountId=config.accountId||'acct-personal';personalAccount(accountId);
  if(!OPERATING_FREQUENCIES[config.frequency])throw new Error('FRECUENCIA_INVALIDA');
  const sourceId=config.sourceId||null;if(sourceId&&!getState().workSources.some(s=>s.id===sourceId))throw new Error('FUENTE_NO_ENCONTRADA');
  if(Number.isNaN(new Date(date).getTime()))throw new Error('FECHA_INVALIDA');
  const item={id:uuid(),name:name(config.name),amount:positive(config.amount),frequency:config.frequency,nextDueDate:localDay(firstDate),dueDay:firstDate.getDate(),category:config.category||'Renta',sourceId,accountId,active:true,createdAt:new Date().toISOString()};
  // Quincenal keeps the shared 15/end-of-month convention; the selected date is the first actual due date.
  const first=occurrenceDates(item,startOfDay(firstDate),new Date(firstDate.getFullYear()+1,firstDate.getMonth(),firstDate.getDate(),23))[0];
  item.nextDueDate=localDay(first);
  operatingObligations().push(item);
  if(paid)payOperatingObligation(item.id,{period:occurrenceKey(item,first),amount:item.amount,date});
  else saveData();
  return item;
}

export function payOperatingObligation(id,{period,amount,date=new Date(),accountId,settled=false}={}){
  const item=operatingObligationById(id);if(!item)throw new Error('COSTO_OPERATIVO_NO_ENCONTRADO');
  const paymentDate=new Date(date);if(Number.isNaN(paymentDate.getTime()))throw new Error('FECHA_INVALIDA');
  const end=new Date(Math.max(paymentDate.getTime(),dayDate(item.nextDueDate).getTime()));end.setFullYear(end.getFullYear()+1);
  const dates=scheduledDates(item,end),due=period?dates.find(d=>occurrenceKey(item,d)===period):dates.find(d=>balance(item,occurrenceKey(item,d)).remaining>EPS);
  if(!due)throw new Error('PAGO_OPERATIVO_NO_ENCONTRADO');
  const key=occurrenceKey(item,due),status=balance(item,key);if(status.remaining<=EPS)throw new Error('COSTO_OPERATIVO_YA_PAGADO');
  return recordUniversalMovement({type:'expense',description:item.name,amount:positive(amount??status.remaining),accountId:accountId||item.accountId,category:item.category,sourceId:item.sourceId,tags:['operational'],date:paymentDate,
    operatingPayment:{id:item.id,period:key,dueDate:localDay(due),expectedAmount:status.target,settled}});
}

export function endOperatingObligation(id,now=new Date()){
  const item=operatingObligationById(id);if(!item)throw new Error('COSTO_OPERATIVO_NO_ENCONTRADO');
  if(item.active===false)return item;
  // Preserve unpaid obligations through today; only later payments stop being scheduled.
  const tomorrow=new Date(now);if(Number.isNaN(tomorrow.getTime()))throw new Error('FECHA_INVALIDA');tomorrow.setDate(tomorrow.getDate()+1);item.endedOn=localDay(tomorrow);item.active=false;saveData();return item;
}
