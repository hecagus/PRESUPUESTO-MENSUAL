// app.js - VERSIÓN FINAL DEFINITIVA
// ---------------------------------------------------------------------

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
  cargasCombustible: [], // Array clave para el control de KM y Costo
  parametros: {
    deudaTotal: 0,
    gastoFijo: 0, 
    ultimoKMfinal: null, // EL KM sagrado: Fin de hoy = Inicio de mañana
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

// ---------- UTILIDADES ----------

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
  // 1. Asegurar arrays
  ['ingresos', 'gastos', 'deudas', 'movimientos', 'turnos', 'cargasCombustible'].forEach(k => {
    if (!Array.isArray(panelData[k])) panelData[k] = [];
  });

  if (!isObject(panelData.parametros)) {
    panelData.parametros = JSON.parse(JSON.stringify(DEFAULT_PANEL_DATA.parametros));
  }
  
  if (!panelData.parametros.mantenimientoBase) {
    panelData.parametros.mantenimientoBase = DEFAULT_PANEL_DATA.parametros.mantenimientoBase;
  }

  // 2. Autocorrección de Gastos (Excluyendo 'gasolina' que tiene su propio módulo)
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
  
  // Sincronizar Movimientos
  const movsGastos = panelData.gastos.map(g => ({
      ...g, tipo: 'Gasto', fecha: g.fecha || g.fechaISO || new Date().toISOString()
  }));
  const movsIngresos = panelData.ingresos.map(i => ({
      ...i, tipo: 'Ingreso', fecha: i.fecha || i.fechaISO || new Date().toISOString(), monto: safeNumber(i.monto || i.cantidad)
  }));
  
  panelData.movimientos = [...movsGastos, ...movsIngresos].sort((a,b) => new Date(b.fecha) - new Date(a.fecha));

  // 3. Saneamiento
  ['deudaTotal', 'gastoFijo', 'costoPorKm'].forEach(k => {
    panelData.parametros[k] = safeNumber(panelData.parametros[k]);
  });

  // Recalcular métricas de combustible (siempre frescas)
  calcularMetricasCombustible(false); 

  saveData();
}

function cargarPanelData() {
  const data = localStorage.getItem(STORAGE_KEY);
  if (data) {
    try {
      const loaded = JSON.parse(data);
      if (isObject(loaded)) panelData = { ...panelData, ...loaded };
    } catch (e) {
      console.error("Error cargando datos:", e);
      const backup = localStorage.getItem(BACKUP_KEY);
      if (backup) { try { panelData = { ...panelData, ...JSON.parse(backup) }; } catch (ex) {} }
    }
  }
  validarYArreglarDatos();
}

function saveData() {
  try {
    const json = JSON.stringify(panelData);
    localStorage.setItem(STORAGE_KEY, json);
    localStorage.setItem(BACKUP_KEY, json);
  } catch (e) { console.error("Error guardando:", e); }
}

function exportarJson() {
    try {
        const json = JSON.stringify(panelData, null, 2);
        navigator.clipboard.writeText(json).then(() => alert("✅ Datos copiados.")).catch(() => alert("⚠️ Copia manual necesaria."));
    } catch(e) { alert("Error al exportar."); }
}

function importarJson() {
    const input = $("importJson");
    if (!input) return;
    const jsonText = input.value.trim();
    if (!jsonText) return alert("⚠️ El campo está vacío.");

    if (!confirm("⚠️ Se borrarán los datos actuales. ¿Continuar?")) return;

    try {
        const datosNuevos = JSON.parse(jsonText);
        if (!datosNuevos || typeof datosNuevos !== 'object') throw new Error("JSON inválido.");
        panelData = { ...JSON.parse(JSON.stringify(DEFAULT_PANEL_DATA)), ...datosNuevos };
        validarYArreglarDatos();
        saveData();
        alert("✅ Datos restaurados.");
        window.location.reload();
    } catch (e) { alert("❌ Error: " + e.message); }
}
// app.js (Parte 3/5: Cálculos Centrales)

