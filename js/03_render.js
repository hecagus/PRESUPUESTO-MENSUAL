import { $, fmtMoney, CATEGORIAS_GASTOS, formatearFecha, safeNumber, isSameDay, log } from './01_consts_utils.js';
import * as Data from './02_data.js';

export const renderGlobalHeader = () => {
    const page = document.body.dataset.page || 'index';
    const titulos = { 'index': '📊 Dashboard', 'admin': '⚙️ Admin', 'wallet': '💰 Wallet', 'historial': '📜 Historial' };
    const h = document.querySelector('header') || document.createElement('header');
    h.className = 'header';
    h.innerHTML = `
        <div class="logo">${titulos[page]}</div>
        <button id="menuToggle" class="menu-toggle">☰</button>
        <nav id="navMenu" class="nav-menu">
            <a href="index.html" class="${page === 'index' ? 'active' : ''}">Dashboard</a>
            <a href="admin.html" class="${page === 'admin' ? 'active' : ''}">Administrar</a>
            <a href="wallet.html" class="${page === 'wallet' ? 'active' : ''}">Wallet</a>
            <a href="historial.html" class="${page === 'historial' ? 'active' : ''}">Historial</a>
        </nav>`;
    if (!document.querySelector('header')) document.body.prepend(h);

    const btn = $("menuToggle");
    const nav = $("navMenu");
    if (btn && nav) btn.onclick = (e) => { e.stopPropagation(); nav.classList.toggle('active'); };
};

export const renderDashboard = () => {
    const s = Data.getState();
    const hoy = s.turnos.filter(t => isSameDay(t.fecha, new Date())).reduce((acc, t) => acc + t.ganancia, 0);
    const netaEl = $("resGananciaNeta");
    if (netaEl) netaEl.innerText = `$${fmtMoney(hoy)}`;
    log("RENDER", "Dashboard actualizado");
};

export const renderTurnoUI = () => {
    const activo = Data.getTurnoActivo();
    const lbl = $("turnoTexto");
    if (lbl) {
        lbl.innerText = activo ? `🟢 Turno Activo` : "🔴 Sin turno activo";
        if ($("btnIniciarTurno")) $("btnIniciarTurno").style.display = activo ? "none" : "block";
        if ($("btnFinalizarTurno")) $("btnFinalizarTurno").style.display = activo ? "block" : "none";
    }
};

export const setupAdminListeners = () => {
    if ($("btnIniciarTurno")) $("btnIniciarTurno").onclick = () => { if (Data.iniciarTurnoLogic()) renderTurnoUI(); };
    if ($("btnFinalizarTurno")) $("btnFinalizarTurno").onclick = () => {
        const m = prompt("Ganancia Bruta:");
        if (m) { Data.finalizarTurnoLogic(m, 0); location.reload(); }
    };
};

export const renderListasAdmin = () => {
    const ul = $("listaGastosFijos");
    if (ul) ul.innerHTML = Data.getState().gastosFijosMensuales.map((g, i) => `<li>${g.categoria}: $${fmtMoney(g.monto)}</li>`).join('');
};

window.eliminarFijo = (i) => { if (confirm("¿Eliminar?")) { Data.eliminarGastoFijo(i); renderListasAdmin(); } };
