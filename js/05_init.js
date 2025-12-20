import { loadData, iniciarTurno, finalizarTurno, agregarGasto, agregarGasolina, agregarDeuda, guardarUmbrales, getState } from './02_data.js';
import { renderGlobalHeader, renderAdminUI, renderWalletUI, renderHistorialUI } from './03_render.js';
import { initCharts } from './04_charts.js';
import { $ } from './01_consts_utils.js';

document.addEventListener("DOMContentLoaded", () => {
    // 1. AQUÍ SE LEE EL LOCALSTORAGE AL ABRIR LA PÁGINA
    console.log("🚀 Sistema Iniciando... Leyendo datos...");
    loadData(); // <--- Esta función (de 02_data.js) recupera la info guardada
    
    renderGlobalHeader();

    const page = document.body.getAttribute('data-page') || 'index';

    switch (page) {
        case 'admin':
            initAdmin(); // Carga la lógica de tu HTML de admin
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

    // --- LÓGICA DEL BOTÓN "IMPORTAR TEXTO" ---
    const btnImpText = $("btnImportarTexto");
    
    if (btnImpText) {
        btnImpText.onclick = () => {
            const text = $("jsonPaste").value; // Obtiene lo que pegaste
            
            if (!text) return alert("⚠️ El campo está vacío. Pega el JSON primero.");
            
            try {
                // Validación: Verificamos que sea JSON real
                const cleanText = text.trim();
                JSON.parse(cleanText); 
                
                // 2. AQUÍ SE ESCRIBE EN LOCALSTORAGE (Guardar)
                localStorage.setItem('uber_tracker_data', cleanText);
                
                alert("✅ ¡Datos guardados correctamente!");
                
                // 3. AL RECARGAR, EL SISTEMA "LEE" LOS DATOS NUEVOS
                location.reload(); 
            } catch (err) {
                console.error(err);
                alert("❌ Error: El texto no es válido. Copia todo el código incluyendo las llaves { }.");
            }
        };
    }

    // --- OTROS BOTONES (Turno, Gasto, etc.) ---
    const safeClick = (id, fn) => { const el = $(id); if(el) el.onclick = fn; };

    safeClick("btnTurno", () => { iniciarTurno(); renderAdminUI(); });
    
    safeClick("finalizarTurno", () => {
        const km = $("kmFinal").value;
        const ganancia = $("gananciaTurno").value;
        if (!km || !ganancia) return alert("Faltan datos");
        finalizarTurno(ganancia, km);
        alert("Turno finalizado");
        location.reload();
    });

    safeClick("registrarGasto", () => {
        const m = $("montoGasto").value;
        if (!m) return alert("Ingresa monto");
        agregarGasto($("tipoGasto").value, $("categoriaGasto").value, m, $("gastoRecurrente").checked, $("fechaPago").value);
        alert("Gasto registrado");
        location.reload();
    });

    safeClick("guardarGasolina", () => {
        agregarGasolina($("kmGasolina").value, $("litros").value, $("costoGas").value);
        alert("Gasolina guardada");
        renderAdminUI();
        $("kmGasolina").value = ""; $("litros").value = ""; $("costoGas").value = "";
    });

    safeClick("registrarDeuda", () => {
        if (!$("deudaNombre").value) return alert("Falta nombre");
        agregarDeuda($("deudaNombre").value, $("deudaTotal").value, $("deudaPago").value, $("deudaFecha").value);
        alert("Deuda guardada");
        location.reload();
    });

    safeClick("guardarUmbrales", () => {
        guardarUmbrales($("umbralAceite").value, $("umbralFrenos").value);
        alert("Umbrales guardados");
    });
    
    // Exportar archivo
    safeClick("exportar", () => {
        const blob = new Blob([JSON.stringify(getState())], {type:'application/json'});
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `backup_${new Date().toISOString().slice(0,10)}.json`;
        a.click();
    });

    // Importar archivo (Opción A)
    const inpImp = $("importar");
    if (inpImp) inpImp.onchange = (e) => {
        const f = e.target.files[0];
        if(!f) return;
        const r = new FileReader();
        r.onload = () => {
            try { 
                JSON.parse(r.result); 
                localStorage.setItem('uber_tracker_data', r.result); 
                alert("✅ Archivo cargado."); 
                location.reload(); 
            }
            catch(e) { alert("❌ Archivo inválido"); }
        };
        r.readAsText(f);
    };
}

