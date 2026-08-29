/* v2.0.0 - Presentación dinámica según perfil/capacidades. No modifica estado. */
import { $, fmtMoney, safeFloat, SOURCE_KINDS, COMPENSATIONS, TRANSPORT_MODES, CAPABILITIES } from './01_consts_utils.js';
import { getState, getCapabilities, saldoCuenta, saldoFondoFuente, costoProducto } from './02_data.js';
import { metricasFuente, resumenPeriodoFuente, resumenGlobal, resumenNegocio } from './04_charts.js';

export const Modal={
  show(title,fields,onConfirm){
    const modal=$('appModal'),body=$('modalBody'),titleEl=$('modalTitle'),ok=$('modalConfirm'),cancel=$('modalCancel');
    if(!modal||!body||!titleEl||!ok||!cancel)return;
    titleEl.textContent=title;body.replaceChildren();
    fields.forEach(f=>{
      const wrap=document.createElement('div'),label=document.createElement('label');
      label.textContent=f.label;label.style.cssText='display:block;font-size:.8rem;color:#666;margin-top:7px';
      const input=document.createElement(f.type==='select'?'select':'input');input.className='input-control';input.dataset.k=f.key;
      if(f.type==='select')(f.options||[]).forEach(o=>input.add(new Option(o.txt??o.text??o.val??o.value,o.val??o.value??'')));
      else{input.type=f.type||'text';if(f.placeholder)input.placeholder=f.placeholder;if(f.value!==undefined)input.value=f.value;}
      wrap.append(label,input);body.append(wrap);
    });
    ok.onclick=()=>{const values={};body.querySelectorAll('.input-control').forEach(el=>values[el.dataset.k]=el.value);onConfirm(values);modal.style.display='none';};
    cancel.onclick=()=>{modal.style.display='none';};modal.style.display='flex';
  }
};

const sourceIcon=s=>SOURCE_KINDS[s?.kind]?.icon||'💰';
const sourceKind=s=>SOURCE_KINDS[s?.kind]?.label||'Ingreso';
const compensationLabel=s=>COMPENSATIONS[s?.compensation]?.label||s?.compensation||'Variable';
const personalSources=s=>(s.workSources||[]).filter(x=>x.active!==false);
const fixedPaySource=s=>['daily','weekly','biweekly','monthly'].includes(s.compensation);

export function renderIndex(){
  if(!$('mainSummaryValue'))return;
  const s=getState(),summary=resumenGlobal(s),sources=personalSources(s);
  $('mainSummaryValue').textContent=fmtMoney(summary.saldo);
  $('mainSummarySub').textContent=`Disponible real ${fmtMoney(summary.disponible)} · ahorro ${fmtMoney(summary.ahorro)}`;
  if($('panelGreeting'))$('panelGreeting').textContent=s.profile.displayName?`Hola, ${s.profile.displayName}`:'Tu situación financiera';

  const zone=$('sourceSummaryZone');
  if(zone){
    zone.innerHTML=sources.length?sources.map(src=>{
      if(src.kind==='employment'){
        const r=resumenPeriodoFuente(s,src.id)||{};
        return `<section class="card"><strong>${sourceIcon(src)} ${src.name}</strong><small style="display:block;color:var(--text-sec);margin:4px 0">${sourceKind(src)} · ${compensationLabel(src)}</small><div style="font-size:1.15rem;font-weight:800">${r.jornadas||0} jornadas · ${(r.horas||0).toFixed(1)} h</div><small>${r.pagado?`Cobrado ${fmtMoney(r.pago)}`:'Pago del periodo pendiente'}</small></section>`;
      }
      const m=metricasFuente(s,src.id,{days:7});
      const value=src.kind==='business'?resumenNegocio(s).ingresos:m.ingresos;
      return `<section class="card"><strong>${sourceIcon(src)} ${src.name}</strong><small style="display:block;color:var(--text-sec);margin:4px 0">${sourceKind(src)} · ${compensationLabel(src)}</small><div style="font-size:1.15rem;font-weight:800">${fmtMoney(value)}</div><small>${m.horas>0?`${m.horas.toFixed(1)} h · ${m.km.toFixed(0)} km`:src.kind==='business'?'Ventas registradas':'Sin actividad reciente'}</small></section>`;
    }).join(''):'<section class="card"><strong>Agrega una fuente de ingreso</strong><p style="font-size:.85rem;color:var(--text-sec);margin-top:5px">La app se adapta cuando le dices cómo trabajas.</p><a href="onboarding.html?edit=1" class="btn btn-primary" style="display:block;text-align:center;text-decoration:none;margin-top:10px">Configurar</a></section>';
  }

  const today=$('todayActivityZone');
  if(today){
    const now=new Date().toDateString(),turns=(s.turnos||[]).filter(t=>new Date(t.fecha).toDateString()===now);
    today.innerHTML=turns.length?turns.map(t=>{const src=sources.find(x=>x.id===t.sourceId);return `<li><span>${sourceIcon(src)} ${src?.name||'Actividad'}</span><strong>${safeFloat(t.duracionHoras).toFixed(1)} h${safeFloat(t.kmRecorrido)>0?` · ${safeFloat(t.kmRecorrido).toFixed(0)} km`:''}${t.ganancia!==null&&t.ganancia!==undefined?` · ${fmtMoney(t.ganancia)}`:''}</strong></li>`;}).join(''):'<li><span>Sin actividad registrada hoy</span><strong>—</strong></li>';
  }

  const alerts=$('panelAlerts');
  if(alerts){
    const debt=s.deudas.filter(d=>safeFloat(d.saldo)>0).reduce((a,d)=>a+safeFloat(d.saldo),0);
    const active=s.activeActivity?sources.find(x=>x.id===s.activeActivity.sourceId):null;
    const items=[];
    if(active)items.push(`🟢 Actividad en curso: <strong>${active.name}</strong>`);
    if(debt>0)items.push(`💳 Deuda pendiente total: <strong>${fmtMoney(debt)}</strong>`);
    if(!items.length)items.push('✅ Sin alertas importantes por ahora.');
    alerts.innerHTML=items.map(x=>`<div style="padding:5px 0">${x}</div>`).join('');
  }
}

