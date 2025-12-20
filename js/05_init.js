/* Archivo: js/05_init.js */
import { loadData, iniciarTurno, finalizarTurno, agregarGasto, agregarGasolina, agregarDeuda, guardarUmbrales, getState } from './02_data.js';
import { renderGlobalHeader, renderAdminUI, renderWalletUI, renderHistorialUI } from './03_render.js';
import { initCharts } from './04_charts.js';
import { $ } from './01_consts_utils.js';

document.addEventListener("DOMContentLoaded", () => {
    console.log("🚀 Sistema Iniciando...");
    loadData();
    renderGlobalHeader();

    const page = document.body.getAttribute('data-page') || 'index';

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

function initAdmin() {
    renderAdminUI();
    initCharts();

    /* --- LISTENERS EXISTENTES --- */
    const btnTurno = $("btnTurno");
    if (btnTurno) btnTurno.onclick = () => { iniciarTurno(); renderAdminUI(); };

    const btnFinTurno = $("finalizarTurno");
    if (btnFinTurno) btnFinTurno.onclick = () => {
        const km = $("kmFinal").value;
        const ganancia = $("gananciaTurno").value;
        if (!km || !ganancia) return alert("Faltan datos");
        finalizarTurno(ganancia, km);
        alert("Turno finalizado");
        location.reload();
    };

    const btnGasto = $("registrarGasto");
    if (btnGasto) btnGasto.onclick = () => {
        const tipo = $("tipoGasto").value;
        const cat = $("categoriaGasto").value;
        const monto = $("montoGasto").value;
        const isRecurrente = $("gastoRecurrente").checked;
        const fecha = $("fechaPago").value;
        if (!monto) return alert("Ingresa monto");
        agregarGasto(tipo, cat, monto, isRecurrente, fecha);
        alert("Gasto registrado");
        location.reload();
    };

    const btnGas = $("guardarGasolina");
    if (btnGas) btnGas.onclick = () => {
        const km = $("kmGasolina").value;
        const l = $("litros").value;
        const c = $("costoGas").value;
        agregarGasolina(km, l, c);
        alert("Gasolina guardada");
        renderAdminUI();
        $("kmGasolina").value = ""; $("litros").value = ""; $("costoGas").value = "";
    };

    const btnDeuda = $("registrarDeuda");
    if (btnDeuda) btnDeuda.onclick = () => {
        const nom = $("deudaNombre").value;
        const tot = $("deudaTotal").value;
        const pag = $("deudaPago").value;
        const fec = $("deudaFecha").value;
        if (!nom || !tot) return alert("Datos incompletos");
        agregarDeuda(nom, tot, pag, fec);
        alert("Deuda guardada");
        location.reload();
    };

    const btnMant = $("guardarUmbrales");
    if (btnMant) btnMant.onclick = () => {
        guardarUmbrales($("umbralAceite").value, $("umbralFrenos").value);
        alert("Umbrales guardados");
    };

    /* --- IMPORTAR / EXPORTAR --- */
    const btnExp = $("exportar");
    if (btnExp) btnExp.onclick = () => {
        const data = getState();
        const blob = new Blob([JSON.stringify(data)], {type:'application/json'});
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `backup_uber_${new Date().toISOString().slice(0,10)}.json`;
        a.click();
    };

    const inpImp = $("importar");
    if (inpImp) inpImp.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const r = new FileReader();
        r.onload = () => {
            try {
                JSON.parse(r.result);
                localStorage.setItem('uber_tracker_data', r.result);
                alert("✅ Archivo importado.");
                location.reload();
            } catch (err) { alert("❌ Archivo inválido"); }
        };
        r.readAsText(file);
    };

    /* --- EL BOTÓN QUE FALLABA --- */
    const btnImpText = $("btnImportarTexto");
    // Debug: Verifica si el botón existe
    if (!btnImpText) console.error("❌ ERROR: No encuentro el botón con ID 'btnImportarTexto'");
    
    if (btnImpText) {
        console.log("✅ Botón de texto detectado y listo.");
        btnImpText.onclick = () => {
            console.log("🖱️ Click recibido en botón texto");
            const text = $("jsonPaste").value;
            if (!text) return alert("⚠️ Pega el JSON primero.");
            
            try {
                // Limpieza básica por si pegaron espacios extra
                const cleanText = text.trim();
                JSON.parse(cleanText); // Validar integridad
                localStorage.setItem('uber_tracker_data', cleanText);
                alert("✅ Datos importados desde texto.");
                location.reload();
            } catch (err) {
                console.error(err);
                alert("❌ JSON Inválido. Asegúrate de copiar TODO el texto, incluyendo llaves { }.");
            }
        };
    }
}

