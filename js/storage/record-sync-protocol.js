/* Fase D: protocolo experimental de sincronización por registros.
   Solo cálculo en memoria; NO escribe en Firestore ni localStorage. */
export const RECORD_COLLECTIONS=Object.freeze([
  'movimientos','accounts','deudas','turnos','savingsGoals','workSources',
  'cargasCombustible','fondosCombustibleEmpresa','gastosFijosMensuales','ingresosFijos','automationRules'
]);
const isObj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
export function structurallyEqual(a,b){
  if(Object.is(a,b))return true;
  if(Array.isArray(a)&&Array.isArray(b))return a.length===b.length&&a.every((x,i)=>structurallyEqual(x,b[i]));
  if(isObj(a)&&isObj(b)){
    const akeys=Object.keys(a),bkeys=Object.keys(b);
    return akeys.length===bkeys.length&&akeys.every(k=>Object.hasOwn(b,k)&&structurallyEqual(a[k],b[k]));
  }
  return false;
}
function recordMap(snapshot,collection){
  const list=snapshot?.[collection]||[];
  if(!Array.isArray(list))throw Error('SYNC_RECORDS_NOT_ARRAY:'+collection);
  const map=new Map();
  for(const value of list){
    if(!isObj(value)||typeof value.id!=='string'||!value.id||map.has(value.id))throw Error('SYNC_UNSTABLE_ID:'+collection);
    map.set(value.id,value);
  }
  return map;
}
const core=s=>{
  const out={...s};
  for(const field of RECORD_COLLECTIONS)delete out[field];
  return out;
};
function difference(base,side){
  const ops=[];
  for(const collection of RECORD_COLLECTIONS){
    const old=recordMap(base,collection),now=recordMap(side,collection);
    for(const id of new Set([...old.keys(),...now.keys()])){
      if(structurallyEqual(old.get(id),now.get(id)))continue;
      const deleted=!now.has(id);
      ops.push({collection,id,kind:deleted?'tombstone':'upsert',baseRecord:old.get(id)??null,
        value:deleted?null:structuredClone(now.get(id))});
    }
  }
  return ops;
}
export function compareRecordSnapshots(base,local,remote,{owner='local',expectedServerRevision=null}={}){
  if(!isObj(base)||!isObj(local)||!isObj(remote))throw Error('SYNC_SNAPSHOT_INVALID');
  if(!String(owner).trim())throw Error('SYNC_OWNER_REQUIRED');
  if(expectedServerRevision!==null&&(!Number.isSafeInteger(expectedServerRevision)||expectedServerRevision<0))throw Error('SYNC_REVISION_INVALID');
  const localOps=difference(base,local),remoteOps=difference(base,remote),conflicts=[];
  if(!structurallyEqual(core(base),core(local))||!structurallyEqual(core(base),core(remote))){
    conflicts.push({kind:'unpartitioned-snapshot-fields',path:'/',reason:'Los datos fuera de colecciones requieren protocolo propio.'});
  }
  const byKey=ops=>new Map(ops.map(x=>[JSON.stringify([x.collection,x.id]),x]));
  const lm=byKey(localOps),rm=byKey(remoteOps),proposed=[];
  const allKeys=[...new Set([...lm.keys(),...rm.keys()])].sort();
  for(const key of allKeys){
    const l=lm.get(key),r=rm.get(key),op=l||r;
    if(l&&r&&!(l.kind===r.kind&&structurallyEqual(l.value,r.value))){
      conflicts.push({kind:'concurrent-record-edit',collection:op.collection,id:op.id,
        local:l.kind==='tombstone'?null:l.value,remote:r.kind==='tombstone'?null:r.value,
        reason:'Actualización concurrente; requiere elección explícita.'});
      continue;
    }
    proposed.push({owner,collection:op.collection,id:op.id,kind:op.kind,
      baseRecord:structuredClone(op.baseRecord),value:op.value===null?null:structuredClone(op.value),
      expectedServerRevision});
  }
  if(conflicts.length)return {ready:false,conflicts,proposed,merged:null,localOps,remoteOps};
  const merged=structuredClone(base);
  for(const collection of RECORD_COLLECTIONS){
    const records=recordMap(base,collection);
    for(const op of proposed.filter(p=>p.collection===collection)){
      if(op.kind==='tombstone')records.delete(op.id);
      else records.set(op.id,structuredClone(op.value));
    }
    if(Object.hasOwn(base,collection)||records.size)merged[collection]=[...records.values()];
  }
  return {ready:true,conflicts:[],proposed,merged,localOps,remoteOps};
}
export function buildSyncEnvelopes(plan,revision){
  if(!plan?.ready||!plan?.merged)throw Error('SYNC_CONFLICTS_UNRESOLVED');
  if(!Number.isSafeInteger(revision)||revision<0)throw Error('SYNC_REVISION_INVALID');
  // El backend futuro debe asignar la revisión del commit; no usar Date.now() para decidir ganadores.
  return plan.proposed.map(x=>({
    namespace:x.owner,collection:x.collection,id:x.id,operation:x.kind,
    expectedRevision:revision,deleted:x.kind==='tombstone',payload:x.value
  }));
}
