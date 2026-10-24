import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';
import {fakeIndexedDB} from './helpers/fake-indexeddb-pilot.js';
import {planShadowMigration,writeShadowSnapshot,readShadowSnapshot,rollbackShadowSnapshot,
  SHADOW_COLLECTIONS} from '../js/storage/indexeddb-pilot.js';
import {compareRecordSnapshots,buildSyncEnvelopes,structurallyEqual}
  from '../js/storage/record-sync-protocol.js';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const fixture=async name=>readFile(new URL('fixtures/'+name,import.meta.url),'utf8');

test('respaldo histórico anterior al esquema 30: conservar bytes y detectar IDs no estables',async()=>{
  const backup=await fixture('legacy-schema-2-synthetic.json');
  const plan=await planShadowMigration(backup,'user-test');
  assert.equal(plan.raw,backup);
  assert.equal(plan.schemaVersion,2);
  assert.equal(plan.canSyncByRecord,false);
  assert.ok(plan.issues.some(x=>x.startsWith('movimientos:')));
  assert.ok(plan.issues.some(x=>x.startsWith('turnos:')));
  assert.equal(plan.bytes,new TextEncoder().encode(backup).byteLength);
  assert.equal(plan.digest.length,64);
});

test('schema 30 mantiene depósitos, terceros, deudas y patrimonio sin transformación',async()=>{
  const backup=await fixture('finance-schema-30-synthetic.json');
  const plan=await planShadowMigration(backup,'test-user');
  assert.equal(plan.schemaVersion,30);
  assert.equal(plan.canSyncByRecord,true);
  assert.equal(plan.records.length,12); // no adaptar ni descartar registros por categorías
  assert.ok(plan.records.some(x=>x.collection==='fondosCombustibleEmpresa'));
  assert.ok(plan.records.some(x=>x.collection==='savingsGoals'));
  assert.ok(plan.records.some(x=>x.value.tipo==='transferencia'));
});

test('piloto IndexedDB guarda instantánea y registros de manera transaccional sin tocar localStorage',async()=>{
  const backup=await fixture('finance-schema-30-synthetic.json');
  const idb=fakeIndexedDB();
  const saved=await writeShadowSnapshot(backup,{owner:'phone-A',factory:idb});
  assert.equal(saved.mode,'shadow');
  const verified=await readShadowSnapshot({owner:'phone-A',factory:idb});
  assert.equal(verified.backup,backup);
  assert.equal(verified.records.length,saved.recordCount);
  assert.equal(verified.report.digest,saved.digest);
  await assert.rejects(writeShadowSnapshot(backup,{owner:'phone-A',factory:idb}),/PILOT_ALREADY_EXISTS/);
});

test('rollback recupera los mismos bytes y elimina únicamente los datos de ese usuario',async()=>{
  const idb=fakeIndexedDB(),old=await fixture('legacy-schema-2-synthetic.json'),recent=await fixture('finance-schema-30-synthetic.json');
  await writeShadowSnapshot(old,{owner:'A',factory:idb});
  await writeShadowSnapshot(recent,{owner:'B',factory:idb});
  const rolled=await rollbackShadowSnapshot({owner:'A',factory:idb});
  assert.equal(rolled.restorableBackup,old);
  assert.equal(rolled.canonicalStorageUntouched,true);
  await assert.rejects(readShadowSnapshot({owner:'A',factory:idb}),/PILOT_NOT_FOUND/);
  assert.equal((await readShadowSnapshot({owner:'B',factory:idb})).backup,recent);
});

test('falla de IndexedDB a mitad del lote aborta todos los stores, sin estado parcial',async()=>{
  const idb=fakeIndexedDB({failOnRecord:true});
  const backup=await fixture('finance-schema-30-synthetic.json');
  await assert.rejects(writeShadowSnapshot(backup,{owner:'fail-atomic',factory:idb}));
  const db=idb._databases.values().next().value;
  assert.equal(db.tables.get('snapshots').size,0);
  assert.equal(db.tables.get('records').size,0);
  assert.equal(db.tables.get('audit').size,0);
});

