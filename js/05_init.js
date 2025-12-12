import { loadData } from './02_data.js';
import { 
    renderTurnoUI, renderOdometroUI, setupAdminListeners, 
    renderMetaDiaria, renderMantenimientoUI, renderListasAdmin, 
    renderDashboard, renderHistorial // Importado para router
} from './03_render.js';
import { initCharts } from './04_charts.js';

document.addEventListener("DOMContentLoaded", () => {
    // 1. Cargar Datos Globales
    loadData();

    // 2. Detectar Página
    const page = document.body.getAttribute('data-page');
    console.log(`[Init] App Cargada en: ${page}`);

    // 3. Router de Funcionalidad
    if (page === 'admin') {
        renderTurnoUI?.();
        renderOdometroUI?.(); // Ahora renderiza el detalle del KM
        renderMetaDiaria?.();
        renderMantenimientoUI?.();
        renderListasAdmin?.(); 
        setupAdminListeners?.();
    }
    else if (page === 'index') {
        renderDashboard?.(); // Carga el resumen de la página principal
        initCharts?.();
    }
    else if (page === 'historial') {
        renderHistorial?.(); // Carga el historial de movimientos
    }
});
