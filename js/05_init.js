/* V10.3 - Orquestación y eventos. */
import { $, CATEGORIAS_BASE, FRECUENCIAS, DIAS_SEMANA } from './01_consts_utils.js';
import * as Data from './02_data.js';
import { Modal, renderIndex, renderDashboardContext, renderWallet, renderHistorial, renderStats, renderAdmin } from './03_render.js';
import { initIncomeUI, renderIncomeUI } from './06_income_ui.js';

const refresh=()=>{const page=document.body.dataset.page;if(page==='index'){renderIndex();renderDashboardContext();}else if(page==='wallet')renderWallet();else if(page==='historial')renderHistorial();else if(page==='stats')renderStats();else if(page==='admin')renderAdmin();renderIncomeUI();};
const ERROR_MESSAGES={
  KM_MENOR:'⛔ El kilometraje no puede ser menor al anterior.',
  KM_INVALIDO:'Ingresa un kilometraje válido mayor a 0.',
  SALDO_INVALIDO:'El saldo inicial no puede ser negativo.',
  MONTO_INVALIDO:'Ingresa un monto mayor a 0.',
  LITROS_INVALIDOS:'Ingresa una cantidad de litros mayor a 0.',
  GANANCIA_INVALIDA:'La ganancia no puede ser negativa.',
  DESCRIPCION_INVALIDA:'Escribe una descripción.',
  NOMBRE_INVALIDO:'Escribe un nombre válido.',
  TOTAL_INVALIDO:'El total de la deuda debe ser mayor a 0.',
  CUOTA_INVALIDA:'La cuota debe ser mayor a 0.',
  TURNO_NO_ACTIVO:'No hay un turno activo para finalizar.',
  TURNO_YA_ACTIVO:'Ya hay un turno de reparto activo.',
  BACKUP_INVALIDO:'El respaldo no es un JSON válido de esta aplicación.',
  COBRO_DUPLICADO:'Ese ingreso fijo ya fue registrado para este periodo.'
};
const safe=fn=>{try{fn();refresh();}catch(e){console.error(e);alert(ERROR_MESSAGES[e.message]||'No se pudo completar la operación.');}};

function initAdminEvents(){
  $('btnTurnoIniciar')?.addEventListener('click',()=>safe(()=>Data.iniciarTurno()));
  $('btnTurnoFinalizar')?.addEventListener('click',()=>Modal.show('Cerrar Turno',[{label:'KM Final',key:'k',type:'number'},{label:'Ganancia ($)',key:'g',type:'number'}],d=>{const g=Number(d.g);if(g===0&&!confirm('Estás cerrando el turno con $0.00. ¿Es correcto?'))return;safe(()=>Data.finalizarTurno(d.k,d.g));}));
  $('btnGasolina')?.addEventListener('click',()=>Modal.show('Gasolina',[{label:'Litros',key:'l',type:'number'},{label:'Costo ($)',key:'c',type:'number'},{label:'KM Actual',key:'k',type:'number'}],d=>safe(()=>Data.registrarGasolina(d.l,d.c,d.k))));
  const gasto=tipo=>{const cats=[...CATEGORIAS_BASE[tipo]];Modal.show(tipo==='hogar'?'Nuevo Gasto Hogar':'Nuevo Gasto Operativo',[{label:'Descripción',key:'d'},{label:'Monto',key:'m',type:'number'},{label:'Categoría',key:'c',type:'select',options:cats.map(x=>({val:x,txt:x}))},{label:'Frecuencia',key:'f',type:'select',options:Object.keys(FRECUENCIAS).map(x=>({val:x,txt:x}))}],d=>safe(()=>Data.nuevoGasto(d.d,d.m,d.c,d.f)));};
  $('btnGastoHogar')?.addEventListener('click',()=>gasto('hogar'));$('btnGastoOperativo')?.addEventListener('click',()=>gasto('operativo'));
  $('btnDeudaNueva')?.addEventListener('click',()=>Modal.show('Nueva Deuda',[{label:'Nombre',key:'d'},{label:'Total',key:'t',type:'number'},{label:'Cuota',key:'c',type:'number'},{label:'Frecuencia',key:'f',type:'select',options:Object.keys(FRECUENCIAS).map(x=>({val:x,txt:x}))},{label:'Día de pago',key:'dp',type:'select',options:DIAS_SEMANA}],d=>safe(()=>Data.nuevaDeuda(d.d,d.t,d.c,d.f,d.dp))));
  $('btnAbonoCuota')?.addEventListener('click',()=>{const id=$('abonoDeudaSelect')?.value;if(!id)return alert('Selecciona una deuda.');if(confirm('¿Confirmar abono?'))safe(()=>Data.abonarDeuda(id));});
  $('btnConfigKM')?.addEventListener('click',()=>{if(Data.getState().parametros.kmInicialConfigurado)return alert('Gestionado automáticamente por los turnos.');Modal.show('Configurar KM',[{label:'KM',key:'k',type:'number'}],d=>safe(()=>Data.configurarKM(d.k)));});
  $('btnConfigSaldo')?.addEventListener('click',()=>{if(Data.getState().parametros.saldoInicialConfigurado)return alert('El saldo inicial ya fue declarado. Los cambios posteriores se gestionan mediante movimientos.');Modal.show('¿Cuánto dinero tienes actualmente?',[{label:'Saldo real disponible ($)',key:'m',type:'number'}],d=>safe(()=>Data.saldoInicial(d.m)));});
  $('btnExportJSON')?.addEventListener('click',async()=>{const json=JSON.stringify(Data.getState(),null,2);try{await navigator.clipboard.writeText(json);alert('Respaldo copiado al portapapeles.');}catch{const blob=new Blob([json],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`presupuesto-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(url);alert('Se descargó el respaldo porque el portapapeles no estuvo disponible.');}});
  $('btnRestoreBackup')?.addEventListener('click',()=>Modal.show('Restaurar respaldo',[{label:'JSON',key:'j'}],d=>{if(!confirm('Esto reemplazará los datos actuales por el respaldo. ¿Continuar?'))return;safe(()=>Data.restaurar(d.j));}));
}

function initDelegation(){document.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(!b)return;if(b.dataset.action==='ahorro')Modal.show('Abonar ahorro',[{label:'Monto',key:'m',type:'number'}],d=>safe(()=>Data.abonarAhorro(b.dataset.id,d.m)));});}
function startTimer(){if(document.body.dataset.page!=='admin')return;window.setInterval(()=>{const t=Data.getState().turnoActivo,el=$('turnoTimer');if(!el||!t)return;const diff=Date.now()-t.inicio;el.textContent=`${Math.floor(diff/3600000)}h ${Math.floor((diff%3600000)/60000)}m`;},1000);}

document.addEventListener('DOMContentLoaded',()=>{Data.loadData();refresh();initDelegation();initIncomeUI();if(document.body.dataset.page==='admin')initAdminEvents();startTimer();console.log('V10.3 modular activa');});
