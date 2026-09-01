/* v3.1.0 - UI integrada por página: una sola línea de tiempo y cálculos sólo donde se usan. */
import { $, fmtMoney, safeFloat } from './01_consts_utils.js';
import * as Data from './02_data.js';
import { Modal } from './03_render.js';
import {
  ensureAccountsEngine,getPersonalAccounts,accountBalance,accountTypeLabel,createPersonalAccount,
  setAccountActive,recordUniversalMovement,transferBetweenAccounts
} from './15_accounts_engine.js';
import { cashFlowForecast } from './16_forecast_engine.js';
import {
  ensureAutomationEngine,listAutomationRules,createReserveRule,setAutomationRuleActive,setMinFreeCashAlert,
  runAutomationEngine,smartAlerts
} from './17_automation_engine.js';
import { financialHealth,goalPortfolioPlan } from './18_health_goals.js';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dateLabel=d=>new Date(d).toLocaleDateString('es-MX',{day:'numeric',month:'short'});
const dateLong=d=>d?new Date(d).toLocaleDateString('es-MX',{day:'numeric',month:'short',year:'numeric'}):'—';
let eventsBound=false;
let changeHandler=()=>{};

const ERRORS={
  NOMBRE_INVALIDO:'Escribe un nombre válido.',DESCRIPCION_INVALIDA:'Escribe una descripción.',MONTO_INVALIDO:'Ingresa un monto mayor a 0.',
  CUENTA_DUPLICADA:'Ya existe una cuenta personal con ese nombre.',CUENTA_NO_ENCONTRADA:'No se encontró esa cuenta.',CUENTA_CON_SALDO:'Primero mueve el saldo de esa cuenta antes de archivarla.',
  CUENTA_BASE:'La cuenta base no se puede archivar porque todavía recibe operaciones del sistema.',
  TRANSFERENCIA_MISMA_CUENTA:'Selecciona dos cuentas diferentes.',SALDO_CUENTA_INSUFICIENTE:'Esa cuenta no tiene saldo suficiente.',TIPO_MOVIMIENTO_INVALIDO:'Selecciona ingreso o gasto.',
  META_NO_ENCONTRADA:'Selecciona una meta válida.',FUENTE_NO_ENCONTRADA:'No se encontró esa fuente.',REGLA_NO_ENCONTRADA:'No se encontró esa regla.',PORCENTAJE_INVALIDO:'Ingresa un porcentaje válido.'
};

function changed({automate=true}={}){if(automate)runAutomationEngine();changeHandler?.();document.dispatchEvent(new CustomEvent('budget:data-changed'));}
function run(fn,opts){try{fn();changed(opts);}catch(e){console.error(e);alert(ERRORS[e.message]||'No se pudo completar la operación.');}}

function ensureBefore(anchor,id,html){if($(id))return $(id);const node=document.createElement('div');node.id=id;node.innerHTML=html;anchor?.parentElement?.insertBefore(node,anchor);return node;}
function ensureAfter(anchor,id,html){if($(id))return $(id);const node=document.createElement('div');node.id=id;node.innerHTML=html;anchor?.parentElement?.insertBefore(node,anchor.nextSibling);return node;}

function renderAccountsHub(){
  const container=$('accountsContainer');if(!container)return;ensureAccountsEngine();
  ensureBefore(container,'platformAccountControls','<section class="card"><div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><div><strong>🏦 Mis cuentas</strong><small style="display:block;color:var(--text-sec);margin-top:3px">Dónde está cada peso, sin confundir transferencias con ingresos.</small></div></div><div class="grid-2" style="margin-top:10px"><button class="btn btn-primary" data-platform-action="new-account">+ Cuenta</button><button class="btn btn-outline" data-platform-action="transfer">⇄ Transferir</button></div><button class="btn btn-outline" style="margin-top:8px" data-platform-action="movement">+ Registrar movimiento</button></section>');
  const state=Data.getState();
  container.innerHTML=(state.accounts||[]).filter(a=>a.active!==false).map(a=>{
    const third=a.ownership==='third_party',balance=third?Data.saldoCuenta(a.id):accountBalance(a.id);
    return `<section class="card" style="border-left:4px solid ${third?'#f59e0b':'#2563eb'}"><div style="display:flex;justify-content:space-between;gap:10px"><div><strong>${third?'🏢':'💳'} ${esc(a.name)}</strong><small style="display:block;color:var(--text-sec);margin-top:3px">${third?'Fondos de tercero · no son patrimonio':esc(accountTypeLabel(a.type))}</small></div><div style="text-align:right"><strong>${fmtMoney(balance)}</strong>${!third&&a.id!=='acct-personal'?`<br><button class="btn btn-outline" style="width:auto;padding:5px 8px;margin-top:5px" data-platform-action="archive-account" data-id="${a.id}">Archivar</button>`:''}</div></div></section>`;
  }).join('')||'<section class="card">No hay cuentas activas.</section>';
}

