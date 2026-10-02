/* Pure financial rules. Monthly averages are planning figures, never ledger entries. */
const DAY = 86400000;
export const MONTH_DAYS = 365.25 / 12;
const money = value => Number.isFinite(Number(value)) ? Number(value) : 0;
export const localDay = value => {
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const monthKey = value => localDay(value).slice(0, 7);
export const startOfDay = value => { const d = new Date(value); d.setHours(0, 0, 0, 0); return d; };

export function normalizeFrequency(value) {
  const f = String(value || 'monthly').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return ({diario:'daily', diaria:'daily', semanal:'weekly', quincenal:'biweekly', mensual:'monthly',
    bimestral:'bimonthly', trimestral:'quarterly', anual:'yearly', unico:'one_time', single:'one_time'})[f] || f;
}

export function monthlyAmount(amount, frequency, now = new Date()) {
  const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const factor = {daily:days, weekly:52 / 12, biweekly:2, monthly:1, bimonthly:1 / 2,
    quarterly:1 / 3, yearly:1 / 12, one_time:0, variable:1}[normalizeFrequency(frequency)] ?? 0;
  return money(amount) * factor;
}

// N calendar days INCLUDING today. days=0 is the existing "today and overdue" query.
export function horizonEnd(now, days) {
  const d = startOfDay(now);
  d.setDate(d.getDate() + Math.max(1, Math.floor(money(days))) - 1);
  d.setHours(23, 59, 59, 999);
  return d;
}

// A future scheduled payment is not payable today. Compare civil days, not 9am
// display timestamps or an overdue event's date shifted to today for the calendar.
export function paymentDueBreakdown(events, now = new Date()) {
  if (!Number.isFinite(new Date(now).getTime())) throw new Error('FECHA_INVALIDA');
  const today = localDay(now), totals = {overdue:0, dueToday:0, futureDue:0};
  for (const event of events) {
    if (!['expense','debt'].includes(event?.type) || !(money(event.amount) > 0)) continue;
    const value = event.dueDate || event.date, civil = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
    const date = new Date(civil ? `${value}T12:00:00` : value);
    if (!Number.isFinite(date.getTime()) || civil && localDay(date) !== value) continue;
    const day = localDay(date), key = day < today ? 'overdue' : day === today ? 'dueToday' : 'futureDue';
    totals[key] += money(event.amount);
  }
  return {...totals, dueNow:totals.overdue + totals.dueToday};
}

export function inObservedPeriod(value, start, now) {
  const stamp = new Date(value).getTime();
  return Number.isFinite(stamp) && stamp >= new Date(start).getTime() && stamp <= new Date(now).getTime();
}

export function actualPaymentDate(value, now = new Date()) {
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) throw new Error('FECHA_INVALIDA');
  if (localDay(d) > localDay(now)) throw new Error('PAGO_FECHA_FUTURA');
  // Date-only forms use noon; today's actual transaction must not sit in the future until noon.
  return d > now ? new Date(now) : d;
}

export function isPersonalMovement(state, movement) {
  return movement.affectsPersonal !== false && movement.tipo !== 'transferencia' &&
    !(state.accounts || []).some(a => a.id === movement.accountId && a.ownership === 'third_party') &&
    !movement.goalTransfer && !movement.legacySavingsTransfer &&
    !(state.savingsGoals || []).some(g => (g.legacyReservationMovementIds || []).includes(movement.id));
}

export function personalCash(state, now = new Date()) {
  return (state.movimientos || []).reduce((sum, m) => {
    if (!isPersonalMovement(state, m) || !inObservedPeriod(m.fecha, 0, now)) return sum;
    return sum + (m.tipo === 'ingreso' ? money(m.monto) : m.tipo === 'gasto' ? -money(m.monto) : 0);
  }, 0);
}

export function goalReserved(goal, now = new Date()) {
  const later = (goal.history || []).filter(h => new Date(h.fecha) > now).reduce((total,h) => total + (h.type === 'reserve' ? money(h.amount) : h.type === 'release' ? -money(h.amount) : 0),0);
  return Math.max(0,money(goal.reserved) - later);
}

export function reservedSavings(state, now = new Date()) {
  if (!Array.isArray(state.savingsGoals) || !state.savingsGoals.length) return (state.wallet?.sobres || []).filter(s => ['Ahorro','Meta'].includes(s.categoria)).reduce((sum,s) => sum + money(s.acumulado),0);
  return state.savingsGoals.filter(g => g.active !== false).reduce((sum,g) => sum + goalReserved(g,now),0);
}

