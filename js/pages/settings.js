/* Targeted editors: no opening balance, no onboarding restart and no replacement of history. */
import { $, SOURCE_KINDS, COMPENSATIONS, TRANSPORT_MODES } from '../01_consts_utils.js';
import * as Data from '../02_data.js';
import { Modal } from '../03_render.js';
import { updateSourceLife } from '../21_financial_life_v27.js';
const options=map=>Object.entries(map).map(([val,item])=>({val,txt:item.label}));
export function renderSettings(){
  const state=Data.getState();
  // A remote refresh must not erase profile text the user is currently editing.
  for(const [id,value] of [['profileName',state.profile.displayName||''],['profileTransport',state.profile.transportMode||'none']]){
    const input=$(id);if(input&&document.activeElement!==input&&input.dataset.edited!=='true')input.value=value;
  }
  const list=$('settingsSources');if(!list)return;list.replaceChildren();
  for(const source of state.workSources||[]){
    const card=document.createElement('section');card.className='card';
    const title=document.createElement('strong');title.textContent=source.name;
    const detail=document.createElement('p');detail.className='muted';
    detail.textContent=`${SOURCE_KINDS[source.kind]?.label||'Ingreso'} · ${COMPENSATIONS[source.compensation]?.label||'Variable'} · ${source.status==='ended'?'Finalizada':source.active===false?'Pausada':'Activa'} · ${TRANSPORT_MODES[source.transport?.mode||source.transportMode]?.label||'Sin transporte'}`;
    const edit=document.createElement('button');edit.className='btn btn-outline';edit.textContent='Editar fuente';edit.dataset.settingsSource=source.id;
    card.append(title,detail,edit);list.append(card);
  }
  if(!list.children.length){const empty=document.createElement('p');empty.className='muted';empty.textContent='Agrega una fuente para registrar trabajo e ingresos.';list.append(empty);}
}
export function saveSourceSettings(id,values){
  const name=String(values.name||'').trim();if(!name)throw new Error('NOMBRE_INVALIDO');
  if(!SOURCE_KINDS[values.kind]||!COMPENSATIONS[values.compensation]||!TRANSPORT_MODES[values.transportMode]||!['active','paused','ended'].includes(values.status)||!['personal','company','none'].includes(values.fuelPayer))throw new Error('CONFIGURACION_INVALIDA');
  const publicValues={};
  for(const key of ['outboundRides','returnRides','fare','daysPerWeek']){
    const n=Number(values[key]);if(!Number.isFinite(n)||n<0||(key==='daysPerWeek'&&n>7))throw new Error('CONFIGURACION_INVALIDA');publicValues[key]=n;
  }
  const source=id?Data.fuenteById(id):null;
  if(id&&!source)throw new Error('FUENTE_NO_ENCONTRADA');
  const vehicle=['motorcycle','car'].includes(values.transportMode);
  const patch={name,kind:values.kind,compensation:values.compensation,status:values.status,trackTime:values.trackTime==='yes',trackDistance:vehicle&&values.trackDistance==='yes',fuelPayer:vehicle?values.fuelPayer:'none',transportMode:values.transportMode,transport:{...(source?.transport||{}),mode:values.transportMode,public:{...(source?.transport?.public||{}),...publicValues}}};
  if(id)Data.actualizarFuenteTrabajo(id,patch);
  else{
    const ids=new Set(Data.getState().workSources.map(s=>s.id));Data.crearFuenteTrabajo(patch);
    id=Data.getState().workSources.find(s=>!ids.has(s.id)).id;
  }
  updateSourceLife(id,{status:values.status,transportMode:values.transportMode,...publicValues});
  Data.deriveCapabilities();Data.saveData();
}
function editSource(id,run){
  const source=id?Data.fuenteById(id):null,transport=source?.transport||{},pub=transport.public||{};
  const choice=(label,key,list,value)=>({label,key,type:'select',options:list,value});
  Modal.show(source?'Editar fuente':'Nueva fuente',[
    {label:'Nombre',key:'name',value:source?.name||''},
    choice('Tipo de trabajo','kind',options(SOURCE_KINDS),source?.kind||'employment'),
    choice('Cómo cobras','compensation',options(COMPENSATIONS),source?.compensation||'biweekly'),
    choice('Estado','status',[{val:'active',txt:'Activa'},{val:'paused',txt:'Pausada'},{val:'ended',txt:'Finalizada'}],source?.status||(source?.active===false?'paused':'active')),
    choice('Transporte de esta fuente','transportMode',options(TRANSPORT_MODES),transport.mode||source?.transportMode||Data.getState().profile.transportMode||'none'),
    choice('Registrar jornadas y horas','trackTime',[{val:'yes',txt:'Sí'},{val:'no',txt:'No'}],source?.trackTime===false?'no':'yes'),
    choice('Registrar kilómetros (moto o auto)','trackDistance',[{val:'yes',txt:'Sí'},{val:'no',txt:'No'}],source?.trackDistance?'yes':'no'),
    choice('Quién paga gasolina (moto o auto)','fuelPayer',[{val:'personal',txt:'Yo'},{val:'company',txt:'Empresa / tercero'},{val:'none',txt:'No aplica'}],source?.fuelPayer||'personal'),
    {label:'Transporte público: viajes de ida',key:'outboundRides',type:'number',value:pub.outboundRides||0},
    {label:'Transporte público: viajes de regreso',key:'returnRides',type:'number',value:pub.returnRides||0},
    {label:'Tarifa por viaje ($)',key:'fare',type:'number',value:pub.fare||0},
    {label:'Días de trabajo por semana (0–7)',key:'daysPerWeek',type:'number',value:pub.daysPerWeek??5}
  ],values=>run(()=>saveSourceSettings(id,values)));
}
export function initSettingsEvents(run){
  for(const id of ['profileName','profileTransport'])$(id)?.addEventListener('input',()=>{$(id).dataset.edited='true';});
  $('profileForm')?.addEventListener('submit',event=>{
    event.preventDefault();
    run(()=>{
      const state=Data.getState();
      Data.configurarOnboarding({displayName:$('profileName').value,transportMode:$('profileTransport').value,useCases:state.profile.useCases});
      for(const id of ['profileName','profileTransport'])delete $(id).dataset.edited;
      $('profileSaveStatus').textContent='Perfil guardado.';
    });
  });
  $('btnSettingsSource')?.addEventListener('click',()=>editSource(null,run));
  $('settingsSources')?.addEventListener('click',event=>{const button=event.target.closest('[data-settings-source]');if(button)editSource(button.dataset.settingsSource,run);});
}
