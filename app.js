// app.js - VERSIÓN FINAL: GASTOS RECURRENTES QUE SÍ SE GUARDAN
// ---------------------------------------------------------------------

const STORAGE_KEY = "panelData";
const $ = id => document.getElementById(id);
let gananciasChart = null;
let kmChart = null;

// --- CONFIGURACIÓN DE CATEGORÍAS ---
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

const DEFAULT_PANEL_DATA = {
  ingresos: [], gastos: [], turnos: [], movimientos: [], cargasCombustible: [], deudas: [],
  gastosFijosMensuales: [], // <--- AQUÍ SE GUARDAN LOS RECURRENTES
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

// ---------- CÁLCULOS CENTRALES ----------
function recalcularMetaDiaria() {
    // 1. Sumar gastos fijos
    const totalFijos = panelData.gastosFijosMensuales.reduce((s, g) => s + safeNumber(g.monto), 0);
    // 2. Dividir entre 30 días
    const cuotaFijos = totalFijos / 30;
    
    panelData.parametros.gastoFijo = cuotaFijos; // Guardar la meta calculada
    
    if($("metaDiariaDisplay")) $("metaDiariaDisplay").innerText = `$${fmtMoney(cuotaFijos)}`;
    if($("totalFijoMensualDisplay")) $("totalFijoMensualDisplay").innerText = `$${fmtMoney(totalFijos)}`;
    
    saveData();
}

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
    const ultimoKM = safeNumber(panelData.parametros.ultimoKMfinal);
    const ultimaCarga = cargas.length > 0 ? cargas[cargas.length-1].kmActual : ultimoKM;
    const rest = 350 - (ultimoKM - ultimaCarga); 
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
    brutaProm: ing/dias
  };
}

// ---------- UI INTELIGENTE DE GASTOS ----------
function setupGastosInteligentes() {
    const radios = document.getElementsByName("gastoTipoRadio");
    const select = $("gastoCategoriaSelect");
    const inputManual = $("gastoCategoriaManual"); 
    const checkFijo = $("gastoRecurrenteCheck");
    const divDia = $("divDiaPago");
    
    const llenarCategorias = (tipo) => {
        select.innerHTML = "";
        CATEGORIAS_GASTOS[tipo].forEach(cat => {
            const opt = document.createElement("option"); opt.value = cat; opt.text = cat; select.add(opt);
        });
        inputManual.style.display = "none"; inputManual.value = "";
    };

    select.addEventListener("change", (e) => {
        inputManual.style.display = e.target.value.includes("Otra") ? "block" : "none";
        if(e.target.value.includes("Otra")) inputManual.focus();
    });

    radios.forEach(r => r.addEventListener("change", (e) => llenarCategorias(e.target.value)));
    if(checkFijo) checkFijo.addEventListener("change", (e) => divDia.style.display = e.target.checked ? "block" : "none");
    llenarCategorias("moto");
}

function renderGastosFijos() {
    const ul = $("listaGastosFijos");
    if(!ul) return;
    ul.innerHTML = "";
    
    if (panelData.gastosFijosMensuales.length === 0) {
        ul.innerHTML = "<li style='color:#777; font-style:italic;'>No tienes gastos fijos activos.</li>";
        return;
    }

    panelData.gastosFijosMensuales.forEach((g, index) => {
        const li = document.createElement("li");
        li.style.display = "flex";
        li.style.justifyContent = "space-between";
        li.style.alignItems = "center";
        li.style.padding = "5px 0";
        li.style.borderBottom = "1px solid #eee";
        
        li.innerHTML = `
            <span><strong>${g.categoria}</strong> (Día ${g.diaPago}):</span>
            <span>$${fmtMoney(g.monto)} 
                <button class="btn-danger" style="padding:2px 6px; font-size:0.7rem; margin-left:10px;" onclick="eliminarGastoFijo(${index})">X</button>
            </span>
        `;
        ul.appendChild(li);
    });
}

// Función global para poder llamarla desde el HTML generado
window.eliminarGastoFijo = function(index) {
    if(confirm("¿Ya no pagarás este servicio mensualmente?")) {
        panelData.gastosFijosMensuales.splice(index, 1);
        recalcularMetaDiaria();
        renderGastosFijos();
        alert("Gasto fijo eliminado.");
    }
};

// ---------- GESTIÓN DE TURNO ----------
function actualizarUITurno() {
  const btn = $("btnIniciarTurno"); if(!btn) return;
  calcularMetricasCombustible(true);
  
  if (turnoActivo) {
    $("turnoTexto").innerHTML = `🟢 En curso (${new Date(turnoActivo.inicio).toLocaleTimeString()})`;
    btn.style.display = 'none'; $("btnFinalizarTurno").style.display = 'block'; $("cierreTurnoContainer").style.display = 'block';
  } else {
    $("turnoTexto").innerHTML = `🔴 Sin turno`;
    btn.style.display = 'block'; $("btnFinalizarTurno").style.display = 'none'; $("cierreTurnoContainer").style.display = 'none';
  }
}

