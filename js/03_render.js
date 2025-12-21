/* 03_render.js */
import { $, fmtMoney, formatearFecha } from './01_consts_utils.js';

/* ==========================================================================
   NAVEGACIÓN GLOBAL (MENÚ HAMBURGUESA - BLINDADO)
   ========================================================================== */
export const renderGlobalMenu = () => {
    // 1. Buscar contenedor. Si no existe, buscar el header. Si no, al body.
    let container = document.querySelector(".header-actions");
    
    if (!container) {
        console.warn("No se encontró .header-actions, intentando inyectar en header...");
        const header = document.querySelector(".header");
        if (header) {
            container = document.createElement("div");
            container.className = "header-actions";
            header.appendChild(container);
        } else {
            console.error("CRÍTICO: No hay <header> en el HTML. El menú flotará.");
            container = document.createElement("div");
            container.className = "header-actions";
            container.style.position = "fixed";
            container.style.top = "10px";
            container.style.right = "10px";
            container.style.zIndex = "1000";
            document.body.prepend(container);
        }
    }

    // 2. Evitar duplicados
    if (document.getElementById("nav-dropdown-global")) return;

    // 3. HTML del Menú
    const menuHTML = `
        <div id="nav-dropdown-global" class="nav-dropdown">
            <button class="btn-hamburger" type="button" aria-label="Abrir Menú">
                ☰
            </button>
            <div class="nav-content">
                <a href="index.html">📊 Panel Principal</a>
                <a href="wallet.html">💰 Mi Alcancía (Wallet)</a>
                <a href="admin.html">⚙️ Administración</a>
                <a href="historial.html">📜 Historial</a>
            </div>
        </div>
    `;
    
    // 4. Inyección segura
    container.innerHTML = menuHTML; // Limpia botones viejos y pone el menú

    // 5. Event Listeners (Click Toggle)
    const btn = container.querySelector(".btn-hamburger");
    const content = container.querySelector(".nav-content");
    
    if (btn && content) {
        btn.onclick = (e) => {
            e.stopPropagation(); // Evita que el click llegue al document
            const isVisible = content.style.display === 'block';
            content.style.display = isVisible ? 'none' : 'block';
            btn.style.background = isVisible ? 'transparent' : '#f1f5f9';
        };

        // Cerrar al hacer click fuera
        document.addEventListener('click', (e) => {
            if (!container.contains(e.target)) {
                content.style.display = 'none';
                btn.style.background = 'transparent';
            }
        });
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
        if(txtEstado) {
            txtEstado.innerHTML = `🟢 <b>Turno Activo</b><br>Inicio: ${new Date(turnoActivo.inicio).toLocaleTimeString()}<br>KM Inicial: ${turnoActivo.kmInicial}`;
            txtEstado.style.color = "#16a34a";
        }
        if (divCierre) divCierre.style.display = "block";
    } else {
        btnInicio.style.display = "block";
        btnFin.style.display = "none";
        if(txtEstado) {
            txtEstado.innerText = "🔴 Sin turno activo";
            txtEstado.style.color = "#dc2626";
        }
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
        listaAlertas.innerHTML = stats.alertas.length > 0 
            ? stats.alertas.map(a => `<li>${a}</li>`).join("")
            : `<li style="color:#16a34a; border-color:#bbf7d0; background:#f0fdf4">✅ Todo en orden.</li>`;
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
            : `<tr><td colspan="4" style="text-align:center">Sin turnos recientes</td></tr>`;
    }
};

/* ==========================================================================
   RENDER: HISTORIAL
   ========================================================================== */
export const renderHistorial = (movimientos) => {
    const tbody = $("historialBody");
    if (!tbody) return;
    
    if (movimientos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:20px;">No hay movimientos registrados.</td></tr>`;
        return;
    }
    
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
