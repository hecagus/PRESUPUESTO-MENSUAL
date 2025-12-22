/* 04_charts.js */
import { $ } from './01_consts_utils.js';
import { getState } from './02_data.js';

export const initCharts = () => {
    const ctxG = $("graficaGanancias");
    const ctxK = $("graficaKm");

    // Seguridad: Si no hay ChartJS o no hay elementos, salir.
    if (typeof Chart === 'undefined' || (!ctxG && !ctxK)) return;

    const s = getState();
    const turnos = s.turnos.slice(-14); 
    const labels = turnos.map(t => new Date(t.fecha).toLocaleDateString(undefined, {weekday:'short'}));
    
    if (ctxG) {
        new Chart(ctxG, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Ganancia',
                    data: turnos.map(t => t.ganancia),
                    backgroundColor: '#2563eb',
                    borderRadius: 4
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });
    }

    if (ctxK) {
        new Chart(ctxK, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'KM',
                    data: turnos.map(t => t.kmRecorridos),
                    borderColor: '#16a34a',
                    tension: 0.3,
                    fill: true,
                    backgroundColor: 'rgba(22, 163, 74, 0.1)'
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });
    }
};
