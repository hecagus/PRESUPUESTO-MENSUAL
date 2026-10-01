import { $, CATEGORIAS_BASE, fmtMoney, uuid } from '../01_consts_utils.js';
import { getState } from '../02_data.js';
import { Modal } from '../03_render.js';
import { getPersonalAccounts, recordUniversalMovement } from '../15_accounts_engine.js';
import { OPERATING_FREQUENCIES, localDay, operatingObligations, operatingUpcomingEvents, createOperatingObligation, payOperatingObligation, endOperatingObligation } from '../domain/operating-costs.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dateLabel=value=>new Date(value).toLocaleDateString('es-MX',{weekday:'long',day:'numeric',month:'short'});
const accounts=()=>getPersonalAccounts({activeOnly:true}).map(a=>({val:a.id,txt:a.name}));

export function showOperatingCostModal(safe){
  const operationId=uuid();
  const sources=(getState().workSources||[]).filter(s=>s.active!==false&&!['paused','ended'].includes(s.status)).map(s=>({val:s.id,txt:s.name})),accountOptions=accounts();
  const fields=[{label:'Descripción',key:'name',placeholder:'Ej. Mottu'},{label:'Monto pagado ($)',key:'amount',type:'number'},
    {label:'Frecuencia de pago',key:'frequency',type:'select',options:[{val:'one_time',txt:'Una sola vez'},...Object.entries(OPERATING_FREQUENCIES).map(([val,txt])=>({val,txt}))]},
    {label:'Primer vencimiento',key:'dueDate',type:'date',value:localDay(new Date())},
    {label:'Primer pago',key:'firstPayment',type:'select',options:[{val:'pending',txt:'Pendiente de pagar'},{val:'paid',txt:'Ya lo pagué'}]},
    {label:'Categoría',key:'category',type:'select',options:CATEGORIAS_BASE.operativo.map(c=>({val:c,txt:c}))}];
  if(sources.length>1)fields.push({label:'Actividad / fuente',key:'sourceId',type:'select',options:sources});
  if(accountOptions.length>1)fields.push({label:'Cuenta de pago',key:'accountId',type:'select',options:accountOptions});
  Modal.show('Registrar costo operativo',fields,data=>safe(()=>{
    const accountId=data.accountId||accountOptions[0]?.val||'acct-personal',sourceId=data.sourceId||sources[0]?.val||null;
    if(data.frequency==='one_time')return recordUniversalMovement({type:'expense',description:data.name,amount:data.amount,category:data.category,accountId,sourceId,tags:['operational'],operationId});
    return createOperatingObligation({name:data.name,amount:data.amount,category:data.category,sourceId,accountId,frequency:data.frequency,nextDueDate:data.dueDate,operationId},{paid:data.firstPayment==='paid'});
  }));
  const body=$('modalBody'),frequency=body.querySelector('[data-k="frequency"]'),amount=body.querySelector('[data-k="amount"]');
  const hint=document.createElement('small');hint.style.cssText='display:block;color:var(--text-sec);margin-top:8px';body.append(hint);
  const update=()=>{
    const recurring=frequency.value!=='one_time';
    for(const key of ['dueDate','firstPayment'])body.querySelector(`[data-k="${key}"]`).parentElement.hidden=!recurring;
    amount.parentElement.querySelector('label').textContent=recurring?'Importe por pago ($)':'Monto pagado ($)';
    hint.textContent=recurring?`Es una obligación de trabajo. El saldo baja cuando registras cada pago.${frequency.value==='weekly'?' Se repite cada semana el día de la fecha elegida.':frequency.value==='biweekly'?' Los vencimientos son el 15 y el último día del mes.':''}`:'Registra un gasto que ya pagaste.';
  };
  frequency.addEventListener('change',update);update();
}

export function renderOperatingCosts(now=new Date()){
  const box=$('operatingObligationRows');if(!box)return;
  const items=operatingObligations(),events=operatingUpcomingEvents({days:400,now});
  box.innerHTML=items.length?items.map(item=>{
    const next=events.find(e=>e.refId===item.id),source=getState().workSources.find(s=>s.id===item.sourceId),weekday=new Date(`${item.nextDueDate}T09:00:00`).toLocaleDateString('es-MX',{weekday:'long'});
    return `<div class="operating-obligation"><div class="operating-obligation-heading"><strong>${esc(item.name)}</strong><strong>${fmtMoney(item.amount)}</strong></div><small>${esc(OPERATING_FREQUENCIES[item.frequency])}${item.frequency==='weekly'?` · cada ${esc(weekday)}`:''} · ${esc(item.category)}${source?` · ${esc(source.name)}`:''}</small>${next?`<p class="operating-due${next.overdue?' overdue':''}">${next.overdue?'Vencido':'Próximo pago'} · ${dateLabel(next.dueDate)}<br>Pendiente: <strong>${fmtMoney(next.amount)}</strong></p>`:`<p class="operating-due">${item.active===false?'Finalizada · sin pagos pendientes':'Sin pagos pendientes en los próximos 400 días'}</p>`}<div class="grid-2">${next?`<button class="btn btn-primary" data-operating-action="pay" data-id="${esc(item.id)}" data-period="${esc(next.operatingPeriod)}">Registrar pago</button>`:''}${item.active!==false?`<button class="btn btn-outline" data-operating-action="end" data-id="${esc(item.id)}">Finalizar obligación</button>`:''}</div></div>`;
  }).join(''):'<small>Agrega una frecuencia para programar obligaciones de trabajo, como la renta semanal de Mottu.</small>';
}

export function initOperatingCostEvents(safe){
  $('btnGastoOperativo')?.addEventListener('click',()=>showOperatingCostModal(safe));
  $('operatingObligationRows')?.addEventListener('click',event=>{
    const button=event.target.closest('[data-operating-action]');if(!button)return;
    const id=button.dataset.id,item=operatingObligations().find(x=>x.id===id);if(!item)return;
    if(button.dataset.operatingAction==='end'){
      if(confirm(`¿Finalizar la obligación ${item.name}? Los pagos vencidos siguen pendientes; se dejan de programar nuevos pagos desde mañana.`))safe(()=>endOperatingObligation(id));return;
    }
    const pending=operatingUpcomingEvents({days:400}).find(e=>e.refId===id&&e.operatingPeriod===button.dataset.period);if(!pending)return;
    const options=accounts(),fields=[{label:`Importe pagado · pendiente ${fmtMoney(pending.amount)}`,key:'amount',type:'number',value:pending.amount},
      {label:'Fecha del pago',key:'date',type:'date',value:localDay(new Date())},
      {label:'Si pagas menos del pendiente',key:'settlement',type:'select',options:[{val:'partial',txt:'Conservar la diferencia pendiente'},{val:'settled',txt:'Liquidar: ya no debo la diferencia'}]}];
    if(options.length>1)fields.push({label:'Cuenta de pago',key:'accountId',type:'select',options,value:item.accountId});
    const operationId=uuid();
    Modal.show(`Pagar · ${item.name}`,fields,data=>safe(()=>payOperatingObligation(id,{period:pending.operatingPeriod,amount:data.amount,date:`${data.date}T12:00:00`,accountId:data.accountId||options[0]?.val,settled:data.settlement==='settled',operationId})));
  });
}
