/* 02_data.js */
import { STORAGE_KEY, DIAS_POR_FRECUENCIA, safeNumber } from './01_consts_utils.js';

const DEFAULT_PANEL_DATA = {
    ingresos: [],
    gastos: [],       // Lista detallada de gastos
    turnos: [],       // Historial de turnos
    movimientos: [],  // Historial plano para tabla
    cargasCombustible: [], // Historial específico de gasolina
    deudas: [],
    gastosFijosMensuales: [],
    parametros: {
        deudaTotal: 0,
        gastoFijo: 0, // Meta calculada
        ultimoKMfinal: 0,
        costoPorKm: 0, // Métrica clave
        litrosPor100: 0
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
            console.error("Error data", e);
        }
    }
    recalcularMetaDiaria();
};

// --- LÓGICA DE TURNOS (Con Horas Exactas) ---

export const iniciarTurno = (kmInicial) => {
    // Guardamos TIMESTAMP exacto
    turnoActivo = {
        inicio: new Date().getTime(), 
        kmInicial: safeNumber(kmInicial)
    };
    saveData();
    return turnoActivo;
};

export const finalizarTurno = (kmFinal, ganancia) => {
    if (!turnoActivo) return null;

    const ahora = new Date().getTime();
    const kmRecorridos = safeNumber(kmFinal) - turnoActivo.kmInicial;
    
    // Cálculo exacto de horas con decimales
    const diffMs = ahora - turnoActivo.inicio;
    const horasExactas = diffMs / (1000 * 60 * 60);

    const nuevoTurno = {
        id: Date.now(),
        fecha: new Date().toISOString(), // ISO para ordenamiento
        inicioTs: turnoActivo.inicio,
        finTs: ahora,
        horas: horasExactas, // Guardamos float preciso
        kmRecorridos: kmRecorridos > 0 ? kmRecorridos : 0,
        ganancia: safeNumber(ganancia)
    };

    panelData.turnos.push(nuevoTurno);
    
    // Actualizamos Odómetro Global
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

// --- LÓGICA DE GASOLINA (Cálculo Real Punto A -> Punto B) ---

export const registrarGasolina = (litros, costoTotal, kmActual) => {
    litros = safeNumber(litros);
    costoTotal = safeNumber(costoTotal);
    kmActual = safeNumber(kmActual);

    // 1. Buscar la carga ANTERIOR para sacar la diferencia de KM
    // Ordenamos por si acaso, aunque deberían entrar en orden
    const cargasPrevias = panelData.cargasCombustible.sort((a,b) => new Date(a.fecha) - new Date(b.fecha));
    const ultimaCarga = cargasPrevias[cargasPrevias.length - 1];

    let rendimiento = 0;
    let costoKmReal = 0;

    if (ultimaCarga) {
        const distRecorrida = kmActual - ultimaCarga.km;
        if (distRecorrida > 0) {
            // Rendimiento: Km recorridos con los litros ANTERIORES (estimado) 
            // O Costo Real: Costo de ESTA carga / Km recorridos desde la anterior
            // Usaremos: Cuánto me costó recorrer estos KM.
            costoKmReal = costoTotal / distRecorrida;
            
            // Actualizamos la métrica global
            panelData.parametros.costoPorKm = costoKmReal;
        }
    }

    // 2. Guardar registro
    panelData.cargasCombustible.push({
        fecha: new Date().toISOString(),
        litros: litros,
        costo: costoTotal,
        km: kmActual,
        costoKmCalculado: costoKmReal
    });

    // 3. Actualizar odómetro si es mayor
    if (kmActual > panelData.parametros.ultimoKMfinal) {
        panelData.parametros.ultimoKMfinal = kmActual;
    }

    // 4. Registrar como gasto
    agregarMovimiento('gasto', 'Carga Gasolina', costoTotal, 'Moto');
    saveData();
    
    return { costoKmReal, kmActual };
};

// --- GASTOS INTELIGENTES Y META ---

export const agregarMovimiento = (tipo, desc, monto, categoria) => {
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

export const agregarGastoRecurrente = (nombre, monto, frecuencia, diaPago) => {
    // Guardamos en una lista especial para recálculo de meta
    panelData.gastosFijosMensuales.push({
        desc: nombre,
        monto: safeNumber(monto),
        frecuencia: frecuencia,
        diaPago: diaPago // Info extra para notificaciones futuras
    });
    
    // También registramos el gasto del "primer mes" u hoy si se desea? 
    // Por ahora solo configuramos la recurrencia para la Meta.
    recalcularMetaDiaria();
};

export const recalcularMetaDiaria = () => {
    // 1. Fijos
    const totalFijosDiarios = panelData.gastosFijosMensuales.reduce((sum, g) => {
        const dias = DIAS_POR_FRECUENCIA[g.frecuencia] || 30;
        return sum + (safeNumber(g.monto) / dias);
    }, 0);

    // 2. Deudas
    const totalDeudasDiarias = panelData.deudas.reduce((sum, d) => {
        if (d.saldo <= 0) return sum;
        const dias = DIAS_POR_FRECUENCIA[d.frecuencia] || 30;
        return sum + (safeNumber(d.montoCuota) / dias);
    }, 0);

    panelData.parametros.gastoFijo = totalFijosDiarios + totalDeudasDiarias;
    saveData();
};

// --- GETTERS DE ESTADÍSTICAS ---
// (Mismos del refactor anterior, necesarios para render)
export const getDashboardStats = () => { /* ... se mantiene igual ... */ 
    const hoy = new Date();
    const isToday = (d) => { const x = new Date(d); return x.getDate()===hoy.getDate() && x.getMonth()===hoy.getMonth() && x.getFullYear()===hoy.getFullYear(); };
    
    const turnosHoy = panelData.turnos.filter(t => isToday(t.fecha));
    const movsHoy = panelData.movimientos.filter(m => isToday(m.fecha));
    
    return {
        horasHoy: turnosHoy.reduce((a,t) => a + t.horas, 0),
        gananciaHoy: movsHoy.filter(m => m.tipo==='ingreso').reduce((a,m)=>a+m.monto, 0),
        meta: panelData.parametros.gastoFijo,
        progreso: panelData.parametros.gastoFijo > 0 ? (movsHoy.filter(m=>m.tipo==='ingreso').reduce((a,m)=>a+m.monto,0) / panelData.parametros.gastoFijo)*100 : 0,
        alertas: [],
        turnosRecientes: panelData.turnos.slice(-5).reverse()
    };
};

export const getAdminStats = () => ({
    turnoActivo,
    metaDiaria: panelData.parametros.gastoFijo,
    deudas: panelData.deudas,
    ultimoKM: panelData.parametros.ultimoKMfinal
});
