import { STORAGE_KEY, DIAS_POR_FRECUENCIA, safeNumber, log } from './01_consts_utils.js';

const DEFAULT_DATA = {
    turnos: [],
    movimientos: [],
    gastosFijosMensuales: [],
    deudas: [],
    parametros: { gastoFijo: 0, ultimoKM: 0 },
    turnoActivo: null // ✅ unificado
};

let state = structuredClone(DEFAULT_DATA);

// ---------------- PERSISTENCIA ----------------
export const loadData = () => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
        try {
            state = { ...DEFAULT_DATA, ...JSON.parse(raw) };
            log("DATA", "Estado cargado", state);
        } catch {
            state = structuredClone(DEFAULT_DATA);
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

// ---------------- CORE ----------------
export const recalcularMetaDiaria = () => {
    const fijos = state.gastosFijosMensuales.reduce(
        (a, i) => a + safeNumber(i.monto) / (DIAS_POR_FRECUENCIA[i.frecuencia] || 30),
        0
    );
    const deudas = state.deudas.reduce(
        (a, d) =>
            d.saldo > 0
                ? a + safeNumber(d.montoCuota) / (DIAS_POR_FRECUENCIA[d.frecuencia] || 30)
                : a,
        0
    );
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

export const finalizarTurnoLogic = (ganancia, kmFinal) => {
    if (!state.turnoActivo) return;
    const fin = new Date();
    state.turnos.push({
        fecha: fin.toISOString(),
        horas: (fin - new Date(state.turnoActivo.inicio)) / 36e5,
        ganancia: safeNumber(ganancia),
        kmFinal: safeNumber(kmFinal)
    });
    state.movimientos.push({
        tipo: 'ingreso',
        fecha: fin.toISOString(),
        desc: 'Turno',
        monto: safeNumber(ganancia)
    });
    state.turnoActivo = null;
    saveData();
    log("TURNO", "Finalizado");
};

export const agregarGastoFijo = (g) => {
    state.gastosFijosMensuales.push(g);
    recalcularMetaDiaria();
};
