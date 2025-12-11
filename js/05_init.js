import { loadData } from './02_data.js';
import { 
    renderTurnoUI, renderOdometroUI, setupAdminListeners, 
    renderMetaDiaria, renderMantenimientoUI, renderListasAdmin 
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
        renderOdometroUI?.();
        renderMetaDiaria?.();
        renderMantenimientoUI?.();
        renderListasAdmin?.(); // Muestra las listas de Deudas y Fijos
        setupAdminListeners?.();
    }
    else if (page === 'index') {
        initCharts?.();
        // Si tienes funciones de dashboard, van aqui
    }
});
