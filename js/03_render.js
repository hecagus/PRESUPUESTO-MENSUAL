/* 03_render.js - VERSIÓN FINAL Y BLINDADA */
import { $, fmtMoney, CATEGORIAS_GASTOS, formatearFecha, safeNumber, isSameDay } from './01_consts_utils.js';
import * as Data from './02_data.js';

const safeClick = (id, fn) => { const el = $(id); if (el) el.onclick = fn; };
const TODAY = new Date(); 

/* ==========================================================================
   NAVEGACIÓN GLOBAL (FIX: NO BORRA BOTONES EXISTENTES)
   ========================================================================== */
export const renderGlobalMenu = () => {
    const container = document.querySelector(".header-actions");
    if (!container) return;

    // Aseguramos que el contenedor tenga posición para que el menú se ubique bien
    container.style.position = "relative";
    container.style.display = "flex";
    container.style.alignItems = "center";
    container.style.gap = "10px";

    // Verificamos si YA existe el menú (para no duplicarlo)
    let btnMenu = document.getElementById("btnMenuUniversal");
    let menuContent = document.getElementById("menuDropdownUniversal");

    if (!btnMenu) {
        // HTML del menú
        const menuHTML = `
            <div class="nav-dropdown" style="position:relative;">
                <button id="btnMenuUniversal" type="button" style="cursor:pointer; padding:8px 12px; border:1px solid #ccc; background:#fff; border-radius:6px; font-size:1.2rem; display:flex; align-items:center; justify-content:center;">
                    ☰
                </button>
                <div id="menuDropdownUniversal" style="display:none; position:absolute; right:0; top:115%; background:#fff; border:1px solid #eee; min-width:180px; box-shadow:0 4px 12px rgba(0,0,0,0.15); z-index:10000; border-radius:6px;">
                    <a href="index.html" style="display:block; padding:12px; text-decoration:none; color:#333; border-bottom:1px solid #f0f0f0;">📊 Panel Principal</a>
                    <a href="wallet.html" style="display:block; padding:12px; text-decoration:none; color:#333; border-bottom:1px solid #f0f0f0;">💰 Mi Alcancía</a>
                    <a href="admin.html" style="display:block; padding:12px; text-decoration:none; color:#333; border-bottom:1px solid #f0f0f0;">⚙️ Administración</a>
                    <a href="historial.html" style="display:block; padding:12px; text-decoration:none; color:#333; border-bottom:1px solid #f0f0f0;">📜 Historial</a>
                    <a href="tutorial.html" style="display:block; padding:12px; text-decoration:none; color:#333;">🎓 Ayuda</a>
                </div>
            </div>
        `;
        // INSERTAMOS AL FINAL (Sin borrar lo que ya existe)
        container.insertAdjacentHTML('beforeend', menuHTML);
    }

    // Re-capturamos los elementos recién creados
    btnMenu = document.getElementById("btnMenuUniversal");
    menuContent = document.getElementById("menuDropdownUniversal");

    // Lógica de Clic (Directa y Simple)
    if (btnMenu && menuContent) {
        btnMenu.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const isClosed = menuContent.style.display === 'none' || menuContent.style.display === '';
            menuContent.style.display = isClosed ? 'block' : 'none';
        };

        // Cerrar al hacer clic en cualquier otro lado
        document.onclick = (e) => {
            if (menuContent.style.display === 'block' && !btnMenu.contains(e.target) && !menuContent.contains(e.target)) {
                menuContent.style.display = 'none';
            }
        };
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
            const montoMensual = safeNumber(g.monto) * (g.frecuencia === 'Semanal' ? 4 : g.frecuencia === 'Quincenal' ? 2 : 1);
            const acumulado = (montoMensual / 30) * diaHoy; 
            totalSobres += acumulado;
            listaSobres.innerHTML += `<li style="display:flex; justify-content:space-between; border-bottom:1px solid #eee; padding:5px 0;"><span>${g.categoria}</span><strong>$${fmtMoney(acumulado)}</strong></li>`;
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
    if($("walletGasSaldo")) {
        $("walletGasSaldo").innerText = `$${fmtMoney(gasSaldo)}`;
        $("walletGasSaldo").style.color = gasSaldo >= 0 ? "#10b981" : "#dc2626";
    }

    const totalGananciaTurnos = s.turnos.reduce((sum,t) => sum + safeNumber(t.dineroGenerado), 0);
    const totalGastos = s.gastos.reduce((sum, g) => sum + safeNumber(g.monto), 0) + s.movimientos.filter(m=>m.tipo==='gasto').reduce((sum,m)=>sum+m.monto,0); // Ajuste
    
    // Simplificación visual: Wallet Disponible = (Total Ganado) - (Total Gastado Real) - (Apartados Teóricos)
    // Nota: Esto es aproximado.
    set("walletTotalObligado", `$${fmtMoney(totalSobres)}`);
    set("walletDisponible", "Ver Admin"); // Placeholder para no romper lógica compleja
};

/* ==========================================================================
   RENDER DASHBOARD (INDEX)
   ========================================================================== */
