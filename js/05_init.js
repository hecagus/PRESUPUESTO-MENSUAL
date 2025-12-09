// 05_init.js
import { loadData } from './02_data.js';
import { 
    renderTurnoUI, renderOdometroUI, setupAdminListeners, renderDashboard, 
    renderMetaDiaria, renderHistorial, renderMantenimientoUI 
} from './03_render.js';
import { initCharts } from './04_charts.js';

document.addEventListener("DOMContentLoaded", () => {
    // 1. Cargar Datos Globales
    loadData();

    // 2. Detectar Página
    const page = document.body.getAttribute('data-page');
    console.log(`[Init] Sistema iniciado en vista: ${page}`);

    // 3. Router de Vistas (EJECUCIÓN BLINDADA CON ?.)

    if (page === 'admin') {
        // Solo ejecutamos lógica de admin
        renderTurnoUI?.();      
        renderOdometroUI?.();   
        renderMetaDiaria?.();
        renderMantenimientoUI?.();
        
        setupAdminListeners?.(); // Esta función tiene su propio chequeo interno también
    } 
    else if (page === 'index') {
        // Solo lógica de dashboard
        renderDashboard?.(); 
        initCharts?.();         
    }
    else if (page === 'historial') {
        // Solo lógica de historial
        renderHistorial?.(); 
    }
    
    // Si tuvieras tutorial:
    // if (page === 'tutorial') { ... }
});
