import { load } from './02_data.js';
import { fmtMoney } from './01_consts_utils.js';

const d = load();
document.getElementById('walletInfo').innerHTML =
  d.deudas.map(x => `${x.nombre}: ${fmtMoney(x.saldo)}`).join('<br>');
