/* v2.4.0 - Proyección de flujo de efectivo a partir de calendario + historial real. */
import { safeFloat } from './01_consts_utils.js';
import { getState } from './02_data.js';
import { upcomingFinancialEvents, financialPosition } from './13_financial_life.js';
import { personalCashTotal } from './15_accounts_engine.js';

const DAY=86400000;
const monthId=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
const avg=list=>list.length?list.reduce((a,b)=>a+b,0)/list.length:0;

export function expectedIncomeForSource(sourceId,now=new Date()){
  const state=getState(),source=state.workSources.find(s=>s.id===sourceId);if(!source)return 0;
  const cutoff=new Date(now.getTime()-180*DAY);
  const incomes=(state.movimientos||[])
    .filter(m=>m.tipo==='ingreso'&&m.affectsPersonal!==false&&m.sourceId===sourceId&&new Date(m.fecha)>=cutoff)
    .sort((a,b)=>new Date(b.fecha)-new Date(a.fecha));
  if(!incomes.length)return 0;
  if(['monthly','biweekly','weekly','daily'].includes(source.compensation)){
    const periodPayments=incomes.filter(m=>m.paymentKind==='source_period');
    const sample=(periodPayments.length?periodPayments:incomes).slice(0,source.compensation==='weekly'?8:source.compensation==='biweekly'?6:4);
    return avg(sample.map(m=>safeFloat(m.monto)));
  }
  return 0;
}

function alreadyPaid(event){
  const state=getState(),d=new Date(event.date),period=monthId(d);
  if(event.type==='expense'&&event.refId){
    const c=state.financialPlan?.commitments?.find(x=>x.id===event.refId);
    if(c?.lastPaidPeriod===period)return true;
  }
  return false;
}

export function cashFlowForecast({days=45,now=new Date()}={}){
  const state=getState(),start=new Date(now),end=new Date(start.getTime()+days*DAY),reserved=(state.savingsGoals||[]).filter(g=>g.active!==false).reduce((a,g)=>a+safeFloat(g.reserved),0);
  let cash=personalCashTotal(),minCash=cash,totalIncome=0,totalOutflow=0,firstNegativeDate=null;
  const raw=upcomingFinancialEvents({days,now:start});
  const events=[];
  for(const event of raw){
    if(new Date(event.date)>end||event.type==='goal'||alreadyPaid(event))continue;
    let amount=safeFloat(event.amount),delta=0,estimated=false;
    if(event.type==='income'){
      if(!(amount>0)){amount=expectedIncomeForSource(event.sourceId,start);estimated=true;}
      if(!(amount>0))continue;
      delta=amount;totalIncome+=amount;
    }else if(['expense','debt'].includes(event.type)){
      if(!(amount>0))continue;
      delta=-amount;totalOutflow+=amount;
    }else continue;
    cash+=delta;minCash=Math.min(minCash,cash);
    if(cash<0&&!firstNegativeDate)firstNegativeDate=event.date;
    events.push({...event,amount,delta,estimated,projectedCash:cash,projectedFree:cash-reserved});
  }
  const position=financialPosition(start);
  return {
    now:start.toISOString(),days,startCash:personalCashTotal(),startFree:position.free,reserved,
    totalExpectedIncome:totalIncome,totalExpectedOutflow:totalOutflow,endingCash:cash,endingFree:cash-reserved,
    minCash,firstNegativeDate,events,
    risk:firstNegativeDate?'negative':cash-reserved<0?'tight':position.free<0?'tight':'ok'
  };
}

export function forecastDaily({days=30,now=new Date()}={}){
  const forecast=cashFlowForecast({days,now}),rows=[];let cash=forecast.startCash,index=0;
  for(let i=0;i<=days;i++){
    const d=new Date(now.getFullYear(),now.getMonth(),now.getDate()+i,23,59,59);
    while(index<forecast.events.length&&new Date(forecast.events[index].date)<=d){cash=forecast.events[index].projectedCash;index++;}
    rows.push({date:d.toISOString(),cash,free:cash-forecast.reserved});
  }
  return rows;
}

export function nextCashRisk({days=45,now=new Date()}={}){
  const f=cashFlowForecast({days,now});
  if(f.firstNegativeDate)return {level:'critical',date:f.firstNegativeDate,message:'Tu flujo proyectado cae por debajo de $0 antes de terminar el periodo.'};
  if(f.endingFree<0)return {level:'warning',date:f.events.at(-1)?.date||null,message:'Tus pagos proyectados consumen también el dinero reservado para metas.'};
  if(f.minCash<Math.max(500,f.totalExpectedOutflow*0.05))return {level:'warning',date:null,message:'Tu colchón de efectivo proyectado queda muy justo.'};
  return {level:'ok',date:null,message:'No detecto faltantes de efectivo en la proyección actual.'};
}