function calcularMetricasCombustible(updateUI = true) {
    const cargas = panelData.cargasCombustible.slice().sort((a, b) => a.kmCarga - b.kmCarga);
    const displayCosto = $("costoPorKmDisplay");
    const displayProyeccion = $("proyeccionRepostaje");
    
    // Necesitamos al menos 2 cargas para medir distancia y consumo entre ellas
    if (cargas.length < 2) {
        if (displayProyeccion) displayProyeccion.textContent = "Necesitas 2 cargas para calcular métricas.";
        return;
    }

    let kmRecorridosTotal = 0;
    let costoTotal = 0;
    const ultimasCargas = cargas.slice(-3); // Promedio móvil de últimas 3
    
    for (let i = 1; i < ultimasCargas.length; i++) {
        const cargaActual = ultimasCargas[i];
        const cargaAnterior = ultimasCargas[i - 1];
        const kmDist = cargaActual.kmCarga - cargaAnterior.kmCarga;
        
        if (kmDist > 0) {
            kmRecorridosTotal += kmDist;
            costoTotal += cargaAnterior.monto; // Costo de lo que se consumió para recorrer esa distancia
        }
    }
    
    let costoPorKm = kmRecorridosTotal > 0 ? (costoTotal / kmRecorridosTotal) : 0;
    panelData.parametros.costoPorKm = costoPorKm;

    // Proyección
    let mensajeProyeccion = "Sin información.";
    const ultimoKmCarga = ultimasCargas[ultimasCargas.length - 1].kmCarga;
    const ultimoKmRegistrado = safeNumber(panelData.parametros.ultimoKMfinal);
    const kmAcumulados = ultimoKmRegistrado - ultimoKmCarga;
    
    // Estimación (Tanque 400km aprox - Ajustable)
    const AUTONOMIA = 400; 
    const KM_RESTANTES = AUTONOMIA - kmAcumulados;
    
    if (KM_RESTANTES <= 50) {
        const costoLitro = ultimasCargas[ultimasCargas.length - 1].monto / ultimasCargas[ultimasCargas.length - 1].litros;
        const estimado = costoLitro * 6; // ~6 litros emergencia
        mensajeProyeccion = `🚨 ¡Cargar ya! Prepara unos $${fmtMoney(estimado)}.`;
    } else if (KM_RESTANTES <= 150) {
        mensajeProyeccion = `⚠️ Revisar tanque. Faltan ${KM_RESTANTES.toFixed(0)} km.`;
    } else {
        mensajeProyeccion = `Tanque OK. Restan ~${KM_RESTANTES.toFixed(0)} km.`;
    }

    if (updateUI) {
        if (displayCosto) displayCosto.textContent = `$${fmtMoney(costoPorKm)}`;
        if (displayProyeccion) displayProyeccion.textContent = mensajeProyeccion;
    }
    saveData();
}

