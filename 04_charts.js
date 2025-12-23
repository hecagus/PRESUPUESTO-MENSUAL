
import { $ } from './01_consts_utils.js';

export const renderCharts = (store) => {
    if(typeof Chart === 'undefined') return;

    const ctxG = $('#chartGanancias');
    if(ctxG) {
        const turnos = store.turnos.slice(-7);
        new Chart(ctxG, {
            type: 'bar',
            data: {
                labels: turnos.map(t => new Date(t.fecha).toLocaleDateString(undefined, {weekday:'short'})),
                datasets: [{ label: 'Ganancia', data: turnos.map(t => t.ganancia), backgroundColor: '#2563eb', borderRadius: 4 }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });
    }

    const ctxK = $('#chartGas');
    if(ctxK) {
        const cargas = store.cargasCombustible.slice(-10);
        const dataRend = [];
        const labelsRend = [];
        for(let i=1; i<cargas.length; i++) {
            const dist = cargas[i].km - cargas[i-1].km;
            if(dist > 0) {
                dataRend.push(cargas[i].costo / dist);
                labelsRend.push(new Date(cargas[i].fecha).toLocaleDateString());
            }
        }
        new Chart(ctxK, {
            type: 'line',
            data: {
                labels: labelsRend,
                datasets: [{ label: '$ / KM', data: dataRend, borderColor: '#f59e0b', tension: 0.3 }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }
};
