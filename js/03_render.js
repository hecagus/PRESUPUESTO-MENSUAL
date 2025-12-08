import { $, fmtMoney } from './01_consts_utils.js';
import { getState, getTurnoActivo, iniciarTurnoLogic, finalizarTurnoLogic, recalcularMetaDiaria, agregarGastoFijo, agregarDeuda, registrarCargaGasolina } from './02_data.js';

// --- ADMIN: TURNO ---
export const renderTurnoUI = () => {
    const lbl = $("turnoTexto"), btnIn = $("btnIniciarTurno"), btnFin = $("btnFinalizarTurno"), divCierre = $("cierreTurnoContainer");
    
    // ¡CORRECCIÓN!: Si no existen los botones (estamos en index.html), salimos.
    if (!lbl || !btnIn) return;

    const activo = getTurnoActivo();
    if (activo) {
        lbl.innerHTML = `🟢 Activo: <b>${new Date(activo.inicio).toLocaleTimeString()}</b>`;
        lbl.style.color = "#16a34a";
        btnIn.style.display = "none";
        btnFin.style.display = "inline-block";
        divCierre.style.display = "block";
    } else {
        lbl.innerHTML = `🔴 Sin turno`;
        lbl.style.color = "#dc2626";
        btnIn.style.display = "inline-block";
        btnFin.style.display = "none";
        divCierre.style.display = "none";
    }
};

// --- ADMIN: META DIARIA ---
export const renderMetaDiaria = () => {
    const elMeta = $("metaDiariaDisplay");
    const elTotalFijo = $("totalFijoMensualDisplay");
    
    // ¡CORRECCIÓN!: Evita crash si no estamos en admin
    if (!elMeta) return;

    const meta = recalcularMetaDiaria();
    elMeta.innerText = `$${fmtMoney(meta)}`;

    if(elTotalFijo) {
        const state = getState();
        const totalFijo = state.gastosFijosMensuales.reduce((acc, i) => acc + Number(i.monto), 0);
        elTotalFijo.innerText = `$${fmtMoney(totalFijo)}`;
    }
};

// --- INDEX: DASHBOARD ---
export const renderDashboard = () => {
    const state = getState();
    const set = (id, v) => { const el = $(id); if(el) el.innerText = v; };

    // Datos rápidos (simplificados para el ejemplo)
    set("resKmRecorridos", `${state.parametros.ultimoKM} KM`);
    set("proyGastoFijoDiario", `$${fmtMoney(state.parametros.gastoFijo)}`);
    set("proyDeuda", `$${fmtMoney(state.parametros.deudaTotal)}`);
};

// --- LISTENERS ADMIN (Wizards) ---
export const setupAdminListeners = () => {
    if (!$("btnIniciarTurno")) return; // Seguridad

    // 1. Turno
    $("btnIniciarTurno").onclick = () => { if(iniciarTurnoLogic()) renderTurnoUI(); };
    $("btnFinalizarTurno").onclick = () => {
        finalizarTurnoLogic($("gananciaBruta").value);
        renderTurnoUI();
        $("gananciaBruta").value = "";
        alert("Turno finalizado.");
    };

    // 2. Gasolina Wizard
    const p1 = $("gasWizardPaso1"), p2 = $("gasWizardPaso2"), p3 = $("gasWizardPaso3");
    if(p1 && p2 && p3) {
        $("btnGasSiguiente1").onclick = () => { p1.style.display='none'; p2.style.display='block'; };
        $("btnGasSiguiente2").onclick = () => { p2.style.display='none'; p3.style.display='block'; };
        $("btnGasAtras2").onclick = () => { p2.style.display='none'; p1.style.display='block'; };
        $("btnGasAtras3").onclick = () => { p3.style.display='none'; p2.style.display='block'; };
        $("btnRegistrarCargaFinal").onclick = () => {
            registrarCargaGasolina($("gasLitros").value, $("gasCosto").value, $("gasKmActual").value);
            alert("Carga registrada");
            window.location.reload();
        };
    }
};
