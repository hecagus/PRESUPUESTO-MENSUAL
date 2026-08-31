/* v3.0.0 - Semántica canónica de Hogar + migraciones y reparación segura de duplicados. */
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

const DUPLICATE_WINDOW_MS=5*60*1000;
const CORE_LEGACY_IDS=new Set(['life-housing','life-services']);
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
const sameMoney=(a,b)=>Math.abs(safeFloat(a)-safeFloat(b))<0.005;
const normalizedText=v=>String(v||'').trim().toLocaleLowerCase('es-MX');
const sameText=(a,b)=>normalizedText(a)===normalizedText(b);

function canonicalFrequency(value){
  const f=String(value||'monthly').toLowerCase();
  if(f.includes('diar'))return'daily';
  if(f.includes('seman'))return'weekly';
  if(f.includes('quinc')||f==='biweekly')return'biweekly';
  return'monthly';
}

function migrateLegacyCommitments(plan,map){
  if(Number(plan.householdCanonicalMigrationVersion||0)>=3)return false;
  plan.householdExpenses=Array.isArray(plan.householdExpenses)?plan.householdExpenses:[];
  const commitments=Array.isArray(plan.commitments)?plan.commitments:[];let changed=false;
  for(const c of commitments){
    if(c.active===false||CORE_LEGACY_IDS.has(c.id)||!(safeFloat(c.amount)>0))continue;
    const duplicate=plan.householdExpenses.some(x=>sameText(x.name,c.name)&&sameMoney(x.amount,c.amount));
    if(!duplicate){
      const id=`home-commitment-${c.id}`;
      plan.householdExpenses.push({
        id,name:String(c.name||'Compromiso').trim()||'Compromiso',
        category:HOME_CATEGORIES.includes(c.category)?c.category:'Otros',amount:safeFloat(c.amount),
        frequency:canonicalFrequency(c.frequency),priority:'obligatory',dueDay:Number(c.dueDay)||1,
        nextDueDate:null,active:true,createdAt:c.createdAt||new Date().toISOString(),notes:'Migrado del calendario anterior'
      });
      map[id]='obligation';changed=true;
    }
    c.active=false;changed=true;
  }
  plan.householdCanonicalMigrationVersion=3;return true||changed;
}

function repairExactDirectDuplicates(state,map){
  const plan=state.financialPlan;if(Number(plan.householdDirectRepairVersion||0)>=1)return 0;
  const items=new Map((plan.householdExpenses||[]).map(x=>[x.id,x])),seen=new Map(),removeMovements=new Set(),removeItems=new Set();
  const rows=(state.movimientos||[]).filter(m=>m.tipo==='gasto'&&m.householdExpenseId&&map[m.householdExpenseId]==='spent').sort((a,b)=>new Date(a.fecha)-new Date(b.fecha));
  for(const movement of rows){
    const item=items.get(movement.householdExpenseId);if(!item)continue;
    const stamp=new Date(movement.recordedAt||item.createdAt||movement.fecha).getTime();
    const day=String(movement.fecha||'').slice(0,10),key=`${normalizedText(item.name||movement.desc)}|${safeFloat(movement.monto).toFixed(2)}|${day}`;
    const previous=seen.get(key);
    if(previous&&Number.isFinite(stamp)&&stamp-previous.stamp>=0&&stamp-previous.stamp<=DUPLICATE_WINDOW_MS){
      removeMovements.add(movement.id);removeItems.add(item.id);continue;
    }
    seen.set(key,{stamp,id:movement.id,itemId:item.id});
  }
  if(removeMovements.size){
    state.movimientos=(state.movimientos||[]).filter(m=>!removeMovements.has(m.id));
    plan.householdExpenses=(plan.householdExpenses||[]).filter(x=>!removeItems.has(x.id));
    for(const id of removeItems)delete map[id];
  }
  plan.householdDirectRepairVersion=1;
  return removeMovements.size;
}

