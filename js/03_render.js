// 03_render.js
import { $, fmtMoney, CATEGORIAS_GASTOS, formatearFecha, safeNumber } from './01_consts_utils.js';
import { getState, getTurnoActivo, iniciarTurnoLogic, finalizarTurnoLogic, recalcularMetaDiaria, registrarCargaGasolina, actualizarOdometroManual, agregarDeuda, agregarGasto, agregarGastoFijo, exportarJsonLogic, importarJsonLogic, calcularGastoOperativoAcumulado, guardarParametrosMantenimiento } from './02_data.js';

/* ==========================================================================
   SECCIÓN 1: RENDERIZADO DE ELEMENTOS (UI)
   ========================================================================== */

// Helper para obtener la clave de fecha (YYYY-MM-DD) para filtrar sin problemas de hora/zona
const getTodayDateKey = () => new Date().toISOString().substring(0, 10);

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

// --- RENDERIZADO GENERAL (Turno, Odómetro, Meta Diaria, Historial) ---
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

export const renderMetaDiaria = () => {
    const el = $("metaDiariaDisplay");
    if (el) el.innerText = `$${fmtMoney(recalcularMetaDiaria())}`;
};

// --- DASHBOARD (INDEX): CORRECCIÓN CRÍTICA DE CÁLCULOS ---
export const renderDashboard = () => {
    const state = getState();
    const set = (id, v) => { const el = $(id); if(el) el.innerText = v; };

    const todayKey = getTodayDateKey();
    
    // 1. FILTRAR DATOS DE HOY usando ISO (YYYY-MM-DD)
    const turnosHoy = state.turnos.filter(t => new Date(t.fecha).toISOString().substring(0, 10) === todayKey);
    const gastosHoy = state.gastos.filter(g => new Date(g.fecha).toISOString().substring(0, 10) === todayKey);
    
    // 2. CÁLCULOS
    const gananciaBrutaHoy = turnosHoy.reduce((acc, t) => acc + safeNumber(t.ganancia), 0);
    const horasHoy = turnosHoy.reduce((acc, t) => acc + safeNumber(t.horas), 0);
    
    // Gastos de Trabajo (operativo/moto) hoy
    const gastosTrabajoHoy = gastosHoy
        .filter(g => g.tipo === 'moto')
        .reduce((acc, g) => acc + safeNumber(g.monto), 0);

    const gananciaNetaHoy = gananciaBrutaHoy - gastosTrabajoHoy;

    // 3. RENDERIZAR KPIs
    set("resHoras", `${horasHoy.toFixed(2)}h`);
    set("resGananciaBruta", `$${fmtMoney(gananciaBrutaHoy)}`);
    set("resGastosTrabajo", `$${fmtMoney(gastosTrabajoHoy)}`); 
    set("resGananciaNeta", `$${fmtMoney(gananciaNetaHoy)}`);
    set("resKmRecorridos", `${state.parametros.ultimoKM} km`);
    set("resGananciaPorHora", horasHoy > 0 ? `$${fmtMoney(gananciaBrutaHoy / horasHoy)}/h` : `$0.00/h`);
    
    // Proyecciones
    const deudaTotal = state.deudas.reduce((acc, d) => acc + safeNumber(d.saldo), 0);
    set("proyKmTotal", `${state.parametros.ultimoKM} KM`);
    set("proyDeuda", `$${fmtMoney(deudaTotal)}`); 
    set("proyGastoFijoDiario", `$${fmtMoney(state.parametros.gastoFijo)}`);
    set("proyNetaPromedio", `$${fmtMoney(gananciaNetaHoy)}`); 
    set("proyDias", 'Calculando...'); 

    // 4. Renderizar Tabla de Últimos Turnos (CORRECCIÓN)
    const tbodyTurnos = $("tablaTurnos");
    if (tbodyTurnos) {
        tbodyTurnos.innerHTML = "";
        const ultimosTurnos = state.turnos.slice(-5).reverse(); 

        if (ultimosTurnos.length === 0) {
            tbodyTurnos.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#999;">Aún no hay turnos registrados.</td></tr>`;
        } else {
            ultimosTurnos.forEach(t => {
                const tr = document.createElement('tr');
                const gananciaNeta = safeNumber(t.ganancia); 
                
                tr.innerHTML = `
                    <td>${formatearFecha(t.fecha || t.fechaFin)}</td>
                    <td>${safeNumber(t.horas).toFixed(2)}h</td>
                    <td style="color:#6b7280; font-style:italic;">N/A</td> 
                    <td style="font-weight:bold;">$${fmtMoney(gananciaNeta)}</td>
                `;
                tbodyTurnos.appendChild(tr);
            });
        }
    }
};