function renderForecast(forecast=null){
  const page=document.body.dataset.page;if(page!=='index'&&page!=='calendar')return;const f=forecast||cashFlowForecast({days:45});
  if(page==='index'){
    const anchor=$('calendarPreviewZone');if(!anchor)return;ensureAfter(anchor,'platformForecastZone','<section class="card" style="border-left:5px solid #7c3aed"><h2>🔮 Proyección de flujo</h2><div id="platformForecastSummary"></div></section>');
    const box=$('platformForecastSummary');if(box){
      const msg=f.firstNegativeDate?`🔴 Con los datos actuales tu efectivo caería debajo de $0 alrededor del ${dateLabel(f.firstNegativeDate)}.`:f.firstTightDate?`🟠 Alrededor del ${dateLabel(f.firstTightDate)} empezarías a tocar dinero reservado o presupuesto necesario.`:`✅ No detecto faltantes en los próximos 45 días. Ingresos esperados: ${fmtMoney(f.totalExpectedIncome)}.`;
      box.innerHTML=`<div class="grid-2"><div><small>Efectivo en 45 días</small><strong style="display:block">${fmtMoney(f.endingCash)}</strong></div><div><small>Libre proyectado</small><strong style="display:block">${fmtMoney(f.endingFree)}</strong></div></div><small style="display:block;margin-top:8px;color:var(--text-sec)">${msg}</small>`;
    }
    return;
  }
  const anchor=$('calendarEvents');if(!anchor)return;ensureAfter(anchor,'platformForecastDetail','<section class="card" style="border-left:5px solid #7c3aed"><h2>🔮 Flujo proyectado</h2><div id="platformForecastTimeline"></div></section>');
  const box=$('platformForecastTimeline');if(box)box.innerHTML=`<div class="grid-2" style="margin-bottom:8px"><div><small>Efectivo actual</small><strong style="display:block">${fmtMoney(f.startCash)}</strong></div><div><small>Libre al final</small><strong style="display:block">${fmtMoney(f.endingFree)}</strong></div></div>${f.events.slice(0,10).map(e=>`<div style="display:flex;justify-content:space-between;gap:8px;padding:6px 0;border-top:1px solid #e2e8f0"><span>${dateLabel(e.date)} · ${esc(e.title)}${e.estimated?' <small>(estimado)</small>':''}</span><strong>${e.delta>=0?'+':'-'}${fmtMoney(Math.abs(e.delta))}<br><small>saldo ${fmtMoney(e.projectedCash)} · libre ${fmtMoney(e.projectedFree)}</small></strong></div>`).join('')||'<small>No hay movimientos futuros suficientes para proyectar.</small>'}`;
}

function renderAutomation(){
  if(document.body.dataset.page!=='calendar')return;ensureAutomationEngine();const anchor=$('workTransportZone')?.parentElement||$('calendarCommitments');if(!anchor)return;
  ensureAfter(anchor,'platformAutomationZone','<section class="card"><div style="display:flex;justify-content:space-between;gap:8px"><div><h2 style="margin:0">🤖 Automatizaciones</h2><small style="color:var(--text-sec)">Reglas que actúan cuando entra dinero.</small></div><button class="btn btn-primary" style="width:auto" data-platform-action="new-rule">+ Regla</button></div><button class="btn btn-outline" style="margin-top:8px" data-platform-action="min-free">Configurar colchón mínimo</button><div id="platformRuleRows" style="margin-top:10px"></div></section>');
  const rules=listAutomationRules(),rows=$('platformRuleRows');if(rows)rows.innerHTML=rules.length?rules.map(r=>{const goal=Data.getState().savingsGoals?.find(g=>g.id===r.goalId),source=r.sourceId?Data.fuenteById(r.sourceId):null;return `<div style="padding:8px 0;border-top:1px solid #e2e8f0"><div style="display:flex;justify-content:space-between;gap:8px"><span><strong>${esc(r.name)}</strong><small style="display:block;color:var(--text-sec)">${r.percent}% de ${source?esc(source.name):'cualquier ingreso'} → ${esc(goal?.name||'meta')}</small></span><button class="btn btn-outline" style="width:auto" data-platform-action="toggle-rule" data-id="${r.id}" data-active="${r.active!==false}">${r.active!==false?'Pausar':'Activar'}</button></div></div>`;}).join(''):'<small>No tienes reglas automáticas. Puedes crear una para apartar un porcentaje de cada ingreso hacia una meta.</small>';
}

