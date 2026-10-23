import { $, fmtMoney, uuid } from '../01_consts_utils.js';
import { Modal } from '../03_render.js';
import { getPersonalAccounts, accountBalance } from '../15_accounts_engine.js';
import { HOME_CATEGORIES, recordDirectHouseholdExpense } from '../23_home_semantics.js';
import { localDay } from '../domain/financial-rules.js';

const errors={MONTO_INVALIDO:'Ingresa un monto mayor a cero.',NOMBRE_INVALIDO:'Escribe en qué gastaste.',CUENTA_NO_ENCONTRADA:'Selecciona una cuenta personal activa.',PAGO_FECHA_FUTURA:'El gasto debe tener una fecha de hoy o anterior.',FECHA_HOGAR_INVALIDA:'Revisa la fecha del gasto.'};
export function showQuickExpense(onChange){
  const accounts=getPersonalAccounts({activeOnly:true}),today=localDay(new Date()),operationId=uuid();
  const fields=[
    {label:'¿Cuánto gastaste? ($)',key:'amount',type:'number',min:'0.01',step:'0.01',required:true,placeholder:'0.00'},
    {label:'¿En qué gastaste?',key:'name',required:true,placeholder:'Comida, pasaje, una compra…'},
    {label:'Categoría',key:'category',type:'select',value:'Alimentación',options:HOME_CATEGORIES.map(val=>({val,txt:val}))}
  ];
  if(accounts.length>1)fields.push({label:'¿Con qué pagaste?',key:'accountId',type:'select',options:accounts.map(a=>({val:a.id,txt:`${a.name} · ${fmtMoney(accountBalance(a.id))}`}))});
  fields.push({label:'Fecha del gasto',key:'date',type:'date',value:today,max:today,required:true});
  Modal.show('Registrar gasto',fields,data=>{
    try{
      const payload={...data,accountId:data.accountId||accounts[0]?.id,operationId};
      try{recordDirectHouseholdExpense(payload);}catch(error){
        if(error.message!=='GASTO_HOGAR_DUPLICADO_RECIENTE')throw error;
        if(!confirm('Ya registraste un gasto igual hace unos minutos. ¿Esta es otra compra?'))return false;
        recordDirectHouseholdExpense({...payload,allowDuplicate:true});
      }
      onChange?.();document.dispatchEvent(new CustomEvent('budget:data-changed'));
      let status=$('expenseStatus');if(!status){status=document.createElement('div');status.id='expenseStatus';status.className='expense-status';status.setAttribute('role','status');document.body.append(status);}
      status.textContent='Gasto registrado';status.hidden=false;setTimeout(()=>{status.hidden=true;},3500);return true;
    }catch(error){console.error(error);return Modal.error(errors[error.message]||'No se pudo guardar. Revisa el espacio disponible e inténtalo de nuevo.');}
  });
  const date=$('modalBody').querySelector('[data-k="date"]'),details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Fecha: hoy · cambiar';details.append(summary,date.parentElement);$('modalBody').append(details);$('modalConfirm').textContent='Registrar gasto';
}

export function initQuickExpense(onChange){
  if(!['index','home','wallet','admin','historial','calendar'].includes(document.body.dataset.page))return;
  let button=$('btnQuickExpense');if(!button){button=document.createElement('button');button.id='btnQuickExpense';button.type='button';button.className='btn btn-primary quick-expense';button.textContent='+ Gasto';document.body.append(button);document.body.classList.add('has-quick-expense');}
  button.onclick=()=>showQuickExpense(onChange);
  if($('btnGastoHogar'))$('btnGastoHogar').onclick=()=>showQuickExpense(onChange);
}
