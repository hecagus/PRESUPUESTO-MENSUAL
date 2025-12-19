import { load, save } from './02_data.js';
import { fmtMoney } from './01_consts_utils.js';

let data = load();

const estado = document.getElementById('estadoTurno');
const btnTurno = document.getElementById('btnTurno');
const gastoMonto = document.getElementById('gastoMonto');
const btnGasto = document.getElementById('btnGasto');
const listaGastos = document.getElementById('listaGastos');
const selectDeuda = document.getElementById('selectDeuda');
const abonoMonto = document.getElementById('abonoMonto');
const btnAbono = document.getElementById('btnAbono');
const meta = document.getElementById('metaDiaria');

render();

btnTurno.onclick = () => {
  data.turno = data.turno ? null : { inicio: Date.now() };
  save(data); data = load(); render();
};

btnGasto.onclick = () => {
  if (!gastoMonto.value) return;
  data.gastos.push({ monto: Number(gastoMonto.value) });
  save(data); data = load();
  gastoMonto.value = '';
  render();
};

btnAbono.onclick = () => {
  const d = data.deudas.find(x => x.id == selectDeuda.value);
  if (!d || !abonoMonto.value) return;
  d.saldo -= Number(abonoMonto.value);
  save(data); data = load();
  abonoMonto.value = '';
  render();
};

function render() {
  estado.textContent = data.turno ? '🟢 Turno activo' : '🔴 Sin turno';
  btnTurno.textContent = data.turno ? 'Finalizar Turno' : 'Iniciar Turno';

  listaGastos.innerHTML = data.gastos.map(g => fmtMoney(g.monto)).join('<br>');
  selectDeuda.innerHTML = data.deudas.map(d =>
    `<option value="${d.id}">${d.nombre} (${fmtMoney(d.saldo)})</option>`
  ).join('');

  meta.textContent = fmtMoney(data.gastos.reduce((a,b)=>a+b.monto,0));
}
