import { $, fmtMoney, CATEGORIAS_GASTOS, formatearFecha, safeNumber, STORAGE_KEY, isSameDay } from './01_consts_utils.js';
import * as Data from './02_data.js';

const safeClick = (id, fn) => { const el = $(id); if (el) el.onclick = fn; };
const TODAY = new Date(); 

/* ==========================================================================
   RENDER WALLET UI
   ========================================================================== */
export const renderWalletUI = () => {
    const data = Data.getWalletData();
    const set = (id, v) => { const el = $(id); if(el) el.innerText = v; };

    // 1. GASOLINA
    set("walletGasKm", `${data.gasolina.kmTotal} km (Hist.)`);
    set("walletGasCosto", `$${fmtMoney(data.gasolina.costoKm)}/km`);
    set("walletGasNecesario", `$${fmtMoney(data.gasolina.necesario)}`);
    set("walletGasGastado", `-$${fmtMoney(data.gasolina.gastado)}`);
    
    const elSaldoGas = $("walletGasSaldo");
    if (elSaldoGas) {
        elSaldoGas.innerText = `$${fmtMoney(data.gasolina.saldo)}`;
        elSaldoGas.style.color = data.gasolina.saldo >= 0 ? "#16a34a" : "#dc2626";
    }

    // 2. SOBRES FIJOS
    const container = $("walletFixedContainer");
    if (container) {
        container.innerHTML = "";
        data.sobres.forEach(s => {
            const div = document.createElement("div");
            div.style.cssText = "background:white; padding:15px; border-radius:8px; border-left:4px solid #3b82f6; box-shadow:0 1px 3px rgba(0,0,0,0.1); margin-bottom:10px;";
            
            const textoAcumulado = s.dias === 0 ? "Reiniciado (Pago hoy)" : `Acumulado (${s.dias} días)`;
            
            div.innerHTML = `
                <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                    <strong style="color:#1e293b;">${s.nombre}</strong>
                    <span style="font-size:0.8rem; background:#f1f5f9; padding:2px 6px; border-radius:4px;">${s.tipo}</span>
                </div>
                <div style="font-size:0.9rem; color:#64748b; margin-bottom:8px;">
                    Guardar diario: <b>$${fmtMoney(s.diario)}</b>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; background:#f8fafc; padding:8px; border-radius:5px;">
                    <span>${textoAcumulado}:</span>
                    <strong style="color:#2563eb;">$${fmtMoney(s.acumulado)}</strong>
                </div>
            `;
            container.appendChild(div);
        });
        
        if (data.sobres.length === 0) {
            container.innerHTML = "<p class='nota' style='text-align:center;'>No hay sobres activos. (Comida y Gasolina se gestionan aparte)</p>";
        }
    }

    // 3. TOTALES
    set("walletTotalObligado", `$${fmtMoney(data.totales.obligado)}`);
    set("walletCashFlow", `$${fmtMoney(data.totales.efectivo)}`);
    
    const elHealth = $("walletHealth");
    if (elHealth) {
        const diff = data.totales.salud;
        if (diff >= 0) {
            elHealth.innerText = `👍 Superávit: +$${fmtMoney(diff)}`;
            elHealth.style.color = "#86efac"; 
        } else {
            elHealth.innerText = `⚠️ Déficit: -$${fmtMoney(Math.abs(diff))}`;
            elHealth.style.color = "#fca5a5"; 
        }
    }
};

/* ==========================================================================
   OTROS RENDERS
   ========================================================================== */
