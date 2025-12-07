// app.js - VERSIÓN FINAL GASTOS INTELIGENTES
// ---------------------------------------------------------------------

const STORAGE_KEY = "panelData";
const $ = id => document.getElementById(id);
let gananciasChart = null;
let kmChart = null;

// --- CONFIGURACIÓN DE CATEGORÍAS INTELIGENTES ---
const CATEGORIAS_GASTOS = {
    moto: [
        "Mantenimiento (Aceite/Filtros)",
        "Reparación Mecánica",
        "Llantas/Frenos",
        "Peajes/Casetas",
        "Lavado/Limpieza",
        "Accesorios/Equipo",
        "Seguro/Trámites",
        "Otros Moto"
    ],
    hogar: [
        "Comida del día (Calle)",
        "Despensa/Supermercado",
        "Renta",
        "Luz/Agua/Gas",
        "Internet/Streaming (Netflix, etc)",
        "Celular/Datos",
        "Salud/Farmacia",
        "Ropa/Personal",
        "Diversión/Salidas",
        "Otros Hogar"
    ]
};

const DEFAULT_PANEL_DATA = {
  ingresos: [], gastos: [], turnos: [], movimientos: [], cargasCombustible: [], deudas: [],
  parametros: {
    deudaTotal: 0, gastoFijo: 0, ultimoKMfinal: 0, costoPorKm: 0,
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
function validarYArreglarDatos() {
  ['ingresos', 'gastos', 'deudas', 'movimientos', 'turnos', 'cargasCombustible'].forEach(k => {
    if (!Array.isArray(panelData[k])) panelData[k] = [];
  });
  if (!panelData.parametros) panelData.parametros = DEFAULT_PANEL_DATA.parametros;
  panelData.parametros.ultimoKMfinal = safeNumber(panelData.parametros.ultimoKMfinal);
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
        const json = $("importJson").value;
        if (!json) return;
        panelData = { ...DEFAULT_PANEL_DATA, ...JSON.parse(json) };
        validarYArreglarDatos();
        alert("Restaurado.");
        window.location.reload();
    } catch (e) { alert("Error JSON"); }
}

// ---------- CÁLCULOS ----------
function calcularMetricasCombustible(updateUI = true) {
    const cargas = panelData.cargasCombustible.sort((a, b) => a.kmActual - b.kmActual);
    if (cargas.length >= 2) {
        const ultimas = cargas.slice(-3);
        let kmT = 0, costoT = 0;
        for (let i = 1; i < ultimas.length; i++) {
            const dist = ultimas[i].kmActual - ultimas[i-1].kmActual;
            if (dist > 0) { kmT += dist; costoT += ultimas[i].costo; }
        }
        if (kmT > 0) panelData.parametros.costoPorKm = costoT / kmT;
    }
    
    // Proyección
    const ultimoKM = safeNumber(panelData.parametros.ultimoKMfinal);
    const ultimaCarga = cargas.length > 0 ? cargas[cargas.length-1].kmActual : ultimoKM;
    const rest = 350 - (ultimoKM - ultimaCarga); // 350km tanque
    
    if (updateUI) {
        if($("costoPorKmDisplay")) $("costoPorKmDisplay").innerText = `$${fmtMoney(panelData.parametros.costoPorKm)}`;
        if($("proyeccionRepostaje")) $("proyeccionRepostaje").innerText = rest < 50 ? "¡URGENTE!" : `${rest.toFixed(0)} km rest.`;
    }
    saveData();
}

function calcularMetricasGenerales() {
  const turnos = panelData.turnos;
  const dias = new Set(turnos.map(t => t.fechaInicio.split('T')[0])).size || 1;
  const ing = panelData.ingresos.reduce((s, x) => s + safeNumber(x.monto), 0) + turnos.reduce((s,t) => s + t.gananciaBruta, 0);
  const gas = panelData.gastos.filter(g => g.esTrabajo).reduce((s, x) => s + safeNumber(x.monto), 0);
  const neta = ing - gas;
  
  return {
    netoDiario: dias > 0 ? neta/dias : 0,
    deuda: panelData.parametros.deudaTotal,
    meta: panelData.parametros.gastoFijo,
    kmTotal: turnos.reduce((s,t) => s+t.kmRecorrido, 0),
    horasTotal: turnos.reduce((s,t) => s+t.horas, 0),
    brutaProm: ing/dias,
    diasLibre: (neta/dias - panelData.parametros.gastoFijo) > 0 ? Math.ceil(panelData.parametros.deudaTotal / (neta/dias)) : "N/A"
  };
}

// ---------- UI INTELIGENTE DE GASTOS ----------
function setupGastosInteligentes() {
    const radios = document.getElementsByName("gastoTipoRadio");
    const select = $("gastoCategoriaSelect");
    const checkFijo = $("gastoRecurrenteCheck");
    const divDia = $("divDiaPago");
    
    // Función para llenar el select
    const llenarCategorias = (tipo) => {
        select.innerHTML = "";
        CATEGORIAS_GASTOS[tipo].forEach(cat => {
            const opt = document.createElement("option");
            opt.value = cat;
            opt.text = cat;
            select.add(opt);
        });
    };

    // Listener Radios
    radios.forEach(r => {
        r.addEventListener("change", (e) => llenarCategorias(e.target.value));
    });

    // Listener Checkbox
    if(checkFijo) {
        checkFijo.addEventListener("change", (e) => {
            divDia.style.display = e.target.checked ? "block" : "none";
        });
    }

    // Inicializar
    llenarCategorias("moto");
}

// ---------- GESTIÓN DE TURNO ----------
function actualizarUITurno() {
  const btn = $("btnIniciarTurno");
  if(!btn) return;
  calcularMetricasCombustible(true);
  
  if (turnoActivo) {
    $("turnoTexto").innerHTML = `🟢 En curso (${new Date(turnoActivo.inicio).toLocaleTimeString()})`;
    btn.style.display = 'none';
    $("btnFinalizarTurno").style.display = 'block';
    $("cierreTurnoContainer").style.display = 'block';
  } else {
    $("turnoTexto").innerHTML = `🔴 Sin turno`;
    btn.style.display = 'block';
    $("btnFinalizarTurno").style.display = 'none';
    $("cierreTurnoContainer").style.display = 'none';
  }
}

function iniciarTurno() {
  const kmInicial = safeNumber(panelData.parametros.ultimoKMfinal);
  if (kmInicial <= 0 && !confirm("KM Inicial es 0. ¿Continuar?")) return;
  
  turnoActivo = { inicio: Date.now(), kmInicial };
  localStorage.setItem("turnoActivo", JSON.stringify(turnoActivo));
  actualizarUITurno();
}

function finalizarTurno() {
  const kmFinal = safeNumber($("kmFinalTurno").value);
  const ganancia = safeNumber($("gananciaBruta").value);
  
  if (kmFinal <= turnoActivo.kmInicial) return alert("KM Final debe ser mayor al inicial.");
  if (ganancia <= 0) return alert("Ingresa ganancia.");

  const rec = kmFinal - turnoActivo.kmInicial;
  const horas = (Date.now() - turnoActivo.inicio) / 36e5;
  const costo = rec * panelData.parametros.costoPorKm;
  
  panelData.turnos.push({
    id: Date.now(), fechaInicio: new Date(turnoActivo.inicio).toISOString(), fechaFin: new Date().toISOString(),
    horas, kmInicial: turnoActivo.kmInicial, kmFinal, kmRecorrido: rec,
    gananciaBruta: ganancia, gananciaNeta: ganancia - costo
  });

  panelData.parametros.ultimoKMfinal = kmFinal;
  turnoActivo = false; localStorage.removeItem("turnoActivo");
  
  saveData(); actualizarUITurno();
  $("kmFinalTurno").value = ""; $("gananciaBruta").value = "";
  alert(`Turno finalizado. Neta Est.: $${fmtMoney(ganancia - costo)}`);
}

// ---------- WIZARD GASOLINA ----------
function setupGasolinaWizard() {
    const p1 = $("gasWizardPaso1"), p2 = $("gasWizardPaso2"), p3 = $("gasWizardPaso3");
    
    $("btnGasSiguiente1").onclick = () => { if($("gasLitros").value > 0) { p1.style.display="none"; p2.style.display="block"; } };
    $("btnGasSiguiente2").onclick = () => { if($("gasCosto").value > 0) { p2.style.display="none"; p3.style.display="block"; } };
    $("btnGasAtras2").onclick = () => { p2.style.display="none"; p1.style.display="block"; };
    $("btnGasAtras3").onclick = () => { p3.style.display="none"; p2.style.display="block"; };

    $("btnRegistrarCargaFinal").onclick = () => {
        const km = safeNumber($("gasKmActual").value);
        const last = safeNumber(panelData.parametros.ultimoKMfinal);
        if (km <= last && last > 0) return alert("KM debe ser mayor al anterior.");
        
        const carga = { id: Date.now(), fecha: new Date().toISOString(), kmActual: km, litros: safeNumber($("gasLitros").value), costo: safeNumber($("gasCosto").value) };
        panelData.cargasCombustible.push(carga);
        panelData.gastos.push({ id: Date.now(), tipo: 'Gasto', descripcion: 'Carga Gasolina', monto: carga.costo, fecha: carga.fecha, esTrabajo: true });
        panelData.parametros.ultimoKMfinal = km;
        
        $("gasLitros").value=""; $("gasCosto").value=""; $("gasKmActual").value="";
        p3.style.display="none"; p1.style.display="block";
        saveData(); calcularMetricasCombustible(true); actualizarUITurno();
        alert("Carga registrada.");
    };
}

// ---------- LISTENERS GENERALES ----------
function setupListeners() {
    // Ingreso
    if($("btnRegistrarIngreso")) $("btnRegistrarIngreso").onclick = () => {
        const d = $("ingresoDescripcion").value; const m = safeNumber($("ingresoCantidad").value);
        if(m > 0) { panelData.ingresos.push({id: Date.now(), descripcion: d, monto: m, fecha: new Date().toISOString()}); saveData(); alert("Ingreso OK"); $("ingresoDescripcion").value=""; $("ingresoCantidad").value=""; }
    };

    // GASTO INTELIGENTE
    if($("btnRegistrarGasto")) $("btnRegistrarGasto").onclick = () => {
        const monto = safeNumber($("gastoCantidad").value);
        if (monto <= 0) return alert("Ingresa un monto.");

        const tipoRadio = document.querySelector('input[name="gastoTipoRadio"]:checked').value;
        const categoria = $("gastoCategoriaSelect").value;
        const descManual = $("gastoDescripcion").value.trim();
        const esFijo = $("gastoRecurrenteCheck").checked;
        const diaPago = esFijo ? safeNumber($("gastoDiaPago").value) : null;

        // Construir descripción automática si no hay manual
        const descFinal = descManual ? `${categoria}: ${descManual}` : categoria;

        panelData.gastos.push({
            id: Date.now(),
            fecha: new Date().toISOString(),
            descripcion: descFinal,
            categoria: categoria, // Guardamos la categoría limpia para análisis futuro
            monto: monto,
            esTrabajo: (tipoRadio === 'moto'),
            esFijo: esFijo,
            diaPago: diaPago,
            tipo: 'Gasto'
        });

        saveData();
        alert(`Gasto registrado: ${descFinal}`);
        $("gastoCantidad").value = "";
        $("gastoDescripcion").value = "";
        $("gastoRecurrenteCheck").checked = false;
        $("divDiaPago").style.display = "none";
    };

    // Deudas
    if($("btnSiguienteDeuda")) $("btnSiguienteDeuda").onclick = () => {
        const m = safeNumber($("deudaMontoTotal").value); const d = $("deudaDescripcion").value;
        if(m>0) { panelData.deudas.push({id:Date.now(), desc:d, saldo:m}); saveData(); renderDeudas(); updateDeudaWiz(); }
    };
    if($("btnFinalizarDeuda")) $("btnFinalizarDeuda").onclick = () => {
        const m = safeNumber($("gastoFijoDiario").value);
        if(m>0) { panelData.parametros.gastoFijo = m; saveData(); updateDeudaWiz(); alert("Meta OK"); }
    };
    if($("btnRegistrarAbono")) $("btnRegistrarAbono").onclick = () => {
        const id = $("abonoSeleccionar").value; const m = safeNumber($("abonoMonto").value);
        const d = panelData.deudas.find(x=>x.id==id);
        if(d && m>0 && m<=d.saldo) { d.saldo-=m; panelData.gastos.push({id:Date.now(), descripcion:`Abono ${d.desc}`, monto:m, fecha:new Date().toISOString(), esTrabajo:false}); saveData(); renderDeudas(); alert("Abonado"); }
    };

    // Export/Import
    if($("btnExportar")) $("btnExportar").onclick = exportarJson;
    if($("btnImportar")) $("btnImportar").onclick = importarJson;
}

function updateDeudaWiz() { const s1=$("wizardStep1"), s2=$("wizardStep2"); if(s1){ const active=panelData.deudas.length>0; s1.style.display=active?'none':'block'; s2.style.display=active?'block':'none'; } }
function renderDeudas() { 
    const l=$("listaDeudas"), s=$("abonoSeleccionar"); if(!l)return; l.innerHTML=""; s.innerHTML="";
    panelData.deudas.forEach(d => { if(d.saldo>0.1) { l.innerHTML+=`<li>${d.desc}: $${fmtMoney(d.saldo)}</li>`; const o=document.createElement("option"); o.value=d.id; o.text=d.desc; s.add(o); } });
}

// RENDER INDEX (Simplificado)
function renderIndex() {
    const m = calcularMetricasGenerales();
    calcularMetricasCombustible(true);
    const set = (id,v) => { if($(id)) $(id).innerText = v; };
    set("resGananciaBruta", `$${fmtMoney(m.brutaProm)}`);
    set("resGananciaNeta", `$${fmtMoney(m.netoDiario)}`);
    // ... completar resto de renders visuales
    renderCharts();
}
function renderCharts() { if(typeof Chart !== 'undefined' && $("graficaGanancias")) { /* chart logic here */ } }

// INIT
document.addEventListener("DOMContentLoaded", () => {
    cargarPanelData();
    const page = document.body.getAttribute('data-page');
    if (page === 'admin') {
        setupGasolinaWizard();
        setupGastosInteligentes(); // <--- INICIA EL NUEVO MODULO
        setupListeners();
        actualizarUITurno();
        renderDeudas();
        updateDeudaWiz();
    } else if (page === 'index') {
        renderIndex();
    }
});
