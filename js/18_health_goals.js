/* v2.7.1 - Salud financiera explicable y planeación inteligente de metas. */
import { safeFloat } from './01_consts_utils.js';
import { getState } from './02_data.js';
import { financialPosition, publicTransportMonthlyCost } from './21_financial_life_v27.js';
import { householdSummary } from './20_home_engine.js';
import { savingsGoalSummary } from './11_savings_goals.js';
import { cashFlowForecast } from './16_forecast_engine.js';

const DAY=86400000;
const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
const monthlyFactor=30/90;

function recentTotals(now=new Date()){
  const state=getState(),cutoff=new Date(now.getTime()-90*DAY);
  const movements=(state.movimientos||[]).filter(m=>m.affectsPersonal!==false&&new Date(m.fecha)>=cutoff);
  const income90=movements.filter(m=>m.tipo==='ingreso'&&m.categoria!=='Sistema').reduce((a,m)=>a+safeFloat(m.monto),0);
  const expense90=movements.filter(m=>m.tipo==='gasto').reduce((a,m)=>a+safeFloat(m.monto),0);
  return {monthlyIncome:income90*monthlyFactor,monthlyExpense:expense90*monthlyFactor};
}

function monthlyDebtLoad(state){
  return (state.deudas||[]).filter(d=>safeFloat(d.saldo)>0).reduce((sum,d)=>{
    const quota=safeFloat(d.montoCuota),f=String(d.frecuencia||'Mensual').toLowerCase();
    if(f.includes('seman'))return sum+quota*52/12;
    if(f.includes('quinc'))return sum+quota*2;
    if(f.includes('diar'))return sum+quota*30;
    return sum+quota;
  },0);
}

function essentialMonthly(state,now=new Date()){
  const commitments=(state.financialPlan?.commitments||[]).filter(c=>c.active!==false).reduce((a,c)=>a+safeFloat(c.amount),0);
  const home=householdSummary(now),living=home.mandatory+home.budgeted;
  const transport=(state.workSources||[]).filter(s=>s.active!==false&&s.status!=='ended'&&s.status!=='paused').reduce((a,s)=>a+publicTransportMonthlyCost(s),0);
  return commitments+living+transport;
}

function recentSavings(now=new Date()){
  const state=getState(),cutoff=new Date(now.getTime()-90*DAY);
  const total=(state.savingsGoals||[]).flatMap(g=>g.history||[]).filter(h=>h.type==='reserve'&&new Date(h.fecha)>=cutoff).reduce((a,h)=>a+safeFloat(h.amount),0);
  return total*monthlyFactor;
}

export function financialHealth(now=new Date()){
  const state=getState(),position=financialPosition(now),recent=recentTotals(now),debtLoad=monthlyDebtLoad(state),essential=essentialMonthly(state,now),savedMonthly=recentSavings(now);
  const income=Math.max(0,recent.monthlyIncome),cash=Math.max(0,position.cash),free=Math.max(0,position.free);
  const liquidityRatio=cash>0?free/cash:0,commitmentRatio=income>0?essential/income:(essential>0?2:0),savingsRate=income>0?savedMonthly/income:0,debtRatio=income>0?debtLoad/income:(debtLoad>0?1:0);
  const liquidityScore=clamp((liquidityRatio/0.30)*25,0,25),commitmentsScore=clamp(((1.20-commitmentRatio)/0.70)*25,0,25),savingsScore=clamp((savingsRate/0.20)*25,0,25),debtScore=clamp(((0.50-debtRatio)/0.40)*25,0,25),score=Math.round(liquidityScore+commitmentsScore+savingsScore+debtScore);
  const breakdown=[
    {key:'liquidity',label:'Liquidez',score:Math.round(liquidityScore),max:25,value:liquidityRatio,detail:`${Math.round(liquidityRatio*100)}% de tu efectivo queda realmente libre.`},
    {key:'commitments',label:'Carga fija',score:Math.round(commitmentsScore),max:25,value:commitmentRatio,detail:income>0?`Hogar, compromisos y costos esenciales equivalen a ${Math.round(commitmentRatio*100)}% del ingreso mensual observado.`:'Aún no hay suficiente historial de ingresos para medir esta relación.'},
    {key:'savings',label:'Ahorro',score:Math.round(savingsScore),max:25,value:savingsRate,detail:income>0?`Has reservado un equivalente aproximado a ${Math.round(savingsRate*100)}% de tu ingreso mensual.`:'Aún no hay suficiente historial para calcular tasa de ahorro.'},
    {key:'debt',label:'Deuda',score:Math.round(debtScore),max:25,value:debtRatio,detail:income>0?`Las cuotas de deuda representan cerca de ${Math.round(debtRatio*100)}% del ingreso mensual.`:'No hay ingreso histórico suficiente para comparar la deuda.'}
  ];
  let status='estable';if(score<40)status='frágil';else if(score<65)status='en ajuste';else if(score>=85)status='fuerte';
  const forecast=cashFlowForecast({days:45,now});
  return {score,status,breakdown,monthlyIncome:income,monthlyExpense:recent.monthlyExpense,essentialMonthly:essential,debtLoad,savedMonthly,position,forecast};
}

