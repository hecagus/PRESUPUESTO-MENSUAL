/* v2.6.2 - Acceso primero, onboarding adaptativo y situación editable. */
import { SOURCE_KINDS, COMPENSATIONS, TRANSPORT_MODES, fmtMoney } from './01_consts_utils.js';
import * as Data from './02_data.js';
import { initSync, notifyLocalChange } from './07_sync.js';
import { ensureFinancialLife, updateSourceLife, configureLivingSetup } from './13_financial_life.js';

Data.loadData();ensureFinancialLife();
const edit=new URLSearchParams(location.search).get('edit')==='1';
let step=0,sourceDrafts=[];
const $=id=>document.getElementById(id);
const selectedUseCases=()=>[...document.querySelectorAll('input[name="useCase"]:checked')].map(x=>x.value);
const compensationOptions=kind=>{
  const preferred=kind==='employment'?['weekly','biweekly','monthly','daily']:kind==='gig'?['per_shift','variable','weekly']:kind==='freelance'?['per_project','variable','monthly']:kind==='business'?['per_sale','variable']:['variable'];
  return preferred.map(k=>`<option value="${k}">${COMPENSATIONS[k].label}</option>`).join('');
};
const kindOptions=()=>Object.entries(SOURCE_KINDS).map(([k,v])=>`<option value="${k}">${v.icon} ${v.label}</option>`).join('');
const transportOptions=()=>Object.entries(TRANSPORT_MODES).map(([k,v])=>`<option value="${k}">${v.label}</option>`).join('');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
const statusLabel=s=>s==='ended'?'Finalizada':s==='paused'?'Pausada':'Activa';

function seedFromState(){
  const state=Data.getState();
  $('setupName').value=state.profile.displayName||'';$('setupTransport').value=state.profile.transportMode||'none';
  document.querySelectorAll('input[name="useCase"]').forEach(x=>{x.checked=false;});
  for(const use of state.profile.useCases||[])document.querySelector(`input[name="useCase"][value="${use}"]`)?.click();
  sourceDrafts=(state.workSources||[]).map(s=>({
    ...s,status:s.status||((s.active===false)?(s.endedAt?'ended':'paused'):'active'),
    transport:s.transport||{mode:s.transportMode||state.profile.transportMode||'none',public:{outboundRides:0,returnRides:0,fare:0,daysPerWeek:5}}
  }));
  const plan=state.financialPlan||{},commitments=plan.commitments||[];
  const housing=commitments.find(c=>c.id==='life-housing'),services=commitments.find(c=>c.id==='life-services'),living=plan.livingBudgets||{};
  $('setupHousing').value=housing?.active===false?'':housing?.amount||'';$('setupHousingDay').value=housing?.dueDay||1;
  $('setupServices').value=services?.active===false?'':services?.amount||'';$('setupServicesDay').value=services?.dueDay||10;
  $('setupGroceries').value=living.groceries||'';$('setupHealth').value=living.health||'';$('setupLeisure').value=living.leisure||'';$('setupOtherLiving').value=living.other||'';
  if(edit){$('setupHeading').textContent='Mi situación cambió';$('setupBalance').disabled=true;$('setupBalance').placeholder='El saldo inicial ya está definido';}
}

function showSetup(){
  $('authGate')?.classList.add('hidden');$('setupFlow')?.classList.remove('hidden');
  seedFromState();showStep();
}
function finishRestore(){
  if(Data.getState().profile?.onboarded){location.replace('index.html');return;}
  showSetup();
}

function ensureDrafts(){
  const selected=selectedUseCases();
  for(const kind of selected){
    if(!sourceDrafts.some(s=>s.kind===kind))sourceDrafts.push({id:null,name:'',kind,compensation:kind==='employment'?'biweekly':kind==='gig'?'per_shift':kind==='freelance'?'per_project':'per_sale',trackTime:['employment','gig','freelance'].includes(kind),trackDistance:false,fuelPayer:'none',status:'active',active:true,transport:{mode:$('setupTransport').value||'none',public:{outboundRides:0,returnRides:0,fare:0,daysPerWeek:5}}});
  }
}

