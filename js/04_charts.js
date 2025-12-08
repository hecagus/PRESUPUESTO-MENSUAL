// 04_charts.js
import { $ } from './01_consts_utils.js';
import { getState } from './02_data.js';

let chartInstance = null;

export const initCharts = () => {
    const canvas = $("graficaGanancias");
    // Protección: Si no estamos en index.html, no hacemos nada.
    if (!canvas) return; 

    const state = getState();
    // Tomamos los últimos 7 turnos para el gráfico
    const ultimos = state.turnos.slice(-7);
    const labels = ultimos.map(t => new Date(t.fecha).toLocaleDateString());
    const data = ultimos.map(t => t.ganancia);

    // Verificar si Chart.js está cargado
    if (typeof Chart === 'undefined') {
        console.warn("Chart.js no está cargado.");
        return;
    }

    if (chartInstance) chartInstance.destroy();

    chartInstance = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Ganancia Neta ($)',
                data: data,
                backgroundColor: '#2563eb',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            }
        }
    });
};
