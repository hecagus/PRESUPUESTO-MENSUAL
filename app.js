const STORAGE_KEY = "panelData";
const $ = id => document.getElementById(id);
const TUTORIAL_COMPLETADO_KEY = "tutorialCompleto";

// Variables globales para instancias de Chart.js
let gananciasChart = null;
let kmChart = null;

// Global state for Debt Wizard
let deudaWizardStep = 1;

// Estructura base de datos
let panelData = {
  ingresos: [],
  gastos: [],
  kmDiarios: [],
  gasolina: [],
  deudas: [],
  movimientos: [],
  turnos: [],
  parametros: {
    deudaTotal: 0,
    gastoFijo: 0,
    ultimoKMfinal: null
  }
};

// Estado del turno
let turnoActivo = JSON.parse(localStorage.getItem("turnoActivo")) || false;
let turnoInicio = localStorage.getItem("turnoInicio") || null;

// ======================
// 1. CARGA Y GUARDADO
// ======================
function cargarPanelData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    panelData = { ...panelData, ...parsed };
    panelData.parametros = { ...panelData.parametros, ...(parsed.parametros || {}) };
  } catch (e) {
    console.error("Error al cargar panelData:", e);
  }
}

function guardarPanelData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(panelData));
  } catch (e) {
    console.error("Error guardando panelData:", e);
    alert("Error: No se pudo guardar en localStorage (¿Memoria llena?)");
  }
}

// Cargar datos al iniciar script
cargarPanelData();

