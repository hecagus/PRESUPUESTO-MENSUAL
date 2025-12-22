import { STORAGE_KEY, FRECUENCIAS, safeFloat, uuid } from './01_consts_utils.js';

const INITIAL_STATE = {
    turnos: [],
    movimientos: [],
    cargasCombustible: [],
    deudas: [],
    gastosFijosMensuales: [], // Recurrentes (Reglas)
    wallet: {
        saldo: 0, // El "Sobre" acumulado
        historial: [] 
    },
    parametros: {
        metaDiaria: 0,
        ultimoKM: 0,
        costoPorKm: 0, // Se ajusta con cada carga
        promedioDiarioKm: 100 // Estimado inicial para meta
    },
    turnoActivo: null,
    _version: 1
};

let store = JSON.parse(JSON.stringify(INITIAL_STATE));

// --- PERSISTENCIA ---
export const loadData = () => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
        try {
            const parsed = JSON.parse(raw);
            store = { ...INITIAL_STATE, ...parsed, parametros: { ...INITIAL_STATE.parametros, ...parsed.parametros } };
        } catch(e) { console.error(e); }
    }
    recalcularMetaDiaria();
};

export const saveData = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
export const getStore = () => store;

export const importJSON = (jsonString) => {
    try {
        const data = JSON.parse(jsonString);
        if(!data.turnos || !data.movimientos) throw new Error("JSON inválido");
        store = { ...INITIAL_STATE, ...data };
        saveData();
        return true;
    } catch (e) { return false; }
};

// --- LÓGICA FINANCIERA (HARDCORE) ---

// 1. Meta Diaria = (Fijos + Deudas + GasolinaEstimada) / Días
export const recalcularMetaDiaria = () => {
    let costoDiarioFijos = 0;

    // A. Gastos Recurrentes (Hogar/Operativo Fijo)
    store.gastosFijosMensuales.forEach(g => {
        const dias = FRECUENCIAS[g.frecuencia] || 30;
        if(dias > 0) costoDiarioFijos += (safeFloat(g.monto) / dias);
    });

    // B. Deudas
    store.deudas.forEach(d => {
        if(d.saldo > 0) {
            const dias = FRECUENCIAS[d.frecuencia] || 30;
            if(dias > 0) costoDiarioFijos += (safeFloat(d.montoCuota) / dias);
        }
    });

    // C. Gasolina Estimada (Prorrateo preventivo para la Meta)
    const costoGasDiario = store.parametros.promedioDiarioKm * store.parametros.costoPorKm;

    store.parametros.metaDiaria = costoDiarioFijos + costoGasDiario;
    saveData();
    return store.parametros.metaDiaria;
};

// 2. Gestión de Wallet (Sobres)
// Ingresa dinero al wallet (virtual) para cubrir gastos futuros
const abonarAlWallet = (monto, concepto) => {
    store.wallet.saldo += safeFloat(monto);
    store.wallet.historial.push({ fecha: new Date().toISOString(), tipo: 'abono', monto, concepto });
};

// Saca dinero del wallet (pago real)
const cargarDelWallet = (monto, concepto) => {
    store.wallet.saldo -= safeFloat(monto);
    store.wallet.historial.push({ fecha: new Date().toISOString(), tipo: 'cargo', monto, concepto });
};

// 3. Turnos y Gasolina (El ciclo operativo)
export const iniciarTurno = () => {
    if(store.turnoActivo) return;
    store.turnoActivo = { inicio: Date.now(), kmInicial: store.parametros.ultimoKM };
    saveData();
};

export const finalizarTurno = (kmFinal, ganancia) => {
    if(!store.turnoActivo) return;
    const fin = Date.now();
    const kmRecorrido = safeFloat(kmFinal) - store.turnoActivo.kmInicial;
    const horas = (fin - store.turnoActivo.inicio) / 36e5;

    // A. Guardar Turno
    store.turnos.push({
        id: uuid(),
        fecha: new Date().toISOString(),
        inicio: new Date(store.turnoActivo.inicio).toISOString(),
        fin: new Date(fin).toISOString(),
        horas,
        ganancia: safeFloat(ganancia),
        kmRecorrido,
        kmFinal: safeFloat(kmFinal)
    });

    // B. Ingreso Real (Cash Flow)
    agregarMovimiento('ingreso', 'Ganancia Turno', ganancia, 'Operativo', 'Turno');

    // C. PRORRATEO DE GASOLINA (Al Wallet)
    // "El turno debe pagar la gasolina que consumió"
    const costoGasConsumido = kmRecorrido * store.parametros.costoPorKm;
    if(costoGasConsumido > 0) {
        abonarAlWallet(costoGasConsumido, `Gasolina Turno (${kmRecorrido}km)`);
    }

    // D. APORTE A GASTOS FIJOS (Al Wallet)
    // Cada día trabajado debe aportar a la "renta" y "deudas"
    // Calculamos la parte proporcional de hoy (Meta sin gas)
    const aporteFijos = store.parametros.metaDiaria - (store.parametros.promedioDiarioKm * store.parametros.costoPorKm);
    if(aporteFijos > 0) {
        abonarAlWallet(aporteFijos, 'Aporte Gastos Fijos/Deudas');
    }

    // Actualizar datos globales
    if(safeFloat(kmFinal) > store.parametros.ultimoKM) store.parametros.ultimoKM = safeFloat(kmFinal);
    store.turnoActivo = null;
    saveData();
};

