/* Return audit: confirm money once, without rebuilding every missing purchase. */
import {getState} from './02_data.js';
import {uuid,fmtMoney} from './01_consts_utils.js';
import {accountLedgerBalance,goalReserved} from './domain/financial-rules.js';
import {ensureSavingsGoals} from './11_savings_goals.js';
import {financialFreshness,auditFingerprint,completeFinancialAudit} from './29_financial_freshness.js';

let overlay=null,releaseOverlay=null,overlayReturnFocus=null;
export const isFinancialAuditOpen=()=>Boolean(overlay?.isConnected&&overlay.ownerDocument===document);
const removeOverlay=({restoreFocus=false,notify=false}={})=>{
  const dialog=overlay,previousFocus=overlayReturnFocus;
  releaseOverlay?.();releaseOverlay=null;overlayReturnFocus=null;overlay=null;dialog?.remove();
  if(restoreFocus&&previousFocus?.isConnected)previousFocus.focus?.();
  if(notify)document.dispatchEvent(new CustomEvent('budget:audit-closed'));
};
const focusableElements=dialog=>[...dialog.querySelectorAll('input,select,textarea,button,a[href],summary,[tabindex]')].filter(el=>{
  if(el.disabled||el.tabIndex<0||el.closest('[hidden],.hidden,[inert],[aria-hidden="true"]'))return false;
  for(let parent=el;parent&&parent!==dialog;parent=parent.parentElement){const style=dialog.ownerDocument.defaultView.getComputedStyle(parent);if(style.display==='none'||style.visibility==='hidden'||style.visibility==='collapse')return false;}
  return true;
});
const isolateOverlay=(dialog,oldOverflow)=>{
  const doc=dialog.ownerDocument,background=[...doc.body.children].filter(el=>el!==dialog).map(el=>({el,inert:el.inert,attribute:el.getAttribute('inert')}));
  for(const {el} of background){el.inert=true;el.setAttribute('inert','');}
  const keepFocus=()=>{if(dialog.isConnected)(focusableElements(dialog)[0]||dialog.querySelector('h1')).focus();};
  const guardClick=event=>{if(!dialog.contains(event.target)){event.preventDefault();event.stopImmediatePropagation();keepFocus();}};
  const guardFocus=event=>{if(!dialog.contains(event.target)){event.stopImmediatePropagation();keepFocus();}};
  doc.addEventListener('click',guardClick,true);doc.addEventListener('focusin',guardFocus,true);
  return ()=>{
    doc.removeEventListener('click',guardClick,true);doc.removeEventListener('focusin',guardFocus,true);
    for(const {el,inert,attribute} of background){if(typeof inert==='boolean')el.inert=inert;else delete el.inert;if(attribute===null)el.removeAttribute('inert');else el.setAttribute('inert',attribute);}
    doc.body.style.overflow=oldOverflow;
  };
};
const node=(tag,text,className)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(className)el.className=className;return el;};
const section=(title,text)=>{const el=node('section',undefined,'audit-section');el.append(node('h2',title),node('p',text,'audit-help'));return el;};
const numberField=(container,label,previous,{negative=false}={})=>{
  const row=node('label',undefined,'audit-field'),text=node('span',label),input=node('input');
  if(previous!==null)text.append(node('small','Registrado: '+fmtMoney(previous),'audit-help'));
  input.type='number';input.step='0.01';input.inputMode='decimal';input.required=true;if(!negative)input.min='0';input.placeholder='Saldo real';input.className='input-control';input.setAttribute('aria-label',label);
  row.append(text,input);container.append(row);return input;
};
const selectField=(container,label,options,value='')=>{
  const row=node('label',undefined,'audit-field'),select=node('select');select.className='input-control';select.setAttribute('aria-label',label);
  for(const [val,text] of options){const option=node('option',text);option.value=val;select.append(option);}select.value=value;row.append(node('span',label),select);container.append(row);return select;
};

