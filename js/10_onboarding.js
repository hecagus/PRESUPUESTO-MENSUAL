/* v2.0.0 - Onboarding adaptativo. */
import { SOURCE_KINDS, COMPENSATIONS, TRANSPORT_MODES } from './01_consts_utils.js';
import * as Data from './02_data.js';

Data.loadData();
const state=Data.getState(),edit=new URLSearchParams(location.search).get('edit')==='1';
let step=0,sourceDrafts=[];
const $=id=>document.getElementById(id);
const selectedUseCases=()=>[...document.querySelectorAll('input[name="useCase"]:checked')].map(x=>x.value);
const compensationOptions=kind=>{
  const preferred=kind==='employment'?['weekly','biweekly','monthly','daily']:kind==='gig'?['per_shift','variable','weekly']:kind==='freelance'?['per_project','variable','monthly']:kind==='business'?['per_sale','variable']:['variable'];
  return preferred.map(k=>`<option value="${k}">${COMPENSATIONS[k].label}</option>`).join('');
};
const kindOptions=()=>Object.entries(SOURCE_KINDS).map(([k,v])=>`<option value="${k}">${v.icon} ${v.label}</option>`).join('');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function seedFromState(){
  $('setupName').value=state.profile.displayName||'';$('setupTransport').value=state.profile.transportMode||'none';
  for(const use of state.profile.useCases||[])document.querySelector(`input[name="useCase"][value="${use}"]`)?.click();
  sourceDrafts=(state.workSources||[]).filter(s=>s.active!==false).map(s=>({...s}));
  if(edit){$('setupHeading').textContent='Ajusta tu configuración';$('setupBalance').disabled=true;$('setupBalance').placeholder='El saldo inicial ya está definido';}
}

function ensureDrafts(){
  const selected=selectedUseCases();
  for(const kind of selected){
    if(!sourceDrafts.some(s=>s.kind===kind))sourceDrafts.push({id:null,name:'',kind,compensation:kind==='employment'?'biweekly':kind==='gig'?'per_shift':kind==='freelance'?'per_project':'per_sale',trackTime:['employment','gig','freelance'].includes(kind),trackDistance:false,fuelPayer:'none'});
  }
  if(!selected.length&&sourceDrafts.length===0)return;
}

function renderSources(){
  ensureDrafts();const box=$('sourceEditors');
  if(!sourceDrafts.length){box.innerHTML='<p class="muted">Sin fuentes de trabajo. Tu app funcionará como presupuesto personal.</p>';return;}
  box.innerHTML=sourceDrafts.map((s,i)=>`<div class="source-editor" data-source-index="${i}">
    <div class="source-row"><div><label>Tipo</label><select class="input-control source-kind">${kindOptions()}</select></div><div><label>Cómo cobras</label><select class="input-control source-comp">${compensationOptions(s.kind)}</select></div></div>
    <label>Nombre</label><input class="input-control source-name" value="${esc(s.name)}" placeholder="Empresa, plataforma, negocio o actividad">
    <label class="checkline"><input type="checkbox" class="source-time" ${s.trackTime?'checked':''}> Registrar jornadas / tiempo</label>
    <button class="btn btn-outline source-remove" type="button" style="margin-top:6px">Quitar</button>
  </div>`).join('');
  [...box.querySelectorAll('.source-editor')].forEach((el,i)=>{
    const draft=sourceDrafts[i],kind=el.querySelector('.source-kind'),comp=el.querySelector('.source-comp');kind.value=draft.kind;comp.value=draft.compensation;
    kind.onchange=()=>{syncDrafts();draft.kind=kind.value;draft.compensation=kind.value==='employment'?'biweekly':kind.value==='gig'?'per_shift':kind.value==='freelance'?'per_project':'per_sale';renderSources();};
    el.querySelector('.source-remove').onclick=()=>{syncDrafts();sourceDrafts.splice(i,1);renderSources();};
  });
}

function syncDrafts(){
  [...document.querySelectorAll('.source-editor')].forEach(el=>{const i=Number(el.dataset.sourceIndex),s=sourceDrafts[i];if(!s)return;s.kind=el.querySelector('.source-kind').value;s.compensation=el.querySelector('.source-comp').value;s.name=el.querySelector('.source-name').value.trim();s.trackTime=el.querySelector('.source-time').checked;});
}

