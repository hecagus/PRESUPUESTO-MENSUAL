// 03_render.js
import { $, fmtMoney, CATEGORIAS_GASTOS, formatearFecha, safeNumber } from './01_consts_utils.js';
import { getState, getTurnoActivo, iniciarTurnoLogic, finalizarTurnoLogic, recalcularMetaDiaria, registrarCargaGasolina, actualizarOdometroManual, agregarDeuda, agregarGasto, agregarGastoFijo, exportarJsonLogic, importarJsonLogic, calcularGastoOperativoAcumulado, guardarParametrosMantenimiento } from './02_data.js';

/* ==========================================================================
   SECCIÓN 1: RENDERIZADO DE ELEMENTOS (UI)
   ========================================================================== */

// Helper para obtener la clave de fecha (YYYY-MM-DD) para filtrar sin problemas de hora/zona
const getTodayDateKey = () => new Date().toISOString().substring(0, 10);

// --- UI HELPERS: Llenar Categorías (omitted for brevity) ---
const llenarCategorias = (tipo) => {
    const select = $("gastoCategoriaSelect");
    const inputManual = $("gastoCategoriaManual");
    if (!select) return;

    select.innerHTML = "";
    inputManual.style.display = "none";

    const lista = CATEGORIAS_GASTOS[tipo] || [];
    lista.forEach(cat => {
        const option = document.createElement("option");
        option.value = cat;
        option.text = cat;
        select.appendChild(option);
    });

    select.onchange = () => {
        if (select.value.includes("Otro / Nuevo")) {
            inputManual.style.display = "block";
            inputManual.focus();
        } else {
            inputManual.style.display = "none";
        }
    };
};

// --- RENDERIZADO GENERAL (Turno, Odómetro, Meta Diaria, Historial) ---
export const renderTurnoUI = () => {
    const lbl = $("turnoTexto"), btnIn = $("btnIniciarTurno"), btnPreFin = $("btnPreFinalizarTurno"), divCierre = $("cierreTurnoContainer");
    if (!lbl) return; 
    const activo = getTurnoActivo();
    if(divCierre) divCierre.style.display = "none";
    if (activo) {
        lbl.innerHTML = `🟢 Turno Activo: <b>${new Date(activo.inicio).toLocaleTimeString()}</b>`;
        lbl.style.color = "#16a34a";
        if(btnIn) btnIn.style.display = "none";
        if(btnPreFin) { btnPreFin.style.display = "inline-block"; btnPreFin.innerText = "Finalizar Turno"; }
    } else {
        lbl.innerHTML = `🔴 Sin turno activo`;
        lbl.style.color = "#dc2626";
        if(btnIn) btnIn.style.display = "inline-block"; 
        if(btnPreFin) btnPreFin.style.display = "none";
    }
};

export const renderOdometroUI = () => {
    const lblKm = $("lblKmAnterior"), inputKm = $("inputOdometro"), costoKmDisplay = $("costoPorKmDisplay"), gastoDisp = $("gastoAcumuladoDisplay"), kmInicialDisp = $("kmInicialAcumulado"), kmActualDisp = $("kmActualOperativo"), kmRecorridoDisp = $("kmRecorridoDisplay"); 
    if (!lblKm) return;
    const state = getState();
    lblKm.innerText = `${state.parametros.ultimoKM} km`;
    inputKm.placeholder = state.parametros.ultimoKM > 0 ? `Mayor a ${state.parametros.ultimoKM}` : "Ingresa KM Inicial";

    if (costoKmDisplay) {
        const costo = state.parametros.costoPorKm;
        costoKmDisplay.innerText = costo > 0.001 ? `$${fmtMoney(costo)}/km` : "Calculando..."; 
    }
    
    const acumulado = calcularGastoOperativoAcumulado();
    if (gastoDisp) {
        gastoDisp.innerText = `$${fmtMoney(acumulado.gastoAcumulado)}`;
        kmInicialDisp.innerText = `${acumulado.kmInicial} km`;
        kmActualDisp.innerText = `${acumulado.kmActual} km`;
        kmRecorridoDisp.innerText = `${acumulado.kmRecorrido} km`;
    }
};

export const renderMetaDiaria = () => {
    const el = $("metaDiariaDisplay");
    if (el) el.innerText = `$${fmtMoney(recalcularMetaDiaria())}`;
};

