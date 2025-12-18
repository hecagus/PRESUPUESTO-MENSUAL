import { STORAGE_KEY, DIAS_POR_FRECUENCIA, safeNumber } from './01_consts_utils.js';

const DEFAULT_DATA = {
    turnos: [], movimientos: [], cargasCombustible: [], 
    deudas: [], gastos: [], gastosFijosMensuales: [],
    parametros: {
        gastoFijo: 0, ultimoKM: 0, costoPorKm: 0,
        mantenimientoBase: { 'Aceite': 3000, 'Bujía': 8000, 'Llantas': 15000 },
        ultimoServicio: { 'Aceite': 0, 'Bujía': 0, 'Llantas': 0 } 
    }
};

let state = JSON.parse(JSON.stringify(DEFAULT_DATA));
let turnoActivo = JSON.parse(localStorage.getItem("turnoActivo_Final")) || null;

// Lógica de precisión para combustible
const calcularCostoPorKm = () => {
    const cargas = state.cargasCombustible || [];
    if (cargas.length < 2) {
        state.parametros.costoPorKm = 0;
        return;
    }
    const ordenadas = [...cargas].sort((a, b) => safeNumber(a.km) - safeNumber(b.km));
    const kmTotal = safeNumber(ordenadas[ordenadas.length - 1].km) - safeNumber(ordenadas[0].km);
    
    if (kmTotal <= 0) {
        state.parametros.costoPorKm = 0;
        return;
    }
    const costoTotal = ordenadas.slice(1).reduce((acc, c) => acc + safeNumber(c.costo), 0);
    state.parametros.costoPorKm = costoTotal / kmTotal;
};

export const loadData = () => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) { 
        try { 
            const parsed = JSON.parse(raw);
            state = { ...DEFAULT_DATA, ...parsed }; 
        } catch (e) { 
            console.error("Error al cargar datos", e); 
        } 
    }
    recalcularMetaDiaria();
    calcularCostoPorKm();
};

export const saveData = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
export const getState = () => state;
export const getTurnoActivo = () => turnoActivo;

// --- PROYECCIONES FINANCIERAS (Lógica Wallet/Calendario) ---

export const getGananciaNetaPromedio7Dias = () => {
    const hoy = new Date();
    const hace7Dias = new Date();
    hace7Dias.setDate(hoy.getDate() - 7);
    const turnosRecientes = state.turnos.filter(t => new Date(t.fecha) >= hace7Dias);
    if (turnosRecientes.length === 0) return 0;
    const sumaNeta = turnosRecientes.reduce((acc, t) => acc + safeNumber(t.ganancia), 0);
    return sumaNeta / 7;
};

export const getDeudaTotalPendiente = () => {
    return state.deudas.reduce((acc, d) => acc + safeNumber(d.saldo), 0);
};

// NUEVA LÓGICA: Calendario de Pagos Real (Opción B)
export const calcularDiasParaLiquidarDeuda = () => {
    const deudasActivas = state.deudas.filter(d => d.saldo > 0);
    if (deudasActivas.length === 0) return "¡Libre!";

    let maxDias = 0;

    // Calculamos cuánto tarda CADA deuda individualmente según su cuota pactada
    deudasActivas.forEach(d => {
        const cuota = safeNumber(d.montoCuota);
        const frecuenciaDias = DIAS_POR_FRECUENCIA[d.frecuencia] || 30;
        
        // Cuánto pagas por día teóricamente en esa deuda
        const pagoDiario = frecuenciaDias > 0 ? (cuota / frecuenciaDias) : 0;

        if (pagoDiario > 0) {
            const diasFaltantes = d.saldo / pagoDiario;
            if (diasFaltantes > maxDias) maxDias = diasFaltantes;
        }
    });

    if (maxDias === 0) return "---";

    // Convertimos a una unidad legible (Meses si es > 60 días, Semanas si es menos)
    if (maxDias > 60) {
        return `${Math.ceil(maxDias / 30)} Meses (Cal.)`;
    } else {
        return `${Math.ceil(maxDias / 7)} Semanas (Cal.)`;
    }
};

