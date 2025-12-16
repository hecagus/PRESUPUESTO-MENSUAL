import { $, fmtMoney, CATEGORIAS_GASTOS, formatearFecha, safeNumber, STORAGE_KEY } from './01_consts_utils.js';
import * as Data from './02_data.js'; 

const safeClick = (id, fn) => { const el = $(id); if (el) el.onclick = fn; };

/* ==========================================================================
   RENDERIZADO UI (VISTAS DE ADMINISTRACIÓN)
   ========================================================================== */

export const renderTurnoUI = () => {
    const lbl = $("turnoTexto");
    if (!lbl) return; 

    const activo = Data.getTurnoActivo();
    const btnIn = $("btnIniciarTurno");
    const btnFin = $("btnFinalizarTurno");
    const divCierre = $("cierreTurnoContainer");

    if (divCierre) divCierre.style.display = "none";

    if (activo) {
        lbl.innerHTML = `🟢 Turno Activo: <b>${new Date(activo.inicio).toLocaleTimeString()}</b>`;
        lbl.style.color = "#16a34a";
        if (btnIn) btnIn.style.display = "none";
        
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
    const kmInicialDisplay = $("kmInicialDisplay");
    const kmActualDisplay = $("kmActualDisplay");

    if (kmActualDisplay) {
        const state = Data.getState();
        const ultimoKM = state.parametros.ultimoKM;
        
        kmActualDisplay.innerText = `${ultimoKM} km`;
        
        if (kmInicialDisplay) kmInicialDisplay.innerText = `${ultimoKM} km`; 
        
        const costo = $("costoPorKmDisplay");
        if (costo) costo.innerText = state.parametros.costoPorKm > 0 ? `$${fmtMoney(state.parametros.costoPorKm)}/km` : "Calculando...";
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
    const ul = $("listaGastosFijos");
    if (ul) {
        ul.innerHTML = "";
        const fijos = Data.getState().gastosFijosMensuales;
        fijos.forEach(g => {
            ul.innerHTML += `<li>${g.categoria} (${g.frecuencia}) - $${fmtMoney(g.monto)}</li>`;
        });
        const totalDisp = $("totalFijoMensualDisplay");
        if(totalDisp) totalDisp.innerText = `$${fmtMoney(Data.getState().parametros.gastoFijo * 30)}`;
    }

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

/* ==========================================================================
   RENDERIZADO DASHBOARD (INDEX.HTML) Y HISTORIAL
   ========================================================================== */

export const renderDashboard = () => {
    const state = Data.getState();
    if (!state) return; 

    const set = (id, v) => { const el = $(id); if(el) el.innerText = v; };
    const hoy = new Date().toLocaleDateString();

    // 1. CÁLCULOS DEL DÍA
    const turnosHoy = state.turnos.filter(t => new Date(t.fecha).toLocaleDateString() === hoy);
    const gananciaBrutaHoy = turnosHoy.reduce((a, b) => a + safeNumber(b.ganancia), 0);
    const horasHoy = turnosHoy.reduce((a, b) => a + safeNumber(b.horas), 0);
    
    const gastosHoy = state.movimientos.filter(m => m.tipo === 'gasto' && new Date(m.fecha).toLocaleDateString() === hoy).reduce((a,b)=>a+safeNumber(b.monto), 0);
    
    const gananciaNetaHoy = gananciaBrutaHoy - gastosHoy;
    
    // MEJORA DE ESTABILIDAD: Evitar NaN/Infinity
    const gananciaPorHora = (horasHoy > 0) ? (gananciaNetaHoy / horasHoy) : 0;

    // 2. RENDERING DE KPIS
    set("resHorasTrabajadas", `${horasHoy.toFixed(2)}h`); // Horas Trabajadas
    set("resGananciaBruta", `$${fmtMoney(gananciaBrutaHoy)}`); // Ganancia Bruta
    set("resGastosTrabajo", `$${fmtMoney(gastosHoy)}`); // Gastos Trabajo (hoy)
    set("resGananciaNeta", `$${fmtMoney(gananciaNetaHoy)}`); // Ganancia Neta
    set("resKmRecorridos", `${state.parametros.ultimoKM} km`); // KM Recorridos (Usando el odómetro final)
    set("resGananciaPorHora", `$${fmtMoney(gananciaPorHora)}/h`); // Ganancia por Hora
    
    // 3. RENDERING TABLA ÚLTIMOS TURNOS (ID asumido: tablaUltimosTurnosBody)
    const tbodyTurnos = $("tablaUltimosTurnosBody"); 
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
                    <td>${safeNumber(t.horas).toFixed(2)}h</td>
                    <td>${safeNumber(t.kmFinal)}</td> 
                    <td>$${fmtMoney(t.ganancia)}</td>
                `;
                tbodyTurnos.appendChild(tr);
            });
        }
    }

    // 4. RENDERING CONTROL GASOLINA / KM (ID asumido: tablaKmMensual)
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

    // Turno
    safeClick("btnIniciarTurno", () => { if(Data.iniciarTurnoLogic()) renderTurnoUI(); });
    safeClick("btnCancelarCierre", () => { renderTurnoUI(); }); 
    
    safeClick("btnConfirmarFinalizar", () => {
        const m = $("gananciaBruta").value;
        const km = $("kmFinalTurno").value; 
        if(!m) return alert("Ingresa la ganancia del turno");
        
        Data.finalizarTurnoLogic(m, km); 
        renderTurnoUI(); 
        renderOdometroUI();
        $("gananciaBruta").value=""; $("kmFinalTurno").value=""; 
        alert("Turno Finalizado");
    });

    // Odómetro (Simulación de actualización manual)
    safeClick("btnActualizarOdometro", () => {
        const inputKm = $("inputOdometro");
        if(inputKm && Data.actualizarOdometroManual(inputKm.value)) {
             renderOdometroUI();
             inputKm.value = "";
             alert("KM Actualizado");
        }
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

        const checkRec = $("checkEsRecurrente");
        const esFijo = checkRec ? checkRec.checked : false;

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
        renderOdometroUI();
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

    // Exportar (Excel)
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

    // Copiar JSON
    safeClick("btnCopiarJSON", async () => {
        try {
            const json = localStorage.getItem(STORAGE_KEY);
            await navigator.clipboard.writeText(json);
            alert("JSON copiado al portapapeles. ¡Guárdalo!");
        } catch (err) {
            alert("Error al copiar JSON: La API de Clipboard puede no estar disponible. Usa el campo de texto.");
        }
    });
    
    // Restaurar
    safeClick("btnImportar", () => { 
        const jsonArea = $("importJson");
        if(!jsonArea.value) return;
        localStorage.setItem(STORAGE_KEY, jsonArea.value); 
        location.reload(); 
    });
};
                 
