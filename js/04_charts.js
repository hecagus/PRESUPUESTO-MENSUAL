// 04_charts.js
import { $ } from './01_consts_utils.js';
import { getState } from './02_data.js';

let chartInstance = null;

export const initCharts = () => {
    const canvas = $("graficaGanancias");

    if (document.body.dataset.page !== "index") return;
    if (!canvas) return;
    if (typeof Chart === "undefined") return;

    const state = getState();
    const ultimos = state.turnos.slice(-7);

    const labels = ultimos.map(t =>
        new Date(t.fecha).toLocaleDateString()
    );

    const data = ultimos.map(t => t.ganancia);

    if (chartInstance) chartInstance.destroy();

    chartInstance = new Chart(canvas, {
        type: "bar",
        data: {
            labels,
            datasets: [{
                label: "Ganancia",
                data,
                backgroundColor: "#2563eb",
                borderRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } }
        }
    });
};
