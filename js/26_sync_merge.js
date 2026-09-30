/* Three-way merge. Missing baseline never implies that one device wins. */
const copy=value=>value===undefined?undefined:structuredClone(value);
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const equal=(a,b)=>{
  if(Object.is(a,b))return true;
  if(Array.isArray(a)&&Array.isArray(b))return a.length===b.length&&a.every((v,i)=>equal(v,b[i]));
  if(object(a)&&object(b)){const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(k=>Object.hasOwn(b,k)&&equal(a[k],b[k]));}
  return false;
};
const identified=value=>Array.isArray(value)&&value.every(v=>object(v)&&typeof v.id==='string'&&v.id.length>0)&&new Set(value.map(v=>v.id)).size===value.length;

export function mergeStates(local,remote,base,choices={}){
  const conflicts=[];
  function merge(l,r,b,path){
    if(equal(l,r))return copy(l);
    if(base!==undefined&&equal(l,b))return copy(r);
    if(base!==undefined&&equal(r,b))return copy(l);
    // A deletion versus an edit is one conflict, not a partial resurrected record.
    if(l!==undefined&&r!==undefined&&object(l)&&object(r)&&(!b||object(b))){
      const result={};
      for(const key of new Set([...Object.keys(l),...Object.keys(r),...Object.keys(b||{})])){
        const value=merge(l[key],r[key],b?.[key],`${path}/${encodeURIComponent(key)}`);
        if(value!==undefined)result[key]=value;
      }
      return result;
    }
    if(identified(l)&&identified(r)&&(b===undefined||identified(b))){
      const lm=new Map(l.map(v=>[v.id,v])),rm=new Map(r.map(v=>[v.id,v])),bm=new Map((b||[]).map(v=>[v.id,v])),result=[];
      for(const id of new Set([...lm.keys(),...rm.keys(),...bm.keys()])){
        // Without a base, unique records are additions; deletions cannot be inferred.
        let value;
        if(base===undefined&&!lm.has(id))value=copy(rm.get(id));
        else if(base===undefined&&!rm.has(id))value=copy(lm.get(id));
        else value=merge(lm.get(id),rm.get(id),bm.get(id),`${path}/@${encodeURIComponent(id)}`);
        if(value!==undefined)result.push(value);
      }
      return result;
    }
    if(choices[path]==='local')return copy(l);
    if(choices[path]==='remote')return copy(r);
    conflicts.push({path,local:copy(l),remote:copy(r),base:copy(b)});
    return copy(l);
  }
  // Derived balances are rebuilt by Data.restaurar, not independently reconciled.
  const clean=value=>{if(value===undefined)return value;const s=copy(value);if(s.wallet)delete s.wallet.saldo;delete s.turnoActivo;return s;};
  const state=merge(clean(local),clean(remote),clean(base),'');
  if(state)state.turnoActivo=state.activeActivity??null;
  return {state,conflicts};
}

export function syncOutcome(sentState,currentState,revision){
  return {baseRevision:revision,baseState:copy(sentState),dirty:!equal(sentState,currentState)};
}

// Conservative preflight estimate: includes keys and overhead per map/array entry.
export function snapshotSize(value){
  const bytes=text=>new TextEncoder().encode(text).length;
  function measure(v,depth=0){
    if(depth>18)throw Object.assign(new Error('El respaldo contiene demasiados niveles de datos.'),{code:'sync/state-too-deep'});
    if(typeof v==='string')return bytes(v)+32;
    if(Array.isArray(v))return 32+v.reduce((total,item)=>total+32+measure(item,depth+1),0);
    if(object(v))return 32+Object.entries(v).reduce((total,[key,item])=>total+bytes(key)+32+measure(item,depth+1),0);
    return 16;
  }
  return measure(value);
}
export function assertSyncSize(state){
  if(snapshotSize(state)>900000)throw Object.assign(new Error('El respaldo es demasiado grande para sincronizarlo con seguridad. Tus datos siguen en este dispositivo; exporta un respaldo desde Administración.'),{code:'sync/document-too-large'});
}