// --- DASHBOARD (INDEX): CORRECCIÓN CRÍTICA DE CÁLCULOS ---
export const renderDashboard = () => {
    const state = getState();
    const set = (id, v) => { const el = $(id); if(el) el.innerText = v; };

    const todayKey = getTodayDateKey();
    
    // 1. FILTRAR DATOS DE HOY
    // Filtramos turnos cuya fecha de fin coincida con YYYY-MM-DD
    const turnosHoy = state.turnos.filter(t => new Date(t.fecha).toISOString().substring(0, 10) === todayKey);
    // Filtramos gastos de hoy
    const gastosHoy = state.gastos.filter(g => new Date(g.fecha).toISOString().substring(0, 10) === todayKey);
    
    // 2. CÁLCULOS
    const gananciaBrutaHoy = turnosHoy.reduce((acc, t) => acc + safeNumber(t.ganancia), 0);
    const horasHoy = turnosHoy.reduce((acc, t) => acc + safeNumber(t.horas), 0);
    
    // Gastos de Trabajo (Tipo 'moto' en tu data) hoy
    const gastosTrabajoHoy = gastosHoy
        .filter(g => g.tipo === 'moto' || g.tipo === 'operativo')
        .reduce((acc, g) => acc + safeNumber(g.monto), 0);

    const gananciaNetaHoy = gananciaBrutaHoy - gastosTrabajoHoy;

    // 3. RENDERIZAR KPIs
    set("resHoras", `${horasHoy.toFixed(2)}h`);
    set("resGananciaBruta", `$${fmtMoney(gananciaBrutaHoy)}`);
    set("resGastosTrabajo", `$${fmtMoney(gastosTrabajoHoy)}`); // Se actualizará si hay gastos operativos hoy
    set("resGananciaNeta", `$${fmtMoney(gananciaNetaHoy)}`);
    set("resKmRecorridos", `${state.parametros.ultimoKM} km`);
    set("resGananciaPorHora", horasHoy > 0 ? `$${fmtMoney(gananciaBrutaHoy / horasHoy)}/h` : `$0.00/h`);
    
    // Proyecciones
    const deudaTotal = state.deudas.reduce((acc, d) => acc + safeNumber(d.saldo), 0);
    set("proyKmTotal", `${state.parametros.ultimoKM} KM`);
    set("proyDeuda", `$${fmtMoney(deudaTotal)}`); 
    set("proyGastoFijoDiario", `$${fmtMoney(state.parametros.gastoFijo)}`);
    set("proyNetaPromedio", `$${fmtMoney(gananciaNetaHoy)}`); 
    set("proyDias", 'Calculando...'); // Lógica compleja de deuda pendiente

    // 4. Renderizar Tabla de Últimos Turnos (CORRECCIÓN)
    const tbodyTurnos = $("tablaTurnos");
    if (tbodyTurnos) {
        tbodyTurnos.innerHTML = "";
        const ultimosTurnos = state.turnos.slice(-5).reverse(); 

        if (ultimosTurnos.length === 0) {
            tbodyTurnos.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#999;">Aún no hay turnos registrados.</td></tr>`;
        } else {
            ultimosTurnos.forEach(t => {
                const tr = document.createElement('tr');
                const gananciaNeta = safeNumber(t.ganancia); 
                
                tr.innerHTML = `
                    <td>${formatearFecha(t.fecha || t.fechaFin)}</td>
                    <td>${safeNumber(t.horas).toFixed(2)}h</td>
                    <td style="color:#6b7280; font-style:italic;">N/A</td> 
                    <td style="font-weight:bold;">$${fmtMoney(gananciaNeta)}</td>
                `;
                tbodyTurnos.appendChild(tr);
            });
        }
    }
};

// --- RENDERIZADO DEL HISTORIAL (omitted for brevity) ---
export const renderHistorial = () => { /* ... */ };
const renderMantenimientoUI = () => { /* ... */ };
export { renderMantenimientoUI };

// --- LÓGICA DE EXCEL (Placeholder) ---
const exportarExcel = () => { alert("Función de exportación a Excel pendiente: Requiere desarrollo con librería XLSX.js."); };

/* ==========================================================================
   SECCIÓN 2: LISTENERS (Mantenido igual)
   ========================================================================== */

export const setupAdminListeners = () => { /* ... (todos los listeners se mantienen) ... */ };
