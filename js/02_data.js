/* 02_data.js - CEREBRO DE DATOS */
import { STORAGE_KEY, DIAS_POR_FRECUENCIA, safeNumber, isSameDay } from './01_consts_utils.js';

const DEFAULT_PANEL_DATA = {
    ingresos: [],
    gastos: [],
    turnos: [],
    movimientos: [], 
    cargasCombustible: [], 
    deudas: [],
    gastosFijosMensuales: [], 
    parametros: {
        gastoFijo: 0, // Meta Diaria
        ultimoKMfinal: 0, 
        costoPorKm: 0, 
        mantenimientoBase: { 'Aceite (KM)': 3000 }
    }
};

let panelData = JSON.parse(JSON.stringify(DEFAULT_PANEL_DATA));
let turnoActivo = JSON.parse(localStorage.getItem("turnoActivo")) || false;

// --- PERSISTENCIA ---
export const getState = () => panelData;

export const saveData = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(panelData));
    if (turnoActivo) localStorage.setItem("turnoActivo", JSON.stringify(turnoActivo));
    else localStorage.removeItem("turnoActivo");
};

export const loadData = () => {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
        try {
            const parsed = JSON.parse(data);
            panelData = { ...DEFAULT_PANEL_DATA, ...parsed, parametros: { ...DEFAULT_PANEL_DATA.parametros, ...parsed.parametros } };
        } catch (e) { console.error(e); }
    }
    recalcularMetaDiaria();
};

// --- CÁLCULOS MATEMÁTICOS ---
export const recalcularMetaDiaria = () => {
    const totalFijos = panelData.gastosFijosMensuales.reduce((sum, g) => {
        const dias = DIAS_POR_FRECUENCIA[g.frecuencia] || 30;
        return sum + (safeNumber(g.monto) / dias);
    }, 0);

    const totalDeudas = panelData.deudas.reduce((sum, d) => {
        if (d.saldo <= 0) return sum;
        const dias = DIAS_POR_FRECUENCIA[d.frecuencia] || 30;
        return sum + (safeNumber(d.montoCuota) / dias);
    }, 0);

    panelData.parametros.gastoFijo = totalFijos + totalDeudas;
    saveData();
    return panelData.parametros.gastoFijo;
};

// --- OPERACIONES DEUDA ---
export const agregarDeuda = (desc, total, cuota, frecuencia) => {
    panelData.deudas.push({
        id: Date.now(),
        desc,
        montoTotal: safeNumber(total),
        saldo: safeNumber(total),
        montoCuota: safeNumber(cuota),
        frecuencia
    });
    recalcularMetaDiaria();
};

export const registrarAbono = (idDeuda, monto) => {
    const deuda = panelData.deudas.find(d => d.id == idDeuda);
    if (deuda) {
        deuda.saldo -= safeNumber(monto);
        if(deuda.saldo < 0) deuda.saldo = 0;
        agregarMovimiento('gasto', `Abono: ${deuda.desc}`, monto, 'Deuda');
        recalcularMetaDiaria();
    }
};

// --- OPERACIONES GASOLINA ---
export const registrarGasolina = (litros, costoTotal, kmActual) => {
    litros = safeNumber(litros);
    costoTotal = safeNumber(costoTotal);
    kmActual = safeNumber(kmActual);

    const cargasOrdenadas = panelData.cargasCombustible.sort((a,b) => new Date(a.fecha) - new Date(b.fecha));
    const ultimaCarga = cargasOrdenadas[cargasOrdenadas.length - 1];
    let costoKmReal = 0;

    if (ultimaCarga && kmActual > ultimaCarga.km) {
        const distancia = kmActual - ultimaCarga.km;
        costoKmReal = costoTotal / distancia;
        panelData.parametros.costoPorKm = costoKmReal;
    }

    panelData.cargasCombustible.push({
        fecha: new Date().toISOString(),
        litros, costo: costoTotal, km: kmActual, rendimientoCalc: costoKmReal
    });

    if (kmActual > panelData.parametros.ultimoKMfinal) panelData.parametros.ultimoKMfinal = kmActual;
    agregarMovimiento('gasto', '⛽ Gasolina', costoTotal, 'Moto');
    return { costoKmReal, kmActual };
};

// --- OPERACIONES TURNO ---
export const iniciarTurno = (kmInicial) => {
    turnoActivo = { inicio: new Date().getTime(), kmInicial: safeNumber(kmInicial) };
    saveData();
};

export const finalizarTurno = (kmFinal, ganancia) => {
    if (!turnoActivo) return;
    const ahora = new Date().getTime();
    const horas = (ahora - turnoActivo.inicio) / (1000 * 60 * 60);
    const kmRecorridos = safeNumber(kmFinal) - turnoActivo.kmInicial;

    panelData.turnos.push({
        id: Date.now(),
        fecha: new Date().toISOString(),
        horas,
        kmRecorridos: kmRecorridos > 0 ? kmRecorridos : 0,
        ganancia: safeNumber(ganancia)
    });

    if (safeNumber(kmFinal) > panelData.parametros.ultimoKMfinal) panelData.parametros.ultimoKMfinal = safeNumber(kmFinal);
    if (safeNumber(ganancia) > 0) agregarMovimiento('ingreso', 'Ganancia Turno', ganancia, 'Operativo');

    turnoActivo = false;
    saveData();
};

// --- MOVIMIENTOS ---
export const agregarMovimiento = (tipo, desc, monto, categoria) => {
    panelData.movimientos.push({
        tipo, fecha: new Date().toISOString(), desc, monto: safeNumber(monto), categoria
    });
    if (tipo === 'gasto') panelData.gastos.push({ tipo: categoria, monto: safeNumber(monto), desc });
    else panelData.ingresos.push(safeNumber(monto));
    saveData();
};

export const agregarGastoRecurrente = (desc, monto, frecuencia, diaPago) => {
    panelData.gastosFijosMensuales.push({ desc, monto, frecuencia, diaPago });
    recalcularMetaDiaria();
};

// --- UI GETTERS ---
export const getDashboardStats = () => {
    const hoy = new Date();
    const movsHoy = panelData.movimientos.filter(m => isSameDay(m.fecha, hoy));
    const turnosHoy = panelData.turnos.filter(t => isSameDay(t.fecha, hoy));
    const ganancia = movsHoy.filter(m => m.tipo === 'ingreso').reduce((a, b) => a + b.monto, 0);
    return {
        horasHoy: turnosHoy.reduce((a, b) => a + b.horas, 0),
        gananciaHoy: ganancia,
        meta: panelData.parametros.gastoFijo,
        progreso: panelData.parametros.gastoFijo > 0 ? (ganancia / panelData.parametros.gastoFijo) * 100 : 0,
        turnosRecientes: panelData.turnos.slice(-5).reverse(),
        alertas: [] 
    };
};

export const getAdminStats = () => ({
    turnoActivo,
    metaDiaria: panelData.parametros.gastoFijo,
    deudas: panelData.deudas,
    ultimoKM: panelData.parametros.ultimoKMfinal
});

export const getWalletStats = () => {
    const dia = new Date().getDate();
    const meta = panelData.parametros.gastoFijo;
    const ahora = new Date();
    const movsMes = panelData.movimientos.filter(m => {
        const d = new Date(m.fecha);
        return d.getMonth() === ahora.getMonth() && d.getFullYear() === ahora.getFullYear();
    });
    const neto = movsMes.reduce((acc, m) => acc + (m.tipo==='ingreso'?m.monto:-m.monto), 0);
    return { deberiasTener: meta * dia, tienesRealmente: neto, enMeta: neto >= (meta * dia) };
};
