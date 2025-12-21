/* 01_consts_utils.js */

export const STORAGE_KEY = "panelData";
export const TUTORIAL_VIEWED_KEY = "tutorialViewed";

// Selector Seguro (Short-hand)
export const $ = (id) => document.getElementById(id);

// Configuración de Frecuencias (Días divisor)
export const DIAS_POR_FRECUENCIA = {
    'Diario': 1,
    'Semanal': 7,
    'Quincenal': 15,
    'Mensual': 30,
    'Bimestral': 60,
    'No Recurrente': 0
};

// Categorías de Gastos
export const CATEGORIAS_GASTOS = {
    moto: [
        "Mantenimiento (Aceite/Filtros)", "Reparación Mecánica", "Llantas/Frenos",
        "Peajes/Casetas", "Lavado/Limpieza", "Accesorios/Equipo", "Seguro/Trámites", "✏️ Otra / Nueva..."
    ],
    hogar: [
        "Comida del día (Calle)", "Despensa/Supermercado", "Renta/Alquiler",
        "Luz/Agua/Gas", "Internet/Streaming", "Celular/Datos", "Salud/Farmacia",
        "Ropa/Personal", "Diversión/Salidas", "✏️ Otra / Nueva..."
    ]
};

// Pasos del Tutorial
export const TUTORIAL_STEPS = [
    { title: "¡Bienvenido/a!", text: "Esta guía rápida te mostrará cómo usar el nuevo sistema de rastreo avanzado.", button: "Comenzar" },
    { title: "Turnos y Odómetro", text: "Usa 'Iniciar Turno' al salir y 'Finalizar Turno' al regresar. El KM se enlaza automáticamente.", button: "Siguiente" },
    { title: "Gasolina y Costos", text: "Registra cargas de gasolina para activar tu métrica de Costo Real por KM.", button: "Siguiente" },
    { title: "Gastos Inteligentes", text: "Clasifica tus gastos (Moto vs Hogar) y define recurrentes para automatizar tu presupuesto.", button: "Siguiente" },
    { title: "Meta Diaria", text: "El sistema calculará cuánto debes ganar hoy para cubrir tus gastos fijos y deudas.", button: "Finalizar" }
];

// --- Helpers Puros ---

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
    return dateObj.toLocaleDateString();
}

export function isSameDay(d1, d2) {
    const date1 = new Date(d1);
    const date2 = new Date(d2);
    return date1.getDate() === date2.getDate() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getFullYear() === date2.getFullYear();
}
