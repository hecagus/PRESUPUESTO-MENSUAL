/* v3.1.8 - Vigencia de registros y conciliación explícita. No inventa cobros o pagos. */
import { getState, sanearDatos, restaurar } from './02_data.js';
import { accountLedgerBalance } from './domain/financial-rules.js';
import { uuid } from './01_consts_utils.js';

export const FRESHNESS_DAYS = 7;
const DAY = 86400000;
const validTime = value => {
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : null;
};
const latestRecordedTime = (state, now) => {
  const entries = [
    state.financialPlan?.freshness?.lastConfirmedAt,
    ...(state.movimientos || []).filter(m => m.categoria !== 'Sistema' && m.movementKind !== 'reconciliation' && !m.goalTransfer && !m.legacySavingsTransfer).map(m => m.recordedAt || m.fecha),
    ...(state.turnos || []).map(t => t.fin),
  ];
  const times = entries.map(validTime).filter(t => t !== null && t <= now.getTime());
  return times.length ? Math.max(...times) : null;
};
export function financialFreshness(state = getState(), now = new Date()) {
  const last = latestRecordedTime(state, now);
  const ageDays = last === null ? 0 : Math.max(0, Math.floor((now.getTime() - last) / DAY));
  return {
    stale: Boolean(state.profile?.onboarded && last !== null && now.getTime() - last >= FRESHNESS_DAYS * DAY),
    lastConfirmedAt: last === null ? null : new Date(last).toISOString(),
    daysWithoutRecords: ageDays,
    thresholdDays: FRESHNESS_DAYS,
  };
}

export function auditFingerprint(state = getState()) {
  return JSON.stringify({
    movimientos: state.movimientos || [],
    cuentas: (state.accounts || []).map(a => [a.id, a.active, a.ownership]),
    deudas: state.deudas || [],
    trabajo: (state.workSources || []).map(s => [s.id, s.status, s.active, s.endedAt]),
  });
}
const finiteAmount = (value, label, allowNegative = false) => {
  if (value === '' || value === null || value === undefined || !Number.isFinite(Number(value))) {
    throw new Error('Importe no válido: ' + label);
  }
  const amount = Number(value);
  if (Math.abs(amount) > 1e12 || (!allowNegative && amount < 0)) {
    throw new Error('Importe fuera de rango: ' + label);
  }
  return Math.round((amount + Number.EPSILON) * 100) / 100;
};

/* Una conciliación ajusta el saldo contable; no afirma que el cambio fue
   un sueldo ni que una obligación del intervalo ya fue pagada. */
export function completeFinancialAudit({ accounts = {}, debts = {}, sources = {}, expectedFingerprint } = {}) {
  const state = getState();
  if (expectedFingerprint !== auditFingerprint(state)) throw new Error('Los datos cambiaron. Abre de nuevo la auditoría.');
  const now = new Date(), timestamp = now.toISOString(), old = JSON.stringify(state);
  const personalAccounts = (state.accounts || []).filter(a => a.ownership !== 'third_party');
  const pendingDebts = (state.deudas || []).filter(d => Number(d.saldo) > 0);
  const updates = [];
  for (const a of personalAccounts) {
    if (!Object.prototype.hasOwnProperty.call(accounts, a.id)) throw new Error('Confirma el saldo de ' + a.name);
    const actual = finiteAmount(accounts[a.id], a.name, true);
    const registered = accountLedgerBalance(state, a.id, now);
    const delta = Math.round((actual - registered) * 100) / 100;
    updates.push({ a, actual, registered, delta });
  }
  const confirmedDebts = pendingDebts.map(d => {
    if (!Object.prototype.hasOwnProperty.call(debts, d.id)) throw new Error('Confirma la deuda: ' + d.desc);
    return { d, amount: finiteAmount(debts[d.id], d.desc) };
  });
  const confirmedSources = (state.workSources || []).map(s => {
    if (!Object.prototype.hasOwnProperty.call(sources, s.id)) throw new Error('Confirma tu trabajo: ' + s.name);
    if (!['active', 'paused', 'ended'].includes(sources[s.id])) throw new Error('Estado laboral inválido');
    return { s, status: sources[s.id] };
  });
  const before = financialFreshness(state, now);
  try {
    for (const { a, delta, registered, actual } of updates) {
      if (Math.abs(delta) < 0.005) continue;
      state.movimientos.push({
        id: uuid(), fecha: timestamp, tipo: delta > 0 ? 'ingreso' : 'gasto',
        desc: 'Ajuste de conciliación · ' + a.name,
        monto: Math.abs(delta), categoria: 'Sistema',
        accountId: a.id, affectsPersonal: true, movementKind: 'reconciliation',
        reconciliation: { auditedAt: timestamp, previousBalance: registered, confirmedBalance: actual },
      });
    }
    for (const { d, amount } of confirmedDebts) {
      if (Number(d.saldo) !== amount) {
        d.auditHistory = [...(d.auditHistory || []), { at: timestamp, previousBalance: Number(d.saldo), confirmedBalance: amount }];
        d.saldo = amount;
      }
    }
    for (const { s, status } of confirmedSources) {
      if ((s.status || (s.active === false ? 'paused' : 'active')) === status) continue;
      s.status = status;
      s.active = status === 'active';
      if (status === 'ended') s.endedAt = timestamp;
      if (status === 'paused') s.pausedAt = timestamp;
      if (status === 'active') { s.endedAt = null; s.pausedAt = null; s.reactivatedAt = timestamp; }
    }
    state.financialPlan = state.financialPlan || {};
    state.financialPlan.freshness = {
      ...state.financialPlan.freshness,
      lastConfirmedAt: timestamp,
      lastAuditedAt: timestamp,
      lastAuditFrom: before.lastConfirmedAt,
      auditVersion: 1,
    };
    sanearDatos();
    return { adjustments: updates.filter(u => Math.abs(u.delta) >= 0.005).length, accounts: updates.length, debts: confirmedDebts.length };
  } catch (error) {
    try { restaurar(old); } catch { /* mantener error original; respaldo anterior sigue disponible */ }
    throw error;
  }
}
