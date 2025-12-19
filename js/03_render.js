import { $, fmtMoney, log } from './01_consts_utils.js';
import * as Data from './02_data.js';

// -------- HEADER --------
export const renderGlobalHeader = () => {
    const page = document.body?.dataset.page || 'index';
    const h = document.querySelector('header') || document.createElement('header');
    h.className = 'header';
    h.innerHTML = `
        <strong>${page.toUpperCase()}</strong>
        <nav>
            <a href="index.html">Dashboard</a>
            <a href="admin.html">Admin</a>
        </nav>`;
    if (!document.querySelector('header')) document.body.prepend(h);
};

// -------- ADMIN --------
export const renderTurnoUI = () => {
    const lbl = $("turnoTexto");
    if (!lbl) return;
    lbl.textContent = Data.getTurnoActivo()
        ? "🟢 Turno activo"
        : "🔴 Sin turno";
};

export const setupAdminListeners = () => {
    const btnI = $("btnIniciarTurno");
    const btnF = $("btnFinalizarTurno");
    if (btnI) btnI.onclick = () => Data.iniciarTurnoLogic() && renderTurnoUI();
    if (btnF)
        btnF.onclick = () => {
            const g = prompt("Ganancia:");
            const k = prompt("KM:");
            Data.finalizarTurnoLogic(g, k);
            location.reload();
        };
};

export const renderListasAdmin = () => {
    const ul = $("listaGastosFijos");
    if (!ul) return;
    ul.innerHTML = Data.getState().gastosFijosMensuales
        .map(g => `<li>${g.categoria}: $${fmtMoney(g.monto)}</li>`)
        .join('');
};
