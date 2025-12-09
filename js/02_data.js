// 02_data.js
import { STORAGE_KEY, DIAS_POR_FRECUENCIA, safeNumber } from './01_consts_utils.js';

const DEFAULT_DATA = {
    ingresos: [], gastos: [], turnos: [], movimientos: [],
    cargasCombustible: [], deudas: [], gastosFijosMensuales: [],
    parametros: {
        deudaTotal: 0,
        gastoFijo: 0,
        ultimoKM: 0,
        costoPorKm: 0,
        mantenimientoBase: {
            'Aceite': 3000,
            'Bujía': 8000,
            'Llantas': 15000
        }
    }
};

let state = JSON.parse(JSON.stringify(DEFAULT_DATA));
let turnoActivo = JSON.parse(localStorage.getItem("turnoActivo")) || null;

// -------------------------------------------------------------
//                LOAD DATA + MIGRACIONES
// -------------------------------------------------------------
export const loadData = () => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
        try {
            state = { ...state, ...JSON.parse(raw) };
        } catch (e) {
            console.error("❌ Error parsing data:", e);
        }
    }

    // Arrays obligatorios
    [
        'ingresos', 'gastos', 'turnos', 'movimientos',
        'cargasCombustible', 'deudas', 'gastosFijosMensuales'
    ].forEach(k => {
        if (!Array.isArray(state[k])) state[k] = [];
    });

    // Objeto de parámetros
    if (!state.parametros) state.parametros = DEFAULT_DATA.parametros;

    // MIGRACIÓN: mantenimientoBase faltante
    if (!state.parametros.mantenimientoBase) {
        state.parametros.mantenimientoBase = {
            'Aceite': 3000,
            'Bujía': 8000,
            'Llantas': 15000
        };
    }

    state.parametros.ultimoKM = safeNumber(state.parametros.ultimoKM);

    recalcularMetaDiaria();
    calcularCostoPorKm();
};

// -------------------------------------------------------------
//                SAVE + GETTERS
// -------------------------------------------------------------
export const saveData = () =>
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

export const getState = () => state;
export const getTurnoActivo = () => turnoActivo;

// -------------------------------------------------------------
//               META DIARIA (FIJOS + DEUDAS)
// -------------------------------------------------------------
export const recalcularMetaDiaria = () => {
    const fijos = state.gastosFijosMensuales.reduce((acc, i) =>
        acc + (safeNumber(i.monto) / (DIAS_POR_FRECUENCIA[i.frecuencia] || 30))
    , 0);

    const deudas = state.deudas.reduce((acc, d) =>
        d.saldo > 0
            ? acc + (safeNumber(d.montoCuota) /
                    (DIAS_POR_FRECUENCIA[d.frecuencia] || 30))
            : acc
    , 0);

    state.parametros.gastoFijo = fijos + deudas;
    saveData();
    return state.parametros.gastoFijo;
};

// -------------------------------------------------------------
//                COSTO POR KM (PROMEDIO REAL)
// -------------------------------------------------------------
const calcularCostoPorKm = () => {
    const cargas = state.cargasCombustible;

    if (cargas.length < 2) {
        state.parametros.costoPorKm = 0;
        return 0;
    }

    const cargasOrdenadas = [...cargas].sort(
        (a, b) => safeNumber(a.km) - safeNumber(b.km)
    );

    const kmRecorrido =
        safeNumber(cargasOrdenadas[cargasOrdenadas.length - 1].km) -
        safeNumber(cargasOrdenadas[0].km);

    if (kmRecorrido <= 0) {
        state.parametros.costoPorKm = 0;
        return 0;
    }

    const costoTotal = cargas.reduce(
        (sum, c) => sum + safeNumber(c.costo), 0
    );

    const costoPorKm = costoTotal / kmRecorrido;
    state.parametros.costoPorKm = costoPorKm;

    return costoPorKm;
};

// -------------------------------------------------------------
//                   TURNOS / SESIONES
// -------------------------------------------------------------
export const iniciarTurnoLogic = () => {
    if (turnoActivo) return false;

    turnoActivo = {
        inicio: new Date().toISOString()
    };

    localStorage.setItem("turnoActivo", JSON.stringify(turnoActivo));
    return true;
};

export const finalizarTurnoLogic = (ganancia) => {
    if (!turnoActivo) return;

    const fin = new Date();

    const t = {
        fecha: fin.toISOString(),
        inicio: turnoActivo.inicio,
        fin: fin.toISOString(),
        horas: (fin - new Date(turnoActivo.inicio)) / 36e5,
        ganancia: safeNumber(ganancia)
    };

    state.turnos.push(t);

    if (t.ganancia > 0) {
        state.movimientos.push({
            tipo: 'ingreso',
            fecha: t.fecha,
            desc: 'Cierre Turno',
            monto: t.ganancia
        });
    }

    turnoActivo = null;
    localStorage.removeItem("turnoActivo");
    saveData();
};

// -------------------------------------------------------------
//               ODOMETRO MANUAL
// -------------------------------------------------------------
export const actualizarOdometroManual = (kmInput) => {
    const nk = safeNumber(kmInput);

    if (state.parametros.ultimoKM > 0 && nk < state.parametros.ultimoKM) {
        alert("Error: El KM no puede bajar.");
        return false;
    }

    state.parametros.ultimoKM = nk;
    saveData();
    return true;
};

// -------------------------------------------------------------
//               CARGAS DE GASOLINA
// -------------------------------------------------------------
export const registrarCargaGasolina = (litros, costo, km) => {
    actualizarOdometroManual(km);

    state.cargasCombustible.push({
        fecha: new Date().toISOString(),
        litros: safeNumber(litros),
        costo: safeNumber(costo),
        km: safeNumber(km)
    });

    calcularCostoPorKm();
    saveData();
};

// -------------------------------------------------------------
//               CONFIGURACIÓN DE MANTENIMIENTO
// -------------------------------------------------------------
export const guardarConfigMantenimiento = (aceite, bujia, llantas) => {
    state.parametros.mantenimientoBase = {
        'Aceite': safeNumber(aceite),
        'Bujía': safeNumber(bujia),
        'Llantas': safeNumber(llantas)
    };
    saveData();
};

// -------------------------------------------------------------
//              AGREGAR DEUDA, GASTO, INGRESO, MOVIMIENTO
// -------------------------------------------------------------
export const agregarDeuda = (d) => {
    state.deudas.push(d);
    recalcularMetaDiaria();
    saveData();
};

export const agregarGasto = (g) => {
    state.gastos.push(g);
    state.movimientos.push({
        tipo: 'gasto',
        fecha: g.fecha || new Date().toISOString(),
        desc: g.desc,
        monto: safeNumber(g.monto)
    });
    saveData();
};

export const agregarIngreso = (i) => {
    state.ingresos.push(i);
    state.movimientos.push({
        tipo: 'ingreso',
        fecha: i.fecha || new Date().toISOString(),
        desc: i.desc,
        monto: safeNumber(i.monto)
    });
    saveData();
};
