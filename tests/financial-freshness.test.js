import test from 'node:test';
import assert from 'node:assert/strict';

class Storage {
  data = new Map(); fail = false; writes = 0;
  getItem(key) { return this.data.get(key) ?? null; }
  setItem(key, value) { if (this.fail) throw new Error('quota'); this.data.set(key, String(value)); this.writes++; }
  clear() { this.data.clear(); this.fail = false; this.writes = 0; }
}
globalThis.localStorage = new Storage();
const Data = await import('../js/02_data.js');
const Fresh = await import('../js/29_financial_freshness.js');
const Rules = await import('../js/domain/financial-rules.js');
const Accounts = await import('../js/15_accounts_engine.js');
const Goals = await import('../js/11_savings_goals.js');
const { STORAGE_KEY } = await import('../js/01_consts_utils.js');
const now = new Date('2026-10-21T18:00:00.000Z');
const oldDate = '2026-10-04T18:00:00.000Z';

function reset(extra = {}) {
  Data.restaurar(JSON.stringify({
    ...Data.createEmptyState(), profile: { onboarded: true, transportMode: 'none', currency: 'MXN' },
    accounts: [{ id: 'acct-personal', name: 'Efectivo de prueba', type: 'cash', ownership: 'personal', active: true }],
    movimientos: [{ id: 'old-real', fecha: oldDate, tipo: 'ingreso', desc: 'Ingreso de prueba', monto: 1000, accountId: 'acct-personal', affectsPersonal: true, categoria: 'Trabajo' }],
    deudas: [{ id: 'd1', desc: 'Préstamo de prueba', montoTotal: 600, montoCuota: 100, saldo: 600, frecuencia: 'Mensual', diaPago: 15 }],
    workSources: [{ id: 'job', name: 'Empresa de prueba', kind: 'employment', compensation: 'biweekly', status: 'active', active: true }],
    savingsGoals: [{ id: 'g1', name: 'Meta de prueba', reserved: 200, targetAmount: 1000, active: true, history: [{ id: 'old-reserve', fecha: oldDate, type: 'reserve', amount: 200 }] }],
    financialPlan: { commitments: [], householdExpenses: [], operatingObligations: [] }, ...extra,
  }));
}
const choices = (extra = {}) => ({ accounts: { 'acct-personal': 650 }, debts: { d1: 450 }, sources: { job: 'paused' }, goals: { g1: { amount: 150 } }, expectedFingerprint: Fresh.auditFingerprint(), ...extra });
const futureReleaseGoal = () => ({
  id: 'g1', name: 'Meta de prueba', reserved: 0, targetAmount: 1000, active: true,
  history: [{ id: 'past-reserve', fecha: oldDate, type: 'reserve', amount: 50 },
    { id: 'future-release', fecha: new Date(now.getTime() + 86400000).toISOString(), type: 'release', amount: 50 }],
});
test.beforeEach(t => { t.mock.timers.enable({ apis: ['Date'], now }); localStorage.clear(); reset(); });

test('del 4 al 21 sin registros reales exige auditoría y no inventa movimientos', () => {
  assert.deepEqual(Fresh.financialFreshness(), { stale: true, lastConfirmedAt: oldDate, lastAuditedAt: null, reason: 'inactivity', daysWithoutRecords: 17, thresholdDays: 7 });
  assert.equal(Data.getState().movimientos.length, 1);
});

test('el límite es siete días completos; una instalación sin registros no inventa antigüedad', () => {
  const state = structuredClone(Data.getState());
  state.movimientos[0].fecha = new Date(now - 7 * 86400000 + 1).toISOString();
  assert.equal(Fresh.financialFreshness(state, now).stale, false);
  state.movimientos[0].fecha = new Date(now - 7 * 86400000).toISOString();
  assert.equal(Fresh.financialFreshness(state, now).stale, true);
  state.movimientos = []; state.turnos = []; state.financialPlan = {};
  assert.equal(Fresh.financialFreshness(state, now).stale, false);
  state.financialPlan.freshness = { requiresAudit: true };
  assert.equal(Fresh.financialFreshness(state, now).stale, true);
});

