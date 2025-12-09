export const STORAGE_KEY = "panelData_vFinal"; 
export const $ = (id) => document.getElementById(id);

export const DIAS_POR_FRECUENCIA = {
    'Diario': 1, 'Semanal': 7, 'Quincenal': 15,
    'Mensual': 30, 'Bimestral': 60, 'Anual': 365, 'No Recurrente': 0
};

export const CATEGORIAS_GASTOS = {
    moto: ["Gasolina Extra", "Mecánico", "Llantas", "Equipo", "Seguro", "Lavado", "Otro"],
    hogar: ["Comida", "Renta", "Servicios", "Internet", "Deudas Personales", "Salud", "Otro"]
};

export const safeNumber = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
export const fmtMoney = (n) => safeNumber(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
export const formatearFecha = (d) => new Date(d).toLocaleDateString();
