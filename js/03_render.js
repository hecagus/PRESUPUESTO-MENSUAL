import { $, fmtMoney, CATEGORIAS_GASTOS, formatearFecha, safeNumber } from './01_consts_utils.js';
import * as Data from './02_data.js'; 

const safeClick = (id, fn) => { const el = $(id); if (el) el.onclick = fn; };

/* --- RENDERIZADO UI --- */

export const renderTurnoUI = () => {
    const lbl = $("turnoTexto");
    if (!lbl) return; 

    const activo = Data.getTurnoActivo();
    const btnIn = $("btnIniciarTurno");
    const btnFin = $("btnFinalizarTurno");
    const divCierre = $("cierreTurnoContainer");

    // Reset visual
    if (divCierre) divCierre.style.display = "none";

    if (activo) {
        lbl.innerHTML = `🟢 Turno Activo: <b>${new Date(activo.inicio).toLocaleTimeString()}</b>`;
        lbl.style.color = "#16a34a";
        if (btnIn) btnIn.style.display = "none";
        
        // Mostrar botón finalizar si no estamos ya cerrando
        if (btnFin) {
            btnFin.style.display = "inline-block";
            btnFin.onclick = () => {
                btnFin.style.display = "none";
                if(divCierre) divCierre.style.display = "block";
            };
        }
    } else {
        lbl.innerHTML = `🔴 Sin turno activo`;
        lbl.style.color = "#dc2626";
        if (btnIn) btnIn.style.display = "inline-block";
        if (btnFin) btnFin.style.display = "none";
    }
};

export const renderOdometroUI = () => {
    // Si existe la etiqueta de odómetro (puede que no esté en este HTML exacto, pero lo protejemos)
    const lbl = $("lblKmAnterior"); // En tu HTML no veo este ID exacto en la sección 4, pero lo dejamos por compatibilidad
    if (lbl) {
        const state = Data.getState();
        lbl.innerText = `${state.parametros.ultimoKM} km`;
    }
    const costo = $("costoPorKmDisplay");
    if (costo) {
        const state = Data.getState();
        costo.innerText = state.parametros.costoPorKm > 0 ? `$${fmtMoney(state.parametros.costoPorKm)}/km` : "Calculando...";
    }
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

export const renderListasAdmin = () => {
    // Gastos Fijos
    const ul = $("listaGastosFijos");
    if (ul) {
        ul.innerHTML = "";
        const fijos = Data.getState().gastosFijosMensuales;
        fijos.forEach(g => {
            ul.innerHTML += `<li>${g.categoria} (${g.frecuencia}) - $${fmtMoney(g.monto)}</li>`;
        });
        const totalDisp = $("totalFijoMensualDisplay");
        if(totalDisp) totalDisp.innerText = `$${fmtMoney(Data.getState().parametros.gastoFijo * 30)}`; // Estimado mensual
    }

    // Deudas
    const ulDeudas = $("listaDeudas");
    const selAbono = $("abonoSeleccionar");
    if(ulDeudas) {
        ulDeudas.innerHTML = "";
        if(selAbono) selAbono.innerHTML = "";
        Data.getState().deudas.forEach(d => {
            if(d.saldo > 0) {
                ulDeudas.innerHTML += `<li>${d.desc}: $${fmtMoney(d.saldo)}</li>`;
                if(selAbono) {
                    const o = document.createElement("option"); o.value=d.id; o.text=d.desc; selAbono.add(o);
                }
            }
        });
    }
};

/* --- LISTENERS --- */
export const setupAdminListeners = () => {
    if (document.body.getAttribute("data-page") !== "admin") return; 

    // Turno
    safeClick("btnIniciarTurno", () => { if(Data.iniciarTurnoLogic()) renderTurnoUI(); });
    safeClick("btnCancelarCierre", () => { renderTurnoUI(); }); // Resetea la vista
    safeClick("btnConfirmarFinalizar", () => {
        const m = $("gananciaBruta").value;
        const km = $("kmFinalTurno").value;
        if(!m) return alert("Ingresa ganancia");
        Data.finalizarTurnoLogic(m, km); 
        renderTurnoUI(); 
        $("gananciaBruta").value=""; $("kmFinalTurno").value=""; 
        alert("Turno Finalizado");
    });

    // Gastos - Llenar Categorias
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

    // Registrar Gasto
    safeClick("btnRegistrarGasto", () => {
        const sel=$("gastoCategoriaSelect"), man=$("gastoCategoriaManual"), m=$("gastoCantidad").value;
        let cat = (sel.value.includes("➕") && man && man.value.trim()) ? man.value.trim() : sel.value;
        if(!m) return alert("Falta monto");

        // Verificamos si marcó checkbox de recurrente
        const checkRec = $("checkEsRecurrente");
        const esFijo = checkRec ? checkRec.checked : false;

        // Tipo (Moto/Hogar)
        let tipo = "moto";
        const radios = document.getElementsByName("gastoTipoRadio");
        for(let r of radios) if(r.checked) tipo = r.value;

        const g = { id:Date.now(), fecha:new Date().toISOString(), categoria:cat, monto:Number(m), desc:$("gastoDescripcion").value, tipo:tipo }; 
        
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
        renderListasAdmin(); 
        renderMetaDiaria();
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

    // Mantenimiento
    safeClick("btnGuardarMantenimiento", () => {
        Data.guardarConfigMantenimiento($("mantenimientoAceite").value, $("mantenimientoBujia").value, $("mantenimientoLlantas").value);
        alert("Config Guardada");
    });

    // Deudas Wizards
    safeClick("btnDeudaNext1", () => { if(!$("deudaNombre").value)return alert("Nombre?"); $("deudaWizardStep1").style.display='none'; $("deudaWizardStep2").style.display='block'; });
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

    // Abono
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

    // Exportar
    safeClick("btnExportar", () => { 
        if (typeof XLSX === 'undefined') {
            alert("Error: Librería Excel no cargada.");
            return;
        }
        const state = Data.getState();
        const wb = XLSX.utils.book_new();

        if(state.turnos.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(state.turnos), "Turnos");
        if(state.movimientos.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(state.movimientos), "Movimientos");
        if(state.cargasCombustible.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(state.cargasCombustible), "Gasolina");

        XLSX.writeFile(wb, "Respaldo_Tracker.xlsx");
    });
};
