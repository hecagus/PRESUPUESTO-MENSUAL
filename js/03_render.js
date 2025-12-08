// 03_render.js
import { $, fmtMoney, CATEGORIAS_GASTOS } from './01_consts_utils.js';
import { getState, getTurnoActivo, iniciarTurnoLogic, finalizarTurnoLogic, recalcularMetaDiaria, registrarCargaGasolina, actualizarOdometroManual, agregarDeuda, agregarGasto, agregarGastoFijo } from './02_data.js';

/* ==========================================================================
   SECCIÓN 1: RENDERIZADO DE ELEMENTOS (UI)
   ========================================================================== */

// --- UI HELPERS: Llenar Categorías ---
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

// --- ADMIN: INTERFAZ DE TURNO ---
export const renderTurnoUI = () => {
    const lbl = $("turnoTexto");
    const btnIn = $("btnIniciarTurno");
    const btnPreFin = $("btnPreFinalizarTurno");
    const divCierre = $("cierreTurnoContainer");

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

// --- ADMIN: INTERFAZ DE ODÓMETRO Y COSTO POR KM ---
export const renderOdometroUI = () => {
    const lblKm = $("lblKmAnterior");
    const inputKm = $("inputOdometro");
    const costoKmDisplay = $("costoPorKmDisplay"); 

    if (!lblKm) return;
    const state = getState();
    lblKm.innerText = `${state.parametros.ultimoKM} km`;
    inputKm.placeholder = state.parametros.ultimoKM > 0 ? `Mayor a ${state.parametros.ultimoKM}` : "Ingresa KM Inicial";

    if (costoKmDisplay) {
        const costo = state.parametros.costoPorKm;
        if (costo > 0.001) {
            costoKmDisplay.innerText = `$${fmtMoney(costo)}/km`; // Añadido /km para claridad
        } else {
            costoKmDisplay.innerText = "Calculando..."; 
        }
    }
};

// --- ADMIN: META DIARIA ---
export const renderMetaDiaria = () => {
    const el = $("metaDiariaDisplay");
    if (el) el.innerText = `$${fmtMoney(recalcularMetaDiaria())}`;
};

// --- DASHBOARD (INDEX) ---
export const renderDashboard = () => {
    const state = getState();
    const set = (id, v) => { const el = $(id); if(el) el.innerText = v; };

    const hoyStr = new Date().toLocaleDateString();
    const turnosHoy = state.turnos.filter(t => new Date(t.fecha).toLocaleDateString() === hoyStr);
    const gananciaHoy = turnosHoy.reduce((acc, t) => acc + t.ganancia, 0);
    const horasHoy = turnosHoy.reduce((acc, t) => acc + t.horas, 0);

    set("resHoras", `${horasHoy.toFixed(2)}h`);
    set("resGananciaBruta", `$${fmtMoney(gananciaHoy)}`);
    set("resGananciaNeta", `$${fmtMoney(gananciaHoy)}`); 
    set("resKmRecorridos", `${state.parametros.ultimoKM} km`);
    set("proyKmTotal", `${state.parametros.ultimoKM} KM`);
    set("proyGastoFijoDiario", `$${fmtMoney(state.parametros.gastoFijo)}`);
    set("proyDeuda", `$${fmtMoney(state.parametros.deudaTotal || state.deudas.reduce((a,b)=>a+b.saldo,0))}`);
};


/* ==========================================================================
   SECCIÓN 2: LISTENERS
   ========================================================================== */

export const setupAdminListeners = () => {
    if (!$("btnIniciarTurno")) return; 

    // 1. Turno
    $("btnIniciarTurno").onclick = () => { if(iniciarTurnoLogic()) renderTurnoUI(); };
    if($("btnPreFinalizarTurno")) $("btnPreFinalizarTurno").onclick = () => { $("btnPreFinalizarTurno").style.display = "none"; $("cierreTurnoContainer").style.display = "block"; };
    if($("btnCancelarCierre")) $("btnCancelarCierre").onclick = () => { $("cierreTurnoContainer").style.display = "none"; $("btnPreFinalizarTurno").style.display = "inline-block"; $("gananciaBruta").value = ""; };
    if($("btnConfirmarFinalizar")) $("btnConfirmarFinalizar").onclick = () => {
        const monto = $("gananciaBruta").value;
        if(monto === "") return alert("Ingresa el monto.");
        finalizarTurnoLogic(monto); $("gananciaBruta").value = ""; renderTurnoUI(); alert("Turno cerrado.");
    };

    // 2. Odómetro
    if($("btnActualizarOdometro")) $("btnActualizarOdometro").onclick = () => {
        if(actualizarOdometroManual($("inputOdometro").value)) { renderOdometroUI(); $("inputOdometro").value = ""; alert("KM actualizado."); }
    };

    // 3. Gastos Inteligentes (Sin cambios)
    llenarCategorias("moto"); 
    document.getElementsByName("gastoTipoRadio").forEach(r => {
        r.addEventListener("change", (e) => llenarCategorias(e.target.value));
    });
    const checkRecurrente = $("checkEsRecurrente");
    if (checkRecurrente) checkRecurrente.onchange = () => { $("divFrecuenciaGasto").style.display = checkRecurrente.checked ? "block" : "none"; };

    $("btnRegistrarGasto").onclick = () => {
        const select = $("gastoCategoriaSelect"), inputMan = $("gastoCategoriaManual"), monto = $("gastoCantidad").value;
        let cat = select.value;
        if(cat.includes("Otro") && inputMan.value.trim()) cat = inputMan.value.trim();
        if(!monto) return alert("Falta el monto");

        const gasto = { id: Date.now(), fecha: new Date().toISOString(), categoria: cat, monto: Number(monto), desc: $("gastoDescripcion").value, tipo: document.querySelector('input[name="gastoTipoRadio"]:checked').value };
        
        if(checkRecurrente.checked) {
            gasto.frecuencia = $("gastoFrecuenciaSelect").value;
            agregarGastoFijo(gasto);
            alert("Gasto Fijo agregado. Meta Diaria actualizada.");
        } else {
            gasto.frecuencia = "No Recurrente";
            agregarGasto(gasto);
            alert("Gasto guardado.");
        }
        $("gastoCantidad").value=""; $("gastoDescripcion").value=""; $("gastoCategoriaManual").value=""; inputMan.style.display="none"; checkRecurrente.checked=false; $("divFrecuenciaGasto").style.display="none"; select.selectedIndex=0;
        if(checkRecurrente.checked) window.location.reload();
    };

    // 4. WIZARD GASOLINA (CORRECCIÓN CRÍTICA DE LISTENERS)
    const p1 = $("gasWizardPaso1");
    const p2 = $("gasWizardPaso2");
    const p3 = $("gasWizardPaso3");

    if (p1 && p2 && p3) {
        // Siguiente 1 -> 2
        const btnNext1 = $("btnGasSiguiente1");
        if (btnNext1) {
            btnNext1.onclick = () => {
                p1.style.display = 'none';
                p2.style.display = 'block';
            };
        }
        
        // Siguiente 2 -> 3
        const btnNext2 = $("btnGasSiguiente2");
        if (btnNext2) {
            btnNext2.onclick = () => {
                p2.style.display = 'none';
                p3.style.display = 'block';
            };
        }

        // Atrás 2 -> 1
        const btnBack2 = $("btnGasAtras2");
        if (btnBack2) {
            btnBack2.onclick = () => {
                p2.style.display = 'none';
                p1.style.display = 'block';
            };
        }
        
        // Atrás 3 -> 2
        const btnBack3 = $("btnGasAtras3");
        if (btnBack3) {
            btnBack3.onclick = () => {
                p3.style.display = 'none';
                p2.style.display = 'block';
            };
        }

        // Finalizar Carga
        const btnFinal = $("btnRegistrarCargaFinal");
        if (btnFinal) {
            btnFinal.onclick = () => {
                registrarCargaGasolina($("gasLitros").value, $("gasCosto").value, $("gasKmActual").value);
                alert("Carga guardada"); 
                window.location.reload();
            };
        }
    }


    // 5. Wizards Deuda (Sin cambios)
    const deuIds = ["deudaWizardStep1","deudaWizardStep2","deudaWizardStep3"];
    if($(deuIds[0])) {
        $("btnDeudaNext1").onclick=()=>{if(!$("deudaNombre").value)return alert("Nombre?"); $(deuIds[0]).style.display='none';$(deuIds[1]).style.display='block'};
        $("btnDeudaNext2").onclick=()=>{$(deuIds[1]).style.display='none';$(deuIds[2]).style.display='block'};
        $("btnDeudaBack2").onclick=()=>{$(deuIds[1]).style.display='none';$(deuIds[0]).style.display='block'};
        $("btnDeudaBack3").onclick=()=>{$(deuIds[2]).style.display='none';$(deuIds[1]).style.display='block'};
        $("btnRegistrarDeudaFinal").onclick=()=>{ agregarDeuda({id:Date.now(), desc:$("deudaNombre").value, montoTotal:$("deudaMontoTotal").value, montoCuota:$("deudaMontoCuota").value, frecuencia:$("deudaFrecuencia").value, saldo:parseFloat($("deudaMontoTotal").value)}); alert("Deuda guardada"); window.location.reload(); };
    }
    
    if($("btnRegistrarIngreso")) $("btnRegistrarIngreso").onclick = () => alert("Ingreso registrado (Simulado).");
};