export const renderTurnoUI = () => {
    const lbl = $("turnoTexto"); if (!lbl) return;
    const activo = Data.getTurnoActivo();  
    const btnIn = $("btnIniciarTurno"); const btnFin = $("btnFinalizarTurno"); const divCierre = $("cierreTurnoContainer");  
    if (divCierre) divCierre.style.display = "none";  
    if (activo) {  
        lbl.innerHTML = `🟢 Turno Activo: <b>${new Date(activo.inicio).toLocaleTimeString()}</b>`; lbl.style.color = "#16a34a";  
        if (btnIn) btnIn.style.display = "none";  
        if (btnFin) { btnFin.style.display = "inline-block"; btnFin.onclick = () => { btnFin.style.display = "none"; if(divCierre) divCierre.style.display = "block"; }; }  
    } else {  
        lbl.innerHTML = `🔴 Sin turno activo`; lbl.style.color = "#dc2626";  
        if (btnIn) btnIn.style.display = "inline-block"; if (btnFin) btnFin.style.display = "none";  
    }
};

export const renderOdometroUI = () => {
    const kmI = $("kmInicialDisplay"); const kmA = $("kmActualDisplay");
    if (kmA) {  
        const s = Data.getState(); kmA.innerText = `${s.parametros.ultimoKM} km`; if (kmI) kmI.innerText = `${s.parametros.ultimoKM} km`;   
        const c = $("costoPorKmDisplay"); if (c) c.innerText = s.parametros.costoPorKm > 0 ? `$${fmtMoney(s.parametros.costoPorKm)}/km` : "Calculando...";  
    }
};

export const renderMetaDiaria = () => { const el = $("metaDiariaDisplay"); if (el) el.innerText = `$${fmtMoney(Data.recalcularMetaDiaria())}`; };

export const renderMantenimientoUI = () => {
    const s = Data.getState(); const b = s.parametros?.mantenimientoBase || {}; const sv = s.parametros?.ultimoServicio || {};
    const div = $("mantenimientoAlerta");
    const set = (id, k) => { const el = $(id); if(el) el.value = b[k]||0; }; set("mantenimientoAceite", "Aceite"); set("mantenimientoBujia", "Bujía"); set("mantenimientoLlantas", "Llantas");  
    const setS = (id, k) => { const el = $(id); if(el) el.value = sv[k]||''; }; setS("ultimoAceiteKM", "Aceite"); setS("ultimoBujiaKM", "Bujía"); setS("ultimoLlantasKM", "Llantas");  
    if (div) {  
        const r = Data.checkMantenimiento();  
        if (!r.alertaActiva) { div.style.cssText = "background: #ecfdf5; border: 1px solid #34d399;"; div.innerHTML = "Estado: 🟢 OK. ¡Servicios al día!"; } 
        else { let m = "⚠️ SERVICIO PENDIENTE: "; let p = []; for (const i in r.alerta) { if (r.alerta[i]) { const k = safeNumber(r.kmRestantes[i]); const sim = k <= 0 ? '🔴' : '🟠'; p.push(`${sim} ${i} (${k <= 0 ? 'Excedido' : k + ' KM restantes'})`); } } div.style.cssText = "background: #fee2e2; border: 1px solid #f87171;"; div.innerHTML = m + p.join('; '); }  
    }
};

export const renderListasAdmin = () => {
    const ul = $("listaGastosFijos"); 
    if (ul) { 
        ul.innerHTML = ""; 
        Data.getState().gastosFijosMensuales.forEach((g, index) => { 
            ul.innerHTML += `<li style="display:flex; justify-content:space-between; align-items:center;">
                <span>${g.categoria} (${g.frecuencia}) - $${fmtMoney(g.monto)}</span>
                <button class="btn-danger-small" onclick="window.eliminarFijo(${index})" style="background:#fee2e2; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">🗑️</button>
            </li>`; 
        }); 
        const t = $("totalFijoMensualDisplay"); 
        if(t) t.innerText = `$${fmtMoney(Data.getState().parametros.gastoFijo * 30)}`; 
    }
    const ulD = $("listaDeudas"); const sel = $("abonoSeleccionar"); 
    if(ulD) { 
        ulD.innerHTML = ""; 
        if(sel) sel.innerHTML = ""; 
        Data.getState().deudas.forEach(d => { 
            if(d.saldo > 0) { 
                ulD.innerHTML += `<li>${d.desc}: $${fmtMoney(d.saldo)}</li>`; 
                if(sel) { const o = document.createElement("option"); o.value=d.id; o.text=d.desc; sel.add(o); } 
            } 
        }); 
    }
};

