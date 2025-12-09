// 02_data.js
import { STORAGE_KEY, DIAS_POR_FRECUENCIA, safeNumber } from './01_consts_utils.js';

const DEFAULT_DATA = {
    ingresos: [], gastos: [], turnos: [], movimientos: [], 
    cargasCombustible: [], deudas: [], gastosFijosMensuales: [],
    parametros: {
        deudaTotal: 0, gastoFijo: 0, ultimoKM: 0, costoPorKm: 0,
        mantenimientoBase: { 'Aceite': 3000, 'Bujía': 8000, 'Llantas': 15000 },
        // Registro de los últimos servicios (Inicializar a 0)
        ultimoServicio: { 'Aceite': 0, 'Bujía': 0, 'Llantas': 0 } 
    }
};

let state = JSON.parse(JSON.stringify(DEFAULT_DATA));
let turnoActivo = JSON.parse(localStorage.getItem("turnoActivo")) || null;

// --- Funciones Internas de Cálculo ---

// 1. Cálculo de Costo por KM (Mismo código funcional)
const calcularCostoPorKm = () => {
    const cargas = state.cargasCombustible;
    if (cargas.length < 2) { state.parametros.costoPorKm = 0; return 0; }
    const cargasOrdenadas = [...cargas].sort((a, b) => safeNumber(a.km) - safeNumber(b.km));
    const kmTotalRecorrido = safeNumber(cargasOrdenadas[cargasOrdenadas.length - 1].km) - safeNumber(cargasOrdenadas[0].km);
    if (kmTotalRecorrido <= 0) { state.parametros.costoPorKm = 0; return 0; }
    const costoTotal = cargas.reduce((sum, carga) => sum + safeNumber(carga.costo), 0);
    const costoPorKm = costoTotal / kmTotalRecorrido;
    state.parametros.costoPorKm = costoPorKm;
    return costoPorKm;
};

// 2. Cálculo de Gasto Operativo Acumulado (NUEVO)
export const calcularGastoOperativoAcumulado = () => {
    const cargas = state.cargasCombustible;
    const ultimoKM = state.parametros.ultimoKM;
    const costoPorKm = state.parametros.costoPorKm;
    
    // Obtener KM de la última carga
    const kmUltimaCarga = cargas.length > 0 
        ? safeNumber(cargas[cargas.length - 1].km) 
        : (ultimoKM || 0); // Si no hay cargas, usamos el KM inicial
        
    const kmRecorrido = ultimoKM - kmUltimaCarga;
    
    // El costo operativo solo aplica si ya tenemos un costo/km válido
    const gastoAcumulado = kmRecorrido * costoPorKm;
    
    return {
        kmInicial: kmUltimaCarga,
        kmActual: ultimoKM,
        kmRecorrido: kmRecorrido,
        gastoAcumulado: safeNumber(gastoAcumulado)
    };
};

// --- ALMACENAMIENTO DE PARÁMETROS DE MANTENIMIENTO (NUEVO) ---
export const guardarParametrosMantenimiento = (aceite, bujia, llantas) => {
    state.parametros.mantenimientoBase.Aceite = safeNumber(aceite);
    state.parametros.mantenimientoBase.Bujia = safeNumber(bujia);
    state.parametros.mantenimientoBase.Llantas = safeNumber(llantas);
    saveData();
};

// --- SETTER DE ESTADO y PERSISTENCIA (mismo código) ---
const setState = (newData) => {
    state = { ...state, ...newData };
    recalcularMetaDiaria();
    calcularCostoPorKm();
    saveData();
};

export const loadData = () => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) { try { setState(JSON.parse(raw)); } catch (e) { console.error("Error al cargar JSON", e); } } else { ['ingresos','gastos','turnos','movimientos','cargasCombustible','deudas','gastosFijosMensuales'].forEach(k => { if (!Array.isArray(state[k])) state[k] = []; }); }
    state.parametros.ultimoKM = safeNumber(state.parametros.ultimoKM);
    recalcularMetaDiaria();
    calcularCostoPorKm();
};

export const saveData = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
export const getState = () => state;
export const getTurnoActivo = () => turnoActivo;


// --- RESTO DE LÓGICA (se mantienen igual) ---

export const recalcularMetaDiaria = () => {
    const fijos = state.gastosFijosMensuales.reduce((acc, i) => acc + (safeNumber(i.monto) / (DIAS_POR_FRECUENCIA[i.frecuencia]||30)), 0);
    const deudas = state.deudas.reduce((acc, d) => (d.saldo > 0 ? acc + (safeNumber(d.montoCuota) / (DIAS_POR_FRECUENCIA[d.frecuencia]||30)) : acc), 0);
    state.parametros.gastoFijo = fijos + deudas;
    saveData();
    return state.parametros.gastoFijo;
};

export const iniciarTurnoLogic = () => {
    if (turnoActivo) return false;
    turnoActivo = { inicio: new Date().toISOString() };
    localStorage.setItem("turnoActivo", JSON.stringify(turnoActivo));
    return true;
};

export const finalizarTurnoLogic = (ganancia) => {
    if (!turnoActivo) return;
    const fin = new Date();
    const t = { fecha: fin.toISOString(), inicio: turnoActivo.inicio, fin: fin.toISOString(), horas: (fin - new Date(turnoActivo.inicio)) / 36e5, ganancia: safeNumber(ganancia) };
    state.turnos.push(t);
    if (t.ganancia > 0) state.movimientos.push({ tipo: 'ingreso', fecha: fin.toISOString(), desc: 'Cierre Turno', monto: t.ganancia });
    turnoActivo = null; localStorage.removeItem("turnoActivo"); saveData();
};

export const actualizarOdometroManual = (kmInput) => {
    const nk = safeNumber(kmInput);
    if (state.parametros.ultimoKM > 0 && nk < state.parametros.ultimoKM) { alert(`Error: El nuevo KM (${nk}) no puede ser menor al actual (${state.parametros.ultimoKM}).`); return false; }
    state.parametros.ultimoKM = nk; saveData(); return true;
};

export const registrarCargaGasolina = (l, c, km) => {
    actualizarOdometroManual(km);
    state.cargasCombustible.push({ fecha: new Date().toISOString(), litros: safeNumber(l), costo: safeNumber(c), km: safeNumber(km) });
    calcularCostoPorKm();
    saveData();
};

export const agregarDeuda = (d) => { state.deudas.push(d); recalcularMetaDiaria(); saveData(); };
export const agregarGasto = (g) => { 
    state.gastos.push(g); 
    state.movimientos.push({ tipo: 'gasto', fecha: g.fecha, desc: `${g.categoria} (${g.desc||''})`, monto: g.monto });
    saveData(); 
};
export const agregarGastoFijo = (gf) => {
    state.gastosFijosMensuales.push({ id: gf.id, categoria: gf.categoria, monto: gf.monto, frecuencia: gf.frecuencia, desc: gf.desc });
    state.movimientos.push({ tipo: 'gasto', fecha: gf.fecha, desc: `Alta Fijo: ${gf.categoria}`, monto: gf.monto });
    recalcularMetaDiaria();
};
