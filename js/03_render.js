/* v3.0.0 - Render base sin duplicar motores financieros ni Historial. */
import { $, fmtMoney, safeFloat, SOURCE_KINDS, COMPENSATIONS, TRANSPORT_MODES, CAPABILITIES } from './01_consts_utils.js';
import { getState, getCapabilities, saldoFondoFuente, costoProducto } from './02_data.js';
import { metricasFuente, resumenPeriodoFuente, resumenGlobal, resumenNegocio } from './04_charts.js';

export const Modal={
  error(message){
    const modal=$('appModal');
    if(!modal||modal.style.display!=='flex'){alert(message);return false;}
    let error=$('modalError');
    if(!error){error=document.createElement('p');error.id='modalError';error.className='modal-error';error.setAttribute('role','alert');$('modalBody').append(error);}
    error.textContent=message;error.hidden=false;return false;
  },
  show(title,fields,onConfirm){
    if(!$('appModal')){
      const overlay=document.createElement('div');overlay.id='appModal';overlay.className='modal-overlay';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-labelledby','modalTitle');
      overlay.innerHTML='<div class="modal"><h3 id="modalTitle"></h3><div id="modalBody"></div><div class="modal-actions"><button id="modalCancel" class="btn btn-outline">Cancelar</button><button id="modalConfirm" class="btn btn-primary">Guardar</button></div></div>';document.body.append(overlay);
    }
    const modal=$('appModal'),body=$('modalBody'),titleEl=$('modalTitle'),ok=$('modalConfirm'),cancel=$('modalCancel'),previous=document.activeElement;
    modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-labelledby','modalTitle');titleEl.textContent=title;body.replaceChildren();
    for(const f of fields){const wrap=document.createElement('div'),label=document.createElement('label');label.textContent=f.label;label.style.cssText='display:block;font-size:.85rem;color:var(--text-sec);margin-top:7px';const input=document.createElement(f.type==='select'?'select':'input');input.id=`modal-field-${f.key}`;label.htmlFor=input.id;input.className='input-control';input.dataset.k=f.key;if(f.type==='select')(f.options||[]).forEach(o=>input.add(new Option(o.txt??o.text??o.val??o.value,o.val??o.value??'')));else{input.type=f.type||'text';if(f.placeholder)input.placeholder=f.placeholder;}
      if(input.type==='number'){input.step='any';input.inputMode='decimal';}
      for(const key of ['required','min','max','step','inputMode','autocomplete'])if(f[key]!==undefined)input[key]=f[key];
      if(f.value!==undefined)input.value=f.value;wrap.append(label,input);body.append(wrap);}
    let open=true,busy=false;
    const close=()=>{open=false;modal.style.display='none';modal.onkeydown=null;previous?.focus?.();};
    ok.disabled=false;ok.textContent='Guardar';
    ok.onclick=()=>{
      if(!open||busy)return;
      $('modalError')?.remove();
      const inputs=[...body.querySelectorAll('.input-control')],invalid=inputs.find(el=>!el.checkValidity());
      if(invalid){Modal.error(invalid.validationMessage||'Revisa este campo.');const details=invalid.closest('details');if(details)details.open=true;invalid.focus();return;}
      const values=Object.fromEntries(inputs.map(el=>[el.dataset.k,el.value]));busy=true;ok.disabled=true;
      try{if(onConfirm(values)!==false)close();}catch(e){console.error(e);Modal.error('No se pudo guardar. Revisa los datos o el espacio disponible e inténtalo de nuevo.');}
      finally{busy=false;ok.disabled=false;}
    };
    cancel.onclick=close;
    modal.onkeydown=e=>{
      if(e.key==='Escape'){e.preventDefault();close();}
      if(e.key==='Tab'){const focusable=[...modal.querySelectorAll('input,select,button,summary')].filter(el=>!el.disabled&&!el.hidden&&!el.closest('[hidden]')&&(!el.closest('details')||el.closest('details').open||el.tagName==='SUMMARY'));const first=focusable[0],last=focusable.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}
    };
    modal.style.display='flex';queueMicrotask(()=>{if(open)body.querySelector('.input-control')?.focus();});
  }
};

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sourceIcon=s=>SOURCE_KINDS[s?.kind]?.icon||'💰';
const sourceKind=s=>SOURCE_KINDS[s?.kind]?.label||'Ingreso';
const compensationLabel=s=>COMPENSATIONS[s?.compensation]?.label||s?.compensation||'Variable';
const personalSources=s=>(s.workSources||[]).filter(x=>x.active!==false&&x.status!=='ended'&&x.status!=='paused');
const fixedPaySource=s=>['daily','weekly','biweekly','monthly'].includes(s.compensation);

