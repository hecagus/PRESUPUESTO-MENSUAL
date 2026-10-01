/* Debt UI delegates all balance and repayment calculations to the existing engine. */
import { $, fmtMoney } from '../01_consts_utils.js';
import * as Data from '../02_data.js';
import { Modal } from '../03_render.js';
export function renderDebt(){
  const list=$('debtList');if(!list)return;
  list.replaceChildren();
  const debts=Data.getState().deudas||[];
  for(const debt of debts){
    const row=document.createElement('li'),title=document.createElement('strong'),detail=document.createElement('small');
    title.textContent=debt.desc;
    detail.textContent=`Saldo ${fmtMoney(debt.saldo)} · cuota ${fmtMoney(debt.montoCuota)} · ${debt.frecuencia==='Unico'?'Una sola vez':debt.frecuencia} · ${Number(debt.saldo)>0?'Pendiente':'Liquidada'}`;
    row.append(title,detail);list.append(row);
  }
  if(!debts.length){const row=document.createElement('li');row.textContent='Sin deudas registradas';list.append(row);}
  const select=$('abonoDeudaSelect');if(select){
    const previous=select.value;select.replaceChildren(new Option('Seleccionar deuda…',''));
    for(const debt of debts.filter(d=>Number(d.saldo)>0))select.add(new Option(`${debt.desc} · ${fmtMoney(debt.montoCuota)}`,debt.id));
    if([...select.options].some(o=>o.value===previous))select.value=previous;
  }
}
export function initDebtEvents(run){
  $('btnDeudaNueva')?.addEventListener('click',()=>Modal.show('Nueva deuda',[
    {label:'Nombre',key:'d'},{label:'Total',key:'t',type:'number'},{label:'Cuota',key:'c',type:'number'},
    {label:'Plan de pago',key:'f',type:'select',options:['Unico','Semanal','Quincenal','Mensual'].map(x=>({val:x,txt:x==='Unico'?'Una sola vez':x}))},
    {label:'Día de pago / vencimiento',key:'dp',type:'number',value:1}
  ],d=>run(()=>Data.nuevaDeuda(d.d,d.t,d.c,d.f,d.dp))));
  $('btnAbonoCuota')?.addEventListener('click',()=>{
    const id=$('abonoDeudaSelect')?.value;if(!id)return alert('Selecciona una deuda.');
    if(confirm('¿Confirmar abono?'))run(()=>Data.abonarDeuda(id));
  });
}
