/* 04_charts.js */
import { $ } from './01_consts_utils.js';
import { getState } from './02_data.js';

export const initCharts = () => {
    const ctxGanancias = $("graficaGanancias");
    const ctxKm = $("graficaKm");

    if (typeof Chart === 'undefined') return;
    const s = getState();
    
    // Usamos los últimos 7 turnos para no saturar
    const turnos = s.turnos.slice(-7);
    const labels = turnos.map(t => new Date(t.fecha).toLocaleDateString(undefined, {weekday:'short'}));
    
    // 1. Gráfica de Ganancias (Barras)
    if (ctxGanancias && turnos.length > 0) {
        new Chart(ctxGanancias, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Ganancia ($)',
                    data: turnos.map(t => t.ganancia),
                    backgroundColor: '#10b981',
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } }
            }
        });
    }

    // 2. Gráfica de KM/Hora (Línea)
    if (ctxKm && turnos.length > 0) {
        new Chart(ctxKm, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'KM Recorridos',
                    data: turnos.map(t => t.kmRecorridos),
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    fill: true,
                    tension: 0.3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } }
            }
        });
    }
};
