/* v3.1.0 - Reglas automáticas y alertas explicables, reutilizando cálculos compartidos. */
import { safeFloat, uuid } from './01_consts_utils.js';
import { getState, saveData } from './02_data.js';
import { financialPosition, upcomingFinancialEvents } from './21_financial_life_v27.js';
import { householdBudgetStatus } from './20_home_engine.js';
import { contributeToSavingsGoal, savingsGoalSummary } from './11_savings_goals.js';
import { cashFlowForecast } from './16_forecast_engine.js';
import { inObservedPeriod, isPersonalMovement, paymentDueState } from './domain/financial-rules.js';

const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));

function normalizeRule(r){return {
  id:r?.id||uuid(),name:String(r?.name||'Regla de ahorro').trim()||'Regla de ahorro',type:r?.type||'reserve_income_percent',
  active:r?.active!==false,goalId:r?.goalId||null,sourceId:r?.sourceId||null,percent:clamp(safeFloat(r?.percent||10),1,100),
  createdAt:r?.createdAt||new Date().toISOString(),
  financialPolicyVersion:r?.financialPolicyVersion||0,policyActivatedAt:r?.policyActivatedAt||null
};}

export function ensureAutomationEngine(){
  const state=getState();let changed=false;
  if(!Array.isArray(state.automationRules)){state.automationRules=[];changed=true;}else state.automationRules=state.automationRules.map(normalizeRule);
  if(!Array.isArray(state.ruleApplications)){state.ruleApplications=[];changed=true;}
  if(!state.automationPreferences||typeof state.automationPreferences!=='object'){state.automationPreferences={minFreeCash:0,alertsEnabled:true};changed=true;}
  state.automationPreferences={minFreeCash:Math.max(0,safeFloat(state.automationPreferences.minFreeCash)),alertsEnabled:state.automationPreferences.alertsEnabled!==false};
  // New availability must not suddenly reserve old income that was blocked by
  // the former cash-only plan. Record skipped attempts; never touch the income.
  for(const rule of state.automationRules){
    if(rule.financialPolicyVersion>=1)continue;
    rule.financialPolicyVersion=1;rule.policyActivatedAt=new Date().toISOString();changed=true;
    for(const m of state.movimientos||[]){
      if(m.tipo!=='ingreso'||!isPersonalMovement(state,m)||m.categoria==='Sistema'||!inObservedPeriod(m.fecha,0,new Date(rule.policyActivatedAt))||rule.sourceId&&rule.sourceId!==m.sourceId)continue;
      if(!state.ruleApplications.some(a=>a.ruleId===rule.id&&a.movementId===m.id))state.ruleApplications.push({id:`rule-${rule.id}-${m.id}`,ruleId:rule.id,movementId:m.id,amount:0,status:'before_policy',createdAt:rule.policyActivatedAt});
    }
  }
  if(changed)saveData();return state.automationRules;
}

export const listAutomationRules=()=>ensureAutomationEngine();

export function createReserveRule({goalId,percent=10,sourceId=null,name=''}={}){
  ensureAutomationEngine();const state=getState(),goal=(state.savingsGoals||[]).find(g=>g.id===goalId&&g.active!==false);if(!goal)throw new Error('META_NO_ENCONTRADA');
  if(sourceId&&!state.workSources.some(s=>s.id===sourceId))throw new Error('FUENTE_NO_ENCONTRADA');
  const p=clamp(safeFloat(percent),1,100);if(!(p>0))throw new Error('PORCENTAJE_INVALIDO');
  const createdAt=new Date().toISOString(),rule=normalizeRule({name:name||`Apartar ${p}% para ${goal.name}`,goalId,sourceId,percent:p,createdAt,financialPolicyVersion:1,policyActivatedAt:createdAt});
  state.automationRules.push(rule);
  for(const movement of (state.movimientos||[]).filter(m=>m.tipo==='ingreso'&&m.affectsPersonal!==false&&(sourceId?m.sourceId===sourceId:true))){
    state.ruleApplications.push({id:`rule-${rule.id}-${movement.id}`,ruleId:rule.id,movementId:movement.id,amount:0,status:'before_rule',createdAt:new Date().toISOString()});
  }
  saveData();return rule;
}

export function setAutomationRuleActive(id,active){const state=getState();ensureAutomationEngine();const r=state.automationRules.find(x=>x.id===id);if(!r)throw new Error('REGLA_NO_ENCONTRADA');r.active=Boolean(active);saveData();return r;}
export function setMinFreeCashAlert(value){ensureAutomationEngine();const state=getState();state.automationPreferences.minFreeCash=Math.max(0,safeFloat(value));saveData();return state.automationPreferences;}