// ======================
// 2. UTILIDADES
// ======================
const fmtMoney = n => Number(n || 0).toLocaleString("es-MX", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

// CORRECCIÓN: Función para obtener fecha local en formato YYYY-MM-DD correcto (evita error UTC)
const getLocalISODate = () => {
    const d = new Date();
    // Ajusta la fecha local a UTC para que toISOString devuelva la fecha correcta YYYY-MM-DD en el huso horario del usuario
    return new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString();
};

const nowISO = () => getLocalISODate();
const nowLocal = () => new Date().toLocaleString("es-MX");

// ======================
// 3. CÁLCULOS AUTOMÁTICOS
// ======================
function calcularDeudaTotalAuto() {
  const total = (panelData.deudas || []).reduce((s, d) => {
    return s + ((Number(d.monto) || 0) - (Number(d.abonado) || 0));
  }, 0);

  panelData.parametros.deudaTotal = total;
  const inp = $("proyDeudaTotal");
  if (inp) inp.value = total.toFixed(2);
}

function calcularGastoFijoAuto() {
  const comidaDiaria = 200; 
  const costoKmAsumido = 0.6; 

  const kmArr = panelData.kmDiarios || [];
  const kmProm = kmArr.length
    ? kmArr.reduce((s, k) => s + (Number(k.recorrido) || 0), 0) / kmArr.length
    : 0;

  let abonoSemanalProm = 0;
  let abonos = (panelData.gastos || []).filter(g => (g.categoria || "") === "Abono a Deuda");
  if (abonos.length > 0) {
      // Tomamos el promedio de los últimos 4 abonos (aproximación)
      const ultimosAbonos = abonos.slice(-4).reduce((s, g) => s + (Number(g.cantidad) || 0), 0);
      abonoSemanalProm = ultimosAbonos / (Math.min(abonos.length, 4));
  }
  
  // Fórmula: (Abono semanal aprox / 6 días) + Comida + (KM prom * costo)
  const gastoFijo = (abonoSemanalProm / 6) + comidaDiaria + (kmProm * costoKmAsumido);

  panelData.parametros.gastoFijo = gastoFijo;
  
  const inp = $("proyGastoFijo");
  if (inp) inp.value = gastoFijo.toFixed(2);
}

function pushMovimiento(tipo, descripcion, monto) {
  panelData.movimientos.unshift({
    tipo,
    descripcion,
    monto: Number(monto),
    fechaISO: nowISO(),
    fechaLocal: nowLocal()
  });

  // Mantener historial limpio (últimos 300)
  if (panelData.movimientos.length > 300) {
    panelData.movimientos.length = 300;
  }
}

// ======================
// 4. LISTENERS (ADMIN)
// ======================
function setupIngresoListeners() {
  $("btnGuardarIngreso")?.addEventListener("click", () => {
    const desc = ($("ingresoDescripcion")?.value || "").trim();
    const qty = Number($("ingresoCantidad")?.value || 0);

    if (!desc || qty <= 0) return alert("Completa descripción y monto positivo.");

    panelData.ingresos.push({
      descripcion: desc,
      cantidad: qty,
      fechaISO: nowISO(),
      fechaLocal: nowLocal()
    });

    pushMovimiento("Ingreso", desc, qty);
    guardarPanelData();

    $("ingresoDescripcion").value = "";
    $("ingresoCantidad").value = "";

    alert("Ingreso registrado.");
  });
}

function setupGastoListeners() {
  $("btnGuardarGasto")?.addEventListener("click", () => {
    const desc = ($("gastoDescripcion")?.value || "").trim();
    const qty = Number($("gastoCantidad")?.value || 0);
    const cat = $("gastoCategoria")?.value || "Otros";

    if (!desc || qty <= 0) return alert("Datos de gasto inválidos.");

    panelData.gastos.push({
      descripcion: desc,
      cantidad: qty,
      categoria: cat,
      fechaISO: nowISO(),
      fechaLocal: nowLocal()
    });

    if (["Comida", "Transporte", "Mantenimiento"].includes(cat)) {
      calcularGastoFijoAuto();
    }

    pushMovimiento("Gasto", `${desc} (${cat})`, qty);
    guardarPanelData();

    $("gastoDescripcion").value = "";
    $("gastoCantidad").value = "";

    alert("Gasto registrado.");
  });
}

// ======================
// 5. WIZARD DEUDAS Y RENDER
// ======================
function updateDeudaWizardUI() {
    const steps = [
        $("deudaStep1"),
        $("deudaStep2"),
        $("deudaStep3"),
        $("deudaStep4")
    ];

    steps.forEach((step, index) => {
        if (step) {
            step.style.display = (index + 1 === deudaWizardStep) ? "block" : "none";
        }
    });

    const finalBtn = $("btnRegistrarDeudaFinal");
    if (finalBtn) finalBtn.style.display = (deudaWizardStep === 4) ? "inline-block" : "none";

    const nextBtn = $("btnDeudaNext");
    const backBtn = $("btnDeudaBack");

    if (nextBtn) nextBtn.style.display = (deudaWizardStep < 4) ? "inline-block" : "none";
    if (backBtn) backBtn.style.display = (deudaWizardStep > 1) ? "inline-block" : "none";
}

function nextDeudaStep() {
    // Validación antes de avanzar
    switch (deudaWizardStep) {
        case 1:
            const nombre = ($("deudaNombre")?.value || "").trim();
            if (!nombre) return alert("Ingresa el Nombre de la deuda (Ej. Banco, Moto).");
            break;
        case 2:
            const monto = Number($("deudaMonto")?.value || 0);
            if (monto <= 0) return alert("Ingresa un Monto Total positivo.");
            break;
        case 3:
            const frecuencia = ($("deudaFrecuencia")?.value || "").trim();
            if (!frecuencia) return alert("Selecciona la Frecuencia de pago.");
            break;
    }

    if (deudaWizardStep < 4) {
        deudaWizardStep++;
        updateDeudaWizardUI();
    }
}

function prevDeudaStep() {
    if (deudaWizardStep > 1) {
        deudaWizardStep--;
        updateDeudaWizardUI();
    }
}

function renderDeudas() {
  const list = $("listaDeudas");
  const select = $("abonoSeleccionar");

  if (!list || !select) return;

  list.innerHTML = "";
  select.innerHTML = "";
  let hayPendientes = false;
  
  const deudasPendientes = [];

  panelData.deudas.forEach((d) => {
    const pendiente = (Number(d.monto) || 0) - (Number(d.abonado) || 0);

    // ************* NUEVA LÓGICA DE ELIMINACIÓN *************
    if (pendiente <= 0.01) {
        // Muestra felicitación una sola vez antes de la eliminación
        if (!d.liquidada) {
            alert(`🎉 ¡Felicidades! Has liquidado tu deuda: ${d.nombre}.`);
            d.liquidada = true; 
        }
        return; 
    }
    d.liquidada = false;
    deudasPendientes.push(d);
    // *******************************************************
    
    // Muestra la frecuencia y el abono sugerido (si existen)
    let infoAbono = "";
    if (d.frecuencia && d.abonoSugerido && d.abonoSugerido > 0) {
        infoAbono = `<br><span style="color:#007bff; font-size:0.9em;">Pago: $${fmtMoney(d.abonoSugerido)} ${d.frecuencia}</span>`;
    }

    list.innerHTML += `
      <li>
        <strong>${d.nombre}</strong><br>
        Total: $${fmtMoney(d.monto)} | Pagado: $${fmtMoney(d.abonado)}<br>
        <span style="color:${pendiente > 0 ? '#dc3545' : '#28a745'}">
            Pendiente: <strong>$${fmtMoney(pendiente)}</strong>
        </span>
        ${infoAbono}
      </li>
    `;

    // Solo se agregan al select si hay un saldo pendiente
    const opt = document.createElement("option");
    // El 'value' es el índice de la deuda en el nuevo array 'deudasPendientes'
    opt.value = deudasPendientes.length - 1; 
    opt.textContent = `${d.nombre} — $${fmtMoney(pendiente)} pendiente`;
    select.appendChild(opt);
    hayPendientes = true;
  });

  // ************* REEMPLAZAR panelData.deudas *************
  panelData.deudas = deudasPendientes; 
  guardarPanelData(); // Guardar el estado limpio de deudas liquidadas
  // *******************************************************

  if (panelData.deudas.length === 0) list.innerHTML = "<li>No hay deudas registradas.</li>";
  if (!hayPendientes) select.innerHTML = `<option value="">-- Sin deudas pendientes --</option>`;
}

function setupDeudaListeners() {
    // Listeners para la navegación del Wizard
    $("btnDeudaNext")?.addEventListener("click", nextDeudaStep);
    $("btnDeudaBack")?.addEventListener("click", prevDeudaStep);
    
    // El botón final del Wizard 
    $("btnRegistrarDeudaFinal")?.addEventListener("click", () => {
        const nombre = ($("deudaNombre")?.value || "").trim();
        const monto = Number($("deudaMonto")?.value || 0);
        const frecuencia = ($("deudaFrecuencia")?.value || "").trim();
        const abonoSugerido = Number($("deudaAbonoSugerido")?.value || 0);

        if (!nombre || monto <= 0 || !frecuencia || abonoSugerido < 0) {
            return alert("Faltan datos o son inválidos para registrar la deuda.");
        }

        // Nueva estructura de deuda
        panelData.deudas.push({ 
            nombre, 
            monto, 
            abonado: 0, 
            frecuencia, 
            abonoSugerido 
        });

        calcularDeudaTotalAuto();
        guardarPanelData();
        renderDeudas();

        // Limpiar y resetear el wizard
        $("deudaNombre").value = "";
        $("deudaMonto").value = "";
        $("deudaFrecuencia").value = "";
        $("deudaAbonoSugerido").value = "";
        deudaWizardStep = 1;
        updateDeudaWizardUI();

        alert("Deuda registrada (Wizard completado).");
    });

    // Lógica para registrar un abono
    $("btnRegistrarAbono")?.addEventListener("click", () => {
      const idx = $("abonoSeleccionar")?.value;
      const monto = Number($("abonoMonto")?.value || 0);

      if (idx === "" || monto <= 0) return alert("Selecciona deuda y monto válido.");

      const deuda = panelData.deudas[idx];
      const pendiente = deuda.monto - deuda.abonado;

      if(monto > pendiente + 0.01) return alert(`El abono excede el saldo ($${fmtMoney(pendiente)}).`);
      
      deuda.abonado += monto;

      // Registrar también como Gasto
      panelData.gastos.push({
        descripcion: `Abono a ${deuda.nombre}`,
        cantidad: monto,
        categoria: "Abono a Deuda",
        fechaISO: nowISO(),
        fechaLocal: nowLocal()
      });

      pushMovimiento("Gasto", `Abono a ${deuda.nombre}`, monto);
      
      calcularDeudaTotalAuto();
      calcularGastoFijoAuto();
      guardarPanelData();
      renderDeudas(); // Esto actualizará la lista y eliminará si el saldo es 0.

      $("abonoMonto").value = "";
      alert("Abono registrado correctamente.");
    });
}

function setupKmAndGasListeners() {
  $("kmFinal")?.addEventListener("input", () => {
    const ini = Number($("kmInicial")?.value || 0);
    const fin = Number($("kmFinal")?.value || 0);
    const rec = (fin > ini) ? (fin - ini) : 0;
    if ($("kmRecorridos")) $("kmRecorridos").textContent = rec;
  });

  $("btnGuardarKm")?.addEventListener("click", () => {
    const ini = Number($("kmInicial")?.value || 0);
    const fin = Number($("kmFinal")?.value || 0);
    
    if (fin <= ini || ini <= 0) return alert("Revisa los valores del odómetro. El KM final debe ser mayor que el inicial.");

    const recorrido = fin - ini;

    panelData.kmDiarios.push({
      fechaISO: nowISO(),
      fechaLocal: nowLocal(),
      kmInicial: ini,
      kmFinal: fin,
      recorrido: recorrido
    });

    panelData.parametros.ultimoKMfinal = fin;
    guardarPanelData();
    calcularGastoFijoAuto();

    // UX: Limpiar y preparar para el siguiente día
    $("kmInicial").value = fin; 
    $("kmFinal").value = "";
    $("kmRecorridos").textContent = "0";

    alert(`Se guardaron ${recorrido} KM recorridos.`);
  });

  $("btnGuardarGas")?.addEventListener("click", () => {
    const litros = Number($("litrosGas")?.value || 0);
    const costo = Number($("costoGas")?.value || 0);

    if (litros <= 0 || costo <= 0) return alert("Datos de gasolina inválidos.");

    panelData.gasolina.push({
      fechaISO: nowISO(),
      fechaLocal: nowLocal(),
      litros,
      costo
    });

    panelData.gastos.push({
      descripcion: `Gasolina ${litros}L`,
      cantidad: costo,
      categoria: "Transporte",
      fechaISO: nowISO(),
      fechaLocal: nowLocal()
    });

    pushMovimiento("Gasto", `Gasolina ${litros}L`, costo);
    guardarPanelData();

    $("litrosGas").value = "";
    $("costoGas").value = "";
    alert("Carga de gasolina guardada.");
  });
}

function exportToExcel() {
    if (typeof XLSX === 'undefined') {
        return alert("Error: La librería XLSX (admin.html) no está cargada.");
    }

    const { ingresos, gastos, kmDiarios, gasolina, deudas, movimientos, turnos } = panelData;
    
    // Preparar hojas
    const dataForSheet = {
        Ingresos: ingresos,
        Gastos: gastos,
        KmDiarios: kmDiarios,
        Gasolina: gasolina,
        // Incluir la nueva información de deudas en el backup
        Deudas: deudas.map(d => ({ 
            ...d, 
            pendiente: d.monto - d.abonado,
            frecuencia: d.frecuencia || 'N/A',
            abonoSugerido: d.abonoSugerido || 0 
        })),
        Turnos: turnos,
        Movimientos: movimientos
    };
    
    const wb = XLSX.utils.book_new();

    Object.keys(dataForSheet).forEach(sheetName => {
        if (dataForSheet[sheetName].length > 0) {
            const ws = XLSX.utils.json_to_sheet(dataForSheet[sheetName]);
            XLSX.utils.book_append_sheet(wb, ws, sheetName);
        }
    });

    const fileName = `UberTracker_Backup_${new Date().toISOString().slice(0,10)}.xlsx`;
    XLSX.writeFile(wb, fileName);
}

function setupIoListeners() {
    $("btnExportar")?.addEventListener("click", () => {
      const json = JSON.stringify(panelData, null, 2);
      navigator.clipboard.writeText(json)
        .then(() => alert("JSON copiado al portapapeles."))
        .catch(err => {
            console.error(err);
            alert("No se pudo copiar. Usa exportar Excel.");
        });
    });
    
    $("btnExportarExcel")?.addEventListener("click", exportToExcel); 

    $("btnImportar")?.addEventListener("click", () => {
      const raw = ($("importJson")?.value || "").trim();
      if (!raw) return alert("Pega el JSON primero.");

      try {
        const parsed = JSON.parse(raw);
        // Validación básica
        if(!parsed.ingresos || !parsed.gastos || !parsed.turnos) throw new Error("Formato incorrecto");

        panelData = { ...panelData, ...parsed };
        guardarPanelData();
        
        $("importJson").value = "";
        alert("Datos importados con éxito. La página se recargará.");
        location.reload(); 

      } catch (e) {
        alert("JSON inválido o corrupto.");
      }
    });
}

// ======================
// 6. GESTIÓN DE TURNOS
// ======================
function actualizarUIturno() {
  const iniBtn = $("btnIniciarTurno");
  const finBtn = $("btnFinalizarTurno");
  const txt = $("turnoTexto");

  if (!iniBtn || !finBtn || !txt) return;

  if (turnoActivo) {
    iniBtn.style.display = "none";
    finBtn.style.display = "inline-block";
    const fechaInicio = new Date(turnoInicio).toLocaleString("es-MX");
    txt.textContent = `🟢 Turno activo desde: ${fechaInicio}`;
    txt.style.color = "var(--success)";
  } else {
    iniBtn.style.display = "inline-block";
    finBtn.style.display = "none";
    txt.textContent = "🔴 Sin turno activo";
    txt.style.color = "var(--danger)";
  }
}

function iniciarTurno() {
  if (turnoActivo) return;

  turnoActivo = true;
  turnoInicio = new Date().toISOString(); 

  localStorage.setItem("turnoActivo", "true");
  localStorage.setItem("turnoInicio", turnoInicio);

  actualizarUIturno();
  alert("¡Buen trabajo! Turno iniciado.");
}

function finalizarTurno() {
  if (!turnoActivo) return;

  const inicioDate = new Date(turnoInicio);
  const finDate = new Date();
  const diffMs = finDate - inicioDate;
  const horas = Number((diffMs / 3600000).toFixed(2));

  // CORRECCIÓN: Manejo de cancelación del prompt y validación estricta de ganancia
  let ganStr = prompt(`Turno finalizado (${horas} horas).\nIngresa la GANANCIA BRUTA generada (MXN):`);
  
  if (ganStr === null) {
      // El usuario dio 'Cancelar'. No se cierra el turno, se retorna.
      return alert("Cierre de turno cancelado. El turno sigue activo.");
  }

  const gan = Number(ganStr);
  if (isNaN(gan) || gan < 0 || ganStr.trim() === "") {
      return alert("Monto inválido. El turno NO se ha cerrado. Intenta de nuevo.");
  }
  
  // Guardar datos
  panelData.turnos.push({
    inicio: turnoInicio,
    fin: finDate.toISOString(),
    horas,
    ganancia: gan
  });

  // Registrar también como ingreso general
  panelData.ingresos.push({
    descripcion: `Ganancia turno (${horas}h)`,
    cantidad: gan,
    fechaISO: nowISO(),
    fechaLocal: nowLocal()
  });

  pushMovimiento("Ingreso", `Cierre Turno`, gan);

  // Reset estados
  turnoActivo = false;
  turnoInicio = null;
  localStorage.setItem("turnoActivo", "false");
  localStorage.removeItem("turnoInicio");

  guardarPanelData();
  actualizarUIturno();

  // Si estamos en index, refrescar vista
  if ($("resHoras")) renderResumenIndex();
  
  alert("Turno finalizado y guardado.");
}

// ======================
// 7. RENDERIZADO (INDEX)
// ======================
function calcularResumenDatos() {
  // Obtenemos fecha ISO local YYYY-MM-DD
  const hoy = getLocalISODate().slice(0, 10);

  const turnosHoy = (panelData.turnos || []).filter(t => (t.inicio || "").startsWith(hoy));
  const gastosHoy = (panelData.gastos || []).filter(g => (g.fechaISO || "").startsWith(hoy));

  const horasHoy = turnosHoy.reduce((s, t) => s + (Number(t.horas) || 0), 0);
  const ganHoy   = turnosHoy.reduce((s, t) => s + (Number(t.ganancia) || 0), 0);
  const gastHoy  = gastosHoy.reduce((s, g) => s + (Number(g.cantidad) || 0), 0);

  return { horasHoy, ganHoy, gastHoy };
}

function aggregateDailyData() {
  const data = {};

  const process = (entry, type, keyMonto) => {
    let fecha = entry.fechaISO || entry.inicio;
    if(!fecha) return;
    const dia = fecha.slice(0, 10);

    if (!data[dia]) data[dia] = { date: dia, ingresos: 0, gastos: 0, km: 0 };
    data[dia][type] += (Number(entry[keyMonto]) || 0);
  };
  
  // Se usan 'turnos' para ingresos y 'gastos' para gastos
  (panelData.turnos || []).forEach(t => process(t, 'ingresos', 'ganancia'));
  (panelData.gastos || []).forEach(g => process(g, 'gastos', 'cantidad'));
  (panelData.kmDiarios || []).forEach(k => process(k, 'km', 'recorrido'));

  return Object.values(data).sort((a, b) => a.date.localeCompare(b.date));
}

function renderTablaKmMensual() {
    const container = $("tablaKmMensual"); 
    if (!container) return;

    const stats = {};

    // Agrupar KM
    (panelData.kmDiarios || []).forEach(k => {
        const mes = (k.fechaISO || "").slice(0, 7); // YYYY-MM
        if (!mes) return;
        if (!stats[mes]) stats[mes] = { km: 0, gas: 0 };
        stats[mes].km += (Number(k.recorrido) || 0);
    });

    // Agrupar Gasolina (se asume que se registró como 'Transporte' y 'Gasolina')
    (panelData.gastos || []).forEach(g => {
        if (g.categoria === "Transporte" && g.descripcion.toLowerCase().includes("gasolina")) { 
            const mes = (g.fechaISO || "").slice(0, 7);
            if (!mes) return;
            if (!stats[mes]) stats[mes] = { km: 0, gas: 0 };
            stats[mes].gas += (Number(g.cantidad) || 0);
        }
    });

    const rows = Object.entries(stats)
        .sort((a,b) => b[0].localeCompare(a[0])) // Ordenar por mes descendente
        .map(([mes, d]) => {
            const costoKm = d.km > 0 ? d.gas / d.km : 0;
            return `
                <tr>
                    <td>${mes}</td>
                    <td>${d.km.toFixed(0)} km</td>
                    <td>$${fmtMoney(d.gas)}</td>
                    <td>$${costoKm.toFixed(2)}</td>
                </tr>`;
        }).join("");

    container.innerHTML = `
        <table class="tabla">
            <thead><tr><th>Mes</th><th>KM</th><th>Gasolina</th><th>$/KM</th></tr></thead>
            <tbody>${rows || '<tr><td colspan="4" style="text-align:center">Sin datos</td></tr>'}</tbody>
        </table>`;
}

function renderTablaTurnos() {
  const tbody = $("tablaTurnos");
  if (!tbody) return;

  const ultimos = [...(panelData.turnos || [])].reverse().slice(0, 10); // Solo ultimos 10

  tbody.innerHTML = ultimos.map(t => {
      const fecha = (t.inicio || "").slice(0, 10);
      return `
        <tr>
            <td>${fecha}</td>
            <td>${Number(t.horas).toFixed(1)}h</td>
            <td>$${fmtMoney(t.ganancia)}</td>
        </tr>
      `;
  }).join("") || `<tr><td colspan="3" style="text-align:center">No hay turnos recientes</td></tr>`;
}

function renderCharts() {
  const ctxGan = $("graficaGanancias");
  const ctxKm = $("graficaKm");
  
  if (!ctxGan && !ctxKm) return; 

  const data = aggregateDailyData().slice(-14); // Últimos 14 días
  const labels = data.map(d => d.date.slice(5)); // MM-DD

  if (ctxGan) {
    if (gananciasChart) gananciasChart.destroy();
    gananciasChart = new Chart(ctxGan, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Ingreso', data: data.map(d => d.ingresos), backgroundColor: '#28a745' },
          { label: 'Gasto', data: data.map(d => d.gastos), backgroundColor: '#dc3545' }
        ]
      },
      options: { responsive: true, plugins: { legend: { position: 'top' } } }
    });
  }

  if (ctxKm) {
    if (kmChart) kmChart.destroy();
    kmChart = new Chart(ctxKm, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Kilómetros',
          data: data.map(d => d.km),
          borderColor: '#007bff',
          tension: 0.3,
          fill: true,
          backgroundColor: 'rgba(0,123,255,0.1)'
        }]
      },
      options: { responsive: true }
    });
  }
}

