/* V10 - Presentación. No modifica estado. */
import { $, fmtMoney, MAPA_DIAS, normalizeWeekDay, isGasReserve, safeFloat } from './01_consts_utils.js';
import { getState } from './02_data.js';
import { metricasUltimos7Dias, resumenIngresosHibridos } from './04_charts.js';

export const Modal = {
  show(title, fields, onConfirm) {
    const modal=$('appModal'), body=$('modalBody'), titleEl=$('modalTitle'), ok=$('modalConfirm'), cancel=$('modalCancel');
    if(!modal||!body||!titleEl||!ok||!cancel) return;
    titleEl.textContent=title; body.replaceChildren();
    fields.forEach(f=>{
      const wrap=document.createElement('div'), label=document.createElement('label');
      label.textContent=f.label; label.style.cssText='display:block;font-size:.8rem;color:#666;margin-top:5px';
      const input=document.createElement(f.type==='select'?'select':'input'); input.className='input-control'; input.dataset.k=f.key;
      if(f.type==='select') (f.options||[]).forEach(o=>input.add(new Option(o.txt??o.text??o.val??o.value,o.val??o.value??'')));
      else input.type=f.type||'text';
      wrap.append(label,input); body.append(wrap);
    });
    ok.onclick=()=>{ const values={}; body.querySelectorAll('.input-control').forEach(el=>values[el.dataset.k]=el.value); onConfirm(values); modal.style.display='none'; };
    cancel.onclick=()=>{ modal.style.display='none'; }; modal.style.display='flex';
  }
};

function estadoSobre(s, now=new Date()) {
  if (s.frecuencia === 'Diario') return s.pagadoHoy ? 'cubierto' : 'hoy';
  const faltante=Math.max(0,safeFloat(s.meta)-safeFloat(s.acumulado)); if(faltante<=0) return 'cubierto';
  if(s.frecuencia==='Semanal') { const hoy=MAPA_DIAS[now.getDay()], pago=normalizeWeekDay(s.diaPago); return hoy>pago?'vencido':(hoy===pago?'hoy':'proyeccion'); }
  if(s.frecuencia==='Mensual') { const pago=Number.parseInt(s.diaPago,10); if(!Number.isFinite(pago)) return 'proyeccion'; return now.getDate()>pago?'vencido':(now.getDate()===pago?'hoy':'proyeccion'); }
  return 'proyeccion';
}

export function renderIndex() {
  if(!$('resGananciaBruta')) return; const s=getState(), hoy=new Date().toDateString();
  const repartoHoy=s.turnos.filter(t=>new Date(t.fecha).toDateString()===hoy).reduce((a,t)=>a+safeFloat(t.ganancia),0); $('resGananciaBruta').textContent=fmtMoney(repartoHoy);
  let ahorro=0,vencido=0,hoyMonto=0,proyeccion=0;
  s.wallet.sobres.forEach(x=>{
    if(x.categoria==='Ahorro'||x.categoria==='Meta'){ ahorro+=safeFloat(x.acumulado); return; }
    if(isGasReserve(x)) return;
    const estado=estadoSobre(x), faltante=Math.max(0,safeFloat(x.meta)-safeFloat(x.acumulado));
    if(estado==='vencido') vencido+=faltante; else if(estado==='hoy') hoyMonto+=faltante; else if(estado==='proyeccion') proyeccion+=Math.max(0,safeFloat(x.objetivoHoy)-safeFloat(x.acumulado));
  });
  const saldo=s.wallet.saldo, porPagar=vencido+hoyMonto, disponible=saldo-porPagar-ahorro;
  const estado=vencido>0?{c:'var(--danger)',t:'⚠️ Atención requerida',m:`Pagos atrasados: <b>${fmtMoney(vencido)}</b>.`}:hoyMonto>0?{c:'#d97706',t:'📅 Compromisos de hoy',m:`Hoy toca cubrir <b>${fmtMoney(hoyMonto)}</b>.`}:{c:'#16a34a',t:'✅ Todo en orden',m:'Estás al corriente. Sin pagos pendientes por hoy.'};
  const h=resumenIngresosHibridos(s);
  $('resumenHumanoContainer').innerHTML=`
    <section class="card" style="padding:20px;text-align:center"><small style="color:var(--text-sec)">SALDO EN CAJA</small><div style="font-size:2.6rem;font-weight:800">${fmtMoney(saldo)}</div>
      <div class="grid-2" style="margin-top:12px"><div><small style="color:${estado.c};font-weight:bold">${porPagar>0?'Por pagar':'Al día'}</small><div>${fmtMoney(porPagar)}</div></div><div><small style="color:#6366f1;font-weight:bold">💎 Ahorro</small><div>${fmtMoney(ahorro)}</div></div></div>
      <div style="margin-top:10px"><small>Disponible</small><strong style="display:block;color:${disponible<0?'var(--danger)':'var(--text-main)'}">${fmtMoney(disponible)}</strong></div></section>
    <div class="grid-2"><section class="card"><strong>🎯 OBJETIVO PRODUCCIÓN</strong><div style="font-size:1.2rem;font-weight:800">${fmtMoney(s.parametros.metaDiaria)}</div><small>Base operativa + mora real</small></section><section class="card" style="border-left:4px solid ${estado.c}"><strong style="color:${estado.c}">${estado.t}</strong><div style="font-size:.8rem;margin-top:5px">${estado.m}</div></section></div>
    <section class="card"><h3 style="font-size:.9rem">💼 Ingresos híbridos acumulados</h3><div class="grid-2"><div>Trabajo fijo<br><strong>${fmtMoney(h.fijo)}</strong></div><div>Reparto<br><strong>${fmtMoney(h.reparto)}</strong></div></div>${proyeccion>0?`<small style="display:block;margin-top:8px;color:var(--text-sec)">Ritmo sugerido futuro: ${fmtMoney(proyeccion)}</small>`:''}</section>`;
}

