/* v2.7.1 - Metas de ahorro con dinero reservado, proyección y retiros conscientes. */
import { safeFloat, uuid } from './01_consts_utils.js';
import { getState, saveData } from './02_data.js';
import { resumenGlobal } from './04_charts.js';
import { financialPosition } from './21_financial_life_v27.js';

const PERSONAL_ACCOUNT_ID='acct-personal';
const DAY=86400000;
const MONTH_DAYS=30.4375;

const positive=(value,code='MONTO_META_INVALIDO')=>{const n=safeFloat(value);if(!(n>0))throw new Error(code);return n;};
const text=(value,code='NOMBRE_INVALIDO')=>{const v=String(value??'').trim();if(!v)throw new Error(code);return v;};
const normalizeDate=value=>{if(!value)return null;const d=new Date(`${String(value).slice(0,10)}T23:59:59`);return Number.isNaN(d.getTime())?null:d.toISOString();};

function normalizeGoal(g){return {
  id:g?.id||uuid(),name:String(g?.name||g?.desc||'Meta de ahorro').trim()||'Meta de ahorro',targetAmount:Math.max(0,safeFloat(g?.targetAmount??g?.meta)),
  targetDate:g?.targetDate||null,reserved:Math.max(0,safeFloat(g?.reserved??g?.acumulado)),priority:['low','normal','high'].includes(g?.priority)?g.priority:'normal',
  active:g?.active!==false,createdAt:g?.createdAt||new Date().toISOString(),completedAt:g?.completedAt||null,history:Array.isArray(g?.history)?g.history:[]
};}

function migrateLegacyGoals(state){
  const legacy=(state.gastosFijosMensuales||[]).filter(g=>g.categoria==='Ahorro'||g.categoria==='Meta');if(!legacy.length)return [];
  const goals=legacy.map(g=>{const envelope=(state.wallet?.sobres||[]).find(s=>s.refId===g.id);return normalizeGoal({id:g.id,name:g.desc,targetAmount:g.monto,reserved:envelope?.acumulado||0,priority:'normal',createdAt:g.creadaEn||new Date().toISOString()});});
  const ids=new Set(legacy.map(g=>g.id));state.gastosFijosMensuales=(state.gastosFijosMensuales||[]).filter(g=>!ids.has(g.id));if(Array.isArray(state.wallet?.sobres))state.wallet.sobres=state.wallet.sobres.filter(s=>!ids.has(s.refId));return goals;
}

export function ensureSavingsGoals(){const state=getState();let changed=false;if(!Array.isArray(state.savingsGoals)){state.savingsGoals=migrateLegacyGoals(state);changed=true;}else state.savingsGoals=state.savingsGoals.map(normalizeGoal);if(changed)saveData();return state.savingsGoals;}
export const getSavingsGoals=()=>ensureSavingsGoals();
export const getSavingsGoal=id=>ensureSavingsGoals().find(g=>g.id===id)||null;
export const totalReservedSavings=()=>ensureSavingsGoals().filter(g=>g.active!==false).reduce((sum,g)=>sum+safeFloat(g.reserved),0);

export function createSavingsGoal({name,targetAmount,targetDate,priority='normal'}={}){
  const goal={id:uuid(),name:text(name),targetAmount:positive(targetAmount),targetDate:normalizeDate(targetDate),reserved:0,priority:['low','normal','high'].includes(priority)?priority:'normal',active:true,createdAt:new Date().toISOString(),completedAt:null,history:[]};
  if(goal.targetDate&&new Date(goal.targetDate).getTime()<Date.now()-DAY)throw new Error('FECHA_META_INVALIDA');ensureSavingsGoals().push(goal);saveData();return goal;
}

function addGoalMovement(goal,{type,amount,sourceId=null,note=''}){
  const state=getState(),fecha=new Date().toISOString(),id=uuid();goal.history.push({id,fecha,type,amount,sourceId:sourceId||null,note:String(note||'').trim()});
  state.movimientos.push({id:`goal-${id}`,fecha,tipo:type==='reserve'?'gasto':'ingreso',desc:type==='reserve'?`Reserva · ${goal.name}`:`Liberación · ${goal.name}`,monto:amount,categoria:'Meta',sourceId:sourceId||null,fuente:sourceId||'meta',accountId:PERSONAL_ACCOUNT_ID,affectsPersonal:false,goalId:goal.id,goalTransfer:type});
}

export function contributeToSavingsGoal(goalId,amount,{sourceId=null,note=''}={}){
  const goal=getSavingsGoal(goalId);if(!goal)throw new Error('META_NO_ENCONTRADA');const m=positive(amount),remaining=Math.max(0,goal.targetAmount-goal.reserved),summary=resumenGlobal(getState());
  const reallyFree=Math.max(0,financialPosition().free),available=Math.max(0,Math.min(summary.disponible,reallyFree));if(remaining<=0)throw new Error('META_COMPLETA');if(m>remaining+0.0001)throw new Error('APORTE_SUPERA_META');if(m>available+0.0001)throw new Error('SALDO_DISPONIBLE_INSUFICIENTE');
  goal.reserved+=m;addGoalMovement(goal,{type:'reserve',amount:m,sourceId,note});if(goal.reserved>=goal.targetAmount)goal.completedAt=goal.completedAt||new Date().toISOString();saveData();return goal;
}
export function withdrawFromSavingsGoal(goalId,amount,{note=''}={}){const goal=getSavingsGoal(goalId);if(!goal)throw new Error('META_NO_ENCONTRADA');const m=positive(amount);if(m>goal.reserved+0.0001)throw new Error('RETIRO_SUPERA_RESERVA');goal.reserved=Math.max(0,goal.reserved-m);goal.completedAt=null;addGoalMovement(goal,{type:'release',amount:m,note});saveData();return goal;}

