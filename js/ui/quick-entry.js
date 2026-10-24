/* Fase B · Acciones rápidas de presentación; reutiliza el libro contable canónico. */
import { uuid } from '../01_consts_utils.js';
import { getPersonalAccounts, recordUniversalMovement } from '../15_accounts_engine.js';

const ACCOUNT_KEY='hecagus-ux-recent-account-v1';
const THEME_KEY='hecagus-ux-theme-v1';
const CATEGORIES={
  expense:['Comida','Transporte','Vivienda','Servicios','Salud','Otro'],
  income:['Ingreso extra','Reembolso','Otro']
};
let initialized=false;
const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;};
function currentTheme(){return document.documentElement.dataset.theme==='dark'?'dark':'light';}
function setTheme(value){
  document.documentElement.dataset.theme=value;
  document.documentElement.style.colorScheme=value;
  try{localStorage.setItem(THEME_KEY,value);}catch{}
  const button=document.getElementById('phaseBTheme');
  if(button){button.textContent=value==='dark'?'☀️':'🌙';button.setAttribute('aria-label',value==='dark'?'Activar tema claro':'Activar tema oscuro');button.title=value==='dark'?'Tema claro':'Tema oscuro';}
}
function openQuickEntry(type,onRecorded){
  if(!['expense','income'].includes(type))return;
  const accounts=getPersonalAccounts({activeOnly:true});
  if(!accounts.length){alert('No existe una cuenta personal activa. Abre Wallet para crear una.');return;}
  const dialog=el('dialog','quick-entry-dialog');
  dialog.setAttribute('aria-label',type==='expense'?'Registrar gasto rápido':'Registrar ingreso rápido');
  const form=el('form','quick-entry-form');form.noValidate=false;
  const heading=el('h2','',type==='expense'?'Registrar gasto':'Registrar ingreso');
  const help=el('p','quick-entry-help','Movimiento real de hoy. No liquida obligaciones ni cobros programados; esos se registran en Hogar o Actividad.');
  const makeInput=(labelText,id,typeName,opts={})=>{
    const label=el('label','quick-entry-label',labelText);
    const input=el('input','input-control');input.id=id;input.name=id;input.type=typeName;input.required=true;
    if(opts.placeholder)input.placeholder=opts.placeholder;
    if(opts.step)input.step=opts.step;
    if(opts.min)input.min=opts.min;
    if(opts.inputmode)input.inputMode=opts.inputmode;
    label.append(input);return {label,input};
  };
  const amount=makeInput('Monto (MXN)','quickAmount','number',{step:'0.01',min:'0.01',inputmode:'decimal',placeholder:'0.00'});
  const description=makeInput('Concepto','quickDescription','text',{placeholder:type==='expense'?'Ej. Despensa':'Ej. Reembolso'});
  description.input.maxLength=120;
  const accountLabel=el('label','quick-entry-label','Cuenta personal');
  const account=el('select','input-control');account.id='quickAccount';account.name='quickAccount';
  for(const a of accounts)account.add(new Option(a.name,a.id));
  try{const id=localStorage.getItem(ACCOUNT_KEY);if(accounts.some(a=>a.id===id))account.value=id;}catch{}
  accountLabel.append(account);
  const categoryLabel=el('label','quick-entry-label','Categoría');
  const category=el('select','input-control');category.id='quickCategory';category.name='quickCategory';
  for(const name of CATEGORIES[type])category.add(new Option(name,name));
  categoryLabel.append(category);
  const error=el('p','quick-entry-error');error.id='quickEntryError';error.setAttribute('role','alert');
  const actions=el('div','quick-entry-actions');
  const cancel=el('button','btn btn-outline','Cancelar');cancel.type='button';
  const confirm=el('button','btn btn-primary','Guardar movimiento');confirm.type='submit';
  actions.append(cancel,confirm);
  form.append(heading,help,amount.label,description.label,accountLabel,categoryLabel,error,actions);
  dialog.append(form);document.body.append(dialog);
  const close=()=>{if(dialog.open)dialog.close();else dialog.remove();};
  dialog.addEventListener('close',()=>dialog.remove(),{once:true});
  cancel.addEventListener('click',close);
  const opId=uuid();let saved=false;
  form.addEventListener('submit',event=>{
    event.preventDefault();
    if(saved)return;
    const number=Number(amount.input.value),desc=description.input.value.trim();
    if(!Number.isFinite(number)||number<=0||number>1e12||!desc){error.textContent='Indica un monto positivo y un concepto válido.';return;}
    confirm.disabled=true;error.textContent='';
    try{
      recordUniversalMovement({type,description:desc,amount:number,accountId:account.value,category:category.value,operationId:opId});
      saved=true;
      try{localStorage.setItem(ACCOUNT_KEY,account.value);}catch{}
      close();
      onRecorded?.();
    }catch(e){
      console.error('Captura rápida:',e);
      error.textContent=({CUENTA_NO_ENCONTRADA:'La cuenta ya no está disponible.',OPERACION_INCOMPATIBLE:'El movimiento cambió. Reabre el formulario.',MONTO_INVALIDO:'Monto no válido.'})[e.message]||'No se pudo guardar. Comprueba tus datos.';
      confirm.disabled=false;
    }
  });
  if(typeof dialog.showModal==='function')dialog.showModal();else{dialog.setAttribute('open','');dialog.classList.add('quick-entry-fallback');}
  amount.input.focus();
}

export function initExperienceUI(onRecorded){
  if(initialized)return;initialized=true;
  const header=document.querySelector('.header');
  if(header){
    const toolbar=el('div','phase-b-header-tools');
    const action=el('button','phase-b-header-action','+ Registrar');action.type='button';action.setAttribute('data-quick-action','expense');
    const theme=el('button','phase-b-theme-toggle');theme.type='button';theme.id='phaseBTheme';
    toolbar.append(action,theme);header.append(toolbar);
    theme.addEventListener('click',()=>setTheme(currentTheme()==='dark'?'light':'dark'));
    setTheme(currentTheme());
  }
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-quick-action]');
    if(!button||button.disabled)return;
    openQuickEntry(button.dataset.quickAction,onRecorded);
  });
}
