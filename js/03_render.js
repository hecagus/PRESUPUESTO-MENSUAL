// 03_render.js
import { $, fmtMoney, CATEGORIAS_GASTOS, formatearFecha, safeNumber } from './01_consts_utils.js';
import { getState, getTurnoActivo, iniciarTurnoLogic, finalizarTurnoLogic, recalcularMetaDiaria, registrarCargaGasolina, actualizarOdometroManual, agregarDeuda, agregarGasto, agregarGastoFijo } from './02_data.js';

/* ==========================================================================
   PARTE 1: FUNCIONES DE RENDERIZADO (VISUALIZACIÓN)
   ========================================================================== */

// --- 1.1 UI HELPERS ---
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

// --- 1.2 ADMIN: TURNO Y ODÓMETRO ---
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

// --- 1.3 DASHBOARD (INDEX) ---
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

// --- 1.4 HISTORIAL ---
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
        
        if (isIngreso) { ingresosTotal += monto; tr.style.backgroundColor = '#ecfdf5'; } 
        else { gastosTotal += monto; tr.style.backgroundColor = '#fff5f5'; }

        tr.innerHTML = `<td>${isIngreso ? '➕' : '➖'}</td><td>${formatearFecha(mov.fecha)}</td><td>${mov.desc}</td><td style="font-weight:bold; color: ${isIngreso ? '#059669' : '#dc2626'}">$${fmtMoney(monto)}</td>`;
        tbody.appendChild(tr);
    });
    
    const neto = ingresosTotal - gastosTotal;
    resumenDiv.innerHTML = `<p>Ingresos: <strong style="color:#059669;">$${fmtMoney(ingresosTotal)}</strong></p><p>Gastos: <strong style="color:#dc2626;">$${fmtMoney(gastosTotal)}</strong></p><hr><p>Neto: <strong>$${fmtMoney(neto)}</strong></p>`;
};

/* ==========================================================================
   PARTE 2: LISTENERS (CONTROLADORES DE EVENTOS)
   ========================================================================== */
// Aquí usamos "Safety Checks" (if element) en CADA bloque para que un error no detenga a los demás.

