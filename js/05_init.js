import { loadData } from './02_data.js';
import { 
    renderTurnoUI, renderOdometroUI, setupAdminListeners, 
    renderMetaDiaria, renderMantenimientoUI, renderDashboard 
} from './03_render.js';

document.addEventListener("DOMContentLoaded", () => {
    try {
        loadData();
        const page = document.body.getAttribute('data-page');
        
        if (page === 'admin') {
            renderTurnoUI();
            renderOdometroUI();
            renderMetaDiaria();
            renderMantenimientoUI();
            setupAdminListeners();
        } else if (page === 'index') {
            renderDashboard();
        }
        console.log("App iniciada en:", page);
    } catch (e) {
        console.error("Fallo crítico en el inicio:", e);
    }
});

