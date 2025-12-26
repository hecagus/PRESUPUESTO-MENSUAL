/* ======================================================
   02_data.js — MOTOR CONTABLE (V6.1 ESTABLE REAL)
   ====================================================== */

import { STORAGE_KEY } from './01_consts_utils.js';

/* ---------------- CONSTANTES ---------------- */

const KEYS_LEGACY = ["moto_finanzas_v3", "moto_finanzas", "app_moto_data"];

export const FRECUENCIAS = {
  Diario: 1,
  Semanal: 7,
  Quincenal: 15,
  Mensual: 30,
  Bimestral: 60,
  Anual: 365,
  Unico: 0
};

const hoyISO = () => new Date().toISOString().split("T")[0];
const safe = v => Number.isFinite(+v) ? +v : 0;
const uuid = () => Date.now().toString(36) + Math.random().toString(36).slice(2);

/* ---------------- ESTADO BASE ---------------- */

const INITIAL_STATE = {
  schemaVersion: 6.1,
  turnos: [],
  movimientos: [],
  cargasCombustible: [],
  deudas: [],
  gastosFijosMensuales: [],
  wallet: { saldo: 0, sobres: [] },
  parametros: { ultimoKM: 0, costoPorKm: 0, gastoFijo: 0 },
  turnoActivo: null
};

let store = structuredClone(INITIAL_STATE);

/* ================== RECOVERY ================== */

export function loadData() {
  let raw = localStorage.getItem(STORAGE_KEY);

  if (!raw || raw.length < 50) {
    for (const k of KEYS_LEGACY) {
      const r = localStorage.getItem(k);
      if (r && r.length > 50) {
        raw = r;
        break;
      }
    }
  }

  if (!raw) return;

  try {
    const saved = JSON.parse(raw);
    store = {
      ...INITIAL_STATE,
      ...saved,
      wallet: { ...INITIAL_STATE.wallet, ...saved.wallet }
    };
  } catch {
    store = structuredClone(INITIAL_STATE);
  }

  sanearDatos();
}

export function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

/* ================== GETTERS ================== */

export const getState = () => structuredClone(store);

/* ================== MOTOR CONTABLE ================== */

function sanearDatos() {
  // Blindaje de arrays
  ['movimientos','turnos','cargasCombustible','deudas','gastosFijosMensuales']
    .forEach(k => { if (!Array.isArray(store[k])) store[k] = []; });

  if (!Array.isArray(store.wallet.sobres)) store.wallet.sobres = [];

  // 1️⃣ SALDO REAL
  let saldo = 0;
  store.movimientos.forEach(m => {
    if (m.tipo === 'ingreso') saldo += safe(m.monto);
    if (m.tipo === 'gasto') saldo -= safe(m.monto);
  });
  store.wallet.saldo = saldo;

  // 2️⃣ KM BLINDADO
  const kmTurnos = store.turnos.map(t => t.kmFinal || 0);
  const kmGas = store.cargasCombustible.map(c => c.km || 0);
  store.parametros.ultimoKM = Math.max(
    store.parametros.ultimoKM || 0,
    ...kmTurnos,
    ...kmGas
  );

  // 3️⃣ SOBRES
  actualizarSobresEstructural();
  recalcularSobresPorCalendario();

  // 4️⃣ META DIARIA
  recalcularMetaDiaria();

  saveData();
}

/* ================== SOBRES ================== */

function actualizarSobresEstructural() {
  const crear = (refId, tipo, desc, meta, freq, dia) => {
    let s = store.wallet.sobres.find(x => x.refId === refId);
    if (!s) {
      s = { id: uuid(), refId, tipo, desc, acumulado: 0, ultimoCalculo: hoyISO() };
      store.wallet.sobres.push(s);
    }
    s.meta = safe(meta);
    s.frecuencia = freq;
    s.diaPago = dia;
  };

  store.deudas.forEach(d => {
    if (d.saldo > 0)
      crear(d.id, 'deuda', d.desc, d.montoCuota, d.frecuencia, d.diaPago);
  });

  store.gastosFijosMensuales.forEach(g => {
    crear(g.id, 'gasto', g.desc, g.monto, g.frecuencia);
  });

  store.wallet.sobres = store.wallet.sobres.filter(s =>
    (s.tipo === 'deuda' && store.deudas.some(d => d.id === s.refId && d.saldo > 0)) ||
    (s.tipo === 'gasto' && store.gastosFijosMensuales.some(g => g.id === s.refId))
  );
}