test('el respaldo puede establecer vigencia mediante una auditoría anterior o deuda fechada', () => {
  const state = structuredClone(Data.getState()); state.movimientos = []; state.turnos = []; state.financialPlan = {};
  state.deudas[0].createdAt = oldDate;
  assert.equal(Fresh.financialFreshness(state, now).daysWithoutRecords, 17);
  state.financialPlan.freshness = { lastAuditedAt: now.toISOString() };
  assert.equal(Fresh.financialFreshness(state, now).stale, false);
  state.financialPlan = {}; state.deudas[0].createdAt = '2030-01-01';
  assert.equal(Fresh.financialFreshness(state, now).lastConfirmedAt, null);
});

test('la conciliación confirma cuentas, metas, deuda y trabajo sin convertir ajustes en consumo', () => {
  const oldMovement = structuredClone(Data.getState().movimientos[0]);
  const oldHistory = structuredClone(Data.getState().savingsGoals[0].history[0]);
  const result = Fresh.completeFinancialAudit(choices());
  const state = Data.getState();
  assert.equal(result.adjustments, 1); assert.equal(result.goals, 1);
  assert.deepEqual(state.movimientos[0], oldMovement);
  assert.deepEqual(state.savingsGoals[0].history[0], oldHistory);
  assert.equal(Rules.personalCash(state), 650); assert.equal(Rules.accountLedgerBalance(state, 'acct-personal'), 650);
  assert.equal(Rules.reservedSavings(state), 150); assert.equal(state.deudas[0].saldo, 450); assert.equal(state.workSources[0].status, 'paused');
  const adjustment = state.movimientos.find(m => m.movementKind === 'reconciliation');
  assert.equal(adjustment.monto, 350); assert.equal(adjustment.categoria, 'Sistema'); assert.equal(adjustment.reconciliation.previousBalance, 1000);
  const release = state.movimientos.find(m => m.goalTransfer === 'release');
  assert.equal(release.monto, 50); assert.equal(release.affectsPersonal, false);
  assert.equal(Rules.observedTotals(state).expense, 0);
  assert.equal(Fresh.financialFreshness().stale, false);
  assert.equal(state.financialPlan.freshness.requiresAudit, false);
  assert.equal(state.financialPlan.freshness.auditHistory.length, 1);
  assert.equal(state.financialPlan.freshness.auditHistory[0].id, adjustment.reconciliation.auditId);
});

test('repetir saldos confirmados no duplica efectivo ni reserva', () => {
  Fresh.completeFinancialAudit(choices());
  const count = Data.getState().movimientos.length, historyCount = Data.getState().savingsGoals[0].history.length;
  Fresh.completeFinancialAudit(choices());
  assert.equal(Data.getState().movimientos.length, count); assert.equal(Data.getState().savingsGoals[0].history.length, historyCount);
  assert.equal(Rules.personalCash(Data.getState()), 650); assert.equal(Rules.reservedSavings(Data.getState()), 150);
});

test('exige confirmar toda cuenta y meta personal; no modifica fondos de terceros', () => {
  Data.getState().accounts.push({ id: 'third', name: 'Fondo ajeno', ownership: 'third_party', type: 'third_party', active: true }); Data.saveData();
  const before = structuredClone(Data.getState());
  assert.throws(() => Fresh.completeFinancialAudit(choices({ goals: {} })), /Confirma.*reservado/);
  assert.throws(() => Fresh.completeFinancialAudit(choices({ accounts: {} })), /Confirma el saldo/);
  assert.throws(() => Fresh.completeFinancialAudit(choices({ accounts: { 'acct-personal': 650, third: 9 } })), /desconocido/);
  assert.deepEqual(Data.getState(), before);
  Fresh.completeFinancialAudit(choices());
  assert.deepEqual(Data.getState().accounts.find(a => a.id === 'third'), before.accounts.find(a => a.id === 'third'));
  assert.ok(Data.getState().movimientos.every(m => m.accountId !== 'third'));
});

