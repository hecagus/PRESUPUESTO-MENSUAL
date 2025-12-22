/* 05_init.js - FUENTE DE VERDAD CORREGIDA */
import {
  loadData,
  iniciarTurno,
  finalizarTurno,
  registrarGasolina,
  agregarMovimiento,
  agregarDeuda,
  registrarAbono,
  getDashboardStats
} from "./02_data.js";

import {
  renderGlobalMenu,
  renderAdminUI,
  renderDashboard,
  renderHistorial,
  renderWallet
} from "./03_render.js";

import { initCharts } from "./04_charts.js";
import { $, CATEGORIAS_GASTOS, safeNumber } from "./01_consts_utils.js";

document.addEventListener("DOMContentLoaded", () => {
  loadData();
  renderGlobalMenu();

  const page = document.body.dataset.page;

  if (page === "admin") {
    renderAdminUI();

    // --- LOGICA DE BOTONES ---

    // 1. Turnos (Estos IDs sí coincidían, están OK)
    const btnIniciar = $("btnIniciarTurno");
    if (btnIniciar) {
        btnIniciar.onclick = () => {
          const km = prompt("🏎️ KM inicial del tablero:");
          // Validación estricta para no iniciar con cancel o vacío
          if (km !== null && safeNumber(km) > 0) {
            iniciarTurno(km);
            renderAdminUI();
          } else if (km !== null) {
            alert("❌ El KM debe ser mayor a 0");
          }
        };
    }

    const btnFinalizar = $("btnFinalizarTurno");
    if (btnFinalizar) {
        btnFinalizar.onclick = () => {
          const km = prompt("🏁 KM final del tablero:");
          if (km === null) return; // Cancelado
          const g = prompt("💵 Ganancia Total ($):");
          if (g === null) return; // Cancelado

          if (safeNumber(km) > 0 && safeNumber(g) >= 0) {
            finalizarTurno(km, g);
            renderAdminUI();
          } else {
            alert("❌ Datos inválidos");
          }
        };
    }

    // 2. Gasolina (CORREGIDO: btnGas -> btnWizardGas)
    const btnGas = $("btnWizardGas");
    if (btnGas) {
        btnGas.onclick = () => {
          const l = prompt("⛽ Litros cargados:");
          if (!l) return;
          const c = prompt("💰 Costo Total ($):");
          if (!c) return;
          const k = prompt("🏎️ KM Actual:");
          if (!k) return;

          if (safeNumber(l) > 0 && safeNumber(c) > 0 && safeNumber(k) > 0) {
            registrarGasolina(l, c, k);
            alert("✅ Gasolina registrada");
            renderAdminUI();
          } else {
            alert("❌ Datos numéricos inválidos");
          }
        };
    }

    // 3. Gastos (CORREGIDO: btnGasto -> btnWizardGasto)
    const btnGasto = $("btnWizardGasto");
    if (btnGasto) {
        btnGasto.onclick = () => {
          const tipo = prompt("Tipo:\n1. 🛵 Moto\n2. 🏠 Hogar");
          if (tipo !== "1" && tipo !== "2") return;
          
          const list = tipo === "1" ? CATEGORIAS_GASTOS.moto : CATEGORIAS_GASTOS.hogar;
          const sel = prompt("Selecciona #:\n" + list.map((c, i) => `${i + 1}. ${c}`).join("\n"));
          const cat = list[sel - 1];
          
          if (!cat) return alert("❌ Opción inválida");
          
          const m = prompt(`💰 Monto para ${cat}:`);
          if (m && safeNumber(m) > 0) {
            agregarMovimiento("gasto", cat, m, tipo === "1" ? "Moto" : "Hogar");
            renderAdminUI();
          }
        };
    }

    // 4. Deudas (CORREGIDO: btnDeuda -> btnWizardDeuda)
    const btnDeuda = $("btnWizardDeuda");
    if (btnDeuda) {
        btnDeuda.onclick = () => {
          const d = prompt("📝 Nombre de la Deuda:");
          if (!d) return;
          const t = prompt("💰 Total a pagar ($):");
          if (!t) return;
          const c = prompt("📅 Cuota mensual ($):");
          
          if (safeNumber(t) > 0 && safeNumber(c) > 0) {
            agregarDeuda(d, t, c, "Mensual");
            renderAdminUI();
          } else {
             alert("❌ Montos inválidos");
          }
        };
    }

    // 5. Abonos (Este estaba OK)
    const btnAbono = $("btnRegistrarAbono");
    if (btnAbono) {
        btnAbono.onclick = () => {
          const elSelect = $("abonoSeleccionar");
          const elMonto = $("abonoMonto");
          
          if (!elSelect || !elMonto) return;

          const id = elSelect.value;
          const m = safeNumber(elMonto.value);
          
          if (id && m > 0) {
            registrarAbono(id, m);
            elMonto.value = "";
            renderAdminUI();
            alert("✅ Abono registrado");
          } else {
            alert("❌ Selecciona deuda y monto mayor a 0");
          }
        };
    }
  }

  if (page === "index") {
    renderDashboard(getDashboardStats());
    initCharts();
  }

  if (page === "historial") renderHistorial();
  if (page === "wallet") renderWallet();
});
