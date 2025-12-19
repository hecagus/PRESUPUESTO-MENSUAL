import { STORAGE_KEY, DIAS_POR_FRECUENCIA, safeNumber, log } from './01_consts_utils.js';

const DEFAULT_DATA = {
    turnos: [], movimientos: [], cargasCombustible: [], 
    deudas: [], gastosFijosMensuales: [],
    parametros: { gastoFijo: 0, ultimoKM: 0, costoPorKm: 0, mantenimientoBase: { 'Aceite': 3000, 'Bujía': 8000, 'Llantas': 15000 }, ultimoServicio: { 'Aceite': 0, 'Bujía': 0, 'Llantas': 0 } },
    turnoActivo: null
};

let state = JSON.parse(JSON.stringify(DEFAULT_DATA));

export const loadData = () => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
        try {
            const parsed = JSON.parse(raw);
            state = { ...DEFAULT_DATA, ...parsed };
            log("DATA", "Estado cargado", state);
        } catch (e) {
            log("DATA", "Error al cargar, usando default", e);
            state = JSON.parse(JSON.stringify(DEFAULT_DATA));
        }
    }
    recalcularMetaDiaria();
};

export const saveData = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    log("DATA", "Estado guardado");
};

export const getState = () => state;
export const getTurnoActivo = () => state.turnoActivo;

export const recalcularMetaDiaria = () => {
    const fijos = state.gastosFijosMensuales.reduce((acc, i) => acc + (safeNumber(i.monto) / (DIAS_POR_FRECUENCIA[i.frecuencia] || 30)), 0);
    const deudas = state.deudas.reduce((acc, d) => d.saldo > 0 ? acc + (safeNumber(d.montoCuota) / (DIAS_POR_FRECUENCIA[d.frecuencia] || 30)) : acc, 0);
    state.parametros.gastoFijo = fijos + deudas;
    saveData();
};

export const iniciarTurnoLogic = () => {
    if (state.turnoActivo) return false;
    state.turnoActivo = { inicio: new Date().toISOString() };
    saveData();
    log("TURNO", "Iniciado", state.turnoActivo);
    return true;
};

export const finalizarTurnoLogic = (ganancia, kmFinal = 0) => {
    if (!state.turnoActivo) return;
    const fin = new Date();
    const g = safeNumber(ganancia);
    state.turnos.push({
        fecha: fin.toISOString(),
        inicio: state.turnoActivo.inicio,
        fin: fin.toISOString(),
        horas: (fin - new Date(state.turnoActivo.inicio)) / 36e5,
        ganancia: g,
        kmFinal: safeNumber(kmFinal)
    });
    state.movimientos.push({ tipo: 'ingreso', fecha: fin.toISOString(), desc: 'Turno', monto: g });
    if (safeNumber(kmFinal) > 0) state.parametros.ultimoKM = safeNumber(kmFinal);
    state.turnoActivo = null;
    saveData();
    log("TURNO", "Finalizado");
};

export const eliminarGastoFijo = (index) => {
    state.gastosFijosMensuales.splice(index, 1);
    recalcularMetaDiaria();
};

export const agregarGasto = (g) => {
    state.movimientos.push({ tipo: 'gasto', fecha: g.fecha, desc: g.categoria, monto: g.monto });
    saveData();
};

export const agregarDeuda = (d) => {
    state.deudas.push(d);
    recalcularMetaDiaria();
};
