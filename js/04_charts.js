import { $ } from './01_consts_utils.js';
import { getState } from './02_data.js';

export const initCharts = () => {
    const ctx = $("graficaGanancias");
    if (!ctx || typeof Chart === 'undefined') return;
    const s = getState().turnos.slice(-7);
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: s.map(t => new Date(t.fecha).toLocaleDateString()),
            datasets: [{ label: 'Ganancia', data: s.map(t => t.ganancia), backgroundColor: '#10b981' }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
};
