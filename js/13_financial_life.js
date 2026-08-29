/* v2.2.0 - Situación financiera, ciclo de vida laboral, transporte y calendario. */
import { safeFloat, uuid, TRANSPORT_MODES } from './01_consts_utils.js';
import { getState, saveData } from './02_data.js';

const PERSONAL_ACCOUNT_ID='acct-personal';
const DAY=86400000;
const DEFAULT_PLAN=Object.freeze({
  livingBudgets:{groceries:0,health:0,leisure:0,other:0},
  commitments:[]
});

const clone=v=>JSON.parse(JSON.stringify(v));
const monthId=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
const positive=(v,code='MONTO_INVALIDO')=>{const n=safeFloat(v);if(!(n>0))throw new Error(code);return n;};
const text=(v,code='NOMBRE_INVALIDO')=>{const s=String(v??'').trim();if(!s)throw new Error(code);return s;};
const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));

function normalizeCommitment(c){
  return {
    id:c?.id||uuid(),name:String(c?.name||c?.desc||'Compromiso').trim()||'Compromiso',
    amount:Math.max(0,safeFloat(c?.amount??c?.monto)),frequency:c?.frequency||c?.frecuencia||'monthly',
    dueDay:c?.dueDay??c?.diaPago??1,category:c?.category||c?.categoria||'Vida',active:c?.active!==false,
    createdAt:c?.createdAt||new Date().toISOString(),lastPaidPeriod:c?.lastPaidPeriod||null
  };
}

function normalizeTransport(source,state){
  const fallback=source?.transportMode||state.profile?.transportMode||'none';
  const mode=TRANSPORT_MODES[source?.transport?.mode]?source.transport.mode:(TRANSPORT_MODES[fallback]?fallback:'none');
  const pub=source?.transport?.public||source?.publicTransport||{};
  return {
    mode,
    public:{
      outboundRides:Math.max(0,Math.round(safeFloat(pub.outboundRides??pub.ridesOut))),
      returnRides:Math.max(0,Math.round(safeFloat(pub.returnRides??pub.ridesBack))),
      fare:Math.max(0,safeFloat(pub.fare)),
      daysPerWeek:clamp(safeFloat(pub.daysPerWeek||5),0,7)
    }
  };
}

export function ensureFinancialLife(){
  const state=getState();let changed=false;
  if(!state.financialPlan||typeof state.financialPlan!=='object'){
    state.financialPlan=clone(DEFAULT_PLAN);changed=true;
  }
  state.financialPlan.livingBudgets={...DEFAULT_PLAN.livingBudgets,...(state.financialPlan.livingBudgets||{})};
  state.financialPlan.commitments=Array.isArray(state.financialPlan.commitments)?state.financialPlan.commitments.map(normalizeCommitment):[];
  for(const source of state.workSources||[]){
    const nextStatus=source.status||((source.active===false)?(source.endedAt?'ended':'paused'):'active');
    if(source.status!==nextStatus){source.status=nextStatus;changed=true;}
    if(source.active===undefined){source.active=nextStatus==='active';changed=true;}
    if(!source.transport){source.transport=normalizeTransport(source,state);changed=true;}
    else source.transport=normalizeTransport(source,state);
    if(!source.startedAt){source.startedAt=source.createdAt||null;}
  }
  if(changed)saveData();
  return state.financialPlan;
}

export function setSourceStatus(sourceId,status){
  ensureFinancialLife();const state=getState(),source=state.workSources.find(s=>s.id===sourceId);
  if(!source)throw new Error('FUENTE_NO_ENCONTRADA');
  if(!['active','paused','ended'].includes(status))throw new Error('ESTADO_FUENTE_INVALIDO');
  source.status=status;source.active=status==='active';
  if(status==='ended')source.endedAt=new Date().toISOString();
  else if(status==='paused')source.pausedAt=new Date().toISOString();
  else {source.endedAt=null;source.pausedAt=null;source.reactivatedAt=new Date().toISOString();}
  saveData();return source;
}

