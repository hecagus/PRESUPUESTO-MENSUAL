/* v2.6.1 - Orquestación de UI, plataforma financiera, PWA, metas y sincronización. */
import { $, CATEGORIAS_BASE, FRECUENCIAS, APP_VERSION, COMPENSATIONS } from './01_consts_utils.js';
import * as Data from './02_data.js';
import { Modal, renderIndex, renderWallet, renderHistorial, renderStats, renderAdmin } from './03_render.js';
import { initSync, notifyLocalChange } from './07_sync.js';
import { initPWA, promptInstall } from './08_pwa.js';
import { ensureSavingsGoals } from './11_savings_goals.js';
import { renderSavingsGoalsUI, initSavingsGoalEvents } from './12_savings_ui.js';
import { ensureFinancialLife } from './13_financial_life.js';
import { renderFinancialPositionPanel, renderCalendarPreview, renderCalendarPage, initCalendarEvents } from './14_calendar_ui.js';
import { runAutomationEngine } from './17_automation_engine.js';
import { ensureFinancialPlatform, renderFinancialPlatform, initFinancialPlatformEvents } from './19_platform_ui.js';

const refresh=()=>{
  const page=document.body.dataset.page;
  if(page==='index'){renderIndex();renderFinancialPositionPanel();renderCalendarPreview();}
  else if(page==='wallet')renderWallet();
  else if(page==='historial')renderHistorial();
  else if(page==='stats')renderStats();
  else if(page==='admin')renderAdmin();
  else if(page==='calendar')renderCalendarPage();
  if(page==='admin')$('btnConfigSaldo')?.classList.toggle('hidden',Boolean(Data.getState().parametros.saldoInicialConfigurado));
  renderSavingsGoalsUI();
  renderFinancialPlatform();
};

const ERROR_MESSAGES={
  KM_MENOR:'⛔ El kilometraje no puede ser menor al anterior.',KM_INVALIDO:'Ingresa un kilometraje válido mayor a 0.',
  SALDO_INVALIDO:'El saldo inicial no puede ser negativo.',MONTO_INVALIDO:'Ingresa un monto mayor a 0.',
  LITROS_INVALIDOS:'Ingresa una cantidad de litros mayor a 0.',GANANCIA_INVALIDA:'La ganancia no puede ser negativa.',
  DESCRIPCION_INVALIDA:'Escribe una descripción.',NOMBRE_INVALIDO:'Escribe un nombre válido.',TOTAL_INVALIDO:'El total de la deuda debe ser mayor a 0.',
  CUOTA_INVALIDA:'La cuota debe ser mayor a 0.',TURNO_NO_ACTIVO:'No hay una actividad activa para finalizar.',TURNO_YA_ACTIVO:'Ya hay una actividad en curso.',
  FUENTE_NO_ENCONTRADA:'No se encontró esa fuente de ingreso.',ORIGEN_COMBUSTIBLE_REQUERIDO:'Selecciona a qué actividad corresponde el combustible.',
  FONDO_NO_APLICA:'Esa fuente no usa fondos de empresa.',BACKUP_INVALIDO:'El respaldo no es un JSON válido de esta aplicación.',
  COBRO_DUPLICADO:'Ya existe un cobro registrado para este periodo.',RECETA_INVALIDA:'Selecciona un ingrediente válido.',
  INGREDIENTE_NO_ENCONTRADO:'No se encontró el ingrediente.',PRODUCTO_NO_ENCONTRADO:'No se encontró el producto.',CANTIDAD_INVALIDA:'Ingresa una cantidad mayor a 0.'
};

const safe=fn=>{try{fn();runAutomationEngine();refresh();notifyLocalChange();}catch(e){console.error(e);alert(ERROR_MESSAGES[e.message]||'No se pudo completar la operación.');}};
const optionsSources=(filter=()=>true)=>Data.getState().workSources.filter(s=>s.active!==false&&filter(s)).map(s=>({val:s.id,txt:s.name}));

function finishActive(){
  const state=Data.getState(),active=state.activeActivity;if(!active)return alert(ERROR_MESSAGES.TURNO_NO_ACTIVO);
  const source=Data.fuenteById(active.sourceId);if(!source)return alert(ERROR_MESSAGES.FUENTE_NO_ENCONTRADA);
  const fields=[];
  if(source.trackDistance)fields.push({label:'KM final',key:'k',type:'number'});
  if(COMPENSATIONS[source.compensation]?.captureOnActivity)fields.push({label:'Ingreso de esta actividad ($)',key:'g',type:'number'});
  Modal.show(`Finalizar · ${source.name}`,fields,d=>safe(()=>Data.finalizarActividad({kmFinal:d.k,income:d.g})));
}

