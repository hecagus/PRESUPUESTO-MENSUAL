/* v2.7.1 - UI de Hogar con vencidos y reserva de recibos futuros. */
import { $, fmtMoney } from './01_consts_utils.js';
import { Modal } from './03_render.js';
import {
  ensureHousehold,householdItems,householdSummary,householdBudgetStatus,householdMonthlyEquivalent,householdUpcomingEvents,
  createHouseholdExpense,updateHouseholdExpense,setHouseholdExpenseActive,recordHouseholdExpense,
  HOME_PRIORITIES,HOME_FREQUENCIES,HOME_CATEGORIES
} from './20_home_engine.js';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const freqLabel=f=>HOME_FREQUENCIES[f]||f;
const priorityLabel=p=>HOME_PRIORITIES[p]?.label||p;
const priorityIcon=p=>HOME_PRIORITIES[p]?.icon||'•';
const dateLabel=d=>new Date(d).toLocaleDateString('es-MX',{day:'numeric',month:'short'});

function spentFor(id){return householdBudgetStatus().find(x=>x.item.id===id)||null;}
function overdueFor(id){return householdUpcomingEvents({days:45}).find(e=>e.refId===id&&e.overdue)||null;}
function itemStatus(item){
  if(item.priority==='budgeted'){
    const row=spentFor(item.id);return row?`${fmtMoney(row.spent)} usados · ${fmtMoney(row.remaining)} disponibles este mes`:`Presupuesto aprox. ${fmtMoney(householdMonthlyEquivalent(item))}/mes`;
  }
  if(item.priority==='obligatory'){
    const overdue=overdueFor(item.id);if(overdue)return `⚠️ Vencido ${dateLabel(overdue.dueDate||overdue.date)} · pendiente de registrar`;
    if(item.frequency==='variable')return 'Variable · estimación mensual reservada';
    return `${freqLabel(item.frequency)} · ${item.nextDueDate?`próximo ${dateLabel(`${item.nextDueDate}T09:00:00`)}`:`día ${item.dueDay}`}`;
  }
  return item.frequency==='one_time'?'Ocasional · sólo cuenta cuando lo gastas':`${freqLabel(item.frequency)} · no reduce tu dinero libre hasta gastarlo`;
}
function actionLabel(item){return item.priority==='obligatory'?'Pagar':'Registrar gasto';}

function section(title,items){
  if(!items.length)return `<section><div class="dashboard-section-title">${title}</div><div class="card"><small>No hay gastos en esta sección.</small></div></section>`;
  return `<section><div class="dashboard-section-title">${title}</div>${items.map(item=>`<article class="card" style="border-left:5px solid ${item.priority==='obligatory'?'#dc2626':item.priority==='budgeted'?'#eab308':'#2563eb'}">
    <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start"><div><strong>${priorityIcon(item.priority)} ${esc(item.name)}</strong><small style="display:block;color:var(--text-sec);margin-top:3px">${esc(item.category)} · ${esc(priorityLabel(item.priority))}</small></div><strong>${fmtMoney(item.amount)}</strong></div>
    <small style="display:block;color:var(--text-sec);margin:8px 0">${esc(itemStatus(item))}</small>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px"><button class="btn btn-primary" data-home-action="record" data-id="${item.id}">${actionLabel(item)}</button><button class="btn btn-outline" data-home-action="edit" data-id="${item.id}">Editar</button><button class="btn btn-outline" data-home-action="pause" data-id="${item.id}">Pausar</button></div>
  </article>`).join('')}</section>`;
}

