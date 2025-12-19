import { loadData } from './02_data.js';
import { 
    renderGlobalHeader, 
    renderDashboard, 
    renderTurnoUI, 
    setupAdminListeners, 
    renderListasAdmin 
} from './03_render.js';
import { initCharts } from './04_charts.js';

document.addEventListener("DOMContentLoaded", () => {
    renderGlobalHeader();
    loadData();

    const page = document.body?.dataset.page || 'index';

    switch (page) {
        case 'admin':
            renderTurnoUI();
            renderListasAdmin();
            setupAdminListeners();
            break;
        case 'index':
            renderDashboard();
            initCharts();
            break;
    }

    console.log(`✅ [PRODUCCIÓN] Sistema Online en: ${page}`);
});
