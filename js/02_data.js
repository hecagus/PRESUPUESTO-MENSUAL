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
    // Asegurar números
    state.parametros.ultimoKM = safeNumber(state.parametros.ultimoKM);
    recalcularMetaDiaria();
};

export const saveData = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
export const getState = () => state;
export const getTurnoActivo = () => turnoActivo;

// --- META DIARIA ---
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
    const t = { 
        fecha: fin.toISOString(), 
        inicio: turnoActivo.inicio, 
        fin: fin.toISOString(), 
        horas: (fin - new Date(turnoActivo.inicio)) / 36e5, 
        ganancia: safeNumber(ganancia) 
    };
    state.turnos.push(t);
    if (t.ganancia > 0) {
        state.movimientos.push({ tipo: 'ingreso', fecha: fin.toISOString(), desc: 'Cierre Turno', monto: t.ganancia });
    }
    turnoActivo = null; 
    localStorage.removeItem("turnoActivo"); 
    saveData();
};

// --- VEHÍCULO ---
export const actualizarOdometroManual = (kmInput) => {
    const nk = safeNumber(kmInput);
    if (state.parametros.ultimoKM > 0 && nk < state.parametros.ultimoKM) { 
        alert(`Error: El odómetro no puede bajar (Actual: ${state.parametros.ultimoKM}).`); 
        return false; 
    }
    state.parametros.ultimoKM = nk; 
    saveData(); 
    return true;
};

export const registrarCargaGasolina = (l, c, km) => {
    actualizarOdometroManual(km);
    state.cargasCombustible.push({ fecha: new Date().toISOString(), litros: safeNumber(l), costo: safeNumber(c), km: safeNumber(km) });
    saveData();
};

// --- CRUD ---
export const agregarDeuda = (d) => { state.deudas.push(d); recalcularMetaDiaria(); saveData(); };
export const agregarGasto = (g) => { 
    state.gastos.push(g); 
    state.movimientos.push({ tipo: 'gasto', fecha: g.fecha, desc: `${g.categoria} (${g.desc||''})`, monto: g.monto });
    saveData(); 
};
export const agregarGastoFijo = (gf) => {
    state.gastosFijosMensuales.push({ id: gf.id, categoria: gf.categoria, monto: gf.monto, frecuencia: gf.frecuencia, desc: gf.desc });
    state.movimientos.push({ tipo: 'gasto', fecha: gf.fecha, desc: `Alta Fijo: ${gf.categoria}`, monto: gf.monto });
    recalcularMetaDiaria();
};

// --- IMPORTAR / EXPORTAR (NUEVO) ---
export const importarDatosJSON = (jsonString) => {
    try {
        const newData = JSON.parse(jsonString);
        if (!newData.parametros) throw new Error("Formato inválido");
        state = { ...DEFAULT_DATA, ...newData }; // Merge seguro
        saveData();
        return true;
    } catch (e) {
        return false;
    }
};

export const obtenerDatosCompletos = () => state;