export function renderIndex(){
  const s=getState(),sources=personalSources(s);
  if($('panelGreeting'))$('panelGreeting').textContent=s.profile.displayName?`Hola, ${s.profile.displayName}`:'Tu situación financiera';
  const zone=$('sourceSummaryZone');if(zone)zone.innerHTML=sources.length?sources.map(src=>{
    if(src.kind==='employment'){const r=resumenPeriodoFuente(s,src.id)||{};return `<section class="card"><strong>${sourceIcon(src)} ${esc(src.name)}</strong><small style="display:block;color:var(--text-sec);margin:4px 0">${sourceKind(src)} · ${esc(compensationLabel(src))}</small><div style="font-size:1.15rem;font-weight:800">${r.jornadas||0} jornadas · ${(r.horas||0).toFixed(1)} h</div><small>Recibido este mes ${fmtMoney(r.receivedMonth)} · ${r.pagado?'Período cubierto':'Período pendiente'}</small></section>`;}
    const m=metricasFuente(s,src.id,{days:7}),value=src.kind==='business'?resumenNegocio(s).ingresos:m.ingresos;return `<section class="card"><strong>${sourceIcon(src)} ${esc(src.name)}</strong><small style="display:block;color:var(--text-sec);margin:4px 0">${sourceKind(src)} · ${esc(compensationLabel(src))}</small><div style="font-size:1.15rem;font-weight:800">${fmtMoney(value)}</div><small>${m.horas>0?`${m.horas.toFixed(1)} h · ${m.km.toFixed(0)} km`:src.kind==='business'?'Ventas registradas':'Sin actividad reciente'}</small></section>`;
  }).join(''):'<section class="card"><strong>Agrega una fuente de ingreso</strong><p style="font-size:.85rem;color:var(--text-sec);margin-top:5px">La app se adapta cuando le dices cómo trabajas.</p><a href="onboarding.html?edit=1" class="btn btn-primary" style="display:block;text-align:center;text-decoration:none;margin-top:10px">Configurar</a></section>';

  const today=$('todayActivityZone');if(today){const now=new Date().toDateString(),turns=(s.turnos||[]).filter(t=>new Date(t.fecha).toDateString()===now);today.innerHTML=turns.length?turns.map(t=>{const src=(s.workSources||[]).find(x=>x.id===t.sourceId);return `<li><span>${sourceIcon(src)} ${esc(src?.name||'Actividad')}</span><strong>${safeFloat(t.duracionHoras).toFixed(1)} h${safeFloat(t.kmRecorrido)>0?` · ${safeFloat(t.kmRecorrido).toFixed(0)} km`:''}${t.ganancia!==null&&t.ganancia!==undefined?` · ${fmtMoney(t.ganancia)}`:''}</strong></li>`;}).join(''):'<li><span>Sin actividad registrada hoy</span><strong>—</strong></li>';}

  const alerts=$('panelAlerts');if(alerts){const debt=(s.deudas||[]).filter(d=>safeFloat(d.saldo)>0).reduce((a,d)=>a+safeFloat(d.saldo),0),active=s.activeActivity?(s.workSources||[]).find(x=>x.id===s.activeActivity.sourceId):null,items=[];if(active)items.push(`🟢 Actividad en curso: <strong>${esc(active.name)}</strong>`);if(debt>0)items.push(`💳 Deuda pendiente total: <strong>${fmtMoney(debt)}</strong>`);if(!items.length)items.push('✅ Sin pagos urgentes detectados por ahora.');alerts.innerHTML=items.map(x=>`<div ${x.startsWith('✅')?'data-base-calm="true"':''} style="padding:5px 0">${x}</div>`).join('');}
}

export function renderDashboardContext(){}

/* Accounts se renderiza una sola vez en platform_ui; aquí sólo vive el total de Wallet. */
export function renderWallet(){if(!$('valWallet'))return;const summary=resumenGlobal(getState());$('valWallet').innerHTML=`<div style="font-size:.8rem;opacity:.8">DINERO EN TUS CUENTAS</div><div style="font-size:2rem;font-weight:bold">${fmtMoney(summary.saldo)}</div>`;}

