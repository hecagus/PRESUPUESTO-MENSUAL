export const STORAGE_KEY = "panelData";
export const TUTORIAL_VIEWED_KEY = "tutorialViewed";

export const $ = id => document.getElementById(id);

export const DIAS_POR_FRECUENCIA = {
  Diario: 1,
  Semanal: 7,
  Quincenal: 15,
  Mensual: 30,
  Bimestral: 60,
  "No Recurrente": null
};

export function safeNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function fmtMoney(n) {
  return safeNumber(n).toFixed(2);
}

export function formatearFecha(d) {
  const date = new Date(d);
  return isNaN(date) ? "-" : date.toLocaleDateString();
}

export function isSameDay(a, b) {
  const x = new Date(a), y = new Date(b);
  return x.toDateString() === y.toDateString();
}