function renderFuelConfig(){
  syncDrafts();const mode=$('setupTransport').value,vehicle=TRANSPORT_MODES[mode]?.vehicle,box=$('fuelSourceConfig');
  if(!vehicle||!sourceDrafts.length){box.innerHTML='';return;}
  box.innerHTML='<h3 style="margin-top:16px">Combustible / kilometraje por actividad</h3>'+sourceDrafts.map((s,i)=>`<div class="source-editor"><strong>${esc(s.name||SOURCE_KINDS[s.kind]?.label)}</strong><label class="checkline"><input type="checkbox" data-distance="${i}" ${s.trackDistance?'checked':''}> Registrar kilometraje</label><label>¿Quién paga el combustible?</label><select class="input-control" data-fuel="${i}"><option value="personal">Yo</option><option value="company">Empresa / cliente</option><option value="none">No aplica</option></select></div>`).join('');
  [...box.querySelectorAll('[data-fuel]')].forEach(el=>{const i=Number(el.dataset.fuel);el.value=sourceDrafts[i].fuelPayer||'personal';el.onchange=()=>sourceDrafts[i].fuelPayer=el.value;});
  [...box.querySelectorAll('[data-distance]')].forEach(el=>{const i=Number(el.dataset.distance);el.onchange=()=>sourceDrafts[i].trackDistance=el.checked;});
}

function addSource(){syncDrafts();sourceDrafts.push({id:null,name:'',kind:'other',compensation:'variable',trackTime:false,trackDistance:false,fuelPayer:'none'});renderSources();}

function review(){syncDrafts();renderFuelConfig();const transport=TRANSPORT_MODES[$('setupTransport').value]?.label||'Ninguno';$('setupReview').innerHTML=`<strong>Tu app activará:</strong><ul style="margin:8px 0 0 18px">${sourceDrafts.filter(s=>s.name).map(s=>`<li>${SOURCE_KINDS[s.kind]?.icon||'💰'} ${esc(s.name)} · ${COMPENSATIONS[s.compensation]?.label||s.compensation}</li>`).join('')||'<li>Finanzas personales</li>'}<li>🚦 Transporte: ${transport}</li></ul>`;}

function showStep(){
  document.querySelectorAll('.setup-step').forEach((el,i)=>el.classList.toggle('active',i===step));document.querySelectorAll('.setup-progress span').forEach((el,i)=>el.classList.toggle('on',i<=step));$('setupBack').style.visibility=step===0?'hidden':'visible';$('setupNext').textContent=step===3?(edit?'Guardar cambios':'Crear mi app'):'Siguiente';
  if(step===1)renderSources();if(step===2)renderFuelConfig();if(step===3)review();
}

function validateStep(){
  if(step===1){syncDrafts();const incomplete=sourceDrafts.some(s=>!s.name);if(incomplete){alert('Pon un nombre a cada fuente o quita la que no necesites.');return false;}}
  return true;
}

function save(){
  syncDrafts();renderFuelConfig();
  const useCases=selectedUseCases();if(!useCases.length)useCases.push('personal');
  const sources=sourceDrafts.filter(s=>s.name).map(s=>({...s,fuelPayer:TRANSPORT_MODES[$('setupTransport').value]?.vehicle?(s.fuelPayer||'personal'):'none',trackDistance:TRANSPORT_MODES[$('setupTransport').value]?.vehicle?Boolean(s.trackDistance):false}));
  try{
    Data.configurarOnboarding({displayName:$('setupName').value,useCases,transportMode:$('setupTransport').value,vehicleName:$('setupVehicleName').value,openingBalance:edit?undefined:$('setupBalance').value,sources});
    location.replace('index.html');
  }catch(e){console.error(e);alert(e.message==='NOMBRE_INVALIDO'?'Revisa los nombres de tus fuentes.':'No se pudo guardar la configuración.');}
}

$('btnAddSource').onclick=addSource;$('setupTransport').onchange=renderFuelConfig;
$('setupBack').onclick=()=>{if(step>0){step--;showStep();}};
$('setupNext').onclick=()=>{if(!validateStep())return;if(step<3){if(step===0)ensureDrafts();step++;showStep();}else save();};
seedFromState();showStep();
