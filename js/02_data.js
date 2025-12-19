import { STORAGE_KEY, DIAS_POR_FRECUENCIA, safeNumber } from './01_consts_utils.js';

const DEFAULT_DATA = {
    turnos: [], movimientos: [], cargasCombustible: [], deudas: [], gastos: [], gastosFijosMensuales: [],
    parametros: { gastoFijo: 0, ultimoKM: 0, costoPorKm: 0, mantenimientoBase: { 'Aceite': 3000, 'Bujía': 8000, 'Llantas': 15000 }, ultimoServicio: { 'Aceite': 0, 'Bujía': 0, 'Llantas': 0 } }
};

let state = JSON.parse(JSON.stringify(DEFAULT_DATA));
let turnoActivo = JSON.parse(localStorage.getItem("turnoActivo_Final")) || null;

export const loadData = () => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) { try { state = { ...DEFAULT_DATA, ...JSON.parse(raw) }; } catch (e) { console.error(e); } }
    recalcularMetaDiaria();
};

export const saveData = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
export const getState = () => state;
export const getTurnoActivo = () => turnoActivo;

export const recalcularMetaDiaria = () => {
    const fijos = state.gastosFijosMensuales.reduce((acc, i) => acc + (safeNumber(i.monto) / (DIAS_POR_FRECUENCIA[i.frecuencia]||30)), 0);
    const deudas = state.deudas.reduce((acc, d) => (d.saldo > 0 ? acc + (safeNumber(d.montoCuota) / (DIAS_POR_FRECUENCIA[d.frecuencia]||30)) : acc), 0);
    state.parametros.gastoFijo = fijos + deudas;
    saveData();
    return state.parametros.gastoFijo;
};

export const iniciarTurnoLogic = () => {
    if (turnoActivo) return false;
    turnoActivo = { inicio: new Date().toISOString() };
    localStorage.setItem("turnoActivo_Final", JSON.stringify(turnoActivo));
    return true;
};

export const finalizarTurnoLogic = (ganancia, kmFinal = 0) => {
    if (!turnoActivo) return;
    const fin = new Date();
    const t = { fecha: fin.toISOString(), inicio: turnoActivo.inicio, fin: fin.toISOString(), horas: (fin - new Date(turnoActivo.inicio)) / 36e5, ganancia: safeNumber(ganancia), kmFinal: safeNumber(kmFinal) };
    state.turnos.push(t);
    state.movimientos.push({ tipo: 'ingreso', fecha: fin.toISOString(), desc: 'Turno', monto: t.ganancia });
    if(safeNumber(kmFinal) > 0) state.parametros.ultimoKM = safeNumber(kmFinal);
    turnoActivo = null; localStorage.removeItem("turnoActivo_Final"); saveData();
};

export const eliminarGastoFijo = (index) => { state.gastosFijosMensuales.splice(index, 1); recalcularMetaDiaria(); };
export const agregarGastoFijo = (gf) => { state.gastosFijosMensuales.push(gf); recalcularMetaDiaria(); };