function recalcularSobresPorCalendario() {
  const hoy = new Date();
  const diaMes = hoy.getDate();
  const diaSemana = hoy.getDay() || 7;

  store.wallet.sobres.forEach(s => {
    let ideal = 0;
    if (s.frecuencia === 'Semanal') ideal = (s.meta / 7) * diaSemana;
    if (s.frecuencia === 'Mensual') ideal = (s.meta / 30) * diaMes;
    if (s.frecuencia === 'Diario') ideal = s.meta;

    if (s.acumulado < ideal) s.acumulado = ideal;
    if (s.acumulado > s.meta) s.acumulado = s.meta;
  });
}

/* ================== META DIARIA ================== */

function recalcularMetaDiaria() {
  let total = 0;

  store.gastosFijosMensuales.forEach(g => {
    total += safe(g.monto) / (FRECUENCIAS[g.frecuencia] || 30);
  });

  store.deudas.forEach(d => {
    if (d.saldo > 0)
      total += safe(d.montoCuota) / (FRECUENCIAS[d.frecuencia] || 30);
  });

  store.parametros.gastoFijo = total;
}

/* ================== ACCIONES ================== */

export function agregarMovimiento(mov) {
  store.movimientos.push({ ...mov, id: uuid(), fecha: new Date().toISOString() });
  sanearDatos();
}

export function agregarDeuda(obj) {
  store.deudas.push({ ...obj, id: uuid(), saldo: safe(obj.montoTotal) });
  sanearDatos();
}
/* ======================================================
   03_render.js — UI (SOLO RENDER)
   ====================================================== */

import { $, fmtMoney } from './01_consts_utils.js';
import { getState } from './02_data.js';

/* ================== DASHBOARD ================== */

export function renderDashboard() {
  const s = getState();

  if ($('resGananciaBruta'))
    $('resGananciaBruta').innerText = fmtMoney(
      s.movimientos
        .filter(m => m.tipo === 'ingreso')
        .reduce((a,b)=>a+b.monto,0)
    );

  if ($('metaDiariaDisplay'))
    $('metaDiariaDisplay').innerText = fmtMoney(s.parametros.gastoFijo);
}

/* ================== WALLET ================== */

export function renderWalletUI() {
  const s = getState();
  const comprometido = s.wallet.sobres.reduce((a,b)=>a+b.acumulado,0);
  const libre = s.wallet.saldo - comprometido;

  if ($('valWallet')) {
    $('valWallet').innerHTML = `
      ${fmtMoney(s.wallet.saldo)}
      <br><small style="color:${libre>=0?'green':'orange'}">
        Libre: ${fmtMoney(libre)}
      </small>
    `;
  }
}

/* ================== HISTORIAL ================== */

export function renderHistorial() {
  const s = getState();
  const tbody = $('tablaBody');
  if (!tbody) return;

  if (!s.movimientos.length) {
    tbody.innerHTML = `<tr><td colspan="3">Sin movimientos</td></tr>`;
    return;
  }

  tbody.innerHTML = [...s.movimientos]
    .sort((a,b)=>new Date(b.fecha)-new Date(a.fecha))
    .slice(0,50)
    .map(m=>`
      <tr>
        <td>${new Date(m.fecha).toLocaleDateString()}</td>
        <td>${m.desc}</td>
        <td style="text-align:right; color:${m.tipo==='ingreso'?'green':'red'}">
          ${m.tipo==='ingreso'?'+':'-'}${fmtMoney(m.monto)}
        </td>
      </tr>
    `).join('');
}
