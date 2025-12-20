import { STORAGE_KEY, safeNumber, DIAS_POR_FRECUENCIA } from "./01_consts_utils.js";

const DEFAULT = {
  turnos: [],
  movimientos: [],
  cargasCombustible: [],
  deudas: [],
  gastosFijosMensuales: [],
  parametros: {
    gastoFijo: 0,
    ultimoKMfinal: 0,
    mantenimientoBase: {
      Aceite: 5000,
      Bujía: 5000,
      Llantas: 15000
    }
  }
};

let state = structuredClone(DEFAULT);

export const getState = () => state;

export function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;

  try {
    const parsed = JSON.parse(raw);
    state = structuredClone(DEFAULT);

    // --- MIGRACIÓN TURNOS ---
    (parsed.turnos || []).forEach(t => {
      state.turnos.push({
        id: Date.now() + Math.random(),
        fecha: t.fecha || t.fin,
        horas: safeNumber(t.horas),
        dineroGenerado: safeNumber(t.dineroGenerado ?? t.ganancia),
        kmRecorridos: safeNumber(t.kmFinal ?? 0)
      });
    });

    state.movimientos = parsed.movimientos || [];
    state.cargasCombustible = parsed.cargasCombustible || [];
    state.deudas = parsed.deudas || [];
    state.gastosFijosMensuales = parsed.gastosFijosMensuales || [];

    state.parametros = {
      ...DEFAULT.parametros,
      ...parsed.parametros,
      ultimoKMfinal: safeNumber(parsed.parametros?.ultimoKM ?? parsed.parametros?.ultimoKMfinal)
    };

    recalcularMetaDiaria();
    saveData();
  } catch {
    state = structuredClone(DEFAULT);
  }
}

export function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function recalcularMetaDiaria() {
  let total = 0;

  state.gastosFijosMensuales.forEach(g => {
    const dias = DIAS_POR_FRECUENCIA[g.frecuencia];
    if (!dias) return;
    total += safeNumber(g.monto) / dias;
  });

  state.deudas.forEach(d => {
    const dias = DIAS_POR_FRECUENCIA[d.frecuencia];
    if (!dias || d.saldo <= 0) return;
    total += safeNumber(d.montoCuota) / dias;
  });

  state.parametros.gastoFijo = total;
  saveData();
}

export function importarDesdeJson(txt) {
  try {
    localStorage.setItem(STORAGE_KEY, txt);
    return true;
  } catch {
    return false;
  }
}
