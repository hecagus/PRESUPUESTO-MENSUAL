/* 03_render.js */
import { $, fmtMoney, formatearFecha } from './01_consts_utils.js';

/* ==========================================================================
   NAVEGACIÓN GLOBAL (ESTÁTICA)
   ========================================================================== */
export const renderGlobalMenu = () => {
    const container = document.querySelector(".header-actions");
    if (!container || document.getElementById("nav-dropdown-global")) return;

    const menuHTML = `
        <div id="nav-dropdown-global" class="nav-dropdown">
            <button class="btn-hamburger" type="button">☰</button>
            <div class="nav-content">
                <a href="index.html">📊 Panel Principal</a>
                <a href="wallet.html">💰 Mi Alcancía (Wallet)</a>
                <a href="admin.html">⚙️ Administración</a>
                <a href="historial.html">📜 Historial</a>
            </div>
        </div>
    `;
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = menuHTML;
    container.appendChild(tempDiv.firstElementChild);

    const btn = container.querySelector(".btn-hamburger");
    const content = container.querySelector(".nav-content");
    
    if (btn && content) {
        btn.onclick = (e) => {
            e.stopPropagation();
            content.style.display = content.style.display === 'block' ? 'none' : 'block';
        };
        document.addEventListener('click', () => { content.style.display = 'none'; });
    }
};

/* ==========================================================================
   RENDER: ADMIN
   ========================================================================== */
export const renderTurnoControl = (turnoActivo) => {
    const btnInicio = $("btnIniciarTurno");
    const btnFin = $("btnFinalizarTurno");
    const txtEstado = $("turnoTexto");
    const divCierre = $("cierreTurnoContainer");

    if (!btnInicio || !btnFin) return;

    if (turnoActivo) {
        btnInicio.style.display = "none";
        btnFin.style.display = "block";
        txtEstado.innerHTML = `🟢 <b>Turno Activo</b><br>Inicio: ${new Date(turnoActivo.inicio).toLocaleTimeString()}<br>KM Inicial: ${turnoActivo.kmInicial}`;
        txtEstado.style.color = "#16a34a";
        if (divCierre) divCierre.style.display = "block";
    } else {
        btnInicio.style.display = "block";
        btnFin.style.display = "none";
        txtEstado.innerText = "🔴 Sin turno activo";
        txtEstado.style.color = "#dc2626";
        if (divCierre) divCierre.style.display = "none";
    }
};

export const renderMetaDiaria = (montoMeta) => {
    const el = $("metaDiariaDisplay");
    if (el) el.innerText = `$${fmtMoney(montoMeta)}`;
};

export const renderAdminLists = (deudas) => {
    const ulDeudas = $("listaDeudas");
    if (ulDeudas) {
        ulDeudas.innerHTML = deudas.map(d => `
            <li class="list-item">
                <div>
                    <b>${d.desc}</b><br>
                    <small>Cuota: $${fmtMoney(d.montoCuota)} (${d.frecuencia})</small>
                </div>
                <div style="text-align:right">
                    <span style="color:#dc2626">Restan: $${fmtMoney(d.saldo)}</span>
                </div>
            </li>
        `).join("");
    }
    
    const selAbono = $("abonoSeleccionar");
    if (selAbono) {
        selAbono.innerHTML = `<option value="">Selecciona Deuda...</option>` +
            deudas.filter(d => d.saldo > 0).map(d => `<option value="${d.id}">${d.desc} ($${d.saldo})</option>`).join("");
    }
};

/* ==========================================================================
   RENDER: DASHBOARD (INDEX)
   ========================================================================== */
export const renderDashboard = (stats) => {
    if (!stats) return;

    const setTxt = (id, val) => { if($(id)) $(id).innerText = val; };
    
    setTxt("resHoras", `${stats.horasHoy.toFixed(1)}h`);
    setTxt("resGananciaBruta", `$${fmtMoney(stats.gananciaHoy)}`);
    setTxt("dashboardMeta", `$${fmtMoney(stats.meta)}`);
    setTxt("progresoTexto", `${stats.progreso.toFixed(0)}%`);

    const barra = $("progresoBarra");
    if (barra) barra.style.width = `${Math.min(stats.progreso, 100)}%`;

    const listaAlertas = $("listaAlertas");
    if (listaAlertas) {
        listaAlertas.innerHTML = stats.alertas.map(a => `<li>${a}</li>`).join("");
    }
    
    const tbody = $("tablaTurnos");
    if (tbody) {
        tbody.innerHTML = stats.turnosRecientes.map(t => `
            <tr>
                <td>${formatearFecha(t.fecha)}</td>
                <td>${t.horas.toFixed(1)}h</td>
                <td>${t.kmRecorridos}km</td>
                <td>$${fmtMoney(t.ganancia)}</td>
            </tr>
        `).join("");
    }
};

/* ==========================================================================
   RENDER: HISTORIAL
   ========================================================================== */
export const renderHistorial = (movimientos) => {
    const tbody = $("historialBody");
    if (!tbody) return;
    
    tbody.innerHTML = movimientos.slice().reverse().map(m => `
        <tr>
            <td>
                <span class="badge ${m.tipo === 'ingreso' ? 'bg-green' : 'bg-red'}">
                    ${m.tipo === 'ingreso' ? '💰 Ingreso' : '💸 Gasto'}
                </span>
            </td>
            <td>${formatearFecha(m.fecha)}</td>
            <td>${m.desc} <small style="color:#666">(${m.categoria || '-'})</small></td>
            <td style="font-weight:bold; color:${m.tipo === 'ingreso' ? '#16a34a' : '#dc2626'}">
                $${fmtMoney(m.monto)}
            </td>
        </tr>
    `).join("");
};

/* ==========================================================================
   RENDER: WALLET
   ========================================================================== */
export const renderWalletUI = (stats) => {
    if (!stats) return;

    const elTeorico = $("walletTotalObligado");
    if (elTeorico) elTeorico.innerText = `$${fmtMoney(stats.teorico)}`;

    const elSaldo = $("walletSaldoReal");
    if (elSaldo) {
        elSaldo.innerText = `$${fmtMoney(stats.real)}`;
        elSaldo.style.color = stats.enMeta ? "#16a34a" : "#dc2626";
    }
};