export const registrarGasolina = (litros, costo, kmActual) => {
    const costoTotal = safeFloat(costo);
    const km = safeFloat(kmActual);
    
    // 1. Recalcular Costo/KM real
    if (store.cargasCombustible.length > 0) {
        const ultCarga = store.cargasCombustible[store.cargasCombustible.length - 1];
        const dist = km - ultCarga.km;
        if(dist > 0) {
            const rendimiento = costoTotal / dist;
            // Promedio ponderado suave para no saltar bruscamente
            store.parametros.costoPorKm = (store.parametros.costoPorKm + rendimiento) / 2;
        }
    } else {
        // Primera carga define inicial
        store.parametros.costoPorKm = costoTotal / 300; // Asumimos 300km tanque lleno si es primera vez
    }

    store.cargasCombustible.push({ fecha: new Date().toISOString(), litros, costo: costoTotal, km });

    // 2. IMPACTO EN WALLET
    // La gasolina se paga del "Sobre de Gasolina" (Wallet)
    if(store.wallet.saldo >= costoTotal) {
        cargarDelWallet(costoTotal, '⛽ Carga Gasolina');
    } else {
        // Si no alcanza, vaciamos wallet y el resto es déficit (gasto directo)
        const cubierto = store.wallet.saldo;
        const faltante = costoTotal - cubierto;
        if(cubierto > 0) cargarDelWallet(cubierto, '⛽ Carga Gasolina (Parcial)');
        agregarMovimiento('gasto', '⛽ Déficit Gasolina', faltante, 'Operativo', 'Combustible');
    }

    if(km > store.parametros.ultimoKM) store.parametros.ultimoKM = km;
    saveData();
};

// 4. Finanzas Genéricas
export const agregarMovimiento = (tipo, desc, monto, grupo, cat) => {
    store.movimientos.push({ id: uuid(), tipo, fecha: new Date().toISOString(), desc, monto: safeFloat(monto), grupo, categoria: cat });
    saveData();
};

// 5. Gastos Inteligentes (Wizard)
export const procesarGastoInteligente = (desc, monto, grupo, cat, frecuencia) => {
    const m = safeFloat(monto);
    if(frecuencia === 'Unico') {
        agregarMovimiento('gasto', desc, m, grupo, cat);
        // Si es gasto personal (ej. Renta) que sale del wallet:
        if(grupo === 'Hogar' && store.wallet.saldo > 0) {
             // Opcional: Decidir si el gasto puntual sale del wallet o del flujo diario.
             // Por regla simple: Gastos únicos salen del flujo diario (Caja), 
             // Gastos recurrentes se pagan desde el Wallet.
        }
    } else {
        // ES RECURRENTE -> Agregar a reglas
        store.gastosFijosMensuales.push({ id: uuid(), fecha: new Date().toISOString(), desc, monto: m, categoria: cat, tipo: grupo, frecuencia });
        recalcularMetaDiaria();
        
        // Registrar el primer pago si aplica hoy? No, solo la regla.
        // Pero si el usuario dice "Pagué la renta hoy", se registra el movimiento Y la regla.
        // Asumimos aquí solo registro de regla. El pago se hace manual o "Gasto".
    }
};

export const agregarDeuda = (desc, total, cuota, frecuencia) => {
    store.deudas.push({ id: uuid(), desc, montoTotal: safeFloat(total), montoCuota: safeFloat(cuota), frecuencia, saldo: safeFloat(total) });
    recalcularMetaDiaria();
};

export const abonarDeuda = (id, monto) => {
    const d = store.deudas.find(x => x.id === id);
    if(d) {
        d.saldo -= safeFloat(monto);
        if(d.saldo < 0) d.saldo = 0;
        // El pago de deuda sale del Wallet (porque para eso ahorramos diariamente)
        cargarDelWallet(monto, `Pago Deuda: ${d.desc}`);
        recalcularMetaDiaria();
    }
};

export const setUltimoKM = (km) => { store.parametros.ultimoKM = safeFloat(km); saveData(); };