window.eliminarFijo = (index) => {
    if(confirm("¿Eliminar este gasto fijo permanentemente?")) {
        Data.eliminarGastoFijo(index);
        renderListasAdmin();
    }
};

export const renderDashboard = () => {
    const s = Data.getState(); if (!s) return; const set = (id, v) => { const el = $(id); if(el) el.innerText = v; };  
    const turnosHoy = s.turnos.filter(t => isSameDay(t.fecha, TODAY));  
    const bruta = turnosHoy.reduce((a, b) => a + safeNumber(b.ganancia), 0);  
    const horas = turnosHoy.reduce((a, b) => a + safeNumber(b.horas), 0);  
    const km = Data.getKmRecorridosHoy(); 
    const gastos = s.movimientos.filter(m => m.tipo === 'gasto' && isSameDay(m.fecha, TODAY)).reduce((a,b)=>a+safeNumber(b.monto), 0);  
    const neta = bruta - gastos;  
    const gph = (horas > 0) ? (bruta / horas) : 0;  
    
    set("resHoras", `${horas.toFixed(2)}h`); set("resGananciaBruta", `$${fmtMoney(bruta)}`); set("resGastosTrabajo", `$${fmtMoney(gastos)}`); set("resGananciaNeta", `$${fmtMoney(neta)}`); set("resKmRecorridos", `${km} km`); set("resGananciaPorHora", `$${fmtMoney(gph)}/h`);  
    set("proyKmTotal", `${s.parametros.ultimoKM} KM`); set("proyDeuda", `$${fmtMoney(Data.getDeudaTotalPendiente())}`); set("proyGastoFijoDiario", `$${fmtMoney(s.parametros.gastoFijo)}`);
    
    const ana = Data.getAnalisisCobertura(); const prom = Data.getGananciaNetaPromedio7Dias(); const elProm = $("proyNetaPromedio");
    if (elProm) { elProm.innerText = `$${fmtMoney(prom)}`; elProm.style.color = ana.cubre ? "#16a34a" : "#dc2626"; }
    set("proyDias", Data.calcularDiasParaLiquidarDeuda());

    const tb = $("tablaTurnos"); if (tb) { tb.innerHTML = ""; const ult = s.turnos.slice().reverse().slice(0, 5); if (ult.length === 0) { tb.innerHTML = "<tr><td colspan='4' style='text-align:center'>Sin registros aún</td></tr>"; } else { ult.forEach(t => { tb.innerHTML += `<tr><td>${formatearFecha(t.fecha)}</td><td>${safeNumber(t.horas).toFixed(2)}h</td><td>${safeNumber(t.kmFinal)}</td><td>$${fmtMoney(t.ganancia)}</td></tr>`; }); } }  
    const dg = $("tablaKmMensual"); if (dg) { const c = s.cargasCombustible.slice().reverse().slice(0, 5); if (c.length === 0) { dg.innerHTML = "<p style='text-align:center; padding:10px; color:#666'>Sin cargas registradas</p>"; } else { let h = `<table class="tabla"><thead><tr><th>Fecha</th><th>Litros</th><th>Costo</th><th>KM Reg.</th></tr></thead><tbody>`; c.forEach(x => { h += `<tr><td>${formatearFecha(x.fecha)}</td><td>${x.litros} L</td><td>$${fmtMoney(x.costo)}</td><td>${x.km}</td></tr>`; }); dg.innerHTML = h + `</tbody></table>`; } }
};

