// 05_init.js
import { loadData } from './02_data.js';
import { 
    renderTurnoUI, 
    renderOdometroUI, 
    setupAdminListeners, 
    renderDashboard, 
    renderMetaDiaria,
    renderDeudasList,      // <--- NUEVO
    renderGastosFijosList, // <--- NUEVO
    renderHistorialTable   // <--- NUEVO
} from './03_render.js';
import { initCharts } from './04_charts.js';

document.addEventListener("DOMContentLoaded", () => {
    loadData();
    const page = document.body.getAttribute('data-page');
    console.log(`[Init] Iniciando sistema en vista: ${page}`);

    if (page === 'admin') {
        renderTurnoUI();      
        renderOdometroUI();   
        renderMetaDiaria();   
        renderDeudasList();     // <--- Muestra las deudas
        renderGastosFijosList();// <--- Muestra los gastos fijos
        setupAdminListeners();
    } 
    else if (page === 'index') {
        renderDashboard(); 
        initCharts();         
    }
    else if (page === 'historial') {
        renderHistorialTable(); // <--- Muestra la tabla de Movimientos/Gastos/Turnos
    }
});
