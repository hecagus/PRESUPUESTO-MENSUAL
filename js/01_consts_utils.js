/* 01_consts_utils.js */

export const STORAGE_KEY = "panelData";

// Selector Seguro
export const $ = (id) => document.getElementById(id);

// Matemáticas de Tiempo
export const DIAS_POR_FRECUENCIA = {
    'Diario': 1,
    'Semanal': 7,
    'Quincenal': 15,
    'Mensual': 30,
    'Bimestral': 60,
    'Anual': 365,
    'No Recurrente': 0
};

// Categorías
export const CATEGORIAS_GASTOS = {
    moto: [
        "Gasolina", 
        "Mantenimiento", 
        "Reparación Mecánica", 
        "Llantas/Frenos",
        "Peajes/Casetas", 
        "Lavado", 
        "Seguro", 
        "Accesorios",
        "Otro"
    ],
    hogar: [
        "Renta",
        "Comida", 
        "Despensa", 
        "Luz/Agua/Gas", 
        "Internet/Teléfono", 
        "Salud",
        "Personal", 
        "Diversión",
        "Deudas",
        "Otro"
    ]
};

// Helpers
export function safeNumber(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}

export function fmtMoney(n) {
    return safeNumber(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function formatearFecha(d) {
    if (!d) return "-";
    const dateObj = new Date(d);
    return dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
}

export function isSameDay(d1, d2) {
    const date1 = new Date(d1);
    const date2 = new Date(d2);
    return date1.getDate() === date2.getDate() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getFullYear() === date2.getFullYear();
}