export function fuelFundTotals(state, accountId, now = new Date()) {
  const account = (state.accounts || []).find(a => a.id === accountId);
  if (!account || account.ownership !== 'third_party') return {depositado:0, utilizado:0, disponible:0};
  const sources = (state.workSources || []).filter(s => s.fundAccountId === accountId).map(s => s.id);
  const belongs = row => row.accountId === accountId || (!row.accountId && (sources.includes(row.sourceId) || accountId === 'acct-ticketcar'));
  const depositado = (state.fondosCombustibleEmpresa || []).filter(row => belongs(row) && inObservedPeriod(row.fecha,0,now)).reduce((sum,row) => sum + money(row.monto),0);
  const utilizado = (state.cargasCombustible || []).filter(row => belongs(row) && row.pagador === 'empresa' && inObservedPeriod(row.fecha,0,now)).reduce((sum,row) => sum + money(row.costo),0);
  return {depositado, utilizado, disponible:depositado - utilizado};
}

export function accountLedgerBalance(state, accountId, now = new Date()) {
  const account = (state.accounts || []).find(a => a.id === accountId);
  if (!account) return 0;
  if (account.ownership === 'third_party') return fuelFundTotals(state,accountId,now).disponible;
  return (state.movimientos || []).reduce((sum,m) => {
    if (!inObservedPeriod(m.fecha,0,now)) return sum;
    if (m.tipo === 'transferencia') return sum + (m.toAccountId === accountId ? money(m.monto) : 0) - (m.fromAccountId === accountId ? money(m.monto) : 0);
    if (m.accountId !== accountId || !isPersonalMovement(state,m)) return sum;
    return sum + (m.tipo === 'ingreso' ? money(m.monto) : m.tipo === 'gasto' ? -money(m.monto) : 0);
  },0);
}

export function sourceObservedTotals(state, sourceId, start, now) {
  const rows = (state.movimientos || []).filter(m => m.sourceId === sourceId && isPersonalMovement(state,m) && inObservedPeriod(m.fecha,start,now));
  const income = rows.filter(m => m.tipo === 'ingreso' && m.categoria !== 'Sistema').reduce((sum,m) => sum + money(m.monto),0);
  const costs = rows.filter(m => m.tipo === 'gasto' && !m.householdExpenseId && !m.debtId).reduce((sum,m) => sum + money(m.monto),0);
  return {income, costs, net:income - costs};
}

export function debtOutstanding(state, debt, now = new Date()) {
  const laterPayments = (state.movimientos || []).filter(m => m.debtId === debt.id && m.tipo === 'gasto' && new Date(m.fecha) > now).reduce((sum,m) => sum + money(m.monto),0);
  return Math.max(0, money(debt.saldo) + laterPayments);
}

export function debtPeriodId(debt, value) {
  const d = new Date(value), f = normalizeFrequency(debt.frecuencia), ym = monthKey(d);
  if (f === 'one_time') return `O:${debt.id}`;
  if (f === 'daily') return `D:${localDay(d)}`;
  if (f === 'biweekly') return `${ym}-Q${d.getDate() <= 15 ? 1 : 2}`;
  if (f === 'weekly') { const s = startOfDay(d); s.setDate(s.getDate() - ((s.getDay() + 6) % 7)); return `W:${localDay(s)}`; }
  return ym;
}

export function storedDebtPeriod(debt, movement) {
  const canonical = debtPeriodId(debt,movement.fecha), f = normalizeFrequency(debt.frecuencia);
  const d = new Date(movement.fecha); let legacy = canonical;
  if (f === 'daily') legacy = `D:${d.toISOString().slice(0,10)}`;
  if (f === 'weekly') { const monday = new Date(d); monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7)); legacy = `W:${monday.toISOString().slice(0,10)}`; }
  // The previous writer used UTC date slices while keeping the local clock.
  // Read that exact legacy encoding through an adapter; never rewrite the record.
  return !movement.debtPeriod || movement.debtPeriodFormat !== 'local-v2' && movement.debtPeriod === legacy ? canonical : movement.debtPeriod;
}

// Preserve the weekly source keys already stored by v3.1.1; reset the clock for stable keys.
export function sourcePeriodId(frequency, value) {
  const d = new Date(value), f = normalizeFrequency(frequency), ym = monthKey(d);
  if (f === 'biweekly') return `${ym}-Q${d.getDate() <= 15 ? 1 : 2}`;
  if (f === 'weekly') {
    const s = startOfDay(d); s.setDate(s.getDate() - ((s.getDay() + 6) % 7));
    const first = new Date(s.getFullYear(), 0, 1);
    const days = Math.round((s - first) / DAY);
    return `${s.getFullYear()}-W${String(Math.ceil((days + first.getDay() + 1) / 7)).padStart(2, '0')}`;
  }
  if (['daily','per_shift','variable'].includes(f)) return localDay(d);
  return ym;
}

