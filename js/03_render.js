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

// --- RENDERIZADO GENERAL (Funciones completas omitidas por brevedad, asumiendo funcionalidad) ---
export const renderTurnoUI = () => { /* ... */ };
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
export const renderDashboard = () => { /* ... */ };
export const renderHistorial = () => { /* ... */ };
const renderMantenimientoUI = () => { /* ... */ };
export { renderMantenimientoUI };


// --- LÓGICA DE EXCEL (Placeholder) ---
const exportarExcel = () => {
    alert("Función de exportación a Excel pendiente: Requiere desarrollo con librería XLSX.js.");
};


/* ==========================================================================
   SECCIÓN 2: LISTENERS
   ========================================================================== */

export const setupAdminListeners = () => {
    if (!$("btnIniciarTurno")) return; 

    // --- Secciones 1 a 4 y Mantenimiento (omitted for brevity) ---
    
    // 5. RESPALDO Y DATOS (CORRECCIÓN FINAL)
    
    const btnExport = $("btnExportarJson");
    const btnImport = $("btnRestaurarDatos");
    const textareaImport = $("importJson");
    const btnExcel = $("btnBajarExcel");

    // Copiar JSON (EXPORTAR)
    if (btnExport) {
        btnExport.onclick = async () => {
            const json = exportarJsonLogic();
            try {
                // La API de Clipboard es async, debe estar en un try/catch
                await navigator.clipboard.writeText(json);
                alert("Copia JSON completa en el portapapeles. ¡Guardada!");
            } catch (err) {
                console.error('Error al usar el portapapeles:', err);
                alert("Error al copiar. La consola muestra detalles. Intenta manualmente o verifica permisos.");
            }
        };
    }
    
    // Bajar Excel (PLACEHOLDER)
    if (btnExcel) {
        btnExcel.onclick = exportarExcel; // Conecta al alert()
    }

    // Restaurar JSON (IMPORTAR)
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
    
    // --- (Resto de listeners se mantiene igual) ---
};
