// 03_render.js
import { $, fmtMoney, formatearFecha } from "./01_consts_utils.js";
import {
  getState,
  getTurnoActivo,
  iniciarTurno,
  finalizarTurno,
  agregarGasto,
  agregarDeuda
} from "./02_data.js";

/* =========================
   UTILIDADES
========================= */
const show = el => el && (el.style.display = "");
const hide = el => el && (el.style.display = "none");

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
   META DIARIA
========================= */
export const renderMetaDiaria = () => {
  const metaEl = $("metaDiaria");
  const fijosEl = $("totalFijosMensual");
  if (!metaEl || !fijosEl) return;

  const { gastosFijosMensuales, parametros } = getState();

  const totalFijos = gastosFijosMensuales.reduce(
    (acc, g) => acc + Number(g.monto || 0),
    0
  );

  metaEl.textContent = `$${fmtMoney(parametros.gastoFijo)}`;
  fijosEl.textContent = `$${fmtMoney(totalFijos)}`;
};

/* =========================
   TURNO
========================= */
export const renderTurnoUI = () => {
  const activo = getTurnoActivo();
  const txt = $("turnoTexto");
  if (!txt) return;

  txt.textContent = activo
    ? "🟢 Turno en curso"
    : "🔴 Sin turno activo";
};

/* =========================
   DEUDAS
========================= */
export const renderDeudas = () => {
  const lista = $("listaDeudas");
  const sel = $("abonoSeleccionar");
  if (!lista || !sel) return;

  lista.innerHTML = "";
  sel.innerHTML = "";

  getState().deudas.forEach((d, i) => {
    const li = document.createElement("li");
    li.textContent = `${d.desc} — $${fmtMoney(d.saldo)}`;
    lista.appendChild(li);

    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = d.desc;
    sel.appendChild(opt);
  });
};

/* =========================
   INIT ADMIN
========================= */
export const initAdminRender = () => {
  renderGlobalMenu();
  renderTurnoUI();
  renderDeudas();
  renderMetaDiaria();
};
