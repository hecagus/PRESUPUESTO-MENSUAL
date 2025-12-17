import { loadData } from './02_data.js';
import { 
    renderTurnoUI, renderOdometroUI, setupAdminListeners, 
    renderMetaDiaria, renderMantenimientoUI, renderDashboard, 
    renderListasAdmin 
} from './03_render.js';

document.addEventListener("DOMContentLoaded", () => {
    loadData();
    const page = document.body.getAttribute('data-page');

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

