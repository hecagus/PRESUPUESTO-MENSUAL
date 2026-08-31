/* v2.9.0 - Actividad muestra sólo información operativa; finanzas personales viven en Panel/Wallet/Hogar. */
import { $, fmtMoney, safeFloat } from './01_consts_utils.js';
import { getState } from './02_data.js';
import { metricasFuente, rendimientoCombustible, gastosOperativosRecientes } from './04_charts.js';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dateLabel=v=>new Date(v).toLocaleDateString('es-MX',{day:'numeric',month:'short'});

function renderFuel(){
  const state=getState(),box=$('fuelEfficiencySummary');if(!box)return;
  const r=rendimientoCombustible(state);
  if(!r.fills.length){box.innerHTML='<small>Registra una carga con litros y kilometraje para empezar a medir consumo.</small>';return;}
  if(!r.hasEstimate){
    const last=r.fills.at(-1);box.innerHTML=`<div class="grid-2"><div><small>Última carga</small><strong style="display:block">${last.litros.toFixed(2)} L</strong></div><div><small>Odómetro</small><strong style="display:block">${last.km.toFixed(0)} km</strong></div></div><small style="display:block;margin-top:8px;color:var(--text-sec)">Falta una segunda carga con kilometraje para calcular km/L entre cargas.</small>`;return;
  }
  const last=r.last;
  box.innerHTML=`<div class="grid-2"><div><small>Último tramo</small><strong style="display:block">${last.kmL.toFixed(1)} km/L</strong><small>${last.km.toFixed(0)} km entre cargas</small></div><div><small>Promedio reciente</small><strong style="display:block">${r.avgKmL.toFixed(1)} km/L</strong><small>${r.recent.length} tramo${r.recent.length===1?'':'s'}</small></div><div><small>Costo del último tramo</small><strong style="display:block">${fmtMoney(last.costoKm)}/km</strong></div><div><small>Último precio / litro</small><strong style="display:block">${fmtMoney(last.precioLitro)}/L</strong></div></div><small style="display:block;margin-top:8px;color:var(--text-sec)">Estimación entre cargas usando el odómetro. Es más fiable cuando cargas a un nivel parecido cada vez.</small>`;
}

function renderExpenses(){
  const state=getState(),box=$('operationalExpenseRows');if(!box)return;
  const rows=gastosOperativosRecientes(state,6);
  box.innerHTML=rows.length?rows.map(m=>{const src=state.workSources?.find(s=>s.id===m.sourceId);return `<div style="display:flex;justify-content:space-between;gap:10px;padding:9px 0;border-top:1px solid #e2e8f0"><span><strong>${esc(m.desc)}</strong><small style="display:block;color:var(--text-sec)">${dateLabel(m.fecha)} · ${esc(m.categoria||'Operativo')}${src?` · ${esc(src.name)}`:''}</small></span><strong style="color:#dc2626">-${fmtMoney(m.monto)}</strong></div>`;}).join(''):'<small>No hay costos operativos recientes. Cuando registres uno aparecerá aquí y también en Historial.</small>';
}

function renderSourcePerformance(){
  const state=getState(),box=$('activityPerformanceZone');if(!box)return;
  const sources=(state.workSources||[]).filter(s=>s.active!==false&&s.status!=='paused'&&s.status!=='ended');
  box.innerHTML=sources.length?sources.map(s=>{const m=metricasFuente(state,s.id,{days:7});return `<div style="padding:9px 0;border-top:1px solid #e2e8f0"><strong>${esc(s.name)}</strong><div class="grid-2" style="margin-top:5px"><small>7 días · ${m.horas.toFixed(1)} h · ${m.km.toFixed(0)} km</small><small style="text-align:right">Ingreso ${fmtMoney(m.ingresos)}${m.ingresoHora>0?` · ${fmtMoney(m.ingresoHora)}/h`:''}</small></div></div>`;}).join(''):'<small>No hay fuentes activas.</small>';
}

export function renderActivityInsights(){renderFuel();renderExpenses();renderSourcePerformance();}
