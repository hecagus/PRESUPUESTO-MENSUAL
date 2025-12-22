/* 05_init.js - LÓGICA CONECTADA Y WIZARDS */
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
  renderGlobalMenu(); // Inyecta el menú inferior

  const page = document.body.dataset.page;

  if (page === "admin") {
    renderAdminUI();

    /* --- EVENTOS DE BOTONES (IDs VERIFICADOS) --- */
    
    // Turnos
    const btnI = $("btnIniciarTurno");
    if(btnI) btnI.onclick = () => {
        const km = prompt("🏎️ KM Inicial:");
        if (km && safeNumber(km) > 0) { iniciarTurno(km); renderAdminUI(); }
    };

    const btnF = $("btnFinalizarTurno");
    if(btnF) btnF.onclick = () => {
        const km = prompt("🏁 KM Final:");
        const g = prompt("💵 Ganancia ($):");
        if (km && g) { finalizarTurno(km, g); renderAdminUI(); }
    };

    // Gasolina
    const btnGas = $("btnWizardGas");
    if(btnGas) btnGas.onclick = () => {
        const l = prompt("⛽ Litros:");
        const c = prompt("💰 Costo ($):");
        const k = prompt("🏎️ KM Actual:");
        if(l && c && k) { registrarGasolina(l, c, k); alert("Registrado"); renderAdminUI(); }
    };

    // Gastos
    const btnGasto = $("btnWizardGasto");
    if(btnGasto) btnGasto.onclick = () => {
        const tipo = prompt("1. Moto\n2. Hogar");
        if(tipo!=="1" && tipo!=="2") return;
        const list = tipo==="1" ? CATEGORIAS_GASTOS.moto : CATEGORIAS_GASTOS.hogar;
        const sel = prompt("Selecciona #:\n" + list.map((c,i)=>`${i+1}. ${c}`).join("\n"));
        const cat = list[sel-1];
        const m = prompt("Monto ($):");
        if(cat && m) { agregarMovimiento("gasto", cat, m, tipo==="1"?"Moto":"Hogar"); renderAdminUI(); }
    };

    // Deudas
    const btnDeuda = $("btnWizardDeuda");
    if(btnDeuda) btnDeuda.onclick = () => {
        const d = prompt("Nombre Deuda:");
        const t = prompt("Total ($):");
        const c = prompt("Cuota ($):");
        if(d && t && c) { agregarDeuda(d, t, c, "Mensual"); renderAdminUI(); }
    };

    // Abonos
    const btnAbono = $("btnRegistrarAbono");
    if(btnAbono) btnAbono.onclick = () => {
        const id = $("abonoSeleccionar").value;
        const m = $("abonoMonto").value;
        if(id && m) { registrarAbono(id, m); $("abonoMonto").value=""; renderAdminUI(); alert("Abono registrado"); }
    };
  }

  if (page === "index") {
    renderDashboard(getDashboardStats());
    initCharts();
  }

  if (page === "historial") renderHistorial();
  if (page === "wallet") renderWallet();
});

