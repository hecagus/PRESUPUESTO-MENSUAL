import { loadData } from "./02_data.js";
import { renderDashboard, renderWalletUI, renderHistorialUI } from "./03_render.js";
import { initCharts } from "./04_charts.js";

document.addEventListener("DOMContentLoaded", () => {
  loadData();

  const page = document.body.dataset.page;

  if (page === "index") {
    renderDashboard();
    initCharts();
  }
  if (page === "wallet") renderWalletUI();
  if (page === "historial") renderHistorialUI();
});
