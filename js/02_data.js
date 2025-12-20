// 02_data.js
import { STORAGE_KEY, DIAS_POR_FRECUENCIA, safeNumber } from "./01_consts_utils.js";

/* =========================
   ESTRUCTURA BASE
========================= */
const DEFAULT_DATA = {
    turnos: [],
    movimientos: [],
    cargasCombustible: [],
    deudas: [],
    gastosFijosMensuales: [],
    parametros: {
        gastoFijo: 0,
        ultimoKM: 0,
        costoPorKm: 0
    }
};

let state = JSON.parse(JSON.stringify(DEFAULT_DATA));
let turnoActivo = JSON.parse(localStorage.getItem("turnoActivo")) || null;

/* =========================
   PERSISTENCIA
========================= */
export const loadData = () => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
        try {
            state = { ...DEFAULT_DATA, ...JSON.parse(raw) };
        } catch {
            state = JSON.parse(JSON.stringify(DEFAULT_DATA));
        }
    }
};

export const saveData = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

export const getState = () => state;
export const getTurnoActivo = () => turnoActivo;

/* =========================
   TURNOS
========================= */
export const iniciarTurno = () => {
    if (turnoActivo) return false;
    turnoActivo = { inicio: new Date().toISOString() };
    localStorage.setItem("turnoActivo", JSON.stringify(turnoActivo));
    return true;
};

export const finalizarTurno = (ganancia, kmFinal) => {
    if (!turnoActivo) return false;

    const fin = new Date();
    const horas = (fin - new Date(turnoActivo.inicio)) / 36e5;

    const turno = {
        fecha: fin.toISOString(),
        horas,
        ganancia: safeNumber(ganancia),
        kmFinal: safeNumber(kmFinal)
    };

    state.turnos.push(turno);
    state.movimientos.push({
        tipo: "ingreso",
        fecha: fin.toISOString(),
        desc: "Turno",
        monto: turno.ganancia
    });

    if (turno.kmFinal > 0) state.parametros.ultimoKM = turno.kmFinal;

    turnoActivo = null;
    localStorage.removeItem("turnoActivo");
    saveData();
    return true;
};

/* =========================
   GASTOS Y DEUDAS
========================= */
export const agregarGastoFijo = (g) => {
    state.gastosFijosMensuales.push(g);
    recalcularMetaDiaria();
};

export const agregarDeuda = (d) => {
    state.deudas.push(d);
    recalcularMetaDiaria();
};

export const agregarGasto = (g) => {
    state.movimientos.push({
        tipo: "gasto",
        fecha: g.fecha,
        desc: g.categoria,
        monto: safeNumber(g.monto)
    });
    saveData();
};

/* =========================
   WALLET (VERSIÓN SIMPLE Y ESTABLE)
========================= */
export const getWalletData = () => {
    const totalIngresos = state.movimientos
        .filter(m => m.tipo === "ingreso")
        .reduce((a, b) => a + safeNumber(b.monto), 0);

    const totalGastos = state.movimientos
        .filter(m => m.tipo === "gasto")
        .reduce((a, b) => a + safeNumber(b.monto), 0);

    const sobres = [];

    state.gastosFijosMensuales.forEach(g => {
        const dias = DIAS_POR_FRECUENCIA[g.frecuencia] || 30;
        sobres.push({
            nombre: g.categoria,
            diario: safeNumber(g.monto) / dias,
            acumulado: safeNumber(g.monto),
            tipo: "Fijo"
        });
    });

    state.deudas.forEach(d => {
        if (d.saldo > 0) {
            sobres.push({
                nombre: d.desc,
                diario: safeNumber(d.montoCuota),
                acumulado: safeNumber(d.saldo),
                tipo: "Deuda"
            });
        }
    });

    const totalObligado = sobres.reduce((a, s) => a + s.acumulado, 0);

    return {
        sobres,
        totales: {
            ingresos: totalIngresos,
            gastos: totalGastos,
            obligado: totalObligado,
            disponible: totalIngresos - totalGastos
        }
    };
};

/* =========================
   META DIARIA
========================= */
export const recalcularMetaDiaria = () => {
    const fijos = state.gastosFijosMensuales.reduce((a, g) => {
        const d = DIAS_POR_FRECUENCIA[g.frecuencia] || 30;
        return a + safeNumber(g.monto) / d;
    }, 0);

    const deudas = state.deudas.reduce((a, d) => {
        if (d.saldo <= 0) return a;
        const dpf = DIAS_POR_FRECUENCIA[d.frecuencia] || 30;
        return a + safeNumber(d.montoCuota) / dpf;
    }, 0);

    state.parametros.gastoFijo = fijos + deudas;
    saveData();
};
