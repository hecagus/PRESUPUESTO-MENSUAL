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
        } catch (e) { console.error("Error al cargar datos", e); } 
    }
    recalcularMetaDiaria();
    calcularCostoPorKm();
};

export const saveData = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
export const getState = () => state;
export const getTurnoActivo = () => turnoActivo;

// --- WALLET LOGIC ---
const getDiasDesdeUltimoPago = (nombreConcepto) => {
    const pagos = state.movimientos
        .filter(m => m.tipo === 'gasto' && m.desc.toLowerCase().includes(nombreConcepto.toLowerCase()))
        .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    const hoy = new Date();
    if (pagos.length > 0) {
        const ultimoPago = new Date(pagos[0].fecha);
        return Math.floor(Math.abs(hoy - ultimoPago) / (1000 * 60 * 60 * 24));
    }
    return hoy.getDate();
};

export const getWalletData = () => {
    const costoKm = state.parametros.costoPorKm || 0;
    let kmTotalHistorico = 0;
    const cargasOrd = [...state.cargasCombustible].sort((a,b) => safeNumber(a.km) - safeNumber(b.km));
    if (cargasOrd.length > 0) kmTotalHistorico = state.parametros.ultimoKM - safeNumber(cargasOrd[0].km);
    
    const ahorroGasolinaTeorico = kmTotalHistorico * costoKm;
    const gastoGasolinaReal = state.movimientos
        .filter(m => m.tipo === 'gasto' && (m.desc.toLowerCase().includes('gasolina') || m.desc.toLowerCase().includes('carga')))
        .reduce((acc, m) => acc + safeNumber(m.monto), 0);

    const sobres = [];
    state.gastosFijosMensuales.forEach(g => {
        if (g.categoria.toLowerCase().includes('comida') || g.categoria.toLowerCase().includes('gasolina')) return;
        const monto = safeNumber(g.monto);
        const costoDiario = monto / (DIAS_POR_FRECUENCIA[g.frecuencia] || 30);
        const dias = getDiasDesdeUltimoPago(g.categoria);
        sobres.push({ nombre: g.categoria, diario: costoDiario, acumulado: Math.min(costoDiario * dias, monto), dias, tipo: 'Fijo' });
    });

    state.deudas.forEach(d => {
        if (d.saldo <= 0) return;
        const cuota = safeNumber(d.montoCuota);
        const costoDiario = cuota / (DIAS_POR_FRECUENCIA[d.frecuencia] || 30);
        const dias = getDiasDesdeUltimoPago(d.desc);
        sobres.push({ nombre: d.desc, diario: costoDiario, acumulado: Math.min(costoDiario * dias, cuota), dias, tipo: 'Deuda' });
    });

    const totalObligado = sobres.reduce((acc, s) => acc + s.acumulado, 0) + Math.max(0, ahorroGasolinaTeorico - gastoGasolinaReal);
    const efectivo = state.movimientos.reduce((acc, m) => acc + (m.tipo === 'ingreso' ? safeNumber(m.monto) : -safeNumber(m.monto)), 0);

    return {
        gasolina: { kmTotal: kmTotalHistorico, costoKm, necesario: ahorroGasolinaTeorico, gastado: gastoGasolinaReal, saldo: ahorroGasolinaTeorico - gastoGasolinaReal },
        sobres, totales: { obligado: totalObligado, efectivo, salud: efectivo - totalObligado }
    };
};

export const eliminarGastoFijo = (index) => { state.gastosFijosMensuales.splice(index, 1); recalcularMetaDiaria(); };
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
    localStorage.setItem("turnoActivo_Final", JSON.stringify(turnoActivo));
    return true;
};

export const finalizarTurnoLogic = (ganancia, kmFinal = 0) => {
    if (!turnoActivo) return;
    const fin = new Date();
    const t = { fecha: fin.toISOString(), inicio: turnoActivo.inicio, fin: fin.toISOString(), horas: (fin - new Date(turnoActivo.inicio)) / 36e5, ganancia: safeNumber(ganancia), kmFinal: safeNumber(kmFinal) };
    state.turnos.push(t);
    state.movimientos.push({ tipo: 'ingreso', fecha: fin.toISOString(), desc: 'Turno', monto: t.ganancia });
    if(safeNumber(kmFinal) > 0) state.parametros.ultimoKM = safeNumber(kmFinal);
    turnoActivo = null; localStorage.removeItem("turnoActivo_Final"); saveData();
};

export const registrarCargaGasolina = (l, c, km) => {
    state.parametros.ultimoKM = safeNumber(km);
    state.cargasCombustible.push({ fecha: new Date().toISOString(), litros: safeNumber(l), costo: safeNumber(c), km: safeNumber(km) });
    state.movimientos.push({ tipo: 'gasto', fecha: new Date().toISOString(), desc: '⛽ Gasolina', monto: safeNumber(c) });
    calcularCostoPorKm(); saveData();
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
        const ultimo = safeNumber(ultimoServicio[item]);
        if (umbral > 0 && ultimo > 0) {
            const faltan = umbral - (ultimoKM - ultimo);
            kmRestantes[item] = faltan;
            if (faltan <= umbral * 0.1) { alerta[item] = true; alertaActiva = true; }
        }
    }
    return { alerta, kmRestantes, alertaActiva };
};

export const agregarDeuda = (d) => { state.deudas.push(d); recalcularMetaDiaria(); };
export const agregarGasto = (g) => { state.movimientos.push({ tipo: 'gasto', fecha: g.fecha, desc: g.categoria, monto: g.monto }); saveData(); };
export const agregarGastoFijo = (gf) => { state.gastosFijosMensuales.push(gf); recalcularMetaDiaria(); };
export const actualizarOdometroManual = (km) => { state.parametros.ultimoKM = safeNumber(km); saveData(); return true; };
export const guardarConfigMantenimiento = (aceite, bujia, llantas) => { state.parametros.mantenimientoBase = { 'Aceite': safeNumber(aceite), 'Bujía': safeNumber(bujia), 'Llantas': safeNumber(llantas) }; saveData(); };
