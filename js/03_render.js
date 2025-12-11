import { $, fmtMoney, CATEGORIAS_GASTOS, formatearFecha, safeNumber } from './01_consts_utils.js';
import * as Data from './02_data.js'; 

// --- HERRAMIENTA ANTI-CRASH (Safe Click) ---
const safeClick = (id, fn) => { const el = $(id); if (el) el.onclick = fn; };

/* ==========================================================================
   RENDERIZADO UI (VISUALIZACIÓN)
   ========================================================================== */

export const renderTurnoUI = () => {
    const lbl = $("turnoTexto");
    if (!lbl) return; 

    const activo = Data.getTurnoActivo();
    const btnIn = $("btnIniciarTurno");
    const btnPre = $("btnPreFinalizarTurno");
    const divCierre = $("cierreTurnoContainer");

    if (divCierre) divCierre.style.display = "none";

    if (activo) {
        lbl.innerHTML = `🟢 Turno Activo: <b>${new Date(activo.inicio).toLocaleTimeString()}</b>`;
        lbl.style.color = "#16a34a";
        if (btnIn) btnIn.style.display = "none";
        if (btnPre) { btnPre.style.display = "inline-block"; btnPre.innerText = "Finalizar Turno"; }
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
    const state = Data.getState();
    
    // 1. TARJETAS DE RESUMEN
    const set = (id, v) => { const el = $(id); if(el) el.innerText = v; };
    const hoy = new Date().toLocaleDateString();
    const turnosHoy = state.turnos.filter(t => new Date(t.fecha).toLocaleDateString() === hoy);
    const ganancia = turnosHoy.reduce((a,b)=>a+b.ganancia,0);
    const horas = turnosHoy.reduce((a,b)=>a+b.horas,0);

    set("resHoras", `${horas.toFixed(2)}h`);
    set("resGananciaBruta", `$${fmtMoney(ganancia)}`);
    set("resKmRecorridos", `${state.parametros.ultimoKM}`);
    set("proyGastoFijoDiario", `$${fmtMoney(state.parametros.gastoFijo)}`);

    // 2. TABLA ÚLTIMOS TURNOS
    const tbodyTurnos = $("tablaTurnos");
    if (tbodyTurnos) {
        tbodyTurnos.innerHTML = "";
        const ultimos = state.turnos.slice().reverse().slice(0, 5); 
        
        if (ultimos.length === 0) {
            tbodyTurnos.innerHTML = "<tr><td colspan='4' style='text-align:center'>Sin registros aún</td></tr>";
        } else {
            ultimos.forEach(t => {
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td>${formatearFecha(t.fecha)}</td>
                    <td>${t.horas.toFixed(2)}h</td>
                    <td>$${fmtMoney(t.ganancia)}</td>
                `;
                tbodyTurnos.appendChild(tr);
            });
        }
    }

    // 3. TABLA HISTÓRICO GASOLINA
    const divGas = $("tablaKmMensual");
    if (divGas) {
        const cargas = state.cargasCombustible.slice().reverse().slice(0, 5);
        if (cargas.length === 0) {
            divGas.innerHTML = "<p style='text-align:center; padding:10px; color:#666'>Sin cargas registradas</p>";
        } else {
            let html = `<table class="tabla"><thead><tr><th>Fecha</th><th>Litros</th><th>Costo</th><th>KM Reg.</th></tr></thead><tbody>`;
            cargas.forEach(c => {
                html += `<tr>
                    <td>${formatearFecha(c.fecha)}</td>
                    <td>${c.litros} L</td>
                    <td>$${fmtMoney(c.costo)}</td>
                    <td>${c.km}</td>
                </tr>`;
            });
            html += `</tbody></table>`;
            divGas.innerHTML = html;
        }
    }
};

export const renderHistorial = () => {
    const tbody = $("historialBody");
    const resumen = $("historialResumen");
    if (!tbody || !resumen) return;

    tbody.innerHTML = "";
    const movs = Data.getState().movimientos.slice().reverse();
    let ing = 0, gas = 0;

    movs.forEach(m => {
        const tr = document.createElement("tr");
        const isIng = m.tipo === 'ingreso';
        const monto = safeNumber(m.monto);
        if (isIng) { ing += monto; tr.style.backgroundColor = "#ecfdf5"; } 
        else { gas += monto; tr.style.backgroundColor = "#fff5f5"; }
        
        tr.innerHTML = `<td>${isIng?'➕':'➖'}</td><td>${formatearFecha(m.fecha)}</td><td>${m.desc}</td><td style="color:${isIng?'green':'red'}">$${fmtMoney(monto)}</td>`;
        tbody.appendChild(tr);
    });

    resumen.innerHTML = `<p>Ingresos: <b style="color:green">$${fmtMoney(ing)}</b> | Gastos: <b style="color:red">$${fmtMoney(gas)}</b> | Neto: <b>$${fmtMoney(ing-gas)}</b></p>`;
};

/* ==========================================================================
   LISTENERS ADMIN (BOTONES)
   ========================================================================== */
export const setupAdminListeners = () => {
    if (document.body.getAttribute("data-page") !== "admin") return; 

    // --- TURNOS ---
    safeClick("btnIniciarTurno", () => { if(Data.iniciarTurnoLogic()) renderTurnoUI(); });
    safeClick("btnPreFinalizarTurno", () => { $("btnPreFinalizarTurno").style.display="none"; $("cierreTurnoContainer").style.display="block"; });
    safeClick("btnCancelarCierre", () => { $("cierreTurnoContainer").style.display="none"; $("btnPreFinalizarTurno").style.display="inline-block"; });
    safeClick("btnConfirmarFinalizar", () => {
        const m = $("gananciaBruta").value;
        if(!m) return alert("Monto?");
        Data.finalizarTurnoLogic(m); renderTurnoUI(); $("gananciaBruta").value=""; alert("Hecho");
    });

    // --- ODÓMETRO ---
    safeClick("btnActualizarOdometro", () => {
        if(Data.actualizarOdometroManual($("inputOdometro").value)) { renderOdometroUI(); $("inputOdometro").value=""; alert("Ok"); }
    });

    // --- GASTOS Y CATEGORÍAS (CORREGIDO) ---
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

    // CORRECCIÓN: Verificamos si existe el SELECT en lugar del RadioButton por ID
    if($("gastoCategoriaSelect")) {
        llenarCats("moto"); // Inicializa con moto
        
        // Asignamos el evento a TODOS los radios con ese nombre
        document.getElementsByName("gastoTipoRadio").forEach(r => {
            r.addEventListener("change", (e) => llenarCats(e.target.value));
        });
    }
    
    const chkRec = $("checkEsRecurrente");
    if(chkRec) chkRec.onchange = () => $("divFrecuenciaGasto").style.display = chkRec.checked ? "block" : "none";
    
    safeClick("btnRegistrarGasto", () => {
        const sel=$("gastoCategoriaSelect"), man=$("gastoCategoriaManual"), m=$("gastoCantidad").value;
        let cat = (sel.value.includes("➕") && man && man.value.trim()) ? man.value.trim() : sel.value;
        if(!m) return alert("Falta monto");
        
        const g = { id:Date.now(), fecha:new Date().toISOString(), categoria:cat, monto:Number(m), desc:$("gastoDescripcion").value, tipo:"moto" }; 
        
        if(chkRec.checked) { 
            g.frecuencia = $("gastoFrecuenciaSelect").value; 
            Data.agregarGastoFijo(g); 
        } else { 
            g.frecuencia = "No Recurrente"; 
            Data.agregarGasto(g); 
        }
        alert("Gasto Guardado"); 
        $("gastoCantidad").value=""; $("gastoDescripcion").value="";
        if(man) { man.value=""; man.style.display="none"; }
        if(chkRec.checked) { window.location.reload(); }
    });

    // --- WIZARDS ---
    safeClick("btnGasSiguiente1", () => { $("gasWizardPaso1").style.display='none'; $("gasWizardPaso2").style.display='block'; });
    safeClick("btnGasSiguiente2", () => { $("gasWizardPaso2").style.display='none'; $("gasWizardPaso3").style.display='block'; });
    safeClick("btnGasAtras2", () => { $("gasWizardPaso2").style.display='none'; $("gasWizardPaso1").style.display='block'; });
    safeClick("btnGasAtras3", () => { $("gasWizardPaso3").style.display='none'; $("gasWizardPaso2").style.display='block'; });

    safeClick("btnRegistrarCargaFinal", () => {
        Data.registrarCargaGasolina($("gasLitros").value, $("gasCosto").value, $("gasKmActual").value);
        alert("Gasolina Guardada"); window.location.reload();
    });
    
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

    safeClick("btnGuardarMantenimiento", () => {
        Data.guardarConfigMantenimiento($("mantenimientoAceite").value, $("mantenimientoBujia").value, $("mantenimientoLlantas").value);
        alert("Config Guardada");
    });

    // --- EXPORTAR A EXCEL ---
    safeClick("btnExportar", () => { 
        if (typeof XLSX === 'undefined') {
            alert("Error: Librería Excel no cargada. Conéctate a internet.");
            return;
        }
        
        const state = Data.getState();
        const wb = XLSX.utils.book_new();

        if(state.turnos.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(state.turnos), "Turnos");
        if(state.movimientos.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(state.movimientos), "Movimientos");
        if(state.cargasCombustible.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(state.cargasCombustible), "Gasolina");

        XLSX.writeFile(wb, "Respaldo_Tracker.xlsx");
    });

    safeClick("btnImportar", () => { 
        if(!$("importJson").value) return;
        localStorage.setItem("panelData_vFinal", $("importJson").value); 
        location.reload(); 
    });
};