function renderAlerts(alerts=null){
  const page=document.body.dataset.page;if(page!=='index'&&page!=='calendar')return;const rows=alerts||smartAlerts(),panel=$('panelAlerts');
  if(panel){panel.querySelectorAll('[data-platform-alert]').forEach(node=>node.remove());for(const a of rows){const div=document.createElement('div');div.dataset.platformAlert='1';div.style.cssText='padding:7px 0;border-top:1px solid #e2e8f0';div.innerHTML=`${a.level==='critical'?'🔴':'🟠'} <strong>${esc(a.title)}</strong><br><small>${esc(a.message)}</small>`;panel.append(div);}}
  if(page!=='calendar')return;
  let zone=$('platformCalendarAlerts');if(!rows.length){zone?.remove();return;}const anchor=$('calendarPosition');if(!anchor)return;if(!zone){zone=document.createElement('div');zone.id='platformCalendarAlerts';anchor.parentElement.insertAdjacentElement('afterend',zone);}
  zone.innerHTML=`<section class="card" style="border-left:5px solid #f59e0b"><h2>⚠️ Atención</h2>${rows.map(a=>`<div style="padding:5px 0"><strong>${esc(a.title)}</strong><br><small>${esc(a.message)}</small></div>`).join('')}</section>`;
}

function renderHealth(){
  if(document.body.dataset.page!=='stats')return;const h=financialHealth(),anchor=$('statsGeneral')?.parentElement;if(!anchor)return;
  const zone=ensureBefore(anchor,'platformHealthZone','<section class="card" style="border-left:5px solid #0f766e"><div id="platformHealthContent"></div></section>'),box=$('platformHealthContent');
  if(box)box.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px"><div><h2 style="margin:0">🩺 Salud financiera</h2><small style="color:var(--text-sec)">Puntuación explicable, no una caja negra.</small></div><strong style="font-size:1.8rem">${h.score}/100</strong></div><strong style="display:block;margin:8px 0;text-transform:capitalize">Estado: ${esc(h.status)}</strong>${h.breakdown.map(b=>`<div style="padding:7px 0;border-top:1px solid #e2e8f0"><div style="display:flex;justify-content:space-between"><strong>${esc(b.label)}</strong><strong>${b.score}/${b.max}</strong></div><small>${esc(b.detail)}</small></div>`).join('')}<small style="display:block;margin-top:8px;color:var(--text-sec)">Ingreso mensual observado ${fmtMoney(h.monthlyIncome)} · gasto observado ${fmtMoney(h.monthlyExpense)} · carga esencial estimada ${fmtMoney(h.essentialMonthly)}.</small>`;
  void zone;
}

function renderSmartGoals(){
  if(document.body.dataset.page!=='wallet')return;const anchor=$('savingsGoalsContainer');if(!anchor)return;ensureAfter(anchor,'platformSmartGoals','<section><h2 style="margin:14px 4px 8px">🧠 Plan inteligente de metas</h2><div id="platformSmartGoalRows"></div></section>');
  const rows=$('platformSmartGoalRows'),plans=goalPortfolioPlan();if(!rows)return;
  rows.innerHTML=plans.length?plans.map(p=>{const status=p.status==='complete'?'✅ Completada':p.status==='on_track'?'🟢 En ruta':p.status==='at_risk'?'🟠 Ajustada':'🔴 Sin capacidad detectada';const source=p.sourcePlan?.find(s=>s.suggested>0);return `<section class="card"><div style="display:flex;justify-content:space-between;gap:8px"><strong>🎯 ${esc(p.goal.name)}</strong><strong>${status}</strong></div>${p.status==='complete'?'<small>Objetivo alcanzado.</small>':`<div class="grid-2" style="margin-top:8px"><div><small>Necesitas / mes</small><strong style="display:block">${fmtMoney(p.requiredMonthly)}</strong></div><div><small>Capacidad observada</small><strong style="display:block">${fmtMoney(p.availableMonthly)}</strong></div></div><small style="display:block;margin-top:7px">${p.suggestedNow>0?`Puedes apartar ahora hasta <strong>${fmtMoney(p.suggestedNow)}</strong>${source?` usando lo generado por ${esc(source.name)}`:''}.`:'No detecto dinero realmente libre suficiente para aportar ahora.'}${p.estimatedCompletionDate?` A este ritmo, fecha estimada: <strong>${dateLong(p.estimatedCompletionDate)}</strong>.`:''}</small>`}</section>`;}).join(''):'<small>Crea una meta para generar un plan.</small>';
}

