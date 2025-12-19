import { STORAGE_KEY, DIAS_POR_FRECUENCIA, safeNumber } from './01_consts_utils.js';

const DEFAULT_DATA = {
    turnos: [], movimientos: [], cargasCombustible: [], 
    deudas: [], gastos: [], gastosFijosMensuales: [],
    parametros: {
        gastoFijo: 0, ultimoKM: 0, costoPorKm: 0,
        mantenimientoBase: { 'Aceite': 3000, 'Bujía': 8000, 'Llantas': 15000 },
        ultimoServicio: { 'Aceite': 0, 'Bujía': 0, 'Llantas': 0 } 
    }
};

let state = JSON.parse(JSON.stringify(DEFAULT_DATA));
let turnoActivo = JSON.parse(localStorage.getItem("turnoActivo_Final")) || null;

const calcularCostoPorKm = () => {
    const cargas = state.cargasCombustible || [];
    if (cargas.length < 2) {
        state.parametros.costoPorKm = 0;
        return;
    }
    const ordenadas = [...cargas].sort((a, b) => safeNumber(a.km) - safeNumber(b.km));
    const kmTotal = safeNumber(ordenadas[ordenadas.length - 1].km) - safeNumber(ordenadas[0].km);
    
    if (kmTotal <= 0) {
        state.parametros.costoPorKm = 0;
        return;
    }
    const costoTotal = ordenadas.slice(1).reduce((acc, c) => acc + safeNumber(c.costo), 0);
    state.parametros.costoPorKm = costoTotal / kmTotal;
};

export const loadData = () => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) { 
        try { 
            const parsed = JSON.parse(raw);
            state = { ...DEFAULT_DATA, ...parsed }; 
        } catch (e) { 
            console.error("Error al cargar datos", e); 
        } 
    }
    recalcularMetaDiaria();
    calcularCostoPorKm();
};

export const saveData = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
export const getState = () => state;
export const getTurnoActivo = () => turnoActivo;

// --- LÓGICA DE WALLET (CORREGIDA Y ROBUSTA) ---

const getDiasDesdeUltimoPago = (nombreConcepto) => {
    const pagos = state.movimientos
        .filter(m => m.tipo === 'gasto' && m.desc.toLowerCase().includes(nombreConcepto.toLowerCase()))
        .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    const hoy = new Date();
    
    if (pagos.length > 0) {
        const ultimoPago = new Date(pagos[0].fecha);
        const diffTime = Math.abs(hoy - ultimoPago);
        const diffDays = diffTime / (1000 * 60 * 60 * 24); 
        return Math.floor(diffDays);
    } else {
        return hoy.getDate(); // Si no hay pago, días del mes actual
    }
};

