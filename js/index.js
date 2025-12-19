import { load } from './02_data.js';
import { fmtMoney } from './01_consts_utils.js';

const d = load();
document.getElementById('resumen').textContent =
  `Gastos totales: ${fmtMoney(d.gastos.reduce((a,b)=>a+b.monto,0))}`;
