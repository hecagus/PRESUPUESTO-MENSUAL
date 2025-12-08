// 05_init.js
import { loadData } from './02_data.js';
import { renderTurnoUI, setupAdminListeners, renderDashboard, renderMetaDiaria } from './03_render.js';
import { initCharts } from './04_charts.js';

document.addEventListener("DOMContentLoaded", () => {
    // 1. Cargar Datos Globales
    loadData();

    // 2. Detectar Página actual
    const page = document.body.getAttribute('data-page');
    console.log(`[Init] Página detectada: ${page}`);

    // 3. Router de Funcionalidad
    if (page === 'admin') {
        // Lógica exclusiva de Admin
        renderTurnoUI();      // Estado del botón iniciar/fin
        renderMetaDiaria();   // Tu cálculo favorito
        setupAdminListeners();// Wizards y eventos
    } 
    else if (page === 'index') {
        // Lógica exclusiva de Dashboard
        renderDashboard();    // KPIs
        initCharts();         // Gráficas
    }
    else if (page === 'historial') {
        // Lógica de historial (placeholder)
    }

    // 4. Tutorial (Opcional, si decides reactivarlo)
    // checkTutorial(); 
});