export const getWalletData = () => {
    const costoKm = state.parametros.costoPorKm || 0;

    // 1. GASOLINA (Cálculo más permisivo)
    let kmTotalHistorico = 0;
    
    // Intentamos obtener el KM total desde la primera carga registrada
    const cargasOrd = [...state.cargasCombustible].sort((a,b) => safeNumber(a.km) - safeNumber(b.km));
    if (cargasOrd.length > 0) {
        // Diferencia entre Odómetro Actual y la primera vez que cargaste
        kmTotalHistorico = state.parametros.ultimoKM - safeNumber(cargasOrd[0].km);
    } else if (state.turnos.length > 0) {
        // Fallback: Si no hay cargas, usamos turnos
        const turnosOrd = [...state.turnos].sort((a,b) => new Date(a.fecha) - new Date(b.fecha));
        kmTotalHistorico = state.parametros.ultimoKM - safeNumber(turnosOrd[0].kmFinal);
    }
    
    if (kmTotalHistorico < 0) kmTotalHistorico = 0;
    
    const ahorroGasolinaTeorico = kmTotalHistorico * costoKm;

    const gastoGasolinaReal = state.movimientos
        .filter(m => m.tipo === 'gasto' && (m.desc.toLowerCase().includes('gasolina') || m.desc.toLowerCase().includes('carga')))
        .reduce((acc, m) => acc + safeNumber(m.monto), 0);

    const saldoGasolina = ahorroGasolinaTeorico - gastoGasolinaReal;

    // 2. SOBRES FIJOS
    const sobres = [];
    
    // A. Gastos Fijos
    state.gastosFijosMensuales.forEach(g => {
        const cat = g.categoria.toLowerCase();
        // Filtramos lo que NO es ahorro
        if (cat.includes('comida') || cat.includes('despensa') || cat.includes('alimentos')) return;
        if (cat.includes('gasolina')) return; // Redundante

        const monto = safeNumber(g.monto);
        const diasFreq = DIAS_POR_FRECUENCIA[g.frecuencia] || 30;
        const costoDiario = monto / diasFreq;
        const diasAcumulados = getDiasDesdeUltimoPago(g.categoria);
        
        let acumulado = costoDiario * diasAcumulados;
        if (acumulado > monto) acumulado = monto;

        sobres.push({
            nombre: g.categoria,
            diario: costoDiario,
            acumulado: acumulado,
            dias: diasAcumulados,
            tipo: 'Fijo'
        });
    });

    // B. Deudas
    state.deudas.forEach(d => {
        if (d.saldo > 0) {
            const cuota = safeNumber(d.montoCuota);
            const diasFreq = DIAS_POR_FRECUENCIA[d.frecuencia] || 30;
            const costoDiario = cuota / diasFreq;
            const diasAcumulados = getDiasDesdeUltimoPago(d.desc);
            
            let acumulado = costoDiario * diasAcumulados;
            if (acumulado > cuota) acumulado = cuota;

            sobres.push({
                nombre: d.desc,
                diario: costoDiario,
                acumulado: acumulado,
                dias: diasAcumulados,
                tipo: 'Deuda'
            });
        }
    });

    // 3. Totales
    const totalObligadoSobres = sobres.reduce((acc, s) => acc + s.acumulado, 0) + (saldoGasolina > 0 ? saldoGasolina : 0);
    const totalIngresos = state.movimientos.filter(m => m.tipo === 'ingreso').reduce((a,b)=>a+safeNumber(b.monto), 0);
    const totalGastos = state.movimientos.filter(m => m.tipo === 'gasto').reduce((a,b)=>a+safeNumber(b.monto), 0);
    const efectivoDisponible = totalIngresos - totalGastos;

    return {
        gasolina: {
            kmTotal: kmTotalHistorico,
            costoKm: costoKm,
            necesario: ahorroGasolinaTeorico,
            gastado: gastoGasolinaReal,
            saldo: saldoGasolina
        },
        sobres: sobres,
        totales: {
            obligado: totalObligadoSobres,
            efectivo: efectivoDisponible,
            salud: efectivoDisponible - totalObligadoSobres
        }
    };
};

export const eliminarGastoFijo = (index) => {
    state.gastosFijosMensuales.splice(index, 1);
    recalcularMetaDiaria();
    saveData();
};

// --- FUNCIONES CORE ---
export const getKmRecorridosHoy = () => {
    const todos = [...state.turnos].sort((a,b) => new Date(a.fecha) - new Date(b.fecha));
    const hoyStr = new Date().toLocaleDateString();
    const turnosHoy = todos.filter(t => new Date(t.fecha).toLocaleDateString() === hoyStr);
    if (turnosHoy.length === 0) return 0;
    const kmFinalHoy = safeNumber(turnosHoy[turnosHoy.length - 1].kmFinal);
    const primerTurnoHoy = turnosHoy[0];
    const index = todos.indexOf(primerTurnoHoy);
    let kmInicioDia = 0;
    if (index > 0) kmInicioDia = safeNumber(todos[index - 1].kmFinal);
    return kmFinalHoy - kmInicioDia;
};