function renderProyecciones() {
    const p = panelData.parametros;
    if ($("proyDeuda")) $("proyDeuda").textContent = `$${fmtMoney(p.deudaTotal)}`;
    
    // Calcular promedio neto diario real
    const totalGan = panelData.turnos.reduce((s,t) => s + (t.ganancia||0), 0);
    const diasTrabajados = new Set(panelData.turnos.map(t => t.inicio.slice(0,10))).size || 1;
    const promIngreso = totalGan / diasTrabajados;
    
    // Estimación neta (Ingreso - Gasto Fijo)
    const netoDiario = promIngreso - (p.gastoFijo || 0);
    
    if ($("proyNeta")) $("proyNeta").textContent = `$${fmtMoney(netoDiario)}`;
    
    if ($("proyDias")) {
        if(netoDiario <= 0) {
             $("proyDias").textContent = "Infinito (Mejora tus ingresos)";
        } else {
             const dias = Math.ceil(p.deudaTotal / netoDiario);
             $("proyDias").textContent = `${dias} días aprox.`;
        }
    }
}

function renderResumenIndex() {
  if (!$("resHoras")) return; 

  const r = calcularResumenDatos();
  $("resHoras").textContent = r.horasHoy.toFixed(2);
  $("resGananciaBruta").textContent = `$${fmtMoney(r.ganHoy)}`;
  $("resGastos").textContent = `$${fmtMoney(r.gastHoy)}`;
  $("resNeta").textContent = `$${fmtMoney(r.ganHoy - r.gastHoy)}`;

  renderTablaTurnos();
  renderTablaKmMensual();
  renderCharts();
  renderProyecciones();
}