function renderSources(){
  ensureDrafts();const box=$('sourceEditors');
  if(!sourceDrafts.length){box.innerHTML='<p class="muted">Sin fuentes de trabajo. Tu app funcionará como presupuesto personal.</p>';return;}
  box.innerHTML=sourceDrafts.map((s,i)=>`<div class="source-editor ${s.status==='ended'?'status-ended':''}" data-source-index="${i}">
    <div class="source-row"><div><label>Tipo</label><select class="input-control source-kind">${kindOptions()}</select></div><div><label>Cómo cobras</label><select class="input-control source-comp">${compensationOptions(s.kind)}</select></div></div>
    <label>Nombre</label><input class="input-control source-name" value="${esc(s.name)}" placeholder="Empresa, plataforma, negocio o actividad">
    ${edit?`<label>Estado</label><select class="input-control source-status"><option value="active">Activa</option><option value="paused">Pausada</option><option value="ended">Finalizada</option></select>`:''}
    <label class="checkline"><input type="checkbox" class="source-time" ${s.trackTime?'checked':''}> Registrar jornadas / tiempo</label>
    ${s.id?'':`<button class="btn btn-outline source-remove" type="button" style="margin-top:6px">Quitar borrador</button>`}
    ${s.id&&s.status==='ended'?'<small class="muted">El historial de esta fuente se conserva. Puedes reactivarla cambiando su estado.</small>':''}
  </div>`).join('');
  [...box.querySelectorAll('.source-editor')].forEach((el,i)=>{
    const draft=sourceDrafts[i],kind=el.querySelector('.source-kind'),comp=el.querySelector('.source-comp'),status=el.querySelector('.source-status');kind.value=draft.kind;comp.value=draft.compensation;if(status)status.value=draft.status||'active';
    kind.onchange=()=>{syncDrafts();draft.kind=kind.value;draft.compensation=kind.value==='employment'?'biweekly':kind.value==='gig'?'per_shift':kind.value==='freelance'?'per_project':'per_sale';renderSources();};
    el.querySelector('.source-remove')?.addEventListener('click',()=>{syncDrafts();sourceDrafts.splice(i,1);renderSources();});
  });
}

function syncDrafts(){
  const box=$('sourceEditors');if(!box)return;
  [...box.querySelectorAll('.source-editor')].forEach(el=>{
    const i=Number(el.dataset.sourceIndex),s=sourceDrafts[i];if(!s)return;
    const kind=el.querySelector('.source-kind'),comp=el.querySelector('.source-comp'),name=el.querySelector('.source-name'),time=el.querySelector('.source-time');
    if(!kind||!comp||!name||!time)return;
    s.kind=kind.value;s.compensation=comp.value;s.name=name.value.trim();s.trackTime=time.checked;s.status=el.querySelector('.source-status')?.value||s.status||'active';s.active=s.status==='active';
  });
}

function syncTransportDrafts(){
  [...document.querySelectorAll('.transport-editor')].forEach(el=>{const i=Number(el.dataset.sourceIndex),s=sourceDrafts[i];if(!s)return;const mode=el.querySelector('.source-transport')?.value||$('setupTransport').value||'none';s.transport=s.transport||{public:{}};s.transport.mode=mode;s.transport.public=s.transport.public||{};
    if(mode==='public'){
      s.transport.public.outboundRides=Number(el.querySelector('.public-out')?.value||0);s.transport.public.returnRides=Number(el.querySelector('.public-back')?.value||0);s.transport.public.fare=Number(el.querySelector('.public-fare')?.value||0);s.transport.public.daysPerWeek=Number(el.querySelector('.public-days')?.value||5);s.trackDistance=false;s.fuelPayer='none';
    }else if(['motorcycle','car'].includes(mode)){
      s.trackDistance=Boolean(el.querySelector('.source-distance')?.checked);s.fuelPayer=el.querySelector('.source-fuel')?.value||'personal';
    }else{s.trackDistance=false;s.fuelPayer='none';}
  });
}