export function renderDashboardContext(){}

export function renderWallet(){
  if(!$('valWallet'))return;
  const s=getState(),summary=resumenGlobal(s);
  $('valWallet').innerHTML=`<div style="font-size:.8rem;opacity:.8">PATRIMONIO PERSONAL</div><div style="font-size:2rem;font-weight:bold">${fmtMoney(summary.saldo)}</div>`;
  const accounts=$('accountsContainer');
  if(accounts){accounts.innerHTML=(s.accounts||[]).filter(a=>a.active!==false).map(a=>`<section class="card" style="border-left:4px solid ${a.ownership==='third_party'?'#f59e0b':'#2563eb'}"><div style="display:flex;justify-content:space-between;gap:10px"><div><strong>${a.ownership==='third_party'?'🏢':'💳'} ${a.name}</strong><small style="display:block;color:var(--text-sec)">${a.ownership==='third_party'?'Fondos de tercero · no son patrimonio':'Dinero personal'}</small></div><strong>${fmtMoney(saldoCuenta(a.id))}</strong></div></section>`).join('');}
  const c=$('sobresContainer');if(!c)return;c.replaceChildren();
  (s.wallet.sobres||[]).forEach(x=>{const card=document.createElement('section');card.className='card';if(x.categoria==='Ahorro'||x.categoria==='Meta'){card.style.borderLeft='4px solid #6366f1';card.innerHTML=`<strong>💎 ${x.desc}</strong><div>${fmtMoney(x.acumulado)} / ${fmtMoney(x.meta)}</div><button class="btn btn-outline" data-action="ahorro" data-id="${x.id}">+ Abonar</button>`;}else{card.innerHTML=`<strong>${x.desc}</strong><div>${fmtMoney(x.acumulado)} / ${fmtMoney(x.meta)}</div><small>${x.frecuencia||''}</small>`;}c.append(card);});
}

