import {$,fmtMoney} from '../01_consts_utils.js';
import {Modal} from '../03_render.js';
import * as Data from '../02_data.js';
import {latestIncomeDueDate,localDay} from '../domain/financial-rules.js';

export function showSourcePayment(sourceId,safe){
  const source=Data.fuenteById(sourceId);if(!source)return;
  Modal.show(`Registrar cobro · ${source.name}`,[
    {label:'Importe recibido ($)',key:'amount',type:'number'},
    {label:'Vencimiento del período que cubre este cobro',key:'periodDate',type:'date',value:localDay(latestIncomeDueDate(source))}
  ],data=>safe(()=>Data.registrarPagoFuente(sourceId,data.amount,Date.now(),{periodDate:data.periodDate})));
  const note=document.createElement('p');note.textContent='El dinero se registra hoy. Elige el período que estás cobrando: por ejemplo, un pago de fin de mes recibido al día siguiente cubre el mes anterior.';$('modalBody')?.append(note);
}

export function showIncomePeriodCorrection(sourceId,safe){
  const source=Data.fuenteById(sourceId),payments=Data.getState().movimientos.filter(m=>m.sourceId===sourceId&&m.paymentKind==='source_period'&&m.tipo==='ingreso').sort((a,b)=>new Date(b.fecha)-new Date(a.fecha));
  if(!source||!payments.length)return;
  const expected=new Map(payments.map(m=>[m.id,m.periodo]));
  Modal.show(`Corregir período · ${source.name}`,[
    {label:'Cobro registrado',key:'movement',type:'select',options:payments.map(m=>({val:m.id,txt:`${new Date(m.fecha).toLocaleDateString('es-MX')} · ${fmtMoney(m.monto)} · ${m.periodo}`}))},
    {label:'Vencimiento del período que realmente cubrió',key:'periodDate',type:'date',value:localDay(latestIncomeDueDate(source))}
  ],data=>safe(()=>Data.actualizarPeriodoPagoFuente(data.movement,data.periodDate,{expectedPeriod:expected.get(data.movement)})));
  const note=document.createElement('p');note.textContent='Se conserva el importe, la fecha real y el movimiento original. Esta corrección cambia únicamente el período cubierto y queda registrada.';$('modalBody')?.append(note);
}
