/* v3.0.0 - Calendario como vista pura del núcleo financiero canónico. */
import { $, fmtMoney } from './01_consts_utils.js';
import { ensureFinancialLife, financialPosition, upcomingFinancialEvents, sourceCostProfile } from './21_financial_life_v27.js';
import { getState } from './02_data.js';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const typeIcon=t=>t==='income'?'💵':t==='debt'?'💳':t==='goal'?'🎯':'📅';
const dateLabel=d=>new Date(d).toLocaleDateString('es-MX',{weekday:'short',day:'numeric',month:'short'});
const eventDate=e=>e.overdue?`⚠️ Vencido ${dateLabel(e.dueDate||e.date)}`:dateLabel(e.date);

export function renderFinancialPositionPanel(){
  if(!$('mainSummaryValue'))return;
  ensureFinancialLife();
  const pos=financialPosition(),state=getState();
  $('mainSummaryValue').textContent=fmtMoney(pos.free);
  if($('mainSummarySub'))$('mainSummarySub').textContent=pos.free<0?'Tu dinero actual no cubre todo lo que ya está comprometido.':'Después de hogar, compromisos y metas.';
  if($('financialPositionZone'))$('financialPositionZone').innerHTML=`<div><small>💰 Dinero que tienes</small><strong style="display:block">${fmtMoney(pos.cash)}</strong></div><div><small>📌 Comprometido</small><strong style="display:block">${fmtMoney(pos.committed)}</strong></div><div><small>🎯 Reservado metas</small><strong style="display:block">${fmtMoney(pos.reserved)}</strong></div><div><small>✅ Realmente libre</small><strong style="display:block;color:${pos.free<0?'var(--danger)':'#16a34a'}">${fmtMoney(pos.free)}</strong></div>`;

  const zone=$('sourceSummaryZone');
  if(zone)for(const source of(state.workSources||[]).filter(s=>s.active!==false&&s.status!=='ended'&&s.status!=='paused')){
    const card=[...zone.querySelectorAll('.card')].find(el=>el.textContent.includes(source.name));if(!card)continue;
    const cost=sourceCostProfile(source.id);if(!cost||cost.publicTransport<=0||card.querySelector('[data-work-cost]'))continue;
    const small=document.createElement('small');small.dataset.workCost='1';small.style.cssText='display:block;color:var(--text-sec);margin-top:6px';small.textContent=`🚌 Traslado estimado ${fmtMoney(cost.publicTransport)}/mes`;card.append(small);
  }
}

export function renderCalendarPage(){
  ensureFinancialLife();
  const pos=financialPosition();
  if($('calendarPosition'))$('calendarPosition').innerHTML=`<div class="grid-2"><div><small>Dinero que tienes</small><strong style="display:block;font-size:1.25rem">${fmtMoney(pos.cash)}</strong></div><div><small>Comprometido</small><strong style="display:block;font-size:1.25rem">${fmtMoney(pos.committed)}</strong></div><div><small>Reservado para metas</small><strong style="display:block;font-size:1.25rem">${fmtMoney(pos.reserved)}</strong></div><div><small>Realmente libre</small><strong style="display:block;font-size:1.25rem;color:${pos.free<0?'var(--danger)':'#16a34a'}">${fmtMoney(pos.free)}</strong></div></div><small style="display:block;margin-top:10px;color:var(--text-sec)">Comprometido = pagos pendientes + presupuestos del hogar + reservas futuras + transporte laboral.</small>${pos.homeReserve>0?`<small style="display:block;margin-top:5px;color:var(--text-sec)">🧊 ${fmtMoney(pos.homeReserve)} se está apartando gradualmente para necesidades futuras.</small>`:''}`;

  const events=upcomingFinancialEvents({days:45});
  if($('calendarEvents'))$('calendarEvents').innerHTML=events.length?events.map(e=>`<section class="card" style="margin:8px 0;border-left:4px solid ${e.overdue?'#dc2626':e.type==='income'?'#16a34a':e.type==='goal'?'#6366f1':e.household?'#dc2626':'#f59e0b'}"><div style="display:flex;justify-content:space-between;gap:10px"><div><strong>${e.household?'🏠':typeIcon(e.type)} ${esc(e.title)}</strong><small style="display:block;color:${e.overdue?'#dc2626':'var(--text-sec)'};margin-top:3px">${eventDate(e)} · ${esc(e.category||'')}</small></div><strong>${e.amount===null?'—':fmtMoney(e.amount)}</strong></div></section>`).join(''):'<section class="card">No hay eventos financieros próximos.</section>';
}

export function renderCalendarPreview(){
  const zone=$('calendarPreviewZone');if(!zone)return;
  const events=upcomingFinancialEvents({days:30}).slice(0,4),pos=financialPosition();
  zone.innerHTML=`<section class="card" style="border-left:5px solid #0f766e"><div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start"><div><h2 style="margin:0">📆 Calendario financiero</h2><small style="color:var(--text-sec)">Próximos pagos, ingresos y metas.</small></div><a href="calendar.html" class="btn btn-outline" style="width:auto;text-decoration:none">Abrir</a></div><div style="margin:12px 0 8px"><strong>Realmente libre: ${fmtMoney(pos.free)}</strong></div>${events.length?events.map(e=>`<div style="display:flex;justify-content:space-between;gap:8px;padding:5px 0"><span>${e.household?'🏠':typeIcon(e.type)} ${esc(e.title)}<br><small style="color:${e.overdue?'#dc2626':'inherit'}">${eventDate(e)}</small></span><strong>${e.amount===null?'—':fmtMoney(e.amount)}</strong></div>`).join(''):'<small>Sin eventos próximos.</small>'}</section>`;
}

/* Compatibilidad del orquestador: Calendario ya no crea ni modifica compromisos. */
export function initCalendarEvents(){}
