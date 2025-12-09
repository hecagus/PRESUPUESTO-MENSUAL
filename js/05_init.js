// 05_init.js
import { loadData } from './02_data.js';
// Importamos la nueva función
import { renderTurnoUI, renderOdometroUI, setupAdminListeners, renderDashboard, renderMetaDiaria, renderHistorial, renderMantenimientoUI } from './03_render.js';
import { initCharts } from './04_charts.js';

document.addEventListener("DOMContentLoaded", () => {
    loadData();
    const page = document.body.getAttribute('data-page');

    if (page === 'admin') {
        renderTurnoUI();      
        renderOdometroUI();   
        renderMetaDiaria();
        
        // ¡AQUÍ ESTÁ LA MAGIA!
        // Ahora renderizamos mantenimiento de forma segura
        renderMantenimientoUI();
           
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
