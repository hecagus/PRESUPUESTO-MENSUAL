export const STORAGE_KEY = "moto_finanzas_prod_v1";

export const FRECUENCIAS = {
    'Diario': 1,
    'Semanal': 7,
    'Quincenal': 15,
    'Mensual': 30,
    'Bimestral': 60,
    'Anual': 365,
    'Unico': 0
};

export const CATEGORIAS = {
    operativo: ["Gasolina", "Mantenimiento", "Reparación", "Equipo", "Seguro"],
    hogar: ["Renta", "Comida", "Servicios", "Internet", "Salud", "Deudas", "Otro"]
};

export const $ = (sel) => document.querySelector(sel);

export const fmtMoney = (amount) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount || 0);

export const fmtDate = (iso) => {
    if(!iso) return '-';
    const d = new Date(iso);
    return `${d.getDate()}/${d.getMonth()+1} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
};

export const safeFloat = (val) => {
    const n = parseFloat(val);
    return isFinite(n) ? n : 0;
};

export const uuid = () => Date.now().toString(36) + Math.random().toString(36).substr(2);
