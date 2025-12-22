/* 02_data.js */
import {
  STORAGE_KEY,
  DIAS_POR_FRECUENCIA,
  safeNumber,
  isSameDay
} from "./01_consts_utils.js";

const DEFAULT_STATE = {
  ingresos: [],
  gastos: [],
  movimientos: [],
  turnos: [],
  cargasCombustible: [],
  deudas: [],
  gastosFijosMensuales: [],
  parametros: {
    gastoFijo: 0,
    ultimoKM: 0,
    costoKmPromedio: 0
  },
  _version: 2
};

let state = structuredClone(DEFAULT_STATE);
let turnoActivo = null;

export const getState = () => state;
export const getTurnoActivo = () => turnoActivo;

const migrate = (raw) => {
  if (!raw._version) raw._version = 1;
  if (raw._version === 1) {
    raw.parametros.costoKmPromedio = 0;
    raw._version = 2;
  }
  return raw;
};

export const loadData = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) state = migrate({ ...DEFAULT_STATE, ...JSON.parse(raw) });
    turnoActivo = JSON.parse(localStorage.getItem("turnoActivo"));
  } catch {
    state = structuredClone(DEFAULT_STATE);
    turnoActivo = null;
  }
  recalcularMetaDiaria();
};

export const saveData = () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  turnoActivo
    ? localStorage.setItem("turnoActivo", JSON.stringify(turnoActivo))
    : localStorage.removeItem("turnoActivo");
};

export const recalcularMetaDiaria = () => {
  const fijos = state.gastosFijosMensuales.reduce((a, g) => {
    const d = DIAS_POR_FRECUENCIA[g.frecuencia] || 30;
    return a + safeNumber(g.monto) / d;
  }, 0);

  const deudas = state.deudas.reduce((a, d) => {
    if (d.saldo <= 0) return a;
    const d2 = DIAS_POR_FRECUENCIA[d.frecuencia] || 30;
    return a + safeNumber(d.montoCuota) / d2;
  }, 0);

  state.parametros.gastoFijo = fijos + deudas;
  saveData();
};

export const iniciarTurno = (km) => {
  turnoActivo = { inicio: Date.now(), kmInicial: safeNumber(km) };
  saveData();
};

export const finalizarTurno = (kmFinal, ganancia) => {
  if (!turnoActivo) return;
  const horas = (Date.now() - turnoActivo.inicio) / 36e5;
  const km = safeNumber(kmFinal) - turnoActivo.kmInicial;

  state.turnos.push({
    id: Date.now(),
    fecha: new Date().toISOString(),
    horas,
    km,
    ganancia: safeNumber(ganancia)
  });

  if (safeNumber(kmFinal) > state.parametros.ultimoKM)
    state.parametros.ultimoKM = safeNumber(kmFinal);

  agregarMovimiento("ingreso", "Ganancia Turno", ganancia, "Operativo");
  turnoActivo = null;
  saveData();
};

export const registrarGasolina = (litros, costo, km) => {
  const prev = state.parametros.ultimoKM;
  const recorrido = safeNumber(km) - prev;
  const costoKm = recorrido > 0 ? safeNumber(costo) / recorrido : 0;

  state.cargasCombustible.push({
    fecha: new Date().toISOString(),
    litros: safeNumber(litros),
    costo: safeNumber(costo),
    km: safeNumber(km),
    costoKm
  });

  const avg =
    state.cargasCombustible.reduce((a, c) => a + c.costoKm, 0) /
    state.cargasCombustible.length;

  state.parametros.costoKmPromedio = avg || 0;
  state.parametros.ultimoKM = safeNumber(km);

  agregarMovimiento("gasto", "⛽ Gasolina", costo, "Moto");
};

export const agregarMovimiento = (tipo, desc, monto, categoria) => {
  state.movimientos.push({
    tipo,
    fecha: new Date().toISOString(),
    desc,
    monto: safeNumber(monto),
    categoria
  });
  saveData();
};

export const agregarDeuda = (desc, total, cuota, frecuencia) => {
  state.deudas.push({
    id: Date.now(),
    desc,
    montoTotal: safeNumber(total),
    saldo: safeNumber(total),
    montoCuota: safeNumber(cuota),
    frecuencia
  });
  recalcularMetaDiaria();
};

export const registrarAbono = (id, monto) => {
  const d = state.deudas.find((x) => x.id == id);
  if (!d) return;
  d.saldo -= safeNumber(monto);
  if (d.saldo < 0) d.saldo = 0;
  agregarMovimiento("gasto", `Abono ${d.desc}`, monto, "Deuda");
  recalcularMetaDiaria();
};

export const getDashboardStats = () => {
  const hoy = new Date();
  const movs = state.movimientos.filter((m) => isSameDay(m.fecha, hoy));
  const turnos = state.turnos.filter((t) => isSameDay(t.fecha, hoy));
  const ganancia = movs
    .filter((m) => m.tipo === "ingreso")
    .reduce((a, b) => a + b.monto, 0);

  return {
    horas: turnos.reduce((a, b) => a + b.horas, 0),
    ganancia,
    meta: state.parametros.gastoFijo,
    progreso:
      state.parametros.gastoFijo > 0
        ? (ganancia / state.parametros.gastoFijo) * 100
        : 0,
    turnosRecientes: state.turnos.slice(-7).reverse()
  };
};