function sourceIncome30(now=new Date()){
  const state=getState(),cutoff=new Date(now.getTime()-30*DAY);
  return (state.workSources||[]).filter(s=>s.active!==false&&s.status!=='ended'&&s.status!=='paused').map(source=>({
    id:source.id,name:source.name,income:(state.movimientos||[]).filter(m=>m.tipo==='ingreso'&&m.categoria!=='Sistema'&&m.affectsPersonal!==false&&m.sourceId===source.id&&new Date(m.fecha)>=cutoff).reduce((a,m)=>a+safeFloat(m.monto),0)
  })).sort((a,b)=>b.income-a.income);
}

export function smartGoalPlan(goalId,now=new Date()){
  const state=getState(),summary=savingsGoalSummary(goalId,now);if(!summary)return null;
  const health=financialHealth(now),position=health.position,remaining=summary.remaining;
  if(summary.complete)return {goal:summary.goal,status:'complete',summary,requiredMonthly:0,availableMonthly:Math.max(0,health.monthlyIncome-health.monthlyExpense),suggestedNow:0,estimatedCompletionDate:summary.goal.completedAt||now.toISOString(),sourcePlan:[]};
  const observedNet=Math.max(0,health.monthlyIncome-Math.max(health.monthlyExpense,health.essentialMonthly)),availableMonthly=observedNet,suggestedNow=Math.min(remaining,Math.max(0,position.free),summary.requiredMonthly||remaining);
  let status='blocked';if(availableMonthly>=summary.requiredMonthly&&summary.requiredMonthly>0)status='on_track';else if(availableMonthly>0||suggestedNow>0)status='at_risk';
  const pace=availableMonthly>0?availableMonthly:(suggestedNow>0?suggestedNow:0),monthsNeeded=pace>0?remaining/pace:null,estimatedCompletionDate=monthsNeeded!==null?new Date(now.getTime()+monthsNeeded*30.4375*DAY).toISOString():null;
  let pending=suggestedNow;const sourcePlan=sourceIncome30(now).map(s=>{const take=Math.min(s.income,pending);pending=Math.max(0,pending-take);return {...s,suggested:take};});
  return {goal:summary.goal,status,summary,requiredMonthly:summary.requiredMonthly,availableMonthly,suggestedNow,estimatedCompletionDate,sourcePlan,forecast:cashFlowForecast({days:45,now})};
}

export function goalPortfolioPlan(now=new Date()){
  const state=getState(),rank={high:0,normal:1,low:2};
  return (state.savingsGoals||[]).filter(g=>g.active!==false).map(g=>smartGoalPlan(g.id,now)).filter(Boolean).sort((a,b)=>(rank[a.goal.priority]??1)-(rank[b.goal.priority]??1));
}
