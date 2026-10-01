/* v3.0.0 - Salud financiera explicable y planeación inteligente sobre el núcleo canónico. */
import { safeFloat } from './01_consts_utils.js';
import { getState } from './02_data.js';
import { financialPosition, publicTransportMonthlyCost } from './21_financial_life_v27.js';
import { householdSummary } from './23_home_semantics.js';
import { savingsGoalSummary } from './11_savings_goals.js';
import { cashFlowForecast } from './16_forecast_engine.js';
import { monthlyAmount, monthlyIncomeProjection, observedTotals, inObservedPeriod, isPersonalMovement, MONTH_DAYS, debtOutstanding } from './domain/financial-rules.js';

const DAY=86400000;
const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
function monthlyDebtLoad(state,now){return (state.deudas||[]).filter(d=>debtOutstanding(state,d,now)>0).reduce((sum,d)=>sum+monthlyAmount(Math.min(safeFloat(d.montoCuota),debtOutstanding(state,d,now)),d.frecuencia,now),0);}
function essentialMonthly(state,now=new Date()){
  const commitments=(state.financialPlan?.commitments||[]).filter(c=>c.active!==false).reduce((a,c)=>a+monthlyAmount(c.amount,c.frequency,now),0);
  const home=householdSummary(now),living=home.mandatory+home.budgeted;
  const operating=(state.financialPlan?.operatingObligations||[]).filter(c=>c.active!==false).reduce((a,c)=>a+monthlyAmount(c.amount,c.frequency,now),0);
  const transport=(state.workSources||[]).filter(s=>s.active!==false&&s.status!=='ended'&&s.status!=='paused').reduce((a,s)=>a+publicTransportMonthlyCost(s),0);
  return commitments+living+operating+transport;
}
function recentSavings(now=new Date()){
  const state=getState(),cutoff=new Date(now.getTime()-90*DAY);
  return (state.savingsGoals||[]).flatMap(g=>g.history||[]).filter(h=>inObservedPeriod(h.fecha,cutoff,now)).reduce((a,h)=>a+(h.type==='reserve'?safeFloat(h.amount):h.type==='release'?-safeFloat(h.amount):0),0);
}

export function financialHealth(now=new Date(),{includeVariable=false}={}){
  const state=getState(),position=financialPosition(now),recent=observedTotals(state,now),projection=monthlyIncomeProjection(state,now,{includeVariable}),debtLoad=monthlyDebtLoad(state,now),essential=essentialMonthly(state,now),netSaved=recentSavings(now);
  const income=Math.max(0,projection.total),cash=Math.max(0,position.cash),free=Math.max(0,position.free);
  const liquidityRatio=cash>0?free/cash:0,commitmentRatio=income>0?essential/income:null,savingsRate=recent.income>0?Math.max(0,netSaved)/recent.income:null,debtRatio=income>0?debtLoad/income:null;
  const liquidityScore=clamp((liquidityRatio/0.30)*25,0,25),commitmentsScore=commitmentRatio===null?null:clamp(((1.20-commitmentRatio)/0.70)*25,0,25),savingsScore=savingsRate===null?null:clamp((savingsRate/0.20)*25,0,25),debtScore=debtRatio===null?null:clamp(((0.50-debtRatio)/0.40)*25,0,25);
  const measured=[liquidityScore,commitmentsScore,savingsScore,debtScore].filter(n=>n!==null),score=Math.round(measured.reduce((a,n)=>a+n,0)/measured.length*4);
  const breakdown=[
    {key:'liquidity',label:'Liquidez',score:Math.round(liquidityScore),max:25,value:liquidityRatio,detail:`${Math.round(liquidityRatio*100)}% de tu efectivo queda realmente libre.`},
    {key:'commitments',label:'Carga fija',score:commitmentsScore===null?null:Math.round(commitmentsScore),max:25,value:commitmentRatio,detail:income>0?`Hogar, compromisos y costos operativos recurrentes equivalen a ${Math.round(commitmentRatio*100)}% del ingreso mensual proyectado${includeVariable?' (incluye estimación variable)':''}.`:'Aún no hay ingresos suficientes para proyectar esta relación; no se asigna una carga ficticia.'},
    {key:'savings',label:'Ahorro',score:savingsScore===null?null:Math.round(savingsScore),max:25,value:savingsRate,detail:savingsRate!==null?`Has reservado, descontando liberaciones, ${Math.round(savingsRate*100)}% del ingreso realmente cobrado en el período observado.`:'Aún no hay suficiente historial para calcular tasa de ahorro.'},
    {key:'debt',label:'Deuda',score:debtScore===null?null:Math.round(debtScore),max:25,value:debtRatio,detail:income>0?`Las cuotas mensuales normalizadas representan cerca de ${Math.round(debtRatio*100)}% del ingreso mensual proyectado.`:'No hay ingreso suficiente para proyectar la carga de deuda.'}
  ];
  let status='estable';if(score<40)status='frágil';else if(score<65)status='en ajuste';else if(score>=85)status='fuerte';
  const forecast=cashFlowForecast({days:45,now,includeVariable});
  const extraExpenses=(state.movimientos||[]).filter(m=>m.tipo==='gasto'&&isPersonalMovement(state,m)&&!m.householdExpenseId&&!m.commitmentId&&!m.operatingObligationId&&!m.debtId&&inObservedPeriod(m.fecha,recent.start,now)&&!(m.categoria==='Transporte'&&(state.workSources||[]).some(s=>s.id===m.sourceId&&s.transport?.mode==='public'))).reduce((a,m)=>a+safeFloat(m.monto),0);
  const additionalMonthly=recent.sufficientlyObserved?extraExpenses/recent.observedDays*MONTH_DAYS:0;
  return {score,status,breakdown,monthlyIncome:income,monthlyExpense:recent.monthlyExpense,essentialMonthly:essential,debtLoad,
    savedMonthly:recent.sufficientlyObserved?netSaved/recent.observedDays*MONTH_DAYS:null,position,forecast,projection,observed:recent,
    ingresoRealPeriodo:recent.income,ingresoMensualProyectado:income,ingresoVariableEstimado:projection.variable,
    planningOutflow:essential+debtLoad+additionalMonthly,incomplete:measured.length<4||projection.insufficientSources.length>0};
}

