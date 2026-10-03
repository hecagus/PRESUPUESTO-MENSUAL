/* v3.0.0 - Núcleo financiero canónico: Hogar es la única fuente para costo de vida; legado queda sólo para compatibilidad. */
import { safeFloat } from './01_consts_utils.js';
import { getState, saveData } from './02_data.js';
import * as Base from './13_financial_life.js';
import { personalCash, reservedSavings, paymentDueBreakdown, horizonEnd } from './domain/financial-rules.js';
import { operatingObligations, operatingUpcomingEvents } from './domain/operating-costs.js';
import {
  ensureHousehold,householdUpcomingEvents,householdCommittedRemaining,householdReserveNeed,
  householdBudgetStatus,seedHouseholdFromLivingSetup
} from './23_home_semantics.js';

const RETIRED_CORE_COMMITMENTS=new Set(['life-housing','life-services']);
const PLANNING_DAYS=30;
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
  const plan=getState().financialPlan;
  if(typeof plan.forecastPreferences?.includeVariable!=='boolean'){
    let includeVariable=false;try{includeVariable=globalThis.localStorage?.getItem('forecast_include_variable')==='true';}catch{}
    plan.forecastPreferences={...plan.forecastPreferences,includeVariable};saveData();
  }
  ensureHousehold();
  operatingObligations();
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
  const operating=operatingUpcomingEvents({days,now});
  const byKey=new Map();
  /* Base primero y Hogar después: si alguna migración vieja representa el mismo evento, gana Hogar. */
  for(const event of [...base,...home,...operating])byKey.set(eventKey(event),event);
  return [...byKey.values()].sort((a,b)=>new Date(a.date)-new Date(b.date));
}


export function financialPosition(now=new Date()){
  ensureFinancialLife();
  const state=getState(),cash=personalCash(state,now),reserved=reservedSavings(state,now);
  const events=upcomingFinancialEvents({days:PLANNING_DAYS,now});
  const payable=events.filter(e=>['expense','debt'].includes(e.type)&&safeFloat(e.amount)>0);
  const timing=paymentDueBreakdown(payable,now);
  const due=payable.reduce((a,e)=>a+safeFloat(e.amount),0);
  const homeDue=payable.filter(e=>e.household).reduce((a,e)=>a+safeFloat(e.amount),0);
  const homeBudget=householdCommittedRemaining(now);
  const homeReserve=householdReserveNeed(now).total;
  const workTransport=Base.workTransportCommitment(now);
  const living=homeBudget+homeReserve;
  const committed=due+living+workTransport;
  // Keep the cash-only planning figure as a legacy adapter, not an authorization
  // to spend or save today. Explicit budgets/reserves stay protected separately.
  const availableToday=cash-reserved-timing.dueNow;
  const planningReserve=living+workTransport;
  return {cash,reserved,due,homeDue,homeBudget,homeReserve,living,workTransport,committed,free:cash-reserved-committed,
    cashOnlyPlanFree:cash-reserved-committed,...timing,availableToday,planningReserve,
    savingsAvailableNow:Math.max(0,availableToday-planningReserve),
    planningDays:PLANNING_DAYS,planningUntil:horizonEnd(now,PLANNING_DAYS).toISOString()};
}
