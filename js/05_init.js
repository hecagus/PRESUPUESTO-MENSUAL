/* 05_init.js — ORQUESTADOR ESTABLE */

import {
  loadData, getStore, setUltimoKM,
  iniciarTurno, finalizarTurno,
  registrarGasolina, procesarGasto,
  agregarDeuda, abonarDeuda, importarBackup
} from './02_data.js';

import {
  fmtMoney, fmtDate, safeFloat,
  CATEGORIAS, FRECUENCIAS
} from './01_consts_utils.js';

import { Modal } from './03_render.js';
import { renderCharts } from './04_charts.js';

let timerInterval = null;

/* 🔒 BIND SEGURO */
const bind = (id, fn) => {
  const el = document.getElementById(id);
  if (el) el.onclick = fn;
};

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

    const requireKM = () => {
      Modal.showInput(
        'Kilometraje inicial',
        [{ label: 'Kilometraje actual', key: 'km', type: 'number' }],
        (d) => {
          const km = safeFloat(d.km);
          if (km <= 0) return false;
          setUltimoKM(km);
          this.refreshAdmin();
          return true;
        }
      );
    };

    bind('btnConfigKM', () => requireKM());

    bind('btnTurnoIniciar', () => {
      if (!store.parametros.ultimoKM) return requireKM();
      iniciarTurno();
      this.refreshAdmin();
    });

    bind('btnTurnoFinalizar', () => {
      Modal.showInput(
        'Finalizar turno',
        [
          { label: 'KM final', key: 'km', type: 'number', value: store.parametros.ultimoKM },
          { label: 'Ganancia', key: 'gan', type: 'number' }
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
    });

    const gastoWizard = (grupo, cats) => {
      if (!store.parametros.ultimoKM) return requireKM();
      Modal.showInput(
        `Gasto ${grupo}`,
        [
          { label: 'Descripción', key: 'desc', type: 'text' },
          { label: 'Monto', key: 'monto', type: 'number' },
          { label: 'Categoría', key: 'cat', type: 'select',
            options: cats.map(c => ({ value: c, text: c })) },
          { label: 'Frecuencia', key: 'freq', type: 'select',
            options: Object.keys(FRECUENCIAS).map(f => ({ value: f, text: f })) }
        ],
        (d) => {
          procesarGasto(d.desc, d.monto, grupo, d.cat, d.freq);
          this.refreshAdmin();
          return true;
        }
      );
    };

    bind('btnGastoHogar', () => gastoWizard('Hogar', CATEGORIAS.hogar));
    bind('btnGastoOperativo', () => gastoWizard('Operativo', CATEGORIAS.operativo));

    bind('btnGasolina', () => {
      if (!store.parametros.ultimoKM) return requireKM();
      Modal.showInput(
        'Registrar gasolina',
        [
          { label: 'Litros', key: 'l', type: 'number' },
          { label: 'Costo', key: 'c', type: 'number' },
          { label: 'KM actual', key: 'k', type: 'number', value: store.parametros.ultimoKM }
        ],
        (d) => {
          registrarGasolina(d.l, d.c, d.k);
          this.refreshAdmin();
          return true;
        }
      );
    });

    bind('btnDeudaNueva', () => {
      Modal.showInput(
        'Nueva deuda',
        [
          { label: 'Nombre', key: 'desc', type: 'text' },
          { label: 'Total', key: 'total', type: 'number' },
          { label: 'Cuota', key: 'cuota', type: 'number' },
          { label: 'Frecuencia', key: 'freq', type: 'select',
            options: Object.keys(FRECUENCIAS).map(f => ({ value: f, text: f })) }
        ],
        (d) => {
          agregarDeuda(d.desc, d.total, d.cuota, d.freq);
          this.refreshAdmin();
          return true;
        }
      );
    });

    bind('btnExportJSON', () => {
      navigator.clipboard.writeText(JSON.stringify(store));
      alert('JSON copiado');
    });

    bind('btnRestoreBackup', () => {
      Modal.showInput(
        'Restaurar JSON',
        [{ label: 'Pegar JSON', key: 'json', type: 'text' }],
        (d) => importarBackup(d.json) && location.reload()
      );
    });
  },

  updateAdminUI(store) {
    const km = document.getElementById('kmActual');
    if (km) km.innerText = store.parametros.ultimoKM || '—';

    const meta = document.getElementById('metaDiariaValor');
    if (meta) meta.innerText = fmtMoney(store.parametros.metaDiaria);
  },

  refreshAdmin() {
    loadData();
    this.admin(getStore());
  },

  index(store) { renderCharts(store); },
  wallet(store) {},
  historial(store) {}
};

document.addEventListener('DOMContentLoaded', () => App.init());
