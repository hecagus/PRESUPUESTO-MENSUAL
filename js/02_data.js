// 02_data.js
import { STORAGE_KEY, DIAS_POR_FRECUENCIA, safeNumber } from './01_consts_utils.js';

const DEFAULT_DATA = {
    ingresos: [], gastos: [], turnos: [], movimientos: [], 
    cargasCombustible: [], deudas: [], gastosFijosMensuales: [],
    parametros: {
        deudaTotal: 0, gastoFijo: 0, ultimoKM: 0, costoPorKm: 0,
        mantenimientoBase: { 'Aceite': 3000, 'Bujía': 8000, 'Llantas': 15000 }
    }
};

let state = JSON.parse(JSON.stringify(DEFAULT_DATA));
let turnoActivo = JSON.parse(localStorage.getItem("turnoActivo")) || null;

// --- PERSISTENCIA ---
export const loadData = () => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
        try { state = { ...state, ...JSON.parse(raw) }; } catch (e) { console.error(e); }
    }
    // Asegurar arrays
    ['ingresos','gastos','turnos','movimientos','cargasCombustible','deudas','gastosFijosMensuales'].forEach(k => {
        if (!Array.isArray(state[k])) state[k] = [];
    });
    state.parametros.ultimoKM = safeNumber(state.parametros.ultimoKM);
    recalcularMetaDiaria(); 
};

export const saveData = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
export const getState = () => state;
export const getTurnoActivo = () => turnoActivo;

// --- META DIARIA BLINDADA ---
export const recalcularMetaDiaria = () => {
    const fijos = state.gastosFijosMensuales.reduce((acc, i) => acc + (safeNumber(i.monto) / (DIAS_POR_FRECUENCIA[i.frecuencia]||30)), 0);
    const deudas = state.deudas.reduce((acc, d) => (d.saldo > 0 ? acc + (safeNumber(d.montoCuota) / (DIAS_POR_FRECUENCIA[d.frecuencia]||30)) : acc), 0);
    state.parametros.gastoFijo = fijos + deudas;
    saveData();
    return state.parametros.gastoFijo;
};

// --- TURNOS ---
export const iniciarTurnoLogic = () => {
    if (turnoActivo) return false;
    turnoActivo = { inicio: new Date().toISOString() };
    localStorage.setItem("turnoActivo", JSON.stringify(turnoActivo));
    return true;
};

export const finalizarTurnoLogic = (ganancia) => {
    if (!turnoActivo) return;
    const fin = new Date();
    const nuevoTurno = {
        fecha: fin.toISOString(), inicio: turnoActivo.inicio, fin: fin.toISOString(),
        horas: (fin - new Date(turnoActivo.inicio)) / 36e5, ganancia: safeNumber(ganancia)
    };
    state.turnos.push(nuevoTurno);
    turnoActivo = null;
    localStorage.removeItem("turnoActivo");
    saveData();
};

// --- VEHÍCULO Y ODÓMETRO (NUEVO) ---
export const actualizarOdometroManual = (kmInput) => {
    const nuevoKM = safeNumber(kmInput);
    const actualKM = state.parametros.ultimoKM;

    if (nuevoKM <= 0) return false;
    
    // Regla: Si es el primer uso (actualKM 0), permitimos cualquier valor.
    // Si ya hay historial, el nuevo KM debe ser mayor o igual al anterior.
    if (actualKM > 0 && nuevoKM < actualKM) {
        alert(`Error: El odómetro no puede bajar. Actual: ${actualKM}`);
        return false;
    }

    state.parametros.ultimoKM = nuevoKM;
    saveData();
    return true;
};

export const registrarCargaGasolina = (litros, costo, km) => {
    // Si meten KM en gasolina, también actualizamos el global
    actualizarOdometroManual(km); 
    state.cargasCombustible.push({
        fecha: new Date().toISOString(), litros: safeNumber(litros), costo: safeNumber(costo), km: safeNumber(km)
    });
    saveData();
};

// --- DEUDAS ---
export const agregarDeuda = (deuda) => { state.deudas.push(deuda); recalcularMetaDiaria(); saveData(); };
