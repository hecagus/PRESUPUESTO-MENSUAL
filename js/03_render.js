// 03_render.js
import { $, fmtMoney } from './01_consts_utils.js';
import { getState, getTurnoActivo, iniciarTurnoLogic, finalizarTurnoLogic, recalcularMetaDiaria, registrarCargaGasolina, actualizarOdometroManual, agregarDeuda } from './02_data.js';

// --- ADMIN: UI TURNO ---
export const renderTurnoUI = () => {
    const lbl = $("turnoTexto");
    const btnIn = $("btnIniciarTurno");
    const btnPreFin = $("btnPreFinalizarTurno");
    const divCierre = $("cierreTurnoContainer");

    if (!lbl) return; 

    const activo = getTurnoActivo();
    
    // Reset visual al renderizar
    divCierre.style.display = "none";

    if (activo) {
        lbl.innerHTML = `🟢 Turno Activo: <b>${new Date(activo.inicio).toLocaleTimeString()}</b>`;
        lbl.style.color = "#16a34a";
        btnIn.style.display = "none";
        btnPreFin.style.display = "inline-block"; // Botón "Finalizar" visible
    } else {
        lbl.innerHTML = `🔴 Sin turno activo`;
        lbl.style.color = "#dc2626";
        btnIn.style.display = "inline-block"; // Botón "Iniciar" visible
        btnPreFin.style.display = "none";
    }
};

// --- ADMIN: ODÓMETRO ---
export const renderOdometroUI = () => {
    const lblKm = $("lblKmAnterior");
    const inputKm = $("inputOdometro");
    if (!lblKm) return;

    const state = getState();
    lblKm.innerText = `${state.parametros.ultimoKM} km`;
    
    // Si ya tenemos KM, el placeholder sugiere el siguiente paso
    if (state.parametros.ultimoKM > 0) {
        inputKm.placeholder = `Mayor a ${state.parametros.ultimoKM}`;
    } else {
        inputKm.placeholder = "Ingresa KM Inicial";
    }
};

// --- ADMIN: META DIARIA ---
export const renderMetaDiaria = () => {
    const el = $("metaDiariaDisplay");
    if (el) el.innerText = `$${fmtMoney(recalcularMetaDiaria())}`;
};

// --- LISTENERS ADMIN ---
export const setupAdminListeners = () => {
    if (!$("btnIniciarTurno")) return; 

    // 1. GESTIÓN TURNO (FLUJO CORREGIDO)
    $("btnIniciarTurno").onclick = () => { if(iniciarTurnoLogic()) renderTurnoUI(); };
    
    // Click en "Finalizar" -> Muestra el formulario, no finaliza aún
    $("btnPreFinalizarTurno").onclick = () => {
        $("btnPreFinalizarTurno").style.display = "none"; // Oculta botón
        $("cierreTurnoContainer").style.display = "block"; // Muestra input
    };
    
    // Click en "Cancelar" dentro del formulario
    $("btnCancelarCierre").onclick = () => {
        $("cierreTurnoContainer").style.display = "none";
        $("btnPreFinalizarTurno").style.display = "inline-block";
        $("gananciaBruta").value = "";
    };

    // Click en "Confirmar Fin" -> Ejecuta lógica
    $("btnConfirmarFinalizar").onclick = () => {
        const monto = $("gananciaBruta").value;
        if(monto === "") return alert("Ingresa el monto (o 0 si no hubo ganancia).");
        finalizarTurnoLogic(monto);
        $("gananciaBruta").value = "";
        renderTurnoUI();
        alert("Turno cerrado correctamente.");
    };

    // 2. CONTROL ODÓMETRO
    $("btnActualizarOdometro").onclick = () => {
        const val = $("inputOdometro").value;
        if(actualizarOdometroManual(val)) {
            renderOdometroUI();
            $("inputOdometro").value = "";
            alert("Kilometraje actualizado.");
        }
    };

    // 3. WIZARD DEUDAS (CORREGIDO)
    const d1 = $("deudaWizardStep1"), d2 = $("deudaWizardStep2"), d3 = $("deudaWizardStep3");
    if(d1 && d2 && d3) {
        $("btnDeudaNext1").onclick = () => { 
            if(!$("deudaNombre").value) return alert("Pon un nombre");
            d1.style.display='none'; d2.style.display='block'; 
        };
        $("btnDeudaNext2").onclick = () => { d2.style.display='none'; d3.style.display='block'; };
        $("btnDeudaBack2").onclick = () => { d2.style.display='none'; d1.style.display='block'; };
        $("btnDeudaBack3").onclick = () => { d3.style.display='none'; d2.style.display='block'; };
        
        $("btnRegistrarDeudaFinal").onclick = () => {
            agregarDeuda({
                id: Date.now(),
                desc: $("deudaNombre").value,
                montoTotal: $("deudaMontoTotal").value,
                montoCuota: $("deudaMontoCuota").value,
                frecuencia: $("deudaFrecuencia").value,
                saldo: $("deudaMontoTotal").value
            });
            alert("Deuda registrada");
            window.location.reload();
        };
    }

    // 4. WIZARD GASOLINA (Sin cambios, solo binding)
    const p1=$("gasWizardPaso1"), p2=$("gasWizardPaso2"), p3=$("gasWizardPaso3");
    if(p1) {
        $("btnGasSiguiente1").onclick=()=>{p1.style.display='none';p2.style.display='block'};
        $("btnGasSiguiente2").onclick=()=>{p2.style.display='none';p3.style.display='block'};
        $("btnGasAtras2").onclick=()=>{p2.style.display='none';p1.style.display='block'};
        $("btnGasAtras3").onclick=()=>{p3.style.display='none';p2.style.display='block'};
        $("btnRegistrarCargaFinal").onclick=()=>{
            registrarCargaGasolina($("gasLitros").value, $("gasCosto").value, $("gasKmActual").value);
            alert("Carga guardada"); window.location.reload();
        };
    }
};
