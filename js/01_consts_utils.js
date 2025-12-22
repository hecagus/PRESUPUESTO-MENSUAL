export const STORAGE_KEY = "moto_finanzas_v1";

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
    personal: ["Comida", "Hogar", "Personal", "Diversión", "Salud"]
};

// Selectores
export const $ = (sel) => document.querySelector(sel);
export const $$ = (sel) => document.querySelectorAll(sel);

// Formateadores
export const fmtMoney = (amount) => {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount || 0);
};

export const fmtDate = (isoString) => {
    if(!isoString) return '-';
    const d = new Date(isoString);
    return `${d.getDate()}/${d.getMonth()+1} ${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}`;
};

export const safeFloat = (val) => {
    const n = parseFloat(val);
    return isNaN(n) ? 0 : n;
};

// Generador de IDs únicos
export const uuid = () => Date.now().toString(36) + Math.random().toString(36).substr(2);