export function runAutomationEngine(){
  ensureAutomationEngine();const state=getState();let applied=0,touched=false;
  for(const rule of state.automationRules.filter(r=>r.active!==false&&r.type==='reserve_income_percent')){
    const goal=savingsGoalSummary(rule.goalId);if(!goal)continue;
    const movements=(state.movimientos||[]).filter(m=>m.tipo==='ingreso'&&isPersonalMovement(state,m)&&m.categoria!=='Sistema'&&inObservedPeriod(m.fecha,0,new Date())&&(rule.sourceId?m.sourceId===rule.sourceId:true));
    for(const movement of movements){
      if(state.ruleApplications.some(a=>a.ruleId===rule.id&&a.movementId===movement.id))continue;
      if(rule.policyActivatedAt&&new Date(movement.fecha)<new Date(rule.policyActivatedAt)){state.ruleApplications.push({id:`rule-${rule.id}-${movement.id}`,ruleId:rule.id,movementId:movement.id,amount:0,status:'before_policy',createdAt:new Date().toISOString()});touched=true;continue;}
      const current=savingsGoalSummary(rule.goalId);
      if(!current||current.complete){state.ruleApplications.push({id:`rule-${rule.id}-${movement.id}`,ruleId:rule.id,movementId:movement.id,amount:0,status:'goal_complete',createdAt:new Date().toISOString()});touched=true;continue;}
      const free=financialPosition().savingsAvailableNow,desired=safeFloat(movement.monto)*(rule.percent/100),amount=Math.min(desired,current.remaining,free);
      if(amount<0.01){state.ruleApplications.push({id:`rule-${rule.id}-${movement.id}`,ruleId:rule.id,movementId:movement.id,amount:0,status:'insufficient_today',createdAt:new Date().toISOString()});touched=true;continue;}
      contributeToSavingsGoal(rule.goalId,amount,{sourceId:movement.sourceId||null,note:`Automatización · ${rule.name}`,operationId:`rule:${rule.id}:income:${movement.id}`});
      state.ruleApplications.push({id:`rule-${rule.id}-${movement.id}`,ruleId:rule.id,movementId:movement.id,amount,status:'applied',createdAt:new Date().toISOString()});applied++;touched=true;
    }
  }
  if(touched)saveData();
  return applied;
}

const alert=(id,level,title,message,meta={})=>({id,level,title,message,...meta});

export function smartAlerts(now=new Date(),context={}){
  ensureAutomationEngine();const state=getState();if(state.automationPreferences.alertsEnabled===false)return [];
  const rows=[],position=context.position||financialPosition(now),forecast=context.forecast||cashFlowForecast({days:45,now}),minFree=safeFloat(state.automationPreferences.minFreeCash);
  if(position.availableToday<0)rows.push(alert('free-negative','critical','Falta dinero para hoy',`Los pagos exigibles hoy y las metas reservadas superan tu efectivo en ${Math.abs(position.availableToday).toFixed(2)}.`));
  else if(minFree>0&&position.availableToday<minFree)rows.push(alert('free-floor','warning','Colchón por debajo de tu mínimo',`Tu disponible de hoy está por debajo del mínimo que configuraste.`));
  if(forecast.firstNegativeDate)rows.push(alert('forecast-negative','critical','Se aproxima un faltante',`La proyección cae por debajo de $0 el ${new Date(forecast.firstNegativeDate).toLocaleDateString('es-MX')}.`,{date:forecast.firstNegativeDate}));
  else if(forecast.firstTightDate)rows.push(alert('forecast-tight','warning','Tus reservas quedarían en riesgo',`Si todo ocurre como está previsto, alrededor del ${new Date(forecast.firstTightDate).toLocaleDateString('es-MX')} empezarías a usar dinero reservado o presupuesto necesario.`,{date:forecast.firstTightDate}));
  for(const b of householdBudgetStatus(now)){
    const ratio=b.budget>0?b.spent/b.budget:0;
    if(ratio>=1)rows.push(alert(`home-budget-${b.item.id}`,'critical','Presupuesto del hogar agotado',`Ya consumiste el presupuesto de ${b.item.name}.`));
    else if(ratio>=0.8)rows.push(alert(`home-budget-${b.item.id}`,'warning','Presupuesto del hogar cerca del límite',`Ya utilizaste ${Math.round(ratio*100)}% de ${b.item.name}.`));
  }
  const soon=context.soonEvents||upcomingFinancialEvents({days:2,now}).filter(e=>['expense','debt'].includes(e.type)&&safeFloat(e.amount)>0);
  for(const event of soon){
    const title={overdue:'Pago vencido',due_today:'Vence hoy',due_tomorrow:'Vence mañana'}[paymentDueState(event,now)];
    if(title)rows.push(alert(`payment-due-${event.id}`,'warning',`${title} · ${event.title}`,`${safeFloat(event.amount).toFixed(2)} pendientes.`,{date:event.dueDate||event.date}));
  }
  return rows;
}
