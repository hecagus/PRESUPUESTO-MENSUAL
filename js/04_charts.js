import { $ } from './01_consts_utils.js';
import { getState } from './02_data.js';

export const initCharts = () => {
    const ctx = $("chartGanancias"); // Para Dashboard
    const ctxGastos = $("chartGastos"); // Para Admin (según tu HTML admin)

    if (typeof Chart === 'undefined') return;
    const s = getState();

    // 1. Gráfica Dashboard (Ganancias/Ingresos)
    if (ctx) {
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: s.ingresos.map((_, i) => `T${i + 1}`),
                datasets: [{
                    label: 'Ingresos',
                    data: s.ingresos,
                    backgroundColor: '#16a34a'
                }]
            },
            options: { responsive: true }
        });
    }

    // 2. Gráfica Admin (Gastos por Categoría - Ejemplo simple)
    if (ctxGastos) {
        // Agrupar gastos por tipo
        const porTipo = s.gastos.reduce((acc, g) => {
            acc[g.tipo] = (acc[g.tipo] || 0) + g.monto;
            return acc;
        }, {});

        new Chart(ctxGastos, {
            type: 'doughnut',
            data: {
                labels: Object.keys(porTipo),
                datasets: [{
                    data: Object.values(porTipo),
                    backgroundColor: ['#2563eb', '#dc2626', '#fbbf24']
                }]
            }
        });
    }
};
