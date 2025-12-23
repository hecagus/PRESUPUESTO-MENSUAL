/* 02_data.js - LÓGICA FINANCIERA DE PRODUCCIÓN */
import { STORAGE_KEY, FRECUENCIAS, safeFloat, uuid } from './01_consts_utils.js';

// --- ESQUEMA DE DATOS ---
const INITIAL_STATE = {
    turnos: [],
    movimientos: [],
    cargasCombustible: [],
    deudas: [],
    gastosFijosMensuales: [], // Aquí viven las reglas de recurrencia
    wallet: {
        saldo: 0, // Acumulado de sobres (Gasolina + Renta + Deudas)
        historial: []
    },
    parametros: {
        metaDiaria: 0,
        ultimoKM: 0,
        costoPorKm: 0,      // Rendimiento real calculado
        promedioDiarioKm: 120 // Valor semilla, se ajustará con el tiempo
    },
    turnoActivo: null,
    _version: 2
};

let store = JSON.parse(JSON.stringify(INITIAL_STATE));

// --- PERSISTENCIA ---
export const loadData = () => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
        try {
            const parsed = JSON.parse(raw);
            // Merge estratégico para no romper estructura si hay updates
            store = {
                ...INITIAL_STATE,
                ...parsed,
                parametros: { ...INITIAL_STATE.parametros, ...parsed.parametros },
                wallet: { ...INITIAL_STATE.wallet, ...parsed.wallet }
            };
        } catch (e) {
            console.error("Error crítico cargando datos. Iniciando limpio.");
        }
    }
    recalcularMetaDiaria();
};

export const saveData = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
export const getStore = () => store;

// --- MOTOR FINANCIERO (CORE) ---

// 1. CÁLCULO DE META DIARIA
// Fórmula: (GastosFijos / Freq) + (Deudas / Freq) + (KmPromedio * CostoKm)
export const recalcularMetaDiaria = () => {
    let costoFijoDiario = 0;

    // A. Recurrentes (Renta, Spotify, Plan Celular)
    store.gastosFijosMensuales.forEach(g => {
        const dias = FRECUENCIAS[g.frecuencia] || 30;
        if (dias > 0) costoFijoDiario += (safeFloat(g.monto) / dias);
    });

    // B. Deudas Activas
    store.deudas.forEach(d => {
        if (d.saldo > 0) {
            const dias = FRECUENCIAS[d.frecuencia] || 30;
            if (dias > 0) costoFijoDiario += (safeFloat(d.montoCuota) / dias);
        }
    });

    // C. Provisión de Gasolina (Estimada para la meta, real en el wallet)
    const costoGasEstimado = store.parametros.promedioDiarioKm * store.parametros.costoPorKm;

    store.parametros.metaDiaria = costoFijoDiario + costoGasEstimado;
    saveData();
    return store.parametros.metaDiaria;
};

// 2. GESTIÓN DEL WALLET (SISTEMA DE SOBRES)
const afectarWallet = (monto, tipo, concepto) => {
    // tipo: 'abono' (Entra dinero al sobre) | 'cargo' (Sale dinero para pagar)
    const valor = safeFloat(monto);
    if (tipo === 'abono') store.wallet.saldo += valor;
    if (tipo === 'cargo') store.wallet.saldo -= valor;

    // Log de auditoría del wallet (invisible en UI simple, vital para debug)
    store.wallet.historial.push({
        id: uuid(),
        fecha: new Date().toISOString(),
        tipo,
        monto: valor,
        concepto,
        saldoResultante: store.wallet.saldo
    });
};

// --- OPERATIVA ---

// 3. TURNO (Aquí es donde se "gana" el dinero del Wallet)
export const iniciarTurno = () => {
    if (store.turnoActivo) return;
    store.turnoActivo = {
        inicio: Date.now(),
        kmInicial: store.parametros.ultimoKM
    };
    saveData();
};

