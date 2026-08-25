/* V10 - Orquestación y eventos. */
import { $, CATEGORIAS_BASE, FRECUENCIAS, DIAS_SEMANA } from './01_consts_utils.js';
import * as Data from './02_data.js';
import { Modal, renderIndex, renderDashboardContext, renderWallet, renderHistorial, renderStats, renderAdmin } from './03_render.js';

const refresh = () => {
  const page=document.body.dataset.page;
  if(page==='index'){renderIndex();renderDashboardContext();}
  else if(page==='wallet')renderWallet(); else if(page==='historial')renderHistorial(); else if(page==='stats')renderStats(); else if(page==='admin')renderAdmin();
};
const safe = fn => { try { fn(); refresh(); } catch(e) { console.error(e); alert(e.message==='KM_MENOR'?'⛔ El kilometraje no puede ser menor al anterior.':'No se pudo completar la operación.'); } };

function initAdminEvents(){
  $('btnTurnoIniciar')?.addEventListener('click',()=>safe(()=>Data.iniciarTurno()));
  $('btnTurnoFinalizar')?.addEventListener('click',()=>Modal.show('Cerrar Turno',[{label:'KM Final',key:'k',type:'number'},{label:'Ganancia ($)',key:'g',type:'number'}],d=>{const g=Number(d.g);if(g===0&&!confirm('Estás cerrando el turno con $0.00. ¿Es correcto?'))return;safe(()=>Data.finalizarTurno(d.k,d.g));}));
  $('btnGasolina')?.addEventListener('click',()=>Modal.show('Gasolina',[{label:'Litros',key:'l',type:'number'},{label:'Costo ($)',key:'c',type:'number'},{label:'KM Actual',key:'k',type:'number'}],d=>safe(()=>Data.registrarGasolina(d.l,d.c,d.k))));
  const gasto=(tipo)=>{const cats=[...CATEGORIAS_BASE[tipo]];Modal.show(tipo==='hogar'?'Nuevo Gasto Hogar':'Nuevo Gasto Operativo',[{label:'Descripción',key:'d'},{label:'Monto',key:'m',type:'number'},{label:'Categoría',key:'c',type:'select',options:cats.map(x=>({val:x,txt:x}))},{label:'Frecuencia',key:'f',type:'select',options:Object.keys(FRECUENCIAS).map(x=>({val:x,txt:x}))}],d=>safe(()=>Data.nuevoGasto(d.d,d.m,d.c,d.f)));};
  $('btnGastoHogar')?.addEventListener('click',()=>gasto('hogar')); $('btnGastoOperativo')?.addEventListener('click',()=>gasto('operativo'));
  $('btnDeudaNueva')?.addEventListener('click',()=>Modal.show('Nueva Deuda',[{label:'Nombre',key:'d'},{label:'Total',key:'t',type:'number'},{label:'Cuota',key:'c',type:'number'},{label:'Frecuencia',key:'f',type:'select',options:Object.keys(FRECUENCIAS).map(x=>({val:x,txt:x}))},{label:'Día de pago',key:'dp',type:'select',options:DIAS_SEMANA}],d=>safe(()=>Data.nuevaDeuda(d.d,d.t,d.c,d.f,d.dp))));
  $('btnAbonoCuota')?.addEventListener('click',()=>{const id=$('abonoDeudaSelect')?.value;if(!id)return alert('Selecciona una deuda.');if(confirm('¿Confirmar abono?'))safe(()=>Data.abonarDeuda(id));});
  $('btnConfigKM')?.addEventListener('click',()=>{if(Data.getState().parametros.kmInicialConfigurado)return alert('Gestionado automáticamente por los turnos.');Modal.show('Configurar KM',[{label:'KM',key:'k',type:'number'}],d=>safe(()=>Data.configurarKM(d.k)));});
  $('btnConfigSaldo')?.addEventListener('click',()=>{if(Data.getState().parametros.saldoInicialConfigurado)return alert('Gestionado por flujo de caja.');Modal.show('Capital inicial',[{label:'Monto',key:'m',type:'number'}],d=>safe(()=>Data.saldoInicial(d.m)));});
  $('btnExportJSON')?.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(JSON.stringify(Data.getState()));alert('Datos copiados.');}catch{alert('No se pudo copiar.');}});
  $('btnRestoreBackup')?.addEventListener('click',()=>Modal.show('Restaurar respaldo',[{label:'JSON',key:'j'}],d=>safe(()=>Data.restaurar(d.j))));
  $('btnIngresoFijoNuevo')?.addEventListener('click',()=>Modal.show('Nuevo ingreso fijo',[{label:'Nombre / empresa',key:'n'},{label:'Monto por pago',key:'m',type:'number'},{label:'Frecuencia',key:'f',type:'select',options:Object.keys(FRECUENCIAS).filter(x=>x!=='Unico').map(x=>({val:x,txt:x}))},{label:'Día de pago',key:'dp',type:'number'}],d=>safe(()=>Data.crearIngresoFijo(d.n,d.m,d.f,d.dp))));
}

function initDelegation(){document.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(!b)return;if(b.dataset.action==='ahorro')Modal.show('Abonar ahorro',[{label:'Monto',key:'m',type:'number'}],d=>safe(()=>Data.abonarAhorro(b.dataset.id,d.m)));if(b.dataset.action==='cobro-fijo'&&confirm('¿Registrar este ingreso en caja?'))safe(()=>Data.registrarCobroFijo(b.dataset.id));});}

function startTimer(){if(document.body.dataset.page!=='admin')return;window.setInterval(()=>{const t=Data.getState().turnoActivo,el=$('turnoTimer');if(!el||!t)return;const diff=Date.now()-t.inicio;el.textContent=`${Math.floor(diff/3600000)}h ${Math.floor((diff%3600000)/60000)}m`;},1000);}

document.addEventListener('DOMContentLoaded',()=>{Data.loadData();refresh();initDelegation();if(document.body.dataset.page==='admin')initAdminEvents();startTimer();console.log('V10 modular activa');});
