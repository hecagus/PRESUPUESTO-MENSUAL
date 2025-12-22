import { loadData, getState, iniciarTurno, finalizarTurno, registrarGasolina, agregarMovimiento, agregarDeuda, registrarAbono, getDashboardStats } from "./02_data.js";
import { renderGlobalMenu, renderAdminUI, renderDashboard } from "./03_render.js";
import { initCharts } from "./04_charts.js";
import { $, CATEGORIAS_GASTOS } from "./01_consts_utils.js";

// --- WIZARDS (VENTANAS DE PREGUNTA) ---
const wizardGas = () => {
    const l = prompt("⛽ Litros:"); if(!l) return;
    const c = prompt("💰 Costo Total ($):"); if(!c) return;
    const km = prompt(`🏎️ KM Actual (Anterior: ${getState().parametros.ultimoKM}):`); if(!km) return;
    registrarGasolina(l, c, km);
    alert("✅ Gasolina registrada");
    window.location.reload();
};

const wizardGasto = () => {
    const tipo = prompt("1. 🛵 Moto\n2. 🏠 Hogar");
    if(tipo !== "1" && tipo !== "2") return;
    const catList = tipo === "1" ? CATEGORIAS_GASTOS.moto : CATEGORIAS_GASTOS.hogar;
    
    let txt = "Elige #:\n";
    catList.forEach((c, i) => txt += `${i+1}. ${c}\n`);
    const sel = prompt(txt);
    const cat = catList[parseInt(sel)-1];
    
    if(!cat) return alert("Opción inválida");
    const monto = prompt(`💰 Monto para ${cat}:`);
    if(!monto) return;

    agregarMovimiento("gasto", cat, monto, tipo === "1" ? "Moto" : "Hogar");
    alert("✅ Gasto registrado");
    window.location.reload();
};

const wizardDeuda = () => {
    const d = prompt("Nombre Deuda:"); if(!d) return;
    const t = prompt("Total a pagar ($):"); if(!t) return;
    const c = prompt("Cuota de pago ($):"); if(!c) return;
    const f = prompt("Frecuencia:\n1. Semanal\n2. Quincenal\n3. Mensual") || "3";
    const freqs = ["", "Semanal", "Quincenal", "Mensual"];
    agregarDeuda(d, t, c, freqs[parseInt(f)]);
    alert("✅ Deuda agregada");
    window.location.reload();
};

// --- INICIO ---
document.addEventListener("DOMContentLoaded", () => {
  loadData();
  renderGlobalMenu();

  const page = document.body.dataset.page;

  if (page === "admin") {
    renderAdminUI();
    
    $("btnIniciarTurno")?.addEventListener("click", () => {
        const km = prompt("🏎️ KM Inicial:");
        if(km) { iniciarTurno(km); renderAdminUI(); }
    });

    $("btnFinalizarTurno")?.addEventListener("click", () => {
        const km = prompt("🏁 KM Final:");
        const gan = prompt("💵 Ganancia del día:");
        if(km && gan) { finalizarTurno(km, gan); renderAdminUI(); }
    });

    $("btnGas")?.addEventListener("click", wizardGas);
    $("btnGasto")?.addEventListener("click", wizardGasto);
    $("btnDeuda")?.addEventListener("click", wizardDeuda);
    
    $("btnRegistrarAbono")?.addEventListener("click", () => {
        const id = $("abonoSeleccionar").value;
        const m = $("abonoMonto").value;
        if(id && m) { registrarAbono(id, m); alert("✅ Abono registrado"); window.location.reload(); }
    });
  }

  if (page === "index") {
      renderDashboard(getDashboardStats());
      initCharts();
  }
});
