/* 02_data.js - Lógica de Negocio y Estado */
import { DIAS_POR_FRECUENCIA, safeNumber, STORAGE_KEY } from './01_consts_utils.js';

const DEFAULT_PANEL_DATA = {
  ingresos: [], gastos: [], turnos: [], movimientos: [], cargasCombustible: [], deudas: [],
  gastosFijosMensuales: [], 
  parametros: {
    deudaTotal: 0, 
    gastoFijo: 0, 
    ultimoKMfinal: 0, 
    costoPorKm: 0,
    mantenimientoBase: { 'Aceite (KM)': 3000, 'Bujía (KM)': 8000, 'Llantas (KM)': 15000 }
  }
};

// Estado en memoria
let panelData = JSON.parse(JSON.stringify(DEFAULT_PANEL_DATA));
let turnoActivo = JSON.parse(localStorage.getItem("turnoActivo")) || false;

// --- Getters y Setters Básicos ---

export const getState = () => panelData;

export const saveData = () => { 
    localStorage.setItem(STORAGE_KEY, JSON.stringify(panelData)); 
    if(turnoActivo) localStorage.setItem("turnoActivo", JSON.stringify(turnoActivo));
};

export const loadData = () => {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) { 
        try { 
            const parsed = JSON.parse(data);
            panelData = { ...DEFAULT_PANEL_DATA, ...parsed, parametros: { ...DEFAULT_PANEL_DATA.parametros, ...parsed.parametros } }; 
        } catch (e) { 
            console.error("Error cargando datos", e); 
        } 
    }
    validarYArreglarDatos();
};

// --- Lógica de Negocio (Core) ---

function getDailyDebtContribution() {
    let totalDiario = 0;
    if (!panelData.deudas) return 0;
    
    panelData.deudas.forEach(d => {
        const montoCuota = safeNumber(d.montoCuota);
        if (montoCuota > 0 && d.saldo > 0) {
            const dias = DIAS_POR_FRECUENCIA[d.frecuencia] || 30;
            if (dias > 0) {
                totalDiario += montoCuota / dias;
            }
        }
    });
    return totalDiario;
}

export function recalcularMetaDiaria() {
    // 1. GASTOS FIJOS
    const cuotaFijosDiaria = (panelData.gastosFijosMensuales || []).reduce((dailySum, g) => {
        const days = DIAS_POR_FRECUENCIA[g.frecuencia] || 30; 
        const costPerDay = safeNumber(g.monto) / days; 
        return dailySum + costPerDay;
    }, 0); 
    
    // 2. DEUDAS
    const cuotaDeudasDiaria = getDailyDebtContribution();

    // 3. META TOTAL
    const metaTotal = cuotaFijosDiaria + cuotaDeudasDiaria;
    
    panelData.parametros.gastoFijo = metaTotal; 
    saveData();
    
    // Nota: La actualización visual ocurre en renderMetaDiaria (03_render.js)
    return metaTotal;
}

function validarYArreglarDatos() {
  ['ingresos', 'gastos', 'deudas', 'movimientos', 'turnos', 'cargasCombustible', 'gastosFijosMensuales'].forEach(k => {
    if (!Array.isArray(panelData[k])) panelData[k] = [];
  });
  
  if (!panelData.parametros) panelData.parametros = DEFAULT_PANEL_DATA.parametros;
  panelData.parametros.ultimoKMfinal = safeNumber(panelData.parametros.ultimoKMfinal);
  
  recalcularMetaDiaria();
  // calcularMetricasCombustible se invoca en render, aquí solo aseguramos estructura
  saveData();
}

// --- Métodos de Acción (Puente para 03_render.js) ---

export const agregarDeuda = (deudaObj) => {
    panelData.deudas.push(deudaObj);
    recalcularMetaDiaria(); // Guarda automáticamente
};

export const agregarMovimiento = (mov) => {
    panelData.movimientos.push(mov);
    saveData();
};

export const getTurnoActivo = () => turnoActivo;

// Exportación para uso externo si fuera necesario restaurar
export const importarDesdeJson = (jsonString) => {
    try {
        const parsed = JSON.parse(jsonString);
        panelData = { ...DEFAULT_PANEL_DATA, ...parsed };
        validarYArreglarDatos();
        return true;
    } catch (e) {
        return false;
    }
};