/* Historial canónico vive en platform_ui para incluir movimientos, transferencias, jornadas y fondos de tercero. */
export function renderHistorial(){}

export function renderStats(){
  if(!$('statsSources'))return;const s=getState(),sources=personalSources(s),global=resumenGlobal(s);
  $('statsGeneral').innerHTML=`<div class="grid-2"><div><small>Ingresos</small><strong style="display:block">${fmtMoney(global.ingresos)}</strong></div><div><small>Gastos</small><strong style="display:block">${fmtMoney(global.gastos)}</strong></div></div>`;
  $('statsSources').innerHTML=sources.length?sources.map(src=>{const m=metricasFuente(s,src.id,{days:30}),period=resumenPeriodoFuente(s,src.id);let body='';if(src.kind==='employment')body=`${period?.jornadas||0} jornadas · ${(period?.horas||0).toFixed(1)} h · ${period?.pagado?fmtMoney(period.pago):'pago pendiente'}`;else if(src.kind==='business'){const b=resumenNegocio(s);body=`Ventas ${fmtMoney(b.ingresos)} · costos ${fmtMoney(b.costos)} · margen ${fmtMoney(b.margen)}`;}else body=`${fmtMoney(m.ingresos)} · ${m.horas.toFixed(1)} h${m.ingresoHora>0?` · ${fmtMoney(m.ingresoHora)}/h`:''}${m.ingresoKm>0?` · ${fmtMoney(m.ingresoKm)}/km`:''}`;return `<section class="card"><strong>${sourceIcon(src)} ${esc(src.name)}</strong><small style="display:block;color:var(--text-sec);margin-top:6px">${body}</small></section>`;}).join(''):'<section class="card">Configura una fuente de ingreso para obtener métricas específicas.</section>';
  const business=$('statsBusiness');if(business){const b=resumenNegocio(s);business.classList.toggle('hidden',!getCapabilities().has(CAPABILITIES.BUSINESS));business.innerHTML=`<h2>🏪 Negocio</h2><div class="grid-2"><div>Ventas<br><strong>${fmtMoney(b.ingresos)}</strong></div><div>Margen estimado<br><strong>${fmtMoney(b.margen)}</strong></div></div>`;}
}

