/* 02_data.js */
import { STORAGE_KEY, DIAS_POR_FRECUENCIA, safeNumber, isSameDay } from './01_consts_utils.js';

const DEFAULT_PANEL_DATA = {
    ingresos: [],
    gastos: [],
    turnos: [],
    movimientos: [], // Historial plano
    cargasCombustible: [], // Array crítico para rendimiento
    deudas: [],
    gastosFijosMensuales: [], // Objetos para Meta Diaria
    parametros: {
        gastoFijo: 0, // Meta Diaria Calculada
        ultimoKMfinal: 0, // Odómetro global
        costoPorKm: 0, // Métrica de rendimiento
        mantenimientoBase: { 'Aceite (KM)': 3000, 'Bujía (KM)': 8000 }
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
        } catch (e) { console.error("Error data", e); }
    }
    recalcularMetaDiaria();
};

// ==========================================
// A. LÓGICA DE META DIARIA (Killer Feature)
// ==========================================
export const recalcularMetaDiaria = () => {
    // 1. Gastos Fijos (Prorrateo)
    const totalFijosDiarios = panelData.gastosFijosMensuales.reduce((sum, g) => {
        const dias = DIAS_POR_FRECUENCIA[g.frecuencia] || 30;
        return sum + (safeNumber(g.monto) / dias);
    }, 0);

    // 2. Deudas (Cuota Diaria)
    const totalDeudasDiarias = panelData.deudas.reduce((sum, d) => {
        if (d.saldo <= 0) return sum;
        const dias = DIAS_POR_FRECUENCIA[d.frecuencia] || 30;
        return sum + (safeNumber(d.montoCuota) / dias);
    }, 0);

    panelData.parametros.gastoFijo = totalFijosDiarios + totalDeudasDiarias;
    saveData();
    return panelData.parametros.gastoFijo;
};

// ==========================================
// B. LÓGICA DE GASOLINA (Rendimiento Real)
// ==========================================
export const registrarGasolina = (litros, costoTotal, kmActual) => {
    litros = safeNumber(litros);
    costoTotal = safeNumber(costoTotal);
    kmActual = safeNumber(kmActual);

    // Buscar carga anterior para delta KM
    const cargasOrdenadas = panelData.cargasCombustible.sort((a,b) => new Date(a.fecha) - new Date(b.fecha));
    const ultimaCarga = cargasOrdenadas[cargasOrdenadas.length - 1];

    let costoKmReal = 0;

    if (ultimaCarga && kmActual > ultimaCarga.km) {
        const distancia = kmActual - ultimaCarga.km;
        // Rendimiento = Costo de ESTA carga / Distancia recorrida desde la ANTERIOR
        // (Asumiendo tanque lleno/constante, es la mejor aproximación offline)
        costoKmReal = costoTotal / distancia;
        
        // Actualizar métrica global
        panelData.parametros.costoPorKm = costoKmReal;
    }

    // Guardar registro
    panelData.cargasCombustible.push({
        fecha: new Date().toISOString(),
        litros: litros,
        costo: costoTotal,
        km: kmActual,
        rendimientoCalc: costoKmReal
    });

    // Actualizar Odómetro y registrar Gasto
    if (kmActual > panelData.parametros.ultimoKMfinal) {
        panelData.parametros.ultimoKMfinal = kmActual;
    }
    agregarMovimiento('gasto', '⛽ Gasolina', costoTotal, 'Moto');
    
    return { costoKmReal, kmActual };
};

// ==========================================
// C. LÓGICA DE TURNOS (Exactitud)
// ==========================================
export const iniciarTurno = (kmInicial) => {
    turnoActivo = {
        inicio: new Date().getTime(), // Timestamp exacto
        kmInicial: safeNumber(kmInicial)
    };
    saveData();
    return turnoActivo;
};

