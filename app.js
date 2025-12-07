// app.js - VERSIÓN FINAL DEFINITIVA (Unificado)
// ---------------------------------------------------------------------

const STORAGE_KEY = "panelData";
const BACKUP_KEY = "panelData_backup_v1";
const $ = id => document.getElementById(id);

let gananciasChart = null;
let kmChart = null;

// Estructura base de datos
const DEFAULT_PANEL_DATA = {
  ingresos: [],
  gastos: [],
  turnos: [],
  movimientos: [],
  cargasCombustible: [], // Array clave para el control de KM y Costo
  deudas: [],
  parametros: {
    deudaTotal: 0,
    gastoFijo: 0, 
    ultimoKMfinal: 0, // EL KM sagrado: Fin de hoy = Inicio de mañana
    costoPorKm: 0,
    mantenimientoBase: {
      'Aceite (KM)': 3000,
      'Bujía (KM)': 8000,
      'Llantas (KM)': 15000
    }
  }
};

// Inicializar estado en memoria
let panelData = JSON.parse(JSON.stringify(DEFAULT_PANEL_DATA));
let turnoActivo = JSON.parse(localStorage.getItem("turnoActivo")) || false;

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

// ---------- GESTIÓN DE DATOS (Persistencia y Validación) ----------

function validarYArreglarDatos() {
  // 1. Asegurar existencia de arrays
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
  
  // 3. Saneamiento numérico
  ['deudaTotal', 'gastoFijo', 'costoPorKm', 'ultimoKMfinal'].forEach(k => {
    panelData.parametros[k] = safeNumber(panelData.parametros[k]);
  });

  // Recalcular métricas de combustible siempre al cargar para mantener consistencia
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
      // Intento de backup si falla el principal
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
        navigator.clipboard.writeText(json).then(() => alert("✅ Datos copiados al portapapeles.")).catch(() => alert("⚠️ Copia manual necesaria."));
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

// ---------- CÁLCULOS CENTRALES (Métricas) ----------

function calcularMetricasCombustible(updateUI = true) {
    const cargas = panelData.cargasCombustible.slice().sort((a, b) => a.kmActual - b.kmActual);
    
    // Necesitamos al menos 2 cargas para medir distancia y consumo entre ellas
    if (cargas.length >= 2) {
        // Tomamos las últimas 3 para promedio reciente
        const ultimasCargas = cargas.slice(-3);
        let kmRecorridosTotal = 0;
        let costoTotal = 0;
        
        for (let i = 1; i < ultimasCargas.length; i++) {
            const cargaActual = ultimasCargas[i];
            const cargaAnterior = ultimasCargas[i - 1];
            const kmDist = cargaActual.kmActual - cargaAnterior.kmActual;
            
            if (kmDist > 0) {
                kmRecorridosTotal += kmDist;
                // Costo y litros consumidos para recorrer esa distancia (se asume que la carga actual llena el tanque)
                costoTotal += cargaActual.costo; 
            }
        }
        
        if (kmRecorridosTotal > 0) {
            panelData.parametros.costoPorKm = costoTotal / kmRecorridosTotal;
        }
    }

    // Proyección
    let mensajeProyeccion = "Necesitas más datos.";
    const ultimoKM = safeNumber(panelData.parametros.ultimoKMfinal);
    const ultimaCargaKM = cargas.length > 0 ? cargas[cargas.length - 1].kmActual : ultimoKM;
    const recorridoDesdeCarga = ultimoKM - ultimaCargaKM;
    
    // Estimación (Tanque promedio moto ~350-400km - Ajustable)
    const AUTONOMIA = 350; 
    const KM_RESTANTES = AUTONOMIA - recorridoDesdeCarga;
    
    if (cargas.length < 2) {
         mensajeProyeccion = "Registra 2 cargas para calcular.";
    } else if (KM_RESTANTES <= 50) {
        mensajeProyeccion = `🚨 ¡URGENTE CARGAR! Restan ~${KM_RESTANTES.toFixed(0)} km.`;
    } else if (KM_RESTANTES <= 150) {
        mensajeProyeccion = `⚠️ Planifica carga. Restan ~${KM_RESTANTES.toFixed(0)} km.`;
    } else {
        mensajeProyeccion = `Tanque OK. Restan ~${KM_RESTANTES.toFixed(0)} km.`;
    }

    if (updateUI) {
        const displayCosto = $("costoPorKmDisplay");
        const displayProyeccion = $("proyeccionRepostaje");
        if (displayCosto) displayCosto.textContent = `$${fmtMoney(panelData.parametros.costoPorKm)}`;
        if (displayProyeccion) displayProyeccion.textContent = mensajeProyeccion;
    }
    saveData();
}

function calcularMetricasGenerales() {
  const turnos = panelData.turnos;
  const diasTrabajados = new Set(turnos.map(t => (t.fechaInicio || "").split('T')[0]).filter(Boolean)).size || 1;
  
  // Ingresos
  const ingresosExt = panelData.ingresos.reduce((s, x) => s + safeNumber(x.monto), 0);
  const gananciaTurnos = turnos.reduce((s, x) => s + safeNumber(x.gananciaBruta), 0);
  const totalIngresos = ingresosExt + gananciaTurnos;
  
  // Gastos
  const gastosOperativos = panelData.gastos.filter(g => g.esTrabajo).reduce((s, x) => s + safeNumber(x.monto), 0);
  
  const neta = totalIngresos - gastosOperativos;
  
  const m = {
    netoDiarioProm: diasTrabajados > 0 ? (neta / diasTrabajados) : 0,
    deudaPendiente: safeNumber(panelData.parametros.deudaTotal),
    cuotaDiariaDeuda: safeNumber(panelData.parametros.gastoFijo),
    totalKm: turnos.reduce((sum, t) => sum + safeNumber(t.kmRecorrido), 0),
    totalHoras: turnos.reduce((sum, t) => sum + safeNumber(t.horas), 0),
    gananciaBrutaProm: diasTrabajados > 0 ? (totalIngresos / diasTrabajados) : 0,
    gastoTrabajoProm: diasTrabajados > 0 ? (gastosOperativos / diasTrabajados) : 0,
    diasTrabajados
  };

  const superavit = m.netoDiarioProm - m.cuotaDiariaDeuda;
  m.diasLibre = (m.deudaPendiente > 0 && superavit > 0) ? Math.ceil(m.deudaPendiente / m.netoDiarioProm) : "N/A";
  
  return m;
}

// ---------- GESTIÓN DE TURNO ----------

function actualizarUITurno() {
  const btnIni = $("btnIniciarTurno");
  const containerCierre = $("cierreTurnoContainer");
  const txtEstado = $("turnoTexto");
  
  if (!btnIni) return;

  // Actualizar métricas de combustible al renderizar turno
  calcularMetricasCombustible(true); 

  if (turnoActivo) {
    txtEstado.innerHTML = `🟢 En curso (Inicio: ${new Date(turnoActivo.inicio).toLocaleTimeString()})`;
    btnIni.style.display = 'none';
    $("btnFinalizarTurno").style.display = 'block';
    if(containerCierre) containerCierre.style.display = 'block'; // Mostrar inputs de cierre
  } else {
    txtEstado.innerHTML = `🔴 Sin turno activo`;
    btnIni.style.display = 'block';
    $("btnFinalizarTurno").style.display = 'none';
    if(containerCierre) containerCierre.style.display = 'none'; // Ocultar inputs
  }
}

function iniciarTurno() {
  // KM Inicial es automático del sistema (Último KM registrado). No se pide al usuario.
  const kmInicial = safeNumber(panelData.parametros.ultimoKMfinal);
  
  // Validación de seguridad inicial
  if (kmInicial <= 0) {
      // Si es la primera vez que se usa la app, podría ser 0.
      if (!confirm("El KM Inicial es 0. ¿Es tu primer uso? Si no, registra una carga de combustible primero para calibrar el odómetro.")) {
          return;
      }
  }

  const inicio = Date.now();
  turnoActivo = { inicio, kmInicial };
  
  localStorage.setItem("turnoActivo", JSON.stringify(turnoActivo));
  actualizarUITurno();
}

function finalizarTurno() {
  const kmFinalInput = $("kmFinalTurno");
  const gananciaInput = $("gananciaBruta");
  
  const kmFinal = safeNumber(kmFinalInput.value);
  const ganancia = safeNumber(gananciaInput.value);
  const kmInicial = safeNumber(turnoActivo.kmInicial);

  if (kmFinal <= kmInicial) return alert(`El KM Final (${kmFinal}) debe ser mayor al KM Inicial (${kmInicial}).`);
  if (ganancia <= 0) return alert("Ingresa la ganancia bruta del turno.");

  const recorrido = kmFinal - kmInicial;
  const horas = (Date.now() - turnoActivo.inicio) / 3600000;
  
  // Cálculo de Neta estimada usando el costo por KM real
  const costoEst = recorrido * safeNumber(panelData.parametros.costoPorKm);
  const neta = ganancia - costoEst;

  panelData.turnos.push({
    id: Date.now(),
    fechaInicio: new Date(turnoActivo.inicio).toISOString(),
    fechaFin: new Date().toISOString(),
    horas, kmInicial, kmFinal, kmRecorrido: recorrido,
    gananciaBruta: ganancia, gananciaNeta: neta
  });

  // ACTUALIZACIÓN CRÍTICA: El fin de hoy es el inicio de mañana
  panelData.parametros.ultimoKMfinal = kmFinal;
  
  turnoActivo = false;
  localStorage.removeItem("turnoActivo");
  
  saveData();
  
  // Limpiar campos
  kmFinalInput.value = "";
  gananciaInput.value = "";
  
  actualizarUITurno();
  alert(`Turno finalizado.\nRecorrido: ${recorrido} km\nGanancia Neta Est.: $${fmtMoney(neta)}`);
}

// ---------- WIZARD DE GASOLINA ----------

function setupGasolinaWizard() {
    const p1 = $("gasWizardPaso1"), p2 = $("gasWizardPaso2"), p3 = $("gasWizardPaso3");
    
    // Navegación Adelante
    $("btnGasSiguiente1").onclick = () => {
        if(safeNumber($("gasLitros").value) <= 0) return alert("Ingresa los litros.");
        p1.style.display = "none"; p2.style.display = "block";
    };
    $("btnGasSiguiente2").onclick = () => {
        if(safeNumber($("gasCosto").value) <= 0) return alert("Ingresa el costo.");
        p2.style.display = "none"; p3.style.display = "block";
    };

    // Navegación Atrás
    $("btnGasAtras2").onclick = () => { p2.style.display = "none"; p1.style.display = "block"; };
    $("btnGasAtras3").onclick = () => { p3.style.display = "none"; p2.style.display = "block"; };

    // GUARDAR CARGA (Acción Final)
    $("btnRegistrarCargaFinal").onclick = () => {
        const litros = safeNumber($("gasLitros").value);
        const costo = safeNumber($("gasCosto").value);
        const kmActual = safeNumber($("gasKmActual").value);
        const ultimoKM = safeNumber(panelData.parametros.ultimoKMfinal);

        if (kmActual <= ultimoKM && ultimoKM > 0) 
            return alert(`El KM actual (${kmActual}) debe ser mayor al último registrado (${ultimoKM}).`);

        // 1. Guardar Carga
        const carga = { id: Date.now(), fecha: new Date().toISOString(), kmActual, litros, costo };
        panelData.cargasCombustible.push(carga);

        // 2. Registrar Gasto Automático (Descripción genérica)
        panelData.gastos.push({
            id: Date.now(), tipo: 'Gasto', descripcion: 'Carga Gasolina', monto: costo, 
            fecha: new Date().toISOString(), esTrabajo: true 
        });

        // 3. ACTUALIZAR KM GLOBAL
        panelData.parametros.ultimoKMfinal = kmActual;

        // Reset UI y Guardar
        $("gasLitros").value = ""; $("gasCosto").value = ""; $("gasKmActual").value = "";
        p3.style.display = "none"; p1.style.display = "block";
        
        saveData();
        calcularMetricasCombustible(true);
        actualizarUITurno(); // Para refrescar lógica de KM si hubiera turno
        alert("⛽ Carga registrada y Kilometraje actualizado.");
    };
}

// ---------- LISTENERS GENERALES E INICIALIZACIÓN ----------

function setupListeners() {
    // Ingresos
    if($("btnRegistrarIngreso")) $("btnRegistrarIngreso").onclick = () => {
        const desc = $("ingresoDescripcion").value.trim();
        const monto = safeNumber($("ingresoCantidad").value);
        if(!desc || monto <= 0) return alert("Datos incompletos.");
        
        panelData.ingresos.push({id: Date.now(), descripcion: desc, monto, fecha: new Date().toISOString()});
        saveData(); alert("Ingreso registrado.");
        $("ingresoDescripcion").value=""; $("ingresoCantidad").value="";
    };

    // Gastos Diversos
    if($("btnRegistrarGasto")) $("btnRegistrarGasto").onclick = () => {
        const desc = $("gastoDescripcion").value.trim();
        const monto = safeNumber($("gastoCantidad").value);
        const tipo = $("gastoTipo").value;
        if(!desc || monto <= 0) return alert("Datos incompletos.");
        
        panelData.gastos.push({
            id: Date.now(), descripcion: desc, monto, fecha: new Date().toISOString(), 
            esTrabajo: (tipo === 'trabajo')
        });
        saveData(); alert("Gasto registrado.");
        $("gastoDescripcion").value=""; $("gastoCantidad").value="";
    };
    
    // Deudas (Wizard simple)
    if($("btnSiguienteDeuda")) $("btnSiguienteDeuda").onclick = () => {
        const m = safeNumber($("deudaMontoTotal").value);
        const d = $("deudaDescripcion").value.trim();
        if(m > 0 && d) {
            panelData.deudas.push({id: Date.now(), desc: d, total: m, saldo: m});
            saveData(); renderDeudas(); updateDeudaWizard();
            $("deudaMontoTotal").value=""; $("deudaDescripcion").value="";
        } else { alert("Datos incompletos."); }
    };

    if($("btnFinalizarDeuda")) $("btnFinalizarDeuda").onclick = () => {
         const m = safeNumber($("gastoFijoDiario").value);
         if(m > 0) {
             panelData.parametros.gastoFijo = m;
             saveData(); alert("Meta diaria actualizada.");
             updateDeudaWizard();
         }
    };
    
    if($("btnRegistrarAbono")) $("btnRegistrarAbono").onclick = () => {
        const id = $("abonoSeleccionar").value;
        const monto = safeNumber($("abonoMonto").value);
        const deuda = panelData.deudas.find(d => d.id == id);
        if(deuda && monto > 0 && monto <= deuda.saldo) {
            deuda.saldo -= monto;
            // Registrar como gasto personal
            panelData.gastos.push({id: Date.now(), descripcion: `Abono ${deuda.desc}`, monto, fecha: new Date().toISOString(), esTrabajo: false});
            
            if (deuda.saldo < 0.01) deuda.saldo = 0; // Limpieza flotante
            
            saveData(); renderDeudas(); alert("Abono registrado.");
            $("abonoMonto").value="";
        } else { alert("Abono inválido."); }
    };
    
    // Mantenimiento
    if($("btnGuardarMantenimiento")) $("btnGuardarMantenimiento").onclick = () => {
        const b = panelData.parametros.mantenimientoBase;
        b['Aceite (KM)'] = safeNumber($("mantenimientoAceite").value);
        b['Bujía (KM)'] = safeNumber($("mantenimientoBujia").value);
        b['Llantas (KM)'] = safeNumber($("mantenimientoLlantas").value);
        saveData(); alert("Umbrales guardados.");
    };

    // Respaldos
    if($("btnExportar")) $("btnExportar").onclick = exportarJson;
    if($("btnImportar")) $("btnImportar").onclick = importarJson;
}

// Renderizado de UI de Deudas
function updateDeudaWizard() {
    const s1 = $("wizardStep1"), s2 = $("wizardStep2");
    if(!s1 || !s2) return;
    const hasDeuda = panelData.deudas.length > 0;
    s1.style.display = hasDeuda ? 'none' : 'block';
    s2.style.display = hasDeuda ? 'block' : 'none';
}

function renderDeudas() {
    const s = $("abonoSeleccionar");
    const l = $("listaDeudas");
    if(!s || !l) return;
    s.innerHTML = ""; l.innerHTML = "";
    
    panelData.deudas.forEach(d => {
        if(d.saldo > 0.01) {
            const opt = document.createElement("option");
            opt.value = d.id; opt.text = d.desc;
            s.add(opt);
            l.innerHTML += `<li>${d.desc}: $${fmtMoney(d.saldo)} restan</li>`;
        }
    });
}

// Renderizado Index (Simplificado)
function renderIndex() {
  const m = calcularMetricasGenerales();
  calcularMetricasCombustible(true);
  
  const setTxt = (id, val) => { const el = $(id); if(el) el.textContent = val; };
  setTxt("resHoras", `${m.totalHoras.toFixed(1)}h`);
  setTxt("resGananciaBruta", `$${fmtMoney(m.gananciaBrutaProm)}`); // Promedio
  setTxt("resGastosTrabajo", `$${fmtMoney(m.gastoTrabajoProm)}`);
  setTxt("resGananciaNeta", `$${fmtMoney(m.netoDiarioProm)}`);
  setTxt("resKmRecorridos", `${m.totalKm.toFixed(0)} km`);
  setTxt("proyDeuda", `$${fmtMoney(m.deudaPendiente)}`);
  setTxt("proyDias", m.diasLibre === "N/A" ? "¡Déficit!" : `${m.diasLibre} días`);
  
  // Tablas y Gráficas
  renderTablaTurnos();
  renderAlertas();
  renderCharts();
}

function renderTablaTurnos() {
    const tbody = $("tablaTurnos");
    if (!tbody) return;
    tbody.innerHTML = "";
    panelData.turnos.slice().sort((a,b) => new Date(b.fechaFin) - new Date(a.fechaFin)).slice(0, 5).forEach(t => {
        tbody.innerHTML += `<tr><td>${formatearFecha(new Date(t.fechaFin))}</td><td>${t.horas.toFixed(1)}h</td><td>${t.kmRecorrido}km</td><td>$${fmtMoney(t.gananciaNeta)}</td></tr>`;
    });
}

function renderAlertas() {
  const ul = $("listaAlertas");
  if(!ul) return;
  ul.innerHTML = "";
  
  const kmActual = safeNumber(panelData.parametros.ultimoKMfinal);
  const base = panelData.parametros.mantenimientoBase;
  const alertas = [];

  if (kmActual > 0) {
    for (const [key, val] of Object.entries(base)) {
        const intv = safeNumber(val);
        const mod = kmActual % intv;
        const faltante = intv - mod;
        if (faltante <= (intv * 0.1) || faltante < 150) alertas.push(`⚠️ ${key}: Mantenimiento en ${faltante.toFixed(0)} km.`);
    }
  }
  
  alertas.forEach(a => ul.innerHTML += `<li>${a}</li>`);
  const card = $("cardAlertas");
  if(card) card.classList.toggle('hidden', alertas.length === 0);
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
      data: { labels, datasets: [{ label: 'KM', data: data.map(t => t.kmRecorrido), backgroundColor: '#16a34a' }] }
  });
}

// INICIALIZACIÓN
document.addEventListener("DOMContentLoaded", () => {
    cargarPanelData();
    const page = document.body.getAttribute('data-page');
    
    if (page === 'admin') {
        setupGasolinaWizard();
        setupListeners();
        
        if($("btnIniciarTurno")) $("btnIniciarTurno").onclick = iniciarTurno;
        if($("btnFinalizarTurno")) $("btnFinalizarTurno").onclick = finalizarTurno;

        actualizarUITurno();
        renderDeudas();
        updateDeudaWizard();
    } else if (page === 'index') {
        renderIndex();
    }
});