function historyEvents(s){
  const events=[];
  for(const m of s.movimientos||[])events.push({id:m.id,fecha:m.fecha,type:'money',title:m.desc,meta:m.categoria||'',amount:m.tipo==='ingreso'?safeFloat(m.monto):-safeFloat(m.monto),affectsPersonal:m.affectsPersonal!==false,sourceId:m.sourceId});
  for(const t of s.turnos||[]){const src=s.workSources.find(x=>x.id===t.sourceId);events.push({id:`activity-${t.id}`,fecha:t.fecha,type:'activity',title:`Actividad · ${src?.name||'Trabajo'}`,meta:`${safeFloat(t.duracionHoras).toFixed(1)} h${safeFloat(t.kmRecorrido)>0?` · ${safeFloat(t.kmRecorrido).toFixed(0)} km`:''}`,amount:null,sourceId:t.sourceId});}
  for(const f of s.fondosCombustibleEmpresa||[]){const src=s.workSources.find(x=>x.id===f.sourceId);events.push({id:`fund-${f.id}`,fecha:f.fecha,type:'fund',title:f.desc||`Depósito empresa · ${src?.name||'Trabajo'}`,meta:'Fondo de tercero',amount:safeFloat(f.monto),affectsPersonal:false,sourceId:f.sourceId});}
  for(const c of s.cargasCombustible||[]){const src=s.workSources.find(x=>x.id===c.sourceId);events.push({id:`fuel-${c.id}`,fecha:c.fecha,type:'fuel',title:`Combustible${c.gasolinera?` · ${c.gasolinera}`:''}`,meta:`${src?.name||'Personal'} · ${safeFloat(c.litros).toFixed(2)} L`,amount:-safeFloat(c.costo),affectsPersonal:c.pagador!=='empresa',sourceId:c.sourceId});}
  return events.sort((a,b)=>new Date(b.fecha)-new Date(a.fecha));
}

export function renderHistorial(){
  if(!$('tablaBody'))return;const s=getState(),events=historyEvents(s).slice(0,100);
  $('tablaBody').innerHTML=events.length?events.map(e=>`<tr><td>${new Date(e.fecha).toLocaleDateString('es-MX',{month:'short',day:'numeric'})}<br><small>${new Date(e.fecha).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'})}</small></td><td><strong>${e.title}</strong><br><small>${e.meta}${e.affectsPersonal===false?' · no afecta patrimonio':''}</small></td><td style="text-align:right;font-weight:bold;color:${e.amount===null?'var(--text-sec)':e.amount>=0?'#16a34a':'#dc2626'}">${e.amount===null?'—':`${e.amount>=0?'+':'-'}${fmtMoney(Math.abs(e.amount))}`}</td></tr>`).join(''):'<tr><td colspan="3" style="text-align:center;padding:20px">Sin actividad todavía</td></tr>';
}

export function renderStats(){
  if(!$('statsSources'))return;const s=getState(),sources=personalSources(s),global=resumenGlobal(s);
  $('statsGeneral').innerHTML=`<div class="grid-2"><div><small>Ingresos</small><strong style="display:block">${fmtMoney(global.ingresos)}</strong></div><div><small>Gastos</small><strong style="display:block">${fmtMoney(global.gastos)}</strong></div></div>`;
  $('statsSources').innerHTML=sources.length?sources.map(src=>{const m=metricasFuente(s,src.id,{days:30}),period=resumenPeriodoFuente(s,src.id);let body='';if(src.kind==='employment')body=`${period?.jornadas||0} jornadas · ${(period?.horas||0).toFixed(1)} h · ${period?.pagado?fmtMoney(period.pago):'pago pendiente'}`;else if(src.kind==='business'){const b=resumenNegocio(s);body=`Ventas ${fmtMoney(b.ingresos)} · costos ${fmtMoney(b.costos)} · margen ${fmtMoney(b.margen)}`;}else body=`${fmtMoney(m.ingresos)} · ${m.horas.toFixed(1)} h${m.ingresoHora>0?` · ${fmtMoney(m.ingresoHora)}/h`:''}${m.ingresoKm>0?` · ${fmtMoney(m.ingresoKm)}/km`:''}`;return `<section class="card"><strong>${sourceIcon(src)} ${src.name}</strong><small style="display:block;color:var(--text-sec);margin-top:6px">${body}</small></section>`;}).join(''):'<section class="card">Configura una fuente de ingreso para obtener métricas específicas.</section>';
  const business=$('statsBusiness');if(business){const b=resumenNegocio(s);business.classList.toggle('hidden',!getCapabilities().has(CAPABILITIES.BUSINESS));business.innerHTML=`<h2>🏪 Negocio</h2><div class="grid-2"><div>Ventas<br><strong>${fmtMoney(b.ingresos)}</strong></div><div>Margen estimado<br><strong>${fmtMoney(b.margen)}</strong></div></div>`;}
}