function renderHistory(){
  if(document.body.dataset.page!=='historial'||!$('tablaBody'))return;const s=Data.getState(),events=[];
  for(const m of s.movimientos||[]){
    if(m.tipo==='transferencia'){const from=s.accounts.find(a=>a.id===m.fromAccountId),to=s.accounts.find(a=>a.id===m.toAccountId);events.push({fecha:m.fecha,title:'Transferencia',meta:`${from?.name||'Cuenta'} → ${to?.name||'Cuenta'}`,mode:'transfer',amount:safeFloat(m.monto)});}
    else events.push({fecha:m.fecha,title:m.desc,meta:`${m.categoria||''}${m.accountId?` · ${s.accounts.find(a=>a.id===m.accountId)?.name||'Cuenta'}`:''}${m.affectsPersonal===false?' · no afecta patrimonio':''}`,mode:m.tipo,amount:safeFloat(m.monto)});
  }
  for(const t of s.turnos||[]){const src=s.workSources.find(x=>x.id===t.sourceId);events.push({fecha:t.fecha,title:`Actividad · ${src?.name||'Trabajo'}`,meta:`${safeFloat(t.duracionHoras).toFixed(1)} h${safeFloat(t.kmRecorrido)>0?` · ${safeFloat(t.kmRecorrido).toFixed(0)} km`:''}`,mode:'activity',amount:null});}
  for(const f of s.fondosCombustibleEmpresa||[]){const src=s.workSources.find(x=>x.id===f.sourceId);events.push({fecha:f.fecha,title:f.desc||`Depósito empresa · ${src?.name||'Trabajo'}`,meta:'Fondo de tercero · no afecta patrimonio',mode:'fund',amount:safeFloat(f.monto)});}
  for(const c of (s.cargasCombustible||[]).filter(x=>x.pagador==='empresa')){const src=s.workSources.find(x=>x.id===c.sourceId);events.push({fecha:c.fecha,title:`Combustible${c.gasolinera?` · ${c.gasolinera}`:''}`,meta:`${src?.name||'Empresa'} · ${safeFloat(c.litros).toFixed(2)} L · fondo de tercero`,mode:'fuel',amount:safeFloat(c.costo)});}
  events.sort((a,b)=>new Date(b.fecha)-new Date(a.fecha));
  $('tablaBody').innerHTML=events.slice(0,150).map(e=>{let value='—',color='var(--text-sec)';if(e.mode==='transfer')value=`⇄ ${fmtMoney(e.amount)}`;else if(e.mode==='ingreso'){value=`+${fmtMoney(e.amount)}`;color='#16a34a';}else if(['gasto','fuel'].includes(e.mode)){value=`-${fmtMoney(e.amount)}`;color='#dc2626';}else if(e.mode==='fund'){value=`+${fmtMoney(e.amount)}`;color='#f59e0b';}return `<tr><td>${dateLabel(e.fecha)}<br><small>${new Date(e.fecha).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'})}</small></td><td><strong>${esc(e.title)}</strong><br><small>${esc(e.meta)}</small></td><td style="text-align:right;font-weight:bold;color:${color}">${value}</td></tr>`;}).join('')||'<tr><td colspan="3">Sin actividad todavía</td></tr>';
}

export function ensureFinancialPlatform(){ensureAccountsEngine();ensureAutomationEngine();}
export function renderFinancialPlatform(){
  const page=document.body.dataset.page;
  if(page==='wallet'){renderAccountsHub();renderSmartGoals();return;}
  if(page==='index'||page==='calendar'){
    const forecast=cashFlowForecast({days:45}),alerts=smartAlerts(new Date(),{forecast});renderForecast(forecast);renderAlerts(alerts);if(page==='calendar')renderAutomation();return;
  }
  if(page==='stats'){renderHealth();return;}
  if(page==='historial')renderHistory();
}

