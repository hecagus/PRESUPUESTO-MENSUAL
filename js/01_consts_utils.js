/* V10 - Constantes y utilidades puras */
export const STORAGE_KEY = 'moto_finanzas_vFinal';
export const LEGACY_KEYS = ['moto_finanzas_v3', 'moto_finanzas', 'app_moto_data'];
export const SCHEMA_VERSION = 10;

export const FRECUENCIAS = Object.freeze({
  Diario: 1, Semanal: 7, Quincenal: 15, Mensual: 30,
  Bimestral: 60, Anual: 365, Unico: 0
});

export const MAPA_DIAS = Object.freeze({ 1:1, 2:2, 3:3, 4:4, 5:5, 6:6, 0:7 });
export const DIAS_SEMANA = Object.freeze([
  {val:'', txt:'Seleccionar...'}, {val:'1', txt:'Lunes'}, {val:'2', txt:'Martes'},
  {val:'3', txt:'Miércoles'}, {val:'4', txt:'Jueves'}, {val:'5', txt:'Viernes'},
  {val:'6', txt:'Sábado'}, {val:'0', txt:'Domingo'}
]);

export const CATEGORIAS_BASE = Object.freeze({
  operativo: ['Gasolina', 'Mantenimiento', 'Reparación', 'Equipo', 'Seguro'],
  hogar: ['Renta', 'Comida', 'Servicios', 'Internet', 'Salud', 'Deudas', 'Otro', 'Ahorro', 'Meta']
});

export const $ = id => document.getElementById(id);
export const safeFloat = value => {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : 0;
};
export const fmtMoney = value => new Intl.NumberFormat('es-MX', {
  style: 'currency', currency: 'MXN'
}).format(safeFloat(value));
export const uuid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
export const isToday = value => {
  const d = new Date(value); const h = new Date();
  return !Number.isNaN(d.getTime()) && d.getFullYear() === h.getFullYear() && d.getMonth() === h.getMonth() && d.getDate() === h.getDate();
};
export const normalizeWeekDay = value => Number(value) === 0 ? 7 : Number(value || 7);
export const isGasReserve = sobre => Boolean(sobre && sobre.categoria === 'Operativo' && /gas|combustible/i.test(String(sobre.desc || '')));
