// 02_data.js
import { STORAGE_KEY, DIAS_POR_FRECUENCIA, safeNumber, log } from './01_consts_utils.js';

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
        try { state = { ...state, ...JSON.parse(raw) }; } catch (e) { log("Error carga datos"); }
    }
    // Asegurar arrays
    ['ingresos','gastos','turnos','movimientos','cargasCombustible','deudas','gastosFijosMensuales'].forEach(k => {
        if (!Array.isArray(state[k])) state[k] = [];
    });
    // Asegurar números
    state.parametros.ultimoKM = safeNumber(state.parametros.ultimoKM);
    
    recalcularMetaDiaria(); // Recálculo inicial
};

export const saveData = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
export const getState = () => state;
export const getTurnoActivo = () => turnoActivo;

// --- LÓGICA CRÍTICA: META DIARIA ---
export const recalcularMetaDiaria = () => {
    // 1. Gastos Fijos (Prorrateo diario)
    const gastoFijoDiario = state.gastosFijosMensuales.reduce((acc, item) => {
        const dias = DIAS_POR_FRECUENCIA[item.frecuencia] || 30; 
        return acc + (safeNumber(item.monto) / dias);
    }, 0);

    // 2. Aporte Diario a Deudas
    const aporteDeudaDiario = state.deudas.reduce((acc, d) => {
        if (d.saldo > 0 && safeNumber(d.montoCuota) > 0) {
            const dias = DIAS_POR_FRECUENCIA[d.frecuencia] || 30;
            return acc + (safeNumber(d.montoCuota) / dias);
        }
        return acc;
    }, 0);

    // 3. Total y Guardado
    const metaTotal = gastoFijoDiario + aporteDeudaDiario;
    state.parametros.gastoFijo = metaTotal;
    saveData();
    return metaTotal;
};

// --- MÓDULO TURNOS (Solo Tiempo y Dinero) ---
export const iniciarTurnoLogic = () => {
    if (turnoActivo) return false;
    turnoActivo = { inicio: new Date().toISOString() };
    localStorage.setItem("turnoActivo", JSON.stringify(turnoActivo));
    return true;
};

export const finalizarTurnoLogic = (gananciaInput) => {
    if (!turnoActivo) return;
    
    const fin = new Date();
    const inicio = new Date(turnoActivo.inicio);
    const horas = (fin - inicio) / 36e5; // Diferencia en horas
    const ganancia = safeNumber(gananciaInput);

    const nuevoTurno = {
        fecha: fin.toISOString(),
        inicio: turnoActivo.inicio,
        fin: fin.toISOString(),
        horas: horas,
        ganancia: ganancia
        // NOTA: NO guardamos KM aquí. Separación estricta.
    };

    state.turnos.push(nuevoTurno);

    // Registro automático de ingreso
    if (ganancia > 0) {
        state.movimientos.push({
            tipo: 'ingreso', fecha: fin.toISOString(), desc: 'Cierre de Turno', monto: ganancia
        });
    }

    turnoActivo = null;
    localStorage.removeItem("turnoActivo");
    saveData();
};

// --- MÓDULO VEHICULAR (Solo KM y Gasolina) ---
export const registrarCargaGasolina = (litros, costo, kmActual) => {
    const km = safeNumber(kmActual);
    
    // Validación de Odómetro
    if (km > 0 && km < state.parametros.ultimoKM) {
        alert("Error: El KM actual no puede ser menor al histórico.");
        return false;
    }

    state.cargasCombustible.push({
        fecha: new Date().toISOString(),
        litros: safeNumber(litros),
        costo: safeNumber(costo),
        km: km
    });

    if (km > 0) state.parametros.ultimoKM = km;
    
    // Cálculo simplificado de costo por KM (Histórico)
    // (Lógica más compleja iría aquí en versiones futuras)
    
    saveData();
    return true;
};

// --- CRUD GENERICS ---
export const agregarGasto = (gasto) => { 
    state.gastos.push(gasto); 
    state.movimientos.push(gasto); 
    saveData(); 
};

export const agregarDeuda = (deuda) => { 
    state.deudas.push(deuda); 
    recalcularMetaDiaria(); 
};
