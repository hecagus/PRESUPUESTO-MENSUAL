import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeStates } from '../js/26_sync_merge.js';
import { personalCash } from '../js/domain/financial-rules.js';

const date = '2026-10-21T18:00:00.000Z';
const baseState = () => ({ accounts: [{ id: 'cash', ownership: 'personal' }], movimientos: [{ id: 'opening', fecha: '2026-10-04T18:00:00.000Z', tipo: 'ingreso', monto: 1000, accountId: 'cash', affectsPersonal: true }], savingsGoals: [], financialPlan: {}, activeActivity: null });
const adjustment = (id, amount = 350) => ({ id, fecha: date, tipo: 'gasto', monto: amount, categoria: 'Sistema', accountId: 'cash', affectsPersonal: true, movementKind: 'reconciliation', reconciliation: { previousBalance: 1000, confirmedBalance: 1000 - amount, auditedAt: date, anchor: { lastAuditedAt: null, movementIds: [] } } });
const cash = state => personalCash(state, new Date('2026-10-22T18:00:00Z'));

test('dos ajustes legacy de una cuenta exigen elección y no pueden conservarse ambos', () => {
  const base = baseState(), local = structuredClone(base), remote = structuredClone(base);
  local.movimientos.push(adjustment('local')); remote.movimientos.push(adjustment('remote'));
  const before = JSON.stringify({ local, remote, base });
  const result = mergeStates(local, remote, base);
  const conflict = result.conflicts.find(c => c.kind === 'account_reconciliation'); assert.ok(conflict);
  assert.deepEqual(conflict.local.map(m => m.id), ['local']); assert.deepEqual(conflict.remote.map(m => m.id), ['remote']);
  assert.ok(mergeStates(local, remote, base, { [conflict.path]: 'both' }).conflicts.some(c => c.kind === 'account_reconciliation'));
  for (const choice of ['local', 'remote']) {
    const resolved = mergeStates(local, remote, base, { [conflict.path]: choice });
    assert.deepEqual(resolved.conflicts, []); assert.equal(cash(resolved.state), 650); assert.equal(resolved.state.movimientos.length, 2);
  }
  assert.equal(JSON.stringify({ local, remote, base }), before);
});

test('los ajustes con fecha o saldos distintos siguen requiriendo una decisión explícita', () => {
  const base = baseState(), local = structuredClone(base), remote = structuredClone(base);
  local.movimientos.push(adjustment('local', 200)); const other = adjustment('remote', 400); other.fecha = '2026-10-22T12:00:00Z'; remote.movimientos.push(other);
  const conflict = mergeStates(local, remote, base).conflicts.find(c => c.kind === 'account_reconciliation'); assert.ok(conflict);
  assert.equal(cash(mergeStates(local, remote, base, { [conflict.path]: 'local' }).state), 800);
  assert.equal(cash(mergeStates(local, remote, base, { [conflict.path]: 'remote' }).state), 600);
});

test('una conciliación compartida y registros reales independientes no provocan conflicto nuevo', () => {
  const base = baseState(); base.movimientos.push(adjustment('shared'));
  const local = structuredClone(base), remote = structuredClone(base);
  local.movimientos.push({ id: 'food', fecha: date, tipo: 'gasto', monto: 10, accountId: 'cash', affectsPersonal: true });
  remote.movimientos.push({ id: 'pay', fecha: date, tipo: 'ingreso', monto: 20, accountId: 'cash', affectsPersonal: true });
  const result = mergeStates(local, remote, base); assert.deepEqual(result.conflicts, []); assert.equal(cash(result.state), 660);
});

test('auditorías completas concurrentes bloquean fusión por campos aunque se elijan ajustes', () => {
  const base = baseState(), local = structuredClone(base), remote = structuredClone(base);
  for (const [state, id, balance] of [[local, 'audit-local', 650], [remote, 'audit-remote', 600]]) {
    const movement = adjustment('movement-' + id, 1000 - balance); movement.reconciliation.auditId = id; state.movimientos.push(movement);
    state.financialPlan.freshness = { lastAuditedAt: date, auditHistory: [{ id, at: date, accounts: [{ id: 'cash', balance }], goals: [{ id: 'goal', amount: 100 }] }] };
    state.savingsGoals = [{ id: 'goal', reserved: 100, active: true, history: [{ id: 'reserve-' + id, fecha: date, type: 'reserve', amount: 100, auditId: id }] }];
  }
  const result = mergeStates(local, remote, base); assert.ok(result.conflicts.some(c => c.kind === 'audit_concurrency'));
  assert.equal(result.state.movimientos.length, 3); assert.equal(result.state.financialPlan.freshness.auditHistory.length, 2);
  const attempted = mergeStates(local, remote, base, { '/financial-audits/concurrency': 'local', '/financial-reconciliations/cash': 'remote' });
  assert.ok(attempted.conflicts.some(c => c.kind === 'audit_concurrency'));
});

