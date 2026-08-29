/* v2.1.0 - UI de metas de ahorro y advertencias de retiro. */
import { $, fmtMoney } from './01_consts_utils.js';
import { Modal } from './03_render.js';
import { getState } from './02_data.js';
import {
  ensureSavingsGoals,getSavingsGoals,createSavingsGoal,contributeToSavingsGoal,
  withdrawFromSavingsGoal,savingsGoalSummary,savingsCapacity,previewSavingsWithdrawal
} from './11_savings_goals.js';

const ERRORS={
  NOMBRE_INVALIDO:'Escribe un nombre para la meta.',MONTO_META_INVALIDO:'Ingresa un monto mayor a 0.',
  FECHA_META_INVALIDA:'La fecha objetivo debe ser válida y no puede estar en el pasado.',META_NO_ENCONTRADA:'No se encontró esa meta.',
  SALDO_DISPONIBLE_INSUFICIENTE:'No tienes suficiente dinero disponible para reservar ese monto.',
  RETIRO_SUPERA_RESERVA:'No puedes retirar más de lo que tienes reservado.'
};
const escapeHtml=value=>String(value??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const priorityLabel=p=>p==='high'?'Alta':p==='low'?'Baja':'Normal';
const dateLabel=d=>d?new Date(d).toLocaleDateString('es-MX',{day:'numeric',month:'short',year:'numeric'}):'Sin fecha límite';

function run(action,onChange){
  try{action();onChange?.();document.dispatchEvent(new CustomEvent('budget:data-changed'));}
  catch(e){console.error(e);alert(ERRORS[e.message]||'No se pudo completar la operación.');}
}

function sourceAdvice(capacity){
  if(!capacity)return '';
  const rows=capacity.sources.map(s=>{
    if(s.income<=0)return `<div style="display:flex;justify-content:space-between;gap:8px"><span>${escapeHtml(s.name)}</span><small>sin ingreso este mes</small></div>`;
    return `<div style="display:flex;justify-content:space-between;gap:8px"><span>${escapeHtml(s.name)}</span><small>${s.suggested>0?`podrías apartar ${fmtMoney(s.suggested)}`:`generó ${fmtMoney(s.income)}`}</small></div>`;
  }).join('');
  const general=capacity.suggestedNow>0?`<div style="margin-top:7px"><strong>💡 Sugerencia ahora: ${fmtMoney(capacity.suggestedNow)}</strong></div>`:'<div style="margin-top:7px"><small>Por ahora no detecto excedente seguro para apartar sin tocar tu colchón operativo.</small></div>';
  return `<div style="margin-top:10px;padding:10px;background:#f8fafc;border-radius:10px">${rows}${general}</div>`;
}

export function renderSavingsGoalsUI(){
  ensureSavingsGoals();
  const container=$('savingsGoalsContainer');
  if(container){
    const goals=getSavingsGoals().filter(g=>g.active!==false);
    container.innerHTML=goals.length?goals.map(g=>{
      const r=savingsGoalSummary(g.id),c=savingsCapacity(g.id),done=r.complete;
      return `<section class="card" style="border-left:5px solid ${done?'#16a34a':'#6366f1'}">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start">
          <div><strong>🎯 ${escapeHtml(g.name)}</strong><small style="display:block;color:var(--text-sec);margin-top:3px">Prioridad ${priorityLabel(g.priority)} · ${dateLabel(g.targetDate)}</small></div>
          <strong>${r.progress.toFixed(0)}%</strong>
        </div>
        <div style="height:9px;background:#e5e7eb;border-radius:999px;overflow:hidden;margin:12px 0 8px"><div style="height:100%;width:${r.progress}%;background:${done?'#16a34a':'#6366f1'}"></div></div>
        <div style="display:flex;justify-content:space-between;gap:10px"><span>Reservado <strong>${fmtMoney(r.reserved)}</strong></span><span>Meta <strong>${fmtMoney(r.target)}</strong></span></div>
        <small style="display:block;margin-top:6px;color:var(--text-sec)">${done?'✅ Meta completada':r.overdue?`⚠️ Fecha vencida · faltan ${fmtMoney(r.remaining)}`:`Faltan ${fmtMoney(r.remaining)} · ritmo ${fmtMoney(r.requiredMonthly)}/mes`}</small>
        ${done?'':sourceAdvice(c)}
        <div class="grid-2" style="margin-top:12px"><button class="btn btn-primary" data-goal-action="contribute" data-id="${g.id}">💎 Apartar</button><button class="btn btn-outline" data-goal-action="withdraw" data-id="${g.id}" ${r.reserved<=0?'disabled':''}>Usar dinero</button></div>
      </section>`;
    }).join(''):'<section class="card"><strong>🎯 Todavía no tienes metas</strong><p style="font-size:.85rem;color:var(--text-sec);margin-top:5px">Crea una meta y la app calculará cuánto necesitas reservar y de qué ingresos puede salir.</p></section>';
  }

  const alerts=$('panelAlerts');
  if(alerts){
    const goals=getSavingsGoals().filter(g=>g.active!==false&&!savingsGoalSummary(g.id).complete);
    if(goals.length){
      const first=goals.sort((a,b)=>a.priority==='high'?-1:b.priority==='high'?1:0)[0],r=savingsGoalSummary(first.id),c=savingsCapacity(first.id);
      const source=c.sources.find(s=>s.suggested>0);
      let text=r.overdue?`🎯 <strong>${escapeHtml(first.name)}</strong>: la fecha objetivo venció y faltan <strong>${fmtMoney(r.remaining)}</strong>.`:`🎯 <strong>${escapeHtml(first.name)}</strong>: necesitas aproximadamente <strong>${fmtMoney(r.requiredMonthly)}/mes</strong>.`;
      if(c.suggestedNow>0)text+=` Puedes apartar ahora <strong>${fmtMoney(c.suggestedNow)}</strong>${source?` desde lo generado por ${escapeHtml(source.name)}`:''}.`;
      const div=document.createElement('div');div.style.padding='5px 0';div.innerHTML=text;alerts.append(div);
    }
  }
}

function newGoal(onChange){
  const defaultDate=new Date();defaultDate.setMonth(defaultDate.getMonth()+6);
  Modal.show('Nueva meta de ahorro',[
    {label:'¿Qué quieres lograr?',key:'n',placeholder:'Ej. Fondo de emergencia'},
    {label:'Monto objetivo ($)',key:'m',type:'number'},
    {label:'Fecha objetivo',key:'d',type:'date',value:defaultDate.toISOString().slice(0,10)},
    {label:'Prioridad',key:'p',type:'select',options:[{val:'high',txt:'Alta'},{val:'normal',txt:'Normal'},{val:'low',txt:'Baja'}]}
  ],d=>run(()=>createSavingsGoal({name:d.n,targetAmount:d.m,targetDate:d.d,priority:d.p}),onChange));
}

function contribute(id,onChange){
  const sourceOptions=[{val:'',txt:'Sin asociar a una fuente'},...getState().workSources.filter(s=>s.active!==false).map(s=>({val:s.id,txt:s.name}))];
  Modal.show('Apartar dinero para la meta',[
    {label:'Monto a reservar ($)',key:'m',type:'number'},
    {label:'¿De qué ingreso proviene? (opcional)',key:'s',type:'select',options:sourceOptions}
  ],d=>run(()=>contributeToSavingsGoal(id,d.m,{sourceId:d.s||null}),onChange));
}

function withdraw(id,onChange){
  const goal=getSavingsGoals().find(g=>g.id===id);if(!goal)return;
  Modal.show(`Usar dinero · ${goal.name}`,[{label:'Monto que quieres liberar ($)',key:'m',type:'number'}],d=>{
    try{
      const p=previewSavingsWithdrawal(id,d.m);
      const delay=p.delayDays!==null&&p.delayDays>0?`\nSi mantienes tu ritmo actual, podría retrasar la meta alrededor de ${p.delayDays} días.`:'';
      const recovery=p.recoveryLikely?'Con el flujo registrado este mes, parece recuperable si mantienes ese ritmo.':'Con el flujo registrado este mes, no puedo asegurar que puedas reponerlo sin ajustar gastos o ingresos.';
      const msg=`⚠️ Vas a liberar ${fmtMoney(p.amount)} de “${goal.name}”.\n\nReservado: ${fmtMoney(p.before.reserved)} → ${fmtMoney(p.afterReserved)}\nNuevo ritmo necesario: ${fmtMoney(p.afterRequiredMonthly)}/mes\nEso exige ${fmtMoney(p.extraPerMonth)} extra por mes.${delay}\n\n${recovery}\n\n¿Seguro que quieres usarlo?`;
      if(!confirm(msg))return;
      run(()=>withdrawFromSavingsGoal(id,p.amount),onChange);
    }catch(e){console.error(e);alert(ERRORS[e.message]||'No se pudo calcular el retiro.');}
  });
}

export function initSavingsGoalEvents(onChange){
  $('btnNewSavingsGoal')?.addEventListener('click',()=>newGoal(onChange));
  document.addEventListener('click',e=>{
    const b=e.target.closest('[data-goal-action]');if(!b||b.disabled)return;
    if(b.dataset.goalAction==='contribute')contribute(b.dataset.id,onChange);
    if(b.dataset.goalAction==='withdraw')withdraw(b.dataset.id,onChange);
  });
}
