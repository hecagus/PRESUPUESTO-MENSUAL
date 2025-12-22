/* 05_init.js */
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

    // --- LOGICA DE BOTONES (IDs Coincidentes con HTML) ---

    // 1. Turnos
    $("btnIniciarTurno").onclick = () => {
      const km = prompt("🏎️ KM inicial del tablero:");
      if (km !== null && safeNumber(km) > 0) {
        iniciarTurno(km);
        renderAdminUI();
      } else if (km !== null) {
        alert("❌ El KM debe ser mayor a 0");
      }
    };

    $("btnFinalizarTurno").onclick = () => {
      const km = prompt("🏁 KM final del tablero:");
      const g = prompt("💵 Ganancia Total ($):");
      if (km && g) {
        finalizarTurno(km, g);
        renderAdminUI();
      }
    };

    // 2. Gasolina (ID: btnWizardGas)
    if ($("btnWizardGas")) {
        $("btnWizardGas").onclick = () => {
          const l = prompt("⛽ Litros cargados:");
          const c = prompt("💰 Costo Total ($):");
          const k = prompt("🏎️ KM Actual:");
          
          if (l && c && k) {
            registrarGasolina(l, c, k);
            alert("✅ Gasolina registrada");
            renderAdminUI();
          }
        };
    }

    // 3. Gastos (ID: btnWizardGasto)
    if ($("btnWizardGasto")) {
        $("btnWizardGasto").onclick = () => {
          const tipo = prompt("Tipo:\n1. 🛵 Moto\n2. 🏠 Hogar");
          if (tipo !== "1" && tipo !== "2") return;
          
          const list = tipo === "1" ? CATEGORIAS_GASTOS.moto : CATEGORIAS_GASTOS.hogar;
          const sel = prompt("Selecciona #:\n" + list.map((c, i) => `${i + 1}. ${c}`).join("\n"));
          const cat = list[sel - 1];
          
          if (!cat) return alert("❌ Opción inválida");
          
          const m = prompt(`💰 Monto para ${cat}:`);
          if (m) {
            agregarMovimiento("gasto", cat, m, tipo === "1" ? "Moto" : "Hogar");
            renderAdminUI();
          }
        };
    }

    // 4. Deudas (ID: btnWizardDeuda)
    if ($("btnWizardDeuda")) {
        $("btnWizardDeuda").onclick = () => {
          const d = prompt("📝 Nombre de la Deuda:");
          const t = prompt("💰 Total a pagar ($):");
          const c = prompt("📅 Cuota mensual ($):");
          
          if (d && t && c) {
            agregarDeuda(d, t, c, "Mensual");
            renderAdminUI();
          }
        };
    }

    // 5. Abonos
    $("btnRegistrarAbono").onclick = () => {
      const id = $("abonoSeleccionar").value;
      const m = safeNumber($("abonoMonto").value);
      if (id && m > 0) {
        registrarAbono(id, m);
        $("abonoMonto").value = "";
        renderAdminUI();
        alert("✅ Abono registrado");
      } else {
        alert("❌ Selecciona una deuda y un monto válido");
      }
    };
  }

  if (page === "index") {
    renderDashboard(getDashboardStats());
    initCharts();
  }

  if (page === "historial") renderHistorial();
  if (page === "wallet") renderWallet();
});
