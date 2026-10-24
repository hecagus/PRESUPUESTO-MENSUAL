/* Fase B · Historial filtrable. Proyección y contabilidad permanecen en sus motores. */
import { fmtMoney, safeFloat } from '../01_consts_utils.js';
import { getState } from '../02_data.js';

const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fold = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-MX');
const nameOf = (items, id, fallback) => items.find(x => x.id === id)?.name || fallback;
const validDate = value => Number.isFinite(new Date(value).getTime());

export function buildHistoryEvents(state) {
  const s = state || {}, events = [];
  const accounts = s.accounts || [], sources = s.workSources || [];
  for (const m of s.movimientos || []) {
    const reconcile = m.movementKind === 'reconciliation';
    const transfer = m.tipo === 'transferencia';
    const kind = reconcile ? 'reconciliation' : transfer ? 'transfer' : m.tipo === 'ingreso' ? 'income' : 'expense';
    const title = transfer ? 'Transferencia' : m.desc || 'Movimiento';
    const meta = transfer
      ? nameOf(accounts, m.fromAccountId, 'Cuenta') + ' → ' + nameOf(accounts, m.toAccountId, 'Cuenta')
      : [m.categoria || '', m.accountId ? nameOf(accounts, m.accountId, 'Cuenta') : '', m.affectsPersonal === false ? 'No afecta patrimonio' : '', m.sourceId ? nameOf(sources, m.sourceId, '') : ''].filter(Boolean).join(' · ');
    events.push({ fecha:m.fecha, title, meta, kind, amount:safeFloat(m.monto),
      status: reconcile ? 'Ajuste de saldo' : transfer ? 'Entre cuentas' : m.categoria === 'Sistema' ? 'Registro de sistema' : 'Registrado' });
  }
  for (const t of s.turnos || []) {
    events.push({ fecha:t.fecha, title:'Actividad · ' + nameOf(sources, t.sourceId, 'Trabajo'),
      meta:safeFloat(t.duracionHoras).toFixed(1) + ' h' + (safeFloat(t.kmRecorrido)>0 ? ' · ' + safeFloat(t.kmRecorrido).toFixed(0) + ' km' : ''),
      kind:'activity', amount:null, status:'Jornada registrada' });
  }
  for (const f of s.fondosCombustibleEmpresa || []) {
    events.push({fecha:f.fecha, title:f.desc || 'Fondo de empresa · ' + nameOf(sources, f.sourceId, 'Trabajo'),
      meta:'Fondos de terceros · no son patrimonio', kind:'thirdparty', amount:safeFloat(f.monto), status:'Fondo de empresa'});
  }
  for (const c of (s.cargasCombustible || []).filter(x => x.pagador === 'empresa')) {
    const account=nameOf(accounts,c.accountId,'');
    events.push({fecha:c.fecha,title:'Combustible' + (c.gasolinera ? ' · ' + c.gasolinera : ''),
      meta:[nameOf(sources,c.sourceId,'Uso personal'),account,safeFloat(c.litros).toFixed(2)+' L','fondo de tercero'].filter(Boolean).join(' · '),
      kind:'thirdparty',amount:-safeFloat(c.costo),status:'Pagado por empresa'});
  }
  return events.filter(e=>validDate(e.fecha)).sort((a,b)=>new Date(b.fecha)-new Date(a.fecha));
}

export function filterHistoryEvents(events, options={}, now=new Date()) {
  const query=fold(options.query).trim(), kind=options.kind || 'all', days=Number(options.days || 0);
  const cutoff=days>0 ? new Date(now.getTime()-days*86400000).getTime() : -Infinity;
  return events.filter(e =>
    (kind==='all'||e.kind===kind) &&
    new Date(e.fecha).getTime()>=cutoff &&
    (!query||fold([e.title,e.meta,e.status,e.amount == null?'':e.amount].join(' ')).includes(query))
  );
}

let bound=false;
export function initHistoryFilters() {
  if(bound || !document.getElementById('historySearch'))return;
  bound=true;
  for(const id of ['historySearch','historyKind','historyDays']) {
    document.getElementById(id)?.addEventListener(id==='historySearch'?'input':'change',renderHistory);
  }
  document.getElementById('historyClear')?.addEventListener('click',()=>{
    document.getElementById('historySearch').value='';
    document.getElementById('historyKind').value='all';
    document.getElementById('historyDays').value='0';
    renderHistory();
    document.getElementById('historySearch').focus();
  });
}

export function renderHistory() {
  const body=document.getElementById('tablaBody');if(!body)return;
  const all=buildHistoryEvents(getState());
  const events=filterHistoryEvents(all,{
    query:document.getElementById('historySearch')?.value,
    kind:document.getElementById('historyKind')?.value,
    days:document.getElementById('historyDays')?.value
  });
  const shown=events.slice(0,200);
  const count=document.getElementById('historyCount');
  if(count)count.textContent=events.length
    ? 'Mostrando '+shown.length+' de '+events.length+' coincidencias (total: '+all.length+').'
    : 'Sin coincidencias. Total de registros: '+all.length+'.';
  body.innerHTML=shown.map(e=>{
    const date=new Date(e.fecha);
    const day=date.toLocaleDateString('es-MX',{day:'numeric',month:'short'});
    const time=date.toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'});
    let value='—';
    if(e.amount!==null){
      const sign=e.kind==='transfer'?'⇄ ':e.kind==='reconciliation'?'± ':e.kind==='income'||e.kind==='thirdparty'&&e.amount>=0?'+':e.kind==='expense'||e.kind==='thirdparty'&&e.amount<0?'-':'';
      value=sign+fmtMoney(Math.abs(e.amount));
    }
    return '<tr class="history-row" data-kind="'+e.kind+'"><td><time datetime="'+escapeHTML(e.fecha)+'">'+escapeHTML(day)+'</time><small>'+escapeHTML(time)+'</small></td>'+
      '<td><strong>'+escapeHTML(e.title)+'</strong><small>'+escapeHTML(e.meta)+'</small><span class="history-state history-state--'+e.kind+'">'+escapeHTML(e.status)+'</span></td>'+
      '<td class="history-amount history-amount--'+e.kind+'">'+escapeHTML(value)+'</td></tr>';
  }).join('') || '<tr><td colspan="3" class="history-empty">No hay registros para estos filtros.</td></tr>';
}
