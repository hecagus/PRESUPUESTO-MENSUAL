/* v2.8.0 - Semántica de Hogar: obligación, presupuesto, reserva, opcional y gasto real. */
import { safeFloat } from './01_consts_utils.js';
import * as Data from './02_data.js';
import * as Base from './20_home_engine.js';

export const HOME_KINDS=Object.freeze({
  obligation:{label:'Obligación',icon:'🔴',description:'Lo tienes que pagar sí o sí.'},
  budget:{label:'Presupuesto necesario',icon:'🟡',description:'Dinero que sabes que necesitas para vivir.'},
  reserve:{label:'Reserva / necesidad',icon:'🟠',description:'Algo concreto que necesitas comprar próximamente.'},
  optional:{label:'Opcional',icon:'🔵',description:'Lo pagas sólo si decides hacerlo.'},
  spent:{label:'Gasto realizado',icon:'💸',description:'Dinero que ya salió; no crea un presupuesto futuro.'}
});
export const HOME_FREQUENCIES=Base.HOME_FREQUENCIES;
export const HOME_CATEGORIES=Base.HOME_CATEGORIES;
export const HOME_PRIORITIES=Base.HOME_PRIORITIES;

const kindFromPriority=p=>p==='obligatory'?'obligation':p==='budgeted'?'budget':'optional';
const priorityFromKind=k=>k==='obligation'?'obligatory':k==='budget'?'budgeted':'discretionary';
const validKind=k=>HOME_KINDS[k]?k:null;
const semantics=()=>{
  const state=Data.getState();
  state.financialPlan=state.financialPlan&&typeof state.financialPlan==='object'?state.financialPlan:{};
  state.financialPlan.householdKinds=state.financialPlan.householdKinds&&typeof state.financialPlan.householdKinds==='object'?state.financialPlan.householdKinds:{};
  return state.financialPlan.householdKinds;
};
const itemKind=item=>validKind(semantics()[item.id])||kindFromPriority(item.priority);
const decorate=item=>item?{...item,kind:itemKind(item)}:null;
const remember=(id,kind)=>{semantics()[id]=validKind(kind)||'budget';Data.saveData();};
const dayFromDate=value=>{if(!value)return null;const d=new Date(`${String(value).slice(0,10)}T12:00:00`);return Number.isNaN(d.getTime())?null:d.getDate();};

export function ensureHousehold(){
  const items=Base.ensureHousehold(),map=semantics();let changed=false;
  for(const item of items)if(!validKind(map[item.id])){map[item.id]=kindFromPriority(item.priority);changed=true;}
  const plan=Data.getState().financialPlan;if(Number(plan.householdSemanticsVersion||0)<1){plan.householdSemanticsVersion=1;changed=true;}
  if(changed)Data.saveData();return items.map(decorate);
}
export function householdItems({activeOnly=false}={}){const items=ensureHousehold();return activeOnly?items.filter(x=>x.active!==false):items;}
export function householdById(id){return decorate(Base.householdById(id));}

function configForKind(config={}){
  const kind=validKind(config.kind)||kindFromPriority(config.priority),next={...config,priority:priorityFromKind(kind)};
  if(kind==='reserve'||kind==='spent')next.frequency='one_time';
  if(next.nextDueDate&&next.dueDay===undefined){const day=dayFromDate(next.nextDueDate);if(day)next.dueDay=day;}
  delete next.kind;return {kind,next};
}
export function createHouseholdExpense(config={}){
  const {kind,next}=configForKind(config);if(kind==='spent')throw new Error('USA_GASTO_REALIZADO');
  const item=Base.createHouseholdExpense(next);remember(item.id,kind);return decorate(item);
}
export function updateHouseholdExpense(id,patch={}){
  const current=householdById(id);if(!current)throw new Error('GASTO_HOGAR_NO_ENCONTRADO');
  const kind=validKind(patch.kind)||current.kind,{next}=configForKind({...patch,kind});
  if(patch.kind===undefined)delete next.priority;
  const item=Base.updateHouseholdExpense(id,next);remember(id,kind);return decorate(item);
}
export function setHouseholdExpenseActive(id,active){const item=Base.setHouseholdExpenseActive(id,active);return decorate(item);}
export const householdMonthlyEquivalent=Base.householdMonthlyEquivalent;
export const householdUpcomingEvents=Base.householdUpcomingEvents;
export const householdBudgetStatus=Base.householdBudgetStatus;
export const householdCommittedRemaining=Base.householdCommittedRemaining;

export function householdExplicitReserveStatus(){
  const state=Data.getState(),rows=[];
  for(const item of householdItems({activeOnly:true}).filter(x=>x.kind==='reserve')){
    const spent=(state.movimientos||[]).filter(m=>m.tipo==='gasto'&&m.householdExpenseId===item.id).reduce((a,m)=>a+safeFloat(m.monto),0);
    rows.push({item,reserved:safeFloat(item.amount),spent,remaining:Math.max(0,safeFloat(item.amount)-spent)});
  }
  return rows;
}
export function householdReserveNeed(now=new Date(),horizonDays=30){
  const base=Base.householdReserveNeed(now,horizonDays),explicit=householdExplicitReserveStatus().filter(x=>x.remaining>0.005).map(x=>({item:x.item,amount:x.remaining,dueDate:x.item.nextDueDate?`${x.item.nextDueDate}T09:00:00`:null,reason:'explicit'}));
  const rows=[...explicit,...base.rows];return {total:rows.reduce((a,x)=>a+safeFloat(x.amount),0),rows};
}
export function householdSummary(now=new Date()){
  const state=Data.getState(),start=new Date(now.getFullYear(),now.getMonth(),1),items=householdItems({activeOnly:true});
  const spent=(state.movimientos||[]).filter(m=>m.tipo==='gasto'&&m.affectsPersonal!==false&&m.householdExpenseId&&new Date(m.fecha)>=start).reduce((a,m)=>a+safeFloat(m.monto),0);
  const mandatory=items.filter(x=>x.kind==='obligation').reduce((a,x)=>a+Base.householdMonthlyEquivalent(x,now),0);
  const budgeted=items.filter(x=>x.kind==='budget').reduce((a,x)=>a+Base.householdMonthlyEquivalent(x,now),0);
  const optional=items.filter(x=>x.kind==='optional').reduce((a,x)=>a+Base.householdMonthlyEquivalent(x,now),0);
  const explicitReserve=householdExplicitReserveStatus().reduce((a,x)=>a+x.remaining,0),reserve=householdReserveNeed(now).total;
  return {spent,mandatory,budgeted,optional,explicitReserve,reserve,planned:mandatory+budgeted+reserve};
}

export function recordHouseholdExpense(id,amount=null,fecha=Date.now()){
  const kind=householdById(id)?.kind||'optional',item=Base.recordHouseholdExpense(id,amount,fecha);remember(id,kind);return decorate(item);
}
export function recordDirectHouseholdExpense(config={}){
  const date=String(config.date||config.nextDueDate||new Date().toISOString().slice(0,10)).slice(0,10),localDate=`${date}T12:00:00`,item=Base.createHouseholdExpense({...config,frequency:'one_time',priority:'discretionary',nextDueDate:date});
  remember(item.id,'spent');Base.recordHouseholdExpense(item.id,config.amount,localDate);return householdById(item.id);
}

export function seedHouseholdFromLivingSetup(values={}){
  const items=Base.seedHouseholdFromLivingSetup(values);const map=semantics();
  for(const item of items)if(!validKind(map[item.id]))map[item.id]=kindFromPriority(item.priority);
  Data.saveData();return items.map(decorate);
}
