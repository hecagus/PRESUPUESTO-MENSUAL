/* 03_render.js - RENDERIZADO VISUAL */
import { $, fmtMoney, formatearFecha } from './01_consts_utils.js';

// --- NAVEGACIÓN (BOTONES VISIBLES) ---
export const renderGlobalMenu = () => {
    const header = document.querySelector('.header');
    if (!header) return;

    let actions = header.querySelector('.header-actions');
    if (!actions) {
        // Estructura header: [Top: Titulo] [Bottom: Botones]
        // Ya que el CSS maneja flex-direction: column en .header
        actions = document.createElement('div');
        actions.className = 'header-actions';
        header.appendChild(actions);
    }
    
    // Inyección de Botones
    actions.innerHTML = `
        <a href="index.html" class="nav-btn">
            📊 <span>Panel</span>
        </a>
        <a href="wallet.html" class="nav-btn">
            💰 <span>Wallet</span>
        </a>
        <a href="admin.html" class="nav-btn">
            ⚙️ <span>Admin</span>
        </a>
        <a href="historial.html" class="nav-btn">
            📜 <span>Historial</span>
        </a>
    `;

    // Marcar activo según URL
    const current = window.location.pathname.split("/").pop() || "index.html";
    const links = actions.querySelectorAll('a');
    links.forEach(l => {
        if(l.getAttribute('href') === current) l.classList.add('active');
    });
};

// --- DASHBOARD ---
export const renderDashboard = (stats) => {
    if (!stats) return;

    const set = (id, val) => { const el = $(id); if(el) el.innerText = val; };
    
    set("resHoras", `${stats.horasHoy.toFixed(1)}h`);
    set("resGananciaBruta", `$${fmtMoney(stats.gananciaHoy)}`);
    set("dashboardMeta", `$${fmtMoney(stats.meta)}`);
    set("progresoTexto", `${stats.progreso.toFixed(0)}%`);

    const barra = $("progresoBarra");
    if (barra) {
        barra.style.width = `${Math.min(stats.progreso, 100)}%`;
        if (stats.progreso === 0) barra.style.width = "2%";
    }

    const lista = $("listaAlertas");
    if (lista) {
        lista.innerHTML = stats.alertas.length > 0 
            ? stats.alertas.map(a => `<li>${a}</li>`).join("")
            : `<li style="background:#f0fdf4; color:#166534; border:1px solid #bbf7d0;">✅ Todo en orden</li>`;
    }
    
    const tbody = $("tablaTurnos");
    if (tbody) {
        tbody.innerHTML = stats.turnosRecientes.length > 0 
            ? stats.turnosRecientes.map(t => `
                <tr>
                    <td>${formatearFecha(t.fecha)}</td>
                    <td>${t.horas.toFixed(1)}h</td>
                    <td>${t.kmRecorridos}km</td>
                    <td>$${fmtMoney(t.ganancia)}</td>
                </tr>`).join("")
            : `<tr><td colspan="4" style="text-align:center; padding:15px; color:#94a3b8;">Sin actividad reciente</td></tr>`;
    }
};

// --- ADMIN ---
export const renderTurnoControl = (turnoActivo) => {
    const btnI = $("btnIniciarTurno");
    const btnF = $("btnFinalizarTurno");
    const txt = $("turnoTexto");

    if (turnoActivo) {
        if(btnI) btnI.style.display = "none";
        if(btnF) btnF.style.display = "block";
        if(txt) txt.innerHTML = `<div style="padding:10px; background:#dcfce7; color:#166534; border-radius:6px;">
            <strong>🟢 Turno en curso</strong><br>Inicio: ${new Date(turnoActivo.inicio).toLocaleTimeString()}</div>`;
    } else {
        if(btnI) btnI.style.display = "block";
        if(btnF) btnF.style.display = "none";
        if(txt) txt.innerHTML = `<div style="padding:10px; background:#f1f5f9; color:#64748b; border-radius:6px;">🔴 Sin turno activo</div>`;
    }
};

export const renderMetaDiaria = (monto) => {
    const el = $("metaDiariaDisplay");
    if (el) el.innerText = `$${fmtMoney(monto)}`;
};

export const renderAdminLists = (deudas) => {
    const ul = $("listaDeudas");
    const sel = $("abonoSeleccionar");
    
    if (ul) {
        ul.innerHTML = deudas.length > 0 
            ? deudas.map(d => `
                <li class="list-item" style="background:#fff; padding:10px; border:1px solid #e2e8f0; border-radius:6px; margin-bottom:5px; display:flex; justify-content:space-between;">
                    <div><b>${d.desc}</b> <small>(${d.frecuencia})</small></div>
                    <div style="color:${d.saldo>0?'#dc2626':'#16a34a'}">$${fmtMoney(d.saldo)}</div>
                </li>`).join("")
            : `<li style="text-align:center; color:#94a3b8; padding:10px;">No hay deudas activas.</li>`;
    }

    if (sel) {
        sel.innerHTML = `<option value="">Selecciona Deuda...</option>` +
            deudas.filter(d => d.saldo > 0).map(d => `<option value="${d.id}">${d.desc} ($${d.saldo})</option>`).join("");
    }
};

// --- WALLET & HISTORIAL ---
export const renderWalletUI = (stats) => {
    if (!stats) return;
    const elT = $("walletTotalObligado");
    const elR = $("walletSaldoReal");
    if(elT) elT.innerText = `$${fmtMoney(stats.deberiasTener)}`;
    if(elR) {
        elR.innerText = `$${fmtMoney(stats.tienesRealmente)}`;
        elR.style.color = stats.enMeta ? "#16a34a" : "#dc2626";
    }
};

export const renderHistorial = (movs) => {
    const tbody = $("historialBody");
    if (!tbody) return;
    
    tbody.innerHTML = movs.length > 0 
        ? movs.slice().reverse().map(m => `
            <tr>
                <td><span style="font-size:0.8rem; padding:2px 6px; border-radius:4px; background:${m.tipo==='ingreso'?'#dcfce7':'#fee2e2'}; color:${m.tipo==='ingreso'?'#166534':'#991b1b'}">
                    ${m.tipo.toUpperCase()}</span></td>
                <td>${formatearFecha(m.fecha)}</td>
                <td>${m.desc}</td>
                <td>$${fmtMoney(m.monto)}</td>
            </tr>`).join("")
        : `<tr><td colspan="4" style="text-align:center; padding:20px; color:#94a3b8;">Sin movimientos registrados.</td></tr>`;
};
