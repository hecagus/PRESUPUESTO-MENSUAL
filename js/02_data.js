import { STORAGE_KEY, FRECUENCIAS, safeFloat, uuid } from './01_consts_utils.js';

// ESTADO INICIAL (Schema)
const INITIAL_STATE = {
    turnos: [],
    movimientos: [],
    cargasCombustible: [],
    deudas: [],
    gastosFijosMensuales: [], // Recurrentes
    parametros: {
        gastoFijo: 0, // Meta diaria calculada
        ultimoKM: 0,
        costoPorKm: 0,
        mantenimientoBase: {}
    },
    turnoActivo: null // Objeto o null
};

let store = JSON.parse(JSON.stringify(INITIAL_STATE));

// --- PERSISTENCIA ---
export const loadData = () => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
        try {
            const parsed = JSON.parse(raw);
            // Merge defensivo para evitar perder estructura si actualizamos código
            store = { ...INITIAL_STATE, ...parsed, parametros: { ...INITIAL_STATE.parametros, ...parsed.parametros } };
        } catch (e) {
            console.error("Error cargando datos, se inicia limpio", e);
        }
    }
    recalcularMetaDiaria();
};

export const saveData = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
};

export const getStore = () => store;

// --- IMPORTAR JSON HISTÓRICO ---
export const importJSON = (jsonString) => {
    try {
        const data = JSON.parse(jsonString);
        // Validar estructura básica
        if(!data.turnos || !data.movimientos) throw new Error("JSON inválido");
        store = { ...INITIAL_STATE, ...data };
        saveData();
        return true;
    } catch (e) {
        return false;
    }
};

// --- LÓGICA DE NEGOCIO ---

// 1. Meta Diaria (Fórmula: (GastosFijos + Deudas) / Dias)
export const recalcularMetaDiaria = () => {
    let sumaDiaria = 0;

    // Gastos fijos (recurrencia)
    store.gastosFijosMensuales.forEach(g => {
        const dias = FRECUENCIAS[g.frecuencia] || 30;
        sumaDiaria += (safeFloat(g.monto) / dias);
    });

    // Deudas (Cuota / Frecuencia)
    store.deudas.forEach(d => {
        if(d.saldo > 0) {
            const dias = FRECUENCIAS[d.frecuencia] || 30;
            sumaDiaria += (safeFloat(d.montoCuota) / dias);
        }
    });

    store.parametros.gastoFijo = sumaDiaria;
    saveData();
    return sumaDiaria;
};

// 2. Turnos
export const iniciarTurno = () => {
    if(store.turnoActivo) return;
    store.turnoActivo = {
        inicio: Date.now(),
        kmInicial: store.parametros.ultimoKM
    };
    saveData();
};

export const finalizarTurno = (kmFinal, ganancia) => {
    if(!store.turnoActivo) return;
    const fin = Date.now();
    const inicio = store.turnoActivo.inicio;
    const horas = (fin - inicio) / (1000 * 60 * 60);
    const kmRecorrido = safeFloat(kmFinal) - store.turnoActivo.kmInicial;

    const nuevoTurno = {
        fecha: new Date().toISOString(),
        inicio: new Date(inicio).toISOString(),
        fin: new Date(fin).toISOString(),
        horas: horas,
        ganancia: safeFloat(ganancia),
        kmFinal: safeFloat(kmFinal)
    };

    store.turnos.push(nuevoTurno);
    
    // Registrar ingreso
    agregarMovimiento('ingreso', 'Turno Finalizado', ganancia, 'Operativo', 'Turno');
    
    // Actualizar odómetro
    if(safeFloat(kmFinal) > store.parametros.ultimoKM) {
        store.parametros.ultimoKM = safeFloat(kmFinal);
    }

    store.turnoActivo = null;
    saveData();
};

// 3. Combustible (Lógica de Costo/KM)
export const registrarGasolina = (litros, costo, kmActual) => {
    const costoNum = safeFloat(costo);
    const kmNum = safeFloat(kmActual);
    const prevKm = store.parametros.ultimoKM;

    // Cálculo de rendimiento si es posible
    let rendimiento = 0;
    if (prevKm > 0 && kmNum > prevKm) {
        const distancia = kmNum - prevKm;
        rendimiento = costoNum / distancia; // $ por KM
        store.parametros.costoPorKm = rendimiento; // Actualizar global
    }

    store.cargasCombustible.push({
        fecha: new Date().toISOString(),
        litros: safeFloat(litros),
        costo: costoNum,
        km: kmNum
    });

    // Impacto financiero: Gasto Operativo
    agregarMovimiento('gasto', '⛽ Gasolina', costoNum, 'Operativo', 'Combustible');
    
    // Actualizar odómetro
    if(kmNum > store.parametros.ultimoKM) {
        store.parametros.ultimoKM = kmNum;
    }
    saveData();
};

// 4. Finanzas Generales
export const agregarMovimiento = (tipo, desc, monto, grupo = 'Personal', cat = 'General') => {
    store.movimientos.push({
        id: uuid(),
        tipo, // 'ingreso' | 'gasto'
        fecha: new Date().toISOString(),
        desc,
        monto: safeFloat(monto),
        grupo, // 'operativo' | 'personal'
        categoria: cat
    });
    saveData();
};

export const agregarDeuda = (desc, total, cuota, frecuencia) => {
    store.deudas.push({
        id: uuid(),
        desc,
        montoTotal: safeFloat(total),
        montoCuota: safeFloat(cuota),
        frecuencia,
        saldo: safeFloat(total)
    });
    recalcularMetaDiaria();
};

export const abonarDeuda = (idDeuda, monto) => {
    const deuda = store.deudas.find(d => d.id === idDeuda);
    if(deuda) {
        deuda.saldo -= safeFloat(monto);
        if(deuda.saldo < 0) deuda.saldo = 0;
        agregarMovimiento('gasto', `Abono: ${deuda.desc}`, monto, 'Personal', 'Deuda');
        recalcularMetaDiaria();
    }
};

// 5. Configuración Inicial (Onboarding)
export const setUltimoKM = (km) => {
    store.parametros.ultimoKM = safeFloat(km);
    saveData();
};
