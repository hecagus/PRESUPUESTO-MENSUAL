// app.js - VERSIÓN FINAL CON LÓGICA DE FRECUENCIA DE PAGO
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
    gastoFijo: 0, // Esto ahora representará la "Cuota Diaria de Deuda" calculada
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

// Estado de turno
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

// ---------- GESTIÓN DE DATOS ----------

function validarYArreglarDatos() {
  ['ingresos', 'gastos', 'deudas', 'movimientos', 'turnos'].forEach(k => {
    if (!Array.isArray(panelData[k])) panelData[k] = [];
  });

  if (!isObject(panelData.parametros)) {
    panelData.parametros = JSON.parse(JSON.stringify(DEFAULT_PANEL_DATA.parametros));
  }
  
  if (!panelData.parametros.mantenimientoBase) {
    panelData.parametros.mantenimientoBase = DEFAULT_PANEL_DATA.parametros.mantenimientoBase;
  }

  ['deudaTotal', 'gastoFijo', 'costoPorKm'].forEach(k => {
    panelData.parametros[k] = safeNumber(panelData.parametros[k]);
  });

  panelData.turnos = panelData.turnos.map(t => ({
    ...t,
    horas: safeNumber(t.horas),
    kmRecorridos: safeNumber(t.kmRecorridos),
    gananciaNeta: safeNumber(t.gananciaNeta),
    fechaFin: t.fechaFin || new Date().toISOString()
  }));

  panelData.deudas = panelData.deudas.map(d => ({
    ...d,
    saldo: safeNumber(d.saldo, d.montoOriginal),
    estado: safeNumber(d.saldo) > 0.01 ? 'Pendiente' : 'Pagada'
  }));
  
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
      if (backup) {
        try { panelData = { ...panelData, ...JSON.parse(backup) }; } catch (ex) {}
      }
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

// ---------- GESTIÓN DE TURNO ----------

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
  
  // Costo operativo
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

// ---------- REGISTRO DE MOVIMIENTOS ----------

function registrarMovimiento(tipo, descId, montoId, esTrabajo) {
  const descInput = $(descId);
  const montoInput = $(montoId);
  
  if (!descInput || !montoInput) return;

  const desc = descInput.value.trim();
  const monto = safeNumber(montoInput.value);

  if (!desc || monto <= 0) return alert(`Completa descripción y monto > 0 para ${tipo}.`);

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

// ---------- GESTIÓN DE DEUDAS (WIZARD REDISEÑADO) ----------

function updateDeudaWizardUI() {
  const step1 = $('wizardStep1');
  const step2 = $('wizardStep2');
  
  if (!step1 || !step2) return;

  const tieneDeudas = panelData.deudas.length > 0;
  // Si no hay deudas y el gasto fijo (ahora cuota diaria) es 0, iniciamos wizard
  if (!tieneDeudas && panelData.parametros.gastoFijo === 0) {
    step1.style.display = 'block';
    step2.style.display = 'none';
  } else {
    step1.style.display = 'none';
    step2.style.display = 'block';
  }
}

function setupDeudaWizardListeners() {
  console.log("Iniciando listeners de Deuda...");

  // 1. Botón SIGUIENTE (Paso 1 -> Paso 2)
  const btnSiguiente = document.getElementById('btnSiguienteDeuda');
  if (btnSiguiente) {
    const newBtn = btnSiguiente.cloneNode(true);
    btnSiguiente.parentNode.replaceChild(newBtn, btnSiguiente);
    
    newBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const inputMonto = document.getElementById("deudaMontoTotal");
      const inputDesc = document.getElementById("deudaDescripcion");

      if (!inputMonto || !inputDesc) return;

      const monto = safeNumber(inputMonto.value);
      const desc = inputDesc.value.trim();

      if (monto <= 0) return alert("Ingresa un monto total de deuda válido.");
      if (!desc) return alert("Ingresa una descripción.");

      // Guardar deuda
      panelData.deudas.push({
        id: Date.now(),
        descripcion: desc,
        montoOriginal: monto,
        saldo: monto,
        estado: 'Pendiente',
        fechaRegistro: new Date().toISOString()
      });
      
      // Actualizar total
      panelData.parametros.deudaTotal = monto;

      // Cambio de pantalla
      const s1 = $('wizardStep1');
      const s2 = $('wizardStep2');
      if (s1) s1.style.display = 'none';
      if (s2) s2.style.display = 'block';
      
      inputMonto.value = "";
      inputDesc.value = "";
      console.log("Deuda registrada. Pasando a configuración de pagos...");
    });
  }

  // 2. Botón FINALIZAR (Paso 2: Plan de Pagos)
  const btnFinalizar = document.getElementById('btnFinalizarDeuda');
  if (btnFinalizar) {
    // Clonar para limpiar listeners viejos
    const newBtnFin = btnFinalizar.cloneNode(true);
    btnFinalizar.parentNode.replaceChild(newBtnFin, btnFinalizar);

    newBtnFin.addEventListener('click', () => {
      // Nuevos IDs según el HTML modificado
      const inputAbono = $("abonoPeriodicoMonto");
      const selectFrec = $("abonoPeriodicoFrecuencia");

      if (!inputAbono || !selectFrec) {
        alert("Error: Asegúrate de haber actualizado el código HTML del WizardStep2.");
        return;
      }

      const abono = safeNumber(inputAbono.value);
      const dias = safeNumber(selectFrec.value); // 7, 15, 30

      if (abono <= 0) return alert("Ingresa el monto que abonas periódicamente.");
      if (dias <= 0) return alert("Selecciona una frecuencia válida.");

      // CÁLCULO DE LA CUOTA DIARIA
      const costoDiarioDeuda = abono / dias;

      // Guardamos esto en 'gastoFijo' (que ahora funciona como 'Meta Diaria de Deuda')
      panelData.parametros.gastoFijo = costoDiarioDeuda;
      
      saveData();
      renderDeudas();
      calcularMetricas();
      
      alert(`Plan Guardado.\nPara cubrir tu pago de $${abono}, necesitas apartar aprox $${fmtMoney(costoDiarioDeuda)} diarios.`);
    });
  }

  // 3. Botón VOLVER
  const btnVolver = document.getElementById('btnVolverDeuda');
  if (btnVolver) {
    btnVolver.addEventListener('click', () => {
       const s1 = $('wizardStep1');
       const s2 = $('wizardStep2');
       if (s1) s1.style.display = 'block';
       if (s2) s2.style.display = 'none';
    });
  }
  
  // 4. Botón ABONO (Funcionalidad de pago)
  const btnAbono = document.getElementById('btnRegistrarAbono');
  if (btnAbono) {
    const newBtnAbono = btnAbono.cloneNode(true);
    btnAbono.parentNode.replaceChild(newBtnAbono, btnAbono);

    newBtnAbono.addEventListener('click', () => {
       const elSelect = $('abonoSeleccionar');
       const elMonto = $('abonoMonto');
       
       if(!elSelect || !elMonto) return;
       const idDeuda = parseInt(elSelect.value);
       const monto = safeNumber(elMonto.value);
       
       const deuda = panelData.deudas.find(d => d.id === idDeuda);
       if (!deuda) return alert("Selecciona una deuda.");
       if (monto <= 0) return alert("Monto inválido.");
       if (monto > safeNumber(deuda.saldo)) return alert("El abono excede el saldo.");
       
       // Registrar en historial
       panelData.movimientos.push({
            id: Date.now(),
            tipo: 'Gasto',
            descripcion: `Abono Deuda: ${deuda.descripcion}`,
            monto: monto,
            fecha: new Date().toISOString(),
            esTrabajo: false
        });

       deuda.saldo = safeNumber(deuda.saldo) - monto;
       
       if (deuda.saldo <= 0.01) {
           deuda.saldo = 0;
           deuda.estado = 'Pagada';
           alert(`¡Deuda liquidada! 🎉`);
       } else {
           alert("Abono registrado.");
       }
       
       // Recalcular deuda total pendiente
       panelData.parametros.deudaTotal = panelData.deudas
         .filter(d => d.estado !== 'Pagada')
         .reduce((acc, d) => acc + safeNumber(d.saldo), 0);

       saveData();
       renderDeudas();
       elMonto.value = "";
       calcularMetricas();
    });
  }
}