test('una auditoría ya compartida no bloquea una siguiente auditoría unilateral', () => {
  const base = baseState(); base.financialPlan.freshness = { auditHistory: [{ id: 'shared', at: date, accounts: [{ id: 'cash', balance: 1000 }] }] };
  const local = structuredClone(base), remote = structuredClone(base);
  local.financialPlan.freshness.auditHistory.push({ id: 'new', at: date, accounts: [{ id: 'cash', balance: 650 }] }); local.movimientos.push(adjustment('new-adjustment'));
  const result = mergeStates(local, remote, base); assert.deepEqual(result.conflicts, []); assert.equal(cash(result.state), 650);
});

test('primera sincronización sin base también bloquea dos auditorías independientes', () => {
  const local = baseState(), remote = baseState();
  local.financialPlan.freshness = { auditHistory: [{ id: 'local' }] }; remote.financialPlan.freshness = { auditHistory: [{ id: 'remote' }] };
  assert.ok(mergeStates(local, remote).conflicts.some(c => c.kind === 'audit_concurrency'));
});

test('una auditoría y un gasto exclusivo del otro dispositivo requieren revisar un presupuesto completo', () => {
  for (const auditedSide of ['local', 'remote']) {
    const base = baseState(), local = structuredClone(base), remote = structuredClone(base);
    const audited = auditedSide === 'local' ? local : remote, other = auditedSide === 'local' ? remote : local;
    audited.movimientos.push(adjustment('audit-adjustment'));
    audited.financialPlan.freshness = { auditHistory: [{ id: 'audit', at: date, accounts: [{ id: 'cash', balance: 650 }] }] };
    other.movimientos.push({ id: 'expense-on-other-device', fecha: date, tipo: 'gasto', monto: 50, accountId: 'cash', affectsPersonal: true });
    const result = mergeStates(local, remote, base);
    assert.ok(result.conflicts.some(c => c.kind === 'audit_concurrency'));
    const attempted = mergeStates(local, remote, base, { '/financial-audits/concurrency': auditedSide });
    assert.ok(attempted.conflicts.some(c => c.kind === 'audit_concurrency'));
  }
});

test('cuentas, metas, deudas y trabajo exclusivos del otro dispositivo también bloquean una auditoría unilateral', () => {
  for (const [field, changed] of [
    ['accounts', { id: 'bank', ownership: 'personal' }],
    ['savingsGoals', { id: 'goal', reserved: 100, history: [] }],
    ['deudas', { id: 'debt', saldo: 100 }],
    ['workSources', { id: 'source', status: 'active' }],
  ]) {
    const base = baseState(), local = structuredClone(base), remote = structuredClone(base);
    local.movimientos.push(adjustment('adjustment'));
    local.financialPlan.freshness = { auditHistory: [{ id: 'audit', at: date, accounts: [{ id: 'cash', balance: 650 }] }] };
    remote[field] = [...(remote[field] || []), changed];
    assert.ok(mergeStates(local, remote, base).conflicts.some(c => c.kind === 'audit_concurrency'), field);
  }
});

test('una auditoría y una preferencia cosmética pueden conservarse juntas', () => {
  const base = baseState(), local = structuredClone(base), remote = structuredClone(base);
  local.movimientos.push(adjustment('adjustment'));
  local.financialPlan.freshness = { auditHistory: [{ id: 'audit', at: date, accounts: [{ id: 'cash', balance: 650 }] }] };
  remote.profile = { displayName: 'Nombre de prueba', theme: 'dark' };
  remote.automationPreferences = { alertsEnabled: false };
  const result = mergeStates(local, remote, base);
  assert.deepEqual(result.conflicts, []); assert.equal(cash(result.state), 650);
  assert.equal(result.state.profile.theme, 'dark'); assert.equal(result.state.automationPreferences.alertsEnabled, false);
});

test('un gasto ya contenido en el registro auditado no se suma otra vez ni exige revisión por concurrencia', () => {
  const base = baseState(), local = structuredClone(base), remote = structuredClone(base);
  const expense = { id: 'included-expense', fecha: date, tipo: 'gasto', monto: 50, accountId: 'cash', affectsPersonal: true };
  local.movimientos.push(structuredClone(expense), adjustment('adjustment', 300)); remote.movimientos.push(expense);
  local.financialPlan.freshness = { auditHistory: [{ id: 'audit', at: date, accounts: [{ id: 'cash', balance: 650 }] }] };
  const result = mergeStates(local, remote, base);
  assert.deepEqual(result.conflicts, []); assert.equal(cash(result.state), 650);
  assert.equal(result.state.movimientos.filter(m => m.id === expense.id).length, 1);
});