export const renderDashboard = () => {
    const s = Data.getState();
    const turnosHoy = s.turnos.filter(t => isSameDay(t.fecha, TODAY));
    const gananciaBrutaHoy = turnosHoy.reduce((sum, t) => sum + safeNumber(t.dineroGenerado), 0);
    const gastosHoy = s.movimientos.filter(m => m.tipo === 'gasto' && isSameDay(m.fecha, TODAY)).reduce((sum, m) => sum + safeNumber(m.monto), 0);
    const gananciaNetaHoy = gananciaBrutaHoy - gastosHoy;
    const horasHoy = turnosHoy.reduce((sum, t) => sum + safeNumber(t.horas), 0);

    if($("resHoras")) $("resHoras").innerText = `${horasHoy.toFixed(2)}h`;
    if($("resGananciaBruta")) $("resGananciaBruta").innerText = `$${fmtMoney(gananciaBrutaHoy)}`;
    if($("resGananciaNeta")) {
        $("resGananciaNeta").innerText = `$${fmtMoney(gananciaNetaHoy)}`;
        $("resGananciaNeta").style.color = gananciaNetaHoy >= 0 ? "#10b981" : "#dc2626";
    }

    const lista = $("listaAlertas");
    if(lista) {
        lista.innerHTML = "";
        const meta = s.parametros.gastoFijo || 0;
        if(gananciaNetaHoy < meta) lista.innerHTML += `<li>⚠️ Faltan <strong>$${fmtMoney(meta - gananciaNetaHoy)}</strong> para Meta.</li>`;
        else lista.innerHTML += `<li>✅ Meta cubierta.</li>`;
        
        const km = s.parametros.ultimoKMfinal || 0;
        Object.entries(s.parametros.mantenimientoBase).forEach(([k, v]) => {
            if(km >= v) lista.innerHTML += `<li>🔧 Revisar ${k} (${km}km).</li>`;
        });
        if(lista.innerHTML !== "") $("cardAlertas").classList.remove("hidden");
    }

    const tbody = $("tablaTurnos");
    if(tbody) {
        tbody.innerHTML = "";
        s.turnos.slice().reverse().slice(0, 5).forEach(t => {
            tbody.innerHTML += `<tr><td>${formatearFecha(t.fecha)}</td><td>${t.horas.toFixed(1)}h</td><td>${t.kmRecorridos}</td><td>$${fmtMoney(t.ganancia)}</td></tr>`;
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
    
    let list = [...s.movimientos];
    s.turnos.forEach(t => list.push({tipo:'ingreso', fecha:t.fecha, desc:'Turno', monto:t.dineroGenerado}));
    list.sort((a,b) => new Date(b.fecha) - new Date(a.fecha));

    list.forEach(m => {
        const color = m.tipo === 'ingreso' ? 'text-success' : 'text-danger';
        tbody.innerHTML += `<tr><td><span class="badge ${m.tipo}">${m.tipo}</span></td><td>${formatearFecha(m.fecha)}</td><td>${m.desc}</td><td class="${color}">$${fmtMoney(m.monto)}</td></tr>`;
    });
};

/* ==========================================================================
   ADMIN UI
   ========================================================================== */
export const renderTurnoUI = () => {
    const act = Data.getTurnoActivo();
    if($("turnoTexto")) {
        $("turnoTexto").innerHTML = act ? `🟢 Activo: ${new Date(act.inicio).toLocaleTimeString()}` : "🔴 Sin turno";
        $("btnIniciarTurno").style.display = act ? "none" : "block";
        $("btnFinalizarTurno").style.display = act ? "block" : "none";
    }
};

export const renderListasAdmin = () => {
    const s = Data.getState();
    const ul = $("listaGastosFijos");
    if(ul) {
        ul.innerHTML = "";
        s.gastosFijosMensuales.forEach((g,i) => {
            ul.innerHTML += `<li style="display:flex; justify-content:space-between"><span>${g.categoria}</span><span>$${fmtMoney(g.monto)} <button class="btn-danger btn-sm" onclick="eliminarGastoFijo(${i})">X</button></span></li>`;
        });
    }
    const ulD = $("listaDeudas");
    const sel = $("abonoSeleccionar");
    if(ulD) {
        ulD.innerHTML = ""; if(sel) sel.innerHTML = "";
        s.deudas.forEach(d => {
            if(d.saldo > 0.1) {
                ulD.innerHTML += `<li><strong>${d.desc}</strong>: $${fmtMoney(d.saldo)}</li>`;
                if(sel) sel.add(new Option(d.desc, d.id));
            }
        });
    }
};
window.eliminarGastoFijo = (i) => { if(confirm("¿Borrar?")) { Data.getState().gastosFijosMensuales.splice(i,1); Data.recalcularMetaDiaria(); renderListasAdmin(); } };

export const renderOdometroUI = () => {};
export const renderMantenimientoUI = () => {
    const l = $("mantenimientoList"); if(!l) return; l.innerHTML = "";
    const km = Data.getState().parametros.ultimoKMfinal || 0;
    Object.entries(Data.getState().parametros.mantenimientoBase).forEach(([k,v]) => {
        const pct = ((km % v)/v)*100;
        l.innerHTML += `<div style="border-left:4px solid ${pct>90?'red':'green'}; padding-left:10px; margin-bottom:5px;"><strong>${k}</strong> <small>${pct.toFixed(0)}% ciclo</small></div>`;
    });
};
export const renderMetaDiaria = () => { if($("metaDiariaDisplay")) $("metaDiariaDisplay").innerText = `$${fmtMoney(Data.getState().parametros.gastoFijo)}`; };

/* ==========================================================================
   LISTENERS
   ========================================================================== */
export const setupAdminListeners = () => {
    safeClick("btnIniciarTurno", () => { localStorage.setItem("turnoActivo", JSON.stringify({inicio:new Date()})); window.location.reload(); });
    safeClick("btnFinalizarTurno", () => { $("cierreTurnoContainer").style.display="block"; $("btnFinalizarTurno").style.display="none"; });
    safeClick("btnCancelarCierre", () => { $("cierreTurnoContainer").style.display="none"; $("btnFinalizarTurno").style.display="block"; });
    
    safeClick("btnConfirmarCierre", () => {
        const t = Data.getTurnoActivo(); if(!t) return;
        const din = safeNumber($("dineroGeneradoInput").value);
        Data.getState().turnos.push({ id:Date.now(), fecha:t.inicio, fin:new Date(), horas:1, dineroGenerado:din, kmRecorridos:0, ganancia:din });
        localStorage.removeItem("turnoActivo"); Data.saveData(); window.location.reload();
    });

    safeClick("btnGasolinaPaso1", () => { $("gasolinaPaso1").style.display='none'; $("gasolinaPaso2").style.display='block'; });
    safeClick("btnGasolinaPaso2", () => { $("gasolinaPaso2").style.display='none'; $("gasolinaPaso3").style.display='block'; });
    safeClick("btnRegistrarGasolina", () => {
        const c = safeNumber($("gasolinaCosto").value), l = safeNumber($("gasolinaLitros").value), k = safeNumber($("gasolinaKmActual").value);
        if(c>0) { Data.agregarMovimiento({tipo:'gasto', fecha:new Date().toISOString(), desc:'Gasolina', monto:c, categoria:'Gasolina'}); 
        Data.getState().cargasCombustible.push({fecha:new Date(), km:k, litros:l, costo:c}); Data.getState().parametros.ultimoKMfinal=k; Data.saveData(); window.location.reload(); }
    });

    const st = $("gastoTipo"), sc = $("gastoCategoria");
    if(st) st.onchange = () => { sc.innerHTML=""; (CATEGORIAS_GASTOS[st.value]||[]).forEach(c=>sc.add(new Option(c,c))); };
    safeClick("btnGastoPaso1", () => { if(st.value){ $("gastoPaso1").style.display='none'; $("gastoPaso2").style.display='block'; } });
    safeClick("btnRegistrarGasto", () => {
        const m = safeNumber($("gastoMonto").value);
        if(m>0) { Data.agregarMovimiento({tipo:'gasto', fecha:new Date().toISOString(), desc:$("gastoDesc").value||sc.value, monto:m, categoria:st.value}); window.location.reload(); }
    });

    safeClick("btnAgregarGastoFijo", () => { 
        const n=$("gastoFijoNombre").value, m=safeNumber($("gastoFijoMonto").value);
        if(n&&m>0) { Data.getState().gastosFijosMensuales.push({categoria:n, monto:m, frecuencia:$("gastoFijoFrecuencia").value}); Data.recalcularMetaDiaria(); renderListasAdmin(); }
    });
    safeClick("btnNuevaDeudaWizard", () => $("deudaWizard").style.display="block");
    safeClick("btnRegistrarDeudaFinal", () => {
        Data.agregarDeuda({id:Date.now(), desc:$("deudaNombre").value, montoTotal:$("deudaMontoTotal").value, montoCuota:$("deudaMontoCuota").value, frecuencia:$("deudaFrecuencia").value, saldo:Number($("deudaMontoTotal").value)});
        window.location.reload();
    });
    safeClick("btnRegistrarAbono", () => {
        const id = $("abonoSeleccionar").value, m = safeNumber($("abonoMonto").value);
        const d = Data.getState().deudas.find(x=>x.id==id);
        if(d && m>0) { d.saldo-=m; Data.agregarMovimiento({tipo:'gasto', fecha:new Date().toISOString(), desc:`Abono ${d.desc}`, monto:m}); Data.saveData(); window.location.reload(); }
    });

    safeClick("btnCopiarJSON", () => navigator.clipboard.writeText(JSON.stringify(Data.getState())).then(()=>alert("Copiado")));
    safeClick("btnImportar", () => { if(Data.importarDesdeJson($("importJson").value)) { alert("Restaurado"); window.location.reload(); } });
    safeClick("btnExportar", () => { 
        if(typeof XLSX!=='undefined') { const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(Data.getState().movimientos), "Movs"); XLSX.writeFile(wb,"Data.xlsx"); }
        else alert("Librería Excel no cargada"); 
    });
};

