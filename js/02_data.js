// 02_data.js
import { STORAGE_KEY, DIAS_POR_FRECUENCIA, safeNumber } from './01_consts_utils.js';

const DEFAULT_DATA = {
    ingresos: [], gastos: [], turnos: [], movimientos: [], 
    cargasCombustible: [], deudas: [], gastosFijosMensuales: [],
    parametros: {
        deudaTotal: 0, gastoFijo: 0, ultimoKM: 0, costoPorKm: 0,
        mantenimientoBase: { 'Aceite': 3000, 'Bujía': 8000, 'Llantas': 15000 },
        ultimoServicio: { 'Aceite': 0, 'Bujía': 0, 'Llantas': 0 } 
    }
};

let state = JSON.parse(JSON.stringify(DEFAULT_DATA));
let turnoActivo = JSON.parse(localStorage.getItem("turnoActivo")) || null;

// --- Funciones Internas de Cálculo ---
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

// --- SETTER DE ESTADO ---
const setState = (newData) => {
    state = { ...DEFAULT_DATA, ...newData };
    recalcularMetaDiaria();
    calcularCostoPorKm();
    saveData();
};

// --- PERSISTENCIA Y GETTERS ---
export const loadData = () => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) { 
        try { setState(JSON.parse(raw)); } catch (e) { console.error("Error al cargar JSON", e); } 
    } else {
        ['ingresos','gastos','turnos','movimientos','cargasCombustible','deudas','gastosFijosMensuales'].forEach(k => { if (!Array.isArray(state[k])) state[k] = []; });
        recalcularMetaDiaria(); 
        calcularCostoPorKm(); 
    }
    state.parametros.ultimoKM = safeNumber(state.parametros.ultimoKM);
};

export const saveData = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
export const getState = () => state;
export const getTurnoActivo = () => turnoActivo;

// --- LÓGICA CRÍTICA: RESPALDO (EXPORTABLES) ---

export const exportarJsonLogic = () => {
    // Exporta el estado completo
    return JSON.stringify(state);
};

export const importarJsonLogic = (jsonString) => {
    try {
        const newData = JSON.parse(jsonString);
        if (typeof newData !== 'object' || !newData.parametros) {
            console.error("Estructura JSON no válida.");
            return false;
        }
        setState(newData); // Sobrescribe estado y recalcula
        return true;
    } catch (e) {
        console.error("Error al parsear JSON:", e);
        return false;
    }
};

// --- FUNCIONES DE MANTENIMIENTO Y CÁLCULO ---
export const calcularGastoOperativoAcumulado = () => {
    const cargas = state.cargasCombustible;
    const ultimoKM = state.parametros.ultimoKM;
    const costoPorKm = state.parametros.costoPorKm;
    
    const kmUltimaCarga = cargas.length > 0 
        ? safeNumber(cargas[cargas.length - 1].km) 
        : (ultimoKM || 0);
        
    const kmRecorrido = ultimoKM - kmUltimaCarga;
    const gastoAcumulado = kmRecorrido * costoPorKm;
    
    return { kmInicial: kmUltimaCarga, kmActual: ultimoKM, kmRecorrido: kmRecorrido, gastoAcumulado: safeNumber(gastoAcumulado) };
};

export const guardarParametrosMantenimiento = (aceite, bujia, llantas) => {
    state.parametros.mantenimientoBase.Aceite = safeNumber(aceite);
    state.parametros.mantenimientoBase.Bujia = safeNumber(bujia);
    state.parametros.mantenimientoBase.Llantas = safeNumber(llantas);
    saveData();
};

// --- RESTO DE LÓGICA (se mantiene igual) ---

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
                            
