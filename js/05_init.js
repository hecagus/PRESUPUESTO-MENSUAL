/* 05_init.js - ORQUESTADOR */
import { 
    loadData, getState, getDashboardStats, getAdminStats, getWalletStats,
    iniciarTurno, finalizarTurno, registrarGasolina, 
    agregarMovimiento, agregarGastoRecurrente, 
    agregarDeuda, registrarAbono 
} from './02_data.js';
import * as Render from './03_render.js';
import { CATEGORIAS_GASTOS, $ } from './01_consts_utils.js';
import { initCharts } from './04_charts.js';

// --- REFRESCO CENTRALIZADO ---
const refreshUI = () => {
    const page = document.body.getAttribute('data-page');
    const s = getState();
    
    Render.renderGlobalMenu(); // Asegurar menú

    if (page === 'index') {
        Render.renderDashboard(getDashboardStats());
        initCharts();
    } else if (page === 'admin') {
        const adminStats = getAdminStats();
        Render.renderTurnoControl(adminStats.turnoActivo);
        Render.renderMetaDiaria(adminStats.metaDiaria);
        Render.renderAdminLists(adminStats.deudas);
    } else if (page === 'wallet') {
        Render.renderWalletUI(getWalletStats());
    } else if (page === 'historial') {
        Render.renderHistorial(s.movimientos);
    }
};

// --- WIZARDS ---
const wizardGasolina = () => {
    const litros = prompt("⛽ Litros:"); if(!litros) return;
    const costo = prompt("💰 Costo Total:"); if(!costo) return;
    const prevKM = getState().parametros.ultimoKMfinal || 0;
    const km = prompt(`🏎️ KM Actual (Anterior: ${prevKM}):`, prevKM); if(!km) return;
    
    registrarGasolina(litros, costo, km);
    alert("✅ Gasolina registrada");
    refreshUI();
};

const wizardGasto = () => {
    const tipo = prompt("1. 🛵 Moto\n2. 🏠 Hogar");
    if(tipo !== "1" && tipo !== "2") return;
    
    const list = tipo === "1" ? CATEGORIAS_GASTOS.moto : CATEGORIAS_GASTOS.hogar;
    let txt = "Elige #:\n"; list.forEach((c,i)=> txt+=`${i+1}. ${c}\n`);
    const sel = prompt(txt);
    const cat = list[parseInt(sel)-1];
    if(!cat) return;

    const monto = prompt("💰 Monto:"); if(!monto) return;
    
    if(confirm("¿Es gasto FIJO recurrente?")) {
        const f = prompt("1. Semanal 2. Quincenal 3. Mensual") || "3";
        const freqs = ["","Semanal","Quincenal","Mensual"];
        agregarGastoRecurrente(cat, monto, freqs[f]||"Mensual", 15);
    }
    
    agregarMovimiento('gasto', cat, monto, tipo==="1"?'Moto':'Hogar');
    refreshUI();
};

const wizardDeuda = () => {
    const n = prompt("Nombre Deuda:"); if(!n) return;
    const t = prompt("Total Deuda:"); if(!t) return;
    const c = prompt("Cuota Pago:"); if(!c) return;
    agregarDeuda(n, t, c, "Mensual"); // Simplificado
    alert("✅ Deuda registrada");
    refreshUI();
};

// --- EVENTOS ---
const bindEvents = () => {
    const click = (id, fn) => { const el = $(id); if(el) el.onclick = fn; };

    click("btnIniciarTurno", () => {
        const km = prompt("KM Inicial:", getState().parametros.ultimoKMfinal||0);
        if(km) { iniciarTurno(km); refreshUI(); }
    });
    
    click("btnFinalizarTurno", () => {
        const km = prompt("KM Final:"); 
        const g = prompt("Ganancia:");
        if(km && g) { finalizarTurno(km, g); alert("Turno cerrado"); refreshUI(); }
    });

    click("btnWizardGas", wizardGasolina);
    click("btnWizardGasto", wizardGasto);
    click("btnWizardDeuda", wizardDeuda);
    
    click("btnRegistrarAbono", () => {
        const id = $("abonoSeleccionar").value;
        const m = $("abonoMonto").value;
        if(id && m) { registrarAbono(id, m); alert("Abono ok"); refreshUI(); }
    });

    click("btnCopiarJSON", () => {
        navigator.clipboard.writeText(JSON.stringify(getState()));
        alert("Copiado!");
    });
};

// --- MAIN ---
document.addEventListener("DOMContentLoaded", () => {
    loadData();
    const p = document.body.getAttribute('data-page');
    if(p === 'admin') bindEvents();
    refreshUI();
    console.log("App Ready: " + p);
});
