import { loadData } from './02_data.js';
import { 
    renderTurnoUI, renderOdometroUI, setupAdminListeners, 
    renderMetaDiaria, renderMantenimientoUI, renderDashboard, 
    renderListasAdmin, renderHistorial, renderWalletUI, 
    renderGlobalHeader // IMPORTANTE
} from './03_render.js';
import { initCharts } from './04_charts.js';

document.addEventListener("DOMContentLoaded", () => {
    // 1. INYECCIÓN DEL MENÚ (PRIORIDAD ALTA)
    renderGlobalHeader();

    // 2. Cargar datos
    loadData();
    
    // 3. Identificar página
    const page = document.body.getAttribute('data-page');

    // 4. Ejecutar renderizado
    if (page === 'admin') {
        renderTurnoUI(); renderOdometroUI(); renderMetaDiaria();
        renderMantenimientoUI(); renderListasAdmin(); setupAdminListeners();
    } else if (page === 'index') {
        renderDashboard(); initCharts();
    } else if (page === 'historial') {
        renderHistorial();
    } else if (page === 'wallet') {
        renderWalletUI();
    }
    
    console.log(`Sistema inicializado en página: ${page}`);
});
