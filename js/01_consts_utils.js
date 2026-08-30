/* v2.7.0 - Constantes, capacidades y utilidades puras. */
export const APP_VERSION = '2.7.0';
export const STORAGE_KEY = 'moto_finanzas_vFinal';
export const LEGACY_KEYS = ['moto_finanzas_v3', 'moto_finanzas', 'app_moto_data'];
export const SCHEMA_VERSION = 26;

export const SOURCE_KINDS = Object.freeze({
  employment: { label: 'Empleo', icon: '💼' },
  gig: { label: 'Plataforma / turnos', icon: '🛵' },
  freelance: { label: 'Freelance', icon: '💻' },
  business: { label: 'Negocio', icon: '🏪' },
  other: { label: 'Otro ingreso', icon: '💰' }
});

export const COMPENSATIONS = Object.freeze({
  daily: { label: 'Diario', captureOnActivity: false },
  weekly: { label: 'Semanal', captureOnActivity: false },
  biweekly: { label: 'Quincenal', captureOnActivity: false },
  monthly: { label: 'Mensual', captureOnActivity: false },
  per_shift: { label: 'Por turno', captureOnActivity: true },
  per_project: { label: 'Por proyecto', captureOnActivity: false },
  per_sale: { label: 'Por venta', captureOnActivity: false },
  variable: { label: 'Variable', captureOnActivity: true }
});

export const TRANSPORT_MODES = Object.freeze({
  none: { label: 'No uso transporte para trabajar', vehicle: false },
  public: { label: 'Transporte público', vehicle: false },
  motorcycle: { label: 'Moto', vehicle: true },
  car: { label: 'Auto', vehicle: true },
  bicycle: { label: 'Bicicleta', vehicle: true }
});

export const ACCOUNT_TYPES = Object.freeze({
  cash: 'Efectivo / caja', bank: 'Cuenta bancaria', wallet: 'Wallet', third_party: 'Fondo de empresa / tercero'
});

export const CAPABILITIES = Object.freeze({
  PERSONAL_FINANCE: 'personal_finance',
  WORK: 'work',
  TIME_TRACKING: 'time_tracking',
  TRANSPORT: 'transport',
  VEHICLE: 'vehicle',
  FUEL: 'fuel',
  THIRD_PARTY_FUNDS: 'third_party_funds',
  FREELANCE: 'freelance',
  BUSINESS: 'business',
  RECIPES: 'recipes',
  INVENTORY: 'inventory'
});

/* Compatibilidad con datos v1.x. Ya no se usa como fuente de verdad en UI. */
export const WORK_TYPES = Object.freeze({
  jaimau: { label: 'Jaimau / Ingenico', compensation: 'biweekly', fuel: 'company' },
  uber: { label: 'Uber Eats', compensation: 'per_shift', fuel: 'personal' }
});

export const FRECUENCIAS = Object.freeze({
  Diario: 1, Semanal: 7, Quincenal: 15, Mensual: 30,
  Bimestral: 60, Anual: 365, Unico: 0
});

export const MAPA_DIAS = Object.freeze({ 1:1, 2:2, 3:3, 4:4, 5:5, 6:6, 0:7 });
export const DIAS_SEMANA = Object.freeze([
  {val:'', txt:'Seleccionar...'}, {val:'1', txt:'Lunes'}, {val:'2', txt:'Martes'}, {val:'3', txt:'Miércoles'},
  {val:'4', txt:'Jueves'}, {val:'5', txt:'Viernes'}, {val:'6', txt:'Sábado'}, {val:'0', txt:'Domingo'}
]);

export const CATEGORIAS_BASE = Object.freeze({
  operativo: ['Gasolina', 'Renta', 'Mantenimiento', 'Reparación', 'Equipo', 'Seguro'],
  hogar: ['Renta', 'Comida', 'Servicios', 'Internet', 'Salud', 'Deudas', 'Otro']
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
export const periodIdFor = (compensation, value=Date.now()) => {
  const d=value instanceof Date?value:new Date(value);
  const ym=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  if(compensation==='biweekly') return `${ym}-Q${d.getDate()<=15?1:2}`;
  if(compensation==='weekly') {
    const start=new Date(d); const day=start.getDay()||7; start.setDate(start.getDate()-day+1);
    return `${start.getFullYear()}-W${String(Math.ceil((((start-new Date(start.getFullYear(),0,1))/86400000)+new Date(start.getFullYear(),0,1).getDay()+1)/7)).padStart(2,'0')}`;
  }
  if(compensation==='daily'||compensation==='per_shift'||compensation==='variable') return d.toISOString().slice(0,10);
  return ym;
};
