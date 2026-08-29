/* v1.2.0 - Constantes y utilidades puras */
export const APP_VERSION = '1.2.0';
export const STORAGE_KEY = 'moto_finanzas_vFinal';
export const LEGACY_KEYS = ['moto_finanzas_v3', 'moto_finanzas', 'app_moto_data'];
export const SCHEMA_VERSION = 12;

export const WORK_TYPES = Object.freeze({
  jaimau: { label: 'Jaimau / Ingenico', compensation: 'quincenal', fuel: 'empresa' },
  uber: { label: 'Uber Eats', compensation: 'por_turno', fuel: 'personal' }
});

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
  operativo: ['Gasolina', 'Renta', 'Mantenimiento', 'Reparación', 'Equipo', 'Seguro'],
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
export const quincenaId = value => {
  const d = value instanceof Date ? value : new Date(value ?? Date.now());
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-Q${d.getDate()<=15?1:2}`;
};
export const quincenaLabel = value => {
  const d = value instanceof Date ? value : new Date(value ?? Date.now());
  const inicio=d.getDate()<=15?1:16;
  const fin=d.getDate()<=15?15:new Date(d.getFullYear(),d.getMonth()+1,0).getDate();
  return `${inicio}–${fin} ${d.toLocaleDateString('es-MX',{month:'short'})}`;
};