export const setupAdminListeners = () => {
    console.log("Configurando Listeners de Admin...");

    // BLOQUE 1: TURNO
    const btnIn = $("btnIniciarTurno");
    if (btnIn) {
        btnIn.onclick = () => { if(iniciarTurnoLogic()) renderTurnoUI(); };
        const btnPre = $("btnPreFinalizarTurno");
        if(btnPre) btnPre.onclick = () => { btnPre.style.display = "none"; $("cierreTurnoContainer").style.display = "block"; };
        const btnCancel = $("btnCancelarCierre");
        if(btnCancel) btnCancel.onclick = () => { $("cierreTurnoContainer").style.display = "none"; btnPre.style.display = "inline-block"; $("gananciaBruta").value = ""; };
        const btnConfirm = $("btnConfirmarFinalizar");
        if(btnConfirm) btnConfirm.onclick = () => {
            const monto = $("gananciaBruta").value;
            if(monto === "") return alert("Ingresa el monto.");
            finalizarTurnoLogic(monto); $("gananciaBruta").value = ""; renderTurnoUI(); alert("Turno cerrado.");
        };
    }

    // BLOQUE 2: ODÓMETRO
    const btnOdo = $("btnActualizarOdometro");
    if(btnOdo) {
        btnOdo.onclick = () => {
            if(actualizarOdometroManual($("inputOdometro").value)) { renderOdometroUI(); $("inputOdometro").value = ""; alert("KM actualizado."); }
        };
    }

    // BLOQUE 3: GASTOS INTELIGENTES
    const btnGasto = $("btnRegistrarGasto");
    if (btnGasto) {
        llenarCategorias("moto"); 
        document.getElementsByName("gastoTipoRadio").forEach(r => r.addEventListener("change", (e) => llenarCategorias(e.target.value)));
        
        const checkRecurrente = $("checkEsRecurrente");
        if(checkRecurrente) checkRecurrente.onchange = () => { $("divFrecuenciaGasto").style.display = checkRecurrente.checked ? "block" : "none"; };

        btnGasto.onclick = () => {
            const select = $("gastoCategoriaSelect"), inputMan = $("gastoCategoriaManual"), monto = $("gastoCantidad").value;
            let cat = select.value;
            if(cat.includes("Otro") && inputMan.value.trim()) cat = inputMan.value.trim();
            if(!monto) return alert("Falta monto");

            const gasto = { id: Date.now(), fecha: new Date().toISOString(), categoria: cat, monto: Number(monto), desc: $("gastoDescripcion").value, tipo: document.querySelector('input[name="gastoTipoRadio"]:checked').value };
            
            if(checkRecurrente.checked) {
                gasto.frecuencia = $("gastoFrecuenciaSelect").value;
                agregarGastoFijo(gasto);
                alert("Gasto Fijo agregado.");
            } else {
                gasto.frecuencia = "No Recurrente";
                agregarGasto(gasto);
                alert("Gasto guardado.");
            }
            $("gastoCantidad").value=""; $("gastoDescripcion").value=""; $("gastoCategoriaManual").value=""; inputMan.style.display="none"; checkRecurrente.checked=false; $("divFrecuenciaGasto").style.display="none"; select.selectedIndex=0;
            if(checkRecurrente.checked) window.location.reload();
        };
    }

    // BLOQUE 4: WIZARD GASOLINA (BLINDADO)
    const btnGasNext1 = $("btnGasSiguiente1");
    if (btnGasNext1) {
        // Solo asignamos si el botón existe.
        const p1=$("gasWizardPaso1"), p2=$("gasWizardPaso2"), p3=$("gasWizardPaso3");
        
        $("btnGasSiguiente1").onclick=()=>{ p1.style.display='none'; p2.style.display='block'; };
        $("btnGasSiguiente2").onclick=()=>{ p2.style.display='none'; p3.style.display='block'; };
        $("btnGasAtras2").onclick=()=>{ p2.style.display='none'; p1.style.display='block'; };
        $("btnGasAtras3").onclick=()=>{ p3.style.display='none'; p2.style.display='block'; };
        
        $("btnRegistrarCargaFinal").onclick=()=>{ 
            registrarCargaGasolina($("gasLitros").value, $("gasCosto").value, $("gasKmActual").value); 
            alert("Carga guardada"); 
            window.location.reload(); 
        };
    }

    // BLOQUE 5: WIZARD DEUDA (BLINDADO)
    const btnDeudaNext1 = $("btnDeudaNext1");
    if (btnDeudaNext1) {
        const d1=$("deudaWizardStep1"), d2=$("deudaWizardStep2"), d3=$("deudaWizardStep3");
        
        $("btnDeudaNext1").onclick=()=>{ if(!$("deudaNombre").value)return alert("Nombre?"); d1.style.display='none'; d2.style.display='block'; };
        $("btnDeudaNext2").onclick=()=>{ d2.style.display='none'; d3.style.display='block'; };
        $("btnDeudaBack2").onclick=()=>{ d2.style.display='none'; d1.style.display='block'; };
        $("btnDeudaBack3").onclick=()=>{ d3.style.display='none'; d2.style.display='block'; };
        
        $("btnRegistrarDeudaFinal").onclick=()=>{ 
            agregarDeuda({id:Date.now(), desc:$("deudaNombre").value, montoTotal:$("deudaMontoTotal").value, montoCuota:$("deudaMontoCuota").value, frecuencia:$("deudaFrecuencia").value, saldo:parseFloat($("deudaMontoTotal").value)}); 
            alert("Deuda guardada"); 
            window.location.reload(); 
        };
    }
    
    // BLOQUE 6: INGRESO EXTRA
    const btnIngreso = $("btnRegistrarIngreso");
    if(btnIngreso) btnIngreso.onclick = () => alert("Ingreso registrado (Simulado).");
};
