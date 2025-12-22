/* 03_render.js - RENDERIZADO VISUAL MEJORADO */
import { $, fmtMoney, formatearFecha } from "./01_consts_utils.js";
import { getState, getTurnoActivo } from "./02_data.js";

/* --- NAVEGACIÓN INFERIOR (BOTTOM NAV) --- */
export const renderGlobalMenu = () => {
  // Si ya existe el nav inferior, no lo duplicamos
  if (document.getElementById("main-bottom-nav")) return;

  const nav = document.createElement("nav");
  nav.id = "main-bottom-nav";
  nav.className = "bottom-nav";
  
  // HTML del menú fijo
  nav.innerHTML = `
    <a href="index.html" class="nav-item" id="nav-index">
      <span class="icon">📊</span>
      <span>Panel</span>
    </a>
    <a href="wallet.html" class="nav-item" id="nav-wallet">
      <span class="icon">💰</span>
      <span>Wallet</span>
    </a>
    <a href="admin.html" class="nav-item" id="nav-admin">
      <span class="icon">⚙️</span>
      <span>Admin</span>
    </a>
    <a href="historial.html" class="nav-item" id="nav-historial">
      <span class="icon">📜</span>
      <span>Historial</span>
    </a>
  `;

  document.body.appendChild(nav);

  // Marcar activo
  const page = document.body.dataset.page;
  const activeLink = document.getElementById(`nav-${page}`);
  if (activeLink) activeLink.classList.add("active");
};

/* --- DASHBOARD --- */
export const renderDashboard = (stats) => {
  if (!stats) return;

  // Resumen
  if($("resHoras")) $("resHoras").innerText = stats.horas.toFixed(1) + "h";
  if($("resGananciaBruta")) $("resGananciaBruta").innerText = "$" + fmtMoney(stats.ganancia);
  
  // Meta
  if($("dashboardMeta")) {
      $("dashboardMeta").innerText = "$" + fmtMoney(stats.meta);
      if(stats.meta === 0) $("dashboardMeta").innerHTML = `<a href="admin.html" style="color:var(--primary); text-decoration:none;">Configurar ⚙️</a>`;
  }
  
  if($("progresoTexto")) $("progresoTexto").innerText = stats.progreso.toFixed(0) + "%";
  if($("progresoBarra")) $("progresoBarra").style.width = Math.min(stats.progreso, 100) + "%";

  // Tabla Turnos
  const tbody = $("tablaTurnos");
  if (tbody) {
      if(stats.turnosRecientes.length === 0) {
          tbody.innerHTML = `<tr><td colspan="4" class="empty-state">
              <p>No hay turnos recientes.</p>
              <a href="admin.html" style="font-weight:bold; color:var(--primary);">Iniciar Turno</a>
          </td></tr>`;
      } else {
          tbody.innerHTML = stats.turnosRecientes.map(t => `
            <tr>
              <td>${formatearFecha(t.fecha).split(" ")[0]}</td>
              <td>${t.horas.toFixed(1)}h</td>
              <td>${t.km}km</td>
              <td>$${fmtMoney(t.ganancia)}</td>
            </tr>`
          ).join("");
      }
  }
};

/* --- ADMIN --- */
export const renderAdminUI = () => {
  const t = getTurnoActivo();
  const meta = getState().parametros.gastoFijo;

  if ($("turnoTexto")) {
    if (t) {
        $("turnoTexto").innerHTML = `
            <div style="background:#dcfce7; padding:10px; border-radius:8px; color:#166534; border:1px solid #bbf7d0;">
                <strong>🟢 Turno en curso</strong><br>
                <small>Iniciado: ${new Date(t.inicio).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</small>
            </div>`;
        $("btnIniciarTurno").style.display = "none";
        $("btnFinalizarTurno").style.display = "block";
    } else {
        $("turnoTexto").innerText = "🔴 Sin turno activo";
        $("btnIniciarTurno").style.display = "block";
        $("btnFinalizarTurno").style.display = "none";
    }
  }

  if ($("metaDiariaDisplay")) {
    $("metaDiariaDisplay").innerText = `$${fmtMoney(meta)}`;
  }

  // Deudas UI
  const ul = $("listaDeudas");
  const sel = $("abonoSeleccionar");

  if (ul && sel) {
    const deudas = getState().deudas.filter(d => d.saldo > 0);
    
    sel.innerHTML = `<option value="">Selecciona una deuda...</option>`;
    deudas.forEach(d => sel.add(new Option(`${d.desc} ($${fmtMoney(d.saldo)})`, d.id)));

    if(deudas.length === 0) {
        ul.innerHTML = `<li class="empty-state"><p>🎉 ¡Libre de deudas!</p></li>`;
    } else {
        ul.innerHTML = deudas.map(d => `
            <li style="padding:10px; border-bottom:1px solid #eee; display:flex; justify-content:space-between;">
                <span>${d.desc}</span>
                <b style="color:#dc2626">$${fmtMoney(d.saldo)}</b>
            </li>`).join("");
    }
  }
};

/* --- HISTORIAL --- */
export const renderHistorial = () => {
  const tbody = $("historialBody");
  if (!tbody) return;

  const movs = getState().movimientos.slice().reverse();

  if (movs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="empty-state">
          <p>Aún no hay movimientos.</p>
          <small>Los registros aparecerán aquí.</small>
      </td></tr>`;
      return;
  }

  tbody.innerHTML = movs.map(m => `
    <tr>
      <td>${formatearFecha(m.fecha).split(" ")[0]}</td>
      <td>
        <div style="font-weight:600">${m.desc}</div>
        <small style="color:#64748b">${m.tipo.toUpperCase()}</small>
      </td>
      <td>${m.categoria || "-"}</td>
      <td style="color:${m.tipo==='ingreso'?'#16a34a':'#dc2626'}">
        $${fmtMoney(m.monto)}
      </td>
    </tr>`
  ).join("");
};

/* --- WALLET --- */
export const renderWallet = () => {
  const s = getState();
  const dia = new Date().getDate();
  const esperado = s.parametros.gastoFijo * dia;
  const real = s.movimientos.reduce((a, m) => a + (m.tipo === "ingreso" ? m.monto : -m.monto), 0);

  if($("walletEsperado")) $("walletEsperado").innerText = `$${fmtMoney(esperado)}`;
  if($("walletReal")) $("walletReal").innerText = `$${fmtMoney(real)}`;
  
  if($("walletGas")) {
      const gas = s.parametros.costoKmPromedio || 0;
      $("walletGas").innerText = gas > 0 ? `$${gas.toFixed(2)} / km` : "Sin datos";
  }
};

