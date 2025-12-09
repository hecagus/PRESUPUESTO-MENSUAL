// 05_init.js
import { loadData } from './02_data.js';
// Importamos TODAS las funciones necesarias de render
import { renderTurnoUI, renderOdometroUI, setupAdminListeners, renderDashboard, renderMetaDiaria, renderHistorial } from './03_render.js';
import { initCharts } from './04_charts.js';

document.addEventListener("DOMContentLoaded", () => {
    // 1. Cargar Datos Globales
    loadData();

    // 2. Detectar Página
    const page = document.body.getAttribute('data-page');
    console.log(`[Init] Sistema iniciado en vista: ${page}`);

    // 3. Router de Vistas (EJECUCIÓN SELECTIVA)
    
    if (page === 'admin') {
        // SOLO ejecutas esto si estás en admin.html
        renderTurnoUI();      
        renderOdometroUI();   
        renderMetaDiaria();   
        setupAdminListeners(); // Aquí están los botones que fallaban
    } 
    else if (page === 'index') {
        // SOLO ejecutas esto si estás en index.html
        renderDashboard(); 
        initCharts();         
    }
    else if (page === 'historial') {
        // SOLO ejecutas esto si estás en historial.html
        renderHistorial(); 
    }
    // Si añades tutorial, iría aquí...
});
