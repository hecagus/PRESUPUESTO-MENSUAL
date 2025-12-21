// 03_render.js
import { $, fmtMoney, formatearFecha } from "./01_consts_utils.js";
import { getAdminData } from "./02_data.js";

/* =========================
   MENÚ GLOBAL
========================= */
export const renderGlobalMenu = () => {
  const header = document.querySelector(".header");
  if (!header || document.getElementById("menuToggle")) return;

  const btn = document.createElement("button");
  btn.id = "menuToggle";
  btn.textContent = "☰";
  btn.className = "btn-hamburger";

  const nav = document.createElement("div");
  nav.className = "nav-dropdown";
  nav.innerHTML = `
    <div class="nav-content">
      <a href="index.html">Inicio</a>
      <a href="admin.html">Admin</a>
      <a href="wallet.html">Wallet</a>
      <a href="historial.html">Historial</a>
    </div>
  `;

  header.appendChild(btn);
  header.appendChild(nav);

  btn.addEventListener("click", () => {
    nav.querySelector(".nav-content").classList.toggle("show");
  });
};

/* =========================
   ADMIN (placeholder visual)
========================= */
export const initAdminRender = () => {
  renderGlobalMenu();
  // 🔒 Admin render real se implementa después
};

/* =========================
   HISTORIAL (LECTURA SIMPLE)
========================= */
export const initHistorialRender = () => {
  renderGlobalMenu();

  const tbody = $("historialBody");
  if (!tbody) return;

  const { gastosNetos } = getAdminData();

  tbody.innerHTML = "";

  gastosNetos.forEach(g => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>Gasto</td>
      <td>${formatearFecha(g.fecha)}</td>
      <td>${g.nombre}</td>
      <td>$${fmtMoney(g.monto)}</td>
    `;
    tbody.appendChild(tr);
  });
};