function newAccount(){Modal.show('Nueva cuenta',[{label:'Nombre',key:'n',placeholder:'Efectivo, BBVA, Nu...'},{label:'Tipo',key:'t',type:'select',options:[{val:'cash',txt:'Efectivo / caja'},{val:'bank',txt:'Cuenta bancaria'},{val:'wallet',txt:'Wallet digital'}]}],d=>run(()=>createPersonalAccount({name:d.n,type:d.t}),{automate:false}));}
function transfer(){const accounts=getPersonalAccounts({activeOnly:true});if(accounts.length<2)return alert('Necesitas al menos dos cuentas personales para transferir.');Modal.show('Transferir entre mis cuentas',[{label:'Desde',key:'f',type:'select',options:accounts.map(a=>({val:a.id,txt:`${a.name} · ${fmtMoney(accountBalance(a.id))}`}))},{label:'Hacia',key:'t',type:'select',options:accounts.map(a=>({val:a.id,txt:a.name}))},{label:'Monto',key:'m',type:'number'},{label:'Nota (opcional)',key:'n'}],d=>run(()=>transferBetweenAccounts({fromAccountId:d.f,toAccountId:d.t,amount:d.m,note:d.n}),{automate:false}));}
function movement(){const accounts=getPersonalAccounts({activeOnly:true});if(!accounts.length)return alert('Primero crea una cuenta.');const sources=[{val:'',txt:'Personal / sin fuente'},...Data.getState().workSources.filter(s=>s.active!==false).map(s=>({val:s.id,txt:s.name}))];Modal.show('Nuevo movimiento',[{label:'Tipo',key:'t',type:'select',options:[{val:'expense',txt:'Gasto'},{val:'income',txt:'Ingreso'}]},{label:'Cuenta',key:'a',type:'select',options:accounts.map(a=>({val:a.id,txt:`${a.name} · ${fmtMoney(accountBalance(a.id))}`}))},{label:'Descripción',key:'d'},{label:'Monto',key:'m',type:'number'},{label:'Categoría',key:'c',placeholder:'Comida, vivienda, trabajo...'},{label:'Fuente (opcional)',key:'s',type:'select',options:sources}],d=>run(()=>recordUniversalMovement({type:d.t,description:d.d,amount:d.m,accountId:d.a,category:d.c||'Otro',sourceId:d.s||null})));}
function newRule(){const goals=(Data.getState().savingsGoals||[]).filter(g=>g.active!==false&&safeFloat(g.reserved)<safeFloat(g.targetAmount));if(!goals.length)return alert('Primero crea una meta de ahorro activa.');const sources=[{val:'',txt:'Cualquier ingreso'},...Data.getState().workSources.filter(s=>s.active!==false).map(s=>({val:s.id,txt:s.name}))];Modal.show('Nueva automatización',[{label:'Meta',key:'g',type:'select',options:goals.map(g=>({val:g.id,txt:g.name}))},{label:'Apartar porcentaje de cada ingreso',key:'p',type:'number',value:10},{label:'Solo de esta fuente (opcional)',key:'s',type:'select',options:sources},{label:'Nombre de la regla (opcional)',key:'n'}],d=>run(()=>createReserveRule({goalId:d.g,percent:d.p,sourceId:d.s||null,name:d.n}),{automate:false}));}
function minFree(){const current=Data.getState().automationPreferences?.minFreeCash||0;Modal.show('Colchón mínimo',[{label:'Avísame si mi dinero libre baja de ($)',key:'m',type:'number',value:current}],d=>run(()=>setMinFreeCashAlert(d.m),{automate:false}));}

export function initFinancialPlatformEvents(onChange){changeHandler=onChange||(()=>{});if(eventsBound)return;eventsBound=true;document.addEventListener('click',e=>{const b=e.target.closest('[data-platform-action]');if(!b||b.disabled)return;const a=b.dataset.platformAction;if(a==='new-account')return newAccount();if(a==='transfer')return transfer();if(a==='movement')return movement();if(a==='archive-account')return run(()=>setAccountActive(b.dataset.id,false),{automate:false});if(a==='new-rule')return newRule();if(a==='min-free')return minFree();if(a==='toggle-rule')return run(()=>setAutomationRuleActive(b.dataset.id,b.dataset.active!=='true'),{automate:false});});}