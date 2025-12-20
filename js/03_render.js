/* 03_render.js - Capa Visual y Eventos (FIXED) */
import { $, fmtMoney, CATEGORIAS_GASTOS, formatearFecha, safeNumber, STORAGE_KEY, isSameDay } from './01_consts_utils.js';
import * as Data from './02_data.js';

const safeClick = (id, fn) => { const el = $(id); if (el) el.onclick = fn; };
const TODAY = new Date(); 

/* ==========================================================================
   NAVEGACIÓN GLOBAL (MENÚ HAMBURGUESA + BOTÓN VOLVER)
   ========================================================================== */
export const renderGlobalMenu = () => {
    const container = document.querySelector(".header-actions");
    if (!container) return;

    // Detectar si estamos en Admin para asegurar botón de salida
    const esAdmin = document.body.getAttribute('data-page') === 'admin';
    
    // HTML del Menú
    const menuHTML = `
        <div class="nav-dropdown" style="position:relative; display:inline-block;">
            <button class="btn-hamburger" type="button" style="cursor:pointer; padding:8px 12px; border:1px solid #ccc; background:#fff; border-radius:6px;">☰</button>
            <div class="nav-content" style="display:none; position:absolute; right:0; top:110%; background:#fff; border:1px solid #eee; min-width:180px; box-shadow:0 4px 6px rgba(0,0,0,0.1); z-index:9999; border-radius:6px;">
                <a href="index.html" style="display:block; padding:10px; text-decoration:none; color:#333; border-bottom:1px solid #f0f0f0;">📊 Panel Principal</a>
                <a href="wallet.html" style="display:block; padding:10px; text-decoration:none; color:#333; border-bottom:1px solid #f0f0f0;">💰 Mi Alcancía</a>
                <a href="admin.html" style="display:block; padding:10px; text-decoration:none; color:#333; border-bottom:1px solid #f0f0f0;">⚙️ Administración</a>
                <a href="historial.html" style="display:block; padding:10px; text-decoration:none; color:#333; border-bottom:1px solid #f0f0f0;">📜 Historial</a>
                <a href="tutorial.html" style="display:block; padding:10px; text-decoration:none; color:#333;">🎓 Ayuda</a>
            </div>
        </div>
    `;

    // Si es Admin, forzamos el botón VOLVER antes del menú
    if (esAdmin) {
        container.innerHTML = `
            <a href="index.html" class="btn-admin" style="margin-right:10px; text-decoration:none; padding:8px 12px; background:#e2e8f0; color:#333; border-radius:6px;">⬅ Volver</a>
            ${menuHTML}
        `;
    } else {
        container.innerHTML = menuHTML;
    }

    // Lógica del Click (Delegación directa para asegurar funcionamiento)
    const btn = container.querySelector(".btn-hamburger");
    const menu = container.querySelector(".nav-content");
    
    if(btn && menu) {
        btn.onclick = (e) => { 
            e.stopPropagation(); 
            // Toggle simple
            menu.style.display = (menu.style.display === 'block') ? 'none' : 'block'; 
        };
        
        // Cerrar al hacer click fuera
        document.addEventListener('click', (e) => { 
            if (!menu.contains(e.target) && e.target !== btn) {
                menu.style.display = 'none'; 
            }
        });
    }
};

/* ==========================================================================
   RENDER WALLET UI
   ========================================================================== */
export const renderWalletUI = () => {
    const s = Data.getState();
    const set = (id, html) => { if($(id)) $(id).innerHTML = html; };

    let totalSobres = 0;
    const listaSobres = document.getElementById("walletListaSobres");
    if(listaSobres) {
        listaSobres.innerHTML = "";
        const diaHoy = new Date().getDate();
        
        s.gastosFijosMensuales.forEach(g => {
            const diasMes = 30;
            const montoMensual = safeNumber(g.monto) * (g.frecuencia === 'Semanal' ? 4 : g.frecuencia === 'Quincenal' ? 2 : 1);
            const diario = montoMensual / diasMes;
            const acumulado = diario * diaHoy; 
            totalSobres += acumulado;

            listaSobres.innerHTML += `
                <li style="display:flex; justify-content:space-between; border-bottom:1px solid #eee; padding:5px 0;">
                    <span>${g.categoria} <small>(${g.frecuencia})</small></span>
                    <strong>$${fmtMoney(acumulado)}</strong>
                </li>
            `;
        });
    }

    const totalKm = s.turnos.reduce((sum, t) => sum + safeNumber(t.kmRecorridos), 0);
    const totalGasCost = s.cargasCombustible.reduce((sum, c) => sum + safeNumber(c.costo), 0);
    const costoPromedio = totalKm > 0 ? (totalGasCost / totalKm) : 0;
    
    const gasNecesario = totalKm * costoPromedio;
    const gasSaldo = gasNecesario - totalGasCost;

    set("walletGasKm", `${totalKm.toFixed(0)} KM`);
    set("walletGasCosto", `$${fmtMoney(costoPromedio)} /km`);
    set("walletGasNecesario", `$${fmtMoney(gasNecesario)}`);
    set("walletGasGastado", `-$${fmtMoney(totalGasCost)}`);
    
    const gasEl = $("walletGasSaldo");
    if(gasEl) {
        gasEl.innerText = `$${fmtMoney(gasSaldo)}`;
        gasEl.style.color = gasSaldo >= 0 ? "#10b981" : "#dc2626";
    }

    set("walletTotalObligado", `$${fmtMoney(totalSobres)}`);
    
    const totalIngresos = s.ingresos.reduce((sum, i) => sum + safeNumber(i.monto), 0);
    const totalGastos = s.gastos.reduce((sum, g) => sum + safeNumber(g.monto), 0); 
    // Ajuste simple para disponible
    const disponible = (totalIngresos - totalGastos - totalGasCost) - totalSobres; 

    set("walletDisponible", `$${fmtMoney(disponible)}`);
    if($("walletDisponible")) $("walletDisponible").style.color = disponible >= 0 ? "#10b981" : "#f59e0b";
};

/* ==========================================================================
   RENDER DASHBOARD (INDEX)
   ========================================================================== */
export const renderDashboard = () => {
    const s = Data.getState();
    
    // 1. Calcular Métricas de Hoy
    const turnosHoy = s.turnos.filter(t => isSameDay(t.fecha, TODAY));
    const horasHoy = turnosHoy.reduce((sum, t) => sum + safeNumber(t.horas), 0);
    const gananciaBrutaHoy = turnosHoy.reduce((sum, t) => sum + safeNumber(t.dineroGenerado), 0);
    
    const gastosHoy = s.movimientos
        .filter(m => m.tipo === 'gasto' && isSameDay(m.fecha, TODAY))
        .reduce((sum, m) => sum + safeNumber(m.monto), 0);

    const gananciaNetaHoy = gananciaBrutaHoy - gastosHoy;

    if($("resHoras")) $("resHoras").innerText = `${horasHoy.toFixed(2)}h`;
    if($("resGananciaBruta")) $("resGananciaBruta").innerText = `$${fmtMoney(gananciaBrutaHoy)}`;
    if($("resGananciaNeta")) {
        $("resGananciaNeta").innerText = `$${fmtMoney(gananciaNetaHoy)}`;
        $("resGananciaNeta").style.color = gananciaNetaHoy >= 0 ? "#10b981" : "#dc2626";
    }

    // 2. Alertas
    const listaAlertas = $("listaAlertas");
    if(listaAlertas) {
        listaAlertas.innerHTML = "";
        let alertas = [];
        const meta = s.parametros.gastoFijo || 0;
        
        if (gananciaNetaHoy < meta) {
            alertas.push(`⚠️ Te faltan <strong>$${fmtMoney(meta - gananciaNetaHoy)}</strong> para Meta Diaria.`);
        } else {
            alertas.push(`✅ ¡Meta Diaria cubierta!`);
        }

        const kmTotal = s.parametros.ultimoKMfinal || 0;
        Object.entries(s.parametros.mantenimientoBase).forEach(([item, limite]) => {
            if (kmTotal >= limite) alertas.push(`🔧 <strong>${item}</strong> requiere revisión.`);
        });

        if(alertas.length > 0) {
            $("cardAlertas").classList.remove("hidden");
            alertas.forEach(html => {
                const li = document.createElement("li"); li.innerHTML = html;
                listaAlertas.appendChild(li);
            });
        }
    }

    // 3. Tabla Últimos Turnos
    const tbody = $("tablaTurnos");
    if(tbody) {
        tbody.innerHTML = "";
        s.turnos.slice().reverse().slice(0, 5).forEach(t => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${formatearFecha(t.fecha)}</td>
                <td>${t.horas.toFixed(1)}h</td>
                <td>${t.kmRecorridos}</td>
                <td>$${fmtMoney(t.ganancia)}</td>
            `;
            tbody.appendChild(tr);
        });
    }
};

/* ==========================================================================
   RENDER HISTORIAL
   ========================================================================== */
export const renderHistorial = () => {
    const s = Data.getState();
    const tbody = $("historialBody");
    if(!tbody) return;
    
    tbody.innerHTML = "";
    let listado = [...s.movimientos];
    s.turnos.forEach(t => {
        listado.push({
            tipo: 'ingreso',
            fecha: t.fecha,
            desc: 'Cierre de Turno',
            monto: t.dineroGenerado
        });
    });

    listado.sort((a,b) => new Date(b.fecha) - new Date(a.fecha));

    listado.forEach(m => {
        const tr = document.createElement("tr");
        const color = m.tipo === 'ingreso' ? 'text-success' : 'text-danger';
        const signo = m.tipo === 'ingreso' ? '+' : '-';
        tr.innerHTML = `
            <td><span class="badge ${m.tipo}">${m.tipo.toUpperCase()}</span></td>
            <td>${formatearFecha(m.fecha)}</td>
            <td>${m.desc}</td>
            <td class="${color}"><strong>${signo}$${fmtMoney(m.monto)}</strong></td>
        `;
        tbody.appendChild(tr);
    });
};

/* ==========================================================================
   ADMIN UI: RENDERIZADO
   ========================================================================== */
export const renderTurnoUI = () => {
    const activo = Data.getTurnoActivo();
    const txt = $("turnoTexto");
    const btnIni = $("btnIniciarTurno");
    const btnFin = $("btnFinalizarTurno");
    const cierre = $("cierreTurnoContainer");

    if (!txt) return;

    if (activo) {
        const inicio = new Date(activo.inicio);
        txt.innerHTML = `🟢 <strong>Turno Activo</strong> <br><small>Inicio: ${inicio.toLocaleTimeString()}</small>`;
        btnIni.style.display = "none";
        btnFin.style.display = "block";
    } else {
        txt.innerText = "🔴 Sin turno activo";
        btnIni.style.display = "block";
        btnFin.style.display = "none";
        cierre.style.display = "none";
    }
};

export const renderListasAdmin = () => {
    const s = Data.getState();
    
    const ulFijos = $("listaGastosFijos");
    if(ulFijos) {
        ulFijos.innerHTML = "";
        s.gastosFijosMensuales.forEach((g, idx) => {
            const li = document.createElement("li");
            li.style.display = "flex"; li.style.justifyContent = "space-between";
            li.innerHTML = `
                <span>${g.categoria} (${g.frecuencia})</span>
                <span>$${fmtMoney(g.monto)} <button class="btn-danger btn-sm" onclick="eliminarGastoFijo(${idx})">X</button></span>
            `;
            ulFijos.appendChild(li);
        });
    }

    const ulDeudas = $("listaDeudas");
    const selDeudas = $("abonoSeleccionar");
    if(ulDeudas) {
        ulDeudas.innerHTML = "";
        if(selDeudas) selDeudas.innerHTML = "";
        
        s.deudas.forEach(d => {
            if(d.saldo > 0.1) {
                ulDeudas.innerHTML += `<li><strong>${d.desc}</strong>: Restan $${fmtMoney(d.saldo)}</li>`;
                if(selDeudas) {
                    const o = document.createElement("option"); o.value = d.id; o.text = d.desc;
                    selDeudas.add(o);
                }
            }
        });
    }
};

window.eliminarGastoFijo = (idx) => {
    const s = Data.getState();
    if(confirm("¿Borrar gasto fijo?")) {
        s.gastosFijosMensuales.splice(idx, 1);
        Data.recalcularMetaDiaria();
        renderListasAdmin();
    }
};

export const renderOdometroUI = () => { /* Implementado en Wizard */ };
export const renderMantenimientoUI = () => {
    const list = $("mantenimientoList");
    if(!list) return;
    const s = Data.getState();
    const km = s.parametros.ultimoKMfinal || 0;
    
    list.innerHTML = "";
    Object.entries(s.parametros.mantenimientoBase).forEach(([parte, vidaUtil]) => {
        const estado = km % vidaUtil; 
        const pct = (estado / vidaUtil) * 100;
        const color = pct > 90 ? 'red' : pct > 75 ? 'orange' : 'green';
        
        list.innerHTML += `
            <div class="mantenimiento-item" style="border-left: 4px solid ${color}; padding-left:10px; margin-bottom:5px;">
                <strong>${parte}</strong>
                <div style="font-size:0.8rem; color:#666;">Ciclo: ${vidaUtil}km</div>
            </div>
        `;
    });
};

export const renderMetaDiaria = () => {
    const meta = Data.getState().parametros.gastoFijo || 0;
    if($("metaDiariaDisplay")) $("metaDiariaDisplay").innerText = `$${fmtMoney(meta)}`;
};

/* ==========================================================================
   LISTENERS (EVENTOS) - ADMIN
   ========================================================================== */
export const setupAdminListeners = () => {
    // 1. Turnos
    safeClick("btnIniciarTurno", () => {
        const turno = { inicio: new Date().toISOString() };
        localStorage.setItem("turnoActivo", JSON.stringify(turno));
        window.location.reload();
    });

    safeClick("btnFinalizarTurno", () => {
        $("cierreTurnoContainer").style.display = "block";
        $("btnFinalizarTurno").style.display = "none";
    });

    safeClick("btnCancelarCierre", () => {
        $("cierreTurnoContainer").style.display = "none";
        $("btnFinalizarTurno").style.display = "block";
    });

    safeClick("btnConfirmarCierre", () => {
        const dinero = safeNumber($("dineroGeneradoInput").value);
        const kmFinal = safeNumber($("kmFinalInput").value);
        const turnoActivo = Data.getTurnoActivo();
        
        if (!turnoActivo) return;
        const inicio = new Date(turnoActivo.inicio);
        const fin = new Date();
        const horas = (fin - inicio) / 36e5;
        
        Data.getState().turnos.push({
            id: Date.now(),
            fecha: inicio.toISOString(),
            fin: fin.toISOString(),
            horas: horas,
            dineroGenerado: dinero,
            kmRecorridos: 0, 
            ganancia: dinero 
        });
        
        if(kmFinal > 0) Data.getState().parametros.ultimoKMfinal = kmFinal;

        localStorage.removeItem("turnoActivo");
        Data.saveData();
        alert("Turno finalizado correctamente.");
        window.location.reload();
    });

    // 2. Gasolina Wizard
    safeClick("btnGasolinaPaso1", () => { 
        if(!$("gasolinaKmActual").value) return alert("Ingresa KM");
        $("gasolinaPaso1").style.display='none'; $("gasolinaPaso2").style.display='block'; 
    });
    safeClick("btnGasolinaPaso2", () => { 
        if(!$("gasolinaLitros").value) return alert("Ingresa Litros");
        $("gasolinaPaso2").style.display='none'; $("gasolinaPaso3").style.display='block'; 
    });
    safeClick("btnRegistrarGasolina", () => {
        const costo = safeNumber($("gasolinaCosto").value);
        const litros = safeNumber($("gasolinaLitros").value);
        const km = safeNumber($("gasolinaKmActual").value);
        if(costo <= 0) return alert("Costo inválido");

        Data.agregarMovimiento({ tipo:'gasto', fecha: new Date().toISOString(), desc: 'Gasolina', monto: costo, categoria: 'Gasolina' });
        Data.getState().cargasCombustible.push({ fecha: new Date().toISOString(), km: km, litros: litros, costo: costo });
        Data.getState().parametros.ultimoKMfinal = km;
        Data.saveData();
        alert("Carga registrada");
        window.location.reload();
    });

    // 3. Gastos Wizard
    const selTipo = $("gastoTipo");
    const selCat = $("gastoCategoria");
    if(selTipo) {
        selTipo.onchange = () => {
            const val = selTipo.value;
            selCat.innerHTML = "";
            if(CATEGORIAS_GASTOS[val]) {
                CATEGORIAS_GASTOS[val].forEach(c => {
                    const opt = document.createElement("option"); opt.value = c; opt.text = c;
                    selCat.add(opt);
                });
            }
        };
    }
    safeClick("btnGastoPaso1", () => {
        if(!selTipo.value) return alert("Selecciona tipo");
        $("gastoPaso1").style.display='none'; $("gastoPaso2").style.display='block';
    });
    safeClick("btnRegistrarGasto", () => {
        const monto = safeNumber($("gastoMonto").value);
        if(monto <= 0) return alert("Monto inválido");
        const desc = $("gastoDesc").value || $("gastoCategoria").value;
        Data.agregarMovimiento({ tipo: 'gasto', fecha: new Date().toISOString(), desc: desc, monto: monto, categoria: $("gastoTipo").value });
        alert("Gasto guardado");
        window.location.reload();
    });

    // 4. Deudas y Fijos
    safeClick("btnAgregarGastoFijo", () => {
        const n = $("gastoFijoNombre").value;
        const m = safeNumber($("gastoFijoMonto").value);
        if(n && m > 0) {
            Data.getState().gastosFijosMensuales.push({ categoria: n, monto: m, frecuencia: $("gastoFijoFrecuencia").value, diaPago: $("gastoFijoDia").value });
            Data.recalcularMetaDiaria();
            renderListasAdmin();
            $("gastoFijoNombre").value = ""; $("gastoFijoMonto").value = "";
        }
    });

    safeClick("btnNuevaDeudaWizard", () => { $("deudaWizard").style.display = "block"; });
    safeClick("btnRegistrarDeudaFinal", () => {
        Data.agregarDeuda({
            id: Date.now(),
            desc: $("deudaNombre").value,
            montoTotal: $("deudaMontoTotal").value,
            montoCuota: $("deudaMontoCuota").value,
            frecuencia: $("deudaFrecuencia").value,
            saldo: Number($("deudaMontoTotal").value)
        });
        alert("Deuda guardada");
        window.location.reload();
    });

    safeClick("btnRegistrarAbono", () => {
        const id = $("abonoSeleccionar").value;
        const m = $("abonoMonto").value;
        if(m && id) {
            const d = Data.getState().deudas.find(x => x.id == id);
            if(d) {
                d.saldo -= safeNumber(m);
                Data.agregarMovimiento({tipo:'gasto', fecha:new Date().toISOString(), desc:`Abono: ${d.desc}`, monto:safeNumber(m)});
                Data.recalcularMetaDiaria();
                alert("Abono registrado");
                window.location.reload();
            }
        }
    });

    // 5. IMPORTAR / EXPORTAR
    safeClick("btnImportar", () => {
        const json = $("importJson").value;
        if (!json) return alert("❌ Pega el JSON primero.");
        if (Data.importarDesdeJson(json)) {
            alert("✅ Restaurado.");
            window.location.reload();
        } else {
            alert("⚠️ Error JSON.");
        }
    });

    safeClick("btnExportar", () => {
        if (typeof XLSX === 'undefined') {
            alert("Sin Excel. Copiando a portapapeles.");
            navigator.clipboard.writeText(JSON.stringify(Data.getState()));
            return;
        }
        const s = Data.getState();
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(s.turnos), "Turnos");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(s.movimientos), "Movimientos");
        XLSX.writeFile(wb, "Respaldo_Tracker.xlsx");
    });
    
    safeClick("btnCopiarJSON", () => {
        navigator.clipboard.writeText(JSON.stringify(Data.getState())).then(() => alert("Copiado."));
    });
};
           
