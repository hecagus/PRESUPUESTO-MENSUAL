/* 05_init.js */
import { 
    loadData, getState, getDashboardStats, getAdminStats, getWalletStats,
    iniciarTurno, finalizarTurno, registrarGasolina, 
    agregarMovimiento, agregarGastoRecurrente, registrarAbono 
} from './02_data.js';
import * as Render from './03_render.js';
import { CATEGORIAS_GASTOS, $ } from './01_consts_utils.js';
import { initCharts } from './04_charts.js';

const refreshUI = () => {
    const page = document.body.getAttribute('data-page');
    const s = getState();
    
    if (page === 'index') {
        const stats = getDashboardStats();
        Render.renderDashboard(stats);
        if (typeof initCharts === 'function') initCharts();
    } else if (page === 'admin') {
        const stats = getAdminStats();
        Render.renderTurnoControl(stats.turnoActivo);
        Render.renderMetaDiaria(stats.metaDiaria);
        Render.renderAdminLists(stats.deudas);
    } else if (page === 'wallet') {
        Render.renderWalletUI(getWalletStats());
    } else if (page === 'historial') {
        Render.renderHistorial(s.movimientos);
    }
};

// --- WIZARDS ---
const wizardGasolina = () => {
    const litros = prompt("⛽ Litros cargados:");
    if (!litros) return;
    const costo = prompt("💰 Costo Total ($):");
    if (!costo) return;
    const ultimoKM = getState().parametros.ultimoKMfinal || 0;
    const km = prompt(`🏎️ KM Actual del tablero (Anterior: ${ultimoKM}):`, ultimoKM);
    if (!km) return;

    registrarGasolina(litros, costo, km);
    alert("✅ Gasolina registrada");
    refreshUI();
};

const wizardGastoInteligente = () => {
    const tipo = prompt("1. 🛵 MOTO\n2. 🏠 HOGAR");
    if(tipo !== "1" && tipo !== "2") return;
    
    const lista = tipo === "1" ? CATEGORIAS_GASTOS.moto : CATEGORIAS_GASTOS.hogar;
    let menu = "Elige #:\n";
    lista.forEach((c, i) => menu += `${i+1}. ${c}\n`);
    const sel = prompt(menu);
    const catDesc = lista[parseInt(sel)-1];
    if (!catDesc) return;
    
    const monto = prompt(`Monto para ${catDesc} ($):`);
    if (!monto) return;

    if (confirm("¿Es Gasto Recurrente (Fijo)?")) {
        const fSel = prompt("1. Semanal\n2. Quincenal\n3. Mensual");
        const freqs = ["", "Semanal", "Quincenal", "Mensual"];
        const frecuencia = freqs[fSel] || "Mensual";
        const dia = prompt("Día de pago:");
        agregarGastoRecurrente(catDesc, monto, frecuencia, dia);
    }
    agregarMovimiento('gasto', catDesc, monto, tipo==="1"?'Moto':'Hogar');
    refreshUI();
};

const bindEvents = () => {
    const btnI = $("btnIniciarTurno");
    if (btnI) btnI.onclick = () => {
        const km = prompt("KM Inicial:", getState().parametros.ultimoKMfinal || 0);
        if (km) { iniciarTurno(km); refreshUI(); }
    };
    const btnF = $("btnFinalizarTurno");
    if (btnF) btnF.onclick = () => {
        const km = prompt("KM Final:");
        const gan = prompt("Ganancia ($):");
        if (km && gan) { finalizarTurno(km, gan); alert("Turno cerrado"); refreshUI(); }
    };
    const btnA = $("btnRegistrarAbono");
    if (btnA) btnA.onclick = () => {
        const id = $("abonoSeleccionar").value;
        const m = $("abonoMonto").value;
        if(id && m) { registrarAbono(id, m); alert("Abonado"); refreshUI(); }
    };

    // Wizard Injection
    const cardTurnos = document.getElementById("cardTurnos");
    if (cardTurnos && !document.getElementById("btnWizardGas")) {
        const div = document.createElement("div");
        div.style.marginTop = "15px";
        div.style.display = "grid";
        div.style.gridTemplateColumns = "1fr 1fr";
        div.style.gap = "10px";
        div.innerHTML = `
            <button id="btnWizardGas" class="btn-secondary" style="background:#fff7ed; color:#c2410c; border:1px solid #fdba74;">⛽ Gasolina</button>
            <button id="btnWizardGasto" class="btn-secondary" style="background:#eff6ff; color:#1d4ed8; border:1px solid #93c5fd;">💸 Gastos</button>
        `;
        cardTurnos.appendChild(div);
        document.getElementById("btnWizardGas").onclick = wizardGasolina;
        document.getElementById("btnWizardGasto").onclick = wizardGastoInteligente;
    }
};

document.addEventListener("DOMContentLoaded", () => {
    try { loadData(); } catch (e) { console.error(e); }
    
    // RENDER MENU PRIMERO
    Render.renderGlobalMenu();
    
    refreshUI();
    
    const page = document.body.getAttribute('data-page');
    if (page === 'admin') bindEvents();
    
    console.log("Sistema OK");
});

