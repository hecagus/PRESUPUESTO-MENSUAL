/* v2.7.1 - Metas de ahorro con dinero reservado, proyección y retiros conscientes. */
import { safeFloat, uuid } from './01_consts_utils.js';
import { getState, saveData } from './02_data.js';
import { resumenGlobal } from './04_charts.js';
import { financialPosition } from './21_financial_life_v27.js';
import { financialScenario } from './app/financial-options.js';
import { inObservedPeriod, isPersonalMovement, goalReserved, reservedSavings, monthlyIncomeProjection, observedTotals } from './domain/financial-rules.js';

const PERSONAL_ACCOUNT_ID='acct-personal';
const DAY=86400000;
const MONTH_DAYS=30.4375;

const positive=(value,code='MONTO_META_INVALIDO')=>{const n=safeFloat(value);if(!(n>0))throw new Error(code);return n;};
const text=(value,code='NOMBRE_INVALIDO')=>{const v=String(value??'').trim();if(!v)throw new Error(code);return v;};
const normalizeDate=value=>{if(!value)return null;const d=new Date(`${String(value).slice(0,10)}T23:59:59`);return Number.isNaN(d.getTime())?null:d.toISOString();};

function normalizeGoal(g){return {
  ...g,
  id:g?.id||uuid(),name:String(g?.name||g?.desc||'Meta de ahorro').trim()||'Meta de ahorro',targetAmount:Math.max(0,safeFloat(g?.targetAmount??g?.meta)),
  targetDate:g?.targetDate||null,reserved:Math.max(0,safeFloat(g?.reserved??g?.acumulado)),priority:['low','normal','high'].includes(g?.priority)?g.priority:'normal',
  active:g?.active!==false,createdAt:g?.createdAt||new Date().toISOString(),completedAt:g?.completedAt||null,history:Array.isArray(g?.history)?g.history:[]
};}

function migrateLegacyGoals(state){
  const legacy=(state.gastosFijosMensuales||[]).filter(g=>g.categoria==='Ahorro'||g.categoria==='Meta');if(!legacy.length)return [];
  // Keep the legacy records for old backups. Only positively identified envelope transfers
  // are excluded from cash by the shared read model; the original ledger is unchanged.
  return legacy.map(g=>{
    const envelope=(state.wallet?.sobres||[]).find(s=>s.refId===g.id);
    const matches=legacy.filter(x=>x.desc===g.desc);
    const transfers=matches.length===1?(state.movimientos||[]).filter(m=>m.tipo==='gasto'&&m.categoria==='Ahorro'&&m.desc===`Abono: ${g.desc}`):[];
    return normalizeGoal({id:g.id,legacyGoalId:g.id,legacyReservationMovementIds:transfers.map(m=>m.id),name:g.desc,targetAmount:g.monto,reserved:envelope?.acumulado||0,priority:'normal',createdAt:g.creadaEn||new Date().toISOString(),history:transfers.map(m=>({id:m.id,fecha:m.fecha,type:'reserve',amount:m.monto}))});
  });
}

export function ensureSavingsGoals(){
  const state=getState();let changed=false;
  if(!Array.isArray(state.savingsGoals)){state.savingsGoals=[];changed=true;}else state.savingsGoals=state.savingsGoals.map(normalizeGoal);
  for(const goal of migrateLegacyGoals(state))if(!state.savingsGoals.some(g=>g.id===goal.id)){state.savingsGoals.push(goal);changed=true;}
  if(changed)saveData();return state.savingsGoals;
}
export const getSavingsGoals=()=>ensureSavingsGoals();
export const getSavingsGoal=id=>ensureSavingsGoals().find(g=>g.id===id)||null;
export const totalReservedSavings=(now=new Date())=>{ensureSavingsGoals();return reservedSavings(getState(),now);};

