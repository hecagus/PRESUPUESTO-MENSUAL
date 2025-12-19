import { $, log } from './01_consts_utils.js';
import { getState } from './02_data.js';

export const initCharts = () => {
    const ctx = $("graficaGanancias");
    if (!ctx || typeof Chart === 'undefined') {
        log("CHART", "No inicializado o falta Chart.js");
        return;
    }
    const data = getState().turnos.slice(-7);
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(t => new Date(t.fecha).toLocaleDateString()),
            datasets: [{ label: 'Ganancia', data: data.map(t => t.ganancia), backgroundColor: '#10b981' }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
};