function transportCard(s,i){
  const mode=s.transport?.mode||$('setupTransport').value||'none',pub=s.transport?.public||{};
  let detail='';
  if(mode==='public')detail=`<div class="mini-grid"><div><label>Transportes de ida</label><input class="input-control public-out" type="number" min="0" value="${pub.outboundRides||0}"></div><div><label>Transportes de regreso</label><input class="input-control public-back" type="number" min="0" value="${pub.returnRides||0}"></div></div><div class="mini-grid"><div><label>Precio promedio por transporte</label><input class="input-control public-fare" type="number" min="0" step="0.01" value="${pub.fare||0}"></div><div><label>Días por semana</label><input class="input-control public-days" type="number" min="0" max="7" value="${pub.daysPerWeek||5}"></div></div>`;
  else if(['motorcycle','car'].includes(mode))detail=`<label class="checkline"><input type="checkbox" class="source-distance" ${s.trackDistance?'checked':''}> Registrar kilometraje</label><label>¿Quién paga el combustible?</label><select class="input-control source-fuel"><option value="personal">Yo</option><option value="company">Empresa / cliente</option><option value="none">No aplica</option></select>`;
  return `<div class="source-editor transport-editor" data-source-index="${i}"><strong>${esc(s.name||SOURCE_KINDS[s.kind]?.label)}</strong><label>Transporte para esta fuente</label><select class="input-control source-transport">${transportOptions()}</select>${detail}</div>`;
}

function renderTransportConfig(){
  syncDrafts();syncTransportDrafts();const box=$('fuelSourceConfig'),visible=sourceDrafts.filter(s=>s.status!=='ended');
  if(!visible.length){box.innerHTML='<small class="muted">No hay fuentes activas o pausadas que configurar.</small>';return;}
  box.innerHTML=sourceDrafts.map((s,i)=>s.status==='ended'?'':transportCard(s,i)).join('');
  [...box.querySelectorAll('.transport-editor')].forEach(el=>{const i=Number(el.dataset.sourceIndex),s=sourceDrafts[i],mode=el.querySelector('.source-transport'),fuel=el.querySelector('.source-fuel');mode.value=s.transport?.mode||$('setupTransport').value||'none';if(fuel)fuel.value=s.fuelPayer||'personal';mode.onchange=()=>{syncTransportDrafts();s.transport.mode=mode.value;renderTransportConfig();};});
}

function addSource(){syncDrafts();sourceDrafts.push({id:null,name:'',kind:'other',compensation:'variable',trackTime:false,trackDistance:false,fuelPayer:'none',status:'active',active:true,transport:{mode:$('setupTransport').value||'none',public:{outboundRides:0,returnRides:0,fare:0,daysPerWeek:5}}});renderSources();}

const draftPublicMonthly=s=>{const p=s.transport?.public||{};return s.transport?.mode==='public'?(Number(p.outboundRides||0)+Number(p.returnRides||0))*Number(p.fare||0)*Number(p.daysPerWeek||0)*(52/12):0;};

function review(){syncDrafts();syncTransportDrafts();const transport=TRANSPORT_MODES[$('setupTransport').value]?.label||'Ninguno';$('setupReview').innerHTML=`<strong>Tu app quedará así:</strong><ul style="margin:8px 0 0 18px">${sourceDrafts.filter(s=>s.name).map(s=>`<li>${SOURCE_KINDS[s.kind]?.icon||'💰'} ${esc(s.name)} · ${COMPENSATIONS[s.compensation]?.label||s.compensation} · ${statusLabel(s.status)}${draftPublicMonthly(s)>0?` · traslado ${fmtMoney(draftPublicMonthly(s))}/mes`:''}</li>`).join('')||'<li>Finanzas personales</li>'}<li>🚦 Transporte predeterminado: ${transport}</li><li>🛒 Presupuesto de vida y calendario financiero activados</li></ul>`;}

