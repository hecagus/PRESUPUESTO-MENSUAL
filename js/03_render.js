import { $, fmtMoney, CATEGORIAS_GASTOS, formatearFecha, safeNumber } from './01_consts_utils.js';
import * as Data from './02_data.js'; 

const safeClick = (id, fn) => { const el = $(id); if (el) el.onclick = fn; };

/* --- RENDERIZADO --- */

export const renderTurnoUI = () => {
    const lbl = $("turnoTexto");
    if (!lbl) return; 

    const activo = Data.getTurnoActivo();
    const btnIn = $("btnIniciarTurno");
    const btnPre = $("btnFinalizarTurno"); // Nota: En tu HTML es btnFinalizarTurno
    const divCierre = $("cierreTurnoContainer");

    if (divCierre) divCierre.style.display = "none";

    if (activo) {
        lbl.innerHTML = `🟢 Turno Activo: <b>${new Date(activo.inicio).toLocaleTimeString()}</b>`;
        lbl.style.color = "#16a34a";
        if (btnIn) btnIn.style.display = "none";
        if (btnPre) { btnPre.style.display = "inline-block"; btnPre.onclick = () => {
             // Lógica para mostrar el contenedor de cierre
             btnPre.style.display = "none";
             divCierre.style.display = "block";
        };}
    } else {
        lbl.innerHTML = `🔴 Sin turno activo`;
        lbl.style.color = "#dc2626";
        if (btnIn) btnIn.style.display = "inline-block";
        if (btnPre) btnPre.style.display = "none";
    }
};

export const renderOdometroUI = () => {
    const lbl = $("lblKmAnterior");
    if (!lbl) return;
    const state = Data.getState();
    lbl.innerText = `${state.parametros.ultimoKM} km`;
    
    const costo = $("costoPorKmDisplay");
    if (costo) costo.innerText = state.parametros.costoPorKm > 0 ? `$${fmtMoney(state.parametros.costoPorKm)}/km` : "Calculando...";
};

export const renderMetaDiaria = () => {
    const el = $("metaDiariaDisplay");
    if (el) el.innerText = `$${fmtMoney(Data.recalcularMetaDiaria())}`;
};

export const renderMantenimientoUI = () => {
    const state = Data.getState();
    const cfg = state.parametros?.mantenimientoBase || {};
    const set = (id, k) => { const el = $(id); if(el) el.value = cfg[k]||0; };
    set("mantenimientoAceite", "Aceite");
    set("mantenimientoBujia", "Bujía");
    set("mantenimientoLlantas", "Llantas");
};

export const renderDashboard = () => {
    // (Esta función es para el index.html, no afecta al admin)
};

export const renderHistorial = () => {
    // (Esta función es para historial.html)
};

