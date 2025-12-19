import { $ } from './01_consts_utils.js';
import { getState } from './02_data.js';

export const initCharts = () => {
    const ctx = $("graficaGanancias");
    if (!ctx || typeof Chart === 'undefined') return;
    const ultimos = getState().turnos.slice(-14);
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ultimos.map(t => new Date(t.fecha).toLocaleDateString(undefined, {day:'numeric', month:'short'})),
            datasets: [{ label: 'Ganancia', data: ultimos.map(t => t.ganancia), backgroundColor: '#10b981' }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
};