// Análisis de Cobertura (Alcancía)
export const getAnalisisCobertura = () => {
    const metaDiaria = state.parametros.gastoFijo; // Lo que DEBES guardar (Alcancía)
    const realPromedio = getGananciaNetaPromedio7Dias(); // Lo que realmente entra
    
    return {
        cubre: realPromedio >= metaDiaria,
        diferencia: realPromedio - metaDiaria
    };
};

// --- GESTIÓN OPERATIVA ---
export const iniciarTurnoLogic = () => {
    if (turnoActivo) return false;
    turnoActivo = { inicio: new Date().toISOString() };
    localStorage.setItem("turnoActivo_Final", JSON.stringify(turnoActivo));
    return true;
};

export const finalizarTurnoLogic = (ganancia, kmFinal = 0) => {
    if (!turnoActivo) return;
    const fin = new Date();
    const t = { 
        fecha: fin.toISOString(), inicio: turnoActivo.inicio, fin: fin.toISOString(), 
        horas: (fin - new Date(turnoActivo.inicio)) / 36e5, ganancia: safeNumber(ganancia),
        kmFinal: safeNumber(kmFinal)
    };
    state.turnos.push(t);
    state.movimientos.push({ tipo: 'ingreso', fecha: fin.toISOString(), desc: 'Turno', monto: t.ganancia });
    if(safeNumber(kmFinal) > 0) state.parametros.ultimoKM = safeNumber(kmFinal);
    turnoActivo = null; 
    localStorage.removeItem("turnoActivo_Final"); 
    saveData();
};

export const recalcularMetaDiaria = () => {
    const fijos = state.gastosFijosMensuales.reduce((acc, i) => acc + (safeNumber(i.monto) / (DIAS_POR_FRECUENCIA[i.frecuencia]||30)), 0);
    const deudas = state.deudas.reduce((acc, d) => (d.saldo > 0 ? acc + (safeNumber(d.montoCuota) / (DIAS_POR_FRECUENCIA[d.frecuencia]||30)) : acc), 0);
    state.parametros.gastoFijo = fijos + deudas;
    saveData();
    return state.parametros.gastoFijo;
};

export const actualizarOdometroManual = (km) => {
    state.parametros.ultimoKM = safeNumber(km);
    saveData();
    return true;
};

export const registrarCargaGasolina = (l, c, km) => {
    actualizarOdometroManual(km);
    state.cargasCombustible.push({ fecha: new Date().toISOString(), litros: safeNumber(l), costo: safeNumber(c), km: safeNumber(km) });
    calcularCostoPorKm();
    saveData();
};

export const guardarConfigMantenimiento = (aceite, bujia, llantas) => {
    state.parametros.mantenimientoBase = { 'Aceite': safeNumber(aceite), 'Bujía': safeNumber(bujia), 'Llantas': safeNumber(llantas) };
    saveData();
};

export const registrarServicio = (aceiteKM, bujiaKM, llantasKM) => {
    state.parametros.ultimoServicio = { 'Aceite': safeNumber(aceiteKM), 'Bujía': safeNumber(bujiaKM), 'Llantas': safeNumber(llantasKM) };
    saveData();
};

export const checkMantenimiento = () => {
    const { ultimoKM, mantenimientoBase, ultimoServicio } = state.parametros;
    let alerta = { Aceite: false, Bujía: false, Llantas: false };
    let kmRestantes = {};
    let alertaActiva = false;
    for (const item in mantenimientoBase) {
        const umbral = safeNumber(mantenimientoBase[item]);
        const ultimoKMRegistro = safeNumber(ultimoServicio[item]);
        if (umbral > 0 && ultimoKMRegistro > 0) {
            const kmFaltantes = umbral - (ultimoKM - ultimoKMRegistro);
            kmRestantes[item] = kmFaltantes;
            if (kmFaltantes <= umbral * 0.1) { alerta[item] = true; alertaActiva = true; }
        }
    }
    return { alerta, kmRestantes, alertaActiva };
};

export const agregarDeuda = (d) => { state.deudas.push(d); recalcularMetaDiaria(); saveData(); };
export const agregarGasto = (g) => { state.gastos.push(g); state.movimientos.push({ tipo: 'gasto', fecha: g.fecha, desc: g.categoria, monto: g.monto }); saveData(); };
export const agregarGastoFijo = (gf) => { state.gastosFijosMensuales.push(gf); recalcularMetaDiaria(); };