function iniciarTurno() {
  const kmInicial = safeNumber(panelData.parametros.ultimoKMfinal);
  if (kmInicial <= 0 && !confirm("KM Inicial es 0. ¿Continuar?")) return;
  turnoActivo = { inicio: Date.now(), kmInicial };
  localStorage.setItem("turnoActivo", JSON.stringify(turnoActivo)); actualizarUITurno();
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
    if($("btnRegistrarIngreso")) $("btnRegistrarIngreso").onclick = () => {
        const d = $("ingresoDescripcion").value; const m = safeNumber($("ingresoCantidad").value);
        if(m > 0) { panelData.ingresos.push({id: Date.now(), descripcion: d, monto: m, fecha: new Date().toISOString()}); saveData(); alert("Ingreso OK"); $("ingresoDescripcion").value=""; $("ingresoCantidad").value=""; }
    };

    // --- REGISTRO DE GASTO INTELIGENTE Y RECURRENTE ---
    if($("btnRegistrarGasto")) $("btnRegistrarGasto").onclick = () => {
        const monto = safeNumber($("gastoCantidad").value);
        if (monto <= 0) return alert("Ingresa un monto.");

        const tipoRadio = document.querySelector('input[name="gastoTipoRadio"]:checked').value;
        const selectCat = $("gastoCategoriaSelect").value;
        const manualCat = $("gastoCategoriaManual").value.trim();
        const descExtra = $("gastoDescripcion").value.trim();
        
        let categoriaFinal = selectCat;
        if (selectCat.includes("Otra") && manualCat) { categoriaFinal = manualCat; }
        else if (selectCat.includes("Otra") && !manualCat) { return alert("Escribe el nombre de la categoría."); }

        const descCompleta = descExtra ? `${categoriaFinal}: ${descExtra}` : categoriaFinal;
        const esFijo = $("gastoRecurrenteCheck").checked;
        const diaPago = esFijo ? safeNumber($("gastoDiaPago").value) : null;

        // 1. Guardar como gasto de HOY (Historial)
        panelData.gastos.push({
            id: Date.now(), fecha: new Date().toISOString(), descripcion: descCompleta,
            categoria: categoriaFinal, monto: monto, esTrabajo: (tipoRadio === 'moto'),
            esFijo: esFijo, diaPago: diaPago, tipo: 'Gasto'
        });

        // 2. SI ES FIJO: Guardar en lista de obligaciones para calcular meta
        if (esFijo) {
            panelData.gastosFijosMensuales.push({
                id: Date.now(),
                categoria: categoriaFinal,
                descripcion: descExtra,
                monto: monto,
                diaPago: diaPago || 1
            });
            recalcularMetaDiaria(); // Actualizar la meta inmediatamente
            renderGastosFijos(); // Actualizar la lista visual
        }

        saveData();
        alert(esFijo ? `Gasto registrado y agregado a Obligaciones Mensuales.` : `Gasto registrado: ${descCompleta}`);
        
        // Limpieza
        $("gastoCantidad").value = ""; $("gastoDescripcion").value = "";
        $("gastoCategoriaManual").value = ""; $("gastoCategoriaManual").style.display = "none";
        $("gastoCategoriaSelect").selectedIndex = 0;
        $("gastoRecurrenteCheck").checked = false;
        $("divDiaPago").style.display = "none";
    };

    if($("btnSiguienteDeuda")) $("btnSiguienteDeuda").onclick = () => {
        const m = safeNumber($("deudaMontoTotal").value); const d = $("deudaDescripcion").value;
        if(m>0) { panelData.deudas.push({id:Date.now(), desc:d, saldo:m}); saveData(); renderDeudas(); }
    };
    if($("btnRegistrarAbono")) $("btnRegistrarAbono").onclick = () => {
        const id = $("abonoSeleccionar").value; const m = safeNumber($("abonoMonto").value);
        const d = panelData.deudas.find(x=>x.id==id);
        if(d && m>0 && m<=d.saldo) { d.saldo-=m; panelData.gastos.push({id:Date.now(), descripcion:`Abono ${d.desc}`, monto:m, fecha:new Date().toISOString(), esTrabajo:false}); saveData(); renderDeudas(); alert("Abonado"); }
    };

    if($("btnExportar")) $("btnExportar").onclick = exportarJson;
    if($("btnImportar")) $("btnImportar").onclick = importarJson;
}

function renderDeudas() { 
    const l=$("listaDeudas"), s=$("abonoSeleccionar"); if(!l)return; l.innerHTML=""; s.innerHTML="";
    panelData.deudas.forEach(d => { if(d.saldo>0.1) { l.innerHTML+=`<li>${d.desc}: $${fmtMoney(d.saldo)}</li>`; const o=document.createElement("option"); o.value=d.id; o.text=d.desc; s.add(o); } });
}

function renderIndex() {
    const m = calcularMetricasGenerales();
    calcularMetricasCombustible(true);
    const set = (id,v) => { if($(id)) $(id).innerText = v; };
    set("resGananciaBruta", `$${fmtMoney(m.brutaProm)}`);
    set("resGananciaNeta", `$${fmtMoney(m.netoDiario)}`);
    renderCharts();
}
function renderCharts() { if(typeof Chart !== 'undefined' && $("graficaGanancias")) { /* chart logic here */ } }

document.addEventListener("DOMContentLoaded", () => {
    cargarPanelData();
    const page = document.body.getAttribute('data-page');
    if (page === 'admin') {
        setupGasolinaWizard();
        setupGastosInteligentes();
        setupListeners();
        actualizarUITurno();
        renderDeudas();
        renderGastosFijos(); // <--- Mostrar lista de fijos al iniciar
    } else if (page === 'index') {
        renderIndex();
    }
});
