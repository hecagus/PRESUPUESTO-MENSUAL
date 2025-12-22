import { $, fmtMoney, formatearFecha } from "./01_consts_utils.js";
import { getState, getTurnoActivo } from "./02_data.js";

// --- MENÚ VISIBLE (NO HAMBURGUESA) ---
export const renderGlobalMenu = () => {
  const container = document.querySelector(".header-actions");
  if (!container) return;
  
  container.innerHTML = `
    <nav class="nav">
      <a href="index.html" id="nav-panel">📊</a>
      <a href="wallet.html" id="nav-wallet">💰</a>
      <a href="admin.html" id="nav-admin">⚙️</a>
      <a href="historial.html" id="nav-historial">📜</a>
    </nav>
  `;
  
  // Marcar activo
  const page = document.body.dataset.page;
  const activeLink = document.getElementById(`nav-${page === 'index' ? 'panel' : page}`);
  if (activeLink) activeLink.classList.add("active");
};

// --- ADMIN UI ---
export const renderAdminUI = () => {
    const t = getTurnoActivo();
    const btnI = $("btnIniciarTurno");
    const btnF = $("btnFinalizarTurno");
    const txt = $("turnoTexto");

    if (t) {
        if(txt) txt.innerHTML = `<div style="background:#dcfce7; color:#166534; padding:10px; border-radius:6px;">🟢 Turno Activo<br><small>Inicio: ${new Date(t.inicio).toLocaleTimeString()}</small></div>`;
        if(btnI) btnI.style.display = "none";
        if(btnF) btnF.style.display = "block";
    } else {
        if(txt) txt.innerHTML = "🔴 Sin turno activo";
        if(btnI) btnI.style.display = "block";
        if(btnF) btnF.style.display = "none";
    }

    const meta = getState().parametros.gastoFijo;
    if($("metaDiariaDisplay")) $("metaDiariaDisplay").innerText = `$${fmtMoney(meta)}`;
    
    // Lista Deudas
    const ul = $("listaDeudas");
    const sel = $("abonoSeleccionar");
    if(ul && sel) {
        ul.innerHTML = ""; sel.innerHTML = `<option value="">Selecciona deuda...</option>`;
        getState().deudas.forEach(d => {
            if(d.saldo > 0) {
                ul.innerHTML += `<li style="padding:5px; border-bottom:1px solid #eee;">${d.desc}: <b style="color:#dc2626">$${fmtMoney(d.saldo)}</b></li>`;
                sel.add(new Option(`${d.desc} ($${d.saldo})`, d.id));
            }
        });
    }
};

// --- DASHBOARD UI ---
export const renderDashboard = (stats) => {
    if(!stats) return;
    const set = (id, v) => { if($(id)) $(id).innerText = v; };
    set("resHoras", stats.horas.toFixed(1) + "h");
    set("resGananciaBruta", "$" + fmtMoney(stats.ganancia));
    set("dashboardMeta", "$" + fmtMoney(stats.meta));
    set("progresoTexto", stats.progreso.toFixed(0) + "%");
    if($("progresoBarra")) $("progresoBarra").style.width = Math.min(stats.progreso, 100) + "%";

    const tbody = $("tablaTurnos");
    if(tbody) {
        tbody.innerHTML = stats.turnosRecientes.map(t => `
            <tr>
                <td>${formatearFecha(t.fecha)}</td>
                <td>${t.horas.toFixed(1)}</td>
                <td>${t.km}</td>
                <td>$${fmtMoney(t.ganancia)}</td>
            </tr>
        `).join("");
    }
};