export function renderAdmin(){
  if(!$('activitySourceZone'))return;const s=getState(),sources=personalSources(s),caps=getCapabilities(),active=s.activeActivity?sources.find(x=>x.id===s.activeActivity.sourceId):null;
  if($('activityStatus'))$('activityStatus').innerHTML=active?`<strong style="color:#16a34a">🟢 ${active.name}</strong>`:'Sin actividad en curso';
  if($('activitySourceZone'))$('activitySourceZone').innerHTML=!active?sources.filter(x=>x.trackTime).map(src=>`<button class="btn btn-success" style="margin-top:8px" data-action="start-source" data-id="${src.id}">${sourceIcon(src)} Iniciar ${src.name}</button>`).join('')||'<small>No tienes fuentes con seguimiento de jornada.</small>':`<button class="btn btn-danger" data-action="finish-source" data-id="${active.id}">⏹ Finalizar ${active.name}</button>`;

  const pay=$('sourcePaymentZone');if(pay){const fixed=sources.filter(fixedPaySource);pay.parentElement.classList.toggle('hidden',!fixed.length);pay.innerHTML=fixed.map(src=>{const r=resumenPeriodoFuente(s,src.id);return `<div style="padding:8px 0;border-bottom:1px solid #e2e8f0"><div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><span><strong>${sourceIcon(src)} ${src.name}</strong><br><small>${compensationLabel(src)} · ${r?.pagado?'registrado':'pendiente'}</small></span><button class="btn ${r?.pagado?'btn-outline':'btn-primary'}" style="width:auto" data-action="pay-source" data-id="${src.id}" ${r?.pagado?'disabled':''}>${r?.pagado?'✓ Cobrado':'Registrar pago'}</button></div></div>`;}).join('');}

  const fuelCard=$('fuelCard');if(fuelCard){fuelCard.classList.toggle('hidden',!caps.has(CAPABILITIES.FUEL));const company=sources.find(x=>x.fuelPayer==='company');const fuel=company?saldoFondoFuente(company.id):null;if($('fuelFundSummary'))$('fuelFundSummary').innerHTML=company?`<strong>${company.name}</strong> · fondo disponible ${fmtMoney(fuel.disponible)}<br><small>Depositado ${fmtMoney(fuel.depositado)} · usado ${fmtMoney(fuel.utilizado)}</small>`:'<small>El combustible se pagará desde tu cuenta personal.</small>';if($('btnCompanyFund'))$('btnCompanyFund').classList.toggle('hidden',!company);}

  if($('kmActual'))$('kmActual').textContent=`${s.parametros.ultimoKM} km`;
  if($('transportCard'))$('transportCard').classList.toggle('hidden',!caps.has(CAPABILITIES.TRANSPORT));
  if($('transportLabel'))$('transportLabel').textContent=TRANSPORT_MODES[s.profile.transportMode]?.label||'Sin transporte';
  if($('valSaldoAdmin'))$('valSaldoAdmin').textContent=fmtMoney(s.wallet.saldo);
  if($('metaDiariaValor'))$('metaDiariaValor').textContent=fmtMoney(s.parametros.metaDiaria);

  const ul=$('listaDeudasAdmin');if(ul)ul.innerHTML=s.deudas.filter(d=>safeFloat(d.saldo)>0).map(d=>`<li style="display:flex;justify-content:space-between"><span>${d.desc}</span><strong>${fmtMoney(d.saldo)}</strong></li>`).join('')||'<li style="text-align:center;color:var(--text-sec)">Sin deudas registradas</li>';
  const sel=$('abonoDeudaSelect');if(sel){sel.innerHTML='<option value="">Seleccionar...</option>';s.deudas.filter(d=>safeFloat(d.saldo)>0).forEach(d=>sel.add(new Option(`${d.desc} (${fmtMoney(d.montoCuota)})`,d.id)));}

  const business=$('businessZone');if(business){const enabled=caps.has(CAPABILITIES.BUSINESS);business.parentElement.classList.toggle('hidden',!enabled);if(enabled){const products=s.business.products||[];business.innerHTML=`<div class="grid-2"><button class="btn btn-outline" data-action="new-ingredient">+ Ingrediente</button><button class="btn btn-primary" data-action="new-product">+ Producto</button></div>${products.length?`<div style="margin-top:12px">${products.map(p=>`<div style="padding:8px 0;border-bottom:1px solid #e2e8f0"><strong>${p.name}</strong><br><small>Costo ${fmtMoney(costoProducto(p.id))} · venta ${fmtMoney(p.salePrice)} · margen ${fmtMoney(safeFloat(p.salePrice)-costoProducto(p.id))}</small><div class="grid-2" style="margin-top:6px"><button class="btn btn-outline" data-action="recipe-item" data-id="${p.id}">Receta</button><button class="btn btn-success" data-action="sale-product" data-id="${p.id}">Venta</button></div></div>`).join('')}</div>`:'<small style="display:block;margin-top:10px;color:var(--text-sec)">Crea productos y recetas para calcular costos y margen automáticamente.</small>'}`;}}
}