function fuelModal(){
  const state=Data.getState(),active=state.activeActivity?Data.fuenteById(state.activeActivity.sourceId):null,fields=[];
  if(!active){
    const opts=optionsSources(s=>s.fuelPayer==='company'||s.fuelPayer==='personal');opts.push({val:'personal',txt:'Uso personal'});
    fields.push({label:'¿A qué actividad corresponde?',key:'source',type:'select',options:opts});
  }
  fields.push({label:'Litros',key:'l',type:'number'},{label:'Costo ($)',key:'c',type:'number'},{label:'KM actual',key:'k',type:'number'},{label:'Gasolinera / referencia (opcional)',key:'e'});
  Modal.show(active?`Combustible · ${active.name}`:'Repostaje de combustible',fields,d=>safe(()=>{
    const sourceId=active?.id||(d.source==='personal'?null:d.source||null);
    const payer=d.source==='personal'?'personal':null;
    Data.registrarCombustible({litros:d.l,costo:d.c,km:d.k,sourceId,payer,gasolinera:d.e});
  }));
}

function companyFundModal(){
  const company=Data.getState().workSources.filter(s=>s.active!==false&&s.fuelPayer==='company');if(!company.length)return;
  const fields=[];if(company.length>1)fields.push({label:'Fuente / empresa',key:'source',type:'select',options:company.map(s=>({val:s.id,txt:s.name}))});
  fields.push({label:'Importe depositado ($)',key:'m',type:'number'});
  Modal.show('Depósito de fondo empresarial',fields,d=>safe(()=>Data.registrarFondoFuente(d.source||company[0].id,d.m)));
}

function expenseModal(type){
  const cats=[...CATEGORIAS_BASE[type]];
  Modal.show(type==='hogar'?'Nuevo gasto personal':'Nuevo gasto operativo',[
    {label:'Descripción',key:'d'},{label:'Monto',key:'m',type:'number'},
    {label:'Categoría',key:'c',type:'select',options:cats.map(x=>({val:x,txt:x}))},
    {label:'Frecuencia',key:'f',type:'select',options:Object.keys(FRECUENCIAS).map(x=>({val:x,txt:x}))}
  ],d=>safe(()=>Data.nuevoGasto(d.d,d.m,d.c,d.f)));
}

function newIngredient(){Modal.show('Nuevo ingrediente',[{label:'Ingrediente',key:'n'},{label:'Unidad (g, ml, pieza...)',key:'u'},{label:'Costo por unidad ($)',key:'c',type:'number'}],d=>safe(()=>Data.crearIngrediente(d.n,d.u,d.c)));}
function updateIngredient(id){const ingredient=Data.getState().business.ingredients.find(x=>x.id===id);if(!ingredient)return alert(ERROR_MESSAGES.INGREDIENTE_NO_ENCONTRADO);Modal.show(`Actualizar costo · ${ingredient.name}`,[{label:`Nuevo costo por ${ingredient.unit} ($)`,key:'c',type:'number',value:ingredient.costPerUnit}],d=>safe(()=>Data.actualizarCostoIngrediente(id,d.c)));}
function newProduct(){Modal.show('Nuevo producto',[{label:'Producto',key:'n'},{label:'Precio de venta ($)',key:'p',type:'number'}],d=>safe(()=>Data.crearProducto(d.n,d.p)));}
function recipeItem(productId){const ingredients=Data.getState().business.ingredients;if(!ingredients.length)return alert('Primero registra al menos un ingrediente.');Modal.show('Agregar ingrediente a receta',[{label:'Ingrediente',key:'i',type:'select',options:ingredients.map(x=>({val:x.id,txt:`${x.name} · $${x.costPerUnit}/${x.unit}`}))},{label:'Cantidad usada',key:'q',type:'number'}],d=>safe(()=>Data.agregarIngredienteProducto(productId,d.i,d.q)));}
function saleProduct(productId){Modal.show('Registrar venta',[{label:'Cantidad',key:'q',type:'number'}],d=>safe(()=>Data.registrarVentaProducto(productId,d.q)));}