export function ensureHousehold(){
  Base.ensureHousehold();const state=Data.getState(),plan=state.financialPlan,map=semantics();let changed=false;
  for(const item of plan.householdExpenses||[])if(!validKind(map[item.id])){map[item.id]=kindFromPriority(item.priority);changed=true;}
  if(Number(plan.householdSemanticsVersion||0)<1){plan.householdSemanticsVersion=1;changed=true;}
  if(migrateLegacyCommitments(plan,map))changed=true;
  const repaired=repairExactDirectDuplicates(state,map);
  if(repaired>0){Data.sanearDatos();}
  else if(changed||Number(plan.householdDirectRepairVersion||0)===1)Data.saveData();
  return (plan.householdExpenses||[]).map(decorate);
}
export function householdItems({activeOnly=false}={}){const items=ensureHousehold();return activeOnly?items.filter(x=>x.active!==false):items;}
export function householdById(id){return decorate(Base.householdById(id));}

function configForKind(config={}){
  const kind=validKind(config.kind)||kindFromPriority(config.priority),next={...config,priority:priorityFromKind(kind)};
  if(kind==='reserve'||kind==='spent')next.frequency='one_time';
  if(next.nextDueDate&&next.dueDay===undefined){const day=dayFromDate(next.nextDueDate);if(day)next.dueDay=day;}
  delete next.kind;delete next.allowDuplicate;return {kind,next};
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
  const kind=householdById(id)?.kind||'optional',item=Base.recordHouseholdExpense(id,amount,fecha);remember(id,kind);Data.sanearDatos();return decorate(item);
}

function recentDirectDuplicate({name,amount,date,now=Date.now()}={}){
  const map=semantics();return Base.householdItems().some(item=>{
    if(map[item.id]!=='spent'||!sameText(item.name,name)||!sameMoney(item.amount,amount)||String(item.nextDueDate||'').slice(0,10)!==date)return false;
    const created=new Date(item.createdAt||0).getTime();return Number.isFinite(created)&&now-created>=0&&now-created<=DUPLICATE_WINDOW_MS;
  });
}

export function recordDirectHouseholdExpense(config={}){
  const date=String(config.date||config.nextDueDate||new Date().toISOString().slice(0,10)).slice(0,10),name=String(config.name||'').trim(),amount=safeFloat(config.amount);
  if(config.allowDuplicate!==true&&recentDirectDuplicate({name,amount,date}))throw new Error('GASTO_HOGAR_DUPLICADO_RECIENTE');
  const localDate=`${date}T12:00:00`,item=Base.createHouseholdExpense({...config,frequency:'one_time',priority:'discretionary',nextDueDate:date});
  remember(item.id,'spent');Base.recordHouseholdExpense(item.id,config.amount,localDate);
  const movement=[...(Data.getState().movimientos||[])].reverse().find(m=>m.householdExpenseId===item.id);
  if(movement){movement.movementKind='household_direct';movement.recordedAt=new Date().toISOString();}
  Data.sanearDatos();return householdById(item.id);
}

export function recentDirectHouseholdExpenses(limit=8){
  const state=Data.getState(),map=semantics(),items=new Map(Base.householdItems().map(x=>[x.id,x]));
  return (state.movimientos||[]).filter(m=>m.tipo==='gasto'&&map[m.householdExpenseId]==='spent').map(m=>({
    item:decorate(items.get(m.householdExpenseId)),movement:m,amount:safeFloat(m.monto),date:m.fecha,recordedAt:m.recordedAt||items.get(m.householdExpenseId)?.createdAt||m.fecha
  })).filter(x=>x.item).sort((a,b)=>new Date(b.recordedAt)-new Date(a.recordedAt)).slice(0,Math.max(0,limit));
}

export function undoDirectHouseholdExpense(id){
  const state=Data.getState(),map=semantics(),item=Base.householdItems().find(x=>x.id===id);if(!item||map[id]!=='spent')throw new Error('GASTO_HOGAR_NO_ENCONTRADO');
  const before=(state.movimientos||[]).length;state.movimientos=(state.movimientos||[]).filter(m=>m.householdExpenseId!==id);
  state.financialPlan.householdExpenses=(state.financialPlan.householdExpenses||[]).filter(x=>x.id!==id);delete map[id];
  if(before===state.movimientos.length)throw new Error('GASTO_HOGAR_NO_ENCONTRADO');Data.sanearDatos();return true;
}

export function seedHouseholdFromLivingSetup(values={}){
  const items=Base.seedHouseholdFromLivingSetup(values);const map=semantics();
  for(const item of items)if(!validKind(map[item.id]))map[item.id]=kindFromPriority(item.priority);
  Data.saveData();return items.map(decorate);
}