test('crear una cuenta y vincular una meta concilia ambas sin duplicar efectivo', () => {
  Fresh.completeFinancialAudit(choices({
    accounts: { 'acct-personal': 400 },
    newAccounts: [{ id: 'new-bank', name: 'Banco de prueba', type: 'bank', balance: 600 }],
    goals: { g1: { amount: 500, accountId: 'new-bank' } },
  }));
  const state = Data.getState();
  assert.equal(Rules.accountLedgerBalance(state, 'acct-personal'), 400); assert.equal(Rules.accountLedgerBalance(state, 'new-bank'), 600);
  assert.equal(Rules.personalCash(state), 1000); assert.equal(Rules.reservedSavings(state), 500);
  assert.equal(state.savingsGoals[0].accountId, 'new-bank');
  assert.equal(state.savingsGoals[0].history.at(-1).type, 'reserve'); assert.equal(state.savingsGoals[0].history.at(-1).amount, 300);
});

test('valida reservas totales y por cuenta, sin exigir cubrir presupuestos declarados', () => {
  const before = structuredClone(Data.getState());
  assert.throws(() => Fresh.completeFinancialAudit(choices({ accounts: { 'acct-personal': 100 }, goals: { g1: { amount: 800 } } })), /supera los saldos/);
  assert.deepEqual(Data.getState(), before);
  assert.throws(() => Fresh.completeFinancialAudit(choices({ accounts: { 'acct-personal': 100 }, newAccounts: [{ id: 'bank', name: 'Banco prueba', type: 'bank', balance: 1000 }], goals: { g1: { amount: 200, accountId: 'acct-personal' } } })), /vinculadas superan/);
  Data.getState().financialPlan.householdExpenses.push({ id: 'need', name: 'Presupuesto de prueba', amount: 20000 });
  Fresh.completeFinancialAudit(choices({ goals: { g1: { amount: 400 } } }));
  assert.equal(Rules.reservedSavings(Data.getState()), 400);
});

test('confirmar una meta por encima del objetivo conserva ese dinero real reservado', () => {
  Fresh.completeFinancialAudit(choices({ accounts: { 'acct-personal': 2000 }, goals: { g1: { amount: 1200 } } }));
  assert.equal(Rules.reservedSavings(Data.getState()), 1200);
  assert.equal(Data.getState().savingsGoals[0].targetAmount, 1000);
});

test('rechaza una reserva incompatible con liberaciones futuras sin modificar el presupuesto', () => {
  reset({ savingsGoals: [futureReleaseGoal()] });
  const before = structuredClone(Data.getState()), disk = localStorage.getItem(STORAGE_KEY), writes = localStorage.writes;
  assert.equal(Rules.reservedSavings(Data.getState()), 50);
  const input = choices({ goals: { g1: { amount: 10 } }, newAccounts: [{ id: 'bank', name: 'Banco de prueba', type: 'bank', balance: 100 }] });
  assert.throws(() => Fresh.completeFinancialAudit(input), /Revisa los movimientos futuros.*antes de confirmar/);
  assert.deepEqual(Data.getState(), before); assert.equal(localStorage.getItem(STORAGE_KEY), disk); assert.equal(localStorage.writes, writes);
  Goals.ensureSavingsGoals(); assert.equal(Rules.reservedSavings(Data.getState()), 50);
});

test('normalizar o recargar conserva una reserva confirmada compatible con liberaciones futuras', () => {
  for (const amount of [50, 80]) {
    reset({ savingsGoals: [futureReleaseGoal()] });
    const future = structuredClone(Data.getState().savingsGoals[0].history[1]);
    Fresh.completeFinancialAudit(choices({ goals: { g1: { amount } } }));
    const expectedReserved = amount - 50;
    assert.equal(Data.getState().savingsGoals[0].reserved, expectedReserved); assert.equal(Rules.reservedSavings(Data.getState()), amount);
    Goals.ensureSavingsGoals(); Data.loadData(); Goals.ensureSavingsGoals();
    assert.equal(Data.getState().savingsGoals[0].reserved, expectedReserved); assert.equal(Rules.reservedSavings(Data.getState()), amount);
    assert.deepEqual(Data.getState().savingsGoals[0].history.find(item => item.id === 'future-release'), future);
  }
});