function initAdminEvents(){
  $('btnFuel')?.addEventListener('click',fuelModal);
  $('btnCompanyFund')?.addEventListener('click',companyFundModal);
  $('btnGastoHogar')?.addEventListener('click',()=>expenseModal('hogar'));
  $('btnGastoOperativo')?.addEventListener('click',()=>expenseModal('operativo'));
  $('btnDeudaNueva')?.addEventListener('click',()=>Modal.show('Nueva deuda',[
    {label:'Nombre',key:'d'},
    {label:'Total',key:'t',type:'number'},
    {label:'Cuota',key:'c',type:'number'},
    {label:'Plan de pago',key:'f',type:'select',options:['Unico','Semanal','Quincenal','Mensual'].map(x=>({val:x,txt:x==='Unico'?'Una sola vez':x}))},
    {label:'Día de pago / vencimiento',key:'dp',type:'number',value:1}
  ],d=>safe(()=>Data.nuevaDeuda(d.d,d.t,d.c,d.f,d.dp))));
  $('btnAbonoCuota')?.addEventListener('click',()=>{const id=$('abonoDeudaSelect')?.value;if(!id)return alert('Selecciona una deuda.');if(confirm('¿Confirmar abono?'))safe(()=>Data.abonarDeuda(id));});
  $('btnConfigKM')?.addEventListener('click',()=>{if(Data.getState().parametros.kmInicialConfigurado)return alert('El kilometraje ya se gestiona con tus actividades.');Modal.show('Configurar kilometraje',[{label:'KM actuales',key:'k',type:'number'}],d=>safe(()=>Data.configurarKM(d.k)));});
  $('btnConfigSaldo')?.addEventListener('click',()=>{if(Data.getState().parametros.saldoInicialConfigurado)return;Modal.show('¿Cuánto dinero tienes ahora?',[{label:'Saldo personal ($)',key:'m',type:'number'}],d=>safe(()=>Data.saldoInicial(d.m)));});
  $('btnExportJSON')?.addEventListener('click',async()=>{const json=JSON.stringify(Data.getState(),null,2);try{await navigator.clipboard.writeText(json);alert('Respaldo copiado.');}catch{const blob=new Blob([json],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`hecagus-finance-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(url);alert('Respaldo descargado.');}});
  $('btnRestoreBackup')?.addEventListener('click',()=>Modal.show('Restaurar respaldo',[{label:'JSON',key:'j'}],d=>{if(!confirm('Esto reemplazará los datos actuales. ¿Continuar?'))return;safe(()=>Data.restaurar(d.j));}));
}

function initGlobalEvents(){
  $('btnInstallApp')?.addEventListener('click',async()=>{const installed=await promptInstall();if(!installed)alert('Usa el menú del navegador para instalar la app.');});
}

function initDelegation(){
  document.addEventListener('click',e=>{
    const b=e.target.closest('[data-action]');if(!b||b.disabled)return;
    const action=b.dataset.action,id=b.dataset.id;
    if(action==='ahorro')return Modal.show('Abonar ahorro',[{label:'Monto',key:'m',type:'number'}],d=>safe(()=>Data.abonarAhorro(id,d.m)));
    if(action==='start-source')return safe(()=>Data.iniciarActividad(id));
    if(action==='finish-source')return finishActive();
    if(action==='pay-source')return Modal.show('Registrar pago',[{label:'Importe recibido ($)',key:'m',type:'number'}],d=>safe(()=>Data.registrarPagoFuente(id,d.m)));
    if(action==='new-ingredient')return newIngredient();
    if(action==='update-ingredient')return updateIngredient(id);
    if(action==='new-product')return newProduct();
    if(action==='recipe-item')return recipeItem(id);
    if(action==='sale-product')return saleProduct(id);
  });
}

function startTimer(){if(document.body.dataset.page!=='admin')return;window.setInterval(()=>{const t=Data.getState().activeActivity,el=$('activityTimer');if(!el)return;if(!t){el.textContent='00:00:00';return;}const diff=Date.now()-t.inicio;el.textContent=`${Math.floor(diff/3600000)}h ${Math.floor((diff%3600000)/60000)}m`;},1000);}

document.addEventListener('budget:remote-applied',()=>{ensureSavingsGoals();ensureFinancialLife();ensureFinancialPlatform();const applied=runAutomationEngine();refresh();if(applied)notifyLocalChange();});
document.addEventListener('DOMContentLoaded',()=>{
  Data.loadData();ensureSavingsGoals();ensureFinancialLife();ensureFinancialPlatform();
  if(!Data.getState().profile.onboarded){window.location.replace('onboarding.html');return;}
  runAutomationEngine();refresh();initDelegation();initGlobalEvents();
  initSavingsGoalEvents(()=>{refresh();notifyLocalChange();});
  initFinancialPlatformEvents(()=>{refresh();notifyLocalChange();});
  if(document.body.dataset.page==='admin')initAdminEvents();
  if(document.body.dataset.page==='calendar')initCalendarEvents(()=>{refresh();notifyLocalChange();});
  startTimer();initPWA();initSync();console.log(`La app del HecAgus v${APP_VERSION}`);
});
