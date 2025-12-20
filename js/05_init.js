import { loadData, iniciarTurno, finalizarTurno, agregarGasto, agregarGasolina, agregarDeuda, guardarUmbrales, getState } from './02_data.js';
import { renderGlobalHeader, renderAdminUI, renderWalletUI, renderHistorialUI } from './03_render.js';
import { initCharts } from './04_charts.js';
import { $ } from './01_consts_utils.js';

document.addEventListener("DOMContentLoaded", () => {
    // 1. Carga inicial (Incluye migración si aplica)
    loadData();
    renderGlobalHeader();

    // 2. Detección de página
    const page = document.body.getAttribute('data-page') || detectPage();

    console.log(`🚀 Sistema iniciado en: ${page}`);

    switch (page) {
        case 'admin':
            initAdmin();
            break;
        case 'index':
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

function detectPage() {
    const path = window.location.pathname;
    if (path.includes('admin')) return 'admin';
    if (path.includes('wallet')) return 'wallet';
    if (path.includes('historial')) return 'historial';
    return 'index';
}

/* ===== LÓGICA DE ADMIN ===== */
function initAdmin() {
    renderAdminUI();
    initCharts();

    // -- TURNOS --
    const btnTurno = $("btnTurno");
    if (btnTurno) btnTurno.onclick = () => { iniciarTurno(); renderAdminUI(); };

    const btnFinTurno = $("finalizarTurno");
    if (btnFinTurno) btnFinTurno.onclick = () => {
        const km = $("kmFinal").value;
        const ganancia = $("gananciaTurno").value;
        if (!km || !ganancia) return alert("Faltan datos de cierre");
        finalizarTurno(ganancia, km);
        alert("Turno finalizado");
        location.reload();
    };

    // -- GASTOS --
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

    // -- GASOLINA --
    const btnGas = $("guardarGasolina");
    if (btnGas) btnGas.onclick = () => {
        const km = $("kmGasolina").value;
        const l = $("litros").value;
        const c = $("costoGas").value;
        agregarGasolina(km, l, c);
        alert("Carga guardada");
        renderAdminUI();
        $("kmGasolina").value = ""; $("litros").value = ""; $("costoGas").value = "";
    };

    // -- DEUDAS --
    const btnDeuda = $("registrarDeuda");
    if (btnDeuda) btnDeuda.onclick = () => {
        const nom = $("deudaNombre").value;
        const tot = $("deudaTotal").value;
        const pag = $("deudaPago").value;
        const fec = $("deudaFecha").value;
        if (!nom || !tot) return alert("Datos incompletos");
        agregarDeuda(nom, tot, pag, fec);
        alert("Deuda agregada");
        location.reload();
    };

    // -- MANTENIMIENTO --
    const btnMant = $("guardarUmbrales");
    if (btnMant) btnMant.onclick = () => {
        guardarUmbrales($("umbralAceite").value, $("umbralFrenos").value);
        alert("Umbrales actualizados");
    };

    // -- EXPORTAR (JSON) --
    const btnExp = $("exportar");
    if (btnExp) btnExp.onclick = () => {
        const data = getState();
        const blob = new Blob([JSON.stringify(data)], {type:'application/json'});
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `backup_uber_${new Date().toISOString().slice(0,10)}.json`;
        a.click();
    };

    // -- IMPORTAR (ARCHIVO) --
    const inpImp = $("importar");
    if (inpImp) inpImp.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const r = new FileReader();
        r.onload = () => {
            try {
                JSON.parse(r.result); // Validar JSON
                localStorage.setItem('uber_tracker_data', r.result);
                alert("✅ Datos importados desde archivo.");
                location.reload();
            } catch (err) {
                alert("❌ Archivo inválido.");
            }
        };
        r.readAsText(file);
    };

    // -- IMPORTAR (TEXTO PEGADO) - NUEVO --
    const btnImpText = $("btnImportarTexto");
    if (btnImpText) btnImpText.onclick = () => {
        const text = $("jsonPaste").value;
        if (!text) return alert("⚠️ Pega el JSON primero.");
        try {
            JSON.parse(text); // Validar integridad
            localStorage.setItem('uber_tracker_data', text);
            alert("✅ Datos importados desde texto.");
            location.reload();
        } catch (err) {
            alert("❌ Texto inválido. Asegúrate de copiar todo.");
        }
    };
}

