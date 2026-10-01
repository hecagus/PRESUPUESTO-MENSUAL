/* v3.1.0 - Firebase offline-first: conflictos explícitos, sync por cambios y fallback ligero. */
import { FIREBASE_SYNC } from './firebase-config.js';
import * as Data from './02_data.js';
import { mergeStates, syncOutcome, assertSyncSize } from './26_sync_merge.js';

let META_KEY='presupuesto_sync_meta_v1';
const DEVICE_KEY='presupuesto_device_id_v1';
const FALLBACK_OBSERVER_MS=12000;
let mergeChoices={},conflictLocalHash=null,resetting=false,initialSyncPromise=null,initialSyncError=null,activeSyncPromise=null;
let auth=null,db=null,firebase=null,currentUser=null,conflictRemote=null,syncing=false,syncTimer=null,observerTimer=null,observedHash=null,authReady=false,lifecycleBound=false;
const getDeviceId=()=>{let id=localStorage.getItem(DEVICE_KEY);if(!id){id=`dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;localStorage.setItem(DEVICE_KEY,id);}return id;};
const loadMeta=()=>{try{return {...{baseRevision:0,dirty:false,lastSync:null},...JSON.parse(localStorage.getItem(META_KEY)||'{}')}}catch{return {baseRevision:0,dirty:false,lastSync:null}}};
const saveMeta=m=>localStorage.setItem(META_KEY,JSON.stringify(m));
let meta=typeof localStorage!=='undefined'?loadMeta():{baseRevision:0,dirty:false,lastSync:null};

const clone=v=>JSON.parse(JSON.stringify(v));
const stateHash=()=>JSON.stringify(Data.getState());
const emitSyncComplete=kind=>document.dispatchEvent(new CustomEvent('budget:sync-complete',{detail:{kind,userId:currentUser?.uid||null}}));
const hasMeaningfulLocalData=()=>{
  const s=Data.getState(),plan=s?.financialPlan||{},business=s?.business||{};
  const activity=['turnos','movimientos','cargasCombustible','fondosCombustibleEmpresa','deudas','gastosFijosMensuales','ingresosFijos','workSources','savingsGoals','automationRules','ruleApplications'].some(k=>Array.isArray(s?.[k])&&s[k].length>0);
  const customAccounts=(s?.accounts||[]).some(a=>a?.id!=='acct-personal');
  const planned=(plan.commitments||[]).length>0||(plan.householdExpenses||[]).length>0||Object.values(plan.livingBudgets||{}).some(v=>Number(v)>0)||Number(plan.minCashBuffer||0)>0;
  const businessData=['ingredients','products','sales'].some(k=>Array.isArray(business?.[k])&&business[k].length>0);
  return activity||customAccounts||planned||businessData||Boolean(s?.profile?.onboarded)||Boolean(s?.parametros?.saldoInicialConfigurado)||Boolean(s?.parametros?.kmInicialConfigurado);
};

function setStatus(message,tone='neutral'){const el=document.getElementById('syncStatus');if(!el)return;el.textContent=message;el.dataset.tone=tone;}
export function renderSyncUI(){renderResetUI();const card=document.getElementById('syncCard'),zone=document.getElementById('syncPanel');if(!zone)return;if(!FIREBASE_SYNC.enabled||!authReady){card?.classList.add('hidden');return;}if(currentUser&&!conflictRemote){card?.classList.add('hidden');zone.innerHTML='';return;}card?.classList.remove('hidden');if(currentUser&&conflictRemote){zone.innerHTML='<div class="sync-conflict"><strong>⚠️ Conflicto de sincronización</strong><p style="margin:6px 0 10px">Hay cambios distintos en este dispositivo y en la nube. Puedes elegir una versión completa o combinar cambios. Los campos incompatibles requieren una elección explícita; las eliminaciones se respetan cuando existe una base común.</p><button id="btnUseCloud" class="btn btn-outline">Usar nube</button><button id="btnUseLocal" class="btn btn-outline" style="margin-top:7px">Conservar local</button><button id="btnMergeSync" class="btn btn-primary" style="margin-top:7px">Fusionar</button></div>';document.getElementById('btnUseCloud')?.addEventListener('click',()=>resolveUseCloud().catch(showSyncError));document.getElementById('btnUseLocal')?.addEventListener('click',()=>resolveUseLocal().catch(showSyncError));document.getElementById('btnMergeSync')?.addEventListener('click',()=>resolveMerge().catch(showSyncError));renderMergeChoices(zone);return;}zone.innerHTML='<div class="sync-state"><strong>☁️ Sincronización disponible</strong><p>Inicia sesión con Google para respaldar y sincronizar tus datos entre dispositivos.</p><p id="syncStatus" style="margin:6px 0 12px;color:var(--text-sec)" aria-live="polite">Listo para iniciar sesión.</p><button id="btnSyncLogin" class="btn btn-primary">Continuar con Google</button></div>';document.getElementById('btnSyncLogin')?.addEventListener('click',signIn);}
function showSyncError(error){console.error('Firebase sync:',error);const card=document.getElementById('syncCard'),zone=document.getElementById('syncPanel'),code=String(error?.code||'');let message='⚠️ No se pudo sincronizar.';if(code.includes('unauthorized-domain'))message='⚠️ El dominio de esta app no está autorizado en Firebase Authentication.';else if(code.includes('popup-blocked'))message='⚠️ El navegador bloqueó la ventana de Google. Permite ventanas emergentes e intenta otra vez.';else if(code.includes('popup-closed'))message='Inicio de sesión cancelado.';else if(code.includes('operation-not-allowed'))message='⚠️ El proveedor Google no está habilitado en Firebase.';else if(code.includes('network-request-failed'))message='⚠️ No se pudo contactar Firebase. Revisa tu conexión e intenta otra vez.';else if(code.startsWith('sync/'))message=error.message;else if(code)message=`⚠️ Error de sincronización (${code}).`;card?.classList.remove('hidden');if(zone&&!document.getElementById('syncStatus'))zone.innerHTML='<div class="sync-state"><strong>☁️ Sincronización</strong><p id="syncStatus" style="margin:6px 0 0;color:var(--text-sec)" aria-live="polite"></p></div>';setStatus(message,'error');}
export function notifyLocalChange(){if(!FIREBASE_SYNC.enabled)return;observedHash=stateHash();meta={...meta,dirty:true};saveMeta(meta);if(currentUser&&navigator.onLine){clearTimeout(syncTimer);syncTimer=setTimeout(()=>syncNow().catch(showSyncError),1400);}}

async function loadFirebase(){if(firebase)return firebase;const v=FIREBASE_SYNC.sdkVersion||'12.18.0';const [appMod,authMod,firestoreMod]=await Promise.all([import(`https://www.gstatic.com/firebasejs/${v}/firebase-app.js`),import(`https://www.gstatic.com/firebasejs/${v}/firebase-auth.js`),import(`https://www.gstatic.com/firebasejs/${v}/firebase-firestore.js`)]);const app=appMod.initializeApp(FIREBASE_SYNC.config);auth=authMod.getAuth(app);db=firestoreMod.getFirestore(app);firebase={...authMod,...firestoreMod};await authMod.setPersistence(auth,authMod.browserLocalPersistence);return firebase;}
async function signIn(){const button=document.getElementById('btnSyncLogin');try{if(button){button.disabled=true;button.textContent='Abriendo Google…';}setStatus('Abriendo acceso con Google…');const f=await loadFirebase(),provider=new f.GoogleAuthProvider(),result=await f.signInWithPopup(auth,provider);activateUser(result.user);if(navigator.onLine)await syncNow();}catch(e){showSyncError(e);if(button){button.disabled=false;button.textContent='Continuar con Google';}}}
const docRef=()=>firebase.doc(db,'users',currentUser.uid,'budget','state');
async function applyRemote(remote){Data.restaurar(JSON.stringify(remote.state));observedHash=stateHash();meta={...meta,baseRevision:Number(remote.revision)||0,baseState:clone(remote.state),dirty:false,lastSync:new Date().toISOString()};saveMeta(meta);conflictRemote=null;renderSyncUI();document.dispatchEvent(new CustomEvent('budget:remote-applied'));}
export async function syncNow(options={}){
  while(activeSyncPromise)await activeSyncPromise;
  const pending=performSync(options);activeSyncPromise=pending;
  try{return await pending;}finally{if(activeSyncPromise===pending)activeSyncPromise=null;}
}
async function performSync({forceLocal=false}={}){if(!FIREBASE_SYNC.enabled||!currentUser||syncing||!navigator.onLine)return;const currentHash=stateHash();if(observedHash!==null&&currentHash!==observedHash){observedHash=currentHash;meta={...meta,dirty:true};saveMeta(meta);}const userId=currentUser.uid;syncing=true;let completed=false;try{const f=await loadFirebase(),ref=docRef(),sentState=clone(Data.getState()),sentHash=stateHash(),baseRevision=meta.baseRevision,wasDirty=meta.dirty;if(currentUser?.uid!==userId)return;const result=await f.runTransaction(db,async tx=>{if(currentUser?.uid!==userId)throw Object.assign(new Error('La cuenta cambió durante la sincronización.'),{code:'sync/user-changed'});const snap=await tx.get(ref),remote=snap.exists()?snap.data():null,remoteRevision=Number(remote?.revision)||0;if(remote?.oneTimeResetUsedAt&&sentState.resetGeneration!==remote.oneTimeResetUsedAt)return{kind:'reset-pull',remote};if(remote&&remoteRevision!==Number(baseRevision||0)){if(wasDirty||forceLocal||stateHash()!==sentHash)return{kind:'conflict',remote};return{kind:'pull',remote};}if(remote&&!forceLocal&&!wasDirty&&remoteRevision===Number(baseRevision||0))return{kind:'noop',revision:remoteRevision};const revision=Math.max(remoteRevision,Number(meta.baseRevision)||0)+1;assertSyncSize(sentState);tx.set(ref,{state:sentState,oneTimeResetUsedAt:remote?.oneTimeResetUsedAt||null,revision,updatedAt:new Date().toISOString(),deviceId:getDeviceId()});return{kind:'push',revision};});if(currentUser?.uid!==userId)return;if(result.kind==='conflict'){conflictRemote=result.remote;mergeChoices={};conflictLocalHash=stateHash();renderSyncUI();return;}if(result.kind==='reset-pull'){await applyRemote(result.remote);emitSyncComplete('reset-pull');if(!Data.getState().profile?.onboarded)location.replace('onboarding.html');return;}if(result.kind==='pull'){if(stateHash()!==sentHash){conflictRemote=result.remote;mergeChoices={};conflictLocalHash=stateHash();renderSyncUI();return;}await applyRemote(result.remote);emitSyncComplete('pull');return;}observedHash=stateHash();meta={...meta,...syncOutcome(sentState,Data.getState(),result.revision??meta.baseRevision),lastSync:new Date().toISOString()};saveMeta(meta);conflictRemote=null;renderSyncUI();emitSyncComplete(result.kind);completed=true;}finally{syncing=false;if((completed||currentUser?.uid!==userId)&&meta.dirty&&!conflictRemote){clearTimeout(syncTimer);syncTimer=setTimeout(()=>syncNow().catch(showSyncError),1400);}}}
function renderMergeChoices(zone){
  const result=mergeStates(Data.getState(),conflictRemote.state,meta.baseState,mergeChoices);
  if(!result.conflicts.length)return;
  const list=document.createElement('div');list.setAttribute('aria-live','polite');
  const label=value=>value===undefined?'Eliminar':JSON.stringify(value);
  for(const conflict of result.conflicts){
    const row=document.createElement('label');row.style.display='block';
    const title=document.createElement('p');title.textContent=conflict.path;row.append(title);
    const select=document.createElement('select');
    for(const [value,text] of [['','Elige una versión'],['local',`Dispositivo: ${label(conflict.local)}`],['remote',`Nube: ${label(conflict.remote)}`]]){
      const option=document.createElement('option');option.value=value;option.textContent=text;select.append(option);
    }
    select.addEventListener('change',()=>{mergeChoices[conflict.path]=select.value;});row.append(select);list.append(row);
  }
  zone.append(list);
}
async function resolveUseCloud(){if(!conflictRemote)return;await applyRemote(conflictRemote);emitSyncComplete('pull');await syncNow();}
async function resolveUseLocal(){if(!conflictRemote)return;meta={...meta,baseRevision:Number(conflictRemote.revision)||0,baseState:clone(conflictRemote.state),dirty:true};saveMeta(meta);conflictRemote=null;await syncNow({forceLocal:true});}
async function resolveMerge(){
  if(!conflictRemote)return;
  if(conflictLocalHash!==stateHash()){mergeChoices={};conflictLocalHash=stateHash();renderSyncUI();return;}
  const result=mergeStates(Data.getState(),conflictRemote.state,meta.baseState,mergeChoices);
  if(result.conflicts.length){renderSyncUI();return;}
  Data.restaurar(JSON.stringify(result.state));observedHash=stateHash();
  meta={...meta,baseRevision:Number(conflictRemote.revision)||0,baseState:clone(conflictRemote.state),dirty:true};saveMeta(meta);conflictRemote=null;
  await syncNow({forceLocal:true});document.dispatchEvent(new CustomEvent('budget:remote-applied'));
}

function observeState(){if(document.hidden)return;const hash=stateHash();if(hash!==observedHash)notifyLocalChange();}
function bindLifecycle(){if(lifecycleBound)return;lifecycleBound=true;document.addEventListener('budget:data-changed',notifyLocalChange);window.addEventListener('online',()=>{if(currentUser)syncNow().catch(showSyncError);});document.addEventListener('visibilitychange',()=>{if(document.hidden)return;observeState();if(currentUser&&navigator.onLine&&meta.dirty)syncNow().catch(showSyncError);});}

function activateUser(user){
  if(currentUser?.uid===user?.uid&&authReady)return;
  const owner=localStorage.getItem('presupuesto_state_owner_v1');
  if(user&&owner&&owner!==user.uid){
    localStorage.setItem(`presupuesto_local_backup_${owner}`,JSON.stringify(Data.getState()));
    const next=localStorage.getItem(`presupuesto_local_backup_${user.uid}`);
    Data.restaurar(next||JSON.stringify({profile:{onboarded:false},workSources:[],movimientos:[],turnos:[],wallet:{saldo:0,sobres:[]},parametros:{}}));
    observedHash=stateHash();
  }
  if(user)localStorage.setItem('presupuesto_state_owner_v1',user.uid);
  currentUser=user;conflictRemote=null;mergeChoices={};clearTimeout(syncTimer);
  if(user){META_KEY=`presupuesto_sync_meta_v2_${user.uid}`;meta=loadMeta();if((!meta.lastSync&&hasMeaningfulLocalData())||(meta.baseState&&syncOutcome(meta.baseState,Data.getState(),meta.baseRevision).dirty))meta={...meta,dirty:true};saveMeta(meta);}
  authReady=true;renderSyncUI();
}

export function initSync(){
  if(initialSyncPromise)return initialSyncPromise;
  initialSyncPromise=initializeSync();
  return initialSyncPromise;
}
async function initializeSync(){
  renderSyncUI();if(!FIREBASE_SYNC.enabled)return;
  observedHash=stateHash();
  if(meta.baseRevision===0&&!meta.lastSync&&hasMeaningfulLocalData()){meta={...meta,dirty:true};saveMeta(meta);}
  clearInterval(observerTimer);observerTimer=setInterval(observeState,FALLBACK_OBSERVER_MS);bindLifecycle();
  try{
    const f=await loadFirebase();
    await new Promise((resolve,reject)=>{
      f.onAuthStateChanged(auth,async user=>{
        try{activateUser(user);if(user&&navigator.onLine)await syncNow();resolve();}
        catch(error){showSyncError(error);reject(error);}
      },reject);
    });
  }catch(error){authReady=true;renderSyncUI();showSyncError(error);initialSyncError=error;}
}
/* Finish account recovery before opening a new setup, then clear the actual budget. */
export async function prepareFreshBudget(){
  await initSync();
  if(initialSyncError)throw initialSyncError;
  if(currentUser){
    if(!navigator.onLine)throw new Error('Conecta internet para comprobar y reiniciar también los datos de tu cuenta.');
    await syncNow();
  }
  if(!hasMeaningfulLocalData())return true;
  if(!confirm('¿Borrar TODOS los datos del presupuesto y configurar desde cero? Se reiniciarán también los datos de la nube si has iniciado sesión. No se puede deshacer.'))return false;
  if(currentUser)await resetBudgetOnce();
  else{
    if(localStorage.getItem('presupuesto_state_owner_v1'))throw new Error('Inicia sesión con Google para reiniciar el presupuesto de esta cuenta también en la nube.');
    Data.restaurar(JSON.stringify(Data.createEmptyState()));notifyLocalChange();
  }
  return true;
}

// Retira la herramienta temporal sin cambiar el protocolo de reinicio legacy.
function renderResetUI(){document.getElementById('oneTimeResetCard')?.remove();}
export async function resetBudgetOnce(){
  if(!currentUser)throw new Error('Inicia sesión con Google antes de reiniciar.');
  if(!navigator.onLine)throw new Error('Conecta internet. No se ha borrado ningún dato.');
  if(syncing||resetting)throw new Error('Espera a que termine la sincronización e intenta otra vez.');
  const userId=currentUser.uid,usedAt=new Date().toISOString(),empty={...Data.createEmptyState(),resetGeneration:usedAt};
  resetting=true;syncing=true;clearTimeout(syncTimer);
  let cloudCommitted=false;
  try{
    const f=await loadFirebase();
    if(currentUser?.uid!==userId)throw new Error('La cuenta cambió. No se ha reiniciado el presupuesto.');
    const ref=docRef();
    const result=await f.runTransaction(db,async tx=>{
      const snap=await tx.get(ref),remote=snap.exists()?snap.data():null;
      if(currentUser?.uid!==userId)throw new Error('La cuenta cambió. No se ha reiniciado el presupuesto.');
      if(remote?.oneTimeResetUsedAt)throw new Error('El reinicio de un solo uso ya se utilizó en esta cuenta.');
      const revision=(Number(remote?.revision)||0)+1;
      tx.set(ref,{state:empty,revision,oneTimeResetUsedAt:usedAt,updatedAt:usedAt,deviceId:getDeviceId()});
      return {state:empty,revision};
    });
    cloudCommitted=true;
    if(currentUser?.uid!==userId)throw new Error('La cuenta reiniciada cambió. Vuelve a iniciar sesión en ella.');
    localStorage.removeItem(`presupuesto_local_backup_${userId}`);
    localStorage.removeItem('presupuesto_sync_meta_v1');
    localStorage.removeItem('forecast_include_variable');
    await applyRemote(result);
    emitSyncComplete('reset');
    return result;
  }catch(error){
    if(cloudCommitted)throw new Error('La nube quedó reiniciada. Recarga la app para recuperar el presupuesto vacío. '+error.message);
    throw error;
  }finally{resetting=false;syncing=false;}
}
