import { $ } from './01_consts_utils.js';
import { getState } from './02_data.js';

let chartInstance = null;

export const initCharts = () => {
    const canvas = $("graficaGanancias");
    // ¡CORRECCIÓN!: Si no hay canvas, salimos.
    if (!canvas) return;

    const state = getState();
    // Ejemplo simple: Últimos 7 turnos
    const ultimos = state.turnos.slice(-7);
    const labels = ultimos.map(t => new Date(t.fecha).toLocaleDateString());
    const data = ultimos.map(t => t.ganancia);

    if (chartInstance) chartInstance.destroy();

    chartInstance = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{ label: 'Ganancia ($)', data: data, backgroundColor: '#2563eb' }]
        }
    });
};