export function renderAdmin(){
  if(!$('activitySourceZone'))return;const s=getState(),sources=personalSources(s),caps=getCapabilities(),active=s.activeActivity?(s.workSources||[]).find(x=>x.id===s.activeActivity.sourceId):null;
  if($('activityStatus'))$('activityStatus').innerHTML=active?`<strong style="color:#16a34a">🟢 ${esc(active.name)}</strong>`:'Sin actividad en curso';
  $('activitySourceZone').innerHTML=!active?sources.filter(x=>x.trackTime).map(src=>`<button class="btn btn-success" style="margin-top:8px" data-action="start-source" data-id="${esc(src.id)}">${sourceIcon(src)} Iniciar ${esc(src.name)}</button>`).join('')||'<small>No tienes fuentes con seguimiento de jornada.</small>':`<button class="btn btn-danger" data-action="finish-source" data-id="${esc(active.id)}">⏹ Finalizar ${esc(active.name)}</button>`;

  const pay=$('sourcePaymentZone');if(pay){const fixed=sources.filter(fixedPaySource);pay.parentElement.classList.toggle('hidden',!fixed.length);pay.innerHTML=fixed.map(src=>{const r=resumenPeriodoFuente(s,src.id);return `<div style="padding:8px 0;border-bottom:1px solid #e2e8f0"><div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><span><strong>${sourceIcon(src)} ${esc(src.name)}</strong><br><small>${esc(compensationLabel(src))} · ${r?.pagado?'registrado':'pendiente'}</small></span><button class="btn ${r?.pagado?'btn-outline':'btn-primary'}" style="width:auto" data-action="pay-source" data-id="${esc(src.id)}" ${r?.pagado?'disabled':''}>${r?.pagado?'✓ Cobrado':'Registrar pago'}</button></div>${s.movimientos.some(m=>m.sourceId===src.id&&m.paymentKind==='source_period')?`<button class="btn btn-outline" style="margin-top:6px" data-action="correct-income-period" data-id="${esc(src.id)}">Corregir período de un cobro</button>`:''}</div>`;}).join('');}

  const fuelCard=$('fuelCard');if(fuelCard){fuelCard.classList.toggle('hidden',!caps.has(CAPABILITIES.FUEL));const company=sources.find(x=>x.fuelPayer==='company'),fuel=company?saldoFondoFuente(company.id):null;if($('fuelFundSummary'))$('fuelFundSummary').innerHTML=company?`<strong>${esc(company.name)}</strong> · fondo disponible ${fmtMoney(fuel.disponible)}<br><small>Depositado ${fmtMoney(fuel.depositado)} · usado ${fmtMoney(fuel.utilizado)}</small>`:'<small>El combustible se paga desde tu cuenta personal.</small>';if($('btnCompanyFund'))$('btnCompanyFund').classList.toggle('hidden',!company);}
  if($('btnConfigKM'))$('btnConfigKM').hidden=Boolean(s.parametros.kmInicialConfigurado);
  if($('kmActual'))$('kmActual').textContent=`${s.parametros.ultimoKM} km`;if($('transportCard'))$('transportCard').classList.toggle('hidden',!caps.has(CAPABILITIES.TRANSPORT));if($('transportLabel'))$('transportLabel').textContent=TRANSPORT_MODES[s.profile.transportMode]?.label||'Sin transporte';

  const ul=$('listaDeudasAdmin');if(ul)ul.innerHTML=(s.deudas||[]).filter(d=>safeFloat(d.saldo)>0).map(d=>`<li style="display:flex;justify-content:space-between"><span>${esc(d.desc)}</span><strong>${fmtMoney(d.saldo)}</strong></li>`).join('')||'<li style="text-align:center;color:var(--text-sec)">Sin deudas registradas</li>';
  const sel=$('abonoDeudaSelect');if(sel){if($("debtPaymentForm"))$("debtPaymentForm").hidden=!(s.deudas||[]).some(d=>safeFloat(d.saldo)>0);sel.innerHTML='<option value="">Seleccionar...</option>';(s.deudas||[]).filter(d=>safeFloat(d.saldo)>0).forEach(d=>sel.add(new Option(`${esc(d.desc)} (${fmtMoney(d.montoCuota)})`,d.id)));}

  const business=$('businessZone');if(business){const enabled=caps.has(CAPABILITIES.BUSINESS);business.parentElement.classList.toggle('hidden',!enabled);if(enabled){const ingredients=s.business.ingredients||[],products=s.business.products||[];const ingredientList=ingredients.length?`<div style="margin-top:12px"><strong>Ingredientes / insumos</strong>${ingredients.map(i=>`<div style="display:flex;justify-content:space-between;gap:8px;align-items:center;padding:7px 0;border-bottom:1px solid #e2e8f0"><span>${esc(i.name)}<br><small>${fmtMoney(i.costPerUnit)} / ${esc(i.unit)}</small></span><button class="btn btn-outline" style="width:auto" data-action="update-ingredient" data-id="${esc(i.id)}">Actualizar costo</button></div>`).join('')}</div>`:'<small style="display:block;margin-top:10px;color:var(--text-sec)">Agrega ingredientes para empezar a costear recetas.</small>';const productList=products.length?`<div style="margin-top:14px"><strong>Productos</strong>${products.map(p=>`<div style="padding:8px 0;border-bottom:1px solid #e2e8f0"><strong>${esc(p.name)}</strong><br><small>Costo ${fmtMoney(costoProducto(p.id))} · venta ${fmtMoney(p.salePrice)} · margen ${fmtMoney(safeFloat(p.salePrice)-costoProducto(p.id))}</small><div class="grid-2" style="margin-top:6px"><button class="btn btn-outline" data-action="recipe-item" data-id="${esc(p.id)}">Receta</button><button class="btn btn-success" data-action="sale-product" data-id="${esc(p.id)}">Venta</button></div></div>`).join('')}</div>`:'<small style="display:block;margin-top:10px;color:var(--text-sec)">Crea productos y recetas para calcular costos y margen automáticamente.</small>';business.innerHTML=`<div class="grid-2"><button class="btn btn-outline" data-action="new-ingredient">+ Ingrediente</button><button class="btn btn-primary" data-action="new-product">+ Producto</button></div>${ingredientList}${productList}`;}}
}
