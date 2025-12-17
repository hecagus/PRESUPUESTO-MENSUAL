import { loadData } from './02_data.js';
import { 
    renderTurnoUI, renderOdometroUI, setupAdminListeners, 
    renderMetaDiaria, renderMantenimientoUI, renderDashboard, 
    renderListasAdmin 
} from './03_render.js';

document.addEventListener("DOMContentLoaded", () => {
    // 1. Cargar datos del almacenamiento
    loadData();
    
    // 2. Identificar la página actual
    const page = document.body.getAttribute('data-page');

    // 3. Ejecutar renderizado según la vista
    if (page === 'admin') {
        renderTurnoUI();
        renderOdometroUI();
        renderMetaDiaria();
        renderMantenimientoUI();
        renderListasAdmin();
        setupAdminListeners();
    } else if (page === 'index') {
        renderDashboard();
    }
});