export const finalizarTurno = (kmFinal, gananciaTotal) => {
    if (!store.turnoActivo) return;

    const fin = Date.now();
    const inicio = store.turnoActivo.inicio;
    const kmRecorrido = safeFloat(kmFinal) - store.turnoActivo.kmInicial;
    const ganancia = safeFloat(gananciaTotal);
    const horas = (fin - inicio) / 36e5;

    // Validaciones de integridad
    if (kmRecorrido < 0) throw new Error("Kilometraje inconsistente");

    // A. Registrar Turno
    store.turnos.push({
        id: uuid(),
        fecha: new Date().toISOString(),
        inicio: new Date(inicio).toISOString(),
        fin: new Date(fin).toISOString(),
        horas,
        ganancia,
        kmRecorrido,
        kmFinal: safeFloat(kmFinal)
    });

    // B. Ingreso de Caja (Cash Flow)
    agregarMovimiento('ingreso', 'Ganancia Turno', ganancia, 'Operativo', 'Turno');

    // C. ALIMENTAR EL WALLET (Separar los sobres)
    // 1. Reponer Gasolina Consumida (Virtual)
    const costoGasConsumido = kmRecorrido * store.parametros.costoPorKm;
    if (costoGasConsumido > 0) {
        afectarWallet(costoGasConsumido, 'abono', `Provisión Gasolina (${kmRecorrido}km)`);
    }

    // 2. Aportar a Fijos/Deudas (Proporcional al esfuerzo del día)
    // La meta diaria incluye gas, así que restamos gas para saber cuánto va a fijos
    const metaSinGas = store.parametros.metaDiaria - (store.parametros.promedioDiarioKm * store.parametros.costoPorKm);
    // Si ganamos lo suficiente, apartamos la meta completa. Si no, lo que se pueda.
    // Lógica conservadora: Siempre intentamos apartar la meta fija si hay ganancia.
    if (metaSinGas > 0) {
        afectarWallet(metaSinGas, 'abono', 'Provisión Fijos/Deudas');
    }

    // Actualizar odómetro y promedios
    if (safeFloat(kmFinal) > store.parametros.ultimoKM) {
        store.parametros.ultimoKM = safeFloat(kmFinal);
        // Ajuste suave del promedio diario de KM (peso 10% al nuevo dato)
        if (kmRecorrido > 10) { // Ignorar turnos micro
            store.parametros.promedioDiarioKm = (store.parametros.promedioDiarioKm * 0.9) + (kmRecorrido * 0.1);
        }
    }

    store.turnoActivo = null;
    saveData();
};

// 4. GASOLINA (Pago Real)
export const registrarGasolina = (litros, costo, kmActual) => {
    const costoTotal = safeFloat(costo);
    const km = safeFloat(kmActual);
    const prevKm = store.parametros.ultimoKM;

    // A. Recalcular Rendimiento ($/KM)
    if (prevKm > 0 && km > prevKm) {
        const dist = km - prevKm;
        const rendimientoActual = costoTotal / dist;
        
        // Si es el primer cálculo, lo tomamos directo. Si no, promediamos para suavizar picos.
        if (store.parametros.costoPorKm === 0) {
            store.parametros.costoPorKm = rendimientoActual;
        } else {
            store.parametros.costoPorKm = (store.parametros.costoPorKm * 0.7) + (rendimientoActual * 0.3);
        }
    } else if (store.parametros.costoPorKm === 0) {
        // Fallback semilla si es primera carga sin historial (aprox moto 150cc)
        store.parametros.costoPorKm = 0.8; 
    }

    store.cargasCombustible.push({
        id: uuid(),
        fecha: new Date().toISOString(),
        litros: safeFloat(litros),
        costo: costoTotal,
        km
    });

    // B. PAGO DESDE WALLET
    // Intentamos pagar con el sobre de gasolina acumulado
    if (store.wallet.saldo >= costoTotal) {
        afectarWallet(costoTotal, 'cargo', '⛽ Pago Gasolinera');
    } else {
        // WALLET ROTO: Pagamos lo que hay, el resto es pérdida operativa inmediata
        const cubierto = store.wallet.saldo;
        const deficit = costoTotal - cubierto;
        
        if (cubierto > 0) afectarWallet(cubierto, 'cargo', '⛽ Pago Gasolina (Parcial)');
        
        // El déficit se registra como gasto directo porque salió de tu ganancia libre, no del sobre
        agregarMovimiento('gasto', '⛽ Déficit Gasolina', deficit, 'Operativo', 'Combustible');
    }

    if (km > store.parametros.ultimoKM) store.parametros.ultimoKM = km;
    recalcularMetaDiaria(); // Porque cambió el costo/km
    saveData();
};

