// 02_data.js
import { STORAGE_KEY, DIAS_POR_FRECUENCIA, safeNumber } from './01_consts_utils.js';

const DEFAULT_DATA = { /* ... omitted for brevity ... */ }; // Asume la estructura existente

let state = JSON.parse(JSON.stringify(DEFAULT_DATA));
let turnoActivo = JSON.parse(localStorage.getItem("turnoActivo")) || null;

// --- Funciones Internas necesarias para la Importación ---
const calcularCostoPorKm = () => { /* ... (mismo código de cálculo que ya funciona) ... */
    const cargas = state.cargasCombustible;
    if (cargas.length < 2) { state.parametros.costoPorKm = 0; return 0; }
    const cargasOrdenadas = [...cargas].sort((a, b) => safeNumber(a.km) - safeNumber(b.km));
    const kmTotalRecorrido = safeNumber(cargasOrdenadas[cargasOrdenadas.length - 1].km) - safeNumber(cargasOrdenadas[0].km);
    if (kmTotalRecorrido <= 0) { state.parametros.costoPorKm = 0; return 0; }
    const costoTotal = cargas.reduce((sum, carga) => sum + safeNumber(carga.costo), 0);
    const costoPorKm = costoTotal / kmTotalRecorrido;
    state.parametros.costoPorKm = costoPorKm;
    return costoPorKm;
};

// --- SETTER DE ESTADO (Para la restauración) ---
const setState = (newData) => {
    state = { ...state, ...newData };
    // Recalcular métricas después de sobreescribir el estado
    recalcularMetaDiaria();
    calcularCostoPorKm();
    saveData();
};

// --- PERSISTENCIA Y GETTERS ---
export const loadData = () => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) { try { setState(JSON.parse(raw)); } catch (e) { console.error(e); } }
    // Asegurar arrays y tipos después de la carga
    ['ingresos','gastos','turnos','movimientos','cargasCombustible','deudas','gastosFijosMensuales'].forEach(k => { if (!Array.isArray(state[k])) state[k] = []; });
    state.parametros.ultimoKM = safeNumber(state.parametros.ultimoKM);
    // Nota: setState llama a recalcularMetaDiaria y calcularCostoPorKm
};
export const saveData = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
export const getState = () => state;
export const getTurnoActivo = () => turnoActivo;


// --- LÓGICA CRÍTICA: RESPALDO Y RESTAURACIÓN (NUEVO) ---

export const exportarJsonLogic = () => {
    // Retorna el estado actual en formato JSON (Lógica Pura)
    return JSON.stringify(state);
};

export const importarJsonLogic = (jsonString) => {
    try {
        const newData = JSON.parse(jsonString);
        // Validación mínima
        if (typeof newData !== 'object' || !newData.parametros) {
            console.error("Estructura JSON no válida o faltan parámetros críticos.");
            return false;
        }
        setState(newData); // Sobrescribir estado y recalcular
        return true;
    } catch (e) {
        console.error("Error al parsear JSON:", e);
        return false;
    }
};

// --- (Resto de funciones: recalcularMetaDiaria, iniciarTurnoLogic, etc., se mantienen igual) ---

// *Nota: Para mantener la brevedad, se omite el resto del código inalterado de 02_data.js*
