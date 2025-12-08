// app.js - VERSIÓN FINAL: SOPORTE COMPLETO DE FRECUENCIAS + TUTORIAL
// ---------------------------------------------------------------------

const STORAGE_KEY = "panelData";
const TUTORIAL_VIEWED_KEY = "tutorialViewed"; // Nueva clave para el tutorial
const $ = id => document.getElementById(id);
let gananciasChart = null;
let kmChart = null;

// --- CONFIGURACIÓN DE FRECUENCIAS y CATEGORÍAS ---
const DIAS_POR_FRECUENCIA = {
    'Diario': 1,
    'Semanal': 7,
    'Quincenal': 15,
    'Mensual': 30,
    'Bimestral': 60,
    'No Recurrente': 0
};

const CATEGORIAS_GASTOS = {
    moto: [
        "Mantenimiento (Aceite/Filtros)", "Reparación Mecánica", "Llantas/Frenos",
        "Peajes/Casetas", "Lavado/Limpieza", "Accesorios/Equipo", "Seguro/Trámites", "✏️ Otra / Nueva..."
    ],
    hogar: [
        "Comida del día (Calle)", "Despensa/Supermercado", "Renta/Alquiler",
        "Luz/Agua/Gas", "Internet/Streaming", "Celular/Datos", "Salud/Farmacia",
        "Ropa/Personal", "Diversión/Salidas", "✏️ Otra / Nueva..."
    ]
};

const TUTORIAL_STEPS = [
    { title: "¡Bienvenido/a!", text: "Esta guía rápida te mostrará cómo usar el nuevo sistema de rastreo avanzado.", button: "Comenzar" },
    { title: "Turnos y KM", text: "Usa 'Iniciar Turno' al salir y 'Finalizar Turno' al regresar. El KM se enlaza automáticamente para calcular tu consumo.", button: "Siguiente" },
    { title: "Gasolina y Costos", text: "La primera vez que uses el Asistente de Carga de Gasolina (3 Pasos), ¡activarás tu métrica de Costo Real por KM!", button: "Siguiente" },
    { title: "Gastos Inteligentes", text: "Clasifica tus gastos como Operativos (Moto) o Personales (Hogar). También podrás definir gastos recurrentes (Netflix, Renta).", button: "Siguiente" },
    { title: "Obligaciones y Metas", text: "Tus gastos fijos y deudas crean una 'Meta Diaria'. ¡Asegúrate de superarla para ahorrar y pagar tus compromisos!", button: "Finalizar" }
];


const DEFAULT_PANEL_DATA = {
  ingresos: [], gastos: [], turnos: [], movimientos: [], cargasCombustible: [], deudas: [],
  gastosFijosMensuales: [], 
  parametros: {
    deudaTotal: 0, 
    gastoFijo: 0, 
    ultimoKMfinal: 0, 
    costoPorKm: 0,
    mantenimientoBase: { 'Aceite (KM)': 3000, 'Bujía (KM)': 8000, 'Llantas (KM)': 15000 }
  }
};

let panelData = JSON.parse(JSON.stringify(DEFAULT_PANEL_DATA));
let turnoActivo = JSON.parse(localStorage.getItem("turnoActivo")) || false;

