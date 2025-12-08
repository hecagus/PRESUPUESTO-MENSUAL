// 01_consts_utils.js
export const STORAGE_KEY = "panelData";
export const TUTORIAL_VIEWED_KEY = "tutorialViewed";
export const $ = (id) => document.getElementById(id);

// CONFIGURACIÓN DE FRECUENCIAS
export const DIAS_POR_FRECUENCIA = {
    'Diario': 1,        // <--- NUEVO: Divide el monto entre 1 (Impacto total diario)
    'Semanal': 7,       // Divide entre 7
    'Quincenal': 15,    // Divide entre 15
    'Mensual': 30,      // Divide entre 30
    'Bimestral': 60,    // Divide entre 60
    'Anual': 365,       // Divide entre 365
    'No Recurrente': 0
};

export const CATEGORIAS_GASTOS = {
    moto: [
        "Gasolina Extra", "Mecánico / Reparación", "Talachero / Llantas", 
        "Casco / Equipo", "Aceite / Mantenimiento", "Seguro Moto", "Lavado",
        "➕ Otro / Nuevo..."
    ],
    hogar: [
        "Comida / Despensa", "Agua de Garrafón / Pan", "Renta", 
        "Luz (CFE)", "Agua (Servicio)", "Internet", 
        "Suscripción (Gemini/Netflix)", "Celular / Plan",
        "Salud / Farmacia", "Diversión",
        "➕ Otro / Nuevo..."
    ]
};

// Helpers de formato
export const safeNumber = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
export const fmtMoney = (n) => safeNumber(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
export const formatearFecha = (d) => new Date(d).toLocaleDateString();
