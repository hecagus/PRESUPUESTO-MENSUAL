import { $, fmtMoney, CATEGORIAS_GASTOS, formatearFecha, safeNumber, isSameDay } from './01_consts_utils.js';
import * as Data from './02_data.js';

const TODAY = new Date();

export const renderGlobalHeader = () => {
    const page = document.body.getAttribute('data-page') || 'index';
    const titulos = { 'index': '📊 Dashboard', 'admin': '⚙️ Admin', 'wallet': '💰 Wallet', 'historial': '📜 Historial' };
    
    const headerHTML = `
        <div class="logo">${titulos[page] || 'Tracker'}</div>
        <button id="menuToggle" class="menu-toggle">☰</button>
        <nav id="navMenu" class="nav-menu">
            <a href="index.html" class="${page === 'index' ? 'active' : ''}">Dashboard</a>
            <a href="admin.html" class="${page === 'admin' ? 'active' : ''}">Administrar</a>
            <a href="wallet.html" class="${page === 'wallet' ? 'active' : ''}">Wallet</a>
            <a href="historial.html" class="${page === 'historial' ? 'active' : ''}">Historial</a>
        </nav>
    `;
    let header = document.querySelector('header');
    if (!header) { header = document.createElement('header'); header.className = 'header'; document.body.prepend(header); }
    header.innerHTML = headerHTML;
    
    const btn = $("menuToggle");
    const nav = $("navMenu");
    if (btn && nav) {
        btn.onclick = (e) => { e.stopPropagation(); nav.classList.toggle('active'); };
        document.onclick = (e) => { if (!nav.contains(e.target) && e.target !== btn) nav.classList.remove('active'); };
    }
};

export const renderDashboard = () => {
    const s = Data.getState();
    const turnosHoy = s.turnos.filter(t => isSameDay(t.fecha, TODAY));
    const bruta = turnosHoy.reduce((a, b) => a + safeNumber(b.ganancia), 0);
    const horas = turnosHoy.reduce((a, b) => a + safeNumber(b.horas), 0);
    const gastosHoy = s.movimientos.filter(m => m.tipo === 'gasto' && isSameDay(m.fecha, TODAY)).reduce((a,b)=>a+safeNumber(b.monto), 0);

    const set = (id, v) => { if($(id)) $(id).innerText = v; };
    set("resHoras", `${horas.toFixed(2)}h`);
    set("resGananciaBruta", `$${fmtMoney(bruta)}`);
    set("resGananciaNeta", `$${fmtMoney(bruta - gastosHoy)}`);
    set("resGastosTrabajo", `$${fmtMoney(gastosHoy)}`);
    
    const tb = $("tablaTurnos");
    if (tb) {
        tb.innerHTML = s.turnos.slice(-5).reverse().map(t => 
            `<tr><td>${formatearFecha(t.fecha)}</td><td>${t.horas.toFixed(1)}h</td><td>${t.kmFinal}</td><td>$${fmtMoney(t.ganancia)}</td></tr>`
        ).join('') || "<tr><td colspan='4'>Sin datos</td></tr>";
    }
};

export const renderWalletUI = () => {
    const d = Data.getWalletData();
    const set = (id, v) => { if($(id)) $(id).innerText = v; };
    set("walletTotalObligado", `$${fmtMoney(d.totales.obligado)}`);
    set("walletCashFlow", `$${fmtMoney(d.totales.efectivo)}`);
    set("walletGasSaldo", `$${fmtMoney(d.gasolina.saldo)}`);
    
    const container = $("walletFixedContainer");
    if (container) {
        container.innerHTML = d.sobres.map(s => `
            <div class="card" style="border-left:4px solid #3b82f6; margin-bottom:10px;">
                <div style="display:flex; justify-content:space-between;"><strong>${s.nombre}</strong><span>${s.tipo}</span></div>
                <div style="font-size:0.9rem;">Diario: $${fmtMoney(s.diario)} | Acumulado: <strong>$${fmtMoney(s.acumulado)}</strong></div>
            </div>
        `).join('') || "<p>No hay sobres.</p>";
    }
};

export const renderTurnoUI = () => {
    const activo = Data.getTurnoActivo();
    const lbl = $("turnoTexto");
    if (lbl) {
        lbl.innerText = activo ? `🟢 Activo desde: ${new Date(activo.inicio).toLocaleTimeString()}` : "🔴 Sin turno activo";
        if($("btnIniciarTurno")) $("btnIniciarTurno").style.display = activo ? "none" : "block";
        if($("btnFinalizarTurno")) $("btnFinalizarTurno").style.display = activo ? "block" : "none";
    }
};

export const renderListasAdmin = () => {
    const ul = $("listaGastosFijos");
    if (ul) {
        ul.innerHTML = Data.getState().gastosFijosMensuales.map((g, i) => `
            <li style="display:flex; justify-content:space-between; padding:5px 0;">
                <span>${g.categoria} - $${fmtMoney(g.monto)}</span>
                <button onclick="window.eliminarFijo(${i})" style="color:red; background:none; border:none; cursor:pointer;">🗑️</button>
            </li>
        `).join('');
    }
};

window.eliminarFijo = (i) => { if(confirm("¿Eliminar?")) { Data.eliminarGastoFijo(i); renderListasAdmin(); } };

export const setupAdminListeners = () => {
    const safeClick = (id, fn) => { if($(id)) $(id).onclick = fn; };
    safeClick("btnIniciarTurno", () => { if(Data.iniciarTurnoLogic()) renderTurnoUI(); });
    safeClick("btnFinalizarTurno", () => { $("cierreTurnoContainer").style.display = "block"; $("btnFinalizarTurno").style.display="none"; });
    safeClick("btnConfirmarFinalizar", () => {
        Data.finalizarTurnoLogic($("gananciaBruta").value, $("kmFinalTurno").value);
        location.reload();
    });
    // ... Resto de listeners (Gasolina, Gastos, etc. se mantienen igual pero apuntando a Data)
};
