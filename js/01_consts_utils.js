// 01_consts_utils.js
export const STORAGE_KEY = "panelData";
export const TUTORIAL_VIEWED_KEY = "tutorialViewed";

// Selector seguro (Safe DOM Selector)
export const $ = (id) => document.getElementById(id);

// Configuración de Frecuencias para cálculos
export const DIAS_POR_FRECUENCIA = {
    'Diario': 1,
    'Semanal': 7,
    'Quincenal': 15,
    'Mensual': 30,
    'Bimestral': 60,
    'No Recurrente': 0
};

export const CATEGORIAS_GASTOS = {
    moto: ["Mantenimiento", "Reparación", "Llantas", "Peajes", "Lavado", "Seguro", "Otros"],
    hogar: ["Comida", "Despensa", "Renta", "Servicios", "Internet", "Salud", "Diversión", "Otros"]
};

// Helpers de Formato y Validación
export const safeNumber = (v) => { 
    const n = Number(v); 
    return Number.isFinite(n) ? n : 0; 
};

export const fmtMoney = (n) => {
    return safeNumber(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

export const formatearFecha = (d) => {
    return new Date(d).toLocaleDateString();
};

export const log = (msg) => console.log(`[System]: ${msg}`);
