import { $, fmtMoney, CATEGORIAS_GASTOS, formatearFecha, safeNumber, STORAGE_KEY, isSameDay } from './01_consts_utils.js';
import * as Data from './02_data.js';

const safeClick = (id, fn) => { const el = $(id); if (el) el.onclick = fn; };
const TODAY = new Date(); 

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
    const cfgBase = state.parametros?.mantenimientoBase || {};
    const cfgServicio = state.parametros?.ultimoServicio || {};
    const alertaDiv = $("mantenimientoAlerta");

    const setBase = (id, k) => { const el = $(id); if(el) el.value = cfgBase[k]||0; };  
    setBase("mantenimientoAceite", "Aceite");  
    setBase("mantenimientoBujia", "Bujía");  
    setBase("mantenimientoLlantas", "Llantas");  

    const setServicio = (id, k) => { const el = $(id); if(el) el.value = cfgServicio[k]||''; };  
    setServicio("ultimoAceiteKM", "Aceite");  
    setServicio("ultimoBujiaKM", "Bujía");  
    setServicio("ultimoLlantasKM", "Llantas");  
      
    if (alertaDiv) {  
        const resultado = Data.checkMantenimiento();  
        if (!resultado.alertaActiva) {  
            alertaDiv.style.cssText = "background: #ecfdf5; border: 1px solid #34d399;"; 
            alertaDiv.innerHTML = "Estado: 🟢 OK. ¡Servicios al día!";  
        } else {  
            let mensaje = "⚠️ SERVICIO PENDIENTE: ";  
            let pendientes = [];  
            for (const item in resultado.alerta) {  
                if (resultado.alerta[item]) {  
                    const kmRestantes = safeNumber(resultado.kmRestantes[item]);  
                    const simbolo = kmRestantes <= 0 ? '🔴' : '🟠';  
                    pendientes.push(`${simbolo} ${item} (${kmRestantes <= 0 ? 'Excedido' : kmRestantes + ' KM restantes'})`);  
                }  
            }  
            alertaDiv.style.cssText = "background: #fee2e2; border: 1px solid #f87171;"; 
            alertaDiv.innerHTML = mensaje + pendientes.join('; ');  
        }  
    }
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
RENDERIZADO DASHBOARD (INDEX.HTML)
========================================================================== */

