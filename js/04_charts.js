import { $ } from './01_consts_utils.js';

export const renderCharts = (store) => {
    if(typeof Chart === 'undefined') return;

    // 1. Gráfica de Ganancias (Últimos 7 días con actividad)
    const ctxG = $('#chartGanancias');
    if(ctxG) {
        // Agrupar ganancias por día (últimos 7 registros de turnos)
        const turnos = store.turnos.slice(-7);
        const labels = turnos.map(t => new Date(t.fecha).toLocaleDateString(undefined, {weekday:'short'}));
        const data = turnos.map(t => t.ganancia);

        new Chart(ctxG, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Ganancia',
                    data,
                    backgroundColor: '#2563eb',
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

    // 2. Gráfica de Rendimiento Gasolina
    const ctxK = $('#chartGas');
    if(ctxK) {
        // Últimas 5 cargas
        const cargas = store.cargasCombustible.slice(-5);
        if(cargas.length > 1) {
            // Calcular rendimiento entre cargas consecutivas
            const dataRend = [];
            const labelsRend = [];
            
            for(let i=1; i<cargas.length; i++) {
                const prev = cargas[i-1];
                const curr = cargas[i];
                const dist = curr.km - prev.km;
                if(dist > 0) {
                    dataRend.push(curr.costo / dist); // $ por KM
                    labelsRend.push(new Date(curr.fecha).toLocaleDateString());
                }
            }

            new Chart(ctxK, {
                type: 'line',
                data: {
                    labels: labelsRend,
                    datasets: [{
                        label: '$ / KM',
                        data: dataRend,
                        borderColor: '#f59e0b',
                        tension: 0.3
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false
                }
            });
        }
    }
};
