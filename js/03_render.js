// 03_render.js
import { $, fmtMoney, CATEGORIAS_GASTOS, formatearFecha, safeNumber } from './01_consts_utils.js';
import { getState, getTurnoActivo, iniciarTurnoLogic, finalizarTurnoLogic, recalcularMetaDiaria, registrarCargaGasolina, actualizarOdometroManual, agregarDeuda, agregarGasto, agregarGastoFijo, exportarJsonLogic, importarJsonLogic } from './02_data.js';

/* ==========================================================================
   SECCIÓN 1: RENDERIZADO DE ELEMENTOS (UI)
   ========================================================================== */

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
            costoKmDisplay.innerText = `$${fmtMoney(costo)}/km`; 
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

// --- DASHBOARD (INDEX): RENDERIZADO DE TABLA DE TURNOS (CORRECCIÓN) ---
export const renderDashboard = () => {
    const state = getState();
    const set = (id, v) => { const el = $(id); if(el) el.innerText = v; };

    const hoyStr = new Date().toLocaleDateString();
    const turnosHoy = state.turnos.filter(t => new Date(t.fecha).toLocaleDateString() === hoyStr);
    const gananciaHoy = turnosHoy.reduce((acc, t) => acc + t.ganancia, 0);
    const horasHoy = turnosHoy.reduce((acc, t) => acc + t.horas, 0);

    // 1. Renderizar KPIs
    set("resHoras", `${horasHoy.toFixed(2)}h`);
    set("resGananciaBruta", `$${fmtMoney(gananciaHoy)}`);
    set("resGananciaNeta", `$${fmtMoney(gananciaHoy)}`); 
    set("resKmRecorridos", `${state.parametros.ultimoKM} km`);
    set("proyKmTotal", `${state.parametros.ultimoKM} KM`);
    set("proyGastoFijoDiario", `$${fmtMoney(state.parametros.gastoFijo)}`);
    set("proyDeuda", `$${fmtMoney(state.parametros.deudaTotal || state.deudas.reduce((a,b)=>a+b.saldo,0))}`);


    // 2. Renderizar Tabla de Últimos Turnos (CORRECCIÓN CRÍTICA)
    const tbodyTurnos = $("tablaTurnos");
    if (tbodyTurnos) {
        tbodyTurnos.innerHTML = "";
        // Mostrar los últimos 5 turnos, los más recientes primero
        const ultimosTurnos = state.turnos.slice(-5).reverse(); 

        if (ultimosTurnos.length === 0) {
            tbodyTurnos.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#999;">Aún no hay turnos registrados.</td></tr>`;
        } else {
            ultimosTurnos.forEach(t => {
                const tr = document.createElement('tr');
                const gananciaNeta = t.ganancia; 
                
                tr.innerHTML = `
                    <td>${formatearFecha(t.fecha)}</td>
                    <td>${t.horas.toFixed(2)}h</td>
                    <td style="color:#6b7280; font-style:italic;">N/A</td> 
                    <td style="font-weight:bold;">$${fmtMoney(gananciaNeta)}</td>
                `;
                tbodyTurnos.appendChild(tr);
            });
        }
    }
};

// --- RENDERIZADO DEL HISTORIAL ---
export const renderHistorial = () => {
    const tbody = $("historialBody");
    const resumenDiv = $("historialResumen");
    const state = getState();
    
    if (!tbody || !resumenDiv) return;

    tbody.innerHTML = "";
    
    let ingresosTotal = 0;
    let gastosTotal = 0;

    state.movimientos.slice().reverse().forEach(mov => { 
        const tr = document.createElement('tr');
        const isIngreso = mov.tipo === 'ingreso';
        const monto = safeNumber(mov.monto);
        
        if (isIngreso) { ingresosTotal += monto; tr.style.backgroundColor = '#ecfdf5'; } else { gastosTotal += monto; tr.style.backgroundColor = '#fff5f5'; }

        tr.innerHTML = `<td>${isIngreso ? '➕ Ingreso' : '➖ Gasto'}</td><td>${formatearFecha(mov.fecha)}</td><td>${mov.desc}</td><td style="font-weight:bold; color: ${isIngreso ? '#059669' : '#dc2626'}">$${fmtMoney(monto)}</td>`;
        tbody.appendChild(tr);
    });
    
    const neto = ingresosTotal - gastosTotal;
    resumenDiv.innerHTML = `
        <p>Total Ingresos: <strong style="color:#059669;">$${fmtMoney(ingresosTotal)}</strong></p>
        <p>Total Gastos: <strong style="color:#dc2626;">$${fmtMoney(gastosTotal)}</strong></p>
        <hr style="margin:5px 0;">
        <p>Balance Neto: <strong style="color:${neto >= 0 ? '#059669' : '#dc2626'}; font-size:1.1rem;">$${fmtMoney(neto)}</strong></p>
    `;
};