/* --- LISTENERS --- */
export const setupAdminListeners = () => {
    if (document.body.getAttribute("data-page") !== "admin") return; 

    // Turnos
    safeClick("btnIniciarTurno", () => { if(Data.iniciarTurnoLogic()) renderTurnoUI(); });
    safeClick("btnCancelarCierre", () => { $("cierreTurnoContainer").style.display="none"; $("btnFinalizarTurno").style.display="inline-block"; });
    safeClick("btnConfirmarFinalizar", () => {
        const m = $("gananciaBruta").value;
        if(!m) return alert("Ingresa la ganancia del turno");
        Data.finalizarTurnoLogic(m); renderTurnoUI(); $("gananciaBruta").value=""; alert("Turno Finalizado");
    });

    // Odómetro
    safeClick("btnActualizarOdometro", () => {
        if(Data.actualizarOdometroManual($("inputOdometro").value)) { renderOdometroUI(); $("inputOdometro").value=""; alert("KM Actualizado"); }
    });

    // Gastos
    const llenarCats = (tipo) => {
        const sel = $("gastoCategoriaSelect");
        const manualInput = $("gastoCategoriaManual");
        if(!sel) return;
        sel.innerHTML="";
        if(manualInput) manualInput.style.display = "none";

        (CATEGORIAS_GASTOS[tipo]||[]).forEach(c => {
            const o = document.createElement("option"); o.value=c; o.text=c; sel.appendChild(o);
        });

        sel.onchange = () => {
            if (sel.value.includes("➕") && manualInput) { 
                manualInput.style.display = "block"; manualInput.focus();
            } else if (manualInput) {
                manualInput.style.display = "none";
            }
        };
    };

    if($("gastoCategoriaSelect")) {
        llenarCats("moto");
        document.getElementsByName("gastoTipoRadio").forEach(r => {
            r.addEventListener("change", (e) => llenarCats(e.target.value));
        });
    }
    
    const chkRec = $("checkEsRecurrente");
    // Ajuste visual para el divFrecuenciaGasto según tu HTML
    if(chkRec) chkRec.onchange = () => {
         const divFreq = $("divFrecuenciaGasto"); // Tu HTML usa este ID en un div, o directamente el select
         // En tu HTML, el select está dentro de un div con ID "divFrecuenciaGasto" o similar?
         // Revisando tu HTML: <div style="... display:none;" id="divFrecuenciaGasto"> está oculto.
         // El checkbox controla ese div.
         const divContainer = document.getElementById("gastoFrecuenciaSelect").parentElement;
         // Simplificación basada en tu estructura:
         const selectFreq = $("gastoFrecuenciaSelect");
         if(selectFreq) selectFreq.parentElement.style.display = chkRec.checked ? "block" : "none"; // Ocultar/Mostrar el contenedor si tiene style
    };
    
    safeClick("btnRegistrarGasto", () => {
        const sel=$("gastoCategoriaSelect"), man=$("gastoCategoriaManual"), m=$("gastoCantidad").value;
        let cat = (sel.value.includes("➕") && man && man.value.trim()) ? man.value.trim() : sel.value;
        if(!m) return alert("Falta monto");
        
        // En tu HTML el checkbox es "checkEsRecurrente"
        const esFijo = $("checkEsRecurrente").checked;
        const g = { id:Date.now(), fecha:new Date().toISOString(), categoria:cat, monto:Number(m), desc:$("gastoDescripcion").value, tipo:"moto" }; // Default moto, ajusta según radio
        
        // Detectar tipo seleccionado
        const radios = document.getElementsByName("gastoTipoRadio");
        for(let r of radios) { if(r.checked) g.tipo = r.value; }

        if(esFijo) { 
            g.frecuencia = $("gastoFrecuenciaSelect").value; 
            Data.agregarGastoFijo(g); 
            alert("Gasto Fijo Guardado");
        } else { 
            g.frecuencia = "No Recurrente"; 
            Data.agregarGasto(g); 
            alert("Gasto Guardado");
        }
        
        $("gastoCantidad").value=""; $("gastoDescripcion").value="";
        if(man) { man.value=""; man.style.display="none"; }
        if(esFijo) window.location.reload(); 
    });

    // Ingreso
    safeClick("btnRegistrarIngreso", () => {
        const d = $("ingresoDescripcion").value; const m=$("ingresoCantidad").value;
        if(m) {
            Data.getState().movimientos.push({tipo:'ingreso', fecha:new Date().toISOString(), desc:d||"Ingreso Extra", monto:safeNumber(m)});
            Data.saveData(); alert("Ingreso registrado"); $("ingresoCantidad").value="";
        }
    });

    // Gasolina
    safeClick("btnGasSiguiente1", () => { $("gasWizardPaso1").style.display='none'; $("gasWizardPaso2").style.display='block'; });
    safeClick("btnGasSiguiente2", () => { $("gasWizardPaso2").style.display='none'; $("gasWizardPaso3").style.display='block'; });
    safeClick("btnGasAtras2", () => { $("gasWizardPaso2").style.display='none'; $("gasWizardPaso1").style.display='block'; });
    safeClick("btnGasAtras3", () => { $("gasWizardPaso3").style.display='none'; $("gasWizardPaso2").style.display='block'; });

    safeClick("btnRegistrarCargaFinal", () => {
        Data.registrarCargaGasolina($("gasLitros").value, $("gasCosto").value, $("gasKmActual").value);
        alert("Gasolina Guardada"); window.location.reload();
    });
    
    // Deudas
    safeClick("btnDeudaNext1", () => { $("deudaWizardStep1").style.display='none'; $("deudaWizardStep2").style.display='block'; });
    safeClick("btnDeudaNext2", () => { $("deudaWizardStep2").style.display='none'; $("deudaWizardStep3").style.display='block'; });
    safeClick("btnDeudaBack2", () => { $("deudaWizardStep2").style.display='none'; $("deudaWizardStep1").style.display='block'; });
    safeClick("btnDeudaBack3", () => { $("deudaWizardStep3").style.display='none'; $("deudaWizardStep2").style.display='block'; });

    safeClick("btnRegistrarDeudaFinal", () => {
        Data.agregarDeuda({
            id:Date.now(), desc:$("deudaNombre").value, 
            montoTotal:$("deudaMontoTotal").value, montoCuota:$("deudaMontoCuota").value, 
            frecuencia:$("deudaFrecuencia").value, saldo:Number($("deudaMontoTotal").value)
        });
        alert("Deuda Guardada"); window.location.reload();
    });
    
    // Abono Deuda (Faltaba este listener)
    safeClick("btnRegistrarAbono", () => {
        const idDeuda = $("abonoSeleccionar").value; const m = $("abonoMonto").value;
        if(m && idDeuda) {
            const deuda = Data.getState().deudas.find(d => d.id == idDeuda);
            if(deuda) {
                deuda.saldo -= safeNumber(m);
                Data.getState().movimientos.push({tipo:'gasto', fecha:new Date().toISOString(), desc:`Abono: ${deuda.desc}`, monto:safeNumber(m)});
                Data.recalcularMetaDiaria(); 
                alert("Abono registrado"); window.location.reload();
            }
        }
    });

    safeClick("btnGuardarMantenimiento", () => {
        Data.guardarConfigMantenimiento($("mantenimientoAceite").value, $("mantenimientoBujia").value, $("mantenimientoLlantas").value);
        alert("Config Guardada");
    });

    // Excel
    safeClick("btnExportar", () => { 
        if (typeof XLSX === 'undefined') { return alert("Error: Librería XLSX no cargada."); }
        const state = Data.getState();
        const wb = XLSX.utils.book_new();
        if(state.turnos.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(state.turnos), "Turnos");
        if(state.movimientos.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(state.movimientos), "Movimientos");
        if(state.cargasCombustible.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(state.cargasCombustible), "Gasolina");
        XLSX.writeFile(wb, "Respaldo_Tracker.xlsx");
    });

    safeClick("btnImportar", () => { 
        if(!$("importJson").value) return;
        localStorage.setItem("panelData_vFinal", $("importJson").value); 
        location.reload(); 
    });
};

/* --- RENDERIZADO DE LISTAS --- */
export const renderListasAdmin = () => {
    // Gastos Fijos
    const ulFijos = $("listaGastosFijos");
    if(ulFijos) {
        ulFijos.innerHTML = "";
        const fijos = Data.getState().gastosFijosMensuales;
        fijos.forEach(g => {
            ulFijos.innerHTML += `<li>${g.categoria} (${g.frecuencia}) - $${fmtMoney(g.monto)}</li>`;
        });
        $("totalFijoMensualDisplay").innerText = `$${fmtMoney(Data.getState().parametros.gastoFijo)}`; // Aprox
    }

    // Deudas (Select y Lista)
    const ulDeudas = $("listaDeudas");
    const selAbono = $("abonoSeleccionar");
    if(ulDeudas && selAbono) {
        ulDeudas.innerHTML = "";
        selAbono.innerHTML = "";
        Data.getState().deudas.forEach(d => {
            if(d.saldo > 0) {
                ulDeudas.innerHTML += `<li>${d.desc}: $${fmtMoney(d.saldo)}</li>`;
                const o = document.createElement("option"); o.value = d.id; o.text = d.desc; selAbono.add(o);
            }
        });
    }
};
   
