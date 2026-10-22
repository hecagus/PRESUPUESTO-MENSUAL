/* v3.1.0 - Proyección de flujo: calendario + hogar + historial real, sin retener reservas ya consumidas. */
import { safeFloat } from './01_consts_utils.js';
import { getState } from './02_data.js';
import { upcomingFinancialEvents, financialPosition } from './21_financial_life_v27.js';
import { householdReserveNeed } from './23_home_semantics.js';
import { fixedIncomeEstimate, variableIncomeSample, horizonEnd, localDay } from './domain/financial-rules.js';
import { financialScenario, FORECAST_DAYS } from './app/financial-options.js';

const DAY=86400000;
const monthId=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;

export function expectedIncomeForSource(sourceId,now=new Date()){
  const state=getState();return fixedIncomeEstimate(state,state.workSources.find(s=>s.id===sourceId),now).amount;
}

export function variableIncomeEvents({days=45,now=new Date()}={}){
  const state=getState(),events=[],start=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  for(const source of state.workSources||[]){
    if(!['per_shift','variable','per_project','per_sale'].includes(source.compensation)||source.active===false||['paused','ended'].includes(source.status))continue;
    // Scheduled operating payments are projected separately; do not subtract them again from estimated net income.
    const sample=variableIncomeSample(state,source,now);if(!sample.available)continue;
    for(let i=1;i<days;i++){
      const d=new Date(start);d.setDate(d.getDate()+i);d.setHours(12);
      const net=sample.weekdayNet[d.getDay()];
      if(net!==0)events.push({id:`variable-${source.id}-${d.toISOString()}`,sourceId:source.id,type:net>0?'income':'expense',date:d.toISOString(),amount:Math.abs(net),title:`Flujo variable neto estimado · ${source.name}`,estimated:true,variable:true,sampleDays:sample.days});
    }
  }
  return events;
}

function alreadyPaid(event){
  const state=getState(),d=new Date(event.date),period=monthId(d);
  if(event.household&&event.householdPeriod)return false; // La fuente canónica ya entrega únicamente el importe pendiente.
  if(event.type==='expense'&&event.refId){
    const c=state.financialPlan?.commitments?.find(x=>x.id===event.refId);
    if(c?.lastPaidPeriod===period)return true;
  }
  return false;
}

function reserveSnapshot(position,now){
  const state=getState();
  const savings=position.reserved;
  const homeReserve=householdReserveNeed(now),accruedByItem=new Map();let accrued=0;
  for(const row of homeReserve.rows||[]){
    if(row.reason!=='accrued'||!row.item?.id)continue;
    const amount=Math.max(0,safeFloat(row.amount));if(!(amount>0))continue;
    accrued+=amount;accruedByItem.set(row.item.id,(accruedByItem.get(row.item.id)||0)+amount);
  }
  const staticHome=Math.max(0,safeFloat(homeReserve.total)-accrued);
  const baseLocked=Math.max(0,savings+safeFloat(position.homeBudget)+staticHome+safeFloat(position.workTransport));
  return {savings,baseLocked,accrued,accruedByItem,initial:baseLocked+accrued};
}