export function renderDashboardContext(){ if(!$('uiTurnosHoy')) return; const s=getState(),hoy=new Date().toDateString(),ts=s.turnos.filter(t=>new Date(t.fecha).toDateString()===hoy),horas=ts.reduce((a,t)=>a+safeFloat(t.duracionHoras),0),gan=ts.reduce((a,t)=>a+safeFloat(t.ganancia),0); $('uiTurnosHoy').textContent=ts.length; $('uiHorasHoy').textContent=`${horas.toFixed(1)}h`; $('uiIngresoHoraHoy').textContent=horas>0?fmtMoney(gan/horas):'—'; if($('uiCompromisos')) $('uiCompromisos').parentElement.style.display='none'; }

export function renderWallet(){ if(!$('valWallet')) return; const s=getState(); let ahorro=0; s.wallet.sobres.forEach(x=>{if(x.categoria==='Ahorro'||x.categoria==='Meta') ahorro+=safeFloat(x.acumulado)}); $('valWallet').innerHTML=ahorro>0?`<div style="font-size:.8rem;opacity:.8">PATRIMONIO</div><div style="font-size:2rem;font-weight:bold">${fmtMoney(ahorro)}</div>`:'<div style="font-size:.85rem">Tu patrimonio empieza con el primer abono.</div>'; const c=$('sobresContainer'); if(!c)return; c.replaceChildren();
  s.wallet.sobres.forEach(x=>{ const card=document.createElement('section'); card.className='card';
    if(x.categoria==='Ahorro'||x.categoria==='Meta'){card.style.borderLeft='4px solid #6366f1';card.innerHTML=`<strong>💎 ${x.desc}</strong><div>${fmtMoney(x.acumulado)} / ${fmtMoney(x.meta)}</div><button class="btn btn-outline" data-action="ahorro" data-id="${x.id}">+ Abonar</button>`;}
    else if(isGasReserve(x)){card.style.borderLeft='4px solid #f59e0b';card.innerHTML=`<strong>⛽ ${x.desc}</strong><div>${fmtMoney(x.acumulado)}</div><small>Reserva operativa</small>`;}
    else {const e=estadoSobre(x),cfg=e==='vencido'?['#dc2626','⚠️ VENCIDO']:e==='hoy'?['#d97706','📅 TOCA HOY']:e==='cubierto'?['#16a34a','Ciclo cubierto']:['#3b82f6','En progreso'];card.style.borderLeft=`4px solid ${cfg[0]}`;card.innerHTML=`<strong>${x.desc}</strong><div>${fmtMoney(x.acumulado)} / ${fmtMoney(x.meta)}</div><small style="color:${cfg[0]};font-weight:bold">${cfg[1]}</small>`;}
    c.append(card); });
}