export const renderHistorial = () => {
    const tb = $("historialBody"); const r = $("historialResumen"); if (!tb || !r) return; tb.innerHTML = "";  
    const movs = Data.getState().movimientos.slice().reverse(); let i = 0, g = 0;  
    movs.forEach(m => { const tr = document.createElement("tr"); const isI = m.tipo === 'ingreso'; const mo = safeNumber(m.monto); if (isI) i += mo; else g += mo; tr.innerHTML = `<td>${isI?'➕':'➖'}</td><td>${formatearFecha(m.fecha)}</td><td>${m.desc}</td><td style="color:${isI?'#16a34a':'#dc2626'}">$${fmtMoney(mo)}</td>`; tb.appendChild(tr); });  
    r.innerHTML = `<p style="font-weight:bold; font-size:1.1rem;">Ingresos: <span style="color:#16a34a">$${fmtMoney(i)}</span> | Gastos: <span style="color:#dc2626">$${fmtMoney(g)}</span> | Neto: <span>$${fmtMoney(i-g)}</span></p>`;
};

/* ==========================================================================
   LISTENERS & MENU
   ========================================================================== */
export const setupMobileMenu = () => {
    const btn = document.getElementById('menuToggle');
    const nav = document.getElementById('navMenu');
    
    if (btn && nav) {
        btn.onclick = (e) => {
            e.stopPropagation();
            nav.classList.toggle('active');
        };
        // Cerrar al hacer click fuera
        document.addEventListener('click', (e) => {
            if (!nav.contains(e.target) && !btn.contains(e.target)) {
                nav.classList.remove('active');
            }
        });
    }
};