function sourceIncome30(now=new Date()){
  const state=getState(),cutoff=new Date(now.getTime()-30*DAY);
  return (state.workSources||[]).filter(s=>s.active!==false&&s.status!=='ended'&&s.status!=='paused').map(source=>({id:source.id,name:source.name,income:(state.movimientos||[]).filter(m=>m.tipo==='ingreso'&&m.categoria!=='Sistema'&&isPersonalMovement(state,m)&&m.sourceId===source.id&&inObservedPeriod(m.fecha,cutoff,now)).reduce((a,m)=>a+safeFloat(m.monto),0)})).sort((a,b)=>b.income-a.income);
}
export function smartGoalPlan(goalId,now=new Date()){
  const state=getState(),summary=savingsGoalSummary(goalId,now);if(!summary)return null;const health=financialHealth(now),position=health.position,remaining=summary.remaining;
  if(summary.complete)return {goal:summary.goal,status:'complete',summary,requiredMonthly:0,availableMonthly:0,suggestedNow:0,estimatedCompletionDate:summary.goal.completedAt||now.toISOString(),sourcePlan:[]};
  const availableMonthly=Math.max(0,health.monthlyIncome-health.planningOutflow),suggestedNow=Math.min(remaining,Math.max(0,position.free),summary.requiredMonthly||remaining);
  let status='blocked';if(availableMonthly>=summary.requiredMonthly&&summary.requiredMonthly>0)status='on_track';else if(availableMonthly>0||suggestedNow>0)status='at_risk';
  const monthsNeeded=availableMonthly>0?Math.max(0,remaining-suggestedNow)/availableMonthly:null,estimatedCompletionDate=suggestedNow>=remaining?now.toISOString():monthsNeeded!==null?new Date(now.getTime()+monthsNeeded*MONTH_DAYS*DAY).toISOString():null;
  let pending=suggestedNow;const sourcePlan=sourceIncome30(now).map(s=>{const take=Math.min(s.income,pending);pending=Math.max(0,pending-take);return {...s,suggested:take};});
  return {goal:summary.goal,status,summary,requiredMonthly:summary.requiredMonthly,availableMonthly,suggestedNow,estimatedCompletionDate,sourcePlan,forecast:cashFlowForecast({days:45,now})};
}
export function goalPortfolioPlan(now=new Date()){
  const state=getState(),rank={high:0,normal:1,low:2};
  const plans=(state.savingsGoals||[]).filter(g=>g.active!==false).map(g=>smartGoalPlan(g.id,now)).filter(Boolean).sort((a,b)=>(rank[a.goal.priority]??1)-(rank[b.goal.priority]??1));
  const health=financialHealth(now);
  let cash=Math.max(0,health.position.free),monthly=Math.max(0,health.monthlyIncome-health.planningOutflow);
  for(const plan of plans){
    plan.suggestedNow=Math.min(plan.suggestedNow,cash);cash-=plan.suggestedNow;
    plan.availableMonthly=Math.min(monthly,plan.requiredMonthly);monthly-=plan.availableMonthly;
    let allocation=plan.suggestedNow;for(const source of plan.sourcePlan){source.suggested=Math.min(source.income,allocation);allocation-=source.suggested;}
    if(plan.status!=='complete')plan.status=plan.availableMonthly>=plan.requiredMonthly&&plan.requiredMonthly>0?'on_track':plan.availableMonthly>0||plan.suggestedNow>0?'at_risk':'blocked';
    if(plan.status!=='complete')plan.estimatedCompletionDate=plan.suggestedNow>=plan.summary.remaining?now.toISOString():plan.availableMonthly>0?new Date(now.getTime()+(plan.summary.remaining-plan.suggestedNow)/plan.availableMonthly*MONTH_DAYS*DAY).toISOString():null;
  }
  return plans;
}
