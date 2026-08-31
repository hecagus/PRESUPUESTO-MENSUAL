/* v2.8.0 - Adaptador financiero que integra Hogar con el motor v2.x. */
import * as Base from './13_financial_life.js';
import {
  ensureHousehold,householdUpcomingEvents,householdCommittedRemaining,householdReserveNeed,seedHouseholdFromLivingSetup
} from './23_home_semantics.js';

export const setSourceStatus=Base.setSourceStatus;
export const updateSourceLife=Base.updateSourceLife;
export const publicTransportDailyCost=Base.publicTransportDailyCost;
export const publicTransportMonthlyCost=Base.publicTransportMonthlyCost;
export const setLivingBudgets=Base.setLivingBudgets;
export const upsertCoreCommitment=Base.upsertCoreCommitment;
export const createCommitment=Base.createCommitment;
export const setCommitmentActive=Base.setCommitmentActive;
export const payCommitment=Base.payCommitment;
export const livingBudgetStatus=Base.livingBudgetStatus;
export const workTransportCommitment=Base.workTransportCommitment;
export const sourceCostProfile=Base.sourceCostProfile;

export function ensureFinancialLife(){const plan=Base.ensureFinancialLife();ensureHousehold();return plan;}

export function configureLivingSetup(values={}){
  Base.ensureFinancialLife();ensureHousehold();seedHouseholdFromLivingSetup(values);return Base.ensureFinancialLife();
}

export function upcomingFinancialEvents({days=45,now=new Date()}={}){
  ensureHousehold();
  const all=[...Base.upcomingFinancialEvents({days,now}),...householdUpcomingEvents({days,now})];
  return all.sort((a,b)=>new Date(a.date)-new Date(b.date));
}

export function financialPosition(now=new Date()){
  ensureHousehold();
  const base=Base.financialPosition(now),homeBudget=householdCommittedRemaining(now),homeReserve=householdReserveNeed(now).total;
  const homeDue=householdUpcomingEvents({days:30,now}).reduce((a,e)=>a+Number(e.amount||0),0);
  const committed=base.committed+homeBudget+homeReserve+homeDue;
  return {...base,homeBudget,homeReserve,homeDue,committed,free:base.cash-base.reserved-committed,living:base.living+homeBudget+homeReserve};
}
