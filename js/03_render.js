// 03_render.js
import { $, fmtMoney, CATEGORIAS_GASTOS, formatearFecha, safeNumber } from './01_consts_utils.js';
// Importamos TODO lo de data
import * as Data from './02_data.js'; 

// Helper para evitar crashes
const safeClick = (id, fn) => { const el = $(id); if (el) el.onclick = fn; };

/* --- RENDERIZADO VISUAL --- */

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
    
    const costoDisplay = $("costoPorKmDisplay");
    if (costoDisplay) {
        costoDisplay.innerText = state.parametros.costoPorKm > 0 ? `$${fmtMoney(state.parametros.costoPorKm)}/km` : "Calculando...";
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

export const renderDashboard = () => {
    const state = Data.getState();
    const set = (id, v) => { const el = $(id); if(el) el.innerText = v; };
    // Cálculos simples para dashboard
    const hoy = new Date().toLocaleDateString();
    const turnosHoy = state.turnos.filter(t => new Date(t.fecha).toLocaleDateString() === hoy);
    const ganancia = turnosHoy.reduce((a,b)=>a+b.ganancia,0);
    const horas = turnosHoy.reduce((a,b)=>a+b.horas,0);

    set("resHoras", `${horas.toFixed(2)}h`);
    set("resGananciaBruta", `$${fmtMoney(ganancia)}`);
    set("resKmRecorridos", `${state.parametros.ultimoKM}`);
    set("proyGastoFijoDiario", `$${fmtMoney(state.parametros.gastoFijo)}`);
};

/* --- LISTENERS (BOTONES) --- */
const llenarCats = (tipo) => {
    const sel = $("gastoCategoriaSelect");
    if(!sel) return;
    sel.innerHTML="";
    (CATEGORIAS_GASTOS[tipo]||[]).forEach(c => {
        const o = document.createElement("option"); o.value=c; o.text=c; sel.appendChild(o);
    });
};

export const setupAdminListeners = () => {
    if (document.body.getAttribute("data-page") !== "admin") return; // Bloqueo de seguridad
    console.log("Listeners Admin Activos");

    // Turno
    safeClick("btnIniciarTurno", () => { if(Data.iniciarTurnoLogic()) renderTurnoUI(); });
    safeClick("btnPreFinalizarTurno", () => { $("btnPreFinalizarTurno").style.display="none"; $("cierreTurnoContainer").style.display="block"; });
    safeClick("btnCancelarCierre", () => { $("cierreTurnoContainer").style.display="none"; $("btnPreFinalizarTurno").style.display="inline-block"; });
    safeClick("btnConfirmarFinalizar", () => {
        const m = $("gananciaBruta").value;
        if(!m) return alert("Monto?");
        Data.finalizarTurnoLogic(m); renderTurnoUI(); $("gananciaBruta").value=""; alert("Hecho");
    });

    // Odómetro
    safeClick("btnActualizarOdometro", () => {
        if(Data.actualizarOdometroManual($("inputOdometro").value)) { renderOdometroUI(); $("inputOdometro").value=""; alert("Ok"); }
    });

    // Gastos
    if($("gastoTipoRadio")) {
        llenarCats("moto");
        document.getElementsByName("gastoTipoRadio").forEach(r => r.addEventListener("change", (e)=>llenarCats(e.target.value)));
    }
    const chkRec = $("checkEsRecurrente");
    if(chkRec) chkRec.onchange = () => $("divFrecuenciaGasto").style.display = chkRec.checked ? "block" : "none";
    
    safeClick("btnRegistrarGasto", () => {
        const sel=$("gastoCategoriaSelect"), man=$("gastoCategoriaManual"), m=$("gastoCantidad").value;
        let cat = sel.value.includes("Otro") && man.value ? man.value : sel.value;
        if(!m) return alert("Falta monto");
        
        const g = { id:Date.now(), fecha:new Date().toISOString(), categoria:cat, monto:Number(m), desc:$("gastoDescripcion").value, tipo:"moto" }; // simplificado tipo
        
        if(chkRec.checked) { 
            g.frecuencia = $("gastoFrecuenciaSelect").value; 
            Data.agregarGastoFijo(g); 
        } else { 
            g.frecuencia = "No Recurrente"; 
            Data.agregarGasto(g); 
        }
        alert("Gasto Guardado"); window.location.reload();
    });

    // Wizards y Otros
    safeClick("btnRegistrarCargaFinal", () => {
        Data.registrarCargaGasolina($("gasLitros").value, $("gasCosto").value, $("gasKmActual").value);
        alert("Gasolina Guardada"); window.location.reload();
    });
    
    safeClick("btnRegistrarDeudaFinal", () => {
        Data.agregarDeuda({
            id:Date.now(), desc:$("deudaNombre").value, 
            montoTotal:$("deudaMontoTotal").value, montoCuota:$("deudaMontoCuota").value, 
            frecuencia:$("deudaFrecuencia").value, saldo:Number($("deudaMontoTotal").value)
        });
        alert("Deuda Guardada"); window.location.reload();
    });

    safeClick("btnExportar", () => { navigator.clipboard.writeText(JSON.stringify(Data.getState())).then(()=>alert("Copiado")); });
    safeClick("btnImportar", () => { localStorage.setItem(STORAGE_KEY, $("importJson").value); location.reload(); });
};
