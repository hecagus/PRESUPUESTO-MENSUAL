// 05_init.js
import { loadData } from './02_data.js';
// La clave aquí es que renderDashboard se importa correctamente:
import { renderTurnoUI, renderOdometroUI, setupAdminListeners, renderDashboard, renderMetaDiaria } from './03_render.js';
import { initCharts } from './04_charts.js';

document.addEventListener("DOMContentLoaded", () => {
    loadData();
    const page = document.body.getAttribute('data-page');
    console.log(`[Init] Iniciando sistema en vista: ${page}`);

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
});
