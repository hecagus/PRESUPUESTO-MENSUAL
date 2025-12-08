// 03_render.js
import { $, fmtMoney, CATEGORIAS_GASTOS, DIAS_POR_FRECUENCIA, formatearFecha } from './01_consts_utils.js';
import { getState, getTurnoActivo, iniciarTurnoLogic, finalizarTurnoLogic, recalcularMetaDiaria, registrarCargaGasolina, actualizarOdometroManual, agregarDeuda, agregarGasto, agregarGastoFijo, importarDatosJSON, obtenerDatosCompletos } from './02_data.js';

// --- HELPERS UI ---
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

// --- RENDERIZADO UI DE ADMIN ---
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
    const lblKm = $("lblKmAnterior"), inputKm = $("inputOdometro");
    if (!lblKm) return;
    const state = getState();
    lblKm.innerText = `${state.parametros.ultimoKM} km`;
    inputKm.placeholder = state.parametros.ultimoKM > 0 ? `Mayor a ${state.parametros.ultimoKM}` : "Ingresa KM Inicial";
};

export const renderMetaDiaria = () => {
    const el = $("metaDiariaDisplay");
    if (el) el.innerText = `$${fmtMoney(recalcularMetaDiaria())}`;
};

// --- NUEVO: RENDERIZADO DE LISTAS EN ADMIN ---
export const renderDeudasList = () => {
    const list = $("listaDeudas");
    const select = $("abonoSeleccionar");
    if (!list) return;

    list.innerHTML = "";
    if(select) select.innerHTML = `<option value="">-- Seleccionar Deuda --</option>`;
    
    const state = getState();
    const deudasActivas = state.deudas.filter(d => d.saldo > 0);

    if (deudasActivas.length === 0) {
        list.innerHTML = `<li class="nota" style="padding:10px;">No hay deudas activas registradas.</li>`;
        return;
    }

    deudasActivas.forEach(d => {
        const li = document.createElement("li");
        const cuota = fmtMoney(d.montoCuota);
        const saldo = fmtMoney(d.saldo);
        li.className = "list-item"; 
        li.innerHTML = `
            <strong>${d.desc}</strong> (${d.frecuencia}) 
            <span style="font-size:0.9em; color:#dc2626;">($${saldo} Restan | Cuota: $${cuota})</span>
        `;
        list.appendChild(li);

        if(select) {
            const option = document.createElement("option");
            option.value = d.id;
            option.text = `${d.desc} ($${saldo})`;
            select.appendChild(option);
        }
    });
};

export const renderGastosFijosList = () => {
    const ul = $("listaGastosFijos");
    if(!ul) return;
    
    ul.innerHTML = "";
    const state = getState();

    if (state.gastosFijosMensuales.length === 0) { 
        ul.innerHTML = `<li class="nota" style="padding:10px;">No tienes gastos fijos activos.</li>`; 
        return; 
    }

    state.gastosFijosMensuales.forEach((g) => {
        const li = document.createElement("li");
        const montoDiario = g.monto / (DIAS_POR_FRECUENCIA[g.frecuencia] || 30);
        
        li.innerHTML = `
            <span>${g.categoria} (${g.frecuencia})</span>
            <span style="font-weight:bold;">$${fmtMoney(g.monto)} <span class="nota" style="display:inline; margin-left:10px;">($${fmtMoney(montoDiario)}/día)</span></span>
        `;
        ul.appendChild(li);
    });
};


// --- RENDERIZADO UI DE INDEX Y HISTORIAL ---
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

export const renderHistorialTable = () => {
    const tbody = $("historialBody");
    if (!tbody) return;

    tbody.innerHTML = "";
    const state = getState();

    if (state.movimientos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="nota" style="text-align:center;">No hay movimientos registrados.</td></tr>`;
        return;
    }

    const movimientosOrdenados = [...state.movimientos].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    movimientosOrdenados.forEach(m => {
        const tr = document.createElement("tr");
        const tipoClase = m.tipo === 'ingreso' ? 'color:#16a34a;' : 'color:#dc2626;';
        
        tr.innerHTML = `
            <td style="${tipoClase}">${m.tipo.charAt(0).toUpperCase() + m.tipo.slice(1)}</td>
            <td>${formatearFecha(m.fecha)}</td>
            <td>${m.desc}</td>
            <td style="text-align:right; font-weight:bold; ${tipoClase}">$${fmtMoney(m.monto)}</td>
        `;
        tbody.appendChild(tr);
    });
};


// --- LISTENERS ---
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
            renderGastosFijosList(); 
            alert("Gasto Fijo agregado. Meta Diaria actualizada.");
        } else {
            gasto.frecuencia = "No Recurrente";
            agregarGasto(gasto);
            alert("Gasto guardado.");
        }
        $("gastoCantidad").value=""; $("gastoDescripcion").value=""; $("gastoCategoriaManual").value=""; inputMan.style.display="none"; checkRecurrente.checked=false; $("divFrecuenciaGasto").style.display="none"; select.selectedIndex=0;
        if(checkRecurrente.checked) window.location.reload();
    };

    // 4. Wizards
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
        $("btnRegistrarDeudaFinal").onclick=()=>{ agregarDeuda({id:Date.now(), desc:$("deudaNombre").value, montoTotal:$("deudaMontoTotal").value, montoCuota:$("deudaMontoCuota").value, frecuencia:$("deudaFrecuencia").value, saldo:parseFloat($("deudaMontoTotal").value)}); alert("Deuda guardada"); renderDeudasList(); window.location.reload(); }; 
    }

    // 5. Respaldo
    if($("btnExportarJSON")) $("btnExportarJSON").onclick = () => { const dataStr = JSON.stringify(obtenerDatosCompletos()); navigator.clipboard.writeText(dataStr).then(() => alert("JSON copiado al portapapeles.")); };
    if($("btnExportarExcel")) $("btnExportarExcel").onclick = () => { const state = obtenerDatosCompletos(); if (typeof XLSX === 'undefined') return alert("Librería Excel no cargada."); const wb = XLSX.utils.book_new(); if(state.movimientos.length > 0) { const ws = XLSX.utils.json_to_sheet(state.movimientos); XLSX.utils.book_append_sheet(wb, ws, "Movimientos"); } if(state.turnos.length > 0) { const ws = XLSX.utils.json_to_sheet(state.turnos); XLSX.utils.book_append_sheet(wb, ws, "Turnos"); } XLSX.writeFile(wb, "Backup_Finanzas.xlsx"); };
    if($("btnImportarJSON")) $("btnImportarJSON").onclick = () => { const json = $("importJsonArea").value; if(!json) return alert("Pega el JSON primero."); if(confirm("Esto sobrescribirá tus datos actuales. ¿Seguro?")) { if(importarDatosJSON(json)) { alert("Datos restaurados correctamente."); window.location.reload(); } else { alert("Error: El JSON no es válido."); } } };
};
            