export function cashFlowForecast({days=FORECAST_DAYS,now=new Date(),includeVariable=financialScenario().includeVariable}={}){
  const start=new Date(now),end=horizonEnd(start,days),position=financialPosition(start),reserve=reserveSnapshot(position,start);
  let cash=position.cash,minCash=cash,totalIncome=0,totalOutflow=0,firstNegativeDate=cash<0?start.toISOString():null,firstTightDate=cash-reserve.initial<0?start.toISOString():null,dynamicAccrued=reserve.accrued;
  const raw=[...upcomingFinancialEvents({days,now:start}),...(includeVariable?variableIncomeEvents({days,now:start}):[])].sort((a,b)=>new Date(a.date)-new Date(b.date)),events=[];
  for(const event of raw){
    if(new Date(event.date)>end||event.type==='goal'||alreadyPaid(event))continue;
    let amount=safeFloat(event.amount),delta=0,estimated=event.estimated===true;
    if(event.type==='income'){
      if(!(amount>0)){amount=expectedIncomeForSource(event.sourceId,start);estimated=true;}
      if(!(amount>0))continue;
      delta=amount;totalIncome+=amount;
    }else if(['expense','debt'].includes(event.type)){
      if(!(amount>0))continue;
      delta=-amount;totalOutflow+=amount;
    }else continue;
    events.push({...event,amount,delta,estimated});
  }
  // Los horarios de las recurrencias son de presentación, no horas de cobro/pago.
  // Evaluar el cierre de cada día evita un faltante ficticio entre eventos del mismo día.
  for(let i=0;i<events.length;){
    const day=localDay(events[i].date),rows=[];
    while(i<events.length&&localDay(events[i].date)===day){
      const event=events[i++];rows.push(event);cash+=event.delta;
      /* Una reserva progresiva deja de estar bloqueada al pagar su recibo proyectado. */
      if(event.household&&['expense','debt'].includes(event.type)&&reserve.accruedByItem.has(event.refId)){
        dynamicAccrued=Math.max(0,dynamicAccrued-reserve.accruedByItem.get(event.refId));
        reserve.accruedByItem.delete(event.refId);
      }
    }
    const projectedReserve=reserve.baseLocked+dynamicAccrued,projectedFree=cash-projectedReserve;
    minCash=Math.min(minCash,cash);
    if(cash<0&&!firstNegativeDate)firstNegativeDate=rows[0].date;
    if(projectedFree<0&&!firstTightDate)firstTightDate=rows[0].date;
    for(const row of rows)Object.assign(row,{projectedCash:cash,projectedReserve,projectedFree,balanceBasis:'end_of_day'});
  }
  const endingReserve=reserve.baseLocked+dynamicAccrued,endingFree=cash-endingReserve;
  return {
    now:start.toISOString(),days,includeVariable,startCash:position.cash,startFree:position.cash-reserve.initial,availableToday:position.availableToday,reserved:reserve.savings,
    ongoingReserve:reserve.initial,endingReserve,totalExpectedIncome:totalIncome,totalExpectedOutflow:totalOutflow,endingCash:cash,endingFree,
    minCash,firstNegativeDate,firstTightDate,events,
    risk:firstNegativeDate?'negative':firstTightDate||endingFree<0?'tight':'ok'
  };
}

export function forecastDaily({days=30,now=new Date(),includeVariable=financialScenario().includeVariable}={}){
  const forecast=cashFlowForecast({days,now,includeVariable}),rows=[];let cash=forecast.startCash,reserve=forecast.ongoingReserve,index=0;
  for(let i=0;i<Math.max(1,Math.floor(days));i++){
    const d=new Date(now.getFullYear(),now.getMonth(),now.getDate()+i,23,59,59);
    while(index<forecast.events.length&&new Date(forecast.events[index].date)<=d){cash=forecast.events[index].projectedCash;reserve=forecast.events[index].projectedReserve??reserve;index++;}
    rows.push({date:d.toISOString(),cash,reserve,free:cash-reserve});
  }
  return rows;
}

export function nextCashRisk({days=45,now=new Date()}={}){
  const f=cashFlowForecast({days,now});
  if(f.firstNegativeDate)return {level:'critical',date:f.firstNegativeDate,message:'Tu flujo proyectado cae por debajo de $0 antes de terminar el periodo.'};
  if(f.firstTightDate||f.endingFree<0)return {level:'warning',date:f.firstTightDate||f.events.at(-1)?.date||null,message:'Tus pagos proyectados empezarían a consumir dinero reservado o presupuesto necesario.'};
  if(f.minCash<Math.max(500,f.totalExpectedOutflow*0.05))return {level:'warning',date:null,message:'Tu colchón de efectivo proyectado queda muy justo.'};
  return {level:'ok',date:null,message:'No detecto faltantes de efectivo en la proyección actual.'};
}
