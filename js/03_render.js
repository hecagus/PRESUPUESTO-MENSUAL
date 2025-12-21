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
   UTILIDADES UI
========================= */
const show = (el) => { if (el) el.style.display = ""; };
const hide = (el) => { if (el) el.style.display = "none"; };

/* =========================
   MENÚ GLOBAL
========================= */
export const renderGlobalMenu = () => {
  const header = document.querySelector(".header");
  if (!header) return;

  if (document.getElementById("menuToggle")) return;

  const btn = document.createElement("button");
  btn.id = "menuToggle";
  btn.className = "menu-toggle";
  btn.textContent = "☰";

  const nav = document.createElement("nav");
  nav.id = "navMenu";
  nav.className = "nav-menu";
  nav.innerHTML = `
    <a href="index.html">Inicio</a>
    <a href="admin.html">Admin</a>
    <a href="wallet.html">Wallet</a>
    <a href="historial.html" class="active">Historial</a>
  `;

  header.appendChild(btn);
  header.appendChild(nav);

  btn.addEventListener("click", () => {
    nav.classList.toggle("active");
  });
};

/* =========================
   ADMIN – TURNO
========================= */
export const renderTurnoUI = () => {
  const turnoTexto = $("turnoTexto");
  const btnIniciar = $("btnIniciarTurno");
  const btnFinalizar = $("btnFinalizarTurno");
  const cierre = $("cierreTurnoContainer");
  if (!turnoTexto || !btnIniciar || !btnFinalizar) return;

  const activo = getTurnoActivo();
  if (activo) {
    turnoTexto.textContent = "🟢 Turno en curso";
    hide(btnIniciar); show(btnFinalizar); show(cierre);
  } else {
    turnoTexto.textContent = "🔴 Sin turno activo";
    show(btnIniciar); hide(btnFinalizar); hide(cierre);
  }
};

export const setupTurnoListeners = () => {
  $("btnIniciarTurno")?.addEventListener("click", () => {
    iniciarTurno(); renderTurnoUI();
  });
  $("btnFinalizarTurno")?.addEventListener("click", () => {
    show($("cierreTurnoContainer"));
  });
  $("btnGuardarCierre")?.addEventListener("click", () => {
    finalizarTurno($("inpGanancia")?.value, $("inpKmFinal")?.value);
    renderTurnoUI();
  });
};

/* =========================
   ADMIN – DEUDAS
========================= */
export const renderDeudas = () => {
  const lista = $("listaDeudas");
  const selector = $("abonoSeleccionar");
  if (!lista || !selector) return;

  lista.innerHTML = "";
  selector.innerHTML = "";

  getState().deudas.forEach((d, i) => {
    const li = document.createElement("li");
    li.textContent = `${d.desc} — $${fmtMoney(d.saldo)}`;
    lista.appendChild(li);

    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = d.desc;
    selector.appendChild(opt);
  });
};

export const setupDeudaListeners = () => {
  $("btnRegistrarDeudaFinal")?.addEventListener("click", () => {
    agregarDeuda({
      desc: $("deudaNombre")?.value,
      saldo: $("deudaMontoTotal")?.value,
      montoCuota: $("deudaMontoCuota")?.value,
      frecuencia: $("deudaFrecuencia")?.value
    });
    renderDeudas();
  });
};

/* =========================
   HISTORIAL
========================= */
export const renderHistorial = () => {
  const tbody = $("historialBody");
  const resumen = $("historialResumen");
  if (!tbody) return;

  const { movimientos } = getState();
  tbody.innerHTML = "";

  let ingresos = 0, gastos = 0;

  movimientos
    .slice()
    .reverse()
    .forEach(m => {
      const tr = document.createElement("tr");

      const tipo = m.tipo === "ingreso" ? "Ingreso" : "Gasto";
      if (m.tipo === "ingreso") ingresos += Number(m.monto || 0);
      else gastos += Number(m.monto || 0);

      tr.innerHTML = `
        <td>${tipo}</td>
        <td>${formatearFecha(m.fecha)}</td>
        <td>${m.desc || m.categoria || "-"}</td>
        <td>$${fmtMoney(m.monto)}</td>
      `;
      tbody.appendChild(tr);
    });

  if (resumen) {
    resumen.textContent = `Ingresos: $${fmtMoney(ingresos)} · Gastos: $${fmtMoney(gastos)} · Neto: $${fmtMoney(ingresos - gastos)}`;
  }
};

/* =========================
   INIT POR PÁGINA
========================= */
export const initAdminRender = () => {
  renderGlobalMenu();
  renderTurnoUI();
  renderDeudas();
  setupTurnoListeners();
  setupDeudaListeners();
};

export const initHistorialRender = () => {
  renderGlobalMenu();
  renderHistorial();
};
