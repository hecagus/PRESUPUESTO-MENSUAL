// 03_render.js
import { $ } from "./01_consts_utils.js";
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

  const nav = document.createElement("nav");
  nav.id = "globalMenu";
  nav.className = "menu hidden";
  nav.innerHTML = `
    <a href="index.html">Inicio</a>
    <a href="admin.html">Admin</a>
    <a href="wallet.html">Wallet</a>
    <a href="historial.html">Historial</a>
  `;

  header.appendChild(btn);
  document.body.appendChild(nav);

  btn.addEventListener("click", e => {
    e.stopPropagation();
    nav.classList.toggle("hidden");
  });

  document.addEventListener("click", () => nav.classList.add("hidden"));
};

/* =========================
   ADMIN RENDER
========================= */
export const initAdminRender = () => {
  renderGlobalMenu();

  let turnoActivo = false;

  $("btnIniciarTurno")?.addEventListener("click", () => {
    turnoActivo = true;
    $("turnoTexto").textContent = "🟢 Turno en curso";
  });

  $("btnFinalizarTurno")?.addEventListener("click", () => {
    if (!turnoActivo) return;
    $("cierreTurno").style.display = "block";
  });

  $("btnGuardarTurno")?.addEventListener("click", () => {
    turnoActivo = false;
    $("cierreTurno").style.display = "none";
    $("turnoTexto").textContent = "🔴 Sin turno activo";
  });

  // Poblar selector de deudas para abonos
  const select = $("abonoDeudaSelect");
  if (select) {
    select.innerHTML = `<option value="">-- Selecciona --</option>`;
    const { deudas } = getAdminData();
    deudas.forEach(d => {
      const opt = document.createElement("option");
      opt.value = d.id;
      opt.textContent = d.nombre;
      select.appendChild(opt);
    });
  }

  // Botones vivos (eventos reales, lógica después)
  [
    "btnGuardarKmInicial",
    "btnGuardarIngresoExtra",
    "btnGuardarGasto",
    "btnGuardarGasolina",
    "btnGuardarDeuda",
    "btnRegistrarAbono",
    "btnExportarJSON",
    "btnImportarJSON"
  ].forEach(id => {
    $(id)?.addEventListener("click", () =>
      console.log(`✔ Evento capturado: ${id}`)
    );
  });
};

/* =========================
   HISTORIAL
========================= */
export const initHistorialRender = () => {
  renderGlobalMenu();
};