export function showFinancialAudit(onComplete=()=>{},{manual=false,rebuild=false,notice=''}={}){
  ensureSavingsGoals();const state=getState(),freshness=financialFreshness(state);
  if(!manual&&!freshness.stale){if(rebuild&&overlay)removeOverlay({restoreFocus:true,notify:true});return false;}
  if(isFinancialAuditOpen()&&!rebuild)return true;
  const sameDocument=overlay?.ownerDocument===document;
  const oldOverflow=sameDocument?overlay.dataset.previousOverflow:document.body.style.overflow;
  const previousFocus=sameDocument?overlayReturnFocus:document.activeElement;
  removeOverlay();
  const fingerprint=auditFingerprint(state);
  const accounts=(state.accounts||[]).filter(a=>a.ownership!=='third_party'),goals=(state.savingsGoals||[]).filter(g=>g.active!==false),debts=(state.deudas||[]).filter(d=>Number(d.saldo)>0),sources=state.workSources||[];
  const accountInputs=new Map(),goalInputs=new Map(),debtInputs=new Map(),workInputs=new Map(),added=[];
  overlay=node('div',undefined,'audit-overlay');overlay.id='financialAuditOverlay';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-labelledby','financialAuditTitle');
  overlay.dataset.previousOverflow=oldOverflow;
  const dialog=overlay,form=node('form',undefined,'audit-form');form.noValidate=true;
  const title=node('h1',manual?'Confirmemos tus saldos':'Bienvenido de vuelta');title.id='financialAuditTitle';title.tabIndex=-1;
  form.append(title,node('p',freshness.stale?'Tus registros necesitan revisión. Confirma cuánto tienes hoy antes de retomar las proyecciones.':'Puedes poner tus saldos al día aunque hayas registrado algo recientemente.','audit-intro'));
  if(notice)form.append(node('p',notice,'audit-notice'));
  form.append(node('p','No necesitas reconstruir cada compra. Las diferencias se guardarán como ajustes de saldo, sin inventar sueldos ni dar por pagadas obligaciones.','audit-notice'));

  const accountSection=section('1. ¿Cuánto tienes hoy?','Incluye todo tu dinero: efectivo, bancos y cuentas donde guardas ahorros. Los apartados se identifican después; no los sumes dos veces.');
  for(const a of accounts)accountInputs.set(a.id,numberField(accountSection,a.name,accountLedgerBalance(state,a.id),{negative:true}));
  const additions=node('div'),addButton=node('button','+ Agregar otra cuenta','btn btn-outline');addButton.type='button';accountSection.append(additions,addButton);form.append(accountSection);

  const goalSection=section('2. ¿Cuánto sigue apartado?','Este dinero ya está dentro de los saldos de arriba. Confirmar o liberar un apartado no crea dinero nuevo.');
  if(!goals.length)goalSection.append(node('p','No tienes metas de ahorro activas.','audit-help'));
  const accountOptions=()=>[['','Sin asociar a una cuenta'],...accounts.map(a=>[a.id,a.name]),...added.map(a=>[a.id,a.name.value.trim()||'Cuenta nueva'])];
  const updateGoalAccounts=()=>{for(const data of goalInputs.values()){const previous=data.account.value;data.account.replaceChildren();for(const [value,text] of accountOptions()){const option=node('option',text);option.value=value;data.account.append(option);}data.account.value=[...data.account.options].some(o=>o.value===previous)?previous:'';}};
  for(const g of goals){
    const amount=numberField(goalSection,g.name,goalReserved(g,new Date()));
    const account=selectField(goalSection,'¿Dónde está el apartado de '+g.name+'?',accountOptions(),g.accountId||'');
    goalInputs.set(g.id,{amount,account});
  }
  form.append(goalSection);

  const debtSection=section('3. Deudas y trabajo','Confirma lo que debes hoy y las fuentes donde sigues trabajando. Los pagos de Hogar y trabajo conservan sus vencimientos hasta que los revises.');
  if(!debts.length)debtSection.append(node('p','No hay deudas registradas con saldo pendiente.','audit-help'));
  for(const d of debts)debtInputs.set(d.id,numberField(debtSection,d.desc,Number(d.saldo)));
  for(const s of sources){const status=selectField(debtSection,'Estado actual de '+s.name,[['','Selecciona…'],['active','Sigo trabajando aquí'],['paused','Está pausado'],['ended','Ya no trabajo aquí']]);status.required=true;workInputs.set(s.id,status);}
  form.append(debtSection);

  const summary=node('div',undefined,'audit-summary'),error=node('p',undefined,'audit-error');error.setAttribute('role','alert');
  const updateSummary=()=>{
    const all=[...accountInputs.values(),...added.map(a=>a.balance)],reserved=[...goalInputs.values()].map(g=>g.amount);
    if([...all,...reserved].some(el=>el.value===''||!Number.isFinite(Number(el.value)))){summary.textContent='Completa los saldos y apartados para revisar el total.';return;}
    const total=all.reduce((sum,el)=>sum+Number(el.value),0),locked=reserved.reduce((sum,el)=>sum+Number(el.value),0);
    summary.replaceChildren(node('strong','Resumen de tu captura'),node('p','Dinero total: '+fmtMoney(total)),node('p','Ya apartado: '+fmtMoney(locked)),node('p','Fuera de apartados: '+fmtMoney(total-locked)),node('small','Antes de descontar pagos pendientes. Los apartados están incluidos en el total.'));
  };
  addButton.onclick=()=>{
    const row=node('div',undefined,'audit-new-account'),nameLabel=node('label','Nombre de la cuenta'),name=node('input');name.className='input-control';name.placeholder='Ej. Cuenta bancaria';name.required=true;name.setAttribute('aria-label','Nombre de la cuenta nueva');nameLabel.append(name);row.append(nameLabel);
    const type=selectField(row,'Tipo de cuenta',[['bank','Cuenta bancaria'],['cash','Efectivo'],['wallet','Cuenta digital']],'bank');
    const balance=numberField(row,'Saldo de la cuenta nueva',null,{negative:true}),remove=node('button','Quitar esta cuenta','btn btn-outline');remove.type='button';
    const item={id:uuid(),name,type,balance,row};added.push(item);row.append(remove);additions.append(row);
    remove.onclick=()=>{added.splice(added.indexOf(item),1);row.remove();updateGoalAccounts();updateSummary();};name.addEventListener('input',updateGoalAccounts);updateGoalAccounts();updateSummary();name.focus();
  };
  form.addEventListener('input',updateSummary);form.addEventListener('change',updateSummary);updateSummary();
  const submit=node('button','Guardar conciliación','btn btn-primary');submit.type='submit';const actions=node('div',undefined,'audit-actions');actions.append(submit);
  const close=()=>{if(overlay===dialog)removeOverlay({restoreFocus:true,notify:true});};
  if(manual&&!freshness.stale){const cancel=node('button','Volver sin guardar','btn btn-outline');cancel.type='button';cancel.onclick=close;actions.append(cancel);}
  form.append(summary,error,actions);
  let done=false;
  form.onsubmit=event=>{
    event.preventDefault();if(done||submit.disabled)return;error.textContent='';
    const invalid=[...form.querySelectorAll('input,select')].find(el=>!el.checkValidity());if(invalid){error.textContent='Revisa este campo y confirma el dato actual.';invalid.focus();invalid.reportValidity();return;}
    submit.disabled=true;
    try{
      const values=map=>Object.fromEntries([...map].map(([id,input])=>[id,input.value]));
      completeFinancialAudit({accounts:values(accountInputs),debts:values(debtInputs),sources:values(workInputs),goals:Object.fromEntries([...goalInputs].map(([id,input])=>[id,{amount:input.amount.value,accountId:input.account.value||null}])),newAccounts:added.map(a=>({id:a.id,name:a.name.value,type:a.type.value,balance:a.balance.value})),expectedFingerprint:fingerprint});
      done=true;close();document.dispatchEvent(new CustomEvent('budget:data-changed'));onComplete();
    }catch(e){
      error.textContent=e.name==='QuotaExceededError'||/quota|STORAGE/i.test(e.message)?'No se pudo guardar. Revisa el espacio disponible e inténtalo de nuevo. Tus registros anteriores se conservan.':e.message||'No se pudo guardar. Tus registros anteriores se conservan.';submit.disabled=false;
      if(/datos cambiaron/i.test(e.message)&&!form.querySelector('[data-reload-audit]')){const retry=node('button','Actualizar esta revisión','btn btn-outline');retry.type='button';retry.dataset.reloadAudit='';retry.onclick=()=>showFinancialAudit(onComplete,{manual,rebuild:true,notice:'Revisión actualizada. Confirma los saldos con la nueva información.'});actions.append(retry);}
    }
  };
  dialog.onkeydown=event=>{
    if(event.key==='Escape'&&manual&&!freshness.stale){event.preventDefault();close();}
    if(event.key==='Tab'){const inputs=focusableElements(dialog),first=inputs[0],last=inputs.at(-1),current=document.activeElement;if(!inputs.length){event.preventDefault();title.focus();}else if(event.shiftKey&&(current===first||!inputs.includes(current))){event.preventDefault();last.focus();}else if(!event.shiftKey&&(current===last||!inputs.includes(current))){event.preventDefault();first.focus();}}
  };
  const sync=node('section',undefined,'card audit-sync hidden');sync.id='auditSyncCard';const syncPanel=node('div');syncPanel.id='auditSyncPanel';sync.append(syncPanel);
  dialog.append(form,sync);document.body.append(dialog);overlayReturnFocus=previousFocus;releaseOverlay=isolateOverlay(dialog,oldOverflow);document.body.style.overflow='hidden';title.focus();document.dispatchEvent(new CustomEvent('budget:audit-opened'));return true;
}