function showStep(){
  document.querySelectorAll('.setup-step').forEach((el,i)=>el.classList.toggle('active',i===step));document.querySelectorAll('.setup-progress span').forEach((el,i)=>el.classList.toggle('on',i<=step));$('setupBack').style.visibility=step===0?'hidden':'visible';$('setupNext').textContent=step===4?(edit?'Guardar cambios':'Crear mi app'):'Siguiente';
  if(step===1)renderSources();if(step===2)renderTransportConfig();if(step===4)review();
}

function validateStep(){
  if(step===1){syncDrafts();const incomplete=sourceDrafts.some(s=>s.status!=='ended'&&!s.name);if(incomplete){alert('Pon un nombre a cada fuente o quita el borrador que no necesites.');return false;}}
  return true;
}

function save(){
  try{
    syncDrafts();syncTransportDrafts();
    const useCases=selectedUseCases();if(!useCases.length)useCases.push('personal');
    const sources=sourceDrafts.filter(s=>s.name).map(s=>{
      const mode=s.transport?.mode||$('setupTransport').value||'none',vehicle=['motorcycle','car'].includes(mode);
      return {...s,active:s.status==='active',fuelPayer:vehicle?(s.fuelPayer||'personal'):'none',trackDistance:vehicle?Boolean(s.trackDistance):false};
    });
    Data.configurarOnboarding({displayName:$('setupName').value,useCases,transportMode:$('setupTransport').value,vehicleName:$('setupVehicleName').value,openingBalance:edit?undefined:$('setupBalance').value,sources});
    for(const draft of sources){
      const real=(draft.id&&Data.fuenteById(draft.id))||[...Data.getState().workSources].reverse().find(s=>s.name.toLowerCase()===draft.name.toLowerCase()&&s.kind===draft.kind);if(!real)continue;
      updateSourceLife(real.id,{status:draft.status||'active',transportMode:draft.transport?.mode||$('setupTransport').value,outboundRides:draft.transport?.public?.outboundRides||0,returnRides:draft.transport?.public?.returnRides||0,fare:draft.transport?.public?.fare||0,daysPerWeek:draft.transport?.public?.daysPerWeek||5});
      real.trackDistance=draft.trackDistance;real.fuelPayer=draft.fuelPayer;Data.saveData();
    }
    configureLivingSetup({housing:$('setupHousing').value,housingDay:$('setupHousingDay').value,services:$('setupServices').value,servicesDay:$('setupServicesDay').value,groceries:$('setupGroceries').value,health:$('setupHealth').value,leisure:$('setupLeisure').value,other:$('setupOtherLiving').value});
    notifyLocalChange();
    location.replace('index.html');
  }catch(e){console.error(e);alert(e.message==='NOMBRE_INVALIDO'?'Revisa los nombres de tus fuentes.':`No se pudo guardar la configuración.${e?.message?` (${e.message})`:''}`);}
}

$('btnAddSource').onclick=addSource;$('setupTransport').onchange=()=>{for(const s of sourceDrafts){if(!s.transport?.mode||s.transport.mode==='none')s.transport={...(s.transport||{}),mode:$('setupTransport').value};}renderTransportConfig();};
$('setupBack').onclick=()=>{if(step>0){step--;showStep();}};
$('setupNext').onclick=()=>{if(!validateStep())return;if(step<4){if(step===0)ensureDrafts();step++;showStep();}else save();};
$('btnStartFresh')?.addEventListener('click',showSetup);
document.addEventListener('budget:remote-applied',finishRestore);
document.addEventListener('budget:sync-complete',finishRestore);

if(edit)showSetup();else{$('authGate')?.classList.remove('hidden');$('setupFlow')?.classList.add('hidden');initSync();}
