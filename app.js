// app.js - LÓGICA FINAL: TURNO DESACOPLADO DE KM (PARTE 1)

const STORAGE_KEY = "panelData";
const $ = id => document.getElementById(id);

let gananciasChart = null;
let kmChart = null;

const DEFAULT_PANEL_DATA = {
  ingresos: [], gastos: [], deudas: [], movimientos: [], turnos: [], cargasCombustible: [],
  parametros: {
    deudaTotal: 0, gastoFijo: 0, ultimoKMfinal: 0, costoPorKm: 0,
    mantenimientoBase: { 'Aceite (KM)': 3000, 'Bujía (KM)': 8000, 'Llantas (KM)': 15000 }
  }
};

let panelData = JSON.parse(JSON.stringify(DEFAULT_PANEL_DATA));
let turnoActivo = JSON.parse(localStorage.getItem("turnoActivo")) || false;

// Utils
function safeNumber(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }
function fmtMoney(n) { return safeNumber(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
function formatearFecha(d) { return new Date(d).toLocaleDateString(); }

// ---------- GESTIÓN DE DATOS ----------
function validarYArreglarDatos() {
  ['ingresos', 'gastos', 'deudas', 'movimientos', 'turnos', 'cargasCombustible'].forEach(k => {
    if (!Array.isArray(panelData[k])) panelData[k] = [];
  });
  if (!panelData.parametros) panelData.parametros = JSON.parse(JSON.stringify(DEFAULT_PANEL_DATA.parametros));
  if (!panelData.parametros.mantenimientoBase) panelData.parametros.mantenimientoBase = DEFAULT_PANEL_DATA.parametros.mantenimientoBase;
  
  // Reordenar movimientos
  const m1 = panelData.gastos.map(g => ({...g, tipo:'Gasto', fecha: g.fecha||new Date().toISOString()}));
  const m2 = panelData.ingresos.map(i => ({...i, tipo:'Ingreso', fecha: i.fecha||new Date().toISOString(), monto: safeNumber(i.monto)}));
  panelData.movimientos = [...m1, ...m2].sort((a,b) => new Date(b.fecha) - new Date(a.fecha));

  // Recalcular costo promedio KM (basado solo en cargas)
  calcularMetricasCombustible(false);
  saveData();
}

function cargarPanelData() {
  const d = localStorage.getItem(STORAGE_KEY);
  if (d) { try { panelData = {...panelData, ...JSON.parse(d)}; } catch (e) {} }
  validarYArreglarDatos();
}

function saveData() { localStorage.setItem(STORAGE_KEY, JSON.stringify(panelData)); }
// app.js - PARTE 2: GESTIÓN DE TURNO (SOLO DINERO Y TIEMPO)

function actualizarUITurno() {
    const btnIni = $("btnIniciarTurno");
    const cierreForm = $("cierreForm");
    const txt = $("turnoTexto");
    if (!btnIni) return;

    if (turnoActivo) {
        txt.innerHTML = `🟢 En curso (Desde: ${new Date(turnoActivo.inicio).toLocaleTimeString()})`;
        btnIni.style.display = 'none';
        cierreForm.style.display = 'block';
    } else {
        txt.innerHTML = `🔴 Sin turno activo`;
        btnIni.style.display = 'block';
        cierreForm.style.display = 'none';
    }
}

function iniciarTurno() {
    turnoActivo = { inicio: Date.now() };
    localStorage.setItem("turnoActivo", JSON.stringify(turnoActivo));
    actualizarUITurno();
}

function finalizarTurno() {
    const ganancia = safeNumber($("gananciaCierre").value);
    if (ganancia <= 0) return alert("Ingresa la ganancia.");

    const horas = (Date.now() - turnoActivo.inicio) / 36e5;
    
    panelData.turnos.push({
        id: Date.now(),
        fechaInicio: new Date(turnoActivo.inicio).toISOString(),
        fechaFin: new Date().toISOString(),
        horas: horas,
        gananciaBruta: ganancia,
        gananciaNeta: ganancia // Sin KM, la neta es la bruta (o réstale gastos manuales en reporte)
    });

    turnoActivo = false;
    localStorage.removeItem("turnoActivo");
    saveData();
    actualizarUITurno();
    $("gananciaCierre").value = "";
    alert(`Turno finalizado.\nGanancia: $${fmtMoney(ganancia)}`);
}
// app.js - PARTE 3: COMBUSTIBLE Y ODÓMETRO

function calcularMetricasCombustible(updateUI = true) {
    const cargas = panelData.cargasCombustible.slice().sort((a,b) => a.kmCarga - b.kmCarga);
    
    // Costo por KM (Histórico entre cargas)
    let kmTot = 0, costoTot = 0;
    // Usar ultimas 5 cargas para promedio
    const muestras = cargas.slice(-5);
    for(let i=1; i<muestras.length; i++) {
        const dist = muestras[i].kmCarga - muestras[i-1].kmCarga;
        if(dist>0) { kmTot+=dist; costoTot+=muestras[i-1].monto; } 
    }
    const costoProm = kmTot>0 ? (costoTot/kmTot) : 0;
    panelData.parametros.costoPorKm = costoProm;

    if(updateUI && $("costoPorKmDisplay")) {
        $("costoPorKmDisplay").innerText = `$${fmtMoney(costoProm)}`;
        $("ultimoKmDisplay").innerText = safeNumber(panelData.parametros.ultimoKMfinal);
    }
}

function actualizarOdometro() {
    const lectura = safeNumber($("kmSoloLectura").value);
    const anterior = safeNumber(panelData.parametros.ultimoKMfinal);
    
    if (lectura <= anterior && anterior > 0) return alert(`El odómetro debe ser mayor a ${anterior}.`);
    
    // Calculamos recorrido desde la última vez
    const recorrido = lectura - anterior;
    
    panelData.parametros.ultimoKMfinal = lectura;
    saveData();
    calcularMetricasCombustible(true);
    $("kmSoloLectura").value = "";
    alert(`Odómetro actualizado a ${lectura}.\nRecorrido registrado: ${recorrido} KM.`);
}

// REEMPLAZA SOLO LA FUNCIÓN registrarCarga POR ESTA:

function registrarCarga() {
    const km = safeNumber($("kmCarga").value);
    const l = safeNumber($("litrosCarga").value);
    const dinero = safeNumber($("costoCarga").value);
    
    // Como borramos el input de descripción, definimos una automática
    const desc = "Carga Gasolina"; 
    const anterior = safeNumber(panelData.parametros.ultimoKMfinal);

    if (km <= anterior && anterior > 0) return alert(`El KM debe ser mayor a ${anterior}.`);
    if (l <= 0 || dinero <= 0) return alert("Faltan datos de litros o costo.");

    // 1. Guardar carga en historial de combustible
    const carga = { id: Date.now(), fecha: new Date().toISOString(), kmCarga: km, litros: l, monto: dinero };
    panelData.cargasCombustible.push(carga);

    // 2. Guardar también como Gasto (para que cuadren las cuentas)
    const gasto = { 
        id: Date.now(), 
        tipo: 'Gasto', 
        descripcion: `Gasolina (${l}L)`, // Descripción automática
        monto: dinero, 
        fecha: carga.fecha, 
        esTrabajo: true 
    };
    panelData.gastos.push(gasto); 
    panelData.movimientos.push(gasto);

    // 3. Actualizar odómetro global
    panelData.parametros.ultimoKMfinal = km;

    saveData();
    calcularMetricasCombustible(true);
    
    // Limpiar inputs (Ya no limpiamos descCarga porque no existe)
    $("kmCarga").value = ""; 
    $("litrosCarga").value = ""; 
    $("costoCarga").value = ""; 
    
    alert("Carga registrada exitosamente.");
}
// app.js - PARTE 4: OTROS MOVIMIENTOS Y DEUDAS

function registrarMov(tipo, descId, montoId, esTrabajo) {
    const d = $(descId).value.trim();
    const m = safeNumber($(montoId).value);
    if (!d || m <= 0) return alert("Datos incompletos.");
    const mov = { id: Date.now(), tipo, descripcion: d, monto: m, fecha: new Date().toISOString(), esTrabajo };
    if (tipo==='Ingreso') panelData.ingresos.push(mov); else panelData.gastos.push(mov);
    panelData.movimientos.push(mov);
    saveData(); $(descId).value=""; $(montoId).value=""; alert("Registrado.");
}

// ---------- DEUDAS ----------
function setupDeudas() {
    const s1=$('wizardStep1'), s2=$('wizardStep2');
    const toggle = () => { 
        const activo = panelData.deudas.length>0 || panelData.parametros.gastoFijo>0;
        s1.style.display=activo?'none':'block'; s2.style.display=activo?'block':'none';
    };

    if($("btnSiguienteDeuda")) $("btnSiguienteDeuda").onclick = () => {
        const m = safeNumber($("deudaMontoTotal").value);
        const d = $("deudaDescripcion").value;
        if(m<=0 || !d) return alert("Error.");
        panelData.deudas.push({id:Date.now(), descripcion:d, saldo:m, estado:'Pendiente'});
        toggle();
    };
    if($("btnFinalizarDeuda")) $("btnFinalizarDeuda").onclick = () => {
        const v = safeNumber($("gastoFijoDiario").value);
        if(v<=0) return alert("Error.");
        panelData.parametros.gastoFijo=v; saveData(); alert("Meta guardada.");
    };
    if($("btnVolverDeuda")) $("btnVolverDeuda").onclick = () => { s1.style.display='block'; s2.style.display='none'; };
    
    if($("btnRegistrarAbono")) $("btnRegistrarAbono").onclick = () => {
        const id = parseInt($("abonoSeleccionar").value);
        const m = safeNumber($("abonoMonto").value);
        const d = panelData.deudas.find(x=>x.id===id);
        if(!d || m>d.saldo || m<=0) return alert("Abono inválido.");
        d.saldo-=m; 
        panelData.movimientos.push({id:Date.now(), tipo:'Gasto', descripcion:`Abono: ${d.descripcion}`, monto:m, fecha:new Date().toISOString()});
        saveData(); renderDeudas(); $("abonoMonto").value=""; alert("Abonado.");
    };
    toggle();
}

function renderDeudas() {
    const l=$("listaDeudas"), s=$("abonoSeleccionar");
    if(!l) return; l.innerHTML=""; s.innerHTML="<option value=''>-- Seleccionar --</option>";
    panelData.deudas.forEach(d => {
        l.innerHTML+=`<li>${d.descripcion} - $${fmtMoney(d.saldo)}</li>`;
        if(d.saldo>0) s.innerHTML+=`<option value="${d.id}">${d.descripcion}</option>`;
    });
}
// app.js - PARTE 5: EXPORTAR E INICIALIZACIÓN

function exportarJson() { navigator.clipboard.writeText(JSON.stringify(panelData)).then(() => alert("Copiado.")); }
function importarJson() {
    const v = $("importJson").value; if(!v) return;
    try { panelData = {...DEFAULT_PANEL_DATA, ...JSON.parse(v)}; validarYArreglarDatos(); alert("Restaurado."); location.reload(); } 
    catch(e) { alert("Error JSON"); }
}

// INIT
document.addEventListener("DOMContentLoaded", () => {
    cargarPanelData();
    const p = document.body.getAttribute('data-page');
    if (p === 'admin') {
        actualizarUITurno(); setupDeudas(); renderDeudas(); calcularMetricasCombustible(true);
        
        if($("btnIniciarTurno")) $("btnIniciarTurno").onclick = iniciarTurno;
        if($("btnFinalizarTurno")) $("btnFinalizarTurno").onclick = finalizarTurno;
        
        if($("btnRegistrarIngreso")) $("btnRegistrarIngreso").onclick = () => registrarMov('Ingreso', 'ingresoDescripcion', 'ingresoCantidad', true);
        if($("btnRegistrarGasto")) $("btnRegistrarGasto").onclick = () => registrarMov('Gasto', 'gastoDescripcion', 'gastoCantidad', $("gastoTipo").value==='trabajo');
        
        if($("btnActualizarKm")) $("btnActualizarKm").onclick = actualizarOdometro;
        if($("btnRegistrarCarga")) $("btnRegistrarCarga").onclick = registrarCarga;

        if($("btnExportar")) $("btnExportar").onclick = exportarJson;
        if($("btnImportar")) $("btnImportar").onclick = importarJson;
        
        if($("btnGuardarMantenimiento")) $("btnGuardarMantenimiento").onclick = () => {
            const b = panelData.parametros.mantenimientoBase;
            b['Aceite (KM)'] = safeNumber($("mantenimientoAceite").value);
            b['Bujía (KM)'] = safeNumber($("mantenimientoBujia").value);
            b['Llantas (KM)'] = safeNumber($("mantenimientoLlantas").value);
            saveData(); alert("Umbrales guardados.");
        };
        // Cargar umbrales actuales
        if($("mantenimientoAceite")) {
             $("mantenimientoAceite").value = panelData.parametros.mantenimientoBase['Aceite (KM)'];
             $("mantenimientoBujia").value = panelData.parametros.mantenimientoBase['Bujía (KM)'];
             $("mantenimientoLlantas").value = panelData.parametros.mantenimientoBase['Llantas (KM)'];
        }
    }
});
