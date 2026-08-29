/* V11 - Sincronización Firebase opcional, offline-first y con conflictos explícitos. */
import { FIREBASE_SYNC } from './firebase-config.js';
import * as Data from './02_data.js';

const META_KEY='presupuesto_sync_meta_v1';
const DEVICE_KEY='presupuesto_device_id_v1';
let auth=null,db=null,firebase=null,currentUser=null,conflictRemote=null,syncing=false,syncTimer=null,observerTimer=null,observedHash=null;
const getDeviceId=()=>{let id=localStorage.getItem(DEVICE_KEY);if(!id){id=`dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;localStorage.setItem(DEVICE_KEY,id);}return id;};
const loadMeta=()=>{try{return {...{baseRevision:0,dirty:false,lastSync:null},...JSON.parse(localStorage.getItem(META_KEY)||'{}')}}catch{return {baseRevision:0,dirty:false,lastSync:null}}};
const saveMeta=m=>localStorage.setItem(META_KEY,JSON.stringify(m));
let meta=typeof localStorage!=='undefined'?loadMeta():{baseRevision:0,dirty:false,lastSync:null};

const text=v=>String(v??'');
const escapeHtml=v=>text(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const clone=v=>JSON.parse(JSON.stringify(v));
const stateHash=()=>JSON.stringify(Data.getState());
const hasMeaningfulLocalData=()=>{const s=Data.getState();return ['turnos','movimientos','cargasCombustible','deudas','gastosFijosMensuales','ingresosFijos'].some(k=>Array.isArray(s?.[k])&&s[k].length>0)||Boolean(s?.parametros?.saldoInicialConfigurado)||Boolean(s?.parametros?.kmInicialConfigurado);};
const collectionMerge=(local=[],remote=[])=>{const map=new Map();for(const item of remote||[])if(item?.id)map.set(item.id,clone(item));for(const item of local||[])if(item?.id)map.set(item.id,clone(item));return [...map.values()];};
function mergeStates(local,remote){
  const merged={...clone(remote||{}),...clone(local||{})};
  for(const key of ['turnos','movimientos','cargasCombustible','deudas','gastosFijosMensuales','ingresosFijos']) merged[key]=collectionMerge(local?.[key],remote?.[key]);
  merged.wallet=clone(local?.wallet||remote?.wallet||{});
  merged.parametros=clone(local?.parametros||remote?.parametros||{});
  merged.categoriasPersonalizadas={...(remote?.categoriasPersonalizadas||{}),...(local?.categoriasPersonalizadas||{})};
  return merged;
}

function setStatus(message,tone='neutral'){
  const el=document.getElementById('syncStatus');if(!el)return;el.textContent=message;el.dataset.tone=tone;
}

export function renderSyncUI(){
  const zone=document.getElementById('syncPanel');if(!zone)return;
  if(!FIREBASE_SYNC.enabled){
    zone.innerHTML='<div class="sync-state"><strong>☁️ Nube no configurada</strong><p>La app funciona completa en modo local. Completa <code>js/firebase-config.js</code> para activar sincronización.</p></div>';
    return;
  }
  if(!currentUser){
    zone.innerHTML='<div class="sync-state"><strong>☁️ Sincronización disponible</strong><p>Inicia sesión con Google para respaldar y sincronizar tus datos entre dispositivos.</p><button id="btnSyncLogin" class="btn btn-primary">Continuar con Google</button></div>';
    document.getElementById('btnSyncLogin')?.addEventListener('click',signIn);
    return;
  }
  const dirty=meta.dirty?'Cambios locales pendientes':'Todo sincronizado';
  const last=meta.lastSync?new Date(meta.lastSync).toLocaleString('es-MX'):'Aún no';
  const conflict=conflictRemote?`<div class="sync-conflict" style="margin-top:12px;padding:12px;border-radius:12px;background:#fff7ed;border:1px solid #fed7aa"><strong>⚠️ Conflicto detectado</strong><p style="margin:6px 0 10px">Hay cambios distintos en este dispositivo y en la nube. Nada se sobrescribirá hasta que elijas.</p><button id="btnUseCloud" class="btn btn-outline">Usar nube</button><button id="btnUseLocal" class="btn btn-outline" style="margin-top:7px">Conservar local</button><button id="btnMergeSync" class="btn btn-primary" style="margin-top:7px">Fusionar sin duplicar</button><small style="display:block;margin-top:8px">En coincidencias con el mismo ID, la versión local conserva prioridad.</small></div>`:'';
  zone.innerHTML=`<div class="sync-state"><strong>☁️ ${escapeHtml(currentUser.email||'Sesión Firebase')}</strong><p id="syncStatus" style="margin:6px 0 12px;color:var(--text-sec)">${dirty} · Última sync: ${escapeHtml(last)}</p><div class="grid-2"><button id="btnSyncNow" class="btn btn-primary">Sincronizar</button><button id="btnSyncLogout" class="btn btn-outline">Cerrar sesión</button></div>${conflict}</div>`;
  document.getElementById('btnSyncNow')?.addEventListener('click',()=>syncNow().catch(showSyncError));
  document.getElementById('btnSyncLogout')?.addEventListener('click',signOutUser);
  document.getElementById('btnUseCloud')?.addEventListener('click',resolveUseCloud);
  document.getElementById('btnUseLocal')?.addEventListener('click',resolveUseLocal);
  document.getElementById('btnMergeSync')?.addEventListener('click',resolveMerge);
}

function showSyncError(error){console.error('Firebase sync:',error);setStatus('No se pudo sincronizar. Tus datos locales siguen intactos.','error');}

export function notifyLocalChange(){
  if(!FIREBASE_SYNC.enabled)return;
  observedHash=stateHash();
  meta={...meta,dirty:true};saveMeta(meta);renderSyncUI();
  if(currentUser&&navigator.onLine){clearTimeout(syncTimer);syncTimer=setTimeout(()=>syncNow().catch(showSyncError),1400);}
}

async function loadFirebase(){
  if(firebase)return firebase;
  const v=FIREBASE_SYNC.sdkVersion||'12.18.0';
  const [appMod,authMod,firestoreMod]=await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${v}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${v}/firebase-auth.js`),
    import(`https://www.gstatic.com/firebasejs/${v}/firebase-firestore.js`)
  ]);
  const app=appMod.initializeApp(FIREBASE_SYNC.config);
  auth=authMod.getAuth(app);db=firestoreMod.getFirestore(app);
  firebase={...authMod,...firestoreMod};
  await authMod.setPersistence(auth,authMod.browserLocalPersistence);
  return firebase;
}

