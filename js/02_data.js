import { STORAGE_KEY, OLD_KEY, safeNumber } from './01_consts_utils.js';

// Estado Base por defecto
const BASE_STATE = {
    turno: null,
    gastos: [],
    deudas: [
        { id: 1, nombre: 'Moto', saldo: 13919, pago: 0 },
        { id: 2, nombre: 'Uber Pro Card', saldo: 516, pago: 0 }
    ],
    gasolina: [],
    ingresos: [],
    kmActual: 0,
    mantenimiento: { aceite: 0, frenos: 0 }
};

let state = structuredClone(BASE_STATE);

/* ===== PERSISTENCIA Y MIGRACIÓN ===== */
export const loadData = () => {
    // 1. MIGRACIÓN: Si no hay datos nuevos, busca los viejos
    if (!localStorage.getItem(STORAGE_KEY)) {
        const old = localStorage.getItem(OLD_KEY);
        if (old) {
            console.log("Migrando datos antiguos...");
            localStorage.setItem(STORAGE_KEY, old);
        }
    }

    // 2. CARGA NORMAL
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
        try {
            state = { ...BASE_STATE, ...JSON.parse(raw) };
        } catch (e) {
            console.error("Error cargando datos, reiniciando state", e);
        }
    }
    return state;
};

export const saveData = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

export const getState = () => state;

/* ===== LÓGICA DE NEGOCIO ===== */
export const iniciarTurno = () => {
    state.turno = { inicio: Date.now(), kmInicio: state.kmActual };
    saveData();
    return state.turno;
};

export const finalizarTurno = (ganancia, kmFinal) => {
    state.kmActual = safeNumber(kmFinal);
    state.ingresos.push(safeNumber(ganancia));
    state.turno = null;
    saveData();
};

export const agregarGasto = (tipo, categoria, monto, esRecurrente, fecha) => {
    state.gastos.push({
        tipo,
        categoria,
        monto: safeNumber(monto),
        fecha: esRecurrente ? fecha : null
    });
    saveData();
};

export const agregarGasolina = (km, litros, costo) => {
    state.gasolina.push({
        km: safeNumber(km),
        litros: safeNumber(litros),
        costo: safeNumber(costo)
    });
    if (safeNumber(km) > state.kmActual) state.kmActual = safeNumber(km);
    saveData();
};

export const agregarDeuda = (nombre, total, pago, fecha) => {
    state.deudas.push({
        nombre,
        saldo: safeNumber(total),
        pago: safeNumber(pago),
        fecha,
        abonos: []
    });
    saveData();
};

export const guardarUmbrales = (aceite, frenos) => {
    state.mantenimiento = { aceite: safeNumber(aceite), frenos: safeNumber(frenos) };
    saveData();
};

// Fórmula: (Gastos Recurrentes + Deudas) / 6 días laborables
export const calcularMetaDiaria = () => {
    const gastosRecurrentes = state.gastos.filter(g => g.fecha).reduce((a, b) => a + b.monto, 0);
    const pagosDeudas = state.deudas.reduce((a, b) => a + (b.pago || 0), 0);
    return (gastosRecurrentes + pagosDeudas) / 6;
};

