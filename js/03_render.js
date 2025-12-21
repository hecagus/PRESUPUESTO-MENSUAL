/* 03_render.js */
import { $, fmtMoney, formatearFecha } from './01_consts_utils.js';

// --- MENÚ GLOBAL (Sin cambios, ya funcionaba) ---
export const renderGlobalMenu = () => {
    let container = document.querySelector(".header-actions");
    if (!container) {
         // Fallback por si el HTML está incompleto
         const header = document.querySelector(".header");
         if(header) {
             container = document.createElement("div");
             container.className = "header-actions";
             header.appendChild(container);
         } else return;
    }
    if (document.getElementById("nav-dropdown-global")) return;

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
    btn.onclick = (e) => { e.stopPropagation(); content.style.display = content.style.display==='block'?'none':'block'; };
    document.addEventListener('click', () => { content.style.display = 'none'; });
};

// --- RENDER ADMIN ---
export const renderTurnoControl = (turnoActivo) => {
    const btnInicio = $("btnIniciarTurno");
    const btnFin = $("btnFinalizarTurno");
    const txtEstado = $("turnoTexto");

    if (!btnInicio || !btnFin) return;

    if (turnoActivo) {
        btnInicio.style.display = "none";
        btnFin.style.display = "block";
        
        // Calcular tiempo transcurrido en vivo (aproximado al renderizar)
        const ahora = new Date().getTime();
        const diffHoras = (ahora - turnoActivo.inicio) / (1000 * 60 * 60);
        
        txtEstado.innerHTML = `
            <div style="background:#dcfce7; padding:10px; border-radius:8px; border:1px solid #86efac;">
                <h3 style="color:#15803d; margin:0;">🟢 Turno EN CURSO</h3>
                <p style="margin:5px 0 0 0;">Inicio: ${new Date(turnoActivo.inicio).toLocaleTimeString()}</p>
                <p>Llevas: <b>${diffHoras.toFixed(2)} horas</b></p>
                <small>KM Inicial: ${turnoActivo.kmInicial}</small>
            </div>
        `;
    } else {
        btnInicio.style.display = "block";
        btnFin.style.display = "none";
        txtEstado.innerHTML = `<span style="color:#dc2626">🔴 Sin turno activo</span>`;
    }
};

export const renderMetaDiaria = (monto) => {
    const el = $("metaDiariaDisplay");
    if(el) el.innerText = `$${fmtMoney(monto)}`;
};

export const renderAdminLists = (deudas) => { /* Igual que antes */
    const ul = $("listaDeudas");
    const sel = $("abonoSeleccionar");
    if(!ul) return;
    
    ul.innerHTML = deudas.map(d => `
        <li class="list-item">
            <div><b>${d.desc}</b> <small>(${d.frecuencia})</small></div>
            <div style="color:${d.saldo>0?'#dc2626':'#16a34a'}">$${fmtMoney(d.saldo)}</div>
        </li>`).join("");

    if(sel) {
        sel.innerHTML = `<option value="">Selecciona Deuda...</option>` +
            deudas.filter(d=>d.saldo>0).map(d=>`<option value="${d.id}">${d.desc}</option>`).join("");
    }
};

// --- DASHBOARD ---
export const renderDashboard = (stats) => {
    if(!stats) return;
    const set = (id,v) => { if($(id)) $(id).innerText = v; };
    
    set("resHoras", `${stats.horasHoy.toFixed(2)}h`); // 2 decimales
    set("resGananciaBruta", `$${fmtMoney(stats.gananciaHoy)}`);
    set("dashboardMeta", `$${fmtMoney(stats.meta)}`);
    set("progresoTexto", `${stats.progreso.toFixed(0)}%`);
    
    if($("progresoBarra")) $("progresoBarra").style.width = `${Math.min(stats.progreso,100)}%`;
    
    const tbody = $("tablaTurnos");
    if(tbody) {
        tbody.innerHTML = stats.turnosRecientes.map(t => `
            <tr>
                <td>${formatearFecha(t.fecha)}</td>
                <td>${t.horas.toFixed(2)}h</td>
                <td>${t.kmRecorridos}km</td>
                <td>$${fmtMoney(t.ganancia)}</td>
            </tr>
        `).join("");
    }
};

// --- HISTORIAL ---
export const renderHistorial = (movs) => {
    const tbody = $("historialBody");
    if(!tbody) return;
    tbody.innerHTML = movs.slice().reverse().map(m => `
        <tr>
            <td><span class="badge ${m.tipo==='ingreso'?'bg-green':'bg-red'}">${m.tipo}</span></td>
            <td>${formatearFecha(m.fecha)}</td>
            <td>${m.desc} <small>(${m.categoria||''})</small></td>
            <td>$${fmtMoney(m.monto)}</td>
        </tr>
    `).join("");
};

// --- WALLET ---
export const renderWalletUI = (stats) => { /* Se mantiene igual */ };
