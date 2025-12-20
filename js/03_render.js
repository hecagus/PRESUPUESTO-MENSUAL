// 03_render.js
import { $, fmtMoney } from "./01_consts_utils.js";
import {
  getState,
  getTurnoActivo,
  iniciarTurno,
  finalizarTurno,
  agregarGasto,
  agregarDeuda,
  getWalletData
} from "./02_data.js";

/* =========================
   UTILIDADES UI
========================= */
const show = (el) => { if (el) el.style.display = ""; };
const hide = (el) => { if (el) el.style.display = "none"; };

/* =========================
   MENÚ GLOBAL (HAMBURGUESA)
========================= */
export const renderGlobalMenu = () => {
  const header = document.querySelector(".header");
  if (!header) return;

  // Evitar duplicado
  if (document.getElementById("globalMenu")) return;

  const menuBtn = document.createElement("button");
  menuBtn.id = "menuToggle";
  menuBtn.className = "menu-toggle";
  menuBtn.textContent = "☰";

  const menu = document.createElement("nav");
  menu.id = "globalMenu";
  menu.className = "menu hidden";
  menu.innerHTML = `
    <a href="index.html">🏠 Inicio</a>
    <a href="admin.html">⚙️ Admin</a>
    <a href="wallet.html">💵 Wallet</a>
    <a href="historial.html">📜 Historial</a>
  `;

  header.appendChild(menuBtn);
  document.body.appendChild(menu);

  menuBtn.addEventListener("click", () => {
    menu.classList.toggle("hidden");
  });

  // Cerrar al hacer click fuera
  document.addEventListener("click", (e) => {
    if (!menu.contains(e.target) && e.target !== menuBtn) {
      menu.classList.add("hidden");
    }
  });
};

/* =========================
   TURNO
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
    hide(btnIniciar);
    show(btnFinalizar);
    show(cierre);
  } else {
    turnoTexto.textContent = "🔴 Sin turno activo";
    show(btnIniciar);
    hide(btnFinalizar);
    hide(cierre);
  }
};

export const setupTurnoListeners = () => {
  $("btnIniciarTurno")?.addEventListener("click", () => {
    iniciarTurno();
    renderTurnoUI();
  });

  $("btnFinalizarTurno")?.addEventListener("click", () => {
    show($("cierreTurnoContainer"));
  });

  $("btnGuardarCierre")?.addEventListener("click", () => {
    finalizarTurno(
      $("inpGanancia")?.value,
      $("inpKmFinal")?.value
    );
    renderTurnoUI();
  });
};

/* =========================
   DEUDAS (ADMIN)
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
   INIT ADMIN
========================= */
export const initAdminRender = () => {
  renderGlobalMenu();
  renderTurnoUI();
  renderDeudas();
  setupTurnoListeners();
  setupDeudaListeners();
};