/* ==========================================================================
   SECCIÓN 2: LISTENERS (Mantenido igual)
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

    // 3. Gastos Inteligentes
    const llenar = (tipo) => {
        const select = $("gastoCategoriaSelect"), inputManual = $("gastoCategoriaManual");
        select.innerHTML = ""; inputManual.style.display = "none";
        const lista = CATEGORIAS_GASTOS[tipo] || [];
        lista.forEach(cat => { const option = document.createElement("option"); option.value = cat; option.text = cat; select.appendChild(option); });
        select.onchange = () => { if (select.value.includes("Otro / Nuevo")) { inputManual.style.display = "block"; inputManual.focus(); } else { inputManual.style.display = "none"; } };
    };
    llenar("moto"); 
    document.getElementsByName("gastoTipoRadio").forEach(r => { r.addEventListener("change", (e) => llenar(e.target.value)); });

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
        } else {
            gasto.frecuencia = "No Recurrente";
            agregarGasto(gasto);
        }
        alert(`Gasto ${checkRecurrente.checked ? 'Fijo' : 'Esporádico'} guardado.`);
        $("gastoCantidad").value=""; $("gastoDescripcion").value=""; $("gastoCategoriaManual").value=""; if($("divFrecuenciaGasto")) $("divFrecuenciaGasto").style.display="none"; if(checkRecurrente) checkRecurrente.checked=false; select.selectedIndex=0;
        window.location.reload();
    };

    // 4. Wizards Deuda y Gasolina
    const gasIds = ["gasWizardPaso1","gasWizardPaso2","gasWizardPaso3"];
    if($(gasIds[0])) {
        $("btnGasSiguiente1").onclick=()=>{$(gasIds[0]).style.display='none';$(gasIds[1]).style.display='block'};
        $("btnGasSiguiente2").onclick=()=>{$(gasIds[1]).style.display='none';$(gasIds[2]).style.display='block'};
        $("btnGasAtras2").onclick=()=>{$(gasIds[1]).style.display='none';$(gasIds[0]).style.display='block'};
        $("btnGasAtras3").onclick=()=>{$(gasIds[2]).style.display='none';$(gasIds[1]).style.display='block'};
        $("btnRegistrarCargaFinal").onclick=()=>{ registrarCargaGasolina($("gasLitros").value, $("gasCosto").value, $("gasKmActual").value); alert("Carga guardada"); window.location.reload(); };
    }
    const deuIds = ["deudaWizardStep1","deudaWizardStep2","deudaWizardStep3"];
    if($(deuIds[0])) {
        $("btnDeudaNext1").onclick=()=>{if(!$("deudaNombre").value)return alert("Nombre?"); $(deuIds[0]).style.display='none';$(deuIds[1]).style.display='block'};
        $("btnDeudaNext2").onclick=()=>{$(deuIds[1]).style.display='none';$(deuIds[2]).style.display='block'};
        $("btnDeudaBack2").onclick=()=>{$(deuIds[1]).style.display='none';$(deuIds[0]).style.display='block'};
        $("btnDeudaBack3").onclick=()=>{$(deuIds[2]).style.display='none';$(deuIds[1]).style.display='block'};
        $("btnRegistrarDeudaFinal").onclick=()=>{ agregarDeuda({id:Date.now(), desc:$("deudaNombre").value, montoTotal:$("deudaMontoTotal").value, montoCuota:$("deudaMontoCuota").value, frecuencia:$("deudaFrecuencia").value, saldo:parseFloat($("deudaMontoTotal").value)}); alert("Deuda guardada"); window.location.reload(); };
    }
    
    // 5. Respaldo
    const btnExport = $("btnExportarJson"), btnImport = $("btnRestaurarDatos"), textareaImport = $("importJson"), btnExcel = $("btnBajarExcel");
    if (btnExport) btnExport.onclick = async () => { try { await navigator.clipboard.writeText(exportarJsonLogic()); alert("JSON copiado. ¡Guardada!"); } catch (err) { console.error('Error:', err); alert("Error al copiar."); } };
    if (btnImport && textareaImport) btnImport.onclick = () => { if (!textareaImport.value) return alert("Pega los datos JSON."); if (confirm("ADVERTENCIA: ¿Seguro?")) { if (importarJsonLogic(textareaImport.value)) window.location.reload(); else alert("ERROR: Formato JSON inválido."); } };
    if (btnExcel) btnExcel.onclick = exportarExcel;

    if($("btnRegistrarIngreso")) $("btnRegistrarIngreso").onclick = () => alert("Ingreso registrado (Simulado).");
};
