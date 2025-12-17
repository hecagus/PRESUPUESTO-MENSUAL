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

const calcularCostoPorKm = () => {
    const cargas = state.cargasCombustible;
    if (cargas.length < 2) { state.parametros.costoPorKm = 0; return; }
    const ordenadas = [...cargas].sort((a,b) => safeNumber(a.km) - safeNumber(b.km));
    const kmTotal = safeNumber(ordenadas[ordenadas.length-1].km) - safeNumber(ordenadas[0].km);
    if (kmTotal <= 0) { state.parametros.costoPorKm = 0; return; }
    const costoTotal = cargas.reduce((acc, c) => acc + safeNumber(c.costo), 0);
    state.parametros.costoPorKm = costoTotal / kmTotal;
};

export const saveData = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

export const loadData = () => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) { try { state = { ...state, ...JSON.parse(raw) }; } catch (e) { console.error(e); } }
    if (!state.parametros) state.parametros = DEFAULT_DATA.parametros;
    ['turnos','movimientos','cargasCombustible','deudas','gastos','gastosFijosMensuales'].forEach(k => {
        if (!Array.isArray(state[k])) state[k] = [];
    });
    recalcularMetaDiaria();
    calcularCostoPorKm();
};

export const getState = () => state;
export const getTurnoActivo = () => turnoActivo;

// --- LÓGICA DE PROYECCIONES ---
export const getGananciaNetaPromedio = () => {
    const sieteDiasAtras = new Date();
    sieteDiasAtras.setDate(sieteDiasAtras.getDate() - 7);
    const turnosRecientes = state.turnos.filter(t => new Date(t.fecha) >= sieteDiasAtras);
    if (turnosRecientes.length === 0) return 0;
    const totalNeta = turnosRecientes.reduce((acc, t) => acc + safeNumber(t.ganancia), 0);
    return totalNeta / 7; // Promedio diario en la última semana
};

export const getDeudaTotalPendiente = () => {
    return state.deudas.reduce((acc, d) => acc + safeNumber(d.saldo), 0);
};

export const calcularTiempoLibreDeudas = () => {
    const promNetaDiaria = getGananciaNetaPromedio();
    const gastoDiario = state.parametros.gastoFijo;
    const deudaTotal = getDeudaTotalPendiente();
    const capacidadPago = promNetaDiaria - gastoDiario;
    if (capacidadPago <= 0 || deudaTotal <= 0) return "Indefinido";
    const dias = Math.ceil(deudaTotal / capacidadPago);
    return `${dias} días`;
};

// --- RESTO DE FUNCIONES LÓGICAS ---
export const iniciarTurnoLogic = () => {
    if (turnoActivo) return false;
    const kmInicial = state.parametros.ultimoKM; 
    turnoActivo = { inicio: new Date().toISOString(), kmInicial: safeNumber(kmInicial) };
    localStorage.setItem("turnoActivo_Final", JSON.stringify(turnoActivo));
    return true;
};

export const finalizarTurnoLogic = (ganancia, kmFinal = 0) => {
    if (!turnoActivo) return;
    const fin = new Date();
    const t = { 
        fecha: fin.toISOString(), inicio: turnoActivo.inicio, fin: fin.toISOString(), 
        horas: (fin - new Date(turnoActivo.inicio)) / 36e5, ganancia: safeNumber(ganancia),
        kmFinal: safeNumber(kmFinal), kmInicial: safeNumber(turnoActivo.kmInicial || 0) 
    };
    state.turnos.push(t);
    if(t.ganancia > 0) state.movimientos.push({ tipo: 'ingreso', fecha: fin.toISOString(), desc: 'Turno', monto: t.ganancia });
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
            const kmRecorridos = ultimoKM - ultimoKMRegistro;
            const kmFaltantes = umbral - kmRecorridos;
            kmRestantes[item] = kmFaltantes;
            if (kmFaltantes <= umbral * 0.1) { alerta[item] = true; alertaActiva = true; }
        }
    }
    return { alerta, kmRestantes, alertaActiva };
};

export const agregarDeuda = (d) => { state.deudas.push(d); recalcularMetaDiaria(); saveData(); };
export const agregarGasto = (g) => { state.gastos.push(g); state.movimientos.push({ tipo: 'gasto', fecha: g.fecha, desc: g.categoria, monto: g.monto }); saveData(); };
export const agregarGastoFijo = (gf) => {
    state.gastosFijosMensuales.push(gf);
    state.movimientos.push({ tipo: 'gasto', fecha: gf.fecha, desc: `Fijo: ${gf.categoria}`, monto: gf.monto });
    recalculateMetaDiaria();
};

