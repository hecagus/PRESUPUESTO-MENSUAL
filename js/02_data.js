// 02_data.js
// ===============================
// MODELO DE DATOS – ADMIN (V1)
// ===============================

import { STORAGE_KEY, safeNumber } from "./01_consts_utils.js";

/* ===============================
   MODELO CONGELADO DE ADMIN
================================ */

const DEFAULT_ADMIN_DATA = {
  parametrosOperativos: {
    rendimientoKmPorLitro: 0,
    precioLitroGasolina: 0,
    fechaInicioControl: null
  },

  gasolina: {
    ultimoReposteo: {
      fecha: null,
      kmOdometro: null
    },
    costoRealPorKm: 0
  },

  gastosRecurrentes: [],

  deudas: [],

  gastosNetos: [],

  sistema: {
    versionModelo: 1,
    ultimaActualizacion: null
  }
};

/* ===============================
   ESTADO INTERNO
================================ */

let adminData = structuredClone(DEFAULT_ADMIN_DATA);

/* ===============================
   PERSISTENCIA
================================ */

export const loadAdminData = () => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    saveAdminData();
    return;
  }

  try {
    const parsed = JSON.parse(raw);

    // Migración defensiva
    adminData = {
      ...DEFAULT_ADMIN_DATA,
      ...parsed,
      parametrosOperativos: {
        ...DEFAULT_ADMIN_DATA.parametrosOperativos,
        ...(parsed.parametrosOperativos || {})
      },
      gasolina: {
        ...DEFAULT_ADMIN_DATA.gasolina,
        ...(parsed.gasolina || {})
      },
      sistema: {
        ...DEFAULT_ADMIN_DATA.sistema,
        ...(parsed.sistema || {})
      }
    };
  } catch (e) {
    console.error("❌ Error cargando AdminData. Reiniciando.", e);
    adminData = structuredClone(DEFAULT_ADMIN_DATA);
  }
};

export const saveAdminData = () => {
  adminData.sistema.ultimaActualizacion = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(adminData));
};

/* ===============================
   GETTERS (LECTURA)
================================ */

export const getAdminData = () => structuredClone(adminData);

/* ===============================
   PARÁMETROS OPERATIVOS
================================ */

export const setParametrosOperativos = ({
  rendimientoKmPorLitro,
  precioLitroGasolina,
  fechaInicioControl
}) => {
  adminData.parametrosOperativos.rendimientoKmPorLitro = safeNumber(rendimientoKmPorLitro);
  adminData.parametrosOperativos.precioLitroGasolina = safeNumber(precioLitroGasolina);
  adminData.parametrosOperativos.fechaInicioControl = fechaInicioControl || null;
  saveAdminData();
};

/* ===============================
   GASOLINA (CONFIGURACIÓN)
================================ */

export const setUltimoReposteo = ({ fecha, kmOdometro }) => {
  adminData.gasolina.ultimoReposteo.fecha = fecha || null;
  adminData.gasolina.ultimoReposteo.kmOdometro = safeNumber(kmOdometro);
  saveAdminData();
};

export const setCostoRealPorKm = (valor) => {
  adminData.gasolina.costoRealPorKm = safeNumber(valor);
  saveAdminData();
};

/* ===============================
   GASTOS RECURRENTES
================================ */

export const addGastoRecurrente = ({
  nombre,
  tipo,           // hogar | operativo
  monto,
  frecuencia,     // diario | semanal | quincenal | mensual
  diaPago,
  vaASobre
}) => {
  adminData.gastosRecurrentes.push({
    id: crypto.randomUUID(),
    nombre,
    tipo,
    monto: safeNumber(monto),
    frecuencia,
    diaPago,
    vaASobre: Boolean(vaASobre),
    activo: true
  });
  saveAdminData();
};

/* ===============================
   DEUDAS
================================ */

export const addDeuda = ({
  nombre,
  saldoTotal,
  cuota,
  frecuencia,
  diaPago,
  vaASobre
}) => {
  adminData.deudas.push({
    id: crypto.randomUUID(),
    nombre,
    saldoTotal: safeNumber(saldoTotal),
    cuota: safeNumber(cuota),
    frecuencia,
    diaPago,
    vaASobre: Boolean(vaASobre),
    activa: true
  });
  saveAdminData();
};

/* ===============================
   GASTOS NETOS
================================ */

export const addGastoNeto = ({ nombre, tipo, fecha, monto }) => {
  adminData.gastosNetos.push({
    id: crypto.randomUUID(),
    nombre,
    tipo,
    fecha,
    monto: safeNumber(monto)
  });
  saveAdminData();
};

/* ===============================
   BACKUP / RESTORE
================================ */

export const exportAdminJSON = () => {
  return JSON.stringify(adminData, null, 2);
};

export const importAdminJSON = (jsonString) => {
  try {
    const parsed = JSON.parse(jsonString);

    if (!parsed || typeof parsed !== "object") return false;
    if (!parsed.sistema || parsed.sistema.versionModelo !== 1) return false;

    adminData = {
      ...DEFAULT_ADMIN_DATA,
      ...parsed
    };

    saveAdminData();
    return true;
  } catch (e) {
    console.error("❌ Error importando JSON Admin", e);
    return false;
  }
};