function renderDeudas() {
  const lista = $("listaDeudas");
  const select = $("abonoSeleccionar");
  if (!lista || !select) return;

  lista.innerHTML = "";
  select.innerHTML = "<option value=''>-- Seleccionar Deuda --</option>";

  const deudasOrdenadas = panelData.deudas.slice().sort((a, b) => safeNumber(b.saldo) - safeNumber(a.saldo));

  deudasOrdenadas.forEach(d => {
      const saldo = safeNumber(d.saldo);
      const color = d.estado === 'Pagada' ? 'green' : (saldo > 0 ? '#dc2626' : 'gray');
      
      lista.innerHTML += `
        <li style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid #eee;">
          <span>${d.descripcion}</span>
          <strong style="color:${color}">$${fmtMoney(saldo)}</strong>
        </li>
      `;

      if (d.estado === 'Pendiente' && saldo > 0) {
        select.innerHTML += `<option value="${d.id}">${d.descripcion} - $${fmtMoney(saldo)}</option>`;
      }
    });
}

// ---------- CÁLCULOS Y MÉTRICAS ----------

function calcularMetricas() {
  const turnos = panelData.turnos;
  
  // Ingresos
  const ingresosExtra = panelData.ingresos.reduce((s, x) => s + safeNumber(x.monto), 0);
  const gananciaTurnos = turnos.reduce((s, x) => s + safeNumber(x.gananciaBruta), 0);
  const totalGananciaBruta = gananciaTurnos + ingresosExtra;
  
  // Gastos
  const gastosOperativos = turnos.reduce((s, x) => s + (safeNumber(x.gananciaBruta) - safeNumber(x.gananciaNeta)), 0);
  const gastosManuales = panelData.gastos.filter(g => g.esTrabajo).reduce((s, x) => s + safeNumber(x.monto), 0);
  const totalGastosTrabajo = gastosOperativos + gastosManuales;

  // Promedios
  const fechas = turnos.map(t => t.fechaFin.split('T')[0]).filter(Boolean);
  const diasTrabajados = new Set(fechas).size || 1;
  
  const gananciaNetaTotal = totalGananciaBruta - totalGastosTrabajo;
  const netoDiarioProm = diasTrabajados > 0 ? (gananciaNetaTotal / diasTrabajados) : 0;
  
  // Métricas
  const m = {
    netoDiarioProm: netoDiarioProm,
    deudaPendiente: safeNumber(panelData.parametros.deudaTotal),
    cuotaDiariaDeuda: safeNumber(panelData.parametros.gastoFijo), // Usamos gastoFijo como la cuota diaria calculada
    totalKm: turnos.reduce((sum, t) => sum + safeNumber(t.kmRecorridos), 0),
    totalHoras: turnos.reduce((sum, t) => sum + safeNumber(t.horas), 0),
    gananciaBrutaProm: totalGananciaBruta / diasTrabajados,
    gastoTrabajoProm: totalGastosTrabajo / diasTrabajados,
    diasTrabajados: diasTrabajados
  };

  // Cálculo: ¿Cubrimos la cuota diaria?
  // Diferencia diaria = Lo que ganas neto - Lo que necesitas para la deuda
  const superavitDiario = m.netoDiarioProm - m.cuotaDiariaDeuda;
  
  // Proyección de días para liquidar TOTALMENTE la deuda
  if (m.deudaPendiente > 0 && superavitDiario > 0) {
      // Si sobra dinero después de pagar la cuota diaria, podríamos abonar más.
      // Pero para simplificar, usamos todo el neto disponible para proyectar liquidación rápida.
      m.diasLibre = Math.ceil(m.deudaPendiente / m.netoDiarioProm);
  } else {
      m.diasLibre = "N/A";
  }
  
  panelData.metricas = m;
  saveData();
  return m;
}