test('rechaza importes inválidos, identidades nuevas duplicadas y vínculos con fondos de terceros', () => {
  for (const amount of ['', ' ', NaN, Infinity, -1, null, true]) {
    const before = Fresh.auditFingerprint();
    assert.throws(() => Fresh.completeFinancialAudit(choices({ goals: { g1: { amount } } })), /Importe/);
    assert.equal(Fresh.auditFingerprint(), before);
  }
  assert.throws(() => Fresh.completeFinancialAudit(choices({ newAccounts: [{ id: 'acct-personal', name: 'Otra', type: 'bank', balance: 1 }] })), /Identidad/);
  assert.throws(() => Fresh.completeFinancialAudit(choices({ newAccounts: [{ id: 'third', name: 'Ajena', type: 'third_party', balance: 1 }] })), /Tipo de cuenta/);
  assert.throws(() => Fresh.completeFinancialAudit(choices({ goals: { g1: { amount: 100, accountId: 'missing' } } })), /cuenta personal confirmada/);
});

test('el fingerprint rechaza cambios de saldo, identidad de cuenta, metas, moneda y planes', () => {
  for (const edit of [
    state => state.movimientos[0].monto++, state => state.accounts[0].name = 'Otro nombre',
    state => state.savingsGoals[0].reserved++, state => state.savingsGoals[0].targetAmount++,
    state => state.profile.currency = 'USD', state => state.workSources[0].name = 'Otro trabajo',
    state => state.financialPlan.householdExpenses.push({ id: 'new', amount: 1 }),
  ]) {
    reset(); const input = choices(); edit(Data.getState()); const before = structuredClone(Data.getState());
    assert.throws(() => Fresh.completeFinancialAudit(input), /datos cambiaron/); assert.deepEqual(Data.getState(), before);
  }
});

test('un fallo de escritura revierte cuentas, reservas, principal y vigencia; reintenta una sola vez', () => {
  const input = choices({ newAccounts: [{ id: 'bank', name: 'Banco prueba', type: 'bank', balance: 50 }] });
  const before = structuredClone(Data.getState()), disk = localStorage.getItem(STORAGE_KEY), writes = localStorage.writes;
  localStorage.fail = true;
  assert.throws(() => Fresh.completeFinancialAudit(input), /quota/);
  assert.deepEqual(Data.getState(), before); assert.equal(localStorage.getItem(STORAGE_KEY), disk);
  localStorage.fail = false; Fresh.completeFinancialAudit(input);
  assert.equal(localStorage.writes, writes + 1);
  Data.loadData(); assert.equal(Rules.personalCash(Data.getState()), 700); assert.equal(Rules.reservedSavings(Data.getState()), 150);
  assert.equal(Data.getState().accounts.filter(a => a.id === 'bank').length, 1);
  assert.equal(Data.getState().financialPlan.freshness.auditHistory.length, 1);
  assert.throws(() => Fresh.completeFinancialAudit(input), /datos cambiaron/);
});

test('una captura al volver no oculta el intervalo pendiente de auditar', () => {
  Data.saveData(); assert.equal(Fresh.financialFreshness().stale, true);
  Accounts.recordUniversalMovement({ type: 'expense', description: 'Comida de prueba', amount: 20, accountId: 'acct-personal' });
  assert.equal(Fresh.financialFreshness().stale, true);
  assert.equal(Data.getState().financialPlan.freshness.requiresAudit, true);
  Fresh.completeFinancialAudit(choices()); assert.equal(Fresh.financialFreshness().stale, false);
});

test('restaurar un respaldo antiguo no confirma vigencia ni altera movimientos históricos', () => {
  const snapshot = JSON.stringify(Data.getState()); Data.restaurar(snapshot);
  assert.equal(Fresh.financialFreshness().stale, true); assert.equal(Data.getState().movimientos.length, 1);
});
