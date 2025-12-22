import { STORAGE_KEY, DIAS_POR_FRECUENCIA, safeNumber, isSameDay } from "./01_consts_utils.js";

const DEFAULT_STATE = {
  ingresos: [], gastos: [], turnos: [], movimientos: [], 
  cargasCombustible: [], deudas: [], gastosFijosMensuales: [],
  parametros: { gastoFijo: 0, ultimoKM: 0 }
};

let state = structuredClone(DEFAULT_STATE);
let turnoActivo = null;

export const getState = () => state;

export const loadData = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) state = { ...DEFAULT_STATE, ...JSON.parse(raw) };
    turnoActivo = JSON.parse(localStorage.getItem("turnoActivo"));
  } catch { state = structuredClone(DEFAULT_STATE); }
  recalcularMetaDiaria();
};

export const saveData = () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  turnoActivo ? localStorage.setItem("turnoActivo", JSON.stringify(turnoActivo)) 
              : localStorage.removeItem("turnoActivo");
};

export const recalcularMetaDiaria = () => {
  const fijos = state.gastosFijosMensuales.reduce((acc, g) => {
    return acc + (safeNumber(g.monto) / (DIAS_POR_FRECUENCIA[g.frecuencia] || 30));
  }, 0);
  const deudas = state.deudas.reduce((acc, d) => {
    return d.saldo > 0 ? acc + (safeNumber(d.montoCuota) / (DIAS_POR_FRECUENCIA[d.frecuencia] || 30)) : acc;
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
  const recorrido = safeNumber(kmFinal) - turnoActivo.kmInicial;
  
  state.turnos.push({ 
    id: Date.now(), fecha: new Date().toISOString(), 
    horas, km: recorrido, ganancia: safeNumber(ganancia) 
  });
  
  if(safeNumber(kmFinal) > state.parametros.ultimoKM) state.parametros.ultimoKM = safeNumber(kmFinal);
  agregarMovimiento("ingreso", "Ganancia Turno", ganancia, "Operativo");
  turnoActivo = null;
  saveData();
};

export const registrarGasolina = (litros, costo, km) => {
    state.cargasCombustible.push({ fecha: new Date().toISOString(), litros, costo, km });
    if(safeNumber(km) > state.parametros.ultimoKM) state.parametros.ultimoKM = safeNumber(km);
    agregarMovimiento("gasto", "⛽ Gasolina", costo, "Moto");
};

export const agregarMovimiento = (tipo, desc, monto, cat) => {
  state.movimientos.push({ tipo, fecha: new Date().toISOString(), desc, monto: safeNumber(monto), categoria: cat });
  saveData();
};

export const agregarDeuda = (desc, total, cuota, freq) => {
  state.deudas.push({ id: Date.now(), desc, montoTotal: safeNumber(total), saldo: safeNumber(total), montoCuota: safeNumber(cuota), frecuencia: freq });
  recalcularMetaDiaria();
};

export const registrarAbono = (id, monto) => {
  const d = state.deudas.find(x => x.id == id);
  if (d) {
    d.saldo -= safeNumber(monto);
    if(d.saldo < 0) d.saldo = 0;
    agregarMovimiento("gasto", `Abono ${d.desc}`, monto, "Deuda");
    recalcularMetaDiaria();
  }
};

export const getDashboardStats = () => {
  const hoy = new Date();
  const movs = state.movimientos.filter(m => isSameDay(m.fecha, hoy));
  const turnos = state.turnos.filter(t => isSameDay(t.fecha, hoy));
  const ganancia = movs.filter(m => m.tipo === "ingreso").reduce((a, b) => a + b.monto, 0);
  return {
    horas: turnos.reduce((a, b) => a + b.horas, 0),
    ganancia,
    meta: state.parametros.gastoFijo,
    progreso: state.parametros.gastoFijo > 0 ? (ganancia / state.parametros.gastoFijo) * 100 : 0,
    turnosRecientes: state.turnos.slice(-5).reverse()
  };
};

export const getTurnoActivo = () => turnoActivo;
