/* Fase D: IndexedDB shadow pilot. No modifica el almacenamiento canónico. */
const DB_NAME='hecagus-indexeddb-pilot-v1';
const DB_VERSION=1;
const STORES=Object.freeze({snapshots:'snapshots',records:'records',audit:'audit'});
export const SHADOW_COLLECTIONS=Object.freeze([
  'movimientos','turnos','deudas','accounts','savingsGoals','fondosCombustibleEmpresa',
  'cargasCombustible','gastosFijosMensuales','ingresosFijos','workSources','automationRules'
]);
const REQUIRED=['movimientos','turnos','deudas','accounts','wallet','parametros','profile','workSources','financialPlan'];
const isRecord=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const safeOwner=id=>{const s=String(id??'').trim();if(!s||s.length>150)throw Error('PILOT_OWNER_REQUIRED');return s;};
const utf8=v=>new TextEncoder().encode(v);
export async function sha256(text){
  if(!globalThis.crypto?.subtle)throw Error('PILOT_CRYPTO_UNAVAILABLE');
  const bytes=await crypto.subtle.digest('SHA-256',utf8(text));
  return [...new Uint8Array(bytes)].map(n=>n.toString(16).padStart(2,'0')).join('');
}
export async function planShadowMigration(raw,owner='local'){
  safeOwner(owner);
  if(typeof raw!=='string'||raw.length>8_000_000)throw Error('PILOT_SNAPSHOT_SIZE');
  let state;
  try{state=JSON.parse(raw);}catch{throw Error('PILOT_JSON_INVALID');}
  if(!isRecord(state)||!REQUIRED.some(k=>Object.hasOwn(state,k)))throw Error('PILOT_UNKNOWN_BACKUP');
  const records=[],issues=[],counts={};
  for(const collection of SHADOW_COLLECTIONS){
    const list=state[collection];if(list===undefined)continue;
    if(!Array.isArray(list)){issues.push(collection+':not-array');continue;}
    counts[collection]=list.length;
    const used=new Set();let valid=true;
    for(const row of list){
      if(!isRecord(row)||typeof row.id!=='string'||!row.id.trim()||used.has(row.id)){
        issues.push(collection+':unstable-or-duplicate-id');valid=false;break;
      }
      used.add(row.id);
    }
    if(!valid)continue; // no inventar ID durante la migración
    for(const row of list){
      records.push({owner,key:JSON.stringify([owner,collection,row.id]),collection,recordId:row.id,value:row});
    }
  }
  if(records.length>25000)throw Error('PILOT_TOO_MANY_RECORDS');
  const digest=await sha256(raw);
  const recordsDigest=await sha256(JSON.stringify([...records].sort((a,b)=>a.key.localeCompare(b.key))));
  return {raw,owner,digest,recordsDigest,bytes:utf8(raw).byteLength,records,counts,issues,
    canSyncByRecord:issues.length===0,mode:'shadow',schemaVersion:state.schemaVersion??null};
}
function openPilot(factory=globalThis.indexedDB){
  if(!factory?.open)throw Error('PILOT_INDEXEDDB_UNAVAILABLE');
  return new Promise((resolve,reject)=>{
    const request=factory.open(DB_NAME,DB_VERSION);
    request.onupgradeneeded=()=>{
      const db=request.result;
      if(!db.objectStoreNames.contains(STORES.snapshots))db.createObjectStore(STORES.snapshots,{keyPath:'owner'});
      if(!db.objectStoreNames.contains(STORES.audit))db.createObjectStore(STORES.audit,{keyPath:'owner'});
      if(!db.objectStoreNames.contains(STORES.records)){
        const records=db.createObjectStore(STORES.records,{keyPath:'key'});
        records.createIndex('by_owner','owner',{unique:false});
      }
    };
    request.onerror=()=>reject(request.error||Error('PILOT_DB_OPEN'));
    request.onblocked=()=>reject(Error('PILOT_DB_BLOCKED'));
    request.onsuccess=()=>resolve(request.result);
  });
}
function transaction(db,names,mode,enqueue){
  return new Promise((resolve,reject)=>{
    let tx,value,reason;
    try{
      tx=db.transaction(names,mode);
      tx.oncomplete=()=>resolve(value);
      tx.onabort=()=>reject(reason||tx.error||Error('PILOT_TRANSACTION_ABORTED'));
      tx.onerror=()=>{reason=tx.error||Error('PILOT_TRANSACTION_ERROR');};
      const setValue=x=>{value=x;};
      const fail=x=>{reason=x instanceof Error?x:Error(String(x));tx.abort();};
      enqueue(tx,setValue,fail);
    }catch(error){reject(error);}
  });
}
export async function writeShadowSnapshot(raw,{owner='local',factory=globalThis.indexedDB}={}){
  const plan=await planShadowMigration(raw,owner),db=await openPilot(factory);
  try{
    return await transaction(db,[STORES.snapshots,STORES.records,STORES.audit],'readwrite',(tx,setValue,fail)=>{
      const current=tx.objectStore(STORES.audit).get(owner);
      current.onsuccess=()=>{
        if(current.result){fail(Error('PILOT_ALREADY_EXISTS'));return;}
        const stamp=new Date().toISOString();
        tx.objectStore(STORES.snapshots).put({owner,raw:plan.raw,digest:plan.digest});
        const records=tx.objectStore(STORES.records);
        for(const row of plan.records)records.put(row);
        const report={owner,createdAt:stamp,mode:'shadow',digest:plan.digest,bytes:plan.bytes,
          recordCount:plan.records.length,recordsDigest:plan.recordsDigest,counts:plan.counts,issues:plan.issues,
          schemaVersion:plan.schemaVersion,canSyncByRecord:plan.canSyncByRecord};
        tx.objectStore(STORES.audit).put(report);
        setValue(report);
      };
      current.onerror=()=>fail(current.error||Error('PILOT_META_READ'));
    });
  }finally{db.close();}
}
export async function readShadowSnapshot({owner='local',factory=globalThis.indexedDB}={}){
  safeOwner(owner);const db=await openPilot(factory);
  let data;
  try{
    data=await transaction(db,[STORES.snapshots,STORES.audit,STORES.records],'readonly',(tx,setValue,fail)=>{
      let snapshot,audit,records;
      const s=tx.objectStore(STORES.snapshots).get(owner),a=tx.objectStore(STORES.audit).get(owner),
        r=tx.objectStore(STORES.records).index('by_owner').getAll(owner);
      s.onsuccess=()=>snapshot=s.result;
      a.onsuccess=()=>audit=a.result;
      r.onsuccess=()=>records=r.result;
      for(const req of [s,a,r])req.onerror=()=>fail(req.error||Error('PILOT_READ'));
      // Deferred value via same transaction; each request fires before transaction completion.
      const guard=tx.objectStore(STORES.audit).get(owner);
      guard.onsuccess=()=>setValue({snapshot,audit,records});
      guard.onerror=()=>fail(guard.error||Error('PILOT_READ'));
    });
  }finally{db.close();}
  if(!data?.snapshot||!data.audit)throw Error('PILOT_NOT_FOUND');
  const actual=await sha256(data.snapshot.raw);
  if(actual!==data.snapshot.digest||actual!==data.audit.digest)throw Error('PILOT_CORRUPTED');
  if(data.records.length!==data.audit.recordCount)throw Error('PILOT_INCOMPLETE_RECORDS');
  const recordsHash=await sha256(JSON.stringify([...data.records].sort((a,b)=>a.key.localeCompare(b.key))));
  if(recordsHash!==data.audit.recordsDigest)throw Error('PILOT_RECORD_CORRUPTED');
  return {backup:data.snapshot.raw,report:data.audit,records:data.records};
}
export async function rollbackShadowSnapshot({owner='local',factory=globalThis.indexedDB}={}){
  // Antes de borrar la sombra, verificar y devolver los bytes originales.
  const verified=await readShadowSnapshot({owner,factory});
  const db=await openPilot(factory);
  try{
    await transaction(db,[STORES.snapshots,STORES.records,STORES.audit],'readwrite',(tx,setValue,fail)=>{
      const check=tx.objectStore(STORES.audit).get(owner);
      check.onsuccess=()=>{
        if(!check.result||check.result.digest!==verified.report.digest){fail(Error('PILOT_CHANGED'));return;}
        tx.objectStore(STORES.snapshots).delete(owner);
        tx.objectStore(STORES.audit).delete(owner);
        const cursor=tx.objectStore(STORES.records).index('by_owner').openCursor(owner);
        cursor.onsuccess=()=>{
          if(!cursor.result)return;
          cursor.result.delete();
          cursor.result.continue();
        };
        cursor.onerror=()=>fail(cursor.error||Error('PILOT_RECORD_CLEANUP'));
        setValue(true);
      };
      check.onerror=()=>fail(check.error||Error('PILOT_META_READ'));
    });
  }finally{db.close();}
  return {restorableBackup:verified.backup,verifiedHash:verified.report.digest,canonicalStorageUntouched:true};
}
