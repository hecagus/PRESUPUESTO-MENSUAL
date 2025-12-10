import { $ } from './01_consts_utils.js';
import { getState } from './02_data.js';

export const initCharts = () => {
    // Si no existen los canvas, no hacemos nada (protección)
    const ctxGanancias = $("graficaGanancias");
    const ctxKm = $("graficaKm");

    if (!ctxGanancias || !ctxKm) return;
    if (typeof Chart === 'undefined') {
        console.warn("Chart.js no cargado");
        return;
    }

    const state = getState();
    // Tomamos los últimos 14 turnos para la gráfica
    const ultimosTurnos = state.turnos.slice().reverse().slice(0, 14).reverse();
    
    // Preparar datos
    const labels = ultimosTurnos.map(t => new Date(t.fecha).toLocaleDateString(undefined, {weekday:'short', day:'numeric'}));
    const dataGanancias = ultimosTurnos.map(t => t.ganancia);
    
    // --- GRÁFICA 1: BALANCE FINANCIERO ---
    new Chart(ctxGanancias, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Ganancia Neta ($)',
                data: dataGanancias,
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

    // --- GRÁFICA 2: RENDIMIENTO (Horas trabajadas) ---
    const dataHoras = ultimosTurnos.map(t => t.horas);

    new Chart(ctxKm, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Horas Trabajadas',
                data: dataHoras,
                borderColor: '#3b82f6',
                tension: 0.4,
                fill: true,
                backgroundColor: 'rgba(59, 130, 246, 0.1)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' } }
        }
    });
};