export const finalizarTurno = (kmFinal, ganancia) => {
    if (!turnoActivo) return null;
    const ahora = new Date().getTime();
    
    const kmRecorridos = safeNumber(kmFinal) - turnoActivo.kmInicial;
    const horasExactas = (ahora - turnoActivo.inicio) / (1000 * 60 * 60); // Decimales

    const nuevoTurno = {
        id: Date.now(),
        fecha: new Date().toISOString(),
        inicioTs: turnoActivo.inicio,
        finTs: ahora,
        horas: horasExactas,
        kmRecorridos: kmRecorridos > 0 ? kmRecorridos : 0,
        ganancia: safeNumber(ganancia)
    };

    panelData.turnos.push(nuevoTurno);
    
    // Actualizar Odómetro Global
    if (safeNumber(kmFinal) > panelData.parametros.ultimoKMfinal) {
        panelData.parametros.ultimoKMfinal = safeNumber(kmFinal);
    }

    // Registrar Ingreso
    if (nuevoTurno.ganancia > 0) {
        agregarMovimiento('ingreso', 'Ganancia Turno', nuevoTurno.ganancia, 'Operativo');
    }

    turnoActivo = false;
    saveData();
    return nuevoTurno;
};

// --- GESTIÓN DE MOVIMIENTOS Y OBLIGACIONES ---
export const agregarMovimiento = (tipo, desc, monto, categoria) => {
    panelData.movimientos.push({
        tipo,
        fecha: new Date().toISOString(),
        desc,
        monto: safeNumber(monto),
        categoria
    });
    // Sincronizar con arrays simples para gráficas rápidas
    if (tipo === 'gasto') panelData.gastos.push({ tipo: categoria, monto: safeNumber(monto), desc });
    else panelData.ingresos.push(safeNumber(monto));
    
    saveData();
};

export const agregarGastoRecurrente = (desc, monto, frecuencia, diaPago) => {
    panelData.gastosFijosMensuales.push({ desc, monto, frecuencia, diaPago });
    recalcularMetaDiaria();
};

export const registrarAbono = (idDeuda, monto) => {
    const deuda = panelData.deudas.find(d => d.id == idDeuda);
    if (deuda) {
        deuda.saldo -= safeNumber(monto);
        agregarMovimiento('gasto', `Abono: ${deuda.desc}`, monto, 'Deuda');
        recalcularMetaDiaria();
    }
};

// --- ESTADÍSTICAS PARA UI ---
export const getDashboardStats = () => {
    const hoy = new Date();
    const movsHoy = panelData.movimientos.filter(m => isSameDay(m.fecha, hoy));
    const turnosHoy = panelData.turnos.filter(t => isSameDay(t.fecha, hoy));
    
    const ganancia = movsHoy.filter(m => m.tipo === 'ingreso').reduce((a, b) => a + b.monto, 0);
    const meta = panelData.parametros.gastoFijo;
    
    return {
        horasHoy: turnosHoy.reduce((a, b) => a + b.horas, 0),
        gananciaHoy: ganancia,
        meta: meta,
        progreso: meta > 0 ? (ganancia / meta) * 100 : 0,
        turnosRecientes: panelData.turnos.slice(-5).reverse()
    };
};

export const getWalletStats = () => {
    const diaActual = new Date().getDate();
    const metaDiaria = panelData.parametros.gastoFijo;
    const deberiasTener = metaDiaria * diaActual;

    // Calcular Neto del Mes Actual
    const ahora = new Date();
    const movsMes = panelData.movimientos.filter(m => {
        const d = new Date(m.fecha);
        return d.getMonth() === ahora.getMonth() && d.getFullYear() === ahora.getFullYear();
    });

    const ingresosMes = movsMes.filter(m => m.tipo === 'ingreso').reduce((a,b) => a+b.monto, 0);
    const gastosMes = movsMes.filter(m => m.tipo === 'gasto').reduce((a,b) => a+b.monto, 0);
    const tienesRealmente = ingresosMes - gastosMes;

    return { deberiasTener, tienesRealmente, enMeta: tienesRealmente >= deberiasTener };
};
