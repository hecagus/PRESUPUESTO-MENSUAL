// 03_render.js
import { $, fmtMoney, CATEGORIAS_GASTOS, formatearFecha, safeNumber } from './01_consts_utils.js';
import { getState, getTurnoActivo, iniciarTurnoLogic, finalizarTurnoLogic, recalcularMetaDiaria, registrarCargaGasolina, actualizarOdometroManual, agregarDeuda, agregarGasto, agregarGastoFijo, exportarJsonLogic, importarJsonLogic } from './02_data.js';

// --- Funciones de Renderizado (Omitidas por brevedad) ---

// --- LÓGICA DE EXCEL (Placeholder) ---
const exportarExcel = () => {
    // Esta función requiere que la librería XLSX.js esté cargada en admin.html
    alert("Función de exportación a Excel pendiente: Implementación compleja (XLSX.js).");
};


export const setupAdminListeners = () => {
    if (!$("btnIniciarTurno")) return; 

    // ... (1. Turno, 2. Odómetro, 3. Gastos, 4. Wizards... se mantienen) ...

    
    // 5. RESPALDO Y DATOS (NUEVO)
    
    const btnExport = $("btnExportarJson"); // Asumiendo ID: btnExportarJson
    const btnImport = $("btnRestaurarDatos"); // Asumiendo ID: btnRestaurarDatos
    const textareaImport = $("importJson");
    const btnExcel = $("btnBajarExcel"); // Asumiendo ID: btnBajarExcel

    // Exportar JSON (Copiar al portapapeles)
    if (btnExport) {
        btnExport.onclick = async () => {
            const json = exportarJsonLogic();
            try {
                // Usar API moderna del portapapeles
                await navigator.clipboard.writeText(json);
                alert("Copia JSON completa en el portapapeles. ¡Guardada!");
            } catch (err) {
                // Fallback (requiere que el elemento esté visible y seleccionado)
                console.error('Error al usar el portapapeles:', err);
                alert("Error al copiar. Revisa la consola o usa la función de Excel.");
            }
        };
    }
    
    // Importar JSON (Restaurar)
    if (btnImport && textareaImport) {
        btnImport.onclick = () => {
            const jsonString = textareaImport.value;
            if (!jsonString) {
                alert("Pega los datos JSON en la caja de texto.");
                return;
            }
            if (confirm("ADVERTENCIA: ¿Estás seguro de que quieres reemplazar tus datos actuales? Esta acción no se puede deshacer.")) {
                if (importarJsonLogic(jsonString)) {
                    alert("Datos restaurados correctamente. Recargando...");
                    window.location.reload();
                } else {
                    alert("ERROR: El formato JSON es inválido o corrupto. Verifica la estructura.");
                }
            }
        };
    }
    
    // Excel Placeholder
    if (btnExcel) {
        btnExcel.onclick = exportarExcel;
    }
    
    // ... (Cierre de setupAdminListeners) ...
};
