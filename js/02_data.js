/* 02_data.js */
import { STORAGE_KEY, DIAS_POR_FRECUENCIA, safeNumber } from './01_consts_utils.js';

const DEFAULT_PANEL_DATA = {
    ingresos: [],
    gastos: [],
    turnos: [],
    movimientos: [], // Historial plano
    cargasCombustible: [],
    deudas: [],
    gastosFijosMensuales: [], // Objetos de gastos recurrentes
    parametros: {
        deudaTotal: 0,
        gastoFijo: 0, // Meta calculada
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
            // Merge profundo simple para evitar perder parámetros nuevos si actualizamos versión
            panelData = { ...DEFAULT_PANEL_DATA, ...parsed, parametros: { ...DEFAULT_PANEL_DATA.parametros, ...parsed.parametros } };
        } catch (e) {
            console.error("Error cargando datos, reiniciando...", e);
            panelData = JSON.parse(JSON.stringify(DEFAULT_PANEL_DATA));
        }
    }
    recalcularMetaDiaria(); // Asegurar consistencia al cargar
};

// --- LÓGICA DE NEGOCIO ---

// 1. Meta Diaria (Core Logic)
export const recalcularMetaDiaria = () => {
    // A. Gastos Fijos (Prorrateados a diario)
    const totalFijosMensuales = panelData.gastosFijosMensuales.reduce((sum, g) => {
        const dias = DIAS_POR_FRECUENCIA[g.frecuencia] || 30; // Fallback mensual
        return sum + (safeNumber(g.monto) / dias);
    }, 0);

    // B. Deudas (Cuota diaria)
    const aporteDeudasDiario = panelData.deudas.reduce((sum, d) => {
        if (d.saldo <= 0) return sum; // Deuda pagada no suma
        const dias = DIAS_POR_FRECUENCIA[d.frecuencia] || 30;
        return sum + (safeNumber(d.montoCuota) / dias);
    }, 0);

    panelData.parametros.gastoFijo = totalFijosMensuales + aporteDeudasDiario;
    saveData();
    return panelData.parametros.gastoFijo;
};

// 2. Turnos
export const getTurnoActivo = () => turnoActivo;

export const iniciarTurno = (kmInicial) => {
    turnoActivo = {
        inicio: new Date().toISOString(),
        kmInicial: safeNumber(kmInicial)
    };
    saveData();
};

export const finalizarTurno = (kmFinal, ganancia, gasolinaGasto = 0) => {
    if (!turnoActivo) return;

    const kmRecorridos = safeNumber(kmFinal) - turnoActivo.kmInicial;
    const horas = (new Date() - new Date(turnoActivo.inicio)) / (1000 * 60 * 60);

    const nuevoTurno = {
        id: Date.now(),
        fecha: new Date().toISOString(),
        horas: horas,
        kmRecorridos: kmRecorridos > 0 ? kmRecorridos : 0,
        ganancia: safeNumber(ganancia),
        gasolina: safeNumber(gasolinaGasto) // Gasto gasolina durante el turno (opcional)
    };

    panelData.turnos.push(nuevoTurno);
    // Actualizar odómetro global
    panelData.parametros.ultimoKMfinal = safeNumber(kmFinal);
    
    // Registrar Ingreso en Movimientos
    if (nuevoTurno.ganancia > 0) {
        panelData.movimientos.push({
            tipo: 'ingreso',
            fecha: nuevoTurno.fecha,
            desc: 'Ganancia Turno',
            monto: nuevoTurno.ganancia
        });
        panelData.ingresos.push(nuevoTurno.ganancia); // Para gráfica simple
    }

    turnoActivo = false;
    saveData();
};

// 3. Gastos y Deudas
export const agregarMovimiento = (tipo, desc, monto, categoria = 'General') => {
    panelData.movimientos.push({
        tipo, // 'gasto' o 'ingreso'
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

export const agregarDeuda = (deuda) => {
    panelData.deudas.push(deuda);
    recalcularMetaDiaria();
};

export const registrarAbono = (idDeuda, monto) => {
    const deuda = panelData.deudas.find(d => d.id == idDeuda);
    if (deuda) {
        deuda.saldo -= safeNumber(monto);
        agregarMovimiento('gasto', `Abono a: ${deuda.desc}`, monto, 'Deuda');
        recalcularMetaDiaria();
    }
};

// 4. Gasolina y Métricas
export const agregarCargaGasolina = (litros, costo, kmActual) => {
    panelData.cargasCombustible.push({
        fecha: new Date().toISOString(),
        litros: safeNumber(litros),
        costo: safeNumber(costo),
        km: safeNumber(kmActual)
    });
    
    // Recalcular Costo por KM (Histórico simplificado)
    if (panelData.cargasCombustible.length > 1) {
        const totalPesos = panelData.cargasCombustible.reduce((sum, c) => sum + c.costo, 0);
        const minKm = panelData.cargasCombustible[0].km;
        const maxKm = safeNumber(kmActual);
        const deltaKm = maxKm - minKm;
        
        if (deltaKm > 0) {
            panelData.parametros.costoPorKm = totalPesos / deltaKm;
        }
    }
    
    // Actualizar odómetro global si es mayor
    if (kmActual > panelData.parametros.ultimoKMfinal) {
        panelData.parametros.ultimoKMfinal = kmActual;
    }
    
    agregarMovimiento('gasto', 'Carga de Gasolina', costo, 'Gasolina');
};
