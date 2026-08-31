/* v2.8.1 - UI de Hogar: semántica financiera + confirmación visible de gastos realizados. */
import { $, fmtMoney } from './01_consts_utils.js';
import { getState } from './02_data.js';
import { Modal } from './03_render.js';
import {
  ensureHousehold,householdItems,householdSummary,householdBudgetStatus,householdMonthlyEquivalent,householdUpcomingEvents,
  createHouseholdExpense,updateHouseholdExpense,setHouseholdExpenseActive,recordHouseholdExpense,recordDirectHouseholdExpense,
  recentDirectHouseholdExpenses,undoDirectHouseholdExpense,
  HOME_KINDS,HOME_FREQUENCIES,HOME_CATEGORIES
} from './23_home_semantics.js';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const freqLabel=f=>HOME_FREQUENCIES[f]||f;
const kindLabel=k=>HOME_KINDS[k]?.label||k;
const kindIcon=k=>HOME_KINDS[k]?.icon||'•';
const kindColor=k=>k==='obligation'?'#dc2626':k==='budget'?'#eab308':k==='reserve'?'#f97316':'#2563eb';
const dateLabel=d=>new Date(d).toLocaleDateString('es-MX',{day:'numeric',month:'short'});
const dateTimeLabel=d=>new Date(d).toLocaleString('es-MX',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
const isoDate=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const lastDay=(y,m)=>new Date(y,m+1,0).getDate();

function spentFor(id){return householdBudgetStatus().find(x=>x.item.id===id)||null;}
function eventsFor(id){return householdUpcomingEvents({days:400}).filter(e=>e.refId===id);}
function overdueFor(id){return eventsFor(id).find(e=>e.overdue)||null;}
function nextFor(id){return eventsFor(id).find(e=>!e.overdue)||null;}
function isCompletedOneTime(item){return item.frequency==='one_time'&&(getState().movimientos||[]).some(m=>m.householdExpenseId===item.id);}

function itemStatus(item){
  if(item.kind==='budget'){
    const row=spentFor(item.id);return row?`${fmtMoney(row.spent)} usados · ${fmtMoney(row.remaining)} por cubrir este mes`:`Necesidad estimada ${fmtMoney(householdMonthlyEquivalent(item))}/mes`;
  }
  if(item.kind==='obligation'){
    const overdue=overdueFor(item.id);if(overdue)return `⚠️ Vencido ${dateLabel(overdue.dueDate||overdue.date)} · pendiente de registrar`;
    if(item.frequency==='variable')return 'Obligación variable · se reserva una estimación';
    const next=nextFor(item.id);return next?`${freqLabel(item.frequency)} · próximo ${dateLabel(next.dueDate||next.date)}`:freqLabel(item.frequency);
  }
  if(item.kind==='reserve')return item.nextDueDate?`Reserva concreta · comprar antes de ${dateLabel(`${item.nextDueDate}T12:00:00`)}`:'Reserva concreta · pendiente de comprar';
  if(item.kind==='optional'){
    if(item.frequency==='one_time')return 'Opcional · no reduce tu dinero libre hasta gastarlo';
    return `${freqLabel(item.frequency)} · opcional, no se compromete por anticipado`;
  }
  return 'Gasto ya realizado';
}
function actionLabel(item){return item.kind==='obligation'?'Pagar':item.kind==='reserve'?'Comprar / registrar':'Registrar gasto';}

function section(title,items){
  if(!items.length)return `<section><div class="dashboard-section-title">${title}</div><div class="card"><small>No hay registros en esta sección.</small></div></section>`;
  return `<section><div class="dashboard-section-title">${title}</div>${items.map(item=>`<article class="card" style="border-left:5px solid ${kindColor(item.kind)}">
    <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start"><div><strong>${kindIcon(item.kind)} ${esc(item.name)}</strong><small style="display:block;color:var(--text-sec);margin-top:3px">${esc(item.category)} · ${esc(kindLabel(item.kind))}</small></div><strong>${fmtMoney(item.amount)}</strong></div>
    <small style="display:block;color:var(--text-sec);margin:8px 0">${esc(itemStatus(item))}</small>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px"><button class="btn btn-primary" data-home-action="record" data-id="${item.id}">${actionLabel(item)}</button><button class="btn btn-outline" data-home-action="edit" data-id="${item.id}">Editar</button><button class="btn btn-outline" data-home-action="pause" data-id="${item.id}">Pausar</button></div>
  </article>`).join('')}</section>`;
}

function directSection(rows){
  if(!rows.length)return '';
  return `<section><div class="dashboard-section-title">💸 Gastos realizados recientes</div>${rows.map(row=>`<article class="card" style="border-left:5px solid #64748b">
    <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start"><div><strong>💸 ${esc(row.item.name)}</strong><small style="display:block;color:var(--text-sec);margin-top:3px">${esc(row.item.category)} · registrado en Historial</small></div><strong>-${fmtMoney(row.amount)}</strong></div>
    <small style="display:block;color:var(--text-sec);margin:8px 0">Registrado ${esc(dateTimeLabel(row.recordedAt||row.date))}</small>
    <button class="btn btn-outline" data-home-action="undo-direct" data-id="${row.item.id}">Deshacer este gasto</button>
  </article>`).join('')}</section>`;
}

export function renderHome(){
  if(!$('homeSummary'))return;ensureHousehold();const summary=householdSummary(),items=householdItems({activeOnly:true});
  $('homeSummary').innerHTML=`<div class="grid-2"><div><small>🔴 Obligaciones / mes</small><strong style="display:block;font-size:1.2rem">${fmtMoney(summary.mandatory)}</strong></div><div><small>🟡 Presupuesto necesario / mes</small><strong style="display:block;font-size:1.2rem">${fmtMoney(summary.budgeted)}</strong></div><div><small>🟠 Reservas pendientes</small><strong style="display:block;font-size:1.2rem">${fmtMoney(summary.explicitReserve)}</strong></div><div><small>💸 Gastado este mes</small><strong style="display:block;font-size:1.2rem">${fmtMoney(summary.spent)}</strong></div></div>`;
  const zone=$('homeExpenses');if(!zone)return;
  zone.innerHTML=section('🔴 Obligaciones',items.filter(x=>x.kind==='obligation'))+section('🟡 Presupuestos necesarios',items.filter(x=>x.kind==='budget'))+section('🟠 Reservas / necesidades próximas',items.filter(x=>x.kind==='reserve'))+section('🔵 Opcionales',items.filter(x=>x.kind==='optional'))+directSection(recentDirectHouseholdExpenses(6));
  const paused=householdItems().filter(x=>x.active===false&&!isCompletedOneTime(x));$('homePaused')?.classList.toggle('hidden',!paused.length);
  if($('homePausedList'))$('homePausedList').innerHTML=paused.map(x=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid #e2e8f0"><span>${esc(x.name)}</span><button class="btn btn-outline" style="width:auto" data-home-action="resume" data-id="${x.id}">Reactivar</button></div>`).join('');
}

const categoryOptions=()=>HOME_CATEGORIES.map(x=>({val:x,txt:x}));
const kindOptions=()=>Object.entries(HOME_KINDS).map(([val,x])=>({val,txt:`${x.icon} ${x.label}`}));
const frequencyOptions=()=>Object.entries(HOME_FREQUENCIES).map(([val,txt])=>({val,txt}));

function nextDateFromDueDay(item){
  if(!item||!['monthly','bimonthly'].includes(item.frequency))return '';
  const now=new Date(),today=new Date(now.getFullYear(),now.getMonth(),now.getDate()),day=Math.max(1,Math.min(31,Number(item.dueDay)||1));
  let d=new Date(now.getFullYear(),now.getMonth(),Math.min(day,lastDay(now.getFullYear(),now.getMonth())));
  if(d<today){const y=now.getMonth()===11?now.getFullYear()+1:now.getFullYear(),m=(now.getMonth()+1)%12;d=new Date(y,m,Math.min(day,lastDay(y,m)));}
  return isoDate(d);
}
function scheduleDateValue(item){return item?.nextDueDate||nextDateFromDueDay(item);}
function payloadFor(data,item){
  const d={...data},kind=d.kind||item?.kind||'obligation';
  if(kind==='reserve'||kind==='spent')d.frequency='one_time';
  const date=String(d.nextDueDate||'').trim();
  if(kind==='budget'||d.frequency==='variable')d.nextDueDate='';
  else if(date){d.nextDueDate=date;const parsed=new Date(`${date}T12:00:00`);if(!Number.isNaN(parsed.getTime()))d.dueDay=parsed.getDate();}
  else d.dueDay=item?.dueDay||1;
  return d;
}

function itemModal(item,refresh){
  Modal.show(item?'Editar registro del hogar':'Nuevo registro del hogar',[
    {label:'Nombre',key:'name',value:item?.name||'',placeholder:'Renta, comida, papel higiénico, Netflix...'},
    {label:'Monto ($)',key:'amount',type:'number',value:item?.amount||''},
    {label:'Categoría',key:'category',type:'select',options:categoryOptions()},
    {label:'¿Qué representa este dinero?',key:'kind',type:'select',options:kindOptions()},
    {label:'Frecuencia',key:'frequency',type:'select',options:frequencyOptions()},
    {label:'Fecha',key:'nextDueDate',type:'date',value:item?scheduleDateValue(item):''}
  ],d=>run(()=>{const payload=payloadFor(d,item);if(!item&&payload.kind==='spent')return recordDirectHouseholdExpense({...payload,date:payload.nextDueDate||isoDate(new Date())});return item?updateHouseholdExpense(item.id,payload):createHouseholdExpense(payload);},refresh));
  setTimeout(()=>{
    const body=$('modalBody');if(!body)return;const set=(key,value)=>{const el=body.querySelector(`[data-k="${key}"]`);if(el)el.value=value;};
    set('category',item?.category||'Alimentación');set('kind',item?.kind||'obligation');set('frequency',item?.frequency||'monthly');
    const kind=body.querySelector('[data-k="kind"]'),frequency=body.querySelector('[data-k="frequency"]'),date=body.querySelector('[data-k="nextDueDate"]'),freqWrap=frequency?.parentElement,dateWrap=date?.parentElement,dateLabelEl=dateWrap?.querySelector('label');
    const syncFields=()=>{
      if(!kind||!frequency||!date||!freqWrap||!dateWrap||!dateLabelEl)return;const k=kind.value,f=frequency.value;
      const oneShot=k==='reserve'||k==='spent';if(oneShot)frequency.value='one_time';freqWrap.style.display=oneShot?'none':'block';
      if(k==='budget'){dateWrap.style.display='none';date.value='';return;}
      dateWrap.style.display=(frequency.value==='variable'&&k!=='spent')?'none':'block';
      dateLabelEl.textContent=k==='spent'?'Fecha del gasto':k==='reserve'?'Comprar antes de (opcional)':k==='optional'?'Próxima fecha (opcional)':'Próximo pago / inicio de frecuencia (opcional)';
      if(k==='spent'&&!date.value)date.value=isoDate(new Date());if(f==='variable'&&k!=='spent')date.value='';
    };
    kind?.addEventListener('change',syncFields);frequency?.addEventListener('change',syncFields);syncFields();
  },0);
}

function run(fn,refresh){try{fn();refresh?.();document.dispatchEvent(new CustomEvent('budget:data-changed'));}catch(e){console.error(e);const map={MONTO_INVALIDO:'Ingresa un monto mayor a 0.',NOMBRE_INVALIDO:'Escribe un nombre.',FECHA_HOGAR_INVALIDA:'La fecha no es válida.',GASTO_HOGAR_NO_ENCONTRADO:'No se encontró ese registro.',GASTO_HOGAR_YA_PAGADO:'Ese pago ya quedó registrado para este periodo.',GASTO_HOGAR_DUPLICADO_RECIENTE:'Ese mismo gasto ya se registró hace unos minutos. Revisa “Gastos realizados recientes” antes de volver a capturarlo.',USA_GASTO_REALIZADO:'Usa la opción Gasto realizado.'};alert(map[e.message]||'No se pudo completar la operación.');}}
function record(item,refresh){const label=item.kind==='obligation'?'Importe pagado ($)':item.kind==='reserve'?'Importe de la compra ($)':'Importe gastado ($)';Modal.show(`${actionLabel(item)} · ${item.name}`,[{label,key:'amount',type:'number',value:item.amount}],d=>run(()=>recordHouseholdExpense(item.id,d.amount),refresh));}

export function initHomeEvents(refresh){
  $('btnNewHomeExpense')?.addEventListener('click',()=>itemModal(null,refresh));
  document.addEventListener('click',e=>{const b=e.target.closest('[data-home-action]');if(!b)return;
    if(b.dataset.homeAction==='undo-direct'){if(confirm('¿Deshacer este gasto? Se eliminará de Historial y el dinero volverá a tu saldo.'))run(()=>undoDirectHouseholdExpense(b.dataset.id),refresh);return;}
    const item=householdItems().find(x=>x.id===b.dataset.id);if(!item)return;
    if(b.dataset.homeAction==='record')record(item,refresh);
    if(b.dataset.homeAction==='edit')itemModal(item,refresh);
    if(b.dataset.homeAction==='pause'&&confirm(`¿Pausar ${item.name}? Dejará de tomarse en cuenta mientras esté pausado.`))run(()=>setHouseholdExpenseActive(item.id,false),refresh);
    if(b.dataset.homeAction==='resume')run(()=>setHouseholdExpenseActive(item.id,true),refresh);
  });
}
