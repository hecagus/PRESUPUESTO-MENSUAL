/* 01_consts_utils.js */
export const STORAGE_KEY = "panelData";

export const $ = (id) => document.getElementById(id);

export const DIAS_POR_FRECUENCIA = {
  Diario: 1,
  Semanal: 7,
  Quincenal: 15,
  Mensual: 30,
  Bimestral: 60,
  Anual: 365
};

export const CATEGORIAS_GASTOS = {
  moto: ["Gasolina", "Mantenimiento", "Reparación", "Llantas", "Seguro", "Otro"],
  hogar: ["Renta", "Comida", "Servicios", "Internet", "Salud", "Deudas", "Otro"]
};

export const safeNumber = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const fmtMoney = (n) =>
  safeNumber(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

export const formatearFecha = (d) => {
  if (!d) return "-";
  const dt = new Date(d);
  return (
    dt.toLocaleDateString() +
    " " +
    dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  );
};

export const isSameDay = (d1, d2) => {
  const a = new Date(d1);
  const b = new Date(d2);
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
};