async function signIn(){try{const f=await loadFirebase();await f.signInWithPopup(auth,new f.GoogleAuthProvider());}catch(e){showSyncError(e);}}
async function signOutUser(){if(!auth)return;await firebase.signOut(auth);currentUser=null;conflictRemote=null;renderSyncUI();}
const docRef=()=>firebase.doc(db,'users',currentUser.uid,'budget','state');

async function applyRemote(remote){
  Data.restaurar(JSON.stringify(remote.state));
  observedHash=stateHash();
  meta={...meta,baseRevision:Number(remote.revision)||0,dirty:false,lastSync:new Date().toISOString()};saveMeta(meta);conflictRemote=null;renderSyncUI();document.dispatchEvent(new CustomEvent('budget:remote-applied'));
}

export async function syncNow({forceLocal=false}={}){
  if(!FIREBASE_SYNC.enabled||!currentUser||syncing||!navigator.onLine)return;
  const currentHash=stateHash();
  if(observedHash!==null&&currentHash!==observedHash){observedHash=currentHash;meta={...meta,dirty:true};saveMeta(meta);}
  syncing=true;setStatus('Sincronizando…');
  try{
    const f=await loadFirebase(),ref=docRef();
    const result=await f.runTransaction(db,async tx=>{
      const snap=await tx.get(ref),remote=snap.exists()?snap.data():null,remoteRevision=Number(remote?.revision)||0;
      if(remote&&remoteRevision>meta.baseRevision&&!forceLocal){
        if(meta.dirty)return {kind:'conflict',remote};
        return {kind:'pull',remote};
      }
      const revision=Math.max(remoteRevision,Number(meta.baseRevision)||0)+1;
      tx.set(ref,{state:clone(Data.getState()),revision,updatedAt:new Date().toISOString(),deviceId:getDeviceId()});
      return {kind:'push',revision};
    });
    if(result.kind==='conflict'){conflictRemote=result.remote;renderSyncUI();setStatus('Conflicto: elige qué versión conservar.','warning');return;}
    if(result.kind==='pull'){await applyRemote(result.remote);return;}
    observedHash=stateHash();
    meta={...meta,baseRevision:result.revision,dirty:false,lastSync:new Date().toISOString()};saveMeta(meta);conflictRemote=null;renderSyncUI();setStatus('Sincronizado.','ok');
  }finally{syncing=false;}
}

async function resolveUseCloud(){if(!conflictRemote)return;await applyRemote(conflictRemote);}
async function resolveUseLocal(){if(!conflictRemote)return;meta={...meta,baseRevision:Number(conflictRemote.revision)||meta.baseRevision,dirty:true};saveMeta(meta);conflictRemote=null;renderSyncUI();await syncNow({forceLocal:true});}
async function resolveMerge(){if(!conflictRemote)return;const merged=mergeStates(Data.getState(),conflictRemote.state);Data.restaurar(JSON.stringify(merged));observedHash=stateHash();meta={...meta,baseRevision:Number(conflictRemote.revision)||meta.baseRevision,dirty:true};saveMeta(meta);conflictRemote=null;renderSyncUI();await syncNow({forceLocal:true});document.dispatchEvent(new CustomEvent('budget:remote-applied'));}

export async function initSync(){
  renderSyncUI();
  if(!FIREBASE_SYNC.enabled)return;
  observedHash=stateHash();
  if(meta.baseRevision===0&&!meta.lastSync&&hasMeaningfulLocalData()){meta={...meta,dirty:true};saveMeta(meta);}
  clearInterval(observerTimer);
  observerTimer=setInterval(()=>{const hash=stateHash();if(hash!==observedHash){observedHash=hash;notifyLocalChange();}},900);
  try{
    const f=await loadFirebase();
    f.onAuthStateChanged(auth,user=>{currentUser=user;renderSyncUI();if(user&&navigator.onLine)syncNow().catch(showSyncError);});
    document.addEventListener('budget:data-changed',notifyLocalChange);
    window.addEventListener('online',()=>{renderSyncUI();if(currentUser)syncNow().catch(showSyncError);});
    window.addEventListener('offline',()=>setStatus('Sin conexión · trabajando localmente','warning'));
  }catch(e){showSyncError(e);}
}