const monthStart=now=>new Date(now.getFullYear(),now.getMonth(),1);
const monthlySourceIncome=(state,now)=>{const start=monthStart(now);return (state.workSources||[]).filter(s=>s.active!==false&&s.status!=='paused'&&s.status!=='ended').map(source=>({id:source.id,name:source.name,kind:source.kind,income:(state.movimientos||[]).filter(m=>m.affectsPersonal!==false&&m.tipo==='ingreso'&&m.categoria!=='Sistema'&&m.sourceId===source.id&&new Date(m.fecha)>=start).reduce((a,m)=>a+safeFloat(m.monto),0)}));};

export function savingsGoalSummary(goalId,now=new Date()){
  const goal=getSavingsGoal(goalId);if(!goal)return null;const target=safeFloat(goal.targetAmount),reserved=safeFloat(goal.reserved),remaining=Math.max(0,target-reserved),deadline=goal.targetDate?new Date(goal.targetDate):null;
  const daysLeft=deadline?Math.max(0,Math.ceil((deadline-now)/DAY)):null,monthsLeft=daysLeft===null?null:Math.max(daysLeft/MONTH_DAYS,1/MONTH_DAYS),requiredMonthly=remaining<=0?0:monthsLeft?remaining/monthsLeft:remaining,requiredWeekly=requiredMonthly*12/52,progress=target>0?Math.min(100,(reserved/target)*100):0;
  return {goal,target,reserved,remaining,deadline,daysLeft,monthsLeft,requiredMonthly,requiredWeekly,progress,complete:remaining<=0,overdue:Boolean(deadline&&deadline<now&&remaining>0)};
}

export function savingsCapacity(goalId,now=new Date()){
  const state=getState(),summary=resumenGlobal(state),goal=savingsGoalSummary(goalId,now);if(!goal)return null;const sources=monthlySourceIncome(state,now),start=monthStart(now);
  /* El saldo inicial es patrimonio de partida, no capacidad mensual de ahorro. */
  const monthlyIncome=(state.movimientos||[]).filter(m=>m.affectsPersonal!==false&&m.tipo==='ingreso'&&m.categoria!=='Sistema'&&new Date(m.fecha)>=start).reduce((a,m)=>a+safeFloat(m.monto),0);
  const monthlyExpenses=(state.movimientos||[]).filter(m=>m.affectsPersonal!==false&&m.tipo==='gasto'&&new Date(m.fecha)>=start).reduce((a,m)=>a+safeFloat(m.monto),0),estimatedMonthlyCapacity=Math.max(0,monthlyIncome-monthlyExpenses),safetyBuffer=Math.max(0,safeFloat(state.parametros?.moraVencida)+safeFloat(state.parametros?.metaBase)*7),reallyFree=Math.max(0,financialPosition(now).free),safeFreeCash=Math.max(0,Math.min(summary.disponible,reallyFree)),suggestedNow=Math.min(goal.requiredMonthly||goal.remaining,safeFreeCash,goal.remaining);
  let pending=suggestedNow;const allocation=[...sources].sort((a,b)=>b.income-a.income).map(s=>{const suggested=Math.min(Math.max(0,s.income),pending);pending=Math.max(0,pending-suggested);return {...s,suggested};});
  return {goal,summary,sources:allocation,monthlyIncome,monthlyExpenses,estimatedMonthlyCapacity,safetyBuffer,safeFreeCash,suggestedNow,unassignedSuggestion:pending};
}

export function previewSavingsWithdrawal(goalId,amount,now=new Date()){
  const goal=getSavingsGoal(goalId);if(!goal)throw new Error('META_NO_ENCONTRADA');const m=positive(amount);if(m>goal.reserved+0.0001)throw new Error('RETIRO_SUPERA_RESERVA');
  const before=savingsGoalSummary(goalId,now),afterReserved=Math.max(0,before.reserved-m),afterRemaining=Math.max(0,before.target-afterReserved),monthsLeft=before.monthsLeft||1,afterRequiredMonthly=afterRemaining/monthsLeft,extraPerMonth=Math.max(0,afterRequiredMonthly-before.requiredMonthly),capacity=savingsCapacity(goalId,now),elapsedDays=Math.max(1,(now-new Date(goal.createdAt))/DAY),pacePerDay=before.reserved/elapsedDays,expectedDaysAtCurrentPace=pacePerDay>0?afterRemaining/pacePerDay:null,delayDays=expectedDaysAtCurrentPace!==null&&before.daysLeft!==null?Math.max(0,Math.ceil(expectedDaysAtCurrentPace-before.daysLeft)):null;
  return {before,amount:m,afterReserved,afterRemaining,afterRequiredMonthly,extraPerMonth,delayDays,estimatedMonthlyCapacity:capacity?.estimatedMonthlyCapacity||0,recoveryLikely:(capacity?.estimatedMonthlyCapacity||0)>=afterRequiredMonthly};
}