export function createSavingsGoal({name,targetAmount,targetDate,priority='normal'}={}){
  const goal={id:uuid(),name:text(name),targetAmount:positive(targetAmount),targetDate:normalizeDate(targetDate),reserved:0,priority:['low','normal','high'].includes(priority)?priority:'normal',active:true,createdAt:new Date().toISOString(),completedAt:null,history:[]};
  if(goal.targetDate&&new Date(goal.targetDate).getTime()<Date.now()-DAY)throw new Error('FECHA_META_INVALIDA');ensureSavingsGoals().push(goal);saveData();return goal;
}

function addGoalMovement(goal,{type,amount,sourceId=null,note='',operationId=null}){
  const state=getState(),fecha=new Date().toISOString(),id=operationId?`reservation-${encodeURIComponent(operationId)}`:uuid();goal.history.push({id,fecha,type,amount,sourceId:sourceId||null,note:String(note||'').trim(),...(operationId?{operationId}:{})});
  state.movimientos.push({id:`goal-${id}`,fecha,tipo:type==='reserve'?'gasto':'ingreso',desc:type==='reserve'?`Reserva · ${goal.name}`:`Liberación · ${goal.name}`,monto:amount,categoria:'Meta',sourceId:sourceId||null,fuente:sourceId||'meta',accountId:PERSONAL_ACCOUNT_ID,affectsPersonal:false,goalId:goal.id,goalTransfer:type});
}

export function contributeToSavingsGoal(goalId,amount,{sourceId=null,note='',operationId=null}={}){
  const existing=operationId&&(getState().savingsGoals||[]).flatMap(g=>(g.history||[]).map(h=>({...h,goalId:g.id}))).find(h=>h.operationId===operationId);
  if(existing){if(existing.goalId!==goalId||existing.amount!==safeFloat(amount))throw new Error('OPERACION_INCOMPATIBLE');return getSavingsGoal(goalId);}
  const goal=getSavingsGoal(goalId);if(!goal)throw new Error('META_NO_ENCONTRADA');const m=positive(amount),remaining=Math.max(0,goal.targetAmount-goal.reserved);
  const available=financialPosition().savingsAvailableNow;if(remaining<=0)throw new Error('META_COMPLETA');if(m>remaining+0.0001)throw new Error('APORTE_SUPERA_META');if(m>available+0.0001)throw new Error('SALDO_DISPONIBLE_INSUFICIENTE');
  goal.reserved+=m;addGoalMovement(goal,{type:'reserve',amount:m,sourceId,note,operationId});if(goal.reserved>=goal.targetAmount)goal.completedAt=goal.completedAt||new Date().toISOString();saveData();return goal;
}
export function withdrawFromSavingsGoal(goalId,amount,{note=''}={}){const goal=getSavingsGoal(goalId);if(!goal)throw new Error('META_NO_ENCONTRADA');const m=positive(amount);if(m>goal.reserved+0.0001)throw new Error('RETIRO_SUPERA_RESERVA');goal.reserved=Math.max(0,goal.reserved-m);goal.completedAt=null;addGoalMovement(goal,{type:'release',amount:m,note});saveData();return goal;}

const monthStart=now=>new Date(now.getFullYear(),now.getMonth(),1);
const monthlySourceIncome=(state,now)=>{const start=monthStart(now);return (state.workSources||[]).filter(s=>s.active!==false&&s.status!=='paused'&&s.status!=='ended').map(source=>({id:source.id,name:source.name,kind:source.kind,income:(state.movimientos||[]).filter(m=>isPersonalMovement(state,m)&&m.tipo==='ingreso'&&m.categoria!=='Sistema'&&m.sourceId===source.id&&inObservedPeriod(m.fecha,start,now)).reduce((a,m)=>a+safeFloat(m.monto),0)}));};

