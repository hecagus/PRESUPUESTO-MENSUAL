import { $, log } from './01_consts_utils.js';
import { getState } from './02_data.js';

export const initCharts = () => {
    const ctx = $("graficaGanancias");
    if (!ctx || typeof Chart === 'undefined') {
        log("CHART", "No inicializado");
        return;
    }
    const t = getState().turnos.slice(-7);
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: t.map(x => new Date(x.fecha).toLocaleDateString()),
            datasets: [{ data: t.map(x => x.ganancia) }]
        }
    });
};
