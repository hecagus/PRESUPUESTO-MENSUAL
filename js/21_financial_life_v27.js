/* v3.0.0 - Núcleo financiero canónico: Hogar es la única fuente para costo de vida; legado queda sólo para compatibilidad. */
import { safeFloat } from './01_consts_utils.js';
import { getState, saveData } from './02_data.js';
import * as Base from './13_financial_life.js';
import {
  ensureHousehold,householdUpcomingEvents,householdCommittedRemaining,householdReserveNeed,
  householdBudgetStatus,seedHouseholdFromLivingSetup
} from './23_home_semantics.js';

const RETIRED_CORE_COMMITMENTS=new Set(['life-housing','life-services']);
const monthDay=value=>String(value||'').slice(0,10);

export const setSourceStatus=Base.setSourceStatus;
export const updateSourceLife=Base.updateSourceLife;
export const publicTransportDailyCost=Base.publicTransportDailyCost;
export const publicTransportMonthlyCost=Base.publicTransportMonthlyCost;
export const setLivingBudgets=Base.setLivingBudgets; // compatibilidad de backups viejos
export const upsertCoreCommitment=Base.upsertCoreCommitment; // compatibilidad de backups viejos
export const createCommitment=Base.createCommitment;
export const setCommitmentActive=Base.setCommitmentActive;
export const payCommitment=Base.payCommitment;
export const workTransportCommitment=Base.workTransportCommitment;
export const sourceCostProfile=Base.sourceCostProfile;
export const livingBudgetStatus=householdBudgetStatus;

function retireLegacyLivingState(){
  const state=getState(),plan=state.financialPlan||{};let changed=false;
  plan.livingBudgets=plan.livingBudgets&&typeof plan.livingBudgets==='object'?plan.livingBudgets:{};
  for(const key of ['groceries','health','leisure','other']){
    if(safeFloat(plan.livingBudgets[key])!==0){plan.livingBudgets[key]=0;changed=true;}
  }
  if(Array.isArray(plan.commitments))for(const c of plan.commitments){
    if(RETIRED_CORE_COMMITMENTS.has(c.id)&&c.active!==false){c.active=false;changed=true;}
  }
  if(plan.canonicalFinanceVersion!==3){plan.canonicalFinanceVersion=3;changed=true;}
  if(changed){state.financialPlan=plan;saveData();}
}

export function ensureFinancialLife(){
  Base.ensureFinancialLife();
  ensureHousehold();
  retireLegacyLivingState();
  return getState().financialPlan;
}

export function configureLivingSetup(values={}){
  ensureFinancialLife();
  seedHouseholdFromLivingSetup(values);
  retireLegacyLivingState();
  return getState().financialPlan;
}

function isRetiredLegacyEvent(event){
  const id=String(event?.id||'');
  if(id.startsWith('fixed-'))return true; // gastosFijosMensuales ya no es un motor activo
  if(RETIRED_CORE_COMMITMENTS.has(event?.refId))return true;
  return false;
}

function eventKey(event){
  return [event.type||'',event.refId||event.id||'',monthDay(event.dueDate||event.date),safeFloat(event.amount)].join('|');
}

export function upcomingFinancialEvents({days=45,now=new Date()}={}){
  ensureFinancialLife();
  const base=Base.upcomingFinancialEvents({days,now}).filter(e=>!isRetiredLegacyEvent(e));
  const home=householdUpcomingEvents({days,now});
  const byKey=new Map();
  /* Base primero y Hogar después: si alguna migración vieja representa el mismo evento, gana Hogar. */
  for(const event of [...base,...home])byKey.set(eventKey(event),event);
  return [...byKey.values()].sort((a,b)=>new Date(a.date)-new Date(b.date));
}

function personalCash(state){
  return (state.movimientos||[]).reduce((sum,m)=>{
    if(m.affectsPersonal===false)return sum;
    if(m.tipo==='ingreso')return sum+safeFloat(m.monto);
    if(m.tipo==='gasto')return sum-safeFloat(m.monto);
    return sum;
  },0);
}

function reservedSavings(state){
  if(Array.isArray(state.savingsGoals)&&state.savingsGoals.length){
    return state.savingsGoals.filter(g=>g.active!==false).reduce((a,g)=>a+safeFloat(g.reserved),0);
  }
  return (state.wallet?.sobres||[]).filter(s=>s.categoria==='Ahorro'||s.categoria==='Meta').reduce((a,s)=>a+safeFloat(s.acumulado),0);
}

export function financialPosition(now=new Date()){
  ensureFinancialLife();
  const state=getState(),cash=personalCash(state),reserved=reservedSavings(state);
  const events=upcomingFinancialEvents({days:30,now});
  const payable=events.filter(e=>['expense','debt'].includes(e.type)&&safeFloat(e.amount)>0);
  const due=payable.reduce((a,e)=>a+safeFloat(e.amount),0);
  const homeDue=payable.filter(e=>e.household).reduce((a,e)=>a+safeFloat(e.amount),0);
  const homeBudget=householdCommittedRemaining(now);
  const homeReserve=householdReserveNeed(now).total;
  const workTransport=Base.workTransportCommitment(now);
  const living=homeBudget+homeReserve;
  const committed=due+living+workTransport;
  return {cash,reserved,due,homeDue,homeBudget,homeReserve,living,workTransport,committed,free:cash-reserved-committed};
}