export function savingsGoalSummary(goalId,now=new Date()){
  const goal=getSavingsGoal(goalId);if(!goal)return null;const target=safeFloat(goal.targetAmount),reserved=goalReserved(goal,now),remaining=Math.max(0,target-reserved),deadline=goal.targetDate?new Date(goal.targetDate):null;
  const daysLeft=deadline?Math.max(0,Math.ceil((deadline-now)/DAY)):null,monthsLeft=daysLeft===null?null:Math.max(daysLeft/MONTH_DAYS,1/MONTH_DAYS),requiredMonthly=remaining<=0?0:monthsLeft?remaining/monthsLeft:remaining,requiredWeekly=requiredMonthly*12/52,progress=target>0?Math.min(100,(reserved/target)*100):0;
  return {goal,target,reserved,remaining,deadline,daysLeft,monthsLeft,requiredMonthly,requiredWeekly,progress,complete:remaining<=0,overdue:Boolean(deadline&&deadline<now&&remaining>0)};
}

export function savingsCapacity(goalId,now=new Date()){
  const state=getState(),summary=resumenGlobal(state,now),goal=savingsGoalSummary(goalId,now);if(!goal)return null;const sources=monthlySourceIncome(state,now),start=monthStart(now);
  /* El saldo inicial es patrimonio de partida, no capacidad mensual de ahorro. */
  const monthlyIncome=(state.movimientos||[]).filter(m=>isPersonalMovement(state,m)&&m.tipo==='ingreso'&&m.categoria!=='Sistema'&&inObservedPeriod(m.fecha,start,now)).reduce((a,m)=>a+safeFloat(m.monto),0);
  const monthlyExpenses=(state.movimientos||[]).filter(m=>isPersonalMovement(state,m)&&m.tipo==='gasto'&&inObservedPeriod(m.fecha,start,now)).reduce((a,m)=>a+safeFloat(m.monto),0),estimatedMonthlyCapacity=Math.max(0,monthlyIncome-monthlyExpenses),incomeProjection=monthlyIncomeProjection(state,now,financialScenario()),observed=observedTotals(state,now),position=financialPosition(now),safetyBuffer=position.planningReserve,safeFreeCash=position.savingsAvailableNow,suggestedNow=Math.min(goal.requiredMonthly||goal.remaining,safeFreeCash,goal.remaining);
  let pending=suggestedNow;const allocation=[...sources].sort((a,b)=>b.income-a.income).map(s=>{const suggested=Math.min(Math.max(0,s.income),pending);pending=Math.max(0,pending-suggested);return {...s,suggested};});
  return {goal,summary,sources:allocation,monthlyIncome,monthlyExpenses,incomeProjection,observed,capacityBasis:'actual_month_to_date',estimatedMonthlyCapacity,safetyBuffer,safeFreeCash,suggestedNow,unassignedSuggestion:pending};
}

export function previewSavingsWithdrawal(goalId,amount,now=new Date()){
  const goal=getSavingsGoal(goalId);if(!goal)throw new Error('META_NO_ENCONTRADA');const m=positive(amount);if(m>goal.reserved+0.0001)throw new Error('RETIRO_SUPERA_RESERVA');
  const before=savingsGoalSummary(goalId,now),afterReserved=Math.max(0,before.reserved-m),afterRemaining=Math.max(0,before.target-afterReserved),monthsLeft=before.monthsLeft||1,afterRequiredMonthly=afterRemaining/monthsLeft,extraPerMonth=Math.max(0,afterRequiredMonthly-before.requiredMonthly),capacity=savingsCapacity(goalId,now),elapsedDays=Math.max(1,(now-new Date(goal.createdAt))/DAY),pacePerDay=before.reserved/elapsedDays,expectedDaysAtCurrentPace=pacePerDay>0?afterRemaining/pacePerDay:null,delayDays=expectedDaysAtCurrentPace!==null&&before.daysLeft!==null?Math.max(0,Math.ceil(expectedDaysAtCurrentPace-before.daysLeft)):null;
  return {before,amount:m,afterReserved,afterRemaining,afterRequiredMonthly,extraPerMonth,delayDays,estimatedMonthlyCapacity:capacity?.estimatedMonthlyCapacity||0,recoveryLikely:(capacity?.estimatedMonthlyCapacity||0)>=afterRequiredMonthly};
}
