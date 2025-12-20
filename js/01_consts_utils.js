export const STORAGE_KEY = 'uber_tracker_data';
export const OLD_KEY = 'PRESUPUESTO_DATA';

export const $ = (id) => document.getElementById(id);

export const safeNumber = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};

// Formato exacto solicitado: $0.00
export const fmtMoney = (n) => `$${(safeNumber(n)).toFixed(2)}`;

export const formatDate = (d) => new Date(d).toLocaleDateString();

