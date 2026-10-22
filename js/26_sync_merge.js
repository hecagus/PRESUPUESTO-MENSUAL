/* Three-way merge. Missing baseline never implies that one device wins. */
import {personalCash,reservedSavings} from './domain/financial-rules.js';
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
  const signedHistory=goal=>(goal?.history||[]).reduce((sum,h)=>sum+(h.type==='reserve'?Number(h.amount)||0:h.type==='release'?-(Number(h.amount)||0):0),0);
  const goalBalances=new Map();
  for(const b of base?.savingsGoals||[]){
    const l=local?.savingsGoals?.find(g=>g.id===b.id),r=remote?.savingsGoals?.find(g=>g.id===b.id);
    if(!l||!r||!identified(b.history)||!identified(l.history)||!identified(r.history))continue;
    const expected=g=>(Number(b.reserved)||0)+signedHistory(g)-signedHistory(b);
    if(Math.abs((Number(l.reserved)||0)-expected(l))<0.005&&Math.abs((Number(r.reserved)||0)-expected(r))<0.005)goalBalances.set(b.id,b);
  }
  const debtPayments=(state,id)=>(state?.movimientos||[]).filter(m=>m.tipo==='gasto'&&m.debtId===id).reduce((sum,m)=>sum+(Number(m.monto)||0),0);
  const debtBalances=new Map();
  for(const b of base?.deudas||[]){
    const l=local?.deudas?.find(d=>d.id===b.id),r=remote?.deudas?.find(d=>d.id===b.id);if(!l||!r)continue;
    const expected=(state,d)=>Math.max(0,(Number(b.saldo)||0)-debtPayments(state,b.id)+debtPayments(base,b.id));
    if(Math.abs((Number(l.saldo)||0)-expected(local,l))<0.005&&Math.abs((Number(r.saldo)||0)-expected(remote,r))<0.005)debtBalances.set(b.id,b);
  }
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
  const clean=value=>{if(value===undefined)return value;const s=copy(value);if(s.wallet)delete s.wallet.saldo;delete s.turnoActivo;for(const g of s.savingsGoals||[])if(goalBalances.has(g.id))delete g.reserved;for(const d of s.deudas||[])if(debtBalances.has(d.id))delete d.saldo;return s;};
  const state=merge(clean(local),clean(remote),clean(base),'');
  for(const goal of state?.savingsGoals||[]){
    const b=goalBalances.get(goal.id);if(b)goal.reserved=Math.max(0,(Number(b.reserved)||0)+signedHistory(goal)-signedHistory(b));
  }
  // Concurrent full payments with different UUIDs must not silently settle/charge twice.
  // Partial abonos that together fit the target remain independent, legitimate records.
  const paymentKey=m=>m.tipo==='gasto'&&m.operatingObligationId&&m.operatingPeriod?`operating:${m.operatingObligationId}:${m.operatingPeriod}`:
    m.tipo==='gasto'&&m.householdExpenseId&&m.householdPeriod?`household:${m.householdExpenseId}:${m.householdPeriod}`:
    m.tipo==='gasto'&&m.debtId&&m.debtPeriod?`debt:${m.debtId}:${m.debtPeriod}`:
    m.tipo==='ingreso'&&m.paymentKind==='source_period'&&m.sourceId&&m.periodo?`income:${m.sourceId}:${m.periodo}`:null;
  const groups=new Map(),baseIds=new Set((base?.movimientos||[]).map(m=>m.id));
  for(const m of state?.movimientos||[]){const key=paymentKey(m);if(!key)continue;const group=groups.get(key)||[];group.push(m);groups.set(key,group);}
  for(const [key,rows] of groups){
    const localIds=new Set((local?.movimientos||[]).map(m=>m.id)),remoteIds=new Set((remote?.movimientos||[]).map(m=>m.id));
    const l=rows.filter(m=>!baseIds.has(m.id)&&localIds.has(m.id)&&!remoteIds.has(m.id));
    const r=rows.filter(m=>!baseIds.has(m.id)&&remoteIds.has(m.id)&&!localIds.has(m.id));
    if(!l.length||!r.length)continue;
    const target=rows.find(m=>Number.isFinite(m.operatingExpectedAmount??m.householdExpectedAmount??m.debtExpectedAmount));
    const amount=target?.operatingExpectedAmount??target?.householdExpectedAmount??target?.debtExpectedAmount;
    const paid=rows.reduce((sum,m)=>sum+(Number(m.monto)||0),0);
    const settled=rows.filter(m=>m.operatingSettled||m.householdSettled).length;
    if(!key.startsWith('income:')&&!(Number.isFinite(amount)&&paid>amount+0.005)&&settled<2)continue;
    const path=`/financial-payments/${encodeURIComponent(key)}`,choice=choices[path];
    if(choice==='both')continue;
    if(choice==='local'||choice==='remote'){
      const removed=new Set((choice==='local'?r:l).map(m=>m.id));
      state.movimientos=state.movimientos.filter(m=>!removed.has(m.id));
    }else conflicts.push({path,kind:'financial_period',local:copy(l),remote:copy(r),base:copy(rows.filter(m=>baseIds.has(m.id)))});
  }
  for(const d of state?.deudas||[]){const b=debtBalances.get(d.id);if(b)d.saldo=Math.max(0,(Number(b.saldo)||0)-debtPayments(state,d.id)+debtPayments(base,d.id));}
  if(state){
    const now=new Date(),cash=personalCash(state,now),reserved=reservedSavings(state,now);
    if(reserved>Math.max(0,cash)+0.005)conflicts.push({path:'/financial-reservations/capacity',kind:'reservation_capacity',
      cash,reserved,excess:reserved-Math.max(0,cash),local:{cash:personalCash(local,now),reserved:reservedSavings(local,now)},remote:{cash:personalCash(remote,now),reserved:reservedSavings(remote,now)}});
  }
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
