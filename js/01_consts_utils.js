export const STORAGE_KEY = "panelData";
export const TUTORIAL_VIEWED_KEY = "tutorialViewed";

export const $ = (id) => document.getElementById(id);

export const DIAS_POR_FRECUENCIA = {
    'Diario': 1,
    'Semanal': 7,
    'Quincenal': 15,
    'Mensual': 30,
    'Bimestral': 60,
    'No Recurrente': 0
};

export const CATEGORIAS_GASTOS = {
    moto: ["Mantenimiento", "Reparación", "Llantas", "Peajes", "Lavado", "Accesorios", "Seguro", "Otros"],
    hogar: ["Comida", "Despensa", "Renta", "Servicios", "Internet", "Celular", "Salud", "Ropa", "Diversión", "Otros"]
};

// Helpers de formato
export const safeNumber = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
export const fmtMoney = (n) => safeNumber(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
export const formatearFecha = (d) => new Date(d).toLocaleDateString();
