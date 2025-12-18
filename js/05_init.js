import { loadData } from './02_data.js';
import { 
    renderTurnoUI, renderOdometroUI, setupAdminListeners, 
    renderMetaDiaria, renderMantenimientoUI, renderDashboard, 
    renderListasAdmin, renderHistorial 
} from './03_render.js';
import { initCharts } from './04_charts.js';

document.addEventListener("DOMContentLoaded", () => {
    // 1. Cargar datos del almacenamiento
    loadData();
    
    // 2. Identificar la página actual
    const page = document.body.getAttribute('data-page');

    // 3. Ejecutar renderizado y eventos según la vista
    if (page === 'admin') {
        renderTurnoUI();
        renderOdometroUI();
        renderMetaDiaria();
        renderMantenimientoUI();
        renderListasAdmin();
        setupAdminListeners();
    } else if (page === 'index') {
        renderDashboard();
        initCharts();
    } else if (page === 'historial') {
        renderHistorial();
    }
    
    console.log(`Sistema inicializado en página: ${page}`);
});

