/* Vigencia de registros y conciliación explícita. Nunca inventa cobros o pagos. */
import { getState, sanearDatos, withTransaction } from './02_data.js';
import { accountLedgerBalance, personalCash, goalReserved } from './domain/financial-rules.js';
import { uuid, ACCOUNT_TYPES } from './01_consts_utils.js';

export const FRESHNESS_DAYS = 7;
const DAY = 86400000;
const EPS = 0.005;
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const round = amount => Math.round((amount + Number.EPSILON) * 100) / 100;
const validTime = value => {
  if (value === null || value === undefined || value === '') return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
};
const latestRecordedTime = (state, now) => {
  const entries = [
    state.financialPlan?.freshness?.lastConfirmedAt,
    state.financialPlan?.freshness?.lastAuditedAt,
    ...(state.movimientos || []).filter(m => m.categoria !== 'Sistema' && m.movementKind !== 'reconciliation' && !m.goalTransfer && !m.legacySavingsTransfer).map(m => m.recordedAt || m.fecha),
    ...(state.turnos || []).map(t => t.fin),
    ...(state.deudas || []).map(d => d.creadaEn || d.createdAt),
  ];
  const times = entries.map(validTime).filter(time => time !== null && time <= now.getTime());
  return times.length ? Math.max(...times) : null;
};

export function financialFreshness(state = getState(), now = new Date()) {
  const last = latestRecordedTime(state, now);
  const required = Boolean(state.financialPlan?.freshness?.requiresAudit);
  const inactive = last !== null && now.getTime() - last >= FRESHNESS_DAYS * DAY;
  return {
    stale: Boolean(state.profile?.onboarded && (required || inactive)),
    lastConfirmedAt: last === null ? null : new Date(last).toISOString(),
    lastAuditedAt: state.financialPlan?.freshness?.lastAuditedAt || null,
    reason: required ? 'requires_audit' : inactive ? 'inactivity' : null,
    daysWithoutRecords: last === null ? 0 : Math.max(0, Math.floor((now.getTime() - last) / DAY)),
    thresholdDays: FRESHNESS_DAYS,
  };
}

/* Include the editable records, not just their balances: an open form cannot
   certify a different cloud snapshot, renamed account, goal or payment plan. */
export function auditFingerprint(state = getState()) {
  return JSON.stringify({
    currency: state.profile?.currency,
    accounts: state.accounts || [],
    movimientos: state.movimientos || [],
    turnos: state.turnos || [],
    activeActivity: state.activeActivity || null,
    deudas: state.deudas || [],
    workSources: state.workSources || [],
    savingsGoals: state.savingsGoals || [],
    financialPlan: state.financialPlan || {},
    gastosFijosMensuales: state.gastosFijosMensuales || [],
    ingresosFijos: state.ingresosFijos || [],
  });
}

const finiteAmount = (value, label, allowNegative = false) => {
  if (!['string', 'number'].includes(typeof value) || typeof value === 'string' && !value.trim() || !Number.isFinite(Number(value))) {
    throw new Error('Importe no válido: ' + label);
  }
  const amount = Number(value);
  if (Math.abs(amount) > 1e12 || !allowNegative && amount < 0) throw new Error('Importe fuera de rango: ' + label);
  return round(amount);
};
const record = (value, label) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Datos no válidos: ' + label);
};
const validateKeys = (values, allowed, label) => {
  record(values, label);
  if (Object.keys(values).some(id => !allowed.has(id))) throw new Error('Registro desconocido: ' + label);
};

/* All changes are one recoverable write. Account adjustments affect cash;
   goal adjustments only change which existing cash remains reserved. */