export function updateSourceLife(sourceId,{status,transportMode,outboundRides,returnRides,fare,daysPerWeek}={}){
  ensureFinancialLife();const state=getState(),source=state.workSources.find(s=>s.id===sourceId);
  if(!source)throw new Error('FUENTE_NO_ENCONTRADA');
  if(status)setSourceStatus(sourceId,status);
  const mode=TRANSPORT_MODES[transportMode]?transportMode:(source.transport?.mode||state.profile.transportMode||'none');
  source.transport=normalizeTransport({...source,transport:{
    mode,
    public:{
      ...(source.transport?.public||{}),
      ...(outboundRides!==undefined?{outboundRides}:{}),
      ...(returnRides!==undefined?{returnRides}:{}),
      ...(fare!==undefined?{fare}:{}),
      ...(daysPerWeek!==undefined?{daysPerWeek}:{}),
    }
  }},state);
  source.transportMode=mode;
  saveData();return source;
}

export function publicTransportDailyCost(source){
  const state=getState(),t=normalizeTransport(source,state);if(t.mode!=='public')return 0;
  return (t.public.outboundRides+t.public.returnRides)*t.public.fare;
}
export function publicTransportMonthlyCost(source){
  const state=getState(),t=normalizeTransport(source,state);if(t.mode!=='public')return 0;
  return publicTransportDailyCost(source)*t.public.daysPerWeek*(52/12);
}

export function setLivingBudgets(values={}){
  const plan=ensureFinancialLife();
  for(const key of Object.keys(DEFAULT_PLAN.livingBudgets)){
    if(values[key]!==undefined)plan.livingBudgets[key]=Math.max(0,safeFloat(values[key]));
  }
  saveData();return plan.livingBudgets;
}

export function upsertCoreCommitment(id,{name,amount,dueDay,category='Vida'}={}){
  const plan=ensureFinancialLife();let c=plan.commitments.find(x=>x.id===id);
  const m=Math.max(0,safeFloat(amount));
  if(!(m>0)){
    if(c)c.active=false;
    saveData();return c||null;
  }
  if(!c){c=normalizeCommitment({id,name,amount:m,frequency:'monthly',dueDay,category});plan.commitments.push(c);}
  c.name=text(name);c.amount=m;c.frequency='monthly';c.dueDay=clamp(Math.round(safeFloat(dueDay||1)),1,31);c.category=category;c.active=true;
  saveData();return c;
}

export function configureLivingSetup({housing,housingDay=1,services,servicesDay=10,groceries,health,leisure,other}={}){
  setLivingBudgets({groceries,health,leisure,other});
  upsertCoreCommitment('life-housing',{name:'Vivienda',amount:housing,dueDay:housingDay,category:'Vivienda'});
  upsertCoreCommitment('life-services',{name:'Servicios del hogar',amount:services,dueDay:servicesDay,category:'Servicios'});
  return ensureFinancialLife();
}

export function createCommitment({name,amount,frequency='monthly',dueDay=1,category='Vida'}={}){
  const plan=ensureFinancialLife();const c=normalizeCommitment({name:text(name),amount:positive(amount),frequency,dueDay,category});
  plan.commitments.push(c);saveData();return c;
}
export function setCommitmentActive(id,active){const c=ensureFinancialLife().commitments.find(x=>x.id===id);if(!c)throw new Error('COMPROMISO_NO_ENCONTRADO');c.active=Boolean(active);saveData();return c;}

function personalCash(state){
  return (state.movimientos||[]).filter(m=>m.affectsPersonal!==false).reduce((a,m)=>m.tipo==='ingreso'?a+safeFloat(m.monto):m.tipo==='gasto'?a-safeFloat(m.monto):a,0);
}

export function payCommitment(id,fecha=Date.now()){
  const state=getState(),c=ensureFinancialLife().commitments.find(x=>x.id===id&&x.active!==false);if(!c)throw new Error('COMPROMISO_NO_ENCONTRADO');
  const amount=positive(c.amount),d=new Date(fecha),period=monthId(d);
  if(c.lastPaidPeriod===period)throw new Error('COMPROMISO_YA_PAGADO');
  state.movimientos.push({id:uuid(),fecha:d.toISOString(),tipo:'gasto',desc:c.name,monto:amount,categoria:c.category||'Vida',accountId:PERSONAL_ACCOUNT_ID,affectsPersonal:true,commitmentId:c.id,periodo:period});
  c.lastPaidPeriod=period;saveData();return c;
}