export function renderHome(){
  if(!$('homeSummary'))return;ensureHousehold();const summary=householdSummary(),items=householdItems({activeOnly:true});
  $('homeSummary').innerHTML=`<div class="grid-2"><div><small>🔴 Obligatorio / mes</small><strong style="display:block;font-size:1.2rem">${fmtMoney(summary.mandatory)}</strong></div><div><small>🟡 Presupuestado / mes</small><strong style="display:block;font-size:1.2rem">${fmtMoney(summary.budgeted)}</strong></div><div><small>💸 Gastado este mes</small><strong style="display:block;font-size:1.2rem">${fmtMoney(summary.spent)}</strong></div><div><small>🧊 Reserva recibos futuros</small><strong style="display:block;font-size:1.2rem">${fmtMoney(summary.reserve)}</strong></div></div>`;
  const zone=$('homeExpenses');if(!zone)return;
  zone.innerHTML=section('🔴 Obligaciones',items.filter(x=>x.priority==='obligatory'))+section('🟡 Presupuestos',items.filter(x=>x.priority==='budgeted'))+section('🔵 Ocasionales y gustos',items.filter(x=>x.priority==='discretionary'));
  const paused=householdItems().filter(x=>x.active===false);$('homePaused')?.classList.toggle('hidden',!paused.length);
  if($('homePausedList'))$('homePausedList').innerHTML=paused.map(x=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid #e2e8f0"><span>${esc(x.name)}</span><button class="btn btn-outline" style="width:auto" data-home-action="resume" data-id="${x.id}">Reactivar</button></div>`).join('');
}

const categoryOptions=()=>HOME_CATEGORIES.map(x=>({val:x,txt:x}));
const priorityOptions=()=>Object.entries(HOME_PRIORITIES).map(([val,x])=>({val,txt:`${x.icon} ${x.label}`}));
const frequencyOptions=()=>Object.entries(HOME_FREQUENCIES).map(([val,txt])=>({val,txt}));

function itemModal(item,refresh){
  Modal.show(item?'Editar gasto del hogar':'Nuevo gasto del hogar',[
    {label:'Nombre',key:'name',value:item?.name||'',placeholder:'Luz, renta, despensa, Netflix...'},
    {label:'Monto estimado / presupuesto ($)',key:'amount',type:'number',value:item?.amount||''},
    {label:'Categoría',key:'category',type:'select',options:categoryOptions()},
    {label:'Nivel',key:'priority',type:'select',options:priorityOptions()},
    {label:'Frecuencia',key:'frequency',type:'select',options:frequencyOptions()},
    {label:'Día de pago (1-31)',key:'dueDay',type:'number',value:item?.dueDay||1},
    {label:'Próximo pago / fecha única (AAAA-MM-DD, opcional)',key:'nextDueDate',value:item?.nextDueDate||''}
  ],d=>run(()=>item?updateHouseholdExpense(item.id,d):createHouseholdExpense(d),refresh));
  setTimeout(()=>{const body=$('modalBody');if(!body)return;const set=(key,value)=>{const el=body.querySelector(`[data-k="${key}"]`);if(el)el.value=value;};set('category',item?.category||'Servicios');set('priority',item?.priority||'obligatory');set('frequency',item?.frequency||'monthly');},0);
}

function run(fn,refresh){try{fn();refresh?.();document.dispatchEvent(new CustomEvent('budget:data-changed'));}catch(e){console.error(e);const map={MONTO_INVALIDO:'Ingresa un monto mayor a 0.',NOMBRE_INVALIDO:'Escribe un nombre.',FECHA_HOGAR_INVALIDA:'La fecha del próximo pago no es válida.',GASTO_HOGAR_NO_ENCONTRADO:'No se encontró ese gasto.',GASTO_HOGAR_YA_PAGADO:'Ese pago ya quedó registrado para este periodo.'};alert(map[e.message]||'No se pudo completar la operación.');}}

function record(item,refresh){const label=item.priority==='obligatory'?'Importe pagado ($)':'Importe gastado ($)';Modal.show(`${actionLabel(item)} · ${item.name}`,[{label,key:'amount',type:'number',value:item.amount}],d=>run(()=>recordHouseholdExpense(item.id,d.amount),refresh));}

export function initHomeEvents(refresh){
  $('btnNewHomeExpense')?.addEventListener('click',()=>itemModal(null,refresh));
  document.addEventListener('click',e=>{const b=e.target.closest('[data-home-action]');if(!b)return;const item=householdItems().find(x=>x.id===b.dataset.id);if(!item)return;
    if(b.dataset.homeAction==='record')record(item,refresh);
    if(b.dataset.homeAction==='edit')itemModal(item,refresh);
    if(b.dataset.homeAction==='pause'&&confirm(`¿Pausar ${item.name}? Dejará de contarse en tu dinero comprometido.`))run(()=>setHouseholdExpenseActive(item.id,false),refresh);
    if(b.dataset.homeAction==='resume')run(()=>setHouseholdExpenseActive(item.id,true),refresh);
  });
}