export function completeFinancialAudit({ accounts = {}, debts = {}, sources = {}, goals = {}, newAccounts = [], expectedFingerprint } = {}) {
  return withTransaction(() => {
    const state = getState();
    if (expectedFingerprint !== auditFingerprint(state)) throw new Error('Los datos cambiaron. Abre de nuevo la auditoría.');
    const now = new Date(), timestamp = now.toISOString(), auditId = uuid();
    const before = financialFreshness(state, now);
    const personalAccounts = (state.accounts || []).filter(a => a.ownership !== 'third_party');
    const pendingDebts = (state.deudas || []).filter(d => Number(d.saldo) > 0);
    const activeGoals = (state.savingsGoals || []).filter(g => g.active !== false);
    validateKeys(accounts, new Set(personalAccounts.map(a => a.id)), 'cuentas');
    validateKeys(debts, new Set(pendingDebts.map(d => d.id)), 'deudas');
    validateKeys(sources, new Set((state.workSources || []).map(s => s.id)), 'fuentes de ingreso');
    validateKeys(goals, new Set(activeGoals.map(g => g.id)), 'metas');
    if (!Array.isArray(newAccounts)) throw new Error('Datos no válidos: cuentas nuevas');

    const accountIds = new Set((state.accounts || []).map(a => a.id));
    const accountNames = new Set(personalAccounts.map(a => String(a.name).trim().toLocaleLowerCase()));
    const additions = newAccounts.map(input => {
      record(input, 'cuenta nueva');
      const id = String(input.id || '').trim(), name = String(input.name || '').trim();
      if (!id || id.length > 150 || accountIds.has(id)) throw new Error('Identidad de cuenta nueva no válida');
      if (!name || accountNames.has(name.toLocaleLowerCase())) throw new Error('Nombre de cuenta vacío o duplicado');
      if (!own(ACCOUNT_TYPES, input.type) || input.type === 'third_party') throw new Error('Tipo de cuenta personal no válido');
      accountIds.add(id); accountNames.add(name.toLocaleLowerCase());
      return { account: { id, name, type: input.type, ownership: 'personal', active: true, createdAt: timestamp }, actual: finiteAmount(input.balance, name, true) };
    });
    const updates = personalAccounts.map(account => {
      if (!own(accounts, account.id)) throw new Error('Confirma el saldo de ' + account.name);
      return { account, actual: finiteAmount(accounts[account.id], account.name, true) };
    }).concat(additions);
    const confirmedBalances = new Map(updates.map(u => [u.account.id, u.actual]));
    const confirmedDebts = pendingDebts.map(debt => {
      if (!own(debts, debt.id)) throw new Error('Confirma la deuda: ' + debt.desc);
      return { debt, amount: finiteAmount(debts[debt.id], debt.desc) };
    });
    const confirmedSources = (state.workSources || []).map(source => {
      if (!own(sources, source.id)) throw new Error('Confirma tu trabajo: ' + source.name);
      if (!['active', 'paused', 'ended'].includes(sources[source.id])) throw new Error('Estado laboral inválido');
      return { source, status: sources[source.id] };
    });
    const confirmedGoals = activeGoals.map(goal => {
      if (!own(goals, goal.id)) throw new Error('Confirma el dinero reservado en ' + goal.name);
      const input = goals[goal.id]; record(input, 'meta');
      const amount = finiteAmount(input.amount, goal.name);
      const accountId = own(input, 'accountId') ? input.accountId || null : goal.accountId || null;
      if (accountId !== null && !confirmedBalances.has(accountId)) throw new Error('La meta debe estar vinculada a una cuenta personal confirmada');
      const previous = goalReserved(goal, now), reserved = round(Number(goal.reserved || 0) + amount - previous);
      if (reserved < 0) throw new Error('Revisa los movimientos futuros de ' + goal.name + ' antes de confirmar: las liberaciones futuras superan el dinero reservado.');
      return { goal, amount, accountId, previous, reserved };
    });
    const confirmedCash = round(updates.reduce((total, update) => total + update.actual, 0));
    const confirmedReserved = round(confirmedGoals.reduce((total, update) => total + update.amount, 0));
    if (confirmedReserved > Math.max(0, confirmedCash) + EPS) throw new Error('El dinero reservado en metas supera los saldos confirmados. Revisa los importes.');
    for (const [id, balance] of confirmedBalances) {
      const reserved = confirmedGoals.filter(update => update.accountId === id).reduce((total, update) => total + update.amount, 0);
      if (reserved > Math.max(0, balance) + EPS) throw new Error('Las metas vinculadas superan el saldo confirmado de ' + updates.find(update => update.account.id === id).account.name);
    }

    const anchor = {
      lastAuditedAt: state.financialPlan?.freshness?.lastAuditedAt || null,
      lastMovementId: state.movimientos?.at(-1)?.id || null,
      lastMovementAt: state.movimientos?.at(-1)?.fecha || null,
    };
    state.accounts.push(...additions.map(update => update.account));
    for (const update of updates) {
      update.registered = accountLedgerBalance(state, update.account.id, now);
      update.delta = round(update.actual - update.registered);
      if (Math.abs(update.delta) < EPS) continue;
      state.movimientos.push({
        id: uuid(), fecha: timestamp, tipo: update.delta > 0 ? 'ingreso' : 'gasto',
        desc: 'Ajuste de conciliación · ' + update.account.name,
        monto: Math.abs(update.delta), categoria: 'Sistema', accountId: update.account.id,
        affectsPersonal: true, movementKind: 'reconciliation',
        reconciliation: { auditId, auditedAt: timestamp, previousBalance: update.registered, confirmedBalance: update.actual, anchor },
      });
    }
    // Historical orphan movements must be assigned to an account before a
    // complete account confirmation can certify the total cash balance.
    if (Math.abs(personalCash(state, now) - confirmedCash) >= EPS) throw new Error('Hay movimientos sin una cuenta personal reconocida. Revisa las cuentas antes de confirmar.');
    for (const { goal, amount, accountId, previous, reserved } of confirmedGoals) {
      const delta = round(amount - previous);
      if (Math.abs(delta) >= EPS) {
        const id = uuid(), type = delta > 0 ? 'reserve' : 'release';
        goal.history = [...(goal.history || []), { id, fecha: timestamp, type, amount: Math.abs(delta), auditId, note: 'Conciliación de reserva', previousBalance: previous, confirmedBalance: amount }];
        state.movimientos.push({
          id: uuid(), fecha: timestamp, tipo: type === 'reserve' ? 'gasto' : 'ingreso',
          desc: 'Conciliación de reserva · ' + goal.name, monto: Math.abs(delta), categoria: 'Meta',
          accountId: accountId || 'acct-personal', affectsPersonal: false, goalId: goal.id, goalTransfer: type,
          reconciliation: { auditId, auditedAt: timestamp, previousBalance: previous, confirmedBalance: amount, anchor },
        });
      }
      // Keep future reservations and their dates intact when confirming today.
      goal.reserved = reserved;
      goal.accountId = accountId;
      goal.completedAt = amount >= Number(goal.targetAmount || 0) ? goal.completedAt || timestamp : null;
    }
    for (const { debt, amount } of confirmedDebts) {
      if (Number(debt.saldo) === amount) continue;
      debt.auditHistory = [...(debt.auditHistory || []), { at: timestamp, auditId, previousBalance: Number(debt.saldo), confirmedBalance: amount }];
      debt.saldo = amount;
    }
    for (const { source, status } of confirmedSources) {
      const oldStatus = source.status || (source.active === false ? 'paused' : 'active');
      if (oldStatus === status) continue;
      source.auditHistory = [...(source.auditHistory || []), { at: timestamp, auditId, previousStatus: oldStatus, confirmedStatus: status }];
      source.status = status; source.active = status === 'active';
      if (status === 'ended') source.endedAt = timestamp;
      if (status === 'paused') source.pausedAt = timestamp;
      if (status === 'active') { source.endedAt = null; source.pausedAt = null; source.reactivatedAt = timestamp; }
    }
    const snapshot = {
      id: auditId, at: timestamp, anchor, currency: state.profile?.currency || 'MXN',
      accounts: updates.map(update => ({ id: update.account.id, previousBalance: update.registered, balance: update.actual })),
      goals: confirmedGoals.map(update => ({ id: update.goal.id, previousBalance: update.previous, amount: update.amount, accountId: update.accountId })),
      debts: confirmedDebts.map(update => ({ id: update.debt.id, amount: update.amount })),
      sources: confirmedSources.map(update => ({ id: update.source.id, status: update.status })),
    };
    state.financialPlan = state.financialPlan || {};
    state.financialPlan.freshness = {
      ...state.financialPlan.freshness, requiresAudit: false, lastConfirmedAt: timestamp,
      lastAuditedAt: timestamp, lastAuditFrom: before.lastConfirmedAt, auditVersion: 2,
      auditHistory: [...(state.financialPlan.freshness?.auditHistory || []), snapshot],
    };
    sanearDatos();
    return { adjustments: updates.filter(update => Math.abs(update.delta) >= EPS).length, accounts: updates.length, debts: confirmedDebts.length, goals: confirmedGoals.length, snapshot };
  });
}