export const renderDashboard = () => {
    const state = Data.getState();
    if (!state) return;

    const set = (id, v) => { const el = $(id); if(el) el.innerText = v; };  

    // 1. CÁLCULOS DEL DÍA (USANDO isSameDay)  
    const turnosHoy = state.turnos.filter(t => isSameDay(t.fecha, TODAY));  
    const gananciaBrutaHoy = turnosHoy.reduce((a, b) => a + safeNumber(b.ganancia), 0);  
    const horasHoy = turnosHoy.reduce((a, b) => a + safeNumber(b.horas), 0);  
    const gastosHoy = state.movimientos.filter(m => m.tipo === 'gasto' && isSameDay(m.fecha, TODAY)).reduce((a,b)=>a+safeNumber(b.monto), 0);  
      
    const gananciaNetaHoy = gananciaBrutaHoy - gastosHoy;  
    const gananciaPorHora = (horasHoy > 0) ? (gananciaNetaHoy / horasHoy) : 0;  

    // 2. RENDERING DE KPIS (Sync con index.html)
    set("resHoras", `${horasHoy.toFixed(2)}h`);  
    set("resGananciaBruta", `$${fmtMoney(gananciaBrutaHoy)}`);  
    set("resGastosTrabajo", `$${fmtMoney(gastosHoy)}`);  
    set("resGananciaNeta", `$${fmtMoney(gananciaNetaHoy)}`);  
    set("resKmRecorridos", `${state.parametros.ultimoKM} km`);  
    set("resGananciaPorHora", `$${fmtMoney(gananciaPorHora)}/h`);  

    // 3. PROYECCIONES
    set("proyKmTotal", `${state.parametros.ultimoKM} KM`);
    set("proyDeuda", `$${fmtMoney(Data.getDeudaTotalPendiente())}`);
    set("proyGastoFijoDiario", `$${fmtMoney(state.parametros.gastoFijo)}`);
    set("proyNetaPromedio", `$${fmtMoney(Data.getGananciaNetaPromedio7Dias())}`);
    set("proyDias", Data.calcularTiempoLibreDeudas ? Data.calcularTiempoLibreDeudas() : Data.calcularDiasParaLiquidarDeuda());
      
    // 4. TABLA TURNOS (Sync ID: tablaTurnos)
    const tbodyTurnos = $("tablaTurnos");   
    if (tbodyTurnos) {  
        tbodyTurnos.innerHTML = "";  
        const ultimos = state.turnos.slice().reverse().slice(0, 5);   
        if (ultimos.length === 0) {  
            tbodyTurnos.innerHTML = "<tr><td colspan='4' style='text-align:center'>Sin registros aún</td></tr>";  
        } else {  
            ultimos.forEach(t => {  
                tbodyTurnos.innerHTML += `  
                    <tr>
                        <td>${formatearFecha(t.fecha)}</td>  
                        <td>${safeNumber(t.horas).toFixed(2)}h</td>  
                        <td>${safeNumber(t.kmFinal)}</td>   
                        <td>$${fmtMoney(t.ganancia)}</td>  
                    </tr>`;  
            });  
        }  
    }  

    // 5. CONTROL GASOLINA
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

    safeClick("btnActualizarOdometro", () => {  
        const inputKm = $("inputOdometro");  
        if(inputKm && Data.actualizarOdometroManual(inputKm.value)) {  
             renderOdometroUI();  
             inputKm.value = "";  
             alert("KM Actualizado");  
        }  
    });  

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

    safeClick("btnRegistrarGasto", () => {  
        const sel=$("gastoCategoriaSelect"), man=$("gastoCategoriaManual"), m=$("gastoCantidad").value;  
        let cat = (sel.value.includes("➕") && man && man.value.trim()) ? man.value.trim() : sel.value;  
        if(!m) return alert("Falta monto");  
        const esFijo = $("checkEsRecurrente")?.checked || false;  
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
        renderListasAdmin(); renderMetaDiaria();  
        if(esFijo) window.location.reload();  
    });  

    safeClick("btnRegistrarIngreso", () => {  
        const d = $("ingresoDescripcion").value; const m=$("ingresoCantidad").value;  
        if(m) {  
            Data.getState().movimientos.push({tipo:'ingreso', fecha:new Date().toISOString(), desc:d||"Ingreso Extra", monto:safeNumber(m)});  
            Data.saveData(); alert("Ingreso registrado"); $("ingresoCantidad").value="";  
        }  
    });  

    safeClick("btnGasSiguiente1", () => { $("gasWizardPaso1").style.display='none'; $("gasWizardPaso2").style.display='block'; });  
    safeClick("btnGasSiguiente2", () => { $("gasWizardPaso2").style.display='none'; $("gasWizardPaso3").style.display='block'; });  
    safeClick("btnGasAtras2", () => { $("gasWizardPaso2").style.display='none'; $("gasWizardPaso1").style.display='block'; });  
    safeClick("btnGasAtras3", () => { $("gasWizardPaso3").style.display='none'; $("gasWizardPaso2").style.display='block'; });  

    safeClick("btnRegistrarCargaFinal", () => {  
        Data.registrarCargaGasolina($("gasLitros").value, $("gasCosto").value, $("gasKmActual").value);  
        renderOdometroUI(); alert("Gasolina Guardada"); window.location.reload();  
    });  

    safeClick("btnGuardarMantenimiento", () => {  
        Data.guardarConfigMantenimiento($("mantenimientoAceite").value, $("mantenimientoBujia").value, $("mantenimientoLlantas").value);  
        renderMantenimientoUI(); alert("Umbrales Guardados");  
    });  
      
    safeClick("btnRegistrarServicio", () => {  
        Data.registrarServicio($("ultimoAceiteKM").value, $("ultimoBujiaKM").value, $("ultimoLlantasKM").value);  
        renderMantenimientoUI(); alert("Servicios registrados");  
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

    safeClick("btnRegistrarAbono", () => {  
        const idDeuda = $("abonoSeleccionar").value; const m = $("abonoMonto").value;  
        if(m && idDeuda) {  
            const deuda = Data.getState().deudas.find(d => d.id == idDeuda);  
            if(deuda) {  
                deuda.saldo -= safeNumber(m);  
                Data.getState().movimientos.push({tipo:'gasto', fecha:new Date().toISOString(), desc:`Abono: ${deuda.desc}`, monto:safeNumber(m)});  
                Data.recalcularMetaDiaria(); alert("Abono registrado"); window.location.reload();  
            }  
        }  
    });  

    safeClick("btnExportar", () => {   
        if (typeof XLSX === 'undefined') return alert("Librería Excel no cargada.");  
        const state = Data.getState();  
        const wb = XLSX.utils.book_new();  
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(state.turnos), "Turnos");  
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(state.movimientos), "Movimientos");  
        XLSX.writeFile(wb, "Respaldo_Tracker.xlsx");  
    });  

    safeClick("btnCopiarJSON", async () => {  
        try { await navigator.clipboard.writeText(localStorage.getItem(STORAGE_KEY)); alert("JSON copiado"); } catch (err) { alert("Error al copiar"); }  
    });  
  
    safeClick("btnImportar", () => {   
        const json = $("importJson").value; if(!json) return;  
        localStorage.setItem(STORAGE_KEY, json); location.reload();   
    });
};
    
