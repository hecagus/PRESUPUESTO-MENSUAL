// 03_render.js
import { $, fmtMoney, CATEGORIAS_GASTOS, formatearFecha, safeNumber } from './01_consts_utils.js';
import { getState, getTurnoActivo, iniciarTurnoLogic, finalizarTurnoLogic, recalcularMetaDiaria, registrarCargaGasolina, actualizarOdometroManual, agregarDeuda, agregarGasto, agregarGastoFijo, guardarConfigMantenimiento } from './02_data.js';

// --- UTILIDAD: CONECTOR SEGURO DE EVENTOS ---
const safeClick = (id, fn) => {
    const el = $(id);
    if (el) el.onclick = fn;
};

// --- HELPERS ---
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

/* ==========================================================================
   RENDERIZADO UI (VISUALIZACIÓN)
   ========================================================================== */

export const renderTurnoUI = () => {
    const lbl = $("turnoTexto");
    if (!lbl) return; // Si no hay label, no estamos en la sección correcta

    const activo = getTurnoActivo();
    const btnIn = $("btnIniciarTurno");
    const btnPreFin = $("btnPreFinalizarTurno");
    const divCierre = $("cierreTurnoContainer");

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
    const lblKm = $("lblKmAnterior");
    if (!lblKm) return;

    const state = getState();
    lblKm.innerText = `${state.parametros.ultimoKM} km`;
    
    const inputKm = $("inputOdometro");
    if(inputKm) inputKm.placeholder = state.parametros.ultimoKM > 0 ? `Mayor a ${state.parametros.ultimoKM}` : "Ingresa KM Inicial";

    const costoKmDisplay = $("costoPorKmDisplay");
    if (costoKmDisplay) {
        const costo = state.parametros.costoPorKm;
        costoKmDisplay.innerText = costo > 0.001 ? `$${fmtMoney(costo)}/km` : "Calculando...";
    }
};

export const renderMetaDiaria = () => {
    const el = $("metaDiariaDisplay");
    if (el) el.innerText = `$${fmtMoney(recalcularMetaDiaria())}`;
};

export const renderMantenimientoUI = () => {
    const state = getState();
    const config = state.parametros?.mantenimientoBase || {}; 
    const setVal = (id, key) => { const el = $(id); if (el) el.value = config[key] || 0; };
    setVal("mantenimientoAceite", "Aceite");
    setVal("mantenimientoBujia", "Bujía");
    setVal("mantenimientoLlantas", "Llantas");
};