export function renderHistorial(){ if(!$('tablaBody'))return; const movs=[...getState().movimientos].sort((a,b)=>new Date(b.fecha)-new Date(a.fecha)).slice(0,50); $('tablaBody').innerHTML=movs.length?movs.map(m=>`<tr><td>${new Date(m.fecha).toLocaleDateString('es-MX',{month:'short',day:'numeric'})}</td><td><strong>${m.desc}</strong><br><small>${m.categoria||''}</small></td><td style="text-align:right;font-weight:bold;color:${m.tipo==='ingreso'?'#16a34a':'#dc2626'}">${m.tipo==='ingreso'?'+':'-'}${fmtMoney(m.monto)}</td></tr>`).join(''):'<tr><td colspan="3" style="text-align:center;padding:20px">Sin datos recientes</td></tr>'; }

export function renderStats(){ if(!$('statIngresoHora'))return; const s=getState(),m=metricasUltimos7Dias(s); $('statIngresoHora').textContent=m.totalHoras>0?fmtMoney(m.ingresoHora):'—'; $('statHorasTotal').textContent=`${m.totalHoras.toFixed(1)}h`; $('statDiasTrabajados').textContent=m.diasTrabajados; $('statIngresoDiario').textContent=fmtMoney(m.ingresoDiario); $('statMetaDiaria').textContent=fmtMoney(s.parametros.metaDiaria); if($('statDiferencia')) $('statDiferencia').textContent=fmtMoney(m.ingresoDiario-s.parametros.metaDiaria); if($('statHorasPromedio')) $('statHorasPromedio').textContent=`${m.horasPromedio.toFixed(1)}h`; if($('statHorasNecesarias')) $('statHorasNecesarias').textContent=m.ingresoHora>0?`${(s.parametros.metaDiaria/m.ingresoHora).toFixed(1)}h`:'—'; if($('statTagSem')) $('statTagSem').textContent=m.totalHoras>0?'PROYECCIÓN':'SIN DATOS'; if($('statsDiagnostico')) $('statsDiagnostico').textContent=m.totalHoras>0?`Margen tras combustible: ${m.totalIngresos>0?(100-(m.totalGasolina/m.totalIngresos)*100).toFixed(1):'0.0'}%.`:'Registra al menos un turno con duración y ganancia.'; }

export function renderAdmin(){ if(!$('kmActual'))return; const s=getState(); $('kmActual').textContent=`${s.parametros.ultimoKM} km`; if($('valSaldoAdmin'))$('valSaldoAdmin').textContent=fmtMoney(s.wallet.saldo); if($('metaDiariaValor'))$('metaDiariaValor').textContent=fmtMoney(s.parametros.metaDiaria); const title=$('metaDiariaValor')?.previousElementSibling;if(title)title.textContent='🎯 Objetivo Producción';
  const ul=$('listaDeudasAdmin');if(ul)ul.innerHTML=s.deudas.filter(d=>safeFloat(d.saldo)>0).map(d=>`<li style="display:flex;justify-content:space-between"><span>${d.desc}</span><strong>${fmtMoney(d.saldo)}</strong></li>`).join('')||'<li style="text-align:center;color:var(--text-sec)">Sin deudas registradas</li>';
  const sel=$('abonoDeudaSelect');if(sel){sel.innerHTML='<option value="">Seleccionar...</option>';s.deudas.filter(d=>safeFloat(d.saldo)>0).forEach(d=>sel.add(new Option(`${d.desc} (${fmtMoney(d.montoCuota)})`,d.id)));}
  if($('turnoEstado'))$('turnoEstado').innerHTML=s.turnoActivo?'<span class="text-green">🟢 EN CURSO</span>':'Detenido'; if($('btnTurnoIniciar'))$('btnTurnoIniciar').classList.toggle('hidden',Boolean(s.turnoActivo));if($('btnTurnoFinalizar'))$('btnTurnoFinalizar').classList.toggle('hidden',!s.turnoActivo);
  const zone=$('zoneIngresoFijo'); if(zone){zone.innerHTML=s.ingresosFijos.length?s.ingresosFijos.filter(x=>x.activo).map(x=>`<div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px"><span>${x.nombre}<br><small>${fmtMoney(x.monto)} · ${x.frecuencia}</small></span><button class="btn btn-success" style="width:auto" data-action="cobro-fijo" data-id="${x.id}">Registrar cobro</button></div>`).join(''):'<small style="color:var(--text-sec)">Sin ingreso fijo configurado.</small>';}
}