// ======================
// 8. TUTORIAL
// ======================
const tutorialSteps = [
    { title: "Bienvenido", text: "Te daré un tour rápido.", targetId: null },
    { title: "Resumen", text: "Aquí verás tu balance del día actual.", targetId: "cardResumen" },
    { title: "Administración", text: "Registra aquí ingresos, gastos y turnos. Click para ir al panel.", targetId: "adminButton", action: () => location.href = "admin.html" },
    { title: "Turnos", text: "Inicia y finaliza tu jornada aquí.", targetId: "cardTurnos" },
    // El target de Deudas ahora es el contenedor principal del wizard en admin.html
    { title: "Deudas", text: "Controla lo que debes, registra tus pagos y da de alta nuevas deudas por pasos.", targetId: "deudaWizardContainer" }, 
    { title: "Respaldo", text: "Descarga tus datos en Excel frecuentemente.", targetId: "btnExportarExcel" }
];

let currentStep = 0;

function showTutorialStep() {
    const step = tutorialSteps[currentStep];
    const modal = $("tutorialModal");
    const overlay = $("tutorialOverlay");
    
    if (!modal) return;

    // Limpiar highlights previos
    document.querySelectorAll(".tutorial-highlight").forEach(e => e.classList.remove("tutorial-highlight"));

    $("tutorialTitle").textContent = step.title;
    $("tutorialText").textContent = step.text;
    $("tutorialNextBtn").textContent = (currentStep === tutorialSteps.length - 1) ? "Finalizar" : "Siguiente";

    modal.style.display = "block";
    overlay.style.display = "block";
    
    setTimeout(() => {
        modal.style.opacity = "1";
        overlay.style.opacity = "1";
    }, 10);

    const target = step.targetId ? $(step.targetId) : null;
    
    if (target && target.offsetParent !== null) { 
        target.classList.add("tutorial-highlight");
        target.scrollIntoView({ behavior: "smooth", block: "center" });
        
        const rect = target.getBoundingClientRect();
        let top = rect.bottom + window.scrollY + 10;
        
        if (top + 200 > document.body.scrollHeight) {
            top = rect.top + window.scrollY - 220;
        }

        modal.style.top = `${top}px`;
        modal.style.left = "50%";
        modal.style.transform = "translateX(-50%)";
    } else {
        // Centrado por defecto
        modal.style.top = "50%";
        modal.style.left = "50%";
        modal.style.transform = "translate(-50%, -50%)";
    }
}

