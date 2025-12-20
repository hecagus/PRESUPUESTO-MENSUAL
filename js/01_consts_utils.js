/* 01_consts_utils.js - Configuración y Utilidades */

export const STORAGE_KEY = "panelData";
export const TUTORIAL_VIEWED_KEY = "tutorialViewed";

// Selector seguro (Short-hand)
export const $ = id => document.getElementById(id);

// Configuración de Frecuencias
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
    { title: "Turnos y KM", text: "Usa 'Iniciar Turno' al salir y 'Finalizar Turno' al regresar. El KM se enlaza automáticamente para calcular tu consumo.", button: "Siguiente" },
    { title: "Gasolina y Costos", text: "La primera vez que uses el Asistente de Carga de Gasolina (3 Pasos), ¡activarás tu métrica de Costo Real por KM!", button: "Siguiente" },
    { title: "Gastos Inteligentes", text: "Clasifica tus gastos como Operativos (Moto) o Personales (Hogar). También podrás definir gastos recurrentes (Netflix, Renta).", button: "Siguiente" },
    { title: "Obligaciones y Metas", text: "Tus gastos fijos y deudas crean una 'Meta Diaria'. ¡Asegúrate de superarla para ahorrar y pagar tus compromisos!", button: "Finalizar" }
];

// --- Helpers de Formato y Validación ---

export function safeNumber(v) { 
    const n = Number(v); 
    return Number.isFinite(n) ? n : 0; 
}

export function fmtMoney(n) { 
    return safeNumber(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ","); 
}

export function formatearFecha(d) { 
    // Asegura manejo de strings ISO o objetos Date
    const dateObj = new Date(d);
    // Ajuste simple de zona horaria local para visualización correcta
    return dateObj.toLocaleDateString(); 
}

// Utilidad requerida por 03_render.js (No estaba en app.js, agregada por necesidad de importación)
export function isSameDay(d1, d2) {
    const a = new Date(d1);
    const b = new Date(d2);
    return a.getFullYear() === b.getFullYear() &&
           a.getMonth() === b.getMonth() &&
           a.getDate() === b.getDate();
}

