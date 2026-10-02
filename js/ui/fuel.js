import { ACCOUNT_TYPES } from '../01_consts_utils.js';
import * as Data from '../02_data.js';
import { Modal } from '../03_render.js';

export function showFuelModal(onSave){
  const state=Data.getState(),activeId=state.activeActivity?.sourceId;
  const sources=state.workSources.filter(s=>s.active!==false&&s.status!=='paused'&&s.status!=='ended');
  const accounts=state.accounts.filter(a=>a.active!==false);
  const fields=[
    {label:'Actividad / uso',key:'source',type:'select',value:sources.some(s=>s.id===activeId)?activeId:'personal',options:[{val:'personal',txt:'Uso personal'},...sources.map(s=>({val:s.id,txt:s.name}))]},
    {label:'¿Con qué pagaste?',key:'account',type:'select',value:'',options:[{val:'',txt:'Selecciona cómo pagaste'},...accounts.map(a=>({val:a.id,txt:`${a.name} · ${a.ownership==='third_party'?'Empresa / tarjeta de combustible':ACCOUNT_TYPES[a.type]||'Cuenta personal'}`}))]},
    {label:'Litros',key:'l',type:'number'},
    {label:'Total pagado ($)',key:'c',type:'number',placeholder:'Importe total del ticket'},
    {label:'KM actual',key:'k',type:'number'},
    {label:'Gasolinera / referencia (opcional)',key:'e'}
  ];
  Modal.show('Repostaje de combustible',fields,d=>{
    if(!d.account){alert('Selecciona con qué pagaste el combustible.');return false;}
    onSave(()=>Data.registrarCombustible({litros:d.l,costo:d.c,km:d.k,sourceId:d.source==='personal'?null:d.source,accountId:d.account,gasolinera:d.e}));
  });
}
