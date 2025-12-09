// 05_init.js
import { loadData } from './02_data.js';
// Importamos renderMantenimientoUI
import { renderTurnoUI, renderOdometroUI, setupAdminListeners, renderDashboard, renderMetaDiaria, renderHistorial, renderMantenimientoUI } from './03_render.js'; 
import { initCharts } from './04_charts.js';

document.addEventListener("DOMContentLoaded", () => {
    loadData();
    const page = document.body.getAttribute('data-page');
    console.log(`[Init] Iniciando sistema en vista: ${page}`);

    if (page === 'admin') {
        renderTurnoUI();      
        renderOdometroUI();   
        renderMetaDiaria();   
        renderMantenimientoUI(); // <-- Aseguramos que se llama al cargar
        setupAdminListeners();
    } 
    else if (page === 'index') {
        renderDashboard(); 
        initCharts();         
    }
    else if (page === 'historial') {
        renderHistorial(); 
    }
});