const lastDay=(year,month)=>new Date(year,month+1,0).getDate();
function pushMonthly(events,{id,title,amount,type,category,dueDay,sourceId},now,end){
  for(let offset=0;offset<3;offset++){
    const y=now.getFullYear(),m=now.getMonth()+offset,yy=y+Math.floor(m/12),mm=((m%12)+12)%12;
    const day=dueDay==='fin_mes'?lastDay(yy,mm):clamp(Math.round(safeFloat(dueDay||1)),1,lastDay(yy,mm));
    const d=new Date(yy,mm,day,9,0,0);if(d>=now&&d<=end)events.push({id:`${id}-${d.toISOString().slice(0,10)}`,refId:id,date:d.toISOString(),title,amount,type,category,sourceId:sourceId||null});
  }
}
function pushBiweekly(events,base,now,end){
  for(let offset=0;offset<3;offset++){
    const raw=now.getMonth()+offset,y=now.getFullYear()+Math.floor(raw/12),m=((raw%12)+12)%12;
    for(const day of [15,lastDay(y,m)]){const d=new Date(y,m,day,9,0,0);if(d>=now&&d<=end)events.push({...base,id:`${base.id}-${d.toISOString().slice(0,10)}`,date:d.toISOString()});}
  }
}
function pushWeekly(events,base,weekDay,now,end){
  const target=Number(weekDay);const normalized=Number.isFinite(target)?target:5;const start=new Date(now);start.setHours(9,0,0,0);
  const diff=(normalized-start.getDay()+7)%7;start.setDate(start.getDate()+diff);
  for(let d=new Date(start);d<=end;d=new Date(d.getTime()+7*DAY))events.push({...base,id:`${base.id}-${d.toISOString().slice(0,10)}`,date:d.toISOString()});
}

function recurrence(events,base,frequency,dueDay,now,end){
  const f=String(frequency||'monthly').toLowerCase();
  if(['monthly','mensual'].includes(f))return pushMonthly(events,{...base,dueDay},now,end);
  if(['biweekly','quincenal'].includes(f))return pushBiweekly(events,base,now,end);
  if(['weekly','semanal'].includes(f))return pushWeekly(events,base,dueDay,now,end);
  if(['daily','diario'].includes(f)){
    for(let d=new Date(now);d<=end;d=new Date(d.getTime()+DAY))events.push({...base,id:`${base.id}-${d.toISOString().slice(0,10)}`,date:d.toISOString()});
  }
}

export function upcomingFinancialEvents({days=45,now=new Date()}={}){
  ensureFinancialLife();const state=getState(),start=new Date(now);start.setHours(0,0,0,0);const end=new Date(start.getTime()+days*DAY),events=[];
  for(const c of state.financialPlan.commitments.filter(x=>x.active!==false)){
    recurrence(events,{id:`commitment-${c.id}`,refId:c.id,title:c.name,amount:safeFloat(c.amount),type:'expense',category:c.category||'Vida'},c.frequency,c.dueDay,start,end);
  }
  for(const d of state.deudas||[]){if(!(safeFloat(d.saldo)>0))continue;recurrence(events,{id:`debt-${d.id}`,refId:d.id,title:`Deuda · ${d.desc}`,amount:Math.min(safeFloat(d.montoCuota),safeFloat(d.saldo)),type:'debt',category:'Deuda'},d.frecuencia,d.diaPago,start,end);}
  for(const g of state.gastosFijosMensuales||[]){if(['Ahorro','Meta'].includes(g.categoria))continue;recurrence(events,{id:`fixed-${g.id}`,refId:g.id,title:g.desc,amount:safeFloat(g.monto),type:'expense',category:g.categoria||'Gasto'},g.frecuencia,g.diaPago||1,start,end);}
  for(const source of state.workSources||[]){
    if(source.active===false||source.status==='ended'||source.status==='paused')continue;
    const base={id:`income-${source.id}`,refId:source.id,title:`Ingreso esperado · ${source.name}`,amount:null,type:'income',category:'Trabajo',sourceId:source.id};
    if(source.compensation==='biweekly')pushBiweekly(events,base,start,end);
    else if(source.compensation==='monthly')pushMonthly(events,{...base,dueDay:source.paySchedule?.day||30},start,end);
    else if(source.compensation==='weekly')pushWeekly(events,base,source.paySchedule?.weekDay??5,start,end);
  }
  for(const goal of state.savingsGoals||[]){
    if(goal.active===false||!goal.targetDate||safeFloat(goal.reserved)>=safeFloat(goal.targetAmount))continue;
    const d=new Date(goal.targetDate);if(d>=start&&d<=end)events.push({id:`goal-${goal.id}`,refId:goal.id,date:d.toISOString(),title:`Meta · ${goal.name}`,amount:Math.max(0,safeFloat(goal.targetAmount)-safeFloat(goal.reserved)),type:'goal',category:'Meta'});
  }
  return events.sort((a,b)=>new Date(a.date)-new Date(b.date));
}

