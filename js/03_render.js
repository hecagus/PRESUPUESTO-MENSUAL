import { $, fmtMoney, isSameDay } from './01_consts_utils.js';
import * as Data from './02_data.js';

export const renderGlobalHeader = () => {
    const page = document.body.getAttribute('data-page') || 'index';
    const titulos = { 'index': '📊 Dashboard', 'admin': '⚙️ Admin', 'wallet': '💰 Wallet', 'historial': '📜 Historial' };
    const headerHTML = `
        <div class="logo">${titulos[page]}</div>
        <button id="menuToggle" class="menu-toggle">☰</button>
        <nav id="navMenu" class="nav-menu">
            <a href="index.html">Dashboard</a> <a href="admin.html">Administrar</a>
            <a href="wallet.html">Wallet</a> <a href="historial.html">Historial</a>
        </nav>`;
    let h = document.querySelector('header') || document.createElement('header');
    h.className = 'header'; h.innerHTML = headerHTML;
    if(!document.querySelector('header')) document.body.prepend(h);

    const btn = $("menuToggle"); const nav = $("navMenu");
    if(btn && nav) btn.onclick = () => nav.classList.toggle('active');
};

export const renderTurnoUI = () => {
    const activo = Data.getTurnoActivo();
    const lbl = $("turnoTexto");
    if (lbl) {
        lbl.innerText = activo ? `🟢 Turno Activo` : "🔴 Sin turno activo";
        if($("btnIniciarTurno")) $("btnIniciarTurno").style.display = activo ? "none" : "block";
        if($("btnFinalizarTurno")) $("btnFinalizarTurno").style.display = activo ? "block" : "none";
    }
};

export const setupAdminListeners = () => {
    if ($("btnIniciarTurno")) $("btnIniciarTurno").onclick = () => { if(Data.iniciarTurnoLogic()) renderTurnoUI(); };
    if ($("btnFinalizarTurno")) $("btnFinalizarTurno").onclick = () => {
        const m = prompt("Ganancia Bruta:");
        const k = prompt("KM Actual (Odómetro):");
        if(m) { Data.finalizarTurnoLogic(m, k); location.reload(); }
    };
};

export const renderListasAdmin = () => {
    const ul = $("listaGastosFijos");
    if (ul) ul.innerHTML = Data.getState().gastosFijosMensuales.map(g => `<li>${g.categoria}: $${fmtMoney(g.monto)}</li>`).join('');
};
