import { loadData } from "./02_data.js";
import { renderDashboard, renderWalletUI, renderHistorialUI } from "./03_render.js";
import { initCharts } from "./04_charts.js";

document.addEventListener("DOMContentLoaded", () => {
  loadData();

  setupHamburgerMenu(); // 👈 FIX CRÍTICO

  const page = document.body.dataset.page;

  if (page === "index") {
    renderDashboard();
    initCharts();
  }

  if (page === "wallet") {
    renderWalletUI();
  }

  if (page === "historial") {
    renderHistorialUI();
  }
});

/* ================================
   MENÚ HAMBURGUESA (GLOBAL)
   ================================ */
function setupHamburgerMenu() {
  const btn = document.querySelector(".menu-toggle");
  const menu = document.querySelector(".nav-menu");

  if (!btn || !menu) return;

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    menu.classList.toggle("active");
  });

  // Cerrar al tocar fuera
  document.addEventListener("click", () => {
    menu.classList.remove("active");
  });
}
