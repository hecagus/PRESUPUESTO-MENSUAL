// 03_render.js
import { $, fmtMoney, CATEGORIAS_GASTOS, formatearFecha, safeNumber } from './01_consts_utils.js';
import { getState, getTurnoActivo, iniciarTurnoLogic, finalizarTurnoLogic, recalcularMetaDiaria, registrarCargaGasolina, actualizarOdometroManual, agregarDeuda, agregarGasto, agregarGastoFijo, exportarJsonLogic, importarJsonLogic, calcularGastoOperativoAcumulado, guardarParametrosMantenimiento } from './02_data.js';

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

// --- RENDERIZADO GENERAL ---
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

    const tbodyTurnos = $("tablaTurnos");
    if (tbodyTurnos) {
        tbodyTurnos.innerHTML = "";
        const ultimosTurnos = state.turnos.slice(-5).reverse(); 
        if (ultimosTurnos.length === 0) {
            tbodyTurnos.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#999;">Aún no hay turnos registrados.</td></tr>`;
        } else {
            ultimosTurnos.forEach(t => {
                const tr = document.createElement('tr');
                const gananciaNeta = t.ganancia; 
                tr.innerHTML = `
                    <td>${formatearFecha(t.fecha)}</td>
                    <td>${t.horas.toFixed(2)}h</td>
                    <td style="color:#6b7280; font-style:italic;">N/A</td> 
                    <td style="font-weight:bold;">$${fmtMoney(gananciaNeta)}</td>
                `;
                tbodyTurnos.appendChild(tr);
            });
        }
    }
};

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
export { renderMantenimientoUI }; // Exportamos la función de renderizado de mantenimiento


// --- LÓGICA DE EXCEL (Placeholder) ---
const exportarExcel = () => {
    alert("Función de exportación a Excel pendiente: Requiere desarrollo con librería XLSX.js.");
};


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

    // 2. Odómetro
    if($("btnActualizarOdometro")) $("btnActualizarOdometro").onclick = () => {
        if(actualizarOdometroManual($("inputOdometro").value)) { renderOdometroUI(); $("inputOdometro").value = ""; alert("KM actualizado."); }
    };

    // 3. Gastos Inteligentes (Lógica omitida por brevedad en este bloque)

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

    // 5. RESPALDO Y DATOS (CONEXIÓN CRÍTICA CORREGIDA)
    
    const btnExport = $("btnExportarJson");
    const btnImport = $("btnRestaurarDatos");
    const textareaImport = $("importJson");
    const btnExcel = $("btnBajarExcel");

    // Copiar JSON
    if (btnExport) {
        btnExport.onclick = async () => {
            const json = exportarJsonLogic();
            try {
                // Usar API moderna del portapapeles
                await navigator.clipboard.writeText(json);
                alert("Copia JSON completa en el portapapeles. ¡Guardada!");
            } catch (err) {
                // Fallback si falla el API (o si el navegador no lo soporta en ese contexto)
                console.error('Error al usar el portapapeles:', err);
                alert("Error al copiar. La consola muestra detalles. Intenta manualmente.");
            }
        };
    }
    
    // Restaurar JSON
    if (btnImport && textareaImport) {
        btnImport.onclick = () => {
            const jsonString = textareaImport.value;
            if (!jsonString) {
                alert("Pega los datos JSON en la caja de texto antes de restaurar.");
                return;
            }
            if (confirm("ADVERTENCIA: ¿Estás seguro de que quieres reemplazar tus datos actuales?")) {
                if (importarJsonLogic(jsonString)) {
                    alert("Datos restaurados correctamente. Recargando...");
                    window.location.reload();
                } else {
                    alert("ERROR: El formato JSON es inválido o corrupto. Verifica la estructura.");
                }
            }
        };
    }
    
    // Bajar Excel
    if (btnExcel) {
        btnExcel.onclick = exportarExcel;
    }
    
    // (Resto de listeners omitidos por brevedad)
};
