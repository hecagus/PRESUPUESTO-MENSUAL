// 03_render.js
import { $, fmtMoney, CATEGORIAS_GASTOS, formatearFecha, safeNumber } from './01_consts_utils.js';
import { getState, getTurnoActivo, iniciarTurnoLogic, finalizarTurnoLogic, recalcularMetaDiaria, registrarCargaGasolina, actualizarOdometroManual, agregarDeuda, agregarGasto, agregarGastoFijo, exportarJsonLogic, importarJsonLogic, calcularGastoOperativoAcumulado, guardarParametrosMantenimiento } from './02_data.js';

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

// --- RENDERIZADO GENERAL (Turno) ---
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

// --- ADMIN: INTERFAZ DE ODÓMETRO Y COSTO POR KM (CORREGIDA) ---
export const renderOdometroUI = () => {
    const lblKm = $("lblKmAnterior"), inputKm = $("inputOdometro"), costoKmDisplay = $("costoPorKmDisplay"), gastoDisp = $("gastoAcumuladoDisplay"), kmInicialDisp = $("kmInicialAcumulado"), kmActualDisp = $("kmActualOperativo"), kmRecorridoDisp = $("kmRecorridoDisplay"); 
    if (!lblKm) return;
    const state = getState();
    lblKm.innerText = `${state.parametros.ultimoKM} km`;
    inputKm.placeholder = state.parametros.ultimoKM > 0 ? `Mayor a ${state.parametros.ultimoKM}` : "Ingresa KM Inicial";

    if (costoKmDisplay) {
        const costo = state.parametros.costoPorKm;
        costoKmDisplay.innerText = costo > 0.001 ? `$${fmtMoney(costo)}/km` : "Calculando..."; 
    }
    
    const acumulado = calcularGastoOperativoAcumulado();
    if (gastoDisp) {
        gastoDisp.innerText = `$${fmtMoney(acumulado.gastoAcumulado)}`;
        kmInicialDisp.innerText = `${acumulado.kmInicial} km`;
        kmActualDisp.innerText = `${acumulado.kmActual} km`;
        kmRecorridoDisp.innerText = `${acumulado.kmRecorrido} km`;
    }
};

// --- RENDERIZADO GENERAL (Meta, Dashboard, Historial) ---
export const renderMetaDiaria = () => { const el = $("metaDiariaDisplay"); if (el) el.innerText = `$${fmtMoney(recalcularMetaDiaria())}`; };
export const renderDashboard = () => { /* ... */ };
export const renderHistorial = () => { /* ... */ };
const renderMantenimientoUI = () => { /* ... */ };
export { renderMantenimientoUI };

// --- LÓGICA DE EXCEL (Placeholder) ---
const exportarExcel = () => { alert("Función de exportación a Excel pendiente: Requiere desarrollo con librería XLSX.js."); };

/* ==========================================================================
   SECCIÓN 2: LISTENERS
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

    // 2. ODÓMETRO (CORRECCIÓN CRÍTICA)
    const btnOdo = $("btnActualizarOdometro");
    const inputOdo = $("inputOdometro");
    if(btnOdo && inputOdo) {
        btnOdo.onclick = () => {
            const val = inputOdo.value;
            if(val === "" || safeNumber(val) <= 0) {
                 return alert("Por favor, ingresa un valor de KM válido y mayor a cero.");
            }
            if(actualizarOdometroManual(val)) {
                renderOdometroUI();
                inputOdo.value = "";
                alert("Kilometraje actualizado.");
            }
        };
    } else {
        console.warn("Elemento btnActualizarOdometro o inputOdometro no encontrado. Revisar admin.html.");
    }
    
    // 3. Gastos Inteligentes (Lógica omitida por brevedad en este bloque)
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

    // 4. MANTENIMIENTO
    const btnMaint = $("btnGuardarMantenimiento");
    if (btnMaint) {
        btnMaint.onclick = () => {
            const aceite = $("mantenimientoAceite").value;
            const bujia = $("mantenimientoBujia").value;
            const llantas = $("mantenimientoLlantas").value;
            
            guardarParametrosMantenimiento(aceite, bujia, llantas);
            renderMantenimientoUI();
            alert("Configuración de Mantenimiento guardada.");
        };
    }

    // 5. RESPALDO Y DATOS
    const btnExport = $("btnExportarJson");
    const btnImport = $("btnRestaurarDatos");
    const textareaImport = $("importJson");
    const btnExcel = $("btnBajarExcel");

    if (btnExport) {
        btnExport.onclick = async () => {
            const json = exportarJsonLogic();
            try { await navigator.clipboard.writeText(json); alert("Copia JSON completa en el portapapeles. ¡Guardada!"); } catch (err) { console.error('Error al usar el portapapeles:', err); alert("Error al copiar. Intenta manualmente."); }
        };
    }
    
    if (btnImport && textareaImport) {
        btnImport.onclick = () => {
            const jsonString = textareaImport.value;
            if (!jsonString) { alert("Pega los datos JSON en la caja de texto antes de restaurar."); return; }
            if (confirm("ADVERTENCIA: ¿Estás seguro de que quieres reemplazar tus datos actuales?")) {
                if (importarJsonLogic(jsonString)) { window.location.reload(); } else { alert("ERROR: El formato JSON es inválido o corrupto."); }
            }
        };
    }
    
    if (btnExcel) { btnExcel.onclick = exportarExcel; }

    // 6. Wizards Deuda y Gasolina
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
    
    if($("btnRegistrarIngreso")) $("btnRegistrarIngreso").onclick = () => alert("Ingreso registrado (Simulado).");

    // Llama a renderizar el mantenimiento al final de la inicialización del Admin
    renderMantenimientoUI();
};
