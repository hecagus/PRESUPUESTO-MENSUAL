// 01_consts_utils.js
export const STORAGE_KEY = "panelData";
export const TUTORIAL_VIEWED_KEY = "tutorialViewed";
export const $ = (id) => document.getElementById(id);

export const DIAS_POR_FRECUENCIA = {
    'Diario': 1,
    'Semanal': 7,
    'Quincenal': 15,
    'Mensual': 30,
    'Bimestral': 60,
    'Anual': 365,
    'No Recurrente': 0
};

// TUS NUEVAS CATEGORÍAS
export const CATEGORIAS_GASTOS = {
    moto: [
        "Gasolina Extra", 
        "Mecánico / Reparación", 
        "Talachero / Llantas", 
        "Casco / Equipo", 
        "Aceite / Mantenimiento", 
        "Seguro Moto", 
        "Lavado",
        "➕ Otro / Nuevo..." // Opción especial
    ],
    hogar: [
        "Comida / Despensa", 
        "Agua de Garrafón / Pan", 
        "Renta", 
        "Luz (CFE)", 
        "Agua (Servicio)", 
        "Internet", 
        "Suscripción (Gemini/Netflix)", 
        "Celular / Plan",
        "Salud / Farmacia",
        "Diversión",
        "➕ Otro / Nuevo..." // Opción especial
    ]
};

// Helpers
export const safeNumber = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
export const fmtMoney = (n) => safeNumber(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
export const formatearFecha = (d) => new Date(d).toLocaleDateString();
