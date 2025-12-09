// 05_init.js
import { loadData } from './02_data.js';
import {
    renderTurnoUI,
    renderOdometroUI,
    renderMetaDiaria,
    renderMantenimientoUI,
    renderDashboard,
    renderHistorial,
    setupAdminListeners
} from './03_render.js';
import { initCharts } from './04_charts.js';

document.addEventListener("DOMContentLoaded", () => {
    loadData();

    const page = document.body.dataset.page;

    switch (page) {

        case 'admin':
            renderTurnoUI?.();
            renderOdometroUI?.();
            renderMetaDiaria?.();
            renderMantenimientoUI?.();
            setupAdminListeners?.();
            break;

        case 'index':
            renderDashboard?.();
            initCharts?.();
            break;

        case 'historial':
            renderHistorial?.();
            break;

        default:
            console.warn("Página sin inicializador.");
            break;
    }
});
