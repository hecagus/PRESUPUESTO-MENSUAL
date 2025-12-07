// app.js (Parte 1/5: Constantes y Estructura)
// VERSIÓN SINCRONIZADA: Formularios directos para Gasolina y Gastos

const STORAGE_KEY = "panelData";
const BACKUP_KEY = "panelData_backup_v1";
const $ = id => document.getElementById(id);

let gananciasChart = null;
let kmChart = null;

// Estructura base
const DEFAULT_PANEL_DATA = {
  ingresos: [],
  gastos: [],
  kmDiarios: [],
  deudas: [],
  movimientos: [],
  turnos: [],
  cargasCombustible: [],
  parametros: {
    deudaTotal: 0,
    gastoFijo: 0, 
    ultimoKMfinal: null, // EL KM sagrado
    costoPorKm: 0,
    mantenimientoBase: {
      'Aceite (KM)': 3000,
      'Bujía (KM)': 8000,
      'Llantas (KM)': 15000
    }
  }
};

// Inicializar estado
let panelData = JSON.parse(JSON.stringify(DEFAULT_PANEL_DATA));
let turnoActivo = JSON.parse(localStorage.getItem("turnoActivo")) || false;
let turnoInicio = localStorage.getItem("turnoInicio") || null;

// Utilidades
function safeNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function isObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function fmtMoney(num) {
  return safeNumber(num).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function formatearFecha(date) {
  if (!(date instanceof Date) || isNaN(date.getTime())) return "Fecha Inválida";
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}
// app.js (Parte 2/5: Gestión de Datos)

function validarYArreglarDatos() {
  ['ingresos', 'gastos', 'deudas', 'movimientos', 'turnos', 'cargasCombustible'].forEach(k => {
    if (!Array.isArray(panelData[k])) panelData[k] = [];
  });

  if (!isObject(panelData.parametros)) {
    panelData.parametros = JSON.parse(JSON.stringify(DEFAULT_PANEL_DATA.parametros));
  }
  if (!panelData.parametros.mantenimientoBase) {
    panelData.parametros.mantenimientoBase = DEFAULT_PANEL_DATA.parametros.mantenimientoBase;
  }

  // Autocorrección de Gastos (Excluyendo 'gasolina')
  const palabrasTrabajo = ['uber', 'mottu', 'moto', 'mantenimiento', 'aceite', 'llanta', 'refaccion', 'taller', 'reparacion', 'servicio'];
  panelData.gastos = panelData.gastos.map(g => {
    const desc = (g.descripcion || "").toLowerCase();
    const cat = (g.categoria || "").toLowerCase();
    let esTrabajo = g.esTrabajo === true; 
    
    if (!esTrabajo) {
        const match = palabrasTrabajo.some(p => desc.includes(p) || cat.includes(p));
        if (match) esTrabajo = true;
    }
    return { ...g, esTrabajo, monto: safeNumber(g.monto || g.cantidad) };
  });
  
  // Reconstrucción de Movimientos
  const movsGastos = panelData.gastos.map(g => ({
      ...g, tipo: 'Gasto', fecha: g.fecha || g.fechaISO || new Date().toISOString()
  }));
  const movsIngresos = panelData.ingresos.map(i => ({
      ...i, tipo: 'Ingreso', fecha: i.fecha || i.fechaISO || new Date().toISOString(), monto: safeNumber(i.monto || i.cantidad)
  }));
  panelData.movimientos = [...movsGastos, ...movsIngresos].sort((a,b) => new Date(b.fecha) - new Date(a.fecha));

  ['deudaTotal', 'gastoFijo', 'costoPorKm'].forEach(k => {
    panelData.parametros[k] = safeNumber(panelData.parametros[k]);
  });

  calcularMetricasCombustible(false); 
  saveData();
}

function cargarPanelData() {
  const data = localStorage.getItem(STORAGE_KEY);
  if (data) {
    try {
      const loaded = JSON.parse(data);
      if (isObject(loaded)) panelData = { ...panelData, ...loaded };
    } catch (e) { console.error(e); }
  }
  validarYArreglarDatos();
}

function saveData() {
  try {
    const json = JSON.stringify(panelData);
    localStorage.setItem(STORAGE_KEY, json);
    localStorage.setItem(BACKUP_KEY, json);
  } catch (e) { console.error(e); }
}

function exportarJson() {
    try {
        const json = JSON.stringify(panelData, null, 2);
        navigator.clipboard.writeText(json).then(() => alert("Datos copiados.")).catch(() => alert("Copia manual requerida."));
    } catch(e) { alert("Error al exportar."); }
}

function importarJson() {
    const input = $("importJson");
    if (!input) return;
    const jsonText = input.value.trim();
    if (!jsonText) return alert("Pega el JSON primero.");
    if (!confirm("Se reemplazarán los datos actuales. ¿Seguro?")) return;

    try {
        const datosNuevos = JSON.parse(jsonText);
        panelData = { ...JSON.parse(JSON.stringify(DEFAULT_PANEL_DATA)), ...datosNuevos };
        validarYArreglarDatos();
        saveData();
        alert("Restauración completa.");
        window.location.reload();
    } catch (e) { alert("Error JSON: " + e.message); }
}
// app.js (Parte 3/5: Cálculos de Combustible y Métricas)

function calcularMetricasCombustible(updateUI = true) {
    const cargas = panelData.cargasCombustible.slice().sort((a, b) => a.kmCarga - b.kmCarga);
    const displayCosto = $("costoPorKmDisplay");
    const displayProyeccion = $("proyeccionRepostaje");
    
    if (cargas.length < 2) {
        panelData.parametros.costoPorKm = 0;
        if (displayCosto) displayCosto.textContent = "$0.00";
        if (displayProyeccion) displayProyeccion.textContent = "Registra 2 cargas.";
        return;
    }

    let kmRecorridosTotal = 0;
    let costoTotal = 0;
    // Usar últimas 3 cargas para promedio
    const ultimasCargas = cargas.slice(-3); 
    
    for (let i = 1; i < ultimasCargas.length; i++) {
        const cargaActual = ultimasCargas[i];
        const cargaAnterior = ultimasCargas[i - 1];
        const kmDist = cargaActual.kmCarga - cargaAnterior.kmCarga;
        if (kmDist > 0) {
            kmRecorridosTotal += kmDist;
            costoTotal += cargaAnterior.monto;
        }
    }
    
    let costoPorKm = kmRecorridosTotal > 0 ? (costoTotal / kmRecorridosTotal) : 0;
    panelData.parametros.costoPorKm = costoPorKm;

    // Proyección
    let mensajeProyeccion = "Calculando...";
    const ultimoKmCarga = ultimasCargas[ultimasCargas.length - 1].kmCarga;
    const ultimoKmRegistrado = safeNumber(panelData.parametros.ultimoKMfinal);
    const kmAcumulados = ultimoKmRegistrado - ultimoKmCarga;
    
    const AUTONOMIA = 400; 
    const KM_RESTANTES = AUTONOMIA - kmAcumulados;
    
    if (KM_RESTANTES <= 50) {
        mensajeProyeccion = `🚨 ¡Cargar ya! (~${KM_RESTANTES} km)`;
    } else if (KM_RESTANTES <= 150) {
        mensajeProyeccion = `⚠️ Tanque bajo (~${KM_RESTANTES} km)`;
    } else {
        mensajeProyeccion = `Tanque OK (~${KM_RESTANTES} km)`;
    }

    if (updateUI) {
        if (displayCosto) displayCosto.textContent = `$${fmtMoney(costoPorKm)}`;
        if (displayProyeccion) displayProyeccion.textContent = mensajeProyeccion;
    }
    saveData();
}

function calcularMetricas() {
  const turnos = panelData.turnos;
  const ingresosReales = panelData.ingresos.filter(i => !(i.descripcion || "").toLowerCase().includes("ganancia turno"));
  const totalIngresosExtras = ingresosReales.reduce((s, x) => s + safeNumber(x.monto), 0);
  const totalGananciaTurnos = turnos.reduce((s, x) => s + safeNumber(x.gananciaBruta || x.ganancia), 0);
  const totalGananciaBruta = totalGananciaTurnos + totalIngresosExtras;
  
  const gastosOperativosTurnos = turnos.reduce((s, x) => {
      const bruta = safeNumber(x.gananciaBruta || x.ganancia);
      const neta = safeNumber(x.gananciaNeta);
      return (neta === 0 && bruta > 0) ? s : s + (bruta - neta);
  }, 0);

  const gastosManualesTrabajo = panelData.gastos.filter(g => g.esTrabajo).reduce((s, x) => s + safeNumber(x.monto), 0);
  const totalGastosTrabajo = gastosOperativosTurnos + gastosManualesTrabajo;

  const diasTrabajados = new Set(turnos.map(t => (t.fechaFin || t.fin || "").split('T')[0]).filter(Boolean)).size || 1;
  const netoDiarioProm = diasTrabajados > 0 ? ((totalGananciaBruta - totalGastosTrabajo) / diasTrabajados) : 0;
  
  const m = {
    netoDiarioProm,
    deudaPendiente: safeNumber(panelData.parametros.deudaTotal),
    cuotaDiariaDeuda: safeNumber(panelData.parametros.gastoFijo),
    totalKm: turnos.reduce((sum, t) => sum + safeNumber(t.kmRecorridos || t.kmRecorrido), 0),
    totalHoras: turnos.reduce((sum, t) => sum + safeNumber(t.horas), 0),
    gananciaBrutaProm: totalGananciaBruta / diasTrabajados,
    gastoTrabajoProm: totalGastosTrabajo / diasTrabajados,
    diasTrabajados
  };

  const superavit = m.netoDiarioProm - m.cuotaDiariaDeuda;
  m.diasLibre = (m.deudaPendiente > 0 && superavit > 0) ? Math.ceil(m.deudaPendiente / m.netoDiarioProm) : "N/A";
  panelData.metricas = m;
  saveData();
  return m;
}
// app.js (Parte 4/5: Interfaz y Turnos)

function actualizarUIturno() {
  const btnIni = $("btnIniciarTurno");
  if (!btnIni) return;

  calcularMetricasCombustible(true); 

  if (turnoActivo) {
    $("turnoTexto").innerHTML = `🟢 En curso (Inicio: ${new Date(safeNumber(turnoInicio)).toLocaleTimeString()})`;
    btnIni.style.display = 'none';
    $("btnFinalizarTurno").style.display = 'block';
    
    // Mostrar campo de ganancia solo al finalizar
    const divGan = $("divGananciaTurno");
    if(divGan) divGan.style.display = 'block';
    
  } else {
    $("turnoTexto").innerHTML = `🔴 Sin turno activo`;
    btnIni.style.display = 'block';
    $("btnFinalizarTurno").style.display = 'none';
    
    const divGan = $("divGananciaTurno");
    if(divGan) divGan.style.display = 'none';
  }
}

function iniciarTurno() {
  const kmInicial = safeNumber(panelData.parametros.ultimoKMfinal);
  if (kmInicial <= 0) return alert("⚠️ Registra tu KM Actual en 'Control de Combustible' antes de empezar.");

  turnoInicio = Date.now().toString();
  turnoActivo = { kmInicial, timestamp: turnoInicio };
  localStorage.setItem("turnoActivo", JSON.stringify(turnoActivo));
  localStorage.setItem("turnoInicio", turnoInicio);
  actualizarUIturno();
  alert(`Turno iniciado. KM Base: ${kmInicial}`);
}

function finalizarTurno() {
  // Pedimos KM Final por prompt para no tener inputs estorbando en la UI
  const kmFinalStr = prompt(`Ingresa KM Final (Mayor a ${turnoActivo.kmInicial}):`);
  if (!kmFinalStr) return;
  
  const kmFinal = safeNumber(kmFinalStr);
  const gananciaBruta = safeNumber($("gananciaBruta").value);

  if (kmFinal <= turnoActivo.kmInicial) return alert("KM Final inválido.");
  if (gananciaBruta <= 0) return alert("Ingresa ganancia válida.");

  const horas = (Date.now() - safeNumber(turnoActivo.timestamp)) / 36e5;
  const kmRec = kmFinal - turnoActivo.kmInicial;
  const costoEst = kmRec * safeNumber(panelData.parametros.costoPorKm);
  const neta = gananciaBruta - costoEst;

  panelData.turnos.push({
    id: Date.now(), fechaInicio: new Date(safeNumber(turnoActivo.timestamp)).toISOString(),
    fechaFin: new Date().toISOString(), horas, kmInicial: turnoActivo.kmInicial, kmFinal, kmRecorridos: kmRec,
    gananciaBruta, gananciaNeta: neta
  });

  if (kmFinal > safeNumber(panelData.parametros.ultimoKMfinal)) {
      panelData.parametros.ultimoKMfinal = kmFinal;
  }
  
  localStorage.removeItem("turnoActivo"); localStorage.removeItem("turnoInicio"); turnoActivo = false;
  saveData(); actualizarUIturno(); $("gananciaBruta").value = "";
  alert(`Finalizado. Neta Est.: $${fmtMoney(neta)}`);
}

function registrarCargaCombustible() {
    const kmCarga = safeNumber($("kmCarga").value);
    const litros = safeNumber($("litrosCarga").value);
    const monto = safeNumber($("costoCarga").value);
    const desc = $("descCarga").value.trim() || "Carga";
    const ultimoKm = safeNumber(panelData.parametros.ultimoKMfinal);

    if (kmCarga <= ultimoKm && ultimoKm > 0) return alert(`El KM (${kmCarga}) debe ser mayor al último (${ultimoKm}).`);
    if (monto <= 0 || litros <= 0) return alert("Faltan datos.");

    const carga = { id: Date.now(), fecha: new Date().toISOString(), kmCarga, litros, monto, descripcion: desc };
    panelData.cargasCombustible.push(carga);
    
    // Registrar también como gasto
    const gasto = { id: Date.now(), tipo: 'Gasto', descripcion: `Gasolina: ${desc}`, monto, fecha: carga.fecha, esTrabajo: true };
    panelData.gastos.push(gasto); panelData.movimientos.push(gasto);

    panelData.parametros.ultimoKMfinal = kmCarga;
    
    $("kmCarga").value = ""; $("litrosCarga").value = ""; $("costoCarga").value = ""; $("descCarga").value = "";
    saveData(); actualizarUIturno();
    alert("⛽ Carga registrada y KM actualizado.");
}
// app.js (Parte 5/5: Listeners e Init)

function registrarMovimiento(tipo, descId, montoId, esTrabajo) {
  const descInput = $(descId);
  const montoInput = $(montoId);
  const desc = descInput.value.trim();
  const monto = safeNumber(montoInput.value);

  if (!desc || monto <= 0) return alert("Datos incompletos.");
  
  const mov = { id: Date.now(), tipo, descripcion: desc, monto, fecha: new Date().toISOString(), esTrabajo };
  if (tipo === 'Ingreso') panelData.ingresos.push(mov);
  else panelData.gastos.push(mov);
  panelData.movimientos.push(mov);
  
  descInput.value = ""; montoInput.value = "";
  saveData(); alert(`${tipo} registrado.`);
}

function setupDeudasYMetas() {
    const s1 = $('wizardStep1'), s2 = $('wizardStep2');
    
    // Botón para registrar deuda (Step 1)
    if($("btnSiguienteDeuda")) $("btnSiguienteDeuda").onclick = () => {
        const m = safeNumber($("deudaMontoTotal").value);
        const d = $("deudaDescripcion").value.trim();
        if(m <= 0 || !d) return alert("Datos incompletos.");
        
        panelData.deudas.push({ id: Date.now(), descripcion: d, montoOriginal: m, saldo: m, estado: 'Pendiente' });
        panelData.parametros.deudaTotal = m;
        
        $("deudaMontoTotal").value = ""; $("deudaDescripcion").value = "";
        
        // Cambiar a vista de Meta
        s1.style.display = 'none'; s2.style.display = 'block';
    };

    // Botón para guardar Meta (Step 2)
    if($("btnFinalizarDeuda")) $("btnFinalizarDeuda").onclick = () => {
        const abono = safeNumber($("gastoFijoDiario").value);
        if(abono <= 0) return alert("Ingresa monto.");
        panelData.parametros.gastoFijo = abono;
        saveData(); renderDeudas();
        alert("Meta guardada.");
    };

    if($("btnVolverDeuda")) $("btnVolverDeuda").onclick = () => { s1.style.display = 'block'; s2.style.display = 'none'; };
    
    // Toggle inicial
    if (panelData.deudas.length > 0 || panelData.parametros.gastoFijo > 0) {
         if(s1 && s2) { s1.style.display='none'; s2.style.display='block'; }
    }
}

function renderDeudas() {
  const l = $("listaDeudas"), s = $("abonoSeleccionar");
  if (!l || !s) return;
  l.innerHTML = ""; s.innerHTML = "<option value=''>-- Seleccionar --</option>";
  
  panelData.deudas.forEach(d => {
      l.innerHTML += `<li><span>${d.descripcion}</span> <strong>$${fmtMoney(d.saldo)}</strong></li>`;
      if (d.saldo > 0) s.innerHTML += `<option value="${d.id}">${d.descripcion}</option>`;
  });

  const btnAbono = $("btnRegistrarAbono");
  if(btnAbono) btnAbono.onclick = () => {
      const id = parseInt($("abonoSeleccionar").value);
      const m = safeNumber($("abonoMonto").value);
      const deuda = panelData.deudas.find(x => x.id === id);
      
      if (!deuda || m > deuda.saldo || m <= 0) return alert("Abono inválido.");
      
      deuda.saldo -= m;
      panelData.movimientos.push({ id: Date.now(), tipo: 'Gasto', descripcion: `Abono: ${deuda.descripcion}`, monto: m, fecha: new Date().toISOString(), esTrabajo: false });
      
      if(deuda.saldo <= 0.01) { deuda.saldo = 0; deuda.estado = 'Pagada'; alert("¡Pagada!"); }
      
      saveData(); renderDeudas(); $("abonoMonto").value = "";
      alert("Abono registrado.");
  };
}

// Inicialización
document.addEventListener("DOMContentLoaded", () => {
  cargarPanelData();
  const page = document.body.getAttribute('data-page');

  if (page === 'admin') {
    actualizarUIturno(); 
    setupDeudasYMetas();
    renderDeudas();

    if($("btnIniciarTurno")) $("btnIniciarTurno").onclick = iniciarTurno;
    if($("btnFinalizarTurno")) $("btnFinalizarTurno").onclick = finalizarTurno;
    if($("btnRegistrarIngreso")) $("btnRegistrarIngreso").onclick = () => registrarMovimiento('Ingreso', 'ingresoDescripcion', 'ingresoCantidad', true);
    
    // Listener DIRECTO para gastos (Sin wizards)
    if($("btnRegistrarGasto")) $("btnRegistrarGasto").onclick = () => {
        const tipo = $("gastoTipo").value;
        registrarMovimiento('Gasto', 'gastoDescripcion', 'gastoCantidad', tipo === 'trabajo');
    };

    // Listener DIRECTO para gasolina (Sin wizards)
    if($("btnRegistrarCarga")) $("btnRegistrarCarga").onclick = registrarCargaCombustible;
    
    if($("btnExportar")) $("btnExportar").onclick = exportarJson;
    if($("btnImportar")) $("btnImportar").onclick = importarJson;
    if($("btnGuardarMantenimiento")) $("btnGuardarMantenimiento").onclick = () => {
        const b = panelData.parametros.mantenimientoBase;
        b['Aceite (KM)'] = safeNumber($("mantenimientoAceite").value);
        b['Bujía (KM)'] = safeNumber($("mantenimientoBujia").value);
        b['Llantas (KM)'] = safeNumber($("mantenimientoLlantas").value);
        saveData(); alert("Guardado.");
    };
  } else if (page === 'index') {
      // Funciones de renderIndex... (omitidas por brevedad, usar las del código anterior si se requieren cambios, pero aquí nos enfocamos en Admin)
      // Para asegurar compatibilidad:
      if(typeof renderIndex === 'function') renderIndex();
  }
});