function nextStep() {
    const step = tutorialSteps[currentStep];
    
    if (step.action) {
        step.action(); 
        return; 
    }

    currentStep++;
    if (currentStep >= tutorialSteps.length) {
        localStorage.setItem(TUTORIAL_COMPLETADO_KEY, "true");
        $("tutorialOverlay").style.display = "none";
        $("tutorialModal").style.display = "none";
        alert("¡Tutorial completo! A trabajar.");
    } else {
        showTutorialStep();
    }
}

function initTutorial() {
    if (localStorage.getItem(TUTORIAL_COMPLETADO_KEY) === "true") return;

    // Ajustar el paso inicial si ya estamos en admin
    if (document.title.includes("Administración") && currentStep < 3) {
        currentStep = 3; 
    }

    $("tutorialNextBtn")?.addEventListener("click", nextStep);
    showTutorialStep();
}

// ======================
// 9. INIT
// ======================
document.addEventListener("DOMContentLoaded", () => {
    setupIngresoListeners();
    setupGastoListeners();
    setupDeudaListeners();
    setupKmAndGasListeners();
    setupIoListeners();

    $("btnIniciarTurno")?.addEventListener("click", iniciarTurno);
    $("btnFinalizarTurno")?.addEventListener("click", finalizarTurno);

    actualizarUIturno();
    renderDeudas();
    
    // Iniciar vista del wizard de deudas (AHORA FUNCIONARÁ)
    updateDeudaWizardUI(); 

    // Cargar parámetros en UI
    calcularDeudaTotalAuto();
    calcularGastoFijoAuto();

    // Rellenar KM inicial si existe historial
    if ($("kmInicial") && panelData.parametros.ultimoKMfinal !== null) {
        $("kmInicial").value = panelData.parametros.ultimoKMfinal;
    }

    // Renderizar dashboard si estamos en index
    renderResumenIndex();

    // Iniciar tutorial
    initTutorial();
});
