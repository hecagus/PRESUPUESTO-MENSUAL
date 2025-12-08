// 03_render.js
import { $, fmtMoney } from './01_consts_utils.js';
import { getState, getTurnoActivo, iniciarTurnoLogic, finalizarTurnoLogic, recalcularMetaDiaria, registrarCargaGasolina } from './02_data.js';

// --- ADMIN: UI TURNO ---
export const renderTurnoUI = () => {
    const lbl = $("turnoTexto");
    const btnIn = $("btnIniciarTurno");
    const btnFin = $("btnFinalizarTurno");
    const divCierre = $("cierreTurnoContainer");

    // GUARD CLAUSE: Si no existen los elementos, salimos (Evita error en index.html)
    if (!lbl || !btnIn) return; 

    const activo = getTurnoActivo();

    if (activo) {
        lbl.innerHTML = `🟢 Turno Activo: <b>${new Date(activo.inicio).toLocaleTimeString()}</b>`;
        lbl.style.color = "#16a34a";
        btnIn.style.display = "none";
        btnFin.style.display = "inline-block";
        divCierre.style.display = "block";
    } else {
        lbl.innerHTML = `🔴 Sin turno activo`;
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

    if (!elMeta) return; // Protección

    const meta = recalcularMetaDiaria();
    elMeta.innerText = `$${fmtMoney(meta)}`;

    if (elTotalFijo) {
        const state = getState();
        const totalFijo = state.gastosFijosMensuales.reduce((acc, i) => acc + Number(i.monto), 0);
        elTotalFijo.innerText = `$${fmtMoney(totalFijo)}`;
    }
};

// --- INDEX: DASHBOARD ---
export const renderDashboard = () => {
    const state = getState();
    // Helper local para setear texto si el elemento existe
    const set = (id, val) => { const el = $(id); if(el) el.innerText = val; };

    set("resKmRecorridos", `${state.parametros.ultimoKM} KM`);
    set("proyGastoFijoDiario", `$${fmtMoney(state.parametros.gastoFijo)}`);
    set("proyDeuda", `$${fmtMoney(state.parametros.deudaTotal)}`);
    
    // Aquí se agregarían más KPIs calculados desde state.turnos
};

// --- ADMIN LISTENERS (Wizards y Botones) ---
export const setupAdminListeners = () => {
    if (!$("btnIniciarTurno")) return; 

    // 1. Gestión de Turno
    $("btnIniciarTurno").onclick = () => { 
        if(iniciarTurnoLogic()) renderTurnoUI(); 
    };
    
    $("btnFinalizarTurno").onclick = () => {
        // Solo tomamos el dinero. Ignoramos input de KM en esta sección por regla estricta.
        const ganancia = $("gananciaBruta").value; 
        finalizarTurnoLogic(ganancia);
        
        $("gananciaBruta").value = "";
        // Si hay input de KM en el HTML, lo limpiamos visualmente pero no lo procesamos aquí
        if($("kmFinalTurno")) $("kmFinalTurno").value = ""; 
        
        renderTurnoUI();
        alert("Turno finalizado (Dinero registrado).");
    };

    // 2. Wizard Gasolina
    const p1 = $("gasWizardPaso1"), p2 = $("gasWizardPaso2"), p3 = $("gasWizardPaso3");
    if (p1 && p2 && p3) {
        $("btnGasSiguiente1").onclick = () => { p1.style.display='none'; p2.style.display='block'; };
        $("btnGasSiguiente2").onclick = () => { p2.style.display='none'; p3.style.display='block'; };
        $("btnGasAtras2").onclick = () => { p2.style.display='none'; p1.style.display='block'; };
        $("btnGasAtras3").onclick = () => { p3.style.display='none'; p2.style.display='block'; };
        
        $("btnRegistrarCargaFinal").onclick = () => {
            const exito = registrarCargaGasolina(
                $("gasLitros").value, 
                $("gasCosto").value, 
                $("gasKmActual").value
            );
            if(exito) {
                alert("Carga y Kilometraje registrados.");
                window.location.reload();
            }
        };
    }
};