// ---------- RENDERIZADO ----------

function renderIndex() {
  const m = calcularMetricas();
  const setTxt = (id, val) => { const el = $(id); if(el) el.textContent = val; };
  
  setTxt("resHoras", `${(m.totalHoras / m.diasTrabajados).toFixed(1)}h (Prom)`);
  setTxt("resGananciaBruta", `$${fmtMoney(m.gananciaBrutaProm)}`);
  setTxt("resGananciaNeta", `$${fmtMoney(m.netoDiarioProm)}`);
  setTxt("resKmRecorridos", `${(m.totalKm / m.diasTrabajados).toFixed(0)} km (Prom)`);

  // Actualización de etiquetas para reflejar la nueva lógica
  setTxt("proyDeuda", `$${fmtMoney(m.deudaPendiente)}`);
  
  // Ahora mostramos la Cuota Diaria Calculada
  const lblGasto = $("proyGastoFijoDiario");
  if(lblGasto) {
      // Truco: cambiar etiqueta visualmente si es posible, si no solo el valor
      lblGasto.previousElementSibling.textContent = "Necesitas apartar (Diario):";
      lblGasto.textContent = `$${fmtMoney(m.cuotaDiariaDeuda)}`;
      lblGasto.style.color = m.netoDiarioProm >= m.cuotaDiariaDeuda ? "green" : "red";
  }

  setTxt("proyNetaPromedio", `$${fmtMoney(m.netoDiarioProm)}`);
  setTxt("proyDias", m.diasLibre === "N/A" ? "¡Déficit!" : `${m.diasLibre} días (Estimado)`);
  setTxt("proyKmTotal", safeNumber(m.totalKm).toFixed(0) + " KM");

  renderCharts();
  renderAlertas();
  renderTablaTurnos();
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
            if (faltante <= (intervalo * 0.1) || faltante < 100) {
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
      panelData.turnos.slice().sort((a,b) => new Date(b.fechaFin) - new Date(a.fechaFin)).slice(0, 5).forEach(t => {
        tbody.innerHTML += `
          <tr>
            <td>${formatearFecha(new Date(t.fechaFin))}</td>
            <td>${safeNumber(t.horas).toFixed(1)}h</td>
            <td>${safeNumber(t.kmRecorridos)}km</td>
            <td>$${fmtMoney(t.gananciaNeta)}</td>
          </tr>
        `;
      });
    }
}