test('sin IndexedDB disponible falla de forma cerrada, sin modificar el origen',async()=>{
  const s=await fixture('finance-schema-30-synthetic.json');
  await assert.rejects(writeShadowSnapshot(s,{factory:null}),/PILOT_INDEXEDDB_UNAVAILABLE/);
});

test('sincronización por registros combina altas independientes, sin usar reloj del teléfono',()=>{
  const base={profile:{onboarded:true},movimientos:[]};
  const A={...base,movimientos:[{id:'a',tipo:'ingreso',monto:100}]};
  const B={...base,movimientos:[{id:'b',tipo:'gasto',monto:40}]};
  const plan=compareRecordSnapshots(base,A,B,{owner:'account-A',expectedServerRevision:7});
  assert.equal(plan.ready,true);
  assert.deepEqual(plan.merged.movimientos.map(x=>x.id),['a','b']);
  const payload=buildSyncEnvelopes(plan,7);
  assert.equal(payload.length,2);
  assert.ok(payload.every(e=>e.expectedRevision===7&&e.namespace==='account-A'));
});

test('ediciones concurrentes del mismo pago, incluso borrar contra editar, exigen elección',()=>{
  const base={movimientos:[{id:'p',monto:600,periodo:'2026-10-Q1'}]};
  const A={movimientos:[{id:'p',monto:650,periodo:'2026-10-Q1'}]};
  const B={movimientos:[{id:'p',monto:700,periodo:'2026-10-Q1'}]};
  const conflict=compareRecordSnapshots(base,A,B);
  assert.equal(conflict.ready,false);
  assert.equal(conflict.conflicts[0].kind,'concurrent-record-edit');
  assert.equal(conflict.merged,null);
  assert.throws(()=>buildSyncEnvelopes(conflict,1),/SYNC_CONFLICTS_UNRESOLVED/);
  const deletion=compareRecordSnapshots(base,{movimientos:[]},B);
  assert.equal(deletion.ready,false);
  assert.equal(deletion.conflicts[0].local,null);
});

test('eliminar un registro crea tombstone y nunca lo resucita silenciosamente',()=>{
  const base={movimientos:[{id:'a',tipo:'gasto',monto:100}]};
  const local={movimientos:[]};
  const plan=compareRecordSnapshots(base,local,base,{expectedServerRevision:5});
  assert.equal(plan.ready,true);
  const env=buildSyncEnvelopes(plan,5);
  assert.equal(env.length,1);
  assert.equal(env[0].operation,'tombstone');
  assert.equal(env[0].deleted,true);
  assert.equal(plan.merged.movimientos.length,0);
});

test('campos no particionados y IDs inestables bloquean migración incremental',()=>{
  const base={profile:{onboarded:true},movimientos:[{id:'one',monto:10}]};
  const local={profile:{onboarded:false},movimientos:[{id:'one',monto:10}]};
  assert.equal(compareRecordSnapshots(base,local,base).ready,false);
  assert.equal(compareRecordSnapshots(base,local,base).conflicts[0].kind,'unpartitioned-snapshot-fields');
  assert.throws(()=>compareRecordSnapshots({movimientos:[{monto:100}]},base,base),/SYNC_UNSTABLE_ID/);
  assert.equal(structurallyEqual({a:1,b:{c:2}},{b:{c:2},a:1}),true);
});

test('nunca se activa el piloto desde el arranque ni se modifica Firebase existente',async()=>{
  const load=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
  const [data,sync,init]=await Promise.all(['js/02_data.js','js/07_sync.js','js/05_init.js'].map(load));
  assert.match(data,/localStorage\.setItem\(STORAGE_KEY/);
  assert.match(sync,/tx\.set\(ref,\{state:sentState/);
  assert.doesNotMatch(init,/indexeddb-pilot\.js|record-sync-protocol\.js/);
  assert.ok(SHADOW_COLLECTIONS.includes('movimientos'));
});
