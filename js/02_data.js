// 02_data.js
import { STORAGE_KEY, DIAS_POR_FRECUENCIA, safeNumber } from './01_consts_utils.js';

const DEFAULT_DATA = {
    ingresos: [], gastos: [], turnos: [], movimientos: [], 
    cargasCombustible: [], deudas: [], gastosFijosMensuales: [],
    parametros: {
        deudaTotal: 0, gastoFijo: 0, ultimoKM: 0, costoPorKm: 0,
        mantenimientoBase: { 'Aceite': 3000, 'Bujía': 8000, 'Llantas': 15000 }
    }
};

let state = JSON.parse(JSON.stringify(DEFAULT_DATA));
let turnoActivo = JSON.parse(localStorage.getItem("turnoActivo")) || null;

// --- LÓGICA VEHICULAR: CÁLCULO DE COSTO POR KM (NUEVO) ---
const calcularCostoPorKm = () => {
    const cargas = state.cargasCombustible;
    
    // Se necesitan al menos 2 cargas para calcular un KM recorrido entre ellas,
    // o al menos 1 carga si asumimos que el KM inicial era 0. Usaremos 2 para robustez.
    if (cargas.length < 2) {
        state.parametros.costoPorKm = 0;
        return 0;
    }

    // Ordenar cargas por KM para obtener el KM inicial y final del historial de cargas
    cargas.sort((a, b) => a.km - b.km);
    
    const primerKm = safeNumber(cargas[0].km); 
    const ultimoKm = safeNumber(cargas[cargas.length - 1].km);
    
    // Recorrido total entre el primer y último registro de carga
    const kmTotalRecorrido = ultimoKm - primerKm;

    if (kmTotalRecorrido <= 0) {
        state.parametros.costoPorKm = 0;
        return 0;
    }
    
    // Suma de todos los costos registrados en las cargas
    const costoTotal = cargas.reduce((sum, carga) => sum + safeNumber(carga.costo), 0);

    const costoPorKm = costoTotal / kmTotalRecorrido;
    state.parametros.costoPorKm = costoPorKm;
    return costoPorKm;
};

// --- PERSISTENCIA ---
export const loadData = () => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) { 
        try { state = { ...state, ...JSON.parse(raw) }; } catch (e) { console.error(e); } 
    }
    ['ingresos','gastos','turnos','movimientos','cargasCombustible','deudas','gastosFijosMensuales'].forEach(k => { if (!Array.isArray(state[k])) state[k] = []; });
    state.parametros.ultimoKM = safeNumber(state.parametros.ultimoKM);
    recalcularMetaDiaria();
    
    calcularCostoPorKm(); // <-- NUEVO: Calcula la métrica al cargar
};

export const saveData = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
export const getState = () => state;
export const getTurnoActivo = () => turnoActivo;

// --- META DIARIA BLINDADA ---
export const recalcularMetaDiaria = () => {
    const fijos = state.gastosFijosMensuales.reduce((acc, i) => acc + (safeNumber(i.monto) / (DIAS_POR_FRECUENCIA[i.frecuencia]||30)), 0);
    const deudas = state.deudas.reduce((acc, d) => (d.saldo > 0 ? acc + (safeNumber(d.montoCuota) / (DIAS_POR_FRECUENCIA[d.frecuencia]||30)) : acc), 0);
    state.parametros.gastoFijo = fijos + deudas;
    saveData();
    return state.parametros.gastoFijo;
};

// --- TURNOS (sin cambios) ---
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

// --- VEHÍCULO Y ODÓMETRO ---
export const actualizarOdometroManual = (kmInput) => {
    const nk = safeNumber(kmInput);
    if (state.parametros.ultimoKM > 0 && nk < state.parametros.ultimoKM) { 
        alert(`Error: El nuevo KM (${nk}) no puede ser menor al actual (${state.parametros.ultimoKM}).`); 
        return false; 
    }
    state.parametros.ultimoKM = nk; 
    saveData(); 
    return true;
};

export const registrarCargaGasolina = (l, c, km) => {
    actualizarOdometroManual(km);
    state.cargasCombustible.push({ 
        fecha: new Date().toISOString(), 
        litros: safeNumber(l), 
        costo: safeNumber(c), 
        km: safeNumber(km) 
    });
    calcularCostoPorKm(); // <-- NUEVO: Recalcula después de guardar
    saveData();
};

// --- DEUDAS y GASTOS (sin cambios) ---
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
