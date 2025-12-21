/* 03_render.js */
import { $, fmtMoney, safeNumber, formatearFecha, isSameDay } from './01_consts_utils.js';
import * as Data from './02_data.js';

// Helper de eventos seguro
const safeClick = (id, fn) => {
    const el = $(id);
    if (el) el.onclick = fn;
};

/* ==========================================================================
   NAVEGACIÓN GLOBAL (MENÚ HAMBURGUESA)
   ========================================================================== */
export const renderGlobalMenu = () => {
    const container = document.querySelector(".header-actions");
    if (!container) return; // Si no hay header, no hacemos nada (login?)

    // Evitar duplicados limpiando botones previos si existen
    // (Preservando botones específicos si se desea, pero aquí estandarizamos)
    const hasMenu = document.getElementById("nav-dropdown-global");
    if (hasMenu) return;

    // Crear estructura del menú
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
    
    // Insertar al principio o final, dependiendo del diseño.
    // En este caso, lo agregamos al container existente.
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = menuHTML;
    container.appendChild(tempDiv.firstElementChild);

    // Lógica de Toggle
    const btn = container.querySelector(".btn-hamburger");
    const content = container.querySelector(".nav-content");
    
    if (btn && content) {
        btn.onclick = (e) => {
            e.stopPropagation();
            content.style.display = content.style.display === 'block' ? 'none' : 'block';
        };
        // Cerrar al hacer click fuera
        document.addEventListener('click', () => {
            content.style.display = 'none';
        });
    }
};

/* ==========================================================================
   RENDER: ADMIN
   ========================================================================== */
