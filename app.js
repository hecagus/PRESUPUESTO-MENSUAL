// app.js - VERSIÓN FINAL UNIFICADA (Autocorrección + Frecuencias + Importación Robusta)
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
  parametros: {
    deudaTotal: 0,
    gastoFijo: 0, // Representa la "Cuota Diaria de Deuda" calculada
    ultimoKMfinal: null,
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

// ---------- GESTIÓN Y CORRECCIÓN DE DATOS ----------

function validarYArreglarDatos() {
  // 1. Asegurar arrays básicos
  ['ingresos', 'gastos', 'deudas', 'movimientos', 'turnos'].forEach(k => {
    if (!Array.isArray(panelData[k])) panelData[k] = [];
  });

  if (!isObject(panelData.parametros)) {
    panelData.parametros = JSON.parse(JSON.stringify(DEFAULT_PANEL_DATA.parametros));
  }
  
  if (!panelData.parametros.mantenimientoBase) {
    panelData.parametros.mantenimientoBase = DEFAULT_PANEL_DATA.parametros.mantenimientoBase;
  }

  // 2. AUTOCORRECCIÓN INTELIGENTE DE GASTOS
  const palabrasTrabajo = ['gasolina', 'combustible', 'uber', 'mottu', 'moto', 'mantenimiento', 'aceite', 'llanta', 'refaccion', 'taller', 'reparacion', 'servicio'];
  
  panelData.gastos = panelData.gastos.map(g => {
    const desc = (g.descripcion || "").toLowerCase();
    const cat = (g.categoria || "").toLowerCase();
    let esTrabajo = g.esTrabajo === true; 
    
    // Si no está marcado, checar keywords
    if (!esTrabajo) {
        const match = palabrasTrabajo.some(p => desc.includes(p) || cat.includes(p));
        if (match) esTrabajo = true;
    }
    return { ...g, esTrabajo, monto: safeNumber(g.monto || g.cantidad) };
  });
  
  // Sincronizar cambios en Movimientos (Reconstrucción para consistencia)
  const movsGastos = panelData.gastos.map(g => ({
      ...g, tipo: 'Gasto', fecha: g.fecha || g.fechaISO || new Date().toISOString()
  }));
  const movsIngresos = panelData.ingresos.map(i => ({
      ...i, tipo: 'Ingreso', fecha: i.fecha || i.fechaISO || new Date().toISOString(), monto: safeNumber(i.monto || i.cantidad)
  }));
  
  panelData.movimientos = [...movsGastos, ...movsIngresos].sort((a,b) => new Date(b.fecha) - new Date(a.fecha));

  // 3. Saneamiento numérico
  ['deudaTotal', 'gastoFijo', 'costoPorKm'].forEach(k => {
    panelData.parametros[k] = safeNumber(panelData.parametros[k]);
  });

  saveData();
}

function cargarPanelData() {
  const data = localStorage.getItem(STORAGE_KEY);
  if (data) {
    try {
      const loaded = JSON.parse(data);
      if (isObject(loaded)) panelData = { ...panelData, ...loaded };
    } catch (e) {
      console.error("Error cargando datos, intentando backup...", e);
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
  } catch (e) {
    console.error("Error guardando datos:", e);
  }
}

// ---------- FUNCIONES DE IMPORTACIÓN/EXPORTACIÓN ----------

function exportarJson() {
    try {
        const json = JSON.stringify(panelData, null, 2);
        navigator.clipboard.writeText(json)
            .then(() => alert("✅ Datos copiados al portapapeles."))
            .catch(() => alert("⚠️ No se pudo copiar automáticamente. Intenta seleccionarlo manualmente si fuera visible."));
    } catch(e) { alert("Error al exportar."); }
}

function importarJson() {
    console.log("Iniciando proceso de importación..."); // Debug
    const input = $("importJson");
    
    if (!input) {
        alert("Error crítico: No se encuentra el campo de texto 'importJson' en el HTML.");
        return;
    }

    const jsonText = input.value.trim();
    if (!jsonText) {
        alert("⚠️ El campo está vacío.\nPor favor, pega el código JSON en el recuadro antes de presionar el botón.");
        return;
    }

    if (!confirm("⚠️ ¡ADVERTENCIA!\n\nSe borrarán TODOS los datos actuales y se reemplazarán con los que pegaste.\n\n¿Estás seguro de continuar?")) {
        return;
    }

    try {
        const datosNuevos = JSON.parse(jsonText);
        
        // Validación básica
        if (!datosNuevos || typeof datosNuevos !== 'object') throw new Error("El texto no es un objeto JSON válido.");

        // Restauración segura
        panelData = { ...JSON.parse(JSON.stringify(DEFAULT_PANEL_DATA)), ...datosNuevos };
        
        // Corregir y Guardar
        validarYArreglarDatos();
        saveData();
        
        alert("✅ Datos restaurados correctamente.\nLa página se recargará ahora para aplicar los cambios.");
        window.location.reload();
        
    } catch (e) {
        console.error(e);
        alert("❌ Error al leer el JSON:\n" + e.message + "\n\nVerifica que hayas copiado todo el código correctamente.");
    }
}

// ---------- CÁLCULOS Y MÉTRICAS ----------

function calcularMetricas() {
  const turnos = panelData.turnos;
  
  // 1. INGRESOS (Ignorando duplicados de "Ganancia turno")
  const ingresosReales = panelData.ingresos.filter(i => {
      const desc = (i.descripcion || "").toLowerCase();
      return !desc.includes("ganancia turno");
  });
  
  const totalIngresosExtras = ingresosReales.reduce((s, x) => s + safeNumber(x.monto), 0);
  const totalGananciaTurnos = turnos.reduce((s, x) => s + safeNumber(x.gananciaBruta || x.ganancia), 0);
  const totalGananciaBruta = totalGananciaTurnos + totalIngresosExtras;
  
  // 2. GASTOS
  // Operativos internos de turnos
  const gastosOperativosTurnos = turnos.reduce((s, x) => {
      const bruta = safeNumber(x.gananciaBruta || x.ganancia);
      const neta = safeNumber(x.gananciaNeta);
      if (neta === 0 && bruta > 0) return s; // Evitar restar si no hay neta calculada
      return s + (bruta - neta);
  }, 0);

  // Gastos manuales marcados como TRABAJO
  const gastosManualesTrabajo = panelData.gastos
    .filter(g => g.esTrabajo)
    .reduce((s, x) => s + safeNumber(x.monto), 0);
  
  const totalGastosTrabajo = gastosOperativosTurnos + gastosManualesTrabajo;

  // 3. PROMEDIOS
  const fechas = turnos.map(t => (t.fechaFin || t.fin || "").split('T')[0]).filter(Boolean);
  const diasTrabajados = new Set(fechas).size || 1;
  
  const gananciaNetaTotal = totalGananciaBruta - totalGastosTrabajo;
  const netoDiarioProm = diasTrabajados > 0 ? (gananciaNetaTotal / diasTrabajados) : 0;
  
  const m = {
    netoDiarioProm: netoDiarioProm,
    deudaPendiente: safeNumber(panelData.parametros.deudaTotal),
    cuotaDiariaDeuda: safeNumber(panelData.parametros.gastoFijo),
    totalKm: turnos.reduce((sum, t) => sum + safeNumber(t.kmRecorridos || t.kmRecorrido), 0),
    totalHoras: turnos.reduce((sum, t) => sum + safeNumber(t.horas), 0),
    gananciaBrutaProm: totalGananciaBruta / diasTrabajados,
    gastoTrabajoProm: totalGastosTrabajo / diasTrabajados,
    diasTrabajados: diasTrabajados
  };

  // Proyección
  const superavitDiario = m.netoDiarioProm - m.cuotaDiariaDeuda;
  if (m.deudaPendiente > 0 && superavitDiario > 0) {
      m.diasLibre = Math.ceil(m.deudaPendiente / m.netoDiarioProm);
  } else {
      m.diasLibre = "N/A";
  }
  
  panelData.metricas = m;
  saveData();
  return m;
}

// ---------- RENDERIZADO UI ----------

function renderIndex() {
  const m = calcularMetricas();
  const setTxt = (id, val) => { const el = $(id); if(el) el.textContent = val; };
  
  setTxt("resHoras", `${(m.totalHoras / m.diasTrabajados).toFixed(1)}h (Prom)`);
  setTxt("resGananciaBruta", `$${fmtMoney(m.gananciaBrutaProm)}`);
  setTxt("resGastosTrabajo", `$${fmtMoney(m.gastoTrabajoProm)}`);
  setTxt("resGananciaNeta", `$${fmtMoney(m.netoDiarioProm)}`);
  setTxt("resKmRecorridos", `${(m.totalKm / m.diasTrabajados).toFixed(0)} km (Prom)`);

  setTxt("proyDeuda", `$${fmtMoney(m.deudaPendiente)}`);
  
  const lblGasto = $("proyGastoFijoDiario");
  if(lblGasto) {
      lblGasto.previousElementSibling.textContent = "Meta diaria para deuda:";
      lblGasto.textContent = `$${fmtMoney(m.cuotaDiariaDeuda)}`;
      lblGasto.style.color = m.netoDiarioProm >= m.cuotaDiariaDeuda ? "#16a34a" : "#dc2626";
  }

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
  if (ctx1 && ctx2) {
    const data = panelData.turnos.slice().sort((a,b) => new Date(a.fechaFin || a.fin) - new Date(b.fechaFin || b.fin)).slice(-14);
    
    const labels = data.map(t => {
        const d = new Date(t.fechaFin || t.fin);
        return d.toLocaleDateString(undefined, {day:'2-digit', month:'2-digit'});
    });
    
    const netas = data.map(t => safeNumber(t.gananciaNeta || t.ganancia)); 

    if (gananciasChart) gananciasChart.destroy();
    gananciasChart = new Chart(ctx1, {
      type: 'line',
      data: {
        labels,
        datasets: [{ label: 'Neta ($)', data: netas, borderColor: '#2563eb', tension: 0.3, fill: true, backgroundColor: 'rgba(37, 99, 235, 0.1)' }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });

    if (kmChart) kmChart.destroy();
    kmChart = new Chart(ctx2, {
      type: 'bar',
      data: {
        labels,
        datasets: [{ label: 'KM', data: data.map(d => safeNumber(d.kmRecorridos || d.kmRecorrido)), backgroundColor: '#16a34a' }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }
}

function renderAlertas() {
  const alertas = [];
  const kmActual = safeNumber(panelData.parametros.ultimoKMfinal);
  const base = panelData.parametros.mantenimientoBase;
  
  if (kmActual > 0) {
    for (const [key, val] of Object.entries(base)) {
        const intervalo = safeNumber(val);
        if (intervalo > 0) {
            const mod = kmActual % intervalo;
            const faltante = intervalo - mod;
            if (faltante <= (intervalo * 0.1) || faltante < 150) {
                alertas.push(`⚠️ ${key.split(' ')[0]}: Mantenimiento en ${faltante.toFixed(0)} km.`);
            }
        }
    }
  }

  const ul = $("listaAlertas");
  const card = $("cardAlertas");
  if (ul && card) {
      ul.innerHTML = "";
      if (alertas.length > 0) {
          alertas.forEach(a => ul.innerHTML += `<li>${a}</li>`);
          card.classList.remove('hidden');
      } else {
          card.classList.add('hidden');
      }
  }
}

function renderTablaTurnos() {
    const tbody = $("tablaTurnos");
    if (tbody) {
      tbody.innerHTML = "";
      panelData.turnos.slice().sort((a,b) => new Date(b.fechaFin || b.fin) - new Date(a.fechaFin || a.fin)).slice(0, 5).forEach(t => {
        const fecha = new Date(t.fechaFin || t.fin);
        tbody.innerHTML += `
          <tr>
            <td>${formatearFecha(fecha)}</td>
            <td>${safeNumber(t.horas).toFixed(1)}h</td>
            <td>${safeNumber(t.kmRecorridos || t.kmRecorrido)}km</td>
            <td>$${fmtMoney(t.gananciaNeta || t.ganancia)}</td>
          </tr>
        `;
      });
    }
}

function renderHistorial() {
  const tbody = $("historialBody");
  const resumen = $("historialResumen");
  if (!tbody || !resumen) return;

  tbody.innerHTML = "";
  const totalIngresos = panelData.movimientos.filter(m => m.tipo === 'Ingreso').reduce((s, x) => s + x.monto, 0);
  const totalGastos = panelData.movimientos.filter(m => m.tipo === 'Gasto').reduce((s, x) => s + x.monto, 0);

  panelData.movimientos.slice().sort((a,b) => new Date(b.fecha) - new Date(a.fecha)).forEach(mov => {
    const isIngreso = mov.tipo === 'Ingreso';
    const esTrabajo = mov.esTrabajo ? '💼' : '🏠';
    tbody.innerHTML += `
      <tr style="background-color: ${isIngreso ? '#f0fdf4' : '#fef2f2'}">
        <td>${isIngreso ? '➕' : '➖'} ${mov.tipo}</td>
        <td>${new Date(mov.fecha).toLocaleDateString()}</td>
        <td>${mov.descripcion} ${esTrabajo}</td>
        <td style="font-weight:bold; color: ${isIngreso ? '#16a34a' : '#dc2626'}">$${fmtMoney(mov.monto)}</td>
      </tr>
    `;
  });
  
  resumen.innerHTML = `
    <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; text-align:center;">
        <div style="font-weight:bold; color:#16a34a">Ing: $${fmtMoney(totalIngresos)}</div>
        <div style="font-weight:bold; color:#dc2626">Gas: $${fmtMoney(totalGastos)}</div>
        <div style="font-weight:bold; color:#111">Bal: $${fmtMoney(totalIngresos - totalGastos)}</div>
    </div>
  `;
}

// ---------- GESTIÓN DE TURNO Y LISTENERS ----------

function actualizarUIturno() {
  const btnIni = $("btnIniciarTurno");
  if (!btnIni) return;

  const elems = {
    btnIni: $("btnIniciarTurno"),
    btnFin: $("btnFinalizarTurno"),
    txt: $("turnoTexto"),
    inKmI: $("kmInicial"),
    inKmF: $("kmFinal"),
    inGan: $("gananciaBruta"),
    lblKmI: $("labelKmInicial"),
    lblKmF: $("labelKmFinal"),
    lblGan: $("labelGananciaBruta")
  };

  if (turnoActivo) {
    if (elems.txt) elems.txt.innerHTML = `🟢 En curso (Inicio: ${new Date(safeNumber(turnoInicio)).toLocaleTimeString()})`;
    elems.btnIni.style.display = 'none';
    elems.btnFin.style.display = 'block';
    ['inKmF', 'inGan', 'lblKmF', 'lblGan'].forEach(k => { if(elems[k]) elems[k].style.display = 'block'; });
    if (elems.inKmI) {
      elems.inKmI.value = safeNumber(turnoActivo.kmInicial);
      elems.inKmI.setAttribute('readonly', true);
    }
  } else {
    if (elems.txt) elems.txt.innerHTML = `🔴 Sin turno activo`;
    elems.btnIni.style.display = 'block';
    elems.btnFin.style.display = 'none';
    ['inKmF', 'inGan', 'lblKmF', 'lblGan'].forEach(k => { if(elems[k]) elems[k].style.display = 'none'; });
    if (elems.inKmI) {
      elems.inKmI.removeAttribute('readonly');
      if (panelData.parametros.ultimoKMfinal) {
        elems.inKmI.value = safeNumber(panelData.parametros.ultimoKMfinal);
      } else {
        elems.inKmI.value = "";
      }
    }
  }
}

function iniciarTurno() {
  const kmInicial = safeNumber($("kmInicial").value);
  if (kmInicial <= 0) return alert("KM Inicial debe ser mayor a 0");

  turnoInicio = Date.now().toString();
  turnoActivo = { kmInicial, timestamp: turnoInicio };
  localStorage.setItem("turnoActivo", JSON.stringify(turnoActivo));
  localStorage.setItem("turnoInicio", turnoInicio);
  actualizarUIturno();
}

function finalizarTurno() {
  const kmFinal = safeNumber($("kmFinal").value);
  const gananciaBruta = safeNumber($("gananciaBruta").value);
  const kmInicial = safeNumber(turnoActivo.kmInicial);

  if (kmFinal <= kmInicial) return alert("KM Final debe ser mayor al Inicial");
  if (gananciaBruta <= 0) return alert("Ingresa una ganancia válida");

  const horas = (Date.now() - safeNumber(turnoActivo.timestamp)) / 36e5;
  const kmRec = kmFinal - kmInicial;
  
  const costoEst = kmRec * safeNumber(panelData.parametros.costoPorKm);
  const neta = gananciaBruta - costoEst;

  panelData.turnos.push({
    id: Date.now(),
    fechaInicio: new Date(safeNumber(turnoActivo.timestamp)).toISOString(),
    fechaFin: new Date().toISOString(),
    horas, kmInicial, kmFinal, kmRecorridos: kmRec,
    gananciaBruta, gananciaNeta: neta
  });

  panelData.parametros.ultimoKMfinal = kmFinal;
  localStorage.removeItem("turnoActivo");
  localStorage.removeItem("turnoInicio");
  turnoActivo = false;
  
  saveData();
  actualizarUIturno();
  alert(`Turno finalizado. Neta Est.: $${fmtMoney(neta)}`);
}

function registrarMovimiento(tipo, descId, montoId, esTrabajo) {
  const descInput = $(descId);
  const montoInput = $(montoId);
  if (!descInput || !montoInput) return;

  const desc = descInput.value.trim();
  const monto = safeNumber(montoInput.value);
  if (!desc || monto <= 0) return alert(`Completa descripción y monto > 0.`);

  const mov = {
    id: Date.now(),
    tipo, descripcion: desc, monto,
    fecha: new Date().toISOString(),
    esTrabajo
  };

  if (tipo === 'Ingreso') panelData.ingresos.push(mov);
  else panelData.gastos.push(mov);
  
  panelData.movimientos.push(mov);
  
  descInput.value = "";
  montoInput.value = "";
  saveData();
  alert(`${tipo} registrado.`);
}

// ---------- WIZARD DEUDA (LÓGICA FRECUENCIA) ----------

function updateDeudaWizardUI() {
  const step1 = $('wizardStep1');
  const step2 = $('wizardStep2');
  if (!step1 || !step2) return;

  const tieneDeudas = panelData.deudas.length > 0;
  // Si no hay deudas y el gasto fijo (cuota) es 0, mostrar inicio
  if (!tieneDeudas && panelData.parametros.gastoFijo === 0) {
    step1.style.display = 'block';
    step2.style.display = 'none';
  } else {
    step1.style.display = 'none';
    step2.style.display = 'block';
  }
}

function setupDeudaWizardListeners() {
  // Paso 1: Registrar
  const btnSig = $("btnSiguienteDeuda");
  if (btnSig) {
      const newBtn = btnSig.cloneNode(true);
      btnSig.parentNode.replaceChild(newBtn, btnSig);
      newBtn.addEventListener("click", () => {
          const monto = safeNumber($("deudaMontoTotal").value);
          const desc = $("deudaDescripcion").value.trim();
          if (monto <= 0 || !desc) return alert("Datos incompletos.");
          
          panelData.deudas.push({
              id: Date.now(), descripcion: desc, montoOriginal: monto, saldo: monto, estado: 'Pendiente'
          });
          panelData.parametros.deudaTotal = monto;
          updateDeudaWizardUI();
          $("deudaMontoTotal").value = ""; $("deudaDescripcion").value = "";
      });
  }

  // Paso 2: Plan Pagos (FRECUENCIA)
  const btnFin = $("btnFinalizarDeuda");
  if (btnFin) {
      const newBtn = btnFin.cloneNode(true);
      btnFin.parentNode.replaceChild(newBtn, btnFin);
      newBtn.addEventListener("click", () => {
          // IDs actualizados para la lógica de frecuencia
          const abono = safeNumber($("abonoPeriodicoMonto").value);
          const dias = safeNumber($("abonoPeriodicoFrecuencia").value);
          
          if (abono <= 0 || dias <= 0) return alert("Por favor ingresa un monto de abono y selecciona la frecuencia.");
          
          panelData.parametros.gastoFijo = abono / dias; // Calculamos cuota diaria
          saveData();
          renderDeudas();
          calcularMetricas();
          alert(`Plan guardado. Meta diaria: $${fmtMoney(panelData.parametros.gastoFijo)}`);
      });
  }
  
  // Abono
  const btnAbono = $("btnRegistrarAbono");
  if (btnAbono) {
      const newBtn = btnAbono.cloneNode(true);
      btnAbono.parentNode.replaceChild(newBtn, btnAbono);
      newBtn.addEventListener("click", () => {
          const id = parseInt($("abonoSeleccionar").value);
          const monto = safeNumber($("abonoMonto").value);
          const deuda = panelData.deudas.find(d => d.id === id);
          
          if (!deuda || monto <= 0 || monto > deuda.saldo) return alert("Abono inválido o mayor al saldo.");
          
          // Registrar en historial como gasto personal (no trabajo)
          panelData.movimientos.push({
             id: Date.now(), tipo: 'Gasto', descripcion: `Abono: ${deuda.descripcion}`, monto, fecha: new Date().toISOString(), esTrabajo: false
          });
          
          deuda.saldo -= monto;
          if (deuda.saldo <= 0.01) { deuda.saldo = 0; deuda.estado = 'Pagada'; alert("¡Deuda Pagada!"); }
          
          panelData.parametros.deudaTotal = panelData.deudas.filter(d => d.estado !== 'Pagada').reduce((s,d)=>s+d.saldo,0);
          saveData();
          renderDeudas();
          $("abonoMonto").value = "";
      });
  }
  
  // Volver
  const btnVolver = $("btnVolverDeuda");
  if(btnVolver) {
      btnVolver.addEventListener("click", () => {
         $('wizardStep1').style.display = 'block';
         $('wizardStep2').style.display = 'none'; 
      });
  }
}

function renderDeudas() {
  const lista = $("listaDeudas");
  const select = $("abonoSeleccionar");
  if (!lista || !select) return;
  lista.innerHTML = "";
  select.innerHTML = "<option value=''>-- Seleccionar --</option>";
  
  panelData.deudas.forEach(d => {
      lista.innerHTML += `<li><span>${d.descripcion}</span> <strong>$${fmtMoney(d.saldo)}</strong></li>`;
      if (d.saldo > 0) select.innerHTML += `<option value="${d.id}">${d.descripcion}</option>`;
  });
}

// ---------- INICIALIZACIÓN GLOBAL ----------

document.addEventListener("DOMContentLoaded", () => {
  cargarPanelData(); // Ejecuta autocorrección al inicio
  const page = document.body.getAttribute('data-page');

  if (page === 'admin') {
    actualizarUIturno();
    setupDeudaWizardListeners();
    renderDeudas();
    updateDeudaWizardUI();

    if($("btnIniciarTurno")) $("btnIniciarTurno").addEventListener("click", iniciarTurno);
    if($("btnFinalizarTurno")) $("btnFinalizarTurno").addEventListener("click", finalizarTurno);
    if($("btnRegistrarIngreso")) $("btnRegistrarIngreso").addEventListener("click", () => registrarMovimiento('Ingreso', 'ingresoDescripcion', 'ingresoCantidad', true));
    if($("btnRegistrarGasto")) $("btnRegistrarGasto").addEventListener("click", () => {
       const tipo = $("gastoTipo") ? $("gastoTipo").value : 'fijo';
       registrarMovimiento('Gasto', 'gastoDescripcion', 'gastoCantidad', tipo === 'trabajo');
    });
    
    // Importación/Exportación
    if($("btnExportar")) $("btnExportar").addEventListener("click", exportarJson);
    if($("btnImportar")) $("btnImportar").addEventListener("click", importarJson);
    
    // Guardado de Parámetros
    if($("btnGuardarKmParam")) $("btnGuardarKmParam").addEventListener("click", () => {
        panelData.parametros.costoPorKm = safeNumber($("costoPorKm").value);
        saveData(); alert("Guardado.");
    });
    if($("btnGuardarMantenimiento")) $("btnGuardarMantenimiento").addEventListener("click", () => {
        const base = panelData.parametros.mantenimientoBase;
        base['Aceite (KM)'] = safeNumber($("mantenimientoAceite").value);
        base['Bujía (KM)'] = safeNumber($("mantenimientoBujia").value);
        base['Llantas (KM)'] = safeNumber($("mantenimientoLlantas").value);
        saveData(); alert("Umbrales guardados.");
    });
  } 
  else if (page === 'index') {
    renderIndex();
  }
  else if (page === 'historial') {
    renderHistorial();
  }
});
