/* =========================================
   APP.JS - VERSIÓN 3.9 (ESTABLE + MENÚ GASTOS)
   ========================================= */

// --- 1. CONSTANTES ---
const STORAGE_KEY = "moto_finanzas_vFinal";
const SCHEMA_VERSION = 3;

const FRECUENCIAS = {
    'Diario': 1, 'Semanal': 7, 'Quincenal': 15, 
    'Mensual': 30, 'Bimestral': 60, 'Anual': 365, 'Unico': 0
};

const DIAS_SEMANA = [
    {value: "", text: "Seleccionar..."},
    {value: "1", text: "Lunes"}, {value: "2", text: "Martes"},
    {value: "3", text: "Miércoles"}, {value: "4", text: "Jueves"},
    {value: "5", text: "Viernes"}, {value: "6", text: "Sábado"},
    {value: "0", text: "Domingo"}
];

const CATEGORIAS = {
    operativo: ["Gasolina", "Mantenimiento", "Reparación", "Equipo", "Seguro"],
    hogar: ["Renta", "Comida", "Servicios", "Internet", "Salud", "Deudas", "Otro"]
};

// Utilidades
const $ = (id) => document.getElementById(id);
const safeFloat = (val) => { const n = parseFloat(val); return isFinite(n) ? n : 0; };
const fmtMoney = (amount) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount || 0);
const uuid = () => Date.now().toString(36) + Math.random().toString(36).substr(2);
const getFechaHoy = () => new Date().toISOString().split('T')[0];

// Estado Inicial
const INITIAL_STATE = {
    schemaVersion: SCHEMA_VERSION,
    turnos: [], movimientos: [], cargasCombustible: [], 
    deudas: [], gastosFijosMensuales: [],
    wallet: { saldo: 0, sobres: [], historial: [] },
    parametros: { metaDiaria: 0, ultimoKM: 0, costoPorKm: 0, promedioDiarioKm: 120, ultimoProcesamiento: null },
    turnoActivo: null
};

let store = JSON.parse(JSON.stringify(INITIAL_STATE));

// --- 2. MOTOR DE DATOS (Con Limpieza de Duplicados) ---
function sanearDatos() {
    // Inicializar arrays
    if(!Array.isArray(store.movimientos)) store.movimientos = [];
    if(!Array.isArray(store.cargasCombustible)) store.cargasCombustible = [];
    if(!Array.isArray(store.turnos)) store.turnos = [];
    if(!Array.isArray(store.deudas)) store.deudas = [];
    if(!store.wallet) store.wallet = { saldo: 0, sobres: [], historial: [] };
    if(!Array.isArray(store.wallet.sobres)) store.wallet.sobres = [];
    if(!Array.isArray(store.gastosFijosMensuales)) store.gastosFijosMensuales = [];

    // --- FIX: LIMPIEZA DE DUPLICADOS (Seguro) ---
    const unicos = [];
    const nombresVistos = new Set();
    store.gastosFijosMensuales.forEach(g => {
        const key = g.desc.toLowerCase().trim();
        if (!nombresVistos.has(key)) {
            nombresVistos.add(key);
            unicos.push(g);
        }
    });
    store.gastosFijosMensuales = unicos;

    // 1. RECALCULAR SALDO
    let saldoCalculado = 0;
    store.movimientos.forEach(m => {
        if(m.tipo === 'ingreso') saldoCalculado += safeFloat(m.monto);
        if(m.tipo === 'gasto') saldoCalculado -= safeFloat(m.monto);
    });
    store.cargasCombustible.forEach(c => saldoCalculado -= safeFloat(c.costo));
    store.wallet.saldo = saldoCalculado;

    // 2. EFICIENCIA GASOLINA
    const totalGas = store.cargasCombustible.reduce((a,b)=>a+safeFloat(b.costo),0);
    const kmsGas = store.cargasCombustible.length > 1 ? 
        (Math.max(...store.cargasCombustible.map(c=>c.km)) - Math.min(...store.cargasCombustible.map(c=>c.km))) : 0;
    if(kmsGas > 100) store.parametros.costoPorKm = (totalGas / kmsGas).toFixed(2);

    // 3. BLINDAJE KM
    const maxTurno = store.turnos.length > 0 ? Math.max(...store.turnos.map(t=>t.kmFinal||0)) : 0;
    const maxGas = store.cargasCombustible.length > 0 ? Math.max(...store.cargasCombustible.map(c=>c.km||0)) : 0;
    store.parametros.ultimoKM = Math.max(store.parametros.ultimoKM || 0, maxTurno, maxGas);

    // 4. ESTRUCTURA SOBRES
    actualizarSobresEstructural();

    // 5. CALENDARIO
    recalcularSobresPorCalendario();
}

function actualizarSobresEstructural() {
    const crearSobre = (refId, tipo, desc, meta, freq, diaPago) => {
        let s = store.wallet.sobres.find(x => x.refId === refId);
        if(!s) {
            s = { id: uuid(), refId, tipo, desc, acumulado: 0, ultimoCalculo: getFechaHoy() };
            store.wallet.sobres.push(s);
        }
        s.meta = safeFloat(meta); s.frecuencia = freq; s.diaPago = diaPago; s.desc = desc;
    };
    store.deudas.forEach(d => { if(d.saldo > 0) crearSobre(d.id, 'deuda', d.desc, d.montoCuota, d.frecuencia, d.diaPago); });
    store.gastosFijosMensuales.forEach(g => { crearSobre(g.id, 'gasto', g.desc, g.monto, g.frecuencia); });
    
    // Eliminar Huérfanos
    store.wallet.sobres = store.wallet.sobres.filter(s => {
        if(s.tipo === 'deuda') return store.deudas.some(d => d.id === s.refId && d.saldo > 0.1);
        if(s.tipo === 'gasto') return store.gastosFijosMensuales.some(g => g.id === s.refId);
        return false;
    });
}

function recalcularSobresPorCalendario() {
    const hoyObj = new Date();
    const hoyIndex = hoyObj.getDay(); 
    const diaDelMes = hoyObj.getDate();

    store.wallet.sobres.forEach(s => {
        if (s.frecuencia === 'Semanal' && s.diaPago !== undefined) {
            const pagoIndex = parseInt(s.diaPago);
            let diasTranscurridos = (hoyIndex - pagoIndex + 7) % 7;
            if (diasTranscurridos === 0 && s.acumulado < s.meta) diasTranscurridos = 7;
            const montoIdeal = (s.meta / 7) * diasTranscurridos;
            if(s.acumulado < montoIdeal) s.acumulado = montoIdeal;
            if(s.acumulado > s.meta) s.acumulado = s.meta;
        }
        if (s.frecuencia === 'Mensual') {
             const montoIdeal = (s.meta / 30) * diaDelMes;
             if(s
       
