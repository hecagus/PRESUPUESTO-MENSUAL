import './menu.js';
import { load, save } from './02_data.js';
import { fmtMoney } from './01_consts_utils.js';

let d = load();

const estado = document.getElementById('estadoTurno');
const btnTurno = document.getElementById('btnTurno');
const lista = document.getElementById('listaGastos');
const monto = document.getElementById('gastoMonto');

btnTurno.onclick = () => {
  d.turno = d.turno ? null : { inicio: Date.now() };
  save(d); location.reload();
};

document.getElementById('btnGasto').onclick = () => {
  if (!monto.value) return;
  d.gastos.push({ monto: +monto.value });
  save(d); location.reload();
};

estado.textContent = d.turno ? '🟢 Turno activo' : '🔴 Sin turno';
btnTurno.textContent = d.turno ? 'Finalizar Turno' : 'Iniciar Turno';
lista.innerHTML = d.gastos.map(g => fmtMoney(g.monto)).join('<br>');
