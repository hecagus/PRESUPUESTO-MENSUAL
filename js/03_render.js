import { $, fmtMoney, CATEGORIAS_GASTOS, formatearFecha, safeNumber } from './01_consts_utils.js';
import * as Data from './02_data.js'; 

// --- HERRAMIENTA ANTI-CRASH (Safe Click) ---
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
    const set = (id, v) => { const el = $(id); if(el) el.innerText = v; };
    
    const hoy = new Date().toLocaleDateString();
    const turnosHoy = state.turnos.filter(t => new Date(t.fecha).toLocaleDateString() === hoy);
    const ganancia = turnosHoy.reduce((a,b)=>a+b.ganancia,0);
    const horas = turnosHoy.reduce((a,b)=>a+b.horas,0);

    set("resHoras", `${horas.toFixed(2)}h`);
    set("resGananciaBruta", `$${fmtMoney(ganancia)}`);
    set("resKmRecorridos", `${state.parametros.ultimoKM}`);
    set("proyGastoFijoDiario", `$${fmtMoney(state.parametros.gastoFijo)}`);
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

/* --- LISTENERS ADMIN (CONFIGURACIÓN DE BOTONES) --- */
export const setupAdminListeners = () => {
    if (document.body.getAttribute("data-page") !== "admin") return; 

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

    // --- CORRECCIÓN AQUÍ: GASTOS Y CATEGORÍAS ---
    const llenarCats = (tipo) => {
        const sel = $("gastoCategoriaSelect");
        const manualInput = $("gastoCategoriaManual");
        
        if(!sel) return;
        
        // Limpiar
        sel.innerHTML="";
        
        // Ocultar manual por defecto al cambiar tipo
        if(manualInput) manualInput.style.display = "none";

        // Llenar opciones
        (CATEGORIAS_GASTOS[tipo]||[]).forEach(c => {
            const o = document.createElement("option"); 
            o.value = c; 
            o.text = c; 
            sel.appendChild(o);
        });

        // Evento al cambiar selección dentro del Select
        sel.onchange = () => {
            if (sel.value.includes("➕")) { // Si selecciona "Otro / Nuevo"
                if(manualInput) {
                    manualInput.style.display = "block";
                    manualInput.value = ""; // Limpiar para que escriba
                    manualInput.focus();
                }
            } else {
                if(manualInput) manualInput.style.display = "none";
            }
        };
    };

    // Inicializar Categorías (Por defecto Moto)
    if($("gastoCategoriaSelect")) {
        llenarCats("moto");
        
        // Escuchar cambios en los Radio Buttons
        const radios = document.getElementsByName("gastoTipoRadio");
        radios.forEach(r => {
            r.addEventListener("change", (e) => llenarCats(e.target.value));
        });
    }
    
    const chkRec = $("checkEsRecurrente");
    if(chkRec) chkRec.onchange = () => $("divFrecuenciaGasto").style.display = chkRec.checked ? "block" : "none";
    
    // GUARDAR GASTO
    safeClick("btnRegistrarGasto", () => {
        const sel = $("gastoCategoriaSelect");
        const manualInput = $("gastoCategoriaManual");
        const m = $("gastoCantidad").value;
        const desc = $("gastoDescripcion").value;
        
        // Determinar categoría final
        let catFinal = sel.value;
        if(catFinal.includes("➕") && manualInput && manualInput.value.trim() !== "") {
            catFinal = manualInput.value.trim(); // Usar lo que escribió el usuario
        }

        if(!m) return alert("Falta monto");
        
        // Obtener tipo (Moto o Hogar)
        const tipoRadio = document.querySelector('input[name="gastoTipoRadio"]:checked');
        const tipoVal = tipoRadio ? tipoRadio.value : "moto";

        const g = { 
            id: Date.now(), 
            fecha: new Date().toISOString(), 
            categoria: catFinal, 
            monto: Number(m), 
            desc: desc, 
            tipo: tipoVal 
        }; 
        
        if(chkRec && chkRec.checked) { 
            g.frecuencia = $("gastoFrecuenciaSelect").value; 
            Data.agregarGastoFijo(g); 
        } else { 
            g.frecuencia = "No Recurrente"; 
            Data.agregarGasto(g); 
        }
        
        alert("Gasto Guardado"); 
        
        // Reset UI
        $("gastoCantidad").value=""; 
        $("gastoDescripcion").value=""; 
        if(manualInput) { manualInput.value=""; manualInput.style.display="none"; }
        if(sel) sel.selectedIndex = 0;
        
        if(chkRec && chkRec.checked) { 
            chkRec.checked=false; 
            $("divFrecuenciaGasto").style.display="none"; 
            window.location.reload(); 
        }
    });

    // Wizards y Otros
    safeClick("btnGasSiguiente1", () => { $("gasWizardPaso1").style.display='none'; $("gasWizardPaso2").style.display='block'; });
    safeClick("btnGasSiguiente2", () => { $("gasWizardPaso2").style.display='none'; $("gasWizardPaso3").style.display='block'; });
    safeClick("btnGasAtras2", () => { $("gasWizardPaso2").style.display='none'; $("gasWizardPaso1").style.display='block'; });
    safeClick("btnGasAtras3", () => { $("gasWizardPaso3").style.display='none'; $("gasWizardPaso2").style.display='block'; });

    safeClick("btnRegistrarCargaFinal", () => {
        Data.registrarCargaGasolina($("gasLitros").value, $("gasCosto").value, $("gasKmActual").value);
        alert("Gasolina Guardada"); window.location.reload();
    });
    
    // Deudas Wizard
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

    // Mantenimiento y Datos
    safeClick("btnGuardarMantenimiento", () => {
        Data.guardarConfigMantenimiento($("mantenimientoAceite").value, $("mantenimientoBujia").value, $("mantenimientoLlantas").value);
        alert("Config Guardada");
    });

    safeClick("btnExportar", () => { navigator.clipboard.writeText(JSON.stringify(Data.getState())).then(()=>alert("Copiado")); });
    safeClick("btnImportar", () => { localStorage.setItem("panelData_v3", $("importJson").value); location.reload(); });
};
