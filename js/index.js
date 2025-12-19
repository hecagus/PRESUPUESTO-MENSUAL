import './menu.js';
import { load } from './02_data.js';

const d = load();
const ctx = document.getElementById('chartGanancias');

new Chart(ctx, {
  type: 'bar',
  data: {
    labels: d.gastos.map((_, i) => `G${i + 1}`),
    datasets: [{
      label: 'Gastos',
      data: d.gastos.map(g => g.monto)
    }]
  }
});
