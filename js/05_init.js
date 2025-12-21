/* 05_init.js */
import { loadData, getDashboardStats, getWalletStats, getAdminStats, getState, iniciarTurno, finalizarTurno, registrarAbono } from './02_data.js';
import * as Render from './03_render.js';
import { initCharts } from './04_charts.js';
import { $ } from './01_consts_utils.js';

// --- CONTROLADORES DE EVENTOS ---
const bindAdminEvents = () => {
    const btnInicio = $("btnIniciarTurno");
    const btnFin = $("btnFinalizarTurno");
    const btnAbono = $("btnRegistrarAbono");
    const btnCopy = $("btnCopiarJSON");

    if (btnInicio) {
        btnInicio.onclick = () => {
            const adminStats = getAdminStats();
            const ultimoKM = adminStats.ultimoKM || 0;
            const kmInput = prompt(`Confirma KM Inicial (Sugerido: ${ultimoKM}):`, ultimoKM);
            if (kmInput) {
                iniciarTurno(kmInput);
                refreshAdminUI();
            }
        };
    }

    if (btnFin) {
        btnFin.onclick = () => {
            const kmInput = prompt("KM Final del odómetro:");
            const dineroInput = prompt("Ganancia Total ($) del turno:");
            const gasInput = prompt("¿Gastaste Gasolina hoy? (Monto $, pon 0 si no):", "0");
            
            if (kmInput && dineroInput) {
                finalizarTurno(kmInput, dineroInput, gasInput);
                alert("✅ Turno finalizado y guardado.");
                refreshAdminUI();
            }
        };
    }

    if (btnAbono) {
        btnAbono.onclick = () => {
            const id = $("abonoSeleccionar").value;
            const monto = $("abonoMonto").value;
            if (id && monto) {
                registrarAbono(id, monto);
                alert("Abono registrado.");
                refreshAdminUI();
            }
        };
    }

    if (btnCopy) {
        btnCopy.onclick = () => {
            const dataStr = JSON.stringify(getState(), null, 2);
            navigator.clipboard.writeText(dataStr).then(() => alert("Datos copiados al portapapeles"));
        };
    }
};

const refreshAdminUI = () => {
    const stats = getAdminStats();
    Render.renderTurnoControl(stats.turnoActivo);
    Render.renderMetaDiaria(stats.metaDiaria);
    Render.renderAdminLists(stats.deudas);
};

const refreshDashboardUI = () => {
    const stats = getDashboardStats();
    Render.renderDashboard(stats);
    initCharts();
};

// --- ARRANQUE DEL SISTEMA ---
document.addEventListener("DOMContentLoaded", () => {
    console.log("🚀 Iniciando Sistema...");

    // 1. Cargar Datos
    loadData();
    
    // 2. FORZAR RENDER DEL MENÚ
    try {
        Render.renderGlobalMenu();
        console.log("✅ Menú inyectado");
    } catch (e) {
        console.error("❌ Error pintando menú:", e);
    }
    
    // 3. Router
    const page = document.body.getAttribute('data-page');

    if (page === 'index') {
        refreshDashboardUI();
    } else if (page === 'admin') {
        refreshAdminUI();
        bindAdminEvents();
    } else if (page === 'wallet') {
        Render.renderWalletUI(getWalletStats());
    } else if (page === 'historial') {
        Render.renderHistorial(getState().movimientos);
    }
    
    console.log(`✅ Página cargada: ${page}`);
});
