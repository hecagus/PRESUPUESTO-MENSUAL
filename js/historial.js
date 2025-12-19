import { load } from './02_data.js';
import { fmtMoney } from './01_consts_utils.js';

const d = load();
document.getElementById('historial').innerHTML =
  d.gastos.map(g => fmtMoney(g.monto)).join('<br>');