// --- RENDERIZADO DEL HISTORIAL (CORRECCIÓN) ---
export const renderHistorial = () => {
    const tbody = $("historialBody");
    const resumenDiv = $("historialResumen");
    const state = getState();
    
    if (!tbody || !resumenDiv) return;

    tbody.innerHTML = "";
    let ingresosTotal = 0;
    let gastosTotal = 0;

    // Usamos state.movimientos, que debe ser la fuente única de ingresos/gastos
    state.movimientos.slice().reverse().forEach(mov => { 
        const tr = document.createElement('tr');
        const isIngreso = mov.tipo === 'ingreso';
        const monto = safeNumber(mov.monto);
        
        if (isIngreso) { ingresosTotal += monto; tr.style.backgroundColor = '#ecfdf5'; } else { gastosTotal += monto; tr.style.backgroundColor = '#fff5f5'; }

        tr.innerHTML = `<td>${isIngreso ? '➕ Ingreso' : '➖ Gasto'}</td><td>${formatearFecha(mov.fecha)}</td><td>${mov.desc}</td><td style="font-weight:bold; color: ${isIngreso ? '#059669' : '#dc2626'}">$${fmtMoney(monto)}</td>`;
        tbody.appendChild(tr);
    });
    
    const neto = ingresosTotal - gastosTotal;
    resumenDiv.innerHTML = `
        <p>Total Ingresos: <strong style="color:#059669;">$${fmtMoney(ingresosTotal)}</strong></p>
        <p>Total Gastos: <strong style="color:#dc2626;">$${fmtMoney(gastosTotal)}</strong></p>
        <hr style="margin:5px 0;">
        <p>Balance Neto: <strong style="color:${neto >= 0 ? '#059669' : '#dc2626'}; font-size:1.1rem;">$${fmtMoney(neto)}</strong></p>
    `;
};


const renderMantenimientoUI = () => {
    const state = getState();
    const base = state.parametros.mantenimientoBase;
    const ultimoKM = state.parametros.ultimoKM;
    
    const setVal = (id, val) => { const el = $(id); if(el) el.value = val; };
    setVal("mantenimientoAceite", base.Aceite);
    setVal("mantenimientoBujia", base.Bujia);
    setVal("mantenimientoLlantas", base.Llantas);

    const lastKmEl = $("maintLastKm");
    if(lastKmEl) lastKmEl.innerText = `${ultimoKM} km`;
    
    const ulAlertas = $("listaAlertasMantenimiento");
    if(!ulAlertas) return;
    ulAlertas.innerHTML = '';
    
    if(ultimoKM < 100) {
         ulAlertas.innerHTML = '<li>⚙️ Registra tu primer servicio (KM 0) para activar alertas.</li>';
         return;
    }

    const umbrales = [
        { key: 'Aceite', km: base.Aceite },
        { key: 'Bujía', km: base.Bujía },
        { key: 'Llantas', km: base.Llantas }
    ];

    umbrales.forEach(item => {
        const servicioKM = state.parametros.ultimoServicio[item.key] || 0;
        const kmFaltante = item.km - (ultimoKM - servicioKM);
        
        if(kmFaltante < item.km * 0.1) {
             ulAlertas.innerHTML += `<li style="color:#d97706;">🚨 ${item.key}: Faltan ${kmFaltante.toFixed(0)} km.</li>`;
        }
    });

    if (ulAlertas.innerHTML === '') {
        ulAlertas.innerHTML = '<li style="color:#10b981;">✅ Todo OK.</li>';
    }
};
export { renderMantenimientoUI }; 


/* ==========================================================================
   SECCIÓN 2: LISTENERS
   ========================================================================== */

export const setupAdminListeners = () => {
    if (!$("btnIniciarTurno")) return; 

    // 1. Turno (omitted)

    // 2. ODÓMETRO (CORRECCIÓN CRÍTICA BLINDADA)
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
    }

    // 3. Gastos Inteligentes (omitted)
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

    // 5. RESPALDO Y DATOS (CONEXIÓN CRÍTICA BLINDADA)
    const btnExport = $("btnExportarJson");
    const btnImport = $("btnRestaurarDatos");
    const textareaImport = $("importJson");
    const btnExcel = $("btnBajarExcel");

    // Copiar JSON (Debe funcionar ahora)
    if (btnExport) {
        btnExport.onclick = async () => {
            const json = exportarJsonLogic();
            try { await navigator.clipboard.writeText(json); alert("Copia JSON completa en el portapapeles. ¡Guardada!"); } catch (err) { console.error('Error al usar el portapapeles:', err); alert("Error al copiar. Intenta manualmente."); }
        };
    }
    
    // Restaurar JSON (Debe funcionar ahora)
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
    
    // 6. Wizards (omitted)

    // Llama a renderizar el mantenimiento al final de la inicialización del Admin
    renderMantenimientoUI();
};
