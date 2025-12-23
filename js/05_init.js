/* 05_init.js — ORQUESTADOR FINAL ESTABLE */

import {
  loadData,
  getStore,
  setUltimoKM,
  iniciarTurno,
  finalizarTurno,
  registrarGasolina,
  procesarGasto,
  agregarDeuda,
  abonarDeuda,
  importarBackup
} from './02_data.js';

import {
  $, fmtMoney, fmtDate, safeFloat, CATEGORIAS, FRECUENCIAS
} from './01_consts_utils.js';

import { Modal } from './03_render.js';
import { renderCharts } from './04_charts.js';

let timerInterval = null;

const App = {

  init() {
    loadData();
    const store = getStore();
    const page = document.body.dataset.page;

    if (page === 'admin') this.admin(store);
    if (page === 'index') this.index(store);
    if (page === 'wallet') this.wallet(store);
    if (page === 'historial') this.historial(store);
  },

  /* ================= ADMIN ================= */

  admin(store) {
    this.updateAdminUI(store);

    /* ---------- KILOMETRAJE ---------- */
    $('#btnConfigKM').onclick = () => {
      Modal.showInput(
        'Configurar kilometraje',
        [{ label: 'Kilometraje actual', key: 'km', type: 'number', value: store.parametros.ultimoKM || '' }],
        (d) => {
          const km = safeFloat(d.km);
          if (km <= 0) return false;
          setUltimoKM(km);
          this.refreshAdmin();
          return true;
        }
      );
    };

    /* ---------- TURNO ---------- */
    $('#btnTurnoIniciar').onclick = () => {
      iniciarTurno();
      this.refreshAdmin();
    };

    $('#btnTurnoFinalizar').onclick = () => {
      Modal.showInput(
        'Finalizar turno',
        [
          { label: 'Kilometraje final', key: 'km', type: 'number', value: store.parametros.ultimoKM },
          { label: 'Ganancia total ($)', key: 'gan', type: 'number' }
        ],
        (d) => {
          const km = safeFloat(d.km);
          const gan = safeFloat(d.gan);
          if (km <= store.parametros.ultimoKM || gan < 0) return false;
          finalizarTurno(km, gan);
          this.refreshAdmin();
          return true;
        }
      );
    };

    /* ---------- GASTOS ---------- */
    const gastoWizard = (grupo, categorias) => {
      Modal.showInput(
        `Gasto ${grupo}`,
        [
          { label: 'Descripción', key: 'desc', type: 'text' },
          { label: 'Monto ($)', key: 'monto', type: 'number' },
          {
            label: 'Categoría',
            key: 'cat',
            type: 'select',
            options: categorias.map(c => ({ value: c, text: c }))
          },
          {
            label: 'Frecuencia',
            key: 'freq',
            type: 'select',
            options: Object.keys(FRECUENCIAS).map(f => ({ value: f, text: f }))
          }
        ],
        (d) => {
          if (!d.desc || safeFloat(d.monto) <= 0) return false;
          procesarGasto(d.desc, d.monto, grupo, d.cat, d.freq);
          this.refreshAdmin();
          return true;
        }
      );
    };

    $('#btnGastoHogar').onclick = () =>
      gastoWizard('Hogar', CATEGORIAS.hogar);

    $('#btnGastoOperativo').onclick = () =>
      gastoWizard('Operativo', CATEGORIAS.operativo);

    /* ---------- GASOLINA ---------- */
    $('#btnGasolina').onclick = () => {
      Modal.showInput(
        'Registrar gasolina',
        [
          { label: 'Litros', key: 'l', type: 'number' },
          { label: 'Costo total ($)', key: 'c', type: 'number' },
          { label: 'Kilometraje actual', key: 'k', type: 'number', value: store.parametros.ultimoKM }
        ],
        (d) => {
          const k = safeFloat(d.k);
          if (k <= store.parametros.ultimoKM) return false;
          registrarGasolina(d.l, d.c, k);
          this.refreshAdmin();
          return true;
        }
      );
    };

    /* ---------- DEUDAS ---------- */
    $('#btnDeudaNueva').onclick = () => {
      Modal.showInput(
        'Nueva deuda',
        [
          { label: 'Nombre', key: 'desc', type: 'text' },
          { label: 'Monto total ($)', key: 'total', type: 'number' },
          { label: 'Cuota ($)', key: 'cuota', type: 'number' },
          {
            label: 'Frecuencia',
            key: 'freq',
            type: 'select',
            options: Object.keys(FRECUENCIAS).map(f => ({ value: f, text: f }))
          }
        ],
        (d) => {
          agregarDeuda(d.desc, d.total, d.cuota, d.freq);
          this.refreshAdmin();
          return true;
        }
      );
    };

    /* ---------- ABONOS ---------- */
    $('#btnAbonoCuota').onclick = () => {
      const id = $('#abonoDeudaSelect').value;
      if (!id) return;
      const deuda = store.deudas.find(d => d.id === id);
      if (!deuda) return;
      abonarDeuda(id, deuda.montoCuota);
      this.refreshAdmin();
    };

    $('#btnAbonoCustom').onclick = () => {
      const id = $('#abonoDeudaSelect').value;
      if (!id) return;
      Modal.showInput(
        'Abono personalizado',
        [{ label: 'Monto ($)', key: 'm', type: 'number' }],
        (d) => {
          abonarDeuda(id, d.m);
          this.refreshAdmin();
          return true;
        }
      );
    };

    /* ---------- BACKUP ---------- */
    $('#btnExportJSON').onclick = () => {
      navigator.clipboard.writeText(JSON.stringify(store));
      alert('JSON copiado');
    };

    $('#btnRestoreBackup').onclick = () => {
      Modal.showInput(
        'Restaurar JSON',
        [{ label: 'Pegar JSON', key: 'json', type: 'text' }],
        (d) => {
          if (importarBackup(d.json)) {
            location.reload();
            return true;
          }
          return false;
        }
      );
    };
  },

  updateAdminUI(store) {
    /* KM */
    $('#kmActual').innerText = store.parametros.ultimoKM
      ? `${store.parametros.ultimoKM} km`
      : '—';

    /* META */
    $('#metaDiariaValor').innerText = fmtMoney(store.parametros.metaDiaria || 0);

    /* TURNO */
    if (store.turnoActivo) {
      $('#turnoEstado').innerText = '🟢 Turno en curso';
      $('#btnTurnoIniciar').classList.add('hidden');
      $('#btnTurnoFinalizar').classList.remove('hidden');

      if (timerInterval) clearInterval(timerInterval);
      const start = store.turnoActivo.inicio;

      timerInterval = setInterval(() => {
        const diff = Date.now() - start;
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        $('#turnoTimer').innerText = `${h}h ${m}m ${s}s`;
      }, 1000);
    } else {
      if (timerInterval) clearInterval(timerInterval);
      $('#turnoEstado').innerText = '🔴 Turno detenido';
      $('#turnoTimer').innerText = '--:--:--';
      $('#btnTurnoIniciar').classList.remove('hidden');
      $('#btnTurnoFinalizar').classList.add('hidden');
    }

    /* DEUDAS */
    const list = $('#listaDeudasAdmin');
    const select = $('#abonoDeudaSelect');
    list.innerHTML = '';
    select.innerHTML = '<option value="">-- Seleccionar deuda --</option>';

    store.deudas.forEach(d => {
      if (d.saldo <= 0) return;

      const li = document.createElement('li');
      li.className = 'list-item';
      li.innerHTML = `<span>${d.desc}</span><strong>${fmtMoney(d.saldo)}</strong>`;
      list.appendChild(li);

      const opt = document.createElement('option');
      opt.value = d.id;
      opt.innerText = `${d.desc} (${fmtMoney(d.montoCuota)})`;
      select.appendChild(opt);
    });
  },

  refreshAdmin() {
    loadData();
    this.admin(getStore());
  },

  /* ================= INDEX ================= */

  index(store) {
    const hoy = new Date().toDateString();
    const turnosHoy = store.turnos.filter(t => new Date(t.fecha).toDateString() === hoy);
    const ingresosHoy = store.movimientos
      .filter(m => m.tipo === 'ingreso' && new Date(m.fecha).toDateString() === hoy)
      .reduce((s, m) => s + m.monto, 0);

    $('#valHoras').innerText =
      turnosHoy.reduce((s, t) => s + t.horas, 0).toFixed(1) + 'h';

    $('#valGanancia').innerText = fmtMoney(ingresosHoy);

    const meta = store.parametros.metaDiaria || 0;
    const prog = meta > 0 ? (ingresosHoy / meta) * 100 : 0;

    $('#valMeta').innerText = fmtMoney(meta);
    $('#txtProgreso').innerText = prog.toFixed(0) + '%';
    $('#barProgreso').style.width = Math.min(prog, 100) + '%';

    renderCharts(store);
  },

  /* ================= WALLET ================= */

  wallet(store) {
    $('#valWallet').innerText = fmtMoney(store.wallet?.saldo || 0);
  },

  /* ================= HISTORIAL ================= */

  historial(store) {
    const tbody = $('#tablaBody');
    tbody.innerHTML = store.movimientos.slice().reverse().slice(0, 50).map(m => `
      <tr>
        <td>${fmtDate(m.fecha)}</td>
        <td>${m.desc}</td>
        <td class="${m.tipo === 'ingreso' ? 'text-green' : 'text-red'}">
          ${fmtMoney(m.monto)}
        </td>
      </tr>
    `).join('');

    renderCharts(store);
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
