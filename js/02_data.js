// 02_data.js
const STORAGE_KEY = "miRutaMiLana_v1";

const defaultState = {
  turnoActivo: false,
  turnos: [],
  ingresosExtra: [],
  gastos: [],
  gasolina: [],
  deudas: [],
  abonos: []
};

let state = load();

/* ======================
   PERSISTENCIA
====================== */
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : structuredClone(defaultState);
  } catch {
    return structuredClone(defaultState);
  }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/* ======================
   TURNOS
====================== */
export function iniciarTurno() {
  state.turnoActivo = true;
  save();
}

export function finalizarTurno({ kmFinal, ganancia }) {
  state.turnos.push({
    fecha: new Date().toISOString(),
    kmFinal: Number(kmFinal),
    ganancia: Number(ganancia)
  });
  state.turnoActivo = false;
  save();
}

/* ======================
   INGRESOS
====================== */
export function registrarIngresoExtra(desc, monto) {
  state.ingresosExtra.push({
    fecha: new Date().toISOString(),
    desc,
    monto: Number(monto)
  });
  save();
}

/* ======================
   GASTOS
====================== */
export function registrarGasto(desc, monto) {
  state.gastos.push({
    fecha: new Date().toISOString(),
    desc,
    monto: Number(monto)
  });
  save();
}

/* ======================
   GASOLINA
====================== */
export function registrarGasolina(litros, costo, km) {
  state.gasolina.push({
    fecha: new Date().toISOString(),
    litros: Number(litros),
    costo: Number(costo),
    km: Number(km)
  });
  save();
}

/* ======================
   DEUDAS
====================== */
export function registrarDeuda(nombre, monto, cuota) {
  state.deudas.push({
    id: crypto.randomUUID(),
    nombre,
    monto: Number(monto),
    cuota: Number(cuota)
  });
  save();
}

export function registrarAbono(deudaId, monto) {
  state.abonos.push({
    fecha: new Date().toISOString(),
    deudaId,
    monto: Number(monto)
  });
  save();
}

/* ======================
   GETTERS
====================== */
export function getState() {
  return structuredClone(state);
}