// ---------- UTILIDADES ----------
function safeNumber(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }
function fmtMoney(n) { return safeNumber(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
function formatearFecha(d) { return new Date(d).toLocaleDateString(); }

// ---------- GESTIÓN DE DATOS ----------
function getDailyDebtContribution() {
    let totalDiario = 0;
    panelData.deudas.forEach(d => {
        const montoCuota = safeNumber(d.montoCuota);
        if (montoCuota > 0 && d.saldo > 0) {
            const dias = DIAS_POR_FRECUENCIA[d.frecuencia] || 30;
            if (dias > 0) {
                totalDiario += montoCuota / dias;
            }
        }
    });
    return totalDiario;
}

function recalcularMetaDiaria() {
    // 1. GASTOS FIJOS (NETFLIX, RENTA, ETC.)
    const cuotaFijosDiaria = panelData.gastosFijosMensuales.reduce((dailySum, g) => {
        const days = DIAS_POR_FRECUENCIA[g.frecuencia] || 30; 
        const costPerDay = safeNumber(g.monto) / days; 
        return dailySum + costPerDay;
    }, 0); 
    const totalFijos = cuotaFijosDiaria * 30;
    
    // 2. DEUDAS (CONTRIBUCIÓN SUGERIDA)
    const cuotaDeudasDiaria = getDailyDebtContribution();

    // 3. META DIARIA TOTAL
    const metaTotal = cuotaFijosDiaria + cuotaDeudasDiaria;
    
    panelData.parametros.gastoFijo = metaTotal; 
    
    if($("metaDiariaDisplay")) $("metaDiariaDisplay").innerText = `$${fmtMoney(metaTotal)}`;
    if($("totalFijoMensualDisplay")) $("totalFijoMensualDisplay").innerText = `$${fmtMoney(totalFijos)}`;
    
    saveData();
}

function validarYArreglarDatos() {
  ['ingresos', 'gastos', 'deudas', 'movimientos', 'turnos', 'cargasCombustible', 'gastosFijosMensuales'].forEach(k => {
    if (!Array.isArray(panelData[k])) panelData[k] = [];
  });
  if (!panelData.parametros) panelData.parametros = DEFAULT_PANEL_DATA.parametros;
  panelData.parametros.ultimoKMfinal = safeNumber(panelData.parametros.ultimoKMfinal);
  
  recalcularMetaDiaria();
  calcularMetricasCombustible(false);
  saveData();
}

function cargarPanelData() {
  const data = localStorage.getItem(STORAGE_KEY);
  if (data) { try { panelData = { ...panelData, ...JSON.parse(data) }; } catch (e) {} }
  validarYArreglarDatos();
}

function saveData() { localStorage.setItem(STORAGE_KEY, JSON.stringify(panelData)); }
function exportarJson() { navigator.clipboard.writeText(JSON.stringify(panelData)).then(() => alert("Copiado.")); }
function importarJson() {
    try {
        const json = $("importJson").value; if (!json) return;
        panelData = { ...DEFAULT_PANEL_DATA, ...JSON.parse(json) };
        validarYArreglarDatos(); alert("Restaurado."); window.location.reload();
    } catch (e) { alert("Error JSON"); }
}

// ---------- TUTORIAL (NUEVO) ----------

function showTutorialModal(step) {
    const modal = $("tutorialModal");
    const overlay = $("tutorialOverlay");
    const nextBtn = $("tutorialNextBtn");

    if (!modal || !overlay) return;

    if (step >= TUTORIAL_STEPS.length) {
        modal.style.display = "none";
        overlay.style.display = "none";
        localStorage.setItem(TUTORIAL_VIEWED_KEY, "true");
        return;
    }

    const currentStep = TUTORIAL_STEPS[step];
    
    $("tutorialTitle").innerText = currentStep.title;
    $("tutorialText").innerText = currentStep.text;
    nextBtn.innerText = currentStep.button;

    // Remove existing listener to prevent stacking
    nextBtn.onclick = null; 
    nextBtn.onclick = () => showTutorialModal(step + 1);

    modal.style.display = "block";
    overlay.style.display = "block";
}

function checkTutorial() {
    const tutorialViewed = localStorage.getItem(TUTORIAL_VIEWED_KEY);
    if (tutorialViewed !== "true") {
        showTutorialModal(0);
    }
}


// ---------- UI RENDERIZADO (Recorte por espacio) ----------

function renderGastosFijos() {
    const ul = $("listaGastosFijos"); if(!ul) return; ul.innerHTML = "";
    if (panelData.gastosFijosMensuales.length === 0) { ul.innerHTML = "<li style='color:#777; font-style:italic;'>No tienes gastos fijos activos.</li>"; return; }
    panelData.gastosFijosMensuales.forEach((g, index) => {
        const li = document.createElement("li"); li.style.display = "flex"; li.style.justifyContent = "space-between"; li.style.alignItems = "center"; li.style.padding = "5px 0"; li.style.borderBottom = "1px solid #eee";
        li.innerHTML = `
            <span><strong>${g.categoria}</strong> (${g.frecuencia} - Día ${g.diaPago}):</span>
            <span>$${fmtMoney(g.monto)} 
                <button class="btn-danger" style="padding:2px 6px; font-size:0.7rem; margin-left:10px;" onclick="eliminarGastoFijo(${index})">X</button>
            </span>
        `;
        ul.appendChild(li);
    });
}
window.eliminarGastoFijo = function(index) {
    if(confirm("¿Ya no pagarás este servicio?")) {
        panelData.gastosFijosMensuales.splice(index, 1);
        recalcularMetaDiaria();
        renderGastosFijos();
        alert("Gasto fijo eliminado.");
    }
};

function renderDeudas() { 
    const l=$("listaDeudas"), s=$("abonoSeleccionar"); if(!l)return; l.innerHTML=""; s.innerHTML="";
    panelData.deudas.forEach(d => { 
        if(d.saldo>0.1) { 
            const proximo = d.proximoPago ? formatearFecha(new Date(d.proximoPago)) : 'N/A';
            const montoCuota = safeNumber(d.montoCuota);
            l.innerHTML+=`<li><strong>${d.desc}</strong> ($${fmtMoney(d.saldo)} restan) | Cuota: $${fmtMoney(montoCuota)} (${d.frecuencia}) | Próx. Pago: ${proximo}</li>`; 
            const o=document.createElement("option"); o.value=d.id; o.text=d.desc; s.add(o); 
        } 
    });
}

function renderIndex() {
    const m = calcularMetricasGenerales();
    calcularMetricasCombustible(true);
    const set = (id,v) => { if($(id)) $(id).innerText = v; };

    set("resHoras", `${m.horasTotal.toFixed(2)}h`);
    set("resGananciaBruta", `$${fmtMoney(m.brutaProm)}`);
    set("resGananciaNeta", `$${fmtMoney(m.netoDiario)}`);
    set("resKmRecorridos", `${m.kmTotal.toFixed(0)} km`);
    set("proyKmTotal", `${m.kmTotal.toFixed(0)} KM`);
    set("proyDeuda", `$${fmtMoney(m.deuda)}`);
    set("proyGastoFijoDiario", `$${fmtMoney(m.meta)}`);
    set("proyNetaPromedio", `$${fmtMoney(m.netoDiario)}`);
    set("proyDias", m.diasLibre);
    
    checkTutorial(); // <-- Ejecuta la revisión del tutorial
}
// (Otras funciones de UI omitidas por brevedad)

// ---------- WIZARDS Y LISTENERS (Omitidos por brevedad, no hay cambios) ----------
function actualizarUITurno() { /* ... */ }
function iniciarTurno() { /* ... */ }
function finalizarTurno() { /* ... */ }
function setupGasolinaWizard() { /* ... */ }
function setupGastosInteligentes() { /* ... */ }
function setupDeudaWizard() { /* ... */ }
function setupListeners() { /* ... */ }

// INICIALIZACIÓN
document.addEventListener("DOMContentLoaded", () => {
    cargarPanelData();
    const page = document.body.getAttribute('data-page');
    if (page === 'admin') {
        setupGasolinaWizard();
        setupGastosInteligentes();
        setupDeudaWizard(); 
        setupListeners();
        actualizarUITurno();
        renderDeudas();
        renderGastosFijos();
    } else if (page === 'index') {
        renderIndex();
    }
});
