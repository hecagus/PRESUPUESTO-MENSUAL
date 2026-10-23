import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

globalThis.localStorage = { data: new Map(), getItem(key) { return this.data.get(key) ?? null; }, setItem(key, value) { this.data.set(key, String(value)); }, removeItem(key) { this.data.delete(key); } };
const Data = await import('../js/02_data.js');
let source = await readFile(new URL('../js/07_sync.js', import.meta.url), 'utf8');
source = source.replace(/from '(\.\/[^']+)'/g, (_all, path) => `from '${new URL(path, new URL('../js/07_sync.js', import.meta.url)).href}'`);
const replaceFunction = (startMarker, endMarker, replacement) => { const start = source.indexOf(startMarker), end = source.indexOf(endMarker, start); assert.ok(start >= 0 && end > start); source = source.slice(0, start) + replacement + '\n' + source.slice(end); };
replaceFunction('async function signIn()', 'const docRef=', 'async function signIn(){globalThis.__surfaceCalls.login++;}');
replaceFunction('async function resolveUseCloud()', 'async function resolveUseLocal()', 'async function resolveUseCloud(){globalThis.__surfaceCalls.cloud++;}');
replaceFunction('async function resolveUseLocal()', 'async function resolveMerge()', 'async function resolveUseLocal(){globalThis.__surfaceCalls.local++;}');
replaceFunction('async function resolveMerge()', 'function observeState()', 'async function resolveMerge(){globalThis.__surfaceCalls.merge++;}');
source += '\nexport {setStatus,showSyncError,activateUser}; export function testSurface(conflict){authReady=true;currentUser=conflict?{uid:"surface"}:null;conflictRemote=conflict?{state:clone(Data.getState())}:null;meta={baseState:clone(Data.getState())};renderSyncUI();}';
const Sync = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
test.beforeEach(() => {
  localStorage.data.clear();
  Data.restaurar(JSON.stringify(Data.createEmptyState()));
  const dom = new JSDOM('<body><section id="syncCard"><div id="syncPanel"><p id="syncStatus">Estado anterior</p><button id="btnSyncLogin">Google anterior</button><button id="btnUseCloud">Nube anterior</button><button id="btnUseLocal">Local anterior</button><button id="btnMergeSync">Fusionar anterior</button></div></section><section id="auditSyncCard"><div id="auditSyncPanel"></div></section></body>', { url: 'https://audit.test/' });
  globalThis.window = dom.window; globalThis.document = dom.window.document; globalThis.CustomEvent = dom.window.CustomEvent; globalThis.__surfaceCalls = { login: 0, cloud: 0, local: 0, merge: 0 };
});

test('el acceso con Google se enlaza al botón visible de auditoría aunque exista otro ID en el fondo', () => {
  Sync.testSurface(false);
  document.querySelector('#auditSyncPanel #btnSyncLogin').click(); assert.equal(globalThis.__surfaceCalls.login, 1);
  document.querySelector('#syncPanel #btnSyncLogin').click(); assert.equal(globalThis.__surfaceCalls.login, 1);
  Sync.setStatus('Estado visible');
  assert.equal(document.querySelector('#auditSyncPanel #syncStatus').textContent, 'Estado visible'); assert.equal(document.querySelector('#syncPanel #syncStatus').textContent, 'Estado anterior');
});

test('las tres decisiones de conflicto se enlazan a la superficie activa', () => {
  Sync.testSurface(true);
  for (const id of ['btnUseCloud', 'btnUseLocal', 'btnMergeSync']) document.querySelector('#auditSyncPanel #' + id).click();
  assert.deepEqual(globalThis.__surfaceCalls, { login: 0, cloud: 1, local: 1, merge: 1 });
  for (const id of ['btnUseCloud', 'btnUseLocal', 'btnMergeSync']) document.querySelector('#syncPanel #' + id).click();
  assert.deepEqual(globalThis.__surfaceCalls, { login: 0, cloud: 1, local: 1, merge: 1 });
});

test('los errores crean su estado en la auditoría aunque el fondo conserve un syncStatus', () => {
  Sync.testSurface(true); const original = console.error; console.error = () => {};
  try { Sync.showSyncError({ code: 'sync/test', message: 'Mensaje visible de prueba' }); } finally { console.error = original; }
  assert.equal(document.querySelector('#auditSyncPanel #syncStatus').textContent, 'Mensaje visible de prueba'); assert.equal(document.querySelector('#syncPanel #syncStatus').textContent, 'Estado anterior');
});

test('cambiar de propietario avisa después de restaurar su presupuesto y conserva el anterior por separado', () => {
  Sync.testSurface(false);
  Data.restaurar(JSON.stringify({ ...Data.createEmptyState(), profile: { onboarded: true, displayName: 'Presupuesto anterior' }, movimientos: [{ id: 'old', fecha: '2026-10-01T12:00:00Z', tipo: 'ingreso', monto: 100, accountId: 'acct-personal', categoria: 'Sistema' }] }));
  const previous = structuredClone(Data.getState());
  localStorage.setItem('presupuesto_state_owner_v1', 'previous-user');
  localStorage.setItem('presupuesto_local_backup_next-user', JSON.stringify({ ...Data.createEmptyState(), profile: { onboarded: false, displayName: 'Presupuesto nuevo' } }));
  const events = [];
  document.addEventListener('budget:account-state-changed', event => events.push({
    detail: event.detail, owner: localStorage.getItem('presupuesto_state_owner_v1'),
    onboarded: Data.getState().profile.onboarded, name: Data.getState().profile.displayName,
    meta: localStorage.getItem('presupuesto_sync_meta_v2_next-user'),
    rendered: document.getElementById('auditSyncCard').classList.contains('hidden'),
  }));
  Sync.activateUser({ uid: 'next-user' });
  assert.equal(events.length, 1);
  assert.deepEqual(events[0].detail, { userId: 'next-user', onboarded: false });
  assert.equal(events[0].owner, 'next-user'); assert.equal(events[0].onboarded, false); assert.equal(events[0].name, 'Presupuesto nuevo');
  assert.ok(events[0].meta); assert.equal(events[0].rendered, true);
  assert.deepEqual(JSON.parse(localStorage.getItem('presupuesto_local_backup_previous-user')), previous);
  assert.deepEqual(Data.getState().movimientos, []);
  Sync.activateUser({ uid: 'next-user' }); assert.equal(events.length, 1);
});

test('una cuenta nueva sin respaldo emite el cambio con onboarding pendiente', () => {
  Sync.testSurface(false); localStorage.setItem('presupuesto_state_owner_v1', 'previous-user');
  const events = []; document.addEventListener('budget:account-state-changed', event => events.push(event.detail));
  Sync.activateUser({ uid: 'new-user' });
  assert.deepEqual(events, [{ userId: 'new-user', onboarded: false }]);
  assert.equal(localStorage.getItem('presupuesto_state_owner_v1'), 'new-user'); assert.equal(Data.getState().profile.onboarded, false);
  assert.deepEqual(Data.getState().movimientos, []); assert.ok(localStorage.getItem('presupuesto_local_backup_previous-user'));
});
