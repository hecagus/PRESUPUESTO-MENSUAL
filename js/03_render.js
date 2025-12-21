import { $, fmtMoney, formatearFecha } from './01_consts_utils.js';

/* MENU GLOBAL — IDEMPOTENTE */
export const renderGlobalMenu = () => {
    let container = document.querySelector(".header-actions");
    if (!container) {
        const header = document.querySelector(".header");
        if (!header) return;
        container = document.createElement("div");
        container.className = "header-actions";
        header.appendChild(container);
    }

    if (container.querySelector("#nav-dropdown-global")) return;

    container.innerHTML = `
      <div id="nav-dropdown-global" class="nav-dropdown">
        <button class="btn-hamburger" type="button">☰</button>
        <div class="nav-content">
          <a href="index.html">📊 Panel</a>
          <a href="admin.html">⚙️ Admin</a>
          <a href="wallet.html">💰 Wallet</a>
          <a href="historial.html">📜 Historial</a>
        </div>
      </div>
    `;

    const btn = container.querySelector(".btn-hamburger");
    const content = container.querySelector(".nav-content");

    btn.addEventListener("click", (e) => {
        e.stopPropagation();
        content.style.display = content.style.display === "block" ? "none" : "block";
    });

    document.addEventListener("click", () => {
        content.style.display = "none";
    });
};

/* DASHBOARD */
export const renderDashboard = (s) => {
    if (!s) return;
    if ($("resHoras")) $("resHoras").innerText = `${s.horasHoy.toFixed(1)}h`;
    if ($("resGananciaBruta")) $("resGananciaBruta").innerText = `$${fmtMoney(s.gananciaHoy)}`;
    if ($("dashboardMeta")) $("dashboardMeta").innerText = `$${fmtMoney(s.meta)}`;
    if ($("progresoTexto")) $("progresoTexto").innerText = `${s.progreso.toFixed(0)}%`;
    if ($("progresoBarra")) $("progresoBarra").style.width = `${Math.min(s.progreso,100)}%`;
};

/* ADMIN */
export const renderTurnoControl = (t) => {
    if ($("btnIniciarTurno")) $("btnIniciarTurno").style.display = t ? "none" : "block";
    if ($("btnFinalizarTurno")) $("btnFinalizarTurno").style.display = t ? "block" : "none";
    if ($("turnoTexto")) {
        $("turnoTexto").innerText = t
          ? `🟢 Turno activo desde ${new Date(t.inicio).toLocaleTimeString()}`
          : "🔴 Sin turno activo";
    }
};

export const renderMetaDiaria = (m) => {
    if ($("metaDiariaDisplay")) $("metaDiariaDisplay").innerText = `$${fmtMoney(m)}`;
};

export const renderAdminLists = (d = []) => {
    if ($("listaDeudas")) {
        $("listaDeudas").innerHTML = d.length
          ? d.map(x => `<li>${x.desc} — $${fmtMoney(x.saldo)}</li>`).join("")
          : "<li>No hay deudas</li>";
    }
};

export const renderHistorial = (m = []) => {
    if ($("historialBody")) {
        $("historialBody").innerHTML = m.length
          ? m.slice().reverse().map(x => `
            <tr>
              <td>${x.tipo}</td>
              <td>${formatearFecha(x.fecha)}</td>
              <td>${x.desc}</td>
              <td>$${fmtMoney(x.monto)}</td>
            </tr>`).join("")
          : `<tr><td colspan="4">Sin movimientos</td></tr>`;
    }
};

export const renderWalletUI = (s) => {
    if (!s) return;
    if ($("walletTotalObligado")) $("walletTotalObligado").innerText = `$${fmtMoney(s.deberiasTener)}`;
    if ($("walletSaldoReal")) {
        $("walletSaldoReal").innerText = `$${fmtMoney(s.tienesRealmente)}`;
        $("walletSaldoReal").style.color = s.enMeta ? "#16a34a" : "#dc2626";
    }
};
