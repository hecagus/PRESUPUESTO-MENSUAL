import { loadData } from './02_data.js';
import { 
    renderTurnoUI, renderOdometroUI, setupAdminListeners, 
    renderDashboard, renderMetaDiaria, renderHistorial, renderMantenimientoUI 
} from './03_render.js';
import { initCharts } from './04_charts.js';

document.addEventListener("DOMContentLoaded", () => {
    // 1. Cargar Datos
    loadData();

    // 2. Detectar Página
    const page = document.body.getAttribute('data-page');
    console.log(`[Init] App V3.0 en: ${page}`);

    // 3. Router Seguro (Cada bloque es independiente)
    if (page === 'admin') {
        renderTurnoUI?.();
        renderOdometroUI?.();
        renderMetaDiaria?.();
        renderMantenimientoUI?.();
        setupAdminListeners?.();
    }
    else if (page === 'index') {
        renderDashboard?.();
        initCharts?.();
    }
    else if (page === 'historial') {
        renderHistorial?.();
    }
});