function calcularMetricas() {
  const turnos = panelData.turnos;
  
  // Ingresos
  const ingresosReales = panelData.ingresos.filter(i => !(i.descripcion || "").toLowerCase().includes("ganancia turno"));
  const totalIngresosExtras = ingresosReales.reduce((s, x) => s + safeNumber(x.monto), 0);
  const totalGananciaTurnos = turnos.reduce((s, x) => s + safeNumber(x.gananciaBruta || x.ganancia), 0);
  const totalGananciaBruta = totalGananciaTurnos + totalIngresosExtras;
  
  // Gastos
  const gastosOperativosTurnos = turnos.reduce((s, x) => {
      const bruta = safeNumber(x.gananciaBruta || x.ganancia);
      const neta = safeNumber(x.gananciaNeta);
      return (neta === 0 && bruta > 0) ? s : s + (bruta - neta);
  }, 0);

  const gastosManualesTrabajo = panelData.gastos.filter(g => g.esTrabajo).reduce((s, x) => s + safeNumber(x.monto), 0);
  const totalGastosTrabajo = gastosOperativosTurnos + gastosManualesTrabajo;

  // Promedios
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
// app.js (Parte 4/5: Renderizado UI y Gestión de Turno)

function renderIndex() {
  const m = calcularMetricas();
  calcularMetricasCombustible(true); 
  const setTxt = (id, val) => { const el = $(id); if(el) el.textContent = val; };
  
  setTxt("resHoras", `${(m.totalHoras / m.diasTrabajados).toFixed(1)}h (Prom)`);
  setTxt("resGananciaBruta", `$${fmtMoney(m.gananciaBrutaProm)}`);
  setTxt("resGastosTrabajo", `$${fmtMoney(m.gastoTrabajoProm)}`);
  setTxt("resGananciaNeta", `$${fmtMoney(m.netoDiarioProm)}`);
  setTxt("resKmRecorridos", `${(m.totalKm / m.diasTrabajados).toFixed(0)} km (Prom)`);
  setTxt("proyDeuda", `$${fmtMoney(m.deudaPendiente)}`);
  setTxt("proyGastoFijoDiario", `$${fmtMoney(m.cuotaDiariaDeuda)}`);
  setTxt("proyNetaPromedio", `$${fmtMoney(m.netoDiarioProm)}`);
  setTxt("proyDias", m.diasLibre === "N/A" ? "¡Déficit!" : `${m.diasLibre} días`);
  setTxt("proyKmTotal", safeNumber(m.totalKm).toFixed(0) + " KM");

  renderCharts();
  renderAlertas();
  renderTablaTurnos();
}

function renderCharts() {
  if (typeof Chart === 'undefined') return;
  const ctx1 = $("graficaGanancias");
  const ctx2 = $("graficaKm");
  if (!ctx1 || !ctx2) return;
  
  const data = panelData.turnos.slice().sort((a,b) => new Date(a.fechaFin) - new Date(b.fechaFin)).slice(-14);
  const labels = data.map(t => new Date(t.fechaFin).toLocaleDateString(undefined, {day:'2-digit', month:'2-digit'}));
  
  if (gananciasChart) gananciasChart.destroy();
  gananciasChart = new Chart(ctx1, {
      type: 'line',
      data: { labels, datasets: [{ label: 'Neta ($)', data: data.map(t => t.gananciaNeta), borderColor: '#2563eb', fill: true, backgroundColor: 'rgba(37,99,235,0.1)' }] }
  });

  if (kmChart) kmChart.destroy();
  kmChart = new Chart(ctx2, {
      type: 'bar',
      data: { labels, datasets: [{ label: 'KM', data: data.map(t => t.kmRecorridos), backgroundColor: '#16a34a' }] }
  });
}

function renderAlertas() {
  const alertas = [];
  const kmActual = safeNumber(panelData.parametros.ultimoKMfinal);
  const base = panelData.parametros.mantenimientoBase;
  
  if (kmActual > 0) {
    for (const [key, val] of Object.entries(base)) {
        const intv = safeNumber(val);
        const mod = kmActual % intv;
        const faltante = intv - mod;
        if (faltante <= (intv * 0.1) || faltante < 150) alertas.push(`⚠️ ${key}: Mantenimiento en ${faltante.toFixed(0)} km.`);
    }
  }
  const ul = $("listaAlertas");
  if (ul) { ul.innerHTML = ""; alertas.forEach(a => ul.innerHTML += `<li>${a}</li>`); $("cardAlertas").classList.toggle('hidden', alertas.length === 0); }
}

function renderTablaTurnos() {
    const tbody = $("tablaTurnos");
    if (!tbody) return;
    tbody.innerHTML = "";
    panelData.turnos.slice().sort((a,b) => new Date(b.fechaFin) - new Date(a.fechaFin)).slice(0, 5).forEach(t => {
        tbody.innerHTML += `<tr><td>${formatearFecha(new Date(t.fechaFin))}</td><td>${t.horas.toFixed(1)}h</td><td>${t.kmRecorridos}km</td><td>$${fmtMoney(t.gananciaNeta)}</td></tr>`;
    });
}

function actualizarUIturno() {
  const btnIni = $("btnIniciarTurno");
  if (!btnIni) return;

  // Actualizar métricas
  calcularMetricasCombustible(true);

  if (turnoActivo) {
    $("turnoTexto").innerHTML = `🟢 En curso (Inicio: ${new Date(safeNumber(turnoInicio)).toLocaleTimeString()})`;
    btnIni.style.display = 'none';
    $("btnFinalizarTurno").style.display = 'block';
    
    // Mostramos solo la Ganancia Bruta para finalizar
    $("labelGananciaBruta").style.display = 'block';
    $("gananciaBruta").style.display = 'block';
    
  } else {
    $("turnoTexto").innerHTML = `🔴 Sin turno activo`;
    btnIni.style.display = 'block';
    $("btnFinalizarTurno").style.display = 'none';
    
    // Ocultar inputs al estar inactivo
    $("labelGananciaBruta").style.display = 'none';
    $("gananciaBruta").style.display = 'none';
  }
}

function iniciarTurno() {
  const kmInicial = safeNumber(panelData.parametros.ultimoKMfinal);
  if (kmInicial <= 0) return alert("⚠️ Debes registrar tu Kilometraje Actual en 'Control de Combustible' antes de iniciar el primer turno.");

  turnoInicio = Date.now().toString();
  turnoActivo = { kmInicial, timestamp: turnoInicio };
  localStorage.setItem("turnoActivo", JSON.stringify(turnoActivo));
  localStorage.setItem("turnoInicio", turnoInicio);
  actualizarUIturno();
  alert(`Turno iniciado. KM Base: ${kmInicial}`);
}

function finalizarTurno() {
  // Pedir KM Final por Prompt para asegurar la cadena, aunque no esté en la UI
  const kmFinalStr = prompt(`Ingresa el KM Final del turno (Debe ser mayor a ${turnoActivo.kmInicial}):`);
  const kmFinal = safeNumber(kmFinalStr);
  const gananciaBruta = safeNumber($("gananciaBruta").value);

  if (kmFinal <= turnoActivo.kmInicial) return alert("❌ KM Final inválido.");
  if (gananciaBruta <= 0) return alert("❌ Ingresa ganancia válida.");

  const horas = (Date.now() - safeNumber(turnoActivo.timestamp)) / 36e5;
  const kmRec = kmFinal - turnoActivo.kmInicial;
  const costoEst = kmRec * safeNumber(panelData.parametros.costoPorKm);
  const neta = gananciaBruta - costoEst;

  panelData.turnos.push({
    id: Date.now(), fechaInicio: new Date(safeNumber(turnoActivo.timestamp)).toISOString(),
    fechaFin: new Date().toISOString(), horas, kmInicial: turnoActivo.kmInicial, kmFinal, kmRecorridos: kmRec,
    gananciaBruta, gananciaNeta: neta
  });

  // ACTUALIZACIÓN CRÍTICA: El fin de hoy es el inicio de mañana
  if (kmFinal > safeNumber(panelData.parametros.ultimoKMfinal)) {
      panelData.parametros.ultimoKMfinal = kmFinal;
  }
  
  localStorage.removeItem("turnoActivo"); localStorage.removeItem("turnoInicio"); turnoActivo = false;
  saveData(); actualizarUIturno(); $("gananciaBruta").value = "";
  alert(`Turno finalizado. Ganancia Neta Est.: $${fmtMoney(neta)}`);
}

function registrarCargaCombustible() {
    const kmCarga = safeNumber($("kmCarga").value);
    const litros = safeNumber($("litrosCarga").value);
    const monto = safeNumber($("costoCarga").value);
    const desc = $("descCarga").value.trim() || "Carga";
    const ultimoKm = safeNumber(panelData.parametros.ultimoKMfinal);

    if (kmCarga <= ultimoKm && ultimoKm > 0) return alert(`El KM (${kmCarga}) debe ser mayor al último registrado (${ultimoKm}).`);
    if (monto <= 0 || litros <= 0) return alert("Faltan datos.");

    const carga = { id: Date.now(), fecha: new Date().toISOString(), kmCarga, litros, monto, descripcion: desc };
    panelData.cargasCombustible.push(carga);
    
    // También es un gasto
    const gasto = { id: Date.now(), tipo: 'Gasto', descripcion: `Gasolina: ${desc} (${litros}L)`, monto, fecha: carga.fecha, esTrabajo: true };
    panelData.gastos.push(gasto); panelData.movimientos.push(gasto);

    // Actualizamos la fuente de verdad del KM
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

function setupDeudaListeners() {
  const btnSig = $("btnSiguienteDeuda");
  if (btnSig) btnSig.onclick = () => {
      const monto = safeNumber($("deudaMontoTotal").value);
      const desc = $("deudaDescripcion").value.trim();
      if (monto <= 0 || !desc) return alert("Datos incompletos.");
      panelData.deudas.push({ id: Date.now(), descripcion: desc, montoOriginal: monto, saldo: monto, estado: 'Pendiente' });
      panelData.parametros.deudaTotal = monto;
      updateDeudaWizardUI();
      $("deudaMontoTotal").value = ""; $("deudaDescripcion").value = "";
  };

  const btnFin = $("btnFinalizarDeuda");
  if (btnFin) btnFin.onclick = () => {
      const abono = safeNumber($("gastoFijoDiario").value);
      if (abono <= 0) return alert("Ingresa monto.");
      panelData.parametros.gastoFijo = abono;
      saveData(); renderDeudas(); calcularMetricas();
      alert("Meta diaria guardada.");
  };

  const btnAbono = $("btnRegistrarAbono");
  if (btnAbono) btnAbono.onclick = () => {
      const id = parseInt($("abonoSeleccionar").value);
      const monto = safeNumber($("abonoMonto").value);
      const deuda = panelData.deudas.find(d => d.id === id);
      if (!deuda || monto > deuda.saldo || monto <= 0) return alert("Abono inválido.");
      
      panelData.movimientos.push({ id: Date.now(), tipo: 'Gasto', descripcion: `Abono: ${deuda.descripcion}`, monto, fecha: new Date().toISOString(), esTrabajo: false });
      deuda.saldo -= monto;
      if (deuda.saldo <= 0.01) { deuda.saldo = 0; deuda.estado = 'Pagada'; alert("¡Pagada!"); }
      panelData.parametros.deudaTotal = panelData.deudas.reduce((s,d)=>s+d.saldo,0);
      saveData(); renderDeudas(); $("abonoMonto").value = "";
  };
  
  const btnVolver = $("btnVolverDeuda");
  if (btnVolver) btnVolver.onclick = () => { $('wizardStep1').style.display = 'block'; $('wizardStep2').style.display = 'none'; };
}

function updateDeudaWizardUI() {
    const s1 = $('wizardStep1'), s2 = $('wizardStep2');
    if (!s1 || !s2) return;
    const active = panelData.deudas.length > 0 || panelData.parametros.gastoFijo > 0;
    s1.style.display = active ? 'none' : 'block';
    s2.style.display = active ? 'block' : 'none';
}

function renderDeudas() {
  const l = $("listaDeudas"), s = $("abonoSeleccionar");
  if (!l || !s) return;
  l.innerHTML = ""; s.innerHTML = "<option value=''>-- Seleccionar --</option>";
  panelData.deudas.forEach(d => {
      l.innerHTML += `<li><span>${d.descripcion}</span> <strong>$${fmtMoney(d.saldo)}</strong></li>`;
      if (d.saldo > 0) s.innerHTML += `<option value="${d.id}">${d.descripcion}</option>`;
  });
}

document.addEventListener("DOMContentLoaded", () => {
  cargarPanelData();
  const page = document.body.getAttribute('data-page');

  if (page === 'admin') {
    actualizarUIturno(); renderDeudas(); updateDeudaWizardUI(); setupDeudaListeners();
    if($("btnIniciarTurno")) $("btnIniciarTurno").onclick = iniciarTurno;
    if($("btnFinalizarTurno")) $("btnFinalizarTurno").onclick = finalizarTurno;
    if($("btnRegistrarIngreso")) $("btnRegistrarIngreso").onclick = () => registrarMovimiento('Ingreso', 'ingresoDescripcion', 'ingresoCantidad', true);
    if($("btnRegistrarGasto")) $("btnRegistrarGasto").onclick = () => registrarMovimiento('Gasto', 'gastoDescripcion', 'gastoCantidad', $("gastoTipo").value === 'trabajo');
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
  } else if (page === 'index') { renderIndex(); }
  else if (page === 'historial') { renderHistorial(); }
});
