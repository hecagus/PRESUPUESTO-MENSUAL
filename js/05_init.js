/* 05_init.js (SIN DEPENDER DEL HEADER PARA BOTONES) */
import {
  loadData,
  getDashboardStats
} from "./02_data.js";

import {
  renderAdminUI,
  renderDashboard,
  renderHistorial,
  renderWallet
} from "./03_render.js";

import { initCharts } from "./04_charts.js";

document.addEventListener("DOMContentLoaded", () => {
  loadData();

  const page = document.body.dataset.page;

  if (page === "index") {
    renderDashboard(getDashboardStats());
    initCharts();
  }

  if (page === "admin") renderAdminUI();
  if (page === "historial") renderHistorial();
  if (page === "wallet") renderWallet();
});
