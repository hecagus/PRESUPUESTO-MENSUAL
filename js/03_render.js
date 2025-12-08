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
    if(divCierre) divCierre.style.display = "none";

    if (activo) {
        lbl.innerHTML = `🟢 Turno Activo: <b>${new Date(activo.inicio).toLocaleTimeString()}</b>`;
        lbl.style.color = "#16a34a";
        if(btnIn) btnIn.style.display = "none";
        if(btnPreFin) btnPreFin.style.display = "inline-block"; 
    } else {
        lbl.innerHTML = `🔴 Sin turno activo`;
        lbl.style.color = "#dc2626";
        if(btnIn) btnIn.style.display = "inline-block"; 
        if(btnPreFin) btnPreFin.style.display = "none";
    }
};

// --- ADMIN: ODÓMETRO ---
export const renderOdometroUI = () => {
    const lblKm = $("lblKmAnterior");
    const inputKm = $("inputOdometro");
    if (!lblKm) return;

    const state = getState();
    lblKm.innerText = `${state.parametros.ultimoKM} km`;
    
    if (state.parametros.ultimoKM > 0) {
        inputKm.placeholder = `Mayor a ${state.parametros.ultimoKM}`;
    } else {
        inputKm.placeholder = "Ingresa KM Inicial";
    }
};

// --- ADMIN: META DIARIA ---
export const renderMetaDiaria = () => {
    const el = $("metaDiariaDisplay");
    // Protección: Si no existe el elemento, no hacemos nada
    if (el) el.innerText = `$${fmtMoney(recalcularMetaDiaria())}`;
};

// --- DASHBOARD (INDEX): ESTA ES LA FUNCIÓN QUE FALTABA ---
export const renderDashboard = () => {
    const state = getState();
    const set = (id, v) => { const el = $(id); if(el) el.innerText = v; };

    // 1. Calcular Totales de "Hoy"
    const hoyStr = new Date().toLocaleDateString();
    
    // Filtramos turnos que coincidan con la fecha de hoy (simplificado)
    const turnosHoy = state.turnos.filter(t => new Date(t.fecha).toLocaleDateString() === hoyStr);
    
    const gananciaHoy = turnosHoy.reduce((acc, t) => acc + t.ganancia, 0);
    const horasHoy = turnosHoy.reduce((acc, t) => acc + t.horas, 0);

    // 2. Renderizar KPIs
    set("resHoras", `${horasHoy.toFixed(2)}h`);
    set("resGananciaBruta", `$${fmtMoney(gananciaHoy)}`);
    // Nota: "Neta" requiere restar gastos, por ahora mostramos bruta o calculamos simple
    set("resGananciaNeta", `$${fmtMoney(gananciaHoy)}`); 
    
    set("resKmRecorridos", `${state.parametros.ultimoKM} km`);
    set("proyKmTotal", `${state.parametros.ultimoKM} KM`);
    
    set("proyGastoFijoDiario", `$${fmtMoney(state.parametros.gastoFijo)}`);
    set("proyDeuda", `$${fmtMoney(state.deudas.reduce((acc, d) => acc + d.saldo, 0))}`);
};

// --- LISTENERS ADMIN ---
export const setupAdminListeners = () => {
    // Si no estamos en Admin (no existe botón turno), salimos.
    if (!$("btnIniciarTurno")) return; 

    // 1. GESTIÓN TURNO
    $("btnIniciarTurno").onclick = () => { if(iniciarTurnoLogic()) renderTurnoUI(); };
    
    const btnPre = $("btnPreFinalizarTurno");
    if(btnPre) {
        btnPre.onclick = () => {
            btnPre.style.display = "none"; 
            $("cierreTurnoContainer").style.display = "block"; 
        };
    }
    
    const btnCancel = $("btnCancelarCierre");
    if(btnCancel) {
        btnCancel.onclick = () => {
            $("cierreTurnoContainer").style.display = "none";
            $("btnPreFinalizarTurno").style.display = "inline-block";
            $("gananciaBruta").value = "";
        };
    }

    const btnConfirm = $("btnConfirmarFinalizar");
    if(btnConfirm) {
        btnConfirm.onclick = () => {
            const monto = $("gananciaBruta").value;
            if(monto === "") return alert("Ingresa el monto (o 0 si no hubo ganancia).");
            finalizarTurnoLogic(monto);
            $("gananciaBruta").value = "";
            renderTurnoUI();
            alert("Turno cerrado correctamente.");
        };
    }

    // 2. CONTROL ODÓMETRO
    const btnOdo = $("btnActualizarOdometro");
    if(btnOdo) {
        btnOdo.onclick = () => {
            const val = $("inputOdometro").value;
            if(actualizarOdometroManual(val)) {
                renderOdometroUI();
                $("inputOdometro").value = "";
                alert("Kilometraje actualizado.");
            }
        };
    }

    // 3. WIZARD DEUDAS
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

    // 4. WIZARD GASOLINA
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