// 5. GASTOS INTELIGENTES (Reglas)
export const procesarGasto = (desc, monto, grupo, categoria, frecuencia) => {
    const m = safeFloat(monto);
    
    if (frecuencia && frecuencia !== 'No Recurrente' && frecuencia !== 'Unico') {
        // ES RECURRENTE: Crear Regla
        store.gastosFijosMensuales.push({
            id: uuid(),
            fecha: new Date().toISOString(),
            desc,
            monto: m,
            categoria,
            tipo: grupo,
            frecuencia
        });
        recalcularMetaDiaria();
        // Nota: No registramos el movimiento hoy, solo la regla. 
        // El usuario debe registrar el pago manualmente o esperar al ciclo.
        // Pero para UX inmediata, asumimos que si lo crea hoy, lo pagó hoy:
        const pagarHoy = confirm("¿Quieres registrar el pago de este gasto hoy también?");
        if(pagarHoy) {
             // Si paga hoy un gasto recurrente, debería salir del Wallet si hay fondos
             if(store.wallet.saldo >= m) {
                 afectarWallet(m, 'cargo', `Pago Recurrente: ${desc}`);
             } else {
                 agregarMovimiento('gasto', desc, m, grupo, categoria);
             }
        }
    } else {
        // GASTO ÚNICO
        // Regla de negocio: Gastos operativos únicos salen de Caja, no de Wallet (salvo emergencia)
        agregarMovimiento('gasto', desc, m, grupo, categoria);
    }
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

export const abonarDeuda = (id, monto) => {
    const d = store.deudas.find(x => x.id == id);
    if (!d) return;
    
    const m = safeFloat(monto);
    d.saldo -= m;
    if (d.saldo < 0) d.saldo = 0;
    
    // El pago de deuda SIEMPRE sale del Wallet (es su propósito principal)
    // Si no hay saldo en wallet, es un error de planificación, pero permitimos la operación registrando déficit
    if (store.wallet.saldo >= m) {
        afectarWallet(m, 'cargo', `Pago Deuda: ${d.desc}`);
    } else {
        const cubierto = store.wallet.saldo;
        const faltante = m - cubierto;
        if(cubierto > 0) afectarWallet(cubierto, 'cargo', `Pago Deuda Parcial: ${d.desc}`);
        agregarMovimiento('gasto', `Déficit Deuda: ${d.desc}`, faltante, 'Personal', 'Deuda');
    }
    
    recalcularMetaDiaria();
};

// UTILITARIOS
export const agregarMovimiento = (tipo, desc, monto, grupo, cat) => {
    store.movimientos.push({
        id: uuid(),
        fecha: new Date().toISOString(),
        tipo,
        desc,
        monto: safeFloat(monto),
        grupo,
        categoria: cat
    });
    saveData();
};

export const setUltimoKM = (km) => { store.parametros.ultimoKM = safeFloat(km); saveData(); };

// IMPORTACIÓN / EXPORTACIÓN
export const importarBackup = (json) => {
    try {
        const data = JSON.parse(json);
        if(data.turnos && data.wallet) {
            store = { ...INITIAL_STATE, ...data };
            saveData();
            return true;
        }
    } catch(e) {}
    return false;
};