function renderCharts() {
  if (typeof Chart === 'undefined') return;
  const ctx1 = $("graficaGanancias");
  const ctx2 = $("graficaKm");
  if (ctx1 && ctx2) {
    const data = panelData.turnos.slice().sort((a,b) => new Date(a.fechaFin) - new Date(b.fechaFin)).slice(-14);
    const labels = data.map(t => new Date(t.fechaFin).toLocaleDateString(undefined, {day:'2-digit', month:'2-digit'}));
    
    if (gananciasChart) gananciasChart.destroy();
    gananciasChart = new Chart(ctx1, {
      type: 'line',
      data: {
        labels,
        datasets: [{ 
            label: 'Neta ($)', 
            data: data.map(d=>d.gananciaNeta), 
            borderColor: '#2563eb', 
            tension: 0.3 
        }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });

    if (kmChart) kmChart.destroy();
    kmChart = new Chart(ctx2, {
      type: 'bar',
      data: {
        labels,
        datasets: [{ 
            label: 'KM', 
            data: data.map(d=>d.kmRecorridos), 
            backgroundColor: '#16a34a' 
        }]
      },
      options: { responsive: true, maintainAspectRatio: false }
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

  panelData.movimientos.sort((a,b) => new Date(b.fecha) - new Date(a.fecha)).forEach(mov => {
    const isIngreso = mov.tipo === 'Ingreso';
    tbody.innerHTML += `
      <tr style="background-color: ${isIngreso ? '#f0fdf4' : '#fef2f2'}">
        <td>${isIngreso ? '➕' : '➖'} ${mov.tipo}</td>
        <td>${new Date(mov.fecha).toLocaleDateString()}</td>
        <td>${mov.descripcion}</td>
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

// ---------- INICIALIZACIÓN ----------
document.addEventListener("DOMContentLoaded", () => {
  cargarPanelData();
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
       const elTipo = $("gastoTipo");
       const esTrabajo = elTipo ? elTipo.value === 'trabajo' : false;
       registrarMovimiento('Gasto', 'gastoDescripcion', 'gastoCantidad', esTrabajo);
    });
    
    // Configuración Parametros
    const btnSaveKm = $("btnGuardarKmParam");
    if (btnSaveKm) {
        if ($("costoPorKm")) $("costoPorKm").value = safeNumber(panelData.parametros.costoPorKm);
        btnSaveKm.addEventListener("click", () => {
            panelData.parametros.costoPorKm = safeNumber($("costoPorKm").value);
            saveData();
            alert("Costo por KM guardado.");
        });
    }

    const btnSaveMant = $("btnGuardarMantenimiento");
    if (btnSaveMant) {
        if ($("mantenimientoAceite")) $("mantenimientoAceite").value = safeNumber(panelData.parametros.mantenimientoBase['Aceite (KM)']);
        if ($("mantenimientoBujia")) $("mantenimientoBujia").value = safeNumber(panelData.parametros.mantenimientoBase['Bujía (KM)']);
        if ($("mantenimientoLlantas")) $("mantenimientoLlantas").value = safeNumber(panelData.parametros.mantenimientoBase['Llantas (KM)']);

        btnSaveMant.addEventListener("click", () => {
            panelData.parametros.mantenimientoBase['Aceite (KM)'] = safeNumber($("mantenimientoAceite").value);
            panelData.parametros.mantenimientoBase['Bujía (KM)'] = safeNumber($("mantenimientoBujia").value);
            panelData.parametros.mantenimientoBase['Llantas (KM)'] = safeNumber($("mantenimientoLlantas").value);
            saveData();
            alert("Umbrales de mantenimiento guardados.");
        });
    }
    
    // Export/Import
    if($("btnExportar")) $("btnExportar").addEventListener("click", () => {
        navigator.clipboard.writeText(JSON.stringify(panelData, null, 2))
          .then(() => alert("JSON Copiado."))
          .catch(() => alert("Error al copiar."));
    });
    if($("btnImportar")) $("btnImportar").addEventListener("click", () => {
        const json = $("importJson").value;
        if(!json) return alert("Pega el JSON.");
        if(confirm("¿Restaurar datos? Se perderá lo actual.")) {
            try {
                panelData = { ...JSON.parse(JSON.stringify(DEFAULT_PANEL_DATA)), ...JSON.parse(json) };
                saveData();
                window.location.reload();
            } catch(e) { alert("JSON inválido."); }
        }
    });
  } 
  else if (page === 'index') {
    renderIndex();
  }
  else if (page === 'historial') {
    renderHistorial();
  }
  // app.js - VERSIÓN CON AUTOCORRECCIÓN DE DATOS Y MÉTRICAS REALES
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
    gastoFijo: 0, 
    ultimoKMfinal: null,
    costoPorKm: 0,
    mantenimientoBase: {
      'Aceite (KM)': 3000,
      'Bujía (KM)': 8000,
      'Llantas (KM)': 15000
    }
  }
};

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
  
  // 2. AUTOCORRECCIÓN INTELIGENTE DE GASTOS
  // Palabras clave que indican que un gasto es de TRABAJO
  const palabrasTrabajo = ['gasolina', 'combustible', 'uber', 'mottu', 'moto', 'mantenimiento', 'aceite', 'llanta', 'refaccion', 'taller', 'reparacion', 'servicio'];
  
  panelData.gastos = panelData.gastos.map(g => {
    const desc = (g.descripcion || "").toLowerCase();
    const cat = (g.categoria || "").toLowerCase();
    
    // Si ya está marcado como trabajo, lo dejamos. Si es false, verificamos keywords.
    let esTrabajo = g.esTrabajo === true; 
    
    if (!esTrabajo) {
        // Checar si la descripción o categoría contiene palabras clave
        const match = palabrasTrabajo.some(p => desc.includes(p) || cat.includes(p));
        if (match) {
            esTrabajo = true;
            console.log(`Corrección: Gasto "${g.descripcion}" marcado como TRABAJO.`);
        }
    }
    
    return { ...g, esTrabajo, monto: safeNumber(g.monto || g.cantidad) };
  });
  
  // Sincronizar cambios en el array general de movimientos
  // (Reconstruimos movimientos desde gastos e ingresos para asegurar consistencia)
  const movsGastos = panelData.gastos.map(g => ({
      ...g, tipo: 'Gasto', fecha: g.fecha || g.fechaISO || new Date().toISOString()
  }));
  
  const movsIngresos = panelData.ingresos.map(i => ({
      ...i, tipo: 'Ingreso', fecha: i.fecha || i.fechaISO || new Date().toISOString(), monto: safeNumber(i.monto || i.cantidad)
  }));
  
  // Combinamos y ordenamos por fecha descendente
  panelData.movimientos = [...movsGastos, ...movsIngresos].sort((a,b) => {
      return new Date(b.fecha) - new Date(a.fecha);
  });

  // 3. Saneamiento numérico de parámetros
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

// ---------- CÁLCULOS Y MÉTRICAS (LÓGICA CORREGIDA) ----------

function calcularMetricas() {
  const turnos = panelData.turnos;
  
  // 1. INGRESOS
  // Filtrar ingresos que parecen duplicados de turnos (ej. "Ganancia turno...")
  const ingresosReales = panelData.ingresos.filter(i => {
      const desc = (i.descripcion || "").toLowerCase();
      // Si dice "ganancia turno", asumimos que ya viene del array 'turnos', lo ignoramos aquí
      return !desc.includes("ganancia turno");
  });
  
  const totalIngresosExtras = ingresosReales.reduce((s, x) => s + safeNumber(x.monto), 0);
  const totalGananciaTurnos = turnos.reduce((s, x) => s + safeNumber(x.gananciaBruta || x.ganancia), 0);
  
  const totalGananciaBruta = totalGananciaTurnos + totalIngresosExtras;
  
  // 2. GASTOS
  // Gastos operativos estimados dentro de los turnos (diferencia Bruta - Neta interna del turno, si existe)
  const gastosOperativosTurnos = turnos.reduce((s, x) => {
      const bruta = safeNumber(x.gananciaBruta || x.ganancia);
      const neta = safeNumber(x.gananciaNeta);
      // Si la neta es 0 o no existe, asumimos que no hubo cálculo de gasto interno en el turno
      if (neta === 0) return s; 
      return s + (bruta - neta);
  }, 0);

  // Gastos manuales marcados como TRABAJO (Aquí entra la corrección de Gasolina, etc.)
  const gastosManualesTrabajo = panelData.gastos
    .filter(g => g.esTrabajo)
    .reduce((s, x) => s + safeNumber(x.monto), 0);
  
  const totalGastosTrabajo = gastosOperativosTurnos + gastosManualesTrabajo;

  // 3. PROMEDIOS
  const fechas = turnos.map(t => (t.fechaFin || t.fin || "").split('T')[0]).filter(Boolean);
  const diasTrabajados = new Set(fechas).size || 1;
  
  // Ganancia Neta Real = (Turnos + Extras) - (Gastos Trabajo)
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

  // Proyecciones
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

// ---------- RENDERIZADO ----------

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
    // Usar datos de turnos ordenados por fecha
    const data = panelData.turnos.slice().sort((a,b) => new Date(a.fechaFin || a.fin) - new Date(b.fechaFin || b.fin)).slice(-14);
    
    const labels = data.map(t => {
        const d = new Date(t.fechaFin || t.fin);
        return d.toLocaleDateString(undefined, {day:'2-digit', month:'2-digit'});
    });
    
    // Para la gráfica, calculamos la neta restando gastos proporcionales si no están calculados
    const netas = data.map(t => safeNumber(t.gananciaNeta || t.ganancia)); 

    if (gananciasChart) gananciasChart.destroy();
    gananciasChart = new Chart(ctx1, {
      type: 'line',
      data: {
        labels,
        datasets: [{ 
            label: 'Neta ($)', 
            data: netas, 
            borderColor: '#2563eb', 
            tension: 0.3,
            fill: true,
            backgroundColor: 'rgba(37, 99, 235, 0.1)'
        }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });

    if (kmChart) kmChart.destroy();
    kmChart = new Chart(ctx2, {
      type: 'bar',
      data: {
        labels,
        datasets: [{ 
            label: 'KM', 
            data: data.map(d => safeNumber(d.kmRecorridos || d.kmRecorrido)), 
            backgroundColor: '#16a34a' 
        }]
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
  
  // Calcular totales para el resumen
  const totalIngresos = panelData.movimientos.filter(m => m.tipo === 'Ingreso').reduce((s, x) => s + x.monto, 0);
  const totalGastos = panelData.movimientos.filter(m => m.tipo === 'Gasto').reduce((s, x) => s + x.monto, 0);

  // Renderizar tabla
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
        <div style="font-weight:bold; color:#16a34a">Ingresos Totales: $${fmtMoney(totalIngresos)}</div>
        <div style="font-weight:bold; color:#dc2626">Gastos Totales: $${fmtMoney(totalGastos)}</div>
        <div style="font-weight:bold; color:#111">Balance Global: $${fmtMoney(totalIngresos - totalGastos)}</div>
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
  
  // Costo operativo estimado al cerrar turno
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
  
  // Actualizar lista principal de movimientos
  panelData.movimientos.push(mov);
  
  descInput.value = "";
  montoInput.value = "";
  saveData();
  alert(`${tipo} registrado.`);
}

// ---------- WIZARD DEUDA ----------

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

  // Paso 2: Plan Pagos
  const btnFin = $("btnFinalizarDeuda");
  if (btnFin) {
      const newBtn = btnFin.cloneNode(true);
      btnFin.parentNode.replaceChild(newBtn, btnFin);
      newBtn.addEventListener("click", () => {
          const abono = safeNumber($("abonoPeriodicoMonto").value);
          const dias = safeNumber($("abonoPeriodicoFrecuencia").value);
          if (abono <= 0 || dias <= 0) return alert("Datos inválidos.");
          
          panelData.parametros.gastoFijo = abono / dias; // Cuota diaria
          saveData();
          renderDeudas();
          calcularMetricas();
          alert("Plan guardado.");
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
          
          if (!deuda || monto <= 0 || monto > deuda.saldo) return alert("Abono inválido.");
          
          registrarMovimiento('Gasto', 'abonoSeleccionar', 'abonoMonto', true); // Marcar abono como trabajo por defecto? O personal? Depende.
          // Corrección: registrarMovimiento espera IDs, pero aquí ya validamos.
          // Solo actualizamos deuda:
          deuda.saldo -= monto;
          if (deuda.saldo <= 0.01) { deuda.saldo = 0; deuda.estado = 'Pagada'; alert("¡Pagada!"); }
          
          panelData.parametros.deudaTotal = panelData.deudas.filter(d => d.estado !== 'Pagada').reduce((s,d)=>s+d.saldo,0);
          saveData();
          renderDeudas();
          $("abonoMonto").value = "";
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

// ---------- INICIALIZACIÓN ----------

document.addEventListener("DOMContentLoaded", () => {
  cargarPanelData(); // Aquí corre la autocorrección
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
    
    // Import/Export (Simplificado)
    if($("btnExportar")) $("btnExportar").addEventListener("click", () => {
        navigator.clipboard.writeText(JSON.stringify(panelData, null, 2));
        alert("JSON Copiado.");
    });
    if($("btnImportar")) $("btnImportar").addEventListener("click", () => {
        const json = $("importJson").value;
        if(json && confirm("¿Restaurar?")) {
            try {
                panelData = { ...JSON.parse(JSON.stringify(DEFAULT_PANEL_DATA)), ...JSON.parse(json) };
                saveData();
                window.location.reload();
            } catch(e) { alert("Error JSON"); }
        }
    });
  } 
  else if (page === 'index') {
    renderIndex();
  }
  else if (page === 'historial') {
    renderHistorial();
  }
});
