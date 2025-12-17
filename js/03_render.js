
import { $, fmtMoney, CATEGORIAS_GASTOS, formatearFecha, safeNumber, STORAGE_KEY, isSameDay } from './01_consts_utils.js';
import * as Data from './02_data.js'; 

const safeClick = (id, fn) => { const el = $(id); if (el) el.onclick = fn; };
const TODAY = new Date();

export const renderTurnoUI = () => {
    const lbl = $("turnoTexto");
    if (!lbl) return; 
    const activo = Data.getTurnoActivo();
    const btnIn = $("btnIniciarTurno"), btnFin = $("btnFinalizarTurno"), divCierre = $("cierreTurnoContainer");
    if (divCierre) divCierre.style.display = "none";
    if (activo) {
        lbl.innerHTML = `🟢 Turno Activo: <b>${new Date(activo.inicio).toLocaleTimeString()}</b>`;
        lbl.style.color = "#16a34a";
        if (btnIn) btnIn.style.display = "none";
        if (btnFin) {
            btnFin.style.display = "inline-block";
            btnFin.onclick = () => { btnFin.style.display = "none"; if(divCierre) divCierre.style.display = "block"; };
        }
    } else {
        lbl.innerHTML = `🔴 Sin turno activo`;
        lbl.style.color = "#dc2626";
        if (btnIn) btnIn.style.display = "inline-block";
        if (btnFin) btnFin.style.display = "none";
    }
};

export const renderOdometroUI = () => {
    const kmIni = $("kmInicialDisplay"), kmAct = $("kmActualDisplay");
    if (kmAct) {
        const state = Data.getState();
        const ultimo = state.parametros.ultimoKM;
        const activo = Data.getTurnoActivo();
        kmAct.innerText = `${ultimo} km`;
        let inicial = (activo && activo.kmInicial !== undefined) ? safeNumber(activo.kmInicial) : ultimo;
        if (kmIni) kmIni.innerText = `${inicial} km`; 
        const costo = $("costoPorKmDisplay");
        if (costo) costo.innerText = state.parametros.costoPorKm > 0 ? `$${fmtMoney(state.parametros.costoPorKm)}/km` : "Calculando...";
    }
};

export const renderMetaDiaria = () => {
    const el = $("metaDiariaDisplay");
    if (el) el.innerText = `$${fmtMoney(Data.recalculateMetaDiaria())}`;
};

export const renderMantenimientoUI = () => {
    const state = Data.getState();
    const cfgBase = state.parametros?.mantenimientoBase || {};
    const cfgServ = state.parametros?.ultimoServicio || {};
    const alertaDiv = $("mantenimientoAlerta");
    const setB = (id, k) => { const el = $(id); if(el) el.value = cfgBase[k]||0; };
    setB("mantenimientoAceite", "Aceite"); setB("mantenimientoBujia", "Bujía"); setB("mantenimientoLlantas", "Llantas");
    const setS = (id, k) => { const el = $(id); if(el) el.value = cfgServ[k]||''; };
    setS("ultimoAceiteKM", "Aceite"); setS("ultimoBujiaKM", "Bujía"); setS("ultimoLlantasKM", "Llantas");
    if (alertaDiv) {
        const res = Data.checkMantenimiento();
        if (!res.alertaActiva) {
            alertaDiv.style.cssText = "background: #ecfdf5; border: 1px solid #34d399;";
            alertaDiv.innerHTML = "Estado: 🟢 OK. ¡Servicios al día!";
        } else {
            let msg = "⚠️ PRÓXIMO: "; let pends = [];
            for (const item in res.alerta) {
                if (res.alerta[item]) {
                    const kmR = safeNumber(res.kmRestantes[item]);
                    pends.push(`${kmR <= 0 ? '🔴' : '🟠'} ${item} (${kmR <= 0 ? 'Excedido' : kmR + ' KM'})`);
                }
            }
            alertaDiv.style.cssText = "background: #fee2e2; border: 1px solid #f87171;";
            alertaDiv.innerHTML = msg + pends.join('; ');
        }
    }
};

