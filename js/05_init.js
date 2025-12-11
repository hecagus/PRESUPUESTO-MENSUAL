import { loadData } from './02_data.js';
import { 
    renderTurnoUI, renderOdometroUI, setupAdminListeners, 
    renderMetaDiaria, renderMantenimientoUI, renderListasAdmin
} from './03_render.js';
// No importamos initCharts ni renderDashboard aquí porque es solo para admin.html según tu lógica

document.addEventListener("DOMContentLoaded", () => {
    loadData();

    const page = document.body.getAttribute('data-page');
    console.log(`[Init] App V-Final en: ${page}`);

    if (page === 'admin') {
        renderTurnoUI?.();
        renderOdometroUI?.();
        renderMetaDiaria?.();
        renderMantenimientoUI?.();
        renderListasAdmin?.(); // <--- Agregado para ver las listas
        setupAdminListeners?.();
    }
});
