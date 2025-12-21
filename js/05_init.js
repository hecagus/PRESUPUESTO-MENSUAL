/* 05_init.js */
import { loadData } from './02_data.js';
import { 
    renderTurnoUI, setupAdminListeners, renderMetaDiaria, 
    renderListasAdmin, renderDashboard, renderHistorial, 
    renderWalletUI, renderGlobalMenu 
} from './03_render.js';
import { initCharts } from './04_charts.js';

document.addEventListener("DOMContentLoaded", () => {
    // 1. Cargar Datos Globales
    loadData();
    
    // 2. Renderizar Menú en TODAS las páginas
    renderGlobalMenu();
    
    // 3. Router Simple (basado en data-page del body)
    const page = document.body.getAttribute('data-page');

    switch (page) {
        case 'index':
            renderDashboard();
            initCharts();
            break;
            
        case 'admin':
            renderTurnoUI();
            renderMetaDiaria();
            renderListasAdmin();
            setupAdminListeners();
            break;
            
        case 'wallet':
            renderWalletUI();
            break;
            
        case 'historial':
            renderHistorial();
            break;
            
        default:
            console.log("Página sin lógica específica definida.");
    }
    
    console.log(`Sistema inicializado: ${page}`);
});
