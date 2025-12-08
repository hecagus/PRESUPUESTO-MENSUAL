// 05_init.js
import { loadData } from './02_data.js';
import { renderTurnoUI, renderOdometroUI, setupAdminListeners, renderDashboard, renderMetaDiaria, renderHistorial } from './03_render.js';
import { initCharts } from './04_charts.js';

document.addEventListener("DOMContentLoaded", () => {
    // 1. Cargar Estado Global
    loadData();

    // 2. Detectar Página
    const page = document.body.getAttribute('data-page');
    console.log(`[Init] Iniciando sistema en vista: ${page}`);

    // 3. Router de Vistas
    if (page === 'admin') {
        renderTurnoUI();      
        renderOdometroUI();   
        renderMetaDiaria();   
        setupAdminListeners();
    } 
    else if (page === 'index') {
        renderDashboard(); 
        initCharts();         
    }
    else if (page === 'historial') {
        renderHistorial(); // <-- ¡Llamada agregada!
    }
});
