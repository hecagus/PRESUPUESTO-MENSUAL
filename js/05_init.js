import { loadData, iniciarTurno, finalizarTurno, agregarGasto, agregarGasolina, agregarDeuda, guardarUmbrales, saveData, getState } from './02_data.js';
import { renderGlobalHeader, renderAdminUI, renderWalletUI, renderHistorialUI } from './03_render.js';
import { initCharts } from './04_charts.js';
import { $, safeNumber } from './01_consts_utils.js';

document.addEventListener("DOMContentLoaded", () => {
    // 1. Carga inicial
    loadData();
    renderGlobalHeader();

    // 2. Detección de página
    const page = document.body.getAttribute('data-page') || detectPage();

    console.log(`🚀 Init: ${page}`);

    switch (page) {
        case 'admin':
            initAdmin();
            break;
        case 'index': // Dashboard
            initCharts();
            break;
        case 'wallet':
            renderWalletUI();
            break;
        case 'historial':
            renderHistorialUI();
            break;
    }
});

// Helper para detectar página si falta data-page
function detectPage() {
    const path = window.location.pathname;
    if (path.includes('admin')) return 'admin';
    if (path.includes('wallet')) return 'wallet';
    if (path.includes('historial')) return 'historial';
    return 'index';
}

/* ===== LOGICA ESPECÍFICA DE ADMIN ===== */
function initAdmin() {
    renderAdminUI();
    initCharts(); // Admin también tiene canvas en tu HTML

    // Listeners Turno
    const btnTurno = $("btnTurno");
    if (btnTurno) btnTurno.onclick = () => {
        iniciarTurno();
        renderAdminUI();
    };

    const btnFinTurno = $("finalizarTurno");
    if (btnFinTurno) btnFinTurno.onclick = () => {
        const km = $("kmFinal").value;
        const ganancia = $("gananciaTurno").value;
        if (!km || !ganancia) return alert("Faltan datos de cierre");
        
        finalizarTurno(ganancia, km);
        alert("Turno finalizado y guardado");
        location.reload();
    };

    // Listeners Gasto
    const btnGasto = $("registrarGasto");
    if (btnGasto) btnGasto.onclick = () => {
        const tipo = $("tipoGasto").value;
        const cat = $("categoriaGasto").value;
        const monto = $("montoGasto").value;
        const isRecurrente = $("gastoRecurrente").checked;
        const fecha = $("fechaPago").value;

        if (!monto) return alert("Ingresa un monto");

        agregarGasto(tipo, cat, monto, isRecurrente, fecha);
        alert("Gasto registrado");
        location.reload();
    };

    // Listeners Gasolina
    const btnGas = $("guardarGasolina");
    if (btnGas) btnGas.onclick = () => {
        const km = $("kmGasolina").value;
        const l = $("litros").value;
        const c = $("costoGas").value;
        
        agregarGasolina(km, l, c);
        alert("Carga guardada");
        renderAdminUI(); // Actualizar KM
        $("kmGasolina").value = ""; $("litros").value = ""; $("costoGas").value = "";
    };

    // Listeners Deuda
    const btnDeuda = $("registrarDeuda");
    if (btnDeuda) btnDeuda.onclick = () => {
        const nom = $("deudaNombre").value;
        const tot = $("deudaTotal").value;
        const pag = $("deudaPago").value;
        const fec = $("deudaFecha").value;
        
        if (!nom || !tot) return alert("Datos incompletos");
        
        agregarDeuda(nom, tot, pag, fec);
        alert("Deuda agregada");
        location.reload(); // Para recalcular meta
    };

    // Listeners Mantenimiento
    const btnMant = $("guardarUmbrales");
    if (btnMant) btnMant.onclick = () => {
        guardarUmbrales($("umbralAceite").value, $("umbralFrenos").value);
        alert("Umbrales actualizados");
    };

    // Export / Import
    const btnExp = $("exportar");
    if (btnExp) btnExp.onclick = () => {
        const data = getState();
        const blob = new Blob([JSON.stringify(data)], {type:'application/json'});
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'uber_tracker_backup.json';
        a.click();
    };

    const inpImp = $("importar");
    if (inpImp) inpImp.onchange = (e) => {
        const r = new FileReader();
        r.onload = () => {
            localStorage.setItem('uber_tracker_data', r.result);
            alert("Datos importados");
            location.reload();
        };
        r.readAsText(e.target.files[0]);
    };
}
