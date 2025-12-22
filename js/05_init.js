/* 05_init.js - LÓGICA DE INTERACCIÓN FINAL */
import {
  loadData,
  getState,
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
  renderDashboard
} from "./03_render.js";

import { initCharts } from "./04_charts.js";
import { $, CATEGORIAS_GASTOS, safeNumber } from "./01_consts_utils.js";

/* =========================
   WIZARDS (SIN RELOAD)
   ========================= */

const wizardIniciarTurno = () => {
  const km = prompt("🏎️ Kilometraje inicial:");
  if (km === null) return; // Usuario canceló
  const n = safeNumber(km);
  if (n <= 0) return alert("KM inválido. Debe ser mayor a 0.");
  
  iniciarTurno(n);
  renderAdminUI(); // Refresco inmediato
};

const wizardFinalizarTurno = () => {
  const km = prompt("🏁 Kilometraje final:");
  if (km === null) return;
  const gan = prompt("💵 Ganancia total del turno ($):");
  if (gan === null) return;

  const kmF = safeNumber(km);
  const g = safeNumber(gan);
  
  // Validaciones básicas
  if (kmF <= 0) return alert("Kilometraje inválido");
  if (g < 0) return alert("La ganancia no puede ser negativa");

  finalizarTurno(kmF, g);
  renderAdminUI();
};

const wizardGasolina = () => {
  const litros = prompt("⛽ Litros cargados:");
  if (litros === null) return;
  const costo = prompt("💰 Costo total ($):");
  if (costo === null) return;

  const prevKM = getState().parametros.ultimoKM || 0;
  const km = prompt(`🏎️ KM actual (Anterior: ${prevKM}):`);
  if (km === null) return;

  const l = safeNumber(litros);
  const c = safeNumber(costo);
  const k = safeNumber(km);

  if (l <= 0 || c <= 0) return alert("Litros o costo inválidos");
  if (k <= prevKM) return alert(`El KM actual (${k}) debe ser mayor al anterior (${prevKM})`);

  // El cálculo interno se hace en data.js, pero aquí validamos la lógica visual
  registrarGasolina(l, c, k);
  alert("✅ Carga registrada correctamente");
  
  renderAdminUI();
};

const wizardGasto = () => {
  const tipo = prompt("Tipo de gasto:\n1. 🛵 Moto (Operativo)\n2. 🏠 Hogar (Personal)");
  if (tipo !== "1" && tipo !== "2") return;

  const lista = tipo === "1" ? CATEGORIAS_GASTOS.moto : CATEGORIAS_GASTOS.hogar;
  let menu = "Selecciona categoría (número):\n";
  lista.forEach((c, i) => (menu += `${i + 1}. ${c}\n`));

  const sel = prompt(menu);
  const cat = lista[parseInt(sel) - 1];
  if (!cat) return alert("Categoría inválida");

  const monto = prompt(`💰 Monto para ${cat}:`);
  if (monto === null) return;

  const m = safeNumber(monto);
  if (m <= 0) return alert("Monto inválido");

  agregarMovimiento("gasto", cat, m, tipo === "1" ? "Moto" : "Hogar");
  renderAdminUI();
};

const wizardDeuda = () => {
  const desc = prompt("📝 Nombre de la deuda:");
  if (!desc) return;

  const total = prompt("💰 Total de la deuda ($):");
  if (total === null) return;

  const cuota = prompt("📅 Monto de la cuota ($):");
  if (cuota === null) return;

  const f = prompt("Frecuencia:\n1. Semanal\n2. Quincenal\n3. Mensual") || "3";
  const freqs = ["", "Semanal", "Quincenal", "Mensual"];

  agregarDeuda(desc, total, cuota, freqs[parseInt(f)]);
  renderAdminUI();
};

/* =========================
   INIT (ARRANQUE)
   ========================= */

document.addEventListener("DOMContentLoaded", () => {
  // 1. Cargar datos
  loadData();
  
  // 2. Renderizar menú global (Header)
  renderGlobalMenu();

  const page = document.body.dataset.page;

  // 3. Lógica específica por página
  if (page === "admin") {
    renderAdminUI(); // Estado inicial

    // Listeners con Wizards Inteligentes
    $("btnIniciarTurno")?.addEventListener("click", wizardIniciarTurno);
    $("btnFinalizarTurno")?.addEventListener("click", wizardFinalizarTurno);
    $("btnGas")?.addEventListener("click", wizardGasolina);
    $("btnGasto")?.addEventListener("click", wizardGasto);
    $("btnDeuda")?.addEventListener("click", wizardDeuda);

    $("btnRegistrarAbono")?.addEventListener("click", () => {
      const id = $("abonoSeleccionar")?.value;
      const m = safeNumber($("abonoMonto")?.value);
      
      if (!id) return alert("Selecciona una deuda");
      if (m <= 0) return alert("Monto inválido");
      
      registrarAbono(id, m);
      $("abonoMonto").value = ""; // Limpiar input
      renderAdminUI();
    });
  }

  if (page === "index") {
    renderDashboard(getDashboardStats());
    initCharts();
  }
});