const categoryMatch=(key,m)=>{
  const c=`${m.categoria||''} ${m.desc||''}`.toLowerCase();
  if(key==='groceries')return /comida|despensa|super|mercado|alimento/.test(c);
  if(key==='health')return /salud|farmacia|medic|doctor/.test(c);
  if(key==='leisure')return /ocio|entreten|cine|salida|diversi/.test(c);
  if(key==='other')return /otro|personal/.test(c);
  return false;
};

export function livingBudgetStatus(now=new Date()){
  const plan=ensureFinancialLife(),state=getState(),start=new Date(now.getFullYear(),now.getMonth(),1),rows=[];
  for(const [key,budgetRaw] of Object.entries(plan.livingBudgets)){
    const budget=Math.max(0,safeFloat(budgetRaw));if(!(budget>0))continue;
    const spent=(state.movimientos||[]).filter(m=>m.tipo==='gasto'&&m.affectsPersonal!==false&&new Date(m.fecha)>=start&&categoryMatch(key,m)).reduce((a,m)=>a+safeFloat(m.monto),0);
    rows.push({key,budget,spent,remaining:Math.max(0,budget-spent)});
  }
  return rows;
}

export function workTransportCommitment(now=new Date()){
  const state=getState(),daysInMonth=lastDay(now.getFullYear(),now.getMonth()),remainingDays=Math.max(0,daysInMonth-now.getDate()+1),fraction=remainingDays/daysInMonth;
  return (state.workSources||[]).filter(s=>s.active!==false&&s.status!=='ended'&&s.status!=='paused').reduce((sum,s)=>sum+publicTransportMonthlyCost(s)*fraction,0);
}

export function financialPosition(now=new Date()){
  const state=getState();ensureFinancialLife();
  const cash=personalCash(state);
  let reserved=(state.savingsGoals||[]).filter(g=>g.active!==false).reduce((a,g)=>a+safeFloat(g.reserved),0);
  if(!(state.savingsGoals||[]).length)reserved=(state.wallet?.sobres||[]).filter(s=>s.categoria==='Ahorro'||s.categoria==='Meta').reduce((a,s)=>a+safeFloat(s.acumulado),0);
  const due=upcomingFinancialEvents({days:30,now}).filter(e=>['expense','debt'].includes(e.type)&&safeFloat(e.amount)>0).reduce((a,e)=>a+safeFloat(e.amount),0);
  const living=livingBudgetStatus(now).reduce((a,x)=>a+x.remaining,0);
  const workTransport=workTransportCommitment(now);
  const committed=due+living+workTransport;
  return {cash,reserved,committed,free:cash-reserved-committed,due,living,workTransport};
}

export function sourceCostProfile(sourceId,now=new Date()){
  ensureFinancialLife();const state=getState(),source=state.workSources.find(s=>s.id===sourceId);if(!source)return null;
  const monthStart=new Date(now.getFullYear(),now.getMonth(),1);
  const income=(state.movimientos||[]).filter(m=>m.sourceId===sourceId&&m.tipo==='ingreso'&&m.affectsPersonal!==false&&new Date(m.fecha)>=monthStart).reduce((a,m)=>a+safeFloat(m.monto),0);
  const actualCosts=(state.movimientos||[]).filter(m=>m.sourceId===sourceId&&m.tipo==='gasto'&&m.affectsPersonal!==false&&new Date(m.fecha)>=monthStart).reduce((a,m)=>a+safeFloat(m.monto),0);
  const publicTransport=publicTransportMonthlyCost(source);
  return {source,income,actualCosts,publicTransport,estimatedNet:income-actualCosts-publicTransport};
}
