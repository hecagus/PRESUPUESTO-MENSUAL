/* 03_render.js - VERSIÓN DEBUG */
import { $, fmtMoney, formatearFecha } from './01_consts_utils.js';

/* ==========================================================================
   NAVEGACIÓN GLOBAL (FIX: VISIBILIDAD)
   ========================================================================== */
export const renderGlobalMenu = () => {
    console.log("🛠️ Intentando renderizar menú...");
    
    // 1. Buscar contenedor
    let container = document.querySelector(".header-actions");
    
    // 2. Si no existe, crearlo y pegarlo al header
    if (!container) {
        console.warn("⚠️ .header-actions no existe. Creándolo manualmente.");
        const header = document.querySelector(".header");
        if (header) {
            container = document.createElement("div");
            container.className = "header-actions";
            header.appendChild(container);
        } else {
            console.error("⛔ ERROR CRÍTICO: No hay <header> en el HTML.");
            return;
        }
    }

    // 3. Verificar si ya tiene contenido (Evitar duplicados)
    if (document.getElementById("nav-dropdown-global")) {
        console.log("✅ El menú ya existe. Saliendo.");
        return;
    }

    // 4. Inyección HTML
    container.innerHTML = `
        <div id="nav-dropdown-global" class="nav-dropdown">
            <button class="btn-hamburger" type="button" aria-label="Abrir Menú">☰</button>
            <div class="nav-content">
                <a href="index.html">📊 Panel Principal</a>
                <a href="wallet.html">💰 Mi Alcancía</a>
                <a href="admin.html">⚙️ Administración</a>
                <a href="historial.html">📜 Historial</a>
            </div>
        </div>
    `;
    console.log("✅ HTML del menú inyectado.");

    // 5. Listener
    const btn = container.querySelector(".btn-hamburger");
    const content = container.querySelector(".nav-content");
    
    if (btn && content) {
        btn.onclick = (e) => {
            e.stopPropagation();
            // Toggle simple
            if (content.style.display === 'block') {
                content.style.display = 'none';
                btn.style.backgroundColor = '#f1f5f9';
            } else {
                content.style.display = 'block';
                btn.style.backgroundColor = '#cbd5e1';
            }
        };
        // Cerrar al click fuera
        document.addEventListener('click', (e) => {
            if (!container.contains(e.target)) {
                content.style.display = 'none';
                btn.style.backgroundColor = '#f1f5f9';
            }
        });
    }
};

/* ==========================================================================
   DASHBOARD
   ========================================================================== */
export const renderDashboard = (stats) => {
    if (!stats) return;

    const setTxt = (id, val) => { const el = $(id); if(el) el.innerText = val; };
    
    setTxt("resHoras", `${stats.horasHoy.toFixed(1)}h`);
    setTxt("resGananciaBruta", `$${fmtMoney(stats.gananciaHoy)}`);
    setTxt("dashboardMeta", `$${fmtMoney(stats.meta)}`);
    setTxt("progresoTexto", `${stats.progreso.toFixed(0)}%`);

    const barra = $("progresoBarra");
    if (barra) {
        barra.style.width = `${Math.min(stats.progreso, 100)}%`;
        if (stats.progreso === 0) barra.style.width = "4px"; // Mínimo visible
    }

    const listaAlertas = $("listaAlertas");
    if (listaAlertas) {
        if (stats.alertas && stats.alertas.length > 0) {
            listaAlertas.innerHTML = stats.alertas.map(a => `<li>${a}</li>`).join("");
        } else {
            listaAlertas.innerHTML = `<li style="background:#f0fdf4; color:#166534; border-color:#bbf7d0;">✅ Sin alertas activas.</li>`;
        }
    }
    
    const tbody = $("tablaTurnos");
    if (tbody) {
        if (stats.turnosRecientes && stats.turnosRecientes.length > 0) {
            tbody.innerHTML = stats.turnosRecientes.map(t => `
                <tr>
                    <td>${formatearFecha(t.fecha)}</td>
                    <td>${t.horas.toFixed(1)}h</td>
                    <td>${t.kmRecorridos}km</td>
                    <td>$${fmtMoney(t.ganancia)}</td>
                </tr>
            `).join("");
        } else {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:15px; color:#64748b;">No hay turnos hoy.</td></tr>`;
        }
    }
};

/* ==========================================================================
   ADMIN
   ========================================================================== */
export const renderTurnoControl = (turnoActivo) => {
    const btnInicio = $("btnIniciarTurno");
    const btnFin = $("btnFinalizarTurno");
    const txtEstado = $("turnoTexto");

    if (turnoActivo) {
        if(btnInicio) btnInicio.style.display = "none";
        if(btnFin) btnFin.style.display = "block";
        if(txtEstado) txtEstado.innerHTML = `<span style="color:#16a34a; font-weight:bold;">🟢 Turno Activo (${new Date(turnoActivo.inicio).toLocaleTimeString()})</span>`;
    } else {
        if(btnInicio) btnInicio.style.display = "block";
        if(btnFin) btnFin.style.display = "none";
        if(txtEstado) txtEstado.innerHTML = `<span style="color:#dc2626;">🔴 Turno cerrado</span>`;
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
        if (!deudas || deudas.length === 0) {
            ul.innerHTML = `<li style="text-align:center; color:#94a3b8; padding:10px;">Sin deudas registradas.</li>`;
        } else {
            ul.innerHTML = deudas.map(d => `
                <li class="list-item">
                    <div><b>${d.desc}</b> <small>(${d.frecuencia})</small></div>
                    <div style="color:${d.saldo>0?'#dc2626':'#16a34a'}">$${fmtMoney(d.saldo)}</div>
                </li>`).join("");
        }
    }

    if (sel && deudas) {
        sel.innerHTML = `<option value="">Selecciona Deuda...</option>` +
            deudas.filter(d => d.saldo > 0).map(d => `<option value="${d.id}">${d.desc} ($${d.saldo})</option>`).join("");
    }
};

/* ==========================================================================
   HISTORIAL & WALLET
   ========================================================================== */
export const renderHistorial = (movs) => {
    const tbody = $("historialBody");
    if (!tbody) return;
    
    if (!movs || movs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:20px; color:#64748b;">Sin movimientos.</td></tr>`;
        return;
    }

    tbody.innerHTML = movs.slice().reverse().map(m => `
        <tr>
            <td><span class="badge" style="background:${m.tipo==='ingreso'?'#dcfce7':'#fee2e2'}; color:${m.tipo==='ingreso'?'#166534':'#991b1b'}; padding:2px 5px; border-radius:4px; font-size:0.8rem;">
                ${m.tipo.toUpperCase()}</span></td>
            <td>${formatearFecha(m.fecha)}</td>
            <td>${m.desc} <small>(${m.categoria||'-'})</small></td>
            <td>$${fmtMoney(m.monto)}</td>
        </tr>
    `).join("");
};

export const renderWalletUI = (stats) => {
    if (!stats) return;
    const elTeorico = $("walletTotalObligado");
    const elReal = $("walletSaldoReal");
    if(elTeorico) elTeorico.innerText = `$${fmtMoney(stats.deberiasTener)}`;
    if(elReal) {
        elReal.innerText = `$${fmtMoney(stats.tienesRealmente)}`;
        elReal.style.color = stats.enMeta ? "#16a34a" : "#dc2626";
    }
};

