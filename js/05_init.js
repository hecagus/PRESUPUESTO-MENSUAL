import { loadData } from './02_data.js';
import { 
    renderTurnoUI, renderOdometroUI, setupAdminListeners, renderDashboard, 
    renderMetaDiaria, renderHistorial, renderMantenimientoUI 
} from './03_render.js';
// Si charts tiene error, lo ignoramos con try catch si es necesario, pero aquí asumimos que funciona.
import { initCharts } from './04_charts.js';

document.addEventListener("DOMContentLoaded", () => {
    // 1. Cargar Datos
    loadData();

    // 2. Detectar Página
    const page = document.body.getAttribute('data-page');
    console.log(`[Init] Iniciado en: ${page}`);

    // 3. Ejecución Condicional (Evita errores de null)
    if (page === 'admin') {
        if (typeof renderTurnoUI === 'function') renderTurnoUI();
        if (typeof renderOdometroUI === 'function') renderOdometroUI();
        if (typeof renderMetaDiaria === 'function') renderMetaDiaria();
        if (typeof renderMantenimientoUI === 'function') renderMantenimientoUI();
        if (typeof setupAdminListeners === 'function') setupAdminListeners();
    } 
    else if (page === 'index') {
        if (typeof renderDashboard === 'function') renderDashboard();
        if (typeof initCharts === 'function') initCharts();
    }
    else if (page === 'historial') {
        if (typeof renderHistorial === 'function') renderHistorial();
    }
});