export const renderDashboard = () => {
    const state = getState();
    // Helper local que no rompe si el ID no existe
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

export const renderHistorial = () => {
    const tbody = $("historialBody");
    const resumenDiv = $("historialResumen");
    if (!tbody || !resumenDiv) return; // Protección estricta

    const state = getState();
    tbody.innerHTML = "";
    let ing = 0, gas = 0;
    
    state.movimientos.slice().reverse().forEach(mov => {
        const tr = document.createElement('tr');
        const isIng = mov.tipo === 'ingreso';
        const m = safeNumber(mov.monto);
        if (isIng) { ing += m; tr.style.backgroundColor = '#ecfdf5'; } else { gas += m; tr.style.backgroundColor = '#fff5f5'; }
        tr.innerHTML = `<td>${isIng?'➕':'➖'}</td><td>${formatearFecha(mov.fecha)}</td><td>${mov.desc}</td><td style="color:${isIng?'#059669':'#dc2626'}">$${fmtMoney(m)}</td>`;
        tbody.appendChild(tr);
    });
    resumenDiv.innerHTML = `<p>Ing: <b style="color:#059669">$${fmtMoney(ing)}</b> | Gas: <b style="color:#dc2626">$${fmtMoney(gas)}</b> | Neto: <b>$${fmtMoney(ing-gas)}</b></p>`;
};


/* ==========================================================================
   LISTENERS (CONTROLADORES)
   ========================================================================== */

export const setupAdminListeners = () => {
    // PROTECCIÓN SUPREMA: Si no estamos en la página admin, abortamos inmediatamente.
    if (document.body.getAttribute('data-page') !== 'admin') return;

    console.log("Configurando Listeners de Admin...");

    // --- TURNO ---
    safeClick("btnIniciarTurno", () => { if(iniciarTurnoLogic()) renderTurnoUI(); });
    
    safeClick("btnPreFinalizarTurno", () => { 
        const btn = $("btnPreFinalizarTurno"); if(btn) btn.style.display="none"; 
        const cont = $("cierreTurnoContainer"); if(cont) cont.style.display="block"; 
    });
    
    safeClick("btnCancelarCierre", () => { 
        const cont = $("cierreTurnoContainer"); if(cont) cont.style.display="none"; 
        const btn = $("btnPreFinalizarTurno"); if(btn) btn.style.display="inline-block"; 
    });
    
    safeClick("btnConfirmarFinalizar", () => {
        const m = $("gananciaBruta").value;
        if(m==="") return alert("Monto?");
        finalizarTurnoLogic(m); 
        $("gananciaBruta").value=""; 
        renderTurnoUI(); 
        alert("Cerrado.");
    });

    // --- ODÓMETRO ---
    safeClick("btnActualizarOdometro", () => {
        if(actualizarOdometroManual($("inputOdometro").value)) { 
            renderOdometroUI(); 
            $("inputOdometro").value=""; 
            alert("KM actualizado."); 
        }
    });

    // --- GASTOS ---
    if($("gastoTipoRadio")) {
        llenarCategorias("moto");
        document.getElementsByName("gastoTipoRadio").forEach(r => r.addEventListener("change", (e)=>llenarCategorias(e.target.value)));
    }

    const chkRec = $("checkEsRecurrente");
    if(chkRec) chkRec.onchange = () => { $("divFrecuenciaGasto").style.display = chkRec.checked ? "block" : "none"; };
    
    safeClick("btnRegistrarGasto", () => {
        const sel=$("gastoCategoriaSelect"), inpMan=$("gastoCategoriaManual"), m=$("gastoCantidad").value;
        let cat = sel.value;
        if(cat.includes("Otro") && inpMan.value.trim()) cat = inpMan.value.trim();
        if(!m) return alert("Monto?");
        
        const g = { id:Date.now(), fecha:new Date().toISOString(), categoria:cat, monto:Number(m), desc:$("gastoDescripcion").value, tipo:document.querySelector('input[name="gastoTipoRadio"]:checked').value };
        
        if(chkRec && chkRec.checked) { 
            g.frecuencia = $("gastoFrecuenciaSelect").value; 
            agregarGastoFijo(g); 
            alert("Fijo agregado."); 
        } else { 
            g.frecuencia="No Recurrente"; 
            agregarGasto(g); 
            alert("Gasto guardado."); 
        }
        
        $("gastoCantidad").value=""; $("gastoDescripcion").value=""; inpMan.value=""; inpMan.style.display="none"; 
        if(chkRec) { chkRec.checked=false; window.location.reload(); }
    });

    // --- WIZARD GASOLINA ---
    safeClick("btnGasSiguiente1", () => { $("gasWizardPaso1").style.display='none'; $("gasWizardPaso2").style.display='block'; });
    safeClick("btnGasSiguiente2", () => { $("gasWizardPaso2").style.display='none'; $("gasWizardPaso3").style.display='block'; });
    safeClick("btnGasAtras2", () => { $("gasWizardPaso2").style.display='none'; $("gasWizardPaso1").style.display='block'; });
    safeClick("btnGasAtras3", () => { $("gasWizardPaso3").style.display='none'; $("gasWizardPaso2").style.display='block'; });
    safeClick("btnRegistrarCargaFinal", () => {
        registrarCargaGasolina($("gasLitros").value, $("gasCosto").value, $("gasKmActual").value);
        alert("Carga guardada"); window.location.reload();
    });

    // --- WIZARD DEUDA ---
    safeClick("btnDeudaNext1", () => { if(!$("deudaNombre").value)return alert("Nombre?"); $("deudaWizardStep1").style.display='none'; $("deudaWizardStep2").style.display='block'; });
    safeClick("btnDeudaNext2", () => { $("deudaWizardStep2").style.display='none'; $("deudaWizardStep3").style.display='block'; });
    safeClick("btnDeudaBack2", () => { $("deudaWizardStep2").style.display='none'; $("deudaWizardStep1").style.display='block'; });
    safeClick("btnDeudaBack3", () => { $("deudaWizardStep3").style.display='none'; $("deudaWizardStep2").style.display='block'; });
    safeClick("btnRegistrarDeudaFinal", () => {
        agregarDeuda({id:Date.now(), desc:$("deudaNombre").value, montoTotal:$("deudaMontoTotal").value, montoCuota:$("deudaMontoCuota").value, frecuencia:$("deudaFrecuencia").value, saldo:parseFloat($("deudaMontoTotal").value)});
        alert("Deuda guardada"); window.location.reload();
    });

    // --- OTROS ---
    safeClick("btnRegistrarIngreso", () => alert("Ingreso registrado (Simulado)."));
    safeClick("btnGuardarMantenimiento", () => {
        guardarConfigMantenimiento($("mantenimientoAceite").value, $("mantenimientoBujia").value, $("mantenimientoLlantas").value);
        alert("Mantenimiento guardado.");
    });
    
    // --- DATOS ---
    safeClick("btnExportar", () => { navigator.clipboard.writeText(JSON.stringify(getState())).then(()=>alert("Copiado")); });
    safeClick("btnImportar", () => {
        const json = $("importJson").value;
        if(!json) return;
        localStorage.setItem("panelData", json);
        alert("Restaurado."); window.location.reload();
    });
};