export const renderDashboard = () => {
    const state = Data.getState();
    const set = (id, v) => { const el = $(id); if(el) el.innerText = v; };
    
    // 1. RESUMEN HOY
    const turnosHoy = state.turnos.filter(t => isSameDay(t.fecha, TODAY));
    const gananciaHoy = turnosHoy.reduce((a, b) => a + safeNumber(b.ganancia), 0);
    const horasHoy = turnosHoy.reduce((a, b) => a + safeNumber(b.horas), 0);
    const gastosHoy = state.movimientos.filter(m => m.tipo === 'gasto' && isSameDay(m.fecha, TODAY)).reduce((a,b)=>a+safeNumber(b.monto), 0);
    set("resHorasTrabajadas", `${horasHoy.toFixed(2)}h`);
    set("resGananciaBruta", `$${fmtMoney(gananciaHoy)}`);
    set("resGastosTrabajo", `$${fmtMoney(gastosHoy)}`);
    set("resGananciaNeta", `$${fmtMoney(gananciaHoy - gastosHoy)}`);
    set("resKmRecorridos", `${state.parametros.ultimoKM} km`);
    set("resGananciaPorHora", `$${fmtMoney(horasHoy > 0 ? (gananciaHoy - gastosHoy) / horasHoy : 0)}/h`);

    // 2. PROYECCIONES
    set("resKmAcumuladoMantenimiento", `${state.parametros.ultimoKM} KM`);
    set("resDeudaTotal", `$${fmtMoney(Data.getDeudaTotalPendiente())}`);
    set("resGastoFijoDiario", `$${fmtMoney(state.parametros.gastoFijo)}`);
    set("resGananciaNetaProm", `$${fmtMoney(Data.getGananciaNetaPromedio())}`);
    set("resTiempoDeudas", Data.calcularTiempoLibreDeudas());

    // 3. TABLAS
    const tbodyT = $("tablaUltimosTurnosBody");
    if (tbodyT) {
        tbodyT.innerHTML = state.turnos.length ? "" : "<tr><td colspan='4'>Sin datos</td></tr>";
        state.turnos.slice(-5).reverse().forEach(t => {
            tbodyT.innerHTML += `<tr><td>${formatearFecha(t.fecha)}</td><td>${safeNumber(t.horas).toFixed(1)}h</td><td>${t.kmFinal||'-'}</td><td>$${fmtMoney(t.ganancia)}</td></tr>`;
        });
    }
    const divG = $("tablaKmMensual");
    if (divG) {
        divG.innerHTML = state.cargasCombustible.length ? "" : "Sin cargas";
        if (state.cargasCombustible.length) {
            let h = `<table class="tabla"><thead><tr><th>Fecha</th><th>Litros</th><th>Costo</th><th>KM</th></tr></thead><tbody>`;
            state.cargasCombustible.slice(-5).reverse().forEach(c => {
                h += `<tr><td>${formatearFecha(c.fecha)}</td><td>${c.litros}L</td><td>$${fmtMoney(c.costo)}</td><td>${c.km}</td></tr>`;
            });
            divG.innerHTML = h + `</tbody></table>`;
        }
    }
};

export const renderHistorial = () => {
    const tbody = $("historialBody"), resumen = $("historialResumen");
    if (!tbody) return;
    tbody.innerHTML = "";
    let ing = 0, gas = 0;
    state.movimientos.slice().reverse().forEach(m => {
        const isIng = m.tipo === 'ingreso';
        const monto = safeNumber(m.monto);
        if (isIng) ing += monto; else gas += monto;
        tbody.innerHTML += `<tr style="background:${isIng?'#ecfdf5':'#fff5f5'}"><td>${isIng?'➕':'➖'}</td><td>${formatearFecha(m.fecha)}</td><td>${m.desc}</td><td style="color:${isIng?'green':'red'}">$${fmtMoney(monto)}</td></tr>`;
    });
    if (resumen) resumen.innerHTML = `Ingresos: $${fmtMoney(ing)} | Gastos: $${fmtMoney(gas)} | Neto: $${fmtMoney(ing-gas)}`;
};

export const setupAdminListeners = () => {
    if (document.body.getAttribute("data-page") !== "admin") return; 
    safeClick("btnIniciarTurno", () => { if(Data.iniciarTurnoLogic()) { renderTurnoUI(); renderOdometroUI(); } });
    safeClick("btnConfirmarFinalizar", () => {
        const m = $("gananciaBruta").value, km = $("kmFinalTurno").value;
        if(!m) return alert("Falta ganancia");
        Data.finalizarTurnoLogic(m, km); renderTurnoUI(); renderOdometroUI();
        $("gananciaBruta").value=""; $("kmFinalTurno").value=""; alert("Cerrado");
    });
    safeClick("btnRegistrarGasto", () => {
        const sel = $("gastoCategoriaSelect"), cant = $("gastoCantidad").value;
        if(!cant) return alert("Falta monto");
        const esFijo = $("checkEsRecurrente")?.checked;
        const g = { id:Date.now(), fecha:new Date().toISOString(), categoria:sel.value, monto:Number(cant), tipo:$("gastoTipoRadio")?.value || 'moto' };
        if(esFijo) { g.frecuencia = $("gastoFrecuenciaSelect").value; Data.agregarGastoFijo(g); }
        else Data.agregarGasto(g);
        alert("Guardado"); window.location.reload();
    });
    safeClick("btnRegistrarCargaFinal", () => {
        Data.registrarCargaGasolina($("gasLitros").value, $("gasCosto").value, $("gasKmActual").value);
        alert("Gasolina Guardada"); window.location.reload();
    });
    safeClick("btnCopiarJSON", async () => {
        await navigator.clipboard.writeText(localStorage.getItem(STORAGE_KEY)); alert("Copiado");
    });
};
                           
