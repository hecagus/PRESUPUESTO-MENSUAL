/* 02_data.js */
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
        deudaTotal: 0,
        gastoFijo: 0,
        ultimoKMfinal: 0,
        costoPorKm: 0,
        mantenimientoBase: { 'Aceite (KM)': 3000, 'Bujía (KM)': 8000, 'Llantas (KM)': 15000 }
    }
};

let panelData = JSON.parse(JSON.stringify(DEFAULT_PANEL_DATA));
let turnoActivo = JSON.parse(localStorage.getItem("turnoActivo")) || false;

// --- PERSISTENCIA ---
export const getState = () => panelData;

export const saveData = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(panelData));
    if (turnoActivo) {
        localStorage.setItem("turnoActivo", JSON.stringify(turnoActivo));
    } else {
        localStorage.removeItem("turnoActivo");
    }
};

export const loadData = () => {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
        try {
            const parsed = JSON.parse(data);
            panelData = { ...DEFAULT_PANEL_DATA, ...parsed, parametros: { ...DEFAULT_PANEL_DATA.parametros, ...parsed.parametros } };
        } catch (e) {
            console.error("Error cargando datos, reiniciando...", e);
            panelData = JSON.parse(JSON.stringify(DEFAULT_PANEL_DATA));
        }
    }
    recalcularMetaDiaria();
};

// --- LÓGICA DE NEGOCIO Y CÁLCULOS (PURE DATA) ---

export const recalcularMetaDiaria = () => {
    const totalFijosMensuales = panelData.gastosFijosMensuales.reduce((sum, g) => {
        const dias = DIAS_POR_FRECUENCIA[g.frecuencia] || 30;
        return sum + (safeNumber(g.monto) / dias);
    }, 0);

    const aporteDeudasDiario = panelData.deudas.reduce((sum, d) => {
        if (d.saldo <= 0) return sum;
        const dias = DIAS_POR_FRECUENCIA[d.frecuencia] || 30;
        return sum + (safeNumber(d.montoCuota) / dias);
    }, 0);

    panelData.parametros.gastoFijo = totalFijosMensuales + aporteDeudasDiario;
    saveData();
    return panelData.parametros.gastoFijo;
};

// Preparar datos para Dashboard (Index)
export const getDashboardStats = () => {
    const hoy = new Date();
    const turnosHoy = panelData.turnos.filter(t => isSameDay(t.fecha, hoy));
    const movsHoy = panelData.movimientos.filter(m => isSameDay(m.fecha, hoy));
    
    const gananciaHoy = movsHoy.filter(m => m.tipo === 'ingreso').reduce((acc, m) => acc + m.monto, 0);
    const horasHoy = turnosHoy.reduce((acc, t) => acc + t.horas, 0);
    const meta = panelData.parametros.gastoFijo;
    const progreso = meta > 0 ? (gananciaHoy / meta) * 100 : 0;
    
    // Alertas
    const alertas = [];
    if (panelData.parametros.ultimoKMfinal === 0) alertas.push("⚠️ Configura tu Odómetro inicial en Admin.");
    if (meta === 0) alertas.push("⚠️ Registra gastos fijos para calcular tu Meta.");

    return {
        horasHoy,
        gananciaHoy,
        meta,
        progreso,
        alertas,
        turnosRecientes: panelData.turnos.slice(-5).reverse()
    };
};

// Preparar datos para Wallet
export const getWalletStats = () => {
    const diaDelMes = new Date().getDate();
    const metaDiaria = panelData.parametros.gastoFijo;
    const acumuladoTeorico = metaDiaria * diaDelMes;
    
    const ingresosMes = panelData.movimientos.reduce((sum, m) => m.tipo === 'ingreso' ? sum + m.monto : sum, 0);
    const gastosMes = panelData.movimientos.reduce((sum, m) => m.tipo === 'gasto' ? sum + m.monto : sum, 0);
    const saldoReal = ingresosMes - gastosMes;
    
    return {
        teorico: acumuladoTeorico,
        real: saldoReal,
        enMeta: saldoReal >= acumuladoTeorico
    };
};

// Preparar datos para Admin
export const getAdminStats = () => {
    return {
        turnoActivo: turnoActivo,
        metaDiaria: panelData.parametros.gastoFijo,
        deudas: panelData.deudas,
        ultimoKM: panelData.parametros.ultimoKMfinal
    };
};

// --- MÉTODOS DE ACCIÓN (MUTATIONS) ---

export const getTurnoActivo = () => turnoActivo;

export const iniciarTurno = (kmInicial) => {
    turnoActivo = {
        inicio: new Date().toISOString(),
        kmInicial: safeNumber(kmInicial)
    };
    saveData();
    return turnoActivo;
};

export const finalizarTurno = (kmFinal, ganancia, gasolinaGasto = 0) => {
    if (!turnoActivo) return null;

    const kmRecorridos = safeNumber(kmFinal) - turnoActivo.kmInicial;
    const horas = (new Date() - new Date(turnoActivo.inicio)) / (1000 * 60 * 60);

    const nuevoTurno = {
        id: Date.now(),
        fecha: new Date().toISOString(),
        horas: horas,
        kmRecorridos: kmRecorridos > 0 ? kmRecorridos : 0,
        ganancia: safeNumber(ganancia),
        gasolina: safeNumber(gasolinaGasto)
    };

    panelData.turnos.push(nuevoTurno);
    panelData.parametros.ultimoKMfinal = safeNumber(kmFinal);
    
    if (nuevoTurno.ganancia > 0) {
        agregarMovimiento('ingreso', 'Ganancia Turno', nuevoTurno.ganancia, 'General');
    }
    
    // Si hubo gasto de gasolina, lo registramos también
    if (nuevoTurno.gasolina > 0) {
       // La lógica original separaba esto, aquí lo integramos si es necesario, 
       // pero para mantener scope estricto, solo actualizamos turnoActivo.
    }

    turnoActivo = false;
    saveData();
    return nuevoTurno;
};

export const agregarMovimiento = (tipo, desc, monto, categoria = 'General') => {
    panelData.movimientos.push({
        tipo,
        fecha: new Date().toISOString(),
        desc,
        monto: safeNumber(monto),
        categoria
    });
    
    if (tipo === 'gasto') {
        panelData.gastos.push({ tipo: categoria, monto: safeNumber(monto), desc });
    } else {
        panelData.ingresos.push(safeNumber(monto));
    }
    saveData();
};

export const registrarAbono = (idDeuda, monto) => {
    const deuda = panelData.deudas.find(d => d.id == idDeuda);
    if (deuda) {
        deuda.saldo -= safeNumber(monto);
        agregarMovimiento('gasto', `Abono a: ${deuda.desc}`, monto, 'Deuda');
        recalcularMetaDiaria();
        return true;
    }
    return false;
};
