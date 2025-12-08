import { loadData } from './02_data.js';
import { renderTurnoUI, setupAdminListeners, renderDashboard, renderMetaDiaria } from './03_render.js';
import { initCharts } from './04_charts.js';

document.addEventListener("DOMContentLoaded", () => {
    // 1. Cargar Datos
    loadData();

    // 2. Detectar Página
    const page = document.body.getAttribute('data-page');

    console.log("Iniciando módulo para página:", page);

    // 3. Router
    if (page === 'admin') {
        renderTurnoUI();      // UI de estado del turno
        renderMetaDiaria();   // UI de tu meta calculada
        setupAdminListeners();// Botones y Wizards
    } 
    else if (page === 'index') {
        renderDashboard();    // Resumen y KPIs
        initCharts();         // Gráficas
    }
    else if (page === 'historial') {
        // renderHistorial(); // Futura implementación
    }
});
