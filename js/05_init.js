import { loadData } from './02_data.js';
import {
    renderGlobalHeader,
    renderTurnoUI,
    setupAdminListeners,
    renderListasAdmin
} from './03_render.js';
import { initCharts } from './04_charts.js';

document.addEventListener("DOMContentLoaded", () => {
    renderGlobalHeader();
    loadData();

    const page = document.body?.dataset.page || 'index';

    if (page === 'admin') {
        renderTurnoUI();
        renderListasAdmin();
        setupAdminListeners();
    }

    if (page === 'index') initCharts();

    console.log(`✅ INIT OK → ${page}`);
});
