import { $, fmtMoney, CATEGORIAS_GASTOS, formatearFecha, safeNumber, STORAGE_KEY, isSameDay } from './01_consts_utils.js';
import * as Data from './02_data.js'; 

const safeClick = (id, fn) => { const el = $(id); if (el) { el.onclick = null; el.onclick = fn; } };
const TODAY = new Date();

export const renderTurnoUI = () => {
    const lbl = $("turnoTexto"); if (!lbl) return; 
    const activo = Data.getTurnoActivo();
    const btnIn = $("btnIniciarTurno"), btnFin = $("btnFinalizarTurno"), divCierre = $("cierreTurnoContainer");
    if (divCierre) divCierre.style.display = "none";
    if (activo) {
        lbl.innerHTML = `🟢 Turno Activo: <b>${new Date(activo.inicio).toLocaleTimeString()}</b>`;
        if (btnIn) btnIn.style.display = "none";
        if (btnFin) {
            btnFin.style.display = "inline-block";
            btnFin.onclick = () => { btnFin.style.display = "none"; if(divCierre) divCierre.style.display = "block"; };
        }
    } else {
        lbl.innerHTML = `🔴 Sin turno activo`;
        if (btnIn) btnIn.style.display = "inline-block";
        if (btnFin) btnFin.style.display = "none";
    }
};

export const renderOdometroUI = () => {
    const kmIni = $("kmInicialDisplay"), kmAct = $("kmActualDisplay");
    if (kmAct) {
        const state = Data.getState();
        const ultimo = safeNumber(state.parametros.ultimoKM);
        const activo = Data.getTurnoActivo();
        kmAct.innerText = `${ultimo} km`;
        let inicial = (activo && activo.kmInicial !== undefined) ? safeNumber(activo.kmInicial) : ultimo;
        if (kmIni) kmIni.innerText = `${inicial} km`; 
    }
};

export const renderMetaDiaria = () => {
    const el = $("metaDiariaDisplay");
    if (el) el.innerText = `$${fmtMoney(Data.recalcularMetaDiaria())}`;
};

export const renderMantenimientoUI = () => {
    const state = Data.getState();
    const cfgBase = state.parametros?.mantenimientoBase || {};
    const alertaDiv = $("mantenimientoAlerta");
    if (alertaDiv) {
        const res = Data.checkMantenimiento();
        if (!res.alertaActiva) {
            alertaDiv.style.cssText = "background: #ecfdf5; border: 1px solid #34d399; padding:10px;";
            alertaDiv.innerHTML = "Estado: 🟢 OK. ¡Servicios al día!";
        } else {
            alertaDiv.style.cssText = "background: #fee2e2; border: 1px solid #f87171; padding:10px;";
            alertaDiv.innerHTML = "⚠️ Revisa Mantenimiento";
        }
    }
};

export const renderDashboard = () => {
    const state = Data.getState();
    const set = (id, v) => { const el = $(id); if(el) el.innerText = v; };
    const turnosHoy = state.turnos.filter(t => isSameDay(t.fecha, TODAY));
    const gananciaHoy = turnosHoy.reduce((a, b) => a + safeNumber(b.ganancia), 0);
    const horasHoy = turnosHoy.reduce((a, b) => a + safeNumber(b.horas), 0);
    set("resHorasTrabajadas", `${horasHoy.toFixed(2)}h`);
    set("resGananciaBruta", `$${fmtMoney(gananciaHoy)}`);
    set("resGananciaNeta", `$${fmtMoney(gananciaHoy)}`);
    set("resKmRecorridos", `${state.parametros.ultimoKM} km`);
    set("resGastoFijoDiario", `$${fmtMoney(state.parametros.gastoFijo)}`);
    set("resGananciaNetaProm", `$${fmtMoney(Data.getGananciaNetaPromedio())}`);
    set("resTiempoDeudas", Data.calcularTiempoLibreDeudas());
    
    const tbodyT = $("tablaUltimosTurnosBody");
    if (tbodyT) {
        tbodyT.innerHTML = "";
        [...state.turnos].reverse().slice(0,5).forEach(t => {
            tbodyT.innerHTML += `<tr><td>${formatearFecha(t.fecha)}</td><td>${safeNumber(t.horas).toFixed(1)}h</td><td>${t.kmFinal||'-'}</td><td>$${fmtMoney(t.ganancia)}</td></tr>`;
        });
    }
};

export const setupAdminListeners = () => {
    if (document.body.getAttribute("data-page") !== "admin") return; 
    safeClick("btnIniciarTurno", () => { if(Data.iniciarTurnoLogic()) { renderTurnoUI(); renderOdometroUI(); } });
    safeClick("btnConfirmarFinalizar", () => {
        const m = $("gananciaBruta").value, km = $("kmFinalTurno").value;
        if(!m) return alert("Falta monto");
        Data.finalizarTurnoLogic(m, km); renderTurnoUI(); renderOdometroUI();
        $("gananciaBruta").value=""; alert("Turno Cerrado");
    });
    safeClick("btnRegistrarGasto", () => {
        const cant = $("gastoCantidad").value; if(!cant) return alert("Falta monto");
        const g = { id:Date.now(), fecha:new Date().toISOString(), categoria:$("gastoCategoriaSelect").value, monto:Number(cant) };
        if($("checkEsRecurrente")?.checked) { g.frecuencia = $("gastoFrecuenciaSelect").value; Data.agregarGastoFijo(g); }
        else Data.agregarGasto(g);
        alert("Guardado"); location.reload();
    });
    safeClick("btnExportar", () => {
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(Data.getState().turnos), "Turnos");
        XLSX.writeFile(wb, "Respaldo.xlsx");
    });
    safeClick("btnCopiarJSON", () => {
        navigator.clipboard.writeText(localStorage.getItem(STORAGE_KEY)); alert("Copiado");
    });
};

