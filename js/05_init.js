import {
  loadData, getState, getDashboardStats, getAdminStats, getWalletStats,
  iniciarTurno, finalizarTurno, registrarGasolina,
  agregarMovimiento, agregarGastoRecurrente, registrarAbono
} from './02_data.js';

import * as Render from './03_render.js';
import { CATEGORIAS_GASTOS, $ } from './01_consts_utils.js';
import { initCharts } from './04_charts.js';

let eventsBound = false;

/* REFRESH ÚNICO */
const refreshUI = () => {
  const page = document.body.dataset.page;
  if (page === "index") {
    Render.renderDashboard(getDashboardStats());
    initCharts();
  }
  if (page === "admin") {
    const s = getAdminStats();
    Render.renderTurnoControl(s.turnoActivo);
    Render.renderMetaDiaria(s.metaDiaria);
    Render.renderAdminLists(s.deudas);
  }
  if (page === "wallet") Render.renderWalletUI(getWalletStats());
  if (page === "historial") Render.renderHistorial(getState().movimientos);
};

/* EVENTOS ADMIN — UNA SOLA VEZ */
const bindAdminEvents = () => {
  if (eventsBound) return;
  eventsBound = true;

  if ($("btnIniciarTurno"))
    $("btnIniciarTurno").onclick = () => {
      const km = prompt("KM Inicial:", getState().parametros.ultimoKMfinal || 0);
      if (km) { iniciarTurno(km); refreshUI(); }
    };

  if ($("btnFinalizarTurno"))
    $("btnFinalizarTurno").onclick = () => {
      const km = prompt("KM Final:");
      const g = prompt("Ganancia:");
      if (km && g) { finalizarTurno(km, g); refreshUI(); }
    };

  if ($("btnRegistrarAbono"))
    $("btnRegistrarAbono").onclick = () => {
      const id = $("abonoSeleccionar").value;
      const m = $("abonoMonto").value;
      if (id && m) { registrarAbono(id, m); refreshUI(); }
    };
};

/* INIT */
document.addEventListener("DOMContentLoaded", () => {
  loadData();
  Render.renderGlobalMenu();
  refreshUI();
  if (document.body.dataset.page === "admin") bindAdminEvents();
});