export const renderTurnoUI = () => {
    const turno = Data.getTurnoActivo();
    const btnInicio = $("btnIniciarTurno");
    const btnFin = $("btnFinalizarTurno");
    const txtEstado = $("turnoTexto");
    const divCierre = $("cierreTurnoContainer");

    if (!btnInicio || !btnFin) return;

    if (turno) {
        btnInicio.style.display = "none";
        btnFin.style.display = "block";
        txtEstado.innerHTML = `🟢 <b>Turno Activo</b><br>Inicio: ${new Date(turno.inicio).toLocaleTimeString()}<br>KM Inicial: ${turno.kmInicial}`;
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

export const renderMetaDiaria = () => {
    const el = $("metaDiariaDisplay");
    if (!el) return;
    const meta = Data.getState().parametros.gastoFijo;
    el.innerText = `$${fmtMoney(meta)}`;
};

export const renderListasAdmin = () => {
    const s = Data.getState();
    const ulDeudas = $("listaDeudas");
    
    if (ulDeudas) {
        ulDeudas.innerHTML = s.deudas.map(d => `
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
    
    // Llenar select de abonos
    const selAbono = $("abonoSeleccionar");
    if (selAbono) {
        selAbono.innerHTML = `<option value="">Selecciona Deuda...</option>` +
            s.deudas.filter(d => d.saldo > 0).map(d => `<option value="${d.id}">${d.desc} ($${d.saldo})</option>`).join("");
    }
};

/* ==========================================================================
   RENDER: DASHBOARD (INDEX)
   ========================================================================== */
export const renderDashboard = () => {
    const s = Data.getState();
    const hoy = new Date();
    
    // Filtrar turnos y movimientos de HOY
    const turnosHoy = s.turnos.filter(t => isSameDay(t.fecha, hoy));
    const movsHoy = s.movimientos.filter(m => isSameDay(m.fecha, hoy));
    
    // Cálculos rápidos
    const gananciaHoy = movsHoy.filter(m => m.tipo === 'ingreso').reduce((acc, m) => acc + m.monto, 0);
    const horasHoy = turnosHoy.reduce((acc, t) => acc + t.horas, 0);
    
    // Render
    const setTxt = (id, val) => { if($(id)) $(id).innerText = val; };
    
    setTxt("resHoras", `${horasHoy.toFixed(1)}h`);
    setTxt("resGananciaBruta", `$${fmtMoney(gananciaHoy)}`);
    
    // Meta vs Realidad
    const meta = s.parametros.gastoFijo;
    setTxt("dashboardMeta", `$${fmtMoney(meta)}`);
    
    const progreso = meta > 0 ? (gananciaHoy / meta) * 100 : 0;
    const barra = $("progresoBarra");
    if (barra) barra.style.width = `${Math.min(progreso, 100)}%`;
    setTxt("progresoTexto", `${progreso.toFixed(0)}%`);

    // Alertas
    const listaAlertas = $("listaAlertas");
    if (listaAlertas) {
        listaAlertas.innerHTML = "";
        if (s.parametros.ultimoKMfinal === 0) {
            listaAlertas.innerHTML += `<li>⚠️ Configura tu Odómetro inicial en Admin.</li>`;
        }
        if (meta === 0) {
            listaAlertas.innerHTML += `<li>⚠️ Registra gastos fijos para calcular tu Meta.</li>`;
        }
    }
    
    // Tabla Turnos Recientes
    const tbody = $("tablaTurnos");
    if (tbody) {
        tbody.innerHTML = s.turnos.slice(-5).reverse().map(t => `
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
export const renderHistorial = () => {
    const tbody = $("historialBody");
    if (!tbody) return;
    
    const movs = Data.getState().movimientos.slice().reverse(); // Más reciente primero
    
    tbody.innerHTML = movs.map(m => `
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
export const renderWalletUI = () => {
    const s = Data.getState();
    const diaDelMes = new Date().getDate();
    
    // 1. Calcular Obligación Acumulada del Mes (Teórica)
    // "Hoy es día X, debí haber guardado Y cantidad"
    const metaDiaria = s.parametros.gastoFijo;
    const acumuladoTeorico = metaDiaria * diaDelMes;
    
    const elTeorico = $("walletTotalObligado");
    if (elTeorico) elTeorico.innerText = `$${fmtMoney(acumuladoTeorico)}`;

    // 2. Calcular Realidad (Ingresos - Gastos ya hechos)
    // Esto es simplificado. En un sistema real de sobres requeriría asignar dinero a cada sobre.
    // Aquí asumimos que Ganancia Neta = Lo que tengo disponible.
    const ingresosMes = s.movimientos.reduce((sum, m) => m.tipo === 'ingreso' ? sum + m.monto : sum, 0);
    const gastosMes = s.movimientos.reduce((sum, m) => m.tipo === 'gasto' ? sum + m.monto : sum, 0);
    const saldoReal = ingresosMes - gastosMes;

    const elSaldo = $("walletSaldoReal");
    if (elSaldo) {
        elSaldo.innerText = `$${fmtMoney(saldoReal)}`;
        elSaldo.style.color = saldoReal >= acumuladoTeorico ? "#16a34a" : "#dc2626";
    }
};

/* ==========================================================================
   SETUP LISTENERS (ADMIN)
   ========================================================================== */
export const setupAdminListeners = () => {
    // Turnos
    safeClick("btnIniciarTurno", () => {
        // En un flujo real pediría KM inicial, aquí asumimos el último o 0
        const ultimoKM = Data.getState().parametros.ultimoKMfinal || 0;
        const kmInput = prompt(`Confirma KM Inicial (Sugerido: ${ultimoKM}):`, ultimoKM);
        if (kmInput) {
            Data.iniciarTurno(kmInput);
            renderTurnoUI();
            window.location.reload(); 
        }
    });

    safeClick("btnFinalizarTurno", () => {
        const t = Data.getTurnoActivo();
        if (!t) return;
        
        const kmInput = prompt("KM Final del odómetro:");
        const dineroInput = prompt("Ganancia Total ($) del turno:");
        const gasInput = prompt("¿Gastaste Gasolina hoy? (Monto $, pon 0 si no):", "0");
        
        if (kmInput && dineroInput) {
            Data.finalizarTurno(kmInput, dineroInput, gasInput);
            renderTurnoUI();
            alert("✅ Turno finalizado y guardado.");
            window.location.reload();
        }
    });

    // Abonos
    safeClick("btnRegistrarAbono", () => {
        const id = $("abonoSeleccionar").value;
        const monto = $("abonoMonto").value;
        if (id && monto) {
            Data.registrarAbono(id, monto);
            alert("Abono registrado.");
            window.location.reload();
        }
    });
    
    // Respaldo
    safeClick("btnCopiarJSON", () => {
        const dataStr = JSON.stringify(Data.getState(), null, 2);
        navigator.clipboard.writeText(dataStr).then(() => alert("Datos copiados al portapapeles"));
    });
};
