/* v3.0.0 - Calendario como vista pura del núcleo financiero canónico. */
import { $, fmtMoney } from './01_consts_utils.js';
import { ensureFinancialLife, financialPosition, upcomingFinancialEvents, sourceCostProfile } from './21_financial_life_v27.js';
import { getState } from './02_data.js';
import { financialContext } from './app/financial-context.js';
import {paymentDueState} from './domain/financial-rules.js';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const typeIcon=t=>t==='income'?'💵':t==='debt'?'💳':t==='goal'?'🎯':'📅';
const dateLabel=d=>new Date(d).toLocaleDateString('es-MX',{weekday:'short',day:'numeric',month:'short'});
const eventDate=e=>['expense','debt'].includes(e.type)?`${{overdue:'⚠️ Vencido ',due_today:'Vence hoy · ',due_tomorrow:'Vence mañana · ',scheduled:''}[paymentDueState(e)]||''}${dateLabel(e.dueDate||e.date)}`:dateLabel(e.date);

const todayPositionMarkup=pos=>`<div class="grid-2"><div><small>💰 Dinero que tienes</small><strong style="display:block">${fmtMoney(pos.cash)}</strong></div><div><small>📌 Exigible hoy</small><strong style="display:block">${fmtMoney(pos.dueNow)}</strong></div><div><small>🎯 Reservado metas</small><strong style="display:block">${fmtMoney(pos.reserved)}</strong></div><div><small>✅ Disponible hoy</small><strong style="display:block;color:${pos.availableToday<0?'var(--danger)':'#16a34a'}">${fmtMoney(pos.availableToday)}</strong></div></div><small style="display:block;margin-top:8px;color:var(--text-sec)">Exigible hoy: vencidos ${fmtMoney(pos.overdue)} · vence hoy ${fmtMoney(pos.dueToday)}.</small>`;
const planningPositionMarkup=({planning:plan,scenario})=>`<div class="grid-2" style="margin:12px 0 8px"><div><small>Ingresos esperados · ${plan.days} días</small><strong style="display:block">${fmtMoney(plan.expectedIncome)}</strong></div><div><small>Pagos previstos · ${plan.days} días</small><strong style="display:block">${fmtMoney(plan.expectedOutflow)}</strong></div></div><div><small>Disponible proyectado · ${plan.days} días</small><strong style="display:block;color:${plan.endingFree<0?'var(--danger)':'#16a34a'}">${fmtMoney(plan.endingFree)}</strong></div><small style="display:block;margin-top:8px;color:var(--text-sec)">Proyección hasta el ${dateLabel(plan.until)}: efectivo actual más ingresos esperados, menos pagos previstos y reservas protegidas.${scenario.includeVariable?' Incluye flujo variable neto estimado.':''} Los ingresos esperados no son dinero disponible hoy.</small>`;
const planningEvents=context=>{
  const projected=new Map(context.forecast.events.map(e=>[e.id,e]));
  return upcomingFinancialEvents({days:context.scenario.days,now:context.now}).map(e=>projected.get(e.id)||e);
};

export function renderFinancialPositionPanel(){
  if(!$('mainSummaryValue'))return;
  ensureFinancialLife();
  const now=new Date(),pos=financialPosition(now),state=getState();
  $('mainSummaryValue').textContent=fmtMoney(pos.availableToday);
  if($('mainSummarySub'))$('mainSummarySub').textContent=pos.availableToday<0?'Tu efectivo no cubre las metas reservadas y los pagos exigibles hoy.':'Después de metas y pagos exigibles hoy; antes de pagos futuros y presupuestos.';
  if($('financialPositionZone'))$('financialPositionZone').innerHTML=todayPositionMarkup(pos)+(pos.planningReserve>0?`<small style="display:block;margin-top:8px;color:var(--text-sec)">Para apartar hoy: ${fmtMoney(pos.savingsAvailableNow)} · presupuestos, reservas y transporte protegidos: ${fmtMoney(pos.planningReserve)}.</small>`:'');

  const zone=$('sourceSummaryZone');
  if(zone)for(const source of(state.workSources||[]).filter(s=>s.active!==false&&s.status!=='ended'&&s.status!=='paused')){
    const card=[...zone.querySelectorAll('.card')].find(el=>el.textContent.includes(source.name));if(!card)continue;
    const cost=sourceCostProfile(source.id,now);if(!cost||cost.publicTransport<=0||card.querySelector('[data-work-cost]'))continue;
    const small=document.createElement('small');small.dataset.workCost='1';small.style.cssText='display:block;color:var(--text-sec);margin-top:6px';small.textContent=`🚌 Traslado estimado ${fmtMoney(cost.publicTransport)}/mes`;card.append(small);
  }
}

export function renderCalendarPage(){
  ensureFinancialLife();
  const now=new Date(),context=financialContext({now}),pos=context.position;
  if($('calendarPosition'))$('calendarPosition').innerHTML=`${todayPositionMarkup(pos)}<h2 style="margin-top:14px">Planificación · ${context.scenario.days} días</h2>${planningPositionMarkup(context)}${pos.homeReserve>0?`<small style="display:block;margin-top:5px;color:var(--text-sec)">🧊 ${fmtMoney(pos.homeReserve)} se está apartando gradualmente para necesidades futuras.</small>`:''}`;

  const events=planningEvents(context);
  if($('calendarEvents'))$('calendarEvents').innerHTML=events.length?events.map(e=>`<section class="card" style="margin:8px 0;border-left:4px solid ${e.overdue?'#dc2626':e.type==='income'?'#16a34a':e.type==='goal'?'#6366f1':e.household?'#dc2626':'#f59e0b'}"><div style="display:flex;justify-content:space-between;gap:10px"><div><strong>${e.household?'🏠':typeIcon(e.type)} ${esc(e.title)}</strong><small style="display:block;color:${e.overdue?'#dc2626':'var(--text-sec)'};margin-top:3px">${eventDate(e)} · ${esc(e.category||'')}</small></div><strong>${e.amount===null?'—':fmtMoney(e.amount)}${e.estimated?'<small style="display:block">estimado</small>':''}</strong></div></section>`).join(''):'<section class="card">No hay eventos financieros próximos.</section>';
}

export function renderCalendarPreview(){
  const zone=$('calendarPreviewZone');if(!zone)return;
  const now=new Date(),context=financialContext({now}),events=planningEvents(context).slice(0,4);
  zone.innerHTML=`<section class="card" style="border-left:5px solid #0f766e"><div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start"><div><h2 style="margin:0">📆 Calendario financiero</h2><small style="color:var(--text-sec)">Próximos pagos, ingresos y metas.</small></div><a href="calendar.html" class="btn btn-outline" style="width:auto;text-decoration:none">Abrir</a></div>${planningPositionMarkup(context)}<div style="margin-top:12px">${events.length?events.map(e=>`<div style="display:flex;justify-content:space-between;gap:8px;padding:5px 0"><span>${e.household?'🏠':typeIcon(e.type)} ${esc(e.title)}<br><small style="color:${e.overdue?'#dc2626':'inherit'}">${eventDate(e)}</small></span><strong>${e.amount===null?'—':fmtMoney(e.amount)}${e.estimated?'<small style="display:block">estimado</small>':''}</strong></div>`).join(''):'<small>Sin eventos próximos.</small>'}</div></section>`;
}

/* Compatibilidad del orquestador: Calendario ya no crea ni modifica compromisos. */
export function initCalendarEvents(){}