export function fixedIncomeEstimate(state, source, now = new Date()) {
  if (!['daily','weekly','biweekly','monthly'].includes(source?.compensation)) return {amount:0, monthly:0, available:false, periods:0};
  const cutoff = new Date(now); cutoff.setDate(cutoff.getDate() - 180);
  const rows = (state.movimientos || []).filter(m => m.sourceId === source.id && m.tipo === 'ingreso' &&
    m.categoria !== 'Sistema' && isPersonalMovement(state, m) && inObservedPeriod(m.fecha, cutoff, now));
  const explicit = rows.filter(m => m.paymentKind === 'source_period');
  const periods = new Map();
  for (const m of explicit.length ? explicit : rows) {
    const key = m.periodo || sourcePeriodId(source.compensation, m.fecha);
    const old = periods.get(key) || {amount:0, date:0};
    periods.set(key, {amount:old.amount + money(m.monto), date:Math.max(old.date, new Date(m.fecha).getTime())});
  }
  const sample = [...periods.values()].sort((a,b) => b.date - a.date).slice(0, source.compensation === 'weekly' ? 8 : source.compensation === 'biweekly' ? 6 : 4);
  const amount = sample.length ? sample.reduce((sum,p) => sum + p.amount, 0) / sample.length : 0;
  return {amount, monthly:monthlyAmount(amount, source.compensation, now), available:sample.length > 0, periods:sample.length, basis:'paid_period_average'};
}

export function variableIncomeSample(state, source, now = new Date()) {
  const end = startOfDay(now), cutoff = new Date(end); cutoff.setDate(cutoff.getDate() - 56);
  const history = (state.movimientos || []).filter(m => m.sourceId === source.id && isPersonalMovement(state,m) &&
    ['ingreso','gasto'].includes(m.tipo) && m.categoria !== 'Sistema' && !m.householdExpenseId &&
    !m.debtId && !m.commitmentId && !m.operatingObligationId && inObservedPeriod(m.fecha, cutoff, new Date(end - 1)));
  const incomes = history.filter(m => m.tipo === 'ingreso');
  const first = incomes.length ? startOfDay(Math.min(...incomes.map(m => new Date(m.fecha).getTime()))) : end;
  const counts = Array(7).fill(0), gross = Array(7).fill(0), net = Array(7).fill(0); let days = 0;
  for (const d = new Date(first); d < end; d.setDate(d.getDate() + 1)) { counts[d.getDay()]++; days++; }
  for (const m of history) { const i = new Date(m.fecha).getDay(); if (new Date(m.fecha) < first) continue;
    net[i] += (m.tipo === 'ingreso' ? 1 : -1) * money(m.monto); if (m.tipo === 'ingreso') gross[i] += money(m.monto); }
  const available = incomes.length >= 3 && days >= 14;
  const weekdayNet = net.map((n,i) => counts[i] ? n / counts[i] : 0);
  const monthly = available ? gross.reduce((sum,n,i) => sum + (counts[i] ? n / counts[i] : 0),0) * 52 / 12 : 0;
  const monthlyNet=available?weekdayNet.reduce((sum,n)=>sum+n,0)*52/12:0;
  return {available, days, incomes:incomes.length, weekdayNet, monthly, monthlyNet};
}

export function monthlyIncomeProjection(state, now = new Date(), {includeVariable = false} = {}) {
  const sources = (state.workSources || []).filter(s => s.active !== false && !['paused','ended'].includes(s.status)).map(source => {
    const fixed = fixedIncomeEstimate(state, source, now);
    const variable = ['per_shift','variable','per_project','per_sale'].includes(source.compensation) ? variableIncomeSample(state, source, now) : null;
    return {sourceId:source.id, name:source.name, compensation:source.compensation, fixed, variable};
  });
  const fixed = sources.reduce((sum,s) => sum + s.fixed.monthly,0);
  const variable = sources.reduce((sum,s) => sum + (s.variable?.monthly || 0),0);
  return {fixed, variable, total:fixed + (includeVariable ? variable : 0), includeVariable, sources,
    available:sources.some(s => s.fixed.available || (includeVariable && s.variable?.available)),
    insufficientSources:sources.filter(s => !(s.fixed.available || s.variable?.available)).map(s => s.sourceId)};
}

export function observedTotals(state, now = new Date(), days = 90) {
  const cutoff = new Date(now); cutoff.setDate(cutoff.getDate() - days);
  const rows = (state.movimientos || []).filter(m => isPersonalMovement(state,m) && m.categoria !== 'Sistema' && inObservedPeriod(m.fecha,cutoff,now));
  const first = rows.length ? Math.min(...rows.map(m => new Date(m.fecha).getTime())) : now.getTime();
  const observedDays = Math.min(days, Math.max(1, (now.getTime() - first) / DAY + 1));
  const income = rows.filter(m => m.tipo === 'ingreso').reduce((sum,m) => sum + money(m.monto),0);
  const expense = rows.filter(m => m.tipo === 'gasto').reduce((sum,m) => sum + money(m.monto),0);
  const sufficientlyObserved = observedDays >= 28;
  return {income, expense, observedDays, sufficientlyObserved,
    monthlyIncome:sufficientlyObserved ? income / observedDays * MONTH_DAYS : null,
    monthlyExpense:sufficientlyObserved ? expense / observedDays * MONTH_DAYS : null, start:cutoff.toISOString(), end:now.toISOString()};
}
