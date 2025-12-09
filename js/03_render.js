// 03_render.js
import { $, fmtMoney, CATEGORIAS_GASTOS, formatearFecha, safeNumber } from './01_consts_utils.js';
import { getState, getTurnoActivo, iniciarTurnoLogic, finalizarTurnoLogic, recalcularMetaDiaria, registrarCargaGasolina, actualizarOdometroManual, agregarDeuda, agregarGasto, agregarGastoFijo, guardarConfigMantenimiento, loadData, saveData } from './02_data.js';

/* HELPER PARA CONECTAR BOTONES SIN ROMPER TODO */
const conectarBoton = (id, accion) => {
    const el = $(id);
    if (el) {
        el.onclick = accion;
    } else {
        // Solo para depuración interna, no detiene el script
        // console.warn(`Botón no encontrado: ${id}`);
    }
};

/* 1. UI HELPERS */
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

/* 2. RENDERIZADO VISUAL */
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
    const lblKm = $("lblKmAnterior"), inputKm = $("inputOdometro"), costoKmDisplay = $("costoPorKmDisplay"); 
    if (!lblKm) return;
    const state = getState();
    lblKm.innerText = `${state.parametros.ultimoKM} km`;
    inputKm.placeholder = state.parametros.ultimoKM > 0 ? `Mayor a ${state.parametros.ultimoKM}` : "Ingresa KM Inicial";
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
    const state = getState();
    if (!tbody || !resumenDiv) return;
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

/* 3. LISTENERS BLINDADOS (NO FALLAN SI FALTA UN BOTÓN) */
export const setupAdminListeners = () => {
    if (!$("btnIniciarTurno")) return; // Solo admin

    // --- TURNO ---
    conectarBoton("btnIniciarTurno", () => { if(iniciarTurnoLogic()) renderTurnoUI(); });
    conectarBoton("btnPreFinalizarTurno", () => { $("btnPreFinalizarTurno").style.display="none"; $("cierreTurnoContainer").style.display="block"; });
    conectarBoton("btnCancelarCierre", () => { $("cierreTurnoContainer").style.display="none"; $("btnPreFinalizarTurno").style.display="inline-block"; });
    conectarBoton("btnConfirmarFinalizar", () => {
        const m = $("gananciaBruta").value;
        if(m==="") return alert("Monto?");
        finalizarTurnoLogic(m); $("gananciaBruta").value=""; renderTurnoUI(); alert("Cerrado.");
    });

    // --- ODÓMETRO ---
    conectarBoton("btnActualizarOdometro", () => {
        if(actualizarOdometroManual($("inputOdometro").value)) { renderOdometroUI(); $("inputOdometro").value=""; alert("KM actualizado."); }
    });

    // --- GASTOS ---
    llenarCategorias("moto");
    document.getElementsByName("gastoTipoRadio").forEach(r => r.addEventListener("change", (e)=>llenarCategorias(e.target.value)));
    const chkRec = $("checkEsRecurrente");
    if(chkRec) chkRec.onchange = () => { $("divFrecuenciaGasto").style.display = chkRec.checked ? "block" : "none"; };
    
    conectarBoton("btnRegistrarGasto", () => {
        const sel=$("gastoCategoriaSelect"), inpMan=$("gastoCategoriaManual"), m=$("gastoCantidad").value;
        let cat = sel.value;
        if(cat.includes("Otro") && inpMan.value.trim()) cat = inpMan.value.trim();
        if(!m) return alert("Monto?");
        
        const g = { id:Date.now(), fecha:new Date().toISOString(), categoria:cat, monto:Number(m), desc:$("gastoDescripcion").value, tipo:document.querySelector('input[name="gastoTipoRadio"]:checked').value };
        if(chkRec.checked) { g.frecuencia=$("gastoFrecuenciaSelect").value; agregarGastoFijo(g); alert("Fijo agregado."); }
        else { g.frecuencia="No Recurrente"; agregarGasto(g); alert("Gasto guardado."); }
        
        $("gastoCantidad").value=""; $("gastoDescripcion").value=""; inpMan.value=""; inpMan.style.display="none"; chkRec.checked=false; $("divFrecuenciaGasto").style.display="none"; sel.selectedIndex=0;
        if(chkRec.checked) window.location.reload();
    });

    // --- WIZARD GASOLINA (USANDO CONECTAR BOTON) ---
    conectarBoton("btnGasSiguiente1", () => { $("gasWizardPaso1").style.display='none'; $("gasWizardPaso2").style.display='block'; });
    conectarBoton("btnGasSiguiente2", () => { $("gasWizardPaso2").style.display='none'; $("gasWizardPaso3").style.display='block'; });
    conectarBoton("btnGasAtras2", () => { $("gasWizardPaso2").style.display='none'; $("gasWizardPaso1").style.display='block'; });
    conectarBoton("btnGasAtras3", () => { $("gasWizardPaso3").style.display='none'; $("gasWizardPaso2").style.display='block'; });
    conectarBoton("btnRegistrarCargaFinal", () => {
        registrarCargaGasolina($("gasLitros").value, $("gasCosto").value, $("gasKmActual").value);
        alert("Carga guardada"); window.location.reload();
    });

    // --- WIZARD DEUDA ---
    conectarBoton("btnDeudaNext1", () => { if(!$("deudaNombre").value)return alert("Nombre?"); $("deudaWizardStep1").style.display='none'; $("deudaWizardStep2").style.display='block'; });
    conectarBoton("btnDeudaNext2", () => { $("deudaWizardStep2").style.display='none'; $("deudaWizardStep3").style.display='block'; });
    conectarBoton("btnDeudaBack2", () => { $("deudaWizardStep2").style.display='none'; $("deudaWizardStep1").style.display='block'; });
    conectarBoton("btnDeudaBack3", () => { $("deudaWizardStep3").style.display='none'; $("deudaWizardStep2").style.display='block'; });
    conectarBoton("btnRegistrarDeudaFinal", () => {
        agregarDeuda({id:Date.now(), desc:$("deudaNombre").value, montoTotal:$("deudaMontoTotal").value, montoCuota:$("deudaMontoCuota").value, frecuencia:$("deudaFrecuencia").value, saldo:parseFloat($("deudaMontoTotal").value)});
        alert("Deuda guardada"); window.location.reload();
    });

    // --- OTROS ---
    conectarBoton("btnRegistrarIngreso", () => alert("Ingreso registrado (Simulado)."));
    conectarBoton("btnGuardarMantenimiento", () => {
        guardarConfigMantenimiento($("mantenimientoAceite").value, $("mantenimientoBujia").value, $("mantenimientoLlantas").value);
        alert("Mantenimiento guardado.");
    });
    
    // --- DATOS ---
    conectarBoton("btnExportar", () => { navigator.clipboard.writeText(JSON.stringify(getState())).then(()=>alert("Copiado al portapapeles")); });
    conectarBoton("btnImportar", () => {
        const json = $("importJson").value;
        if(!json) return;
        localStorage.setItem("panelData", json);
        alert("Datos restaurados."); window.location.reload();
    });
};
