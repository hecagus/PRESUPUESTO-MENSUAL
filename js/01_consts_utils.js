export const STORAGE_KEY = "panelData_vFinal";
export const $ = (id) => document.getElementById(id);

// Configuración de Depuración
export const DEBUG_MODE = true; 
export const log = (scope, action, data = null) => {
    if (!DEBUG_MODE) return;
    console.log(`%c[${scope}] ${action}`, "color:#2563eb;font-weight:bold", data ?? "");
};

export const DIAS_POR_FRECUENCIA = {
    'Diario': 1, 'Semanal': 7, 'Quincenal': 15,
    'Mensual': 30, 'Bimestral': 60, 'Anual': 365, 'No Recurrente': 0
};

export const CATEGORIAS_GASTOS = {
    moto: ["Gasolina Extra", "Refacciones", "Mecánico", "Llantas", "Equipo", "Seguro", "Lavado", "➕ Otro..."],
    hogar: ["Comida", "Renta", "Servicios", "Internet", "Deudas", "Salud", "➕ Otro..."]
};

export const safeNumber = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};

export const fmtMoney = (n) => safeNumber(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
export const formatearFecha = (d) => new Date(d).toLocaleDateString();

export const isSameDay = (d1, d2) => {
    const a = new Date(d1); const b = new Date(d2);
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
};