export const setupAdminListeners = () => {
    if (document.body.getAttribute("data-page") !== "admin") return;
    safeClick("btnIniciarTurno", () => { if(Data.iniciarTurnoLogic()) renderTurnoUI(); });  
    safeClick("btnCancelarCierre", () => { renderTurnoUI(); });   
    safeClick("btnConfirmarFinalizar", () => { const m = $("gananciaBruta").value; const km = $("kmFinalTurno").value; if(!m) return alert("Ingresa la ganancia del turno"); Data.finalizarTurnoLogic(m, km); renderTurnoUI(); renderOdometroUI(); $("gananciaBruta").value=""; $("kmFinalTurno").value=""; alert("Turno Finalizado"); });  
    safeClick("btnActualizarOdometro", () => { const i = $("inputOdometro"); if(i && Data.actualizarOdometroManual(i.value)) { renderOdometroUI(); i.value = ""; alert("KM Actualizado"); } });  
    const fill = (t) => { const s = $("gastoCategoriaSelect"); const man = $("gastoCategoriaManual"); if(!s) return; s.innerHTML=""; if(man) man.style.display = "none"; (CATEGORIAS_GASTOS[t]||[]).forEach(c => { const o = document.createElement("option"); o.value=c; o.text=c; s.add(o); }); s.onchange = () => { if (s.value.includes("➕") && man) { man.style.display = "block"; man.focus(); } else if (man) { man.style.display = "none"; } }; };  
    if($("gastoCategoriaSelect")) { fill("moto"); document.getElementsByName("gastoTipoRadio").forEach(r => { r.addEventListener("change", (e) => fill(e.target.value)); }); }  
    safeClick("btnRegistrarGasto", () => { const s=$("gastoCategoriaSelect"), man=$("gastoCategoriaManual"), m=$("gastoCantidad").value; let c = (s.value.includes("➕") && man && man.value.trim()) ? man.value.trim() : s.value; if(!m) return alert("Falta monto"); const fix = $("checkEsRecurrente")?.checked || false; let t = "moto"; const rad = document.getElementsByName("gastoTipoRadio"); for(let r of rad) if(r.checked) t = r.value; const g = { id:Date.now(), fecha:new Date().toISOString(), categoria:c, monto:Number(m), desc:$("gastoDescripcion").value, tipo:t }; if(fix) { g.frecuencia = $("gastoFrecuenciaSelect").value; Data.agregarGastoFijo(g); alert("Gasto Fijo Guardado"); } else { g.frecuencia = "No Recurrente"; Data.agregarGasto(g); alert("Gasto Guardado"); } $("gastoCantidad").value=""; $("gastoDescripcion").value=""; renderListasAdmin(); renderMetaDiaria(); if(fix) window.location.reload(); });  
    safeClick("btnRegistrarIngreso", () => { const d = $("ingresoDescripcion").value; const m=$("ingresoCantidad").value; if(m) { Data.getState().movimientos.push({tipo:'ingreso', fecha:new Date().toISOString(), desc:d||"Ingreso Extra", monto:safeNumber(m)}); Data.saveData(); alert("Ingreso registrado"); $("ingresoCantidad").value=""; } });  
    safeClick("btnGasSiguiente1", () => { $("gasWizardPaso1").style.display='none'; $("gasWizardPaso2").style.display='block'; }); safeClick("btnGasSiguiente2", () => { $("gasWizardPaso2").style.display='none'; $("gasWizardPaso3").style.display='block'; }); safeClick("btnGasAtras2", () => { $("gasWizardPaso2").style.display='none'; $("gasWizardPaso1").style.display='block'; }); safeClick("btnGasAtras3", () => { $("gasWizardPaso3").style.display='none'; $("gasWizardPaso2").style.display='block'; });  
    safeClick("btnRegistrarCargaFinal", () => { Data.registrarCargaGasolina($("gasLitros").value, $("gasCosto").value, $("gasKmActual").value); renderOdometroUI(); alert("Gasolina Guardada"); window.location.reload(); });  
    safeClick("btnGuardarMantenimiento", () => { Data.guardarConfigMantenimiento($("mantenimientoAceite").value, $("mantenimientoBujia").value, $("mantenimientoLlantas").value); renderMantenimientoUI(); alert("Umbrales Guardados"); });  
    safeClick("btnRegistrarServicio", () => { Data.registrarServicio($("ultimoAceiteKM").value, $("ultimoBujiaKM").value, $("ultimoLlantasKM").value); renderMantenimientoUI(); alert("Servicios registrados"); });  
    safeClick("btnDeudaNext1", () => { if(!$("deudaNombre").value)return alert("Nombre?"); $("deudaWizardStep1").style.display='none'; $("deudaWizardStep2").style.display='block'; }); safeClick("btnDeudaNext2", () => { $("deudaWizardStep2").style.display='none'; $("deudaWizardStep3").style.display='block'; }); safeClick("btnDeudaBack2", () => { $("deudaWizardStep2").style.display='none'; $("deudaWizardStep1").style.display='block'; }); safeClick("btnDeudaBack3", () => { $("deudaWizardStep3").style.display='none'; $("deudaWizardStep2").style.display='block'; });  
    safeClick("btnRegistrarDeudaFinal", () => { Data.agregarDeuda({ id:Date.now(), desc:$("deudaNombre").value, montoTotal:$("deudaMontoTotal").value, montoCuota:$("deudaMontoCuota").value, frecuencia:$("deudaFrecuencia").value, saldo:Number($("deudaMontoTotal").value) }); alert("Deuda Guardada"); window.location.reload(); });  
    safeClick("btnRegistrarAbono", () => { const id = $("abonoSeleccionar").value; const m = $("abonoMonto").value; if(m && id) { const d = Data.getState().deudas.find(x => x.id == id); if(d) { d.saldo -= safeNumber(m); Data.getState().movimientos.push({tipo:'gasto', fecha:new Date().toISOString(), desc:`Abono: ${d.desc}`, monto:safeNumber(m)}); Data.recalcularMetaDiaria(); alert("Abono registrado"); window.location.reload(); } } });  
    safeClick("btnExportar", () => { if (typeof XLSX === 'undefined') return alert("Excel no cargado."); const s = Data.getState(); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(s.turnos), "Turnos"); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(s.movimientos), "Movimientos"); XLSX.writeFile(wb, "Respaldo.xlsx"); });  
    safeClick("btnCopiarJSON", async () => { try { await navigator.clipboard.writeText(localStorage.getItem(STORAGE_KEY)); alert("JSON copiado"); } catch (e) { alert("Error"); } });  
    safeClick("btnImportar", () => { const j = $("importJson").value; if(!j) return; localStorage.setItem(STORAGE_KEY, j); location.reload(); });
};
