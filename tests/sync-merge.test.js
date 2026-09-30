import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeStates,syncOutcome,assertSyncSize} from '../js/26_sync_merge.js';
const state=rows=>({movimientos:rows,financialPlan:{householdExpenses:[],householdKinds:{}},wallet:{saldo:0},activeActivity:null});

test('concurrent edits to independent fields merge using the shared base',()=>{
  const base=state([{id:'a',monto:100,desc:'Comida'}]),local=structuredClone(base),remote=structuredClone(base);
  local.movimientos[0].monto=200;remote.movimientos[0].desc='Despensa';
  const result=mergeStates(local,remote,base);
  assert.deepEqual(result.conflicts,[]);assert.deepEqual(result.state.movimientos,[{id:'a',monto:200,desc:'Despensa'}]);
});
test('conflicting financial amount requires an explicit per-field choice',()=>{
  const base=state([{id:'a',monto:100}]),local=state([{id:'a',monto:200}]),remote=state([{id:'a',monto:300}]);
  const result=mergeStates(local,remote,base);assert.equal(result.conflicts.length,1);
  const resolved=mergeStates(local,remote,base,{[result.conflicts[0].path]:'remote'});
  assert.equal(resolved.conflicts.length,0);assert.equal(resolved.state.movimientos[0].monto,300);
});
test('deletion propagates when the other device did not edit the record',()=>{
  const base=state([{id:'a',monto:100}]);assert.deepEqual(mergeStates(state([]),base,base).state.movimientos,[]);
});
test('deletion versus edit requires a choice and never creates a partial record',()=>{
  const base=state([{id:'a',monto:100}]),local=state([]),remote=state([{id:'a',monto:200}]);
  const result=mergeStates(local,remote,base);assert.equal(result.conflicts.length,1);assert.equal(result.conflicts[0].path,'/movimientos/@a');
  assert.deepEqual(mergeStates(local,remote,base,{'/movimientos/@a':'local'}).state.movimientos,[]);
  assert.deepEqual(mergeStates(local,remote,base,{'/movimientos/@a':'remote'}).state.movimientos,remote.movimientos);
});
test('first upgraded sync preserves additions and flags differing shared records without a baseline',()=>{
  const result=mergeStates(state([{id:'a',monto:10},{id:'l',monto:1}]),state([{id:'a',monto:20},{id:'r',monto:2}]));
  assert.equal(result.conflicts.length,1);assert.equal(result.state.movimientos.length,3);
});
test('Hogar, business and non-ID arrays are reconciled without silently dropping values',()=>{
  const base={...state([]),business:{sales:[]},categoriasPersonalizadas:{hogar:['Comida']}};
  const local=structuredClone(base),remote=structuredClone(base);
  local.financialPlan.householdExpenses.push({id:'rent',amount:4000});local.financialPlan.householdKinds.rent='obligation';
  remote.business.sales.push({id:'sale',total:200});remote.categoriasPersonalizadas.hogar.push('Renta');
  const result=mergeStates(local,remote,base);assert.deepEqual(result.conflicts,[]);
  assert.equal(result.state.financialPlan.householdKinds.rent,'obligation');assert.equal(result.state.business.sales.length,1);assert.deepEqual(result.state.categoriasPersonalizadas.hogar,['Comida','Renta']);
});
test('merge does not mutate inputs; ordering of object properties is irrelevant',()=>{
  const local=state([{id:'a',monto:1}]),remote=state([{monto:1,id:'a'}]);const before=JSON.stringify(local);
  assert.equal(mergeStates(local,remote).conflicts.length,0);assert.equal(JSON.stringify(local),before);
});
test('edits during an in-flight upload remain dirty with the uploaded baseline',()=>{
  const sent=state([{id:'a',monto:100}]),current=state([{id:'a',monto:200}]);
  const result=syncOutcome(sent,current,8);assert.equal(result.dirty,true);assert.equal(result.baseRevision,8);assert.deepEqual(result.baseState,sent);
  assert.equal(syncOutcome(sent,structuredClone(sent),8).dirty,false);
});

test('oversized snapshots are rejected before upload without mutating local data',()=>{
  const local=state([{id:'a',desc:'á'.repeat(460000)}]);
  assert.throws(()=>assertSyncSize(local),{code:'sync/document-too-large'});
  assert.equal(local.movimientos.length,1);assert.doesNotThrow(()=>assertSyncSize(state([{id:'a',monto:100}])));
});
