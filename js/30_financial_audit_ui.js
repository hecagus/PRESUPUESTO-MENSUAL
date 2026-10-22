/* v3.1.8 - Auditoría de regreso; protege la aplicación contra cifras desactualizadas. */
import { getState } from './02_data.js';
import { accountLedgerBalance } from './domain/financial-rules.js';
import { financialFreshness, auditFingerprint, completeFinancialAudit } from './29_financial_freshness.js';

let overlay = null;
const money = n => new Intl.NumberFormat('es-MX', {style:'currency',currency:'MXN'}).format(Number(n)||0);
const dateText = value => value ? new Date(value).toLocaleDateString('es-MX',{day:'numeric',month:'long',year:'numeric'}) : 'sin registro disponible';
const heading = (title,description) => {
  const section=document.createElement('section');
  const h=document.createElement('h3'); h.textContent=title;h.style.margin='22px 0 4px';
  const p=document.createElement('p');p.textContent=description;p.style.cssText='margin:0 0 10px;color:#64748b;font-size:14px';
  section.append(h,p);return section;
};
function moneyInput(container,name,id,value,fields,allowNegative=false){
  const label=document.createElement('label');label.style.cssText='display:flex;gap:12px;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid #e2e8f0;font-size:14px';
  const title=document.createElement('span');title.textContent=name;title.style.flex='1';
  const input=document.createElement('input');input.type='number';input.step='0.01';if(!allowNegative)input.min='0';input.required=true;input.value=Number(value||0).toFixed(2);input.style.cssText='width:125px;max-width:50%;border:1px solid #94a3b8;border-radius:8px;padding:9px;color:#0f172a;background:white;font-size:16px';
  fields[id]=input;label.append(title,input);container.append(label);
}
export function showFinancialAudit(onComplete=()=>{}){
  const state=getState(),freshness=financialFreshness(state);
  if(!freshness.stale){if(overlay){overlay.remove();overlay=null;document.body.style.overflow='';}return false;}
  if(overlay)return true;
  const fingerprint=auditFingerprint(state);
  const accounts=(state.accounts||[]).filter(a=>a.ownership!=='third_party');
  const debts=(state.deudas||[]).filter(d=>Number(d.saldo)>0);
  const sources=state.workSources||[];
  overlay=document.createElement('div');overlay.id='financialAuditOverlay';
  overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','Auditoría financiera');
  overlay.style.cssText='position:fixed;inset:0;z-index:2147483646;background:#e8eef4;overflow:auto;color:#0f172a;font-family:system-ui,sans-serif;padding:18px 10px';
  const form=document.createElement('form');
  form.style.cssText='max-width:650px;margin:0 auto 24px;background:white;padding:22px;border-radius:18px;box-shadow:0 10px 40px #0002';
  const h=document.createElement('h1');h.textContent='Bienvenido de vuelta';h.style.cssText='font-size:25px;margin:0 0 8px';
  const message=document.createElement('p');
  message.textContent='Llevas '+freshness.daysWithoutRecords+' días sin registrar movimientos. Tu última información confirmada es del '+dateText(freshness.lastConfirmedAt)+'. Las proyecciones de ingresos, gastos y disponibilidad están suspendidas hasta completar esta auditoría.';
  message.style.cssText='font-size:15px;line-height:1.55';
  const warning=document.createElement('p');warning.textContent='Los importes programados NO se han registrado como pagos ni cobros reales. Actualiza saldos; no es necesario reconstruir cada compra.';warning.style.cssText='background:#f1f5f9;padding:12px;border-radius:9px;font-size:14px';
  form.append(h,message,warning);
  const balances={},debtFields={},workFields={};
  const aSection=heading('1. Dinero real','Confirma el saldo actual de cada cuenta personal. Una diferencia creará un ajuste de conciliación, no un sueldo ficticio.');
  for(const a of accounts)moneyInput(aSection,a.name,a.id,accountLedgerBalance(state,a.id),balances,true);
  form.append(aSection);
  const dSection=heading('2. Deudas reales','Confirma cuánto debes hoy. No se darán por pagadas cuotas anteriores de forma automática.');
  if(!debts.length){const p=document.createElement('p');p.textContent='No hay deudas registradas con saldo pendiente.';dSection.append(p);}
  for(const d of debts)moneyInput(dSection,d.desc,d.id,d.saldo,debtFields);
  form.append(dSection);
  const wSection=heading('3. Fuentes de trabajo','¿Sigues trabajando en las mismas fuentes? Ningún ingreso se confirma automáticamente.');
  if(!sources.length){const p=document.createElement('p');p.textContent='No hay fuentes de ingreso configuradas.';wSection.append(p);}
  for(const s of sources){
    const row=document.createElement('label');row.style.cssText='display:flex;justify-content:space-between;align-items:center;gap:12px;padding:9px 0;border-bottom:1px solid #e2e8f0';
    const name=document.createElement('span');name.textContent=s.name||'Trabajo';name.style.flex='1';
    const select=document.createElement('select');select.style.cssText='padding:9px;border:1px solid #94a3b8;border-radius:8px;background:white;color:#0f172a;max-width:52%';
    for(const [key,label] of [['active','Activo'],['paused','Pausado'],['ended','Finalizado']]){const opt=document.createElement('option');opt.value=key;opt.textContent=label;select.append(opt);}
    select.value=s.status||((s.active===false)?'paused':'active');workFields[s.id]=select;row.append(name,select);wSection.append(row);
  }
  form.append(wSection);
  const note=document.createElement('p');note.textContent='Los vencimientos de Hogar y costos operativos siguen siendo obligaciones por revisar: esta auditoría no afirma que hayan sido pagados. El historial previo permanece intacto.';note.style.cssText='font-size:13px;color:#64748b;margin:16px 0';
  const error=document.createElement('p');error.setAttribute('role','alert');error.style.cssText='color:#b91c1c;font-weight:bold;min-height:1em';
  const submit=document.createElement('button');submit.type='submit';submit.textContent='Confirmar saldos y reactivar';submit.style.cssText='width:100%;background:#0f766e;border:0;color:white;padding:15px;border-radius:10px;font-size:16px;font-weight:700;cursor:pointer';
  form.append(note,error,submit);
  form.addEventListener('submit',event=>{
    event.preventDefault();error.textContent='';
    submit.disabled=true;
    try {
      const toObject=inputs=>Object.fromEntries(Object.entries(inputs).map(([id,el])=>[id,el.value]));
      completeFinancialAudit({accounts:toObject(balances),debts:toObject(debtFields),sources:toObject(workFields),expectedFingerprint:fingerprint});
      overlay.remove();overlay=null;document.body.style.overflow='';
      document.dispatchEvent(new CustomEvent('budget:data-changed'));
      onComplete();
    }catch(e){error.textContent=e.message||'No se pudo guardar la auditoría.';submit.disabled=false;}
  });
  overlay.append(form);document.body.append(overlay);document.body.style.overflow='hidden';
  h.setAttribute('tabindex','-1');h.focus();
  return true;
}