export const getGananciaNetaPromedio7Dias = () => {
    const hoy = new Date();
    const hace7Dias = new Date();
    hace7Dias.setDate(hoy.getDate() - 7);
    const turnosRecientes = state.turnos.filter(t => new Date(t.fecha) >= hace7Dias);
    if (turnosRecientes.length === 0) return 0;
    const sumaNeta = turnosRecientes.reduce((acc, t) => acc + safeNumber(t.ganancia), 0);
    return sumaNeta / 7;
};
export const getDeudaTotalPendiente = () => state.deudas.reduce((acc, d) => acc + safeNumber(d.saldo), 0);
export const calcularDiasParaLiquidarDeuda = () => {
    const deudasActivas = state.deudas.filter(d => d.saldo > 0);
    if (deudasActivas.length === 0) return "¡Libre!";
    let maxDias = 0;
    deudasActivas.forEach(d => {
        const cuota = safeNumber(d.montoCuota);
        const fr = DIAS_POR_FRECUENCIA[d.frecuencia] || 30;
        const diario = fr > 0 ? (cuota / fr) : 0;
        if (diario > 0) { const dias = d.saldo / diario; if (dias > maxDias) maxDias = dias; }
    });
    if (maxDias === 0) return "---";
    return maxDias > 60 ? `${Math.ceil(maxDias / 30)} Meses (Cal.)` : `${Math.ceil(maxDias / 7)} Semanas (Cal.)`;
};
export const getAnalisisCobertura = () => {
    const metaDiaria = state.parametros.gastoFijo; 
    const realPromedio = getGananciaNetaPromedio7Dias();
    return { cubre: realPromedio >= metaDiaria, diferencia: realPromedio - metaDiaria };
};
export const iniciarTurnoLogic = () => {
    if (turnoActivo) return false;
    turnoActivo = { inicio: new Date().toISOString() };
    localStorage.setItem("turnoActivo_Final", JSON.stringify(turnoActivo));
    return true;
};
export const finalizarTurnoLogic = (ganancia, kmFinal = 0) => {
    if (!turnoActivo) return;
    const fin = new Date();
    const t = { fecha: fin.toISOString(), inicio: turnoActivo.inicio, fin: fin.toISOString(), horas: (fin - new Date(turnoActivo.inicio)) / 36e5, ganancia: safeNumber(ganancia), kmFinal: safeNumber(kmFinal) };
    state.turnos.push(t);
    state.movimientos.push({ tipo: 'ingreso', fecha: fin.toISOString(), desc: 'Turno', monto: t.ganancia });
    if(safeNumber(kmFinal) > 0) state.parametros.ultimoKM = safeNumber(kmFinal);
    turnoActivo = null; localStorage.removeItem("turnoActivo_Final"); saveData();
};
export const recalcularMetaDiaria = () => {
    const fijos = state.gastosFijosMensuales.reduce((acc, i) => acc + (safeNumber(i.monto) / (DIAS_POR_FRECUENCIA[i.frecuencia]||30)), 0);
    const deudas = state.deudas.reduce((acc, d) => (d.saldo > 0 ? acc + (safeNumber(d.montoCuota) / (DIAS_POR_FRECUENCIA[d.frecuencia]||30)) : acc), 0);
    state.parametros.gastoFijo = fijos + deudas;
    saveData();
    return state.parametros.gastoFijo;
};
export const actualizarOdometroManual = (km) => { state.parametros.ultimoKM = safeNumber(km); saveData(); return true; };
export const registrarCargaGasolina = (l, c, km) => {
    actualizarOdometroManual(km);
    state.cargasCombustible.push({ fecha: new Date().toISOString(), litros: safeNumber(l), costo: safeNumber(c), km: safeNumber(km) });
    state.movimientos.push({ tipo: 'gasto', fecha: new Date().toISOString(), desc: '⛽ Gasolina', monto: safeNumber(c) });
    calcularCostoPorKm(); saveData();
};
export const guardarConfigMantenimiento = (aceite, bujia, llantas) => { state.parametros.mantenimientoBase = { 'Aceite': safeNumber(aceite), 'Bujía': safeNumber(bujia), 'Llantas': safeNumber(llantas) }; saveData(); };
export const registrarServicio = (aceiteKM, bujiaKM, llantasKM) => { state.parametros.ultimoServicio = { 'Aceite': safeNumber(aceiteKM), 'Bujía': safeNumber(bujiaKM), 'Llantas': safeNumber(llantasKM) }; saveData(); };
export const checkMantenimiento = () => {
    const { ultimoKM, mantenimientoBase, ultimoServicio } = state.parametros;
    let alerta = { Aceite: false, Bujía: false, Llantas: false }; let kmRestantes = {}; let alertaActiva = false;
    for (const item in mantenimientoBase) {
        const umbral = safeNumber(mantenimientoBase[item]); const ultimo = safeNumber(ultimoServicio[item]);
        if (umbral > 0 && ultimo > 0) { const faltan = umbral - (ultimoKM - ultimo); kmRestantes[item] = faltan; if (faltan <= umbral * 0.1) { alerta[item] = true; alertaActiva = true; } }
    } return { alerta, kmRestantes, alertaActiva };
};
export const agregarDeuda = (d) => { state.deudas.push(d); recalcularMetaDiaria(); saveData(); };
export const agregarGasto = (g) => { state.gastos.push(g); state.movimientos.push({ tipo: 'gasto', fecha: g.fecha, desc: g.categoria, monto: g.monto }); saveData(); };
export const agregarGastoFijo = (gf) => { state.gastosFijosMensuales.push(gf); recalcularMetaDiaria(); };
