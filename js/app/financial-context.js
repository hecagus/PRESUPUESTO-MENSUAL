/* Shared read model over the existing canonical engines; no parallel ledger. */
import {getState} from '../02_data.js';
import {financialPosition,publicTransportMonthlyCost} from '../21_financial_life_v27.js';
import {householdSummary} from '../23_home_semantics.js';
import {cashFlowForecast} from '../16_forecast_engine.js';
import {financialScenario} from './financial-options.js';
import {monthlyAmount,monthlyIncomeProjection,observedTotals,isPersonalMovement,inObservedPeriod,MONTH_DAYS,debtOutstanding,paymentDueBreakdown,horizonEnd} from '../domain/financial-rules.js';

function monthlyFinancialPlan(state,now,scenario){
  const home=householdSummary(now),projection=monthlyIncomeProjection(state,now,scenario),observed=observedTotals(state,now);
  const commitments=(state.financialPlan?.commitments||[]).filter(c=>c.active!==false).reduce((sum,c)=>sum+monthlyAmount(c.amount,c.frequency,now),0);
  const operating=(state.financialPlan?.operatingObligations||[]).filter(c=>c.active!==false).reduce((sum,c)=>sum+monthlyAmount(c.amount,c.frequency,now),0);
  const transport=(state.workSources||[]).filter(s=>s.active!==false&&!['paused','ended'].includes(s.status)).reduce((sum,s)=>sum+publicTransportMonthlyCost(s),0);
  const debt=(state.deudas||[]).filter(d=>debtOutstanding(state,d,now)>0).reduce((sum,d)=>sum+monthlyAmount(Math.min(Number(d.montoCuota)||0,debtOutstanding(state,d,now)),d.frecuencia,now),0);
  const essential=home.mandatory+home.budgeted+commitments+operating+transport;
  const items=new Map((state.financialPlan?.householdExpenses||[]).map(item=>[item.id,item]));
  const extra=(state.movimientos||[]).filter(m=>{
    if(m.tipo!=='gasto'||!isPersonalMovement(state,m)||!inObservedPeriod(m.fecha,observed.start,now)||m.commitmentId||m.operatingObligationId||m.debtId)return false;
    if(m.householdExpenseId){
      const item=items.get(m.householdExpenseId),kind=state.financialPlan?.householdKinds?.[m.householdExpenseId];
      // A scheduled or budgeted expense already has a monthly provision. Count only
      // direct purchases and optional consumption as additional observed spending.
      return kind==='spent'||kind==='optional'||!kind&&['optional','discretionary'].includes(item?.priority);
    }
    return !(m.categoria==='Transporte'&&(state.workSources||[]).some(s=>s.id===m.sourceId&&s.transport?.mode==='public'));
  }).reduce((sum,m)=>sum+(Number(m.monto)||0),0);
  const additional=observed.sufficientlyObserved?extra/observed.observedDays*MONTH_DAYS:0;
  return {projection,observed,essential,debt,additional,additionalObserved:extra,outflow:essential+debt+additional,income:projection.total};
}

export function financialContext({now=new Date(),...options}={}){
  const scenario=financialScenario(options),position=financialPosition(now),forecast=cashFlowForecast({now,...scenario});
  const monthly=monthlyFinancialPlan(getState(),now,scenario);
  return {now,scenario,position,forecast,monthly,
    savingsAvailableNow:position.savingsAvailableNow,
    planning:{days:scenario.days,until:horizonEnd(now,scenario.days).toISOString(),...paymentDueBreakdown(forecast.events,now),
      expectedIncome:forecast.totalExpectedIncome,expectedOutflow:forecast.totalExpectedOutflow,
      endingCash:forecast.endingCash,endingFree:forecast.endingFree,protected:forecast.ongoingReserve}};
}
