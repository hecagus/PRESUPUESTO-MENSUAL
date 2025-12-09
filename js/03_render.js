import { $, fmtMoney, CATEGORIAS_GASTOS, formatearFecha, safeNumber } from './01_consts_utils.js';
import { getState, getTurnoActivo, iniciarTurnoLogic, finalizarTurnoLogic, recalcularMetaDiaria, registrarCargaGasolina, actualizarOdometroManual, agregarDeuda, agregarGasto, agregarGastoFijo, guardarConfigMantenimiento } from './02_data.js';

// --- HELPERS VISUALES ---
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

// --- RENDERIZADO UI ---

export const renderTurnoUI = () => {
    const lbl = $("turnoTexto");
    if (!lbl) return; 

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
    const config = state.parametros && state.parametros.mantenimientoBase ? state.parametros.mantenimientoBase : {};
    
    const setVal = (id, key) => { const el = $(id); if (el) el.value = config[key] || 0; };
    setVal("mantenimientoAceite", "Aceite");
    setVal("mantenimientoBujia", "Bujía");
    setVal("mantenimientoLlantas", "Llantas");
};

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

export const renderHistorial = () => {
    const tbody = $("historialBody");
    const resumenDiv = $("historialResumen");
    if (!tbody || !resumenDiv) return;

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

// --- LISTENERS (CONTROLADORES) ---

export const setupAdminListeners = () => {
    // Si no encuentra el botón de turno, asumimos que no es admin y salimos
    const btnIniciar = $("btnIniciarTurno");
    if (!btnIniciar) return; 

    console.log("Activando botones de Admin...");

    // 1. TURNO
    btnIniciar.onclick = () => { 
        if(iniciarTurnoLogic()) renderTurnoUI(); 
    };

    const btnPre = $("btnPreFinalizarTurno");
    if(btnPre) btnPre.onclick = () => { 
        btnPre.style.display="none"; 
        $("cierreTurnoContainer").style.display="block"; 
    };

    const btnCancel = $("btnCancelarCierre");
    if(btnCancel) btnCancel.onclick = () => { 
        $("cierreTurnoContainer").style.display="none"; 
        btnPre.style.display="inline-block"; 
        $("gananciaBruta").value=""; 
    };

    const btnFin = $("btnConfirmarFinalizar");
    if(btnFin) btnFin.onclick = () => {
        const m = $("gananciaBruta").value;
        if(m === "") return alert("Ingresa el monto.");
        finalizarTurnoLogic(m); 
        $("gananciaBruta").value=""; 
        renderTurnoUI(); 
        alert("Turno cerrado.");
    };

    // 2. ODÓMETRO
    const btnOdo = $("btnActualizarOdometro");
    if(btnOdo) btnOdo.onclick = () => {
        if(actualizarOdometroManual($("inputOdometro").value)) { 
            renderOdometroUI(); 
            $("inputOdometro").value=""; 
            alert("KM actualizado."); 
        }
    };

    // 3. GASTOS
    const radioGroup = document.getElementsByName("gastoTipoRadio");
    if(radioGroup.length > 0) {
        llenarCategorias("moto");
        radioGroup.forEach(r => r.addEventListener("change", (e)=>llenarCategorias(e.target.value)));
    }
    
    const chkRec = $("checkEsRecurrente");
    if(chkRec) chkRec.onchange = () => { 
        $("divFrecuenciaGasto").style.display = chkRec.checked ? "block" : "none"; 
    };

    const btnGasto = $("btnRegistrarGasto");
    if(btnGasto) btnGasto.onclick = () => {
        const sel=$("gastoCategoriaSelect"), inpMan=$("gastoCategoriaManual"), m=$("gastoCantidad").value;
        let cat = sel.value;
        if(cat.includes("Otro") && inpMan.value.trim()) cat = inpMan.value.trim();
        
        if(!m) return alert("Falta el monto");

        const g = { id:Date.now(), fecha:new Date().toISOString(), categoria:cat, monto:Number(m), desc:$("gastoDescripcion").value, tipo:document.querySelector('input[name="gastoTipoRadio"]:checked').value };
        
        if(chkRec && chkRec.checked) { 
            g.frecuencia = $("gastoFrecuenciaSelect").value; 
            agregarGastoFijo(g); 
            alert("Gasto Fijo agregado."); 
        } else { 
            g.frecuencia = "No Recurrente"; 
            agregarGasto(g); 
            alert("Gasto guardado."); 
        }
        
        $("gastoCantidad").value=""; $("gastoDescripcion").value=""; inpMan.value=""; inpMan.style.display="none"; 
        if(chkRec) { chkRec.checked=false; $("divFrecuenciaGasto").style.display="none"; window.location.reload(); }
    };

    // 4. GASOLINA (Directo por ID)
    const btnGasNext1 = $("btnGasSiguiente1");
    if(btnGasNext1) btnGasNext1.onclick = () => { $("gasWizardPaso1").style.display='none'; $("gasWizardPaso2").style.display='block'; };
    
    const btnGasNext2 = $("btnGasSiguiente2");
    if(btnGasNext2) btnGasNext2.onclick = () => { $("gasWizardPaso2").style.display='none'; $("gasWizardPaso3").style.display='block'; };
    
    const btnGasBack2 = $("btnGasAtras2");
    if(btnGasBack2) btnGasBack2.onclick = () => { $("gasWizardPaso2").style.display='none'; $("gasWizardPaso1").style.display='block'; };
    
    const btnGasBack3 = $("btnGasAtras3");
    if(btnGasBack3) btnGasBack3.onclick = () => { $("gasWizardPaso3").style.display='none'; $("gasWizardPaso2").style.display='block'; };
    
    const btnGasFin = $("btnRegistrarCargaFinal");
    if(btnGasFin) btnGasFin.onclick = () => {
        registrarCargaGasolina($("gasLitros").value, $("gasCosto").value, $("gasKmActual").value);
        alert("Carga guardada"); window.location.reload();
    };

    // 5. DEUDA
    const btnDeudaNext1 = $("btnDeudaNext1");
    if(btnDeudaNext1) btnDeudaNext1.onclick = () => { if(!$("deudaNombre").value)return alert("Nombre?"); $("deudaWizardStep1").style.display='none'; $("deudaWizardStep2").style.display='block'; };
    
    const btnDeudaNext2 = $("btnDeudaNext2");
    if(btnDeudaNext2) btnDeudaNext2.onclick = () => { $("deudaWizardStep2").style.display='none'; $("deudaWizardStep3").style.display='block'; };
    
    const btnDeudaBack2 = $("btnDeudaBack2");
    if(btnDeudaBack2) btnDeudaBack2.onclick = () => { $("deudaWizardStep2").style.display='none'; $("deudaWizardStep1").style.display='block'; };
    
    const btnDeudaBack3 = $("btnDeudaBack3");
    if(btnDeudaBack3) btnDeudaBack3.onclick = () => { $("deudaWizardStep3").style.display='none'; $("deudaWizardStep2").style.display='block'; };
    
    const btnDeudaFin = $("btnRegistrarDeudaFinal");
    if(btnDeudaFin) btnDeudaFin.onclick = () => {
        agregarDeuda({id:Date.now(), desc:$("deudaNombre").value, montoTotal:$("deudaMontoTotal").value, montoCuota:$("deudaMontoCuota").value, frecuencia:$("deudaFrecuencia").value, saldo:parseFloat($("deudaMontoTotal").value)});
        alert("Deuda guardada"); window.location.reload();
    };

    // 6. MANTENIMIENTO
    const btnMant = $("btnGuardarMantenimiento");
    if(btnMant) btnMant.onclick = () => {
        guardarConfigMantenimiento($("mantenimientoAceite").value, $("mantenimientoBujia").value, $("mantenimientoLlantas").value);
        alert("Mantenimiento guardado.");
    };

    // 7. DATOS
    const btnExp = $("btnExportar");
    if(btnExp) btnExp.onclick = () => { navigator.clipboard.writeText(JSON.stringify(getState())).then(()=>alert("Copiado")); };
    
    const btnImp = $("btnImportar");
    if(btnImp) btnImp.onclick = () => {
        const json = $("importJson").value;
        if(!json) return;
        localStorage.setItem("panelData", json);
        alert("Restaurado."); window.location.reload();
    };
    
    const btnIng = $("btnRegistrarIngreso");
    if(btnIng) btnIng.onclick = () => alert("Ingreso registrado (Simulado).");
};
