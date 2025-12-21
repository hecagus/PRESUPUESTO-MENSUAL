// 03_render.js
import { $ } from "./01_consts_utils.js";

/* =========================
   MENÚ GLOBAL
========================= */
export const renderGlobalMenu = () => {
  const header = document.querySelector(".header");
  if (!header || document.getElementById("menuToggle")) return;

  const btn = document.createElement("button");
  btn.id = "menuToggle";
  btn.textContent = "☰";

  const nav = document.createElement("nav");
  nav.className = "menu";
  nav.innerHTML = `
    <a href="index.html">Inicio</a>
    <a href="admin.html">Admin</a>
    <a href="wallet.html">Wallet</a>
    <a href="historial.html">Historial</a>
  `;

  header.appendChild(btn);
  header.appendChild(nav);

  btn.addEventListener("click", () => {
    nav.classList.toggle("show");
  });
};

/* =========================
   GESTIÓN DE TURNO (UI)
========================= */
export const initAdminRender = () => {
  renderGlobalMenu();

  const turnoTexto = $("turnoTexto");
  const btnIniciar = $("btnIniciarTurno");
  const btnFinalizar = $("btnFinalizarTurno");
  const cierre = $("cierreTurno");

  if (!turnoTexto || !btnIniciar || !btnFinalizar) return;

  let turnoActivo = false;

  btnIniciar.addEventListener("click", () => {
    turnoActivo = true;
    turnoTexto.textContent = "🟢 Turno en curso";
  });

  btnFinalizar.addEventListener("click", () => {
    if (!turnoActivo) return;
    cierre.style.display = "block";
  });
};
