const STORAGE_KEY = "panelData";
const $ = id => document.getElementById(id);
const TUTORIAL_COMPLETADO_KEY = "tutorialCompleto";

// Declaración ÚNICA de variables globales para las gráficas (FIX 1: Eliminada duplicidad)
let gananciasChart = null;
let kmChart = null;

// Estructura base
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

// Turno activo
let turnoActivo = JSON.parse(localStorage.getItem("turnoActivo")) || false;
let turnoInicio = localStorage.getItem("turnoInicio") || null;

// ======================
// Cargar / Guardar
// ======================
function cargarPanelData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    panelData = Object.assign({}, panelData, parsed);
    panelData.parametros = Object.assign({}, panelData.parametros, (parsed.parametros || {}));
  } catch (e) {
    console.error("Error al cargar panelData:", e);
  }
}

function guardarPanelData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(panelData));
  } catch (e) {
    console.error("Error guardando panelData:", e);
  }
}

cargarPanelData(); // Cargar al inicio

// ======================
// Utilidades
// ======================
const fmtMoney = n => Number(n || 0).toLocaleString("es-MX", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const nowISO = () => new Date().toISOString();
const nowLocal = () => new Date().toLocaleString("es-MX");

// ======================
// CÁLCULOS AUTOMÁTICOS
// ======================
function calcularDeudaTotalAuto() {
  const total = (panelData.deudas || []).reduce((s, d) => {
    return s + ((Number(d.monto) || 0) - (Number(d.abonado) || 0));
  }, 0);

  panelData.parametros.deudaTotal = total;
  guardarPanelData();

  const inp = $("proyDeudaTotal");
  if (inp) inp.value = total.toFixed(2);
}

function calcularGastoFijoAuto() {
  const comidaDiaria = 200; 
  const costoKmAsumido = 0.6; // Valor asumido para proyección

  const kmArr = panelData.kmDiarios || [];
  const kmProm = kmArr.length
    ? kmArr.reduce((s, k) => s + (Number(k.recorrido) || 0), 0) / kmArr.length
    : 0;

  let ultimoAbono = 0;
  let ultimaFecha = 0;

  (panelData.gastos || []).forEach(g => {
    if ((g.categoria || "") === "Abono a Deuda") {
      const t = new Date(g.fechaISO || g.fechaLocal).getTime();
      if (!ultimaFecha || t > ultimaFecha) {
        ultimaFecha = t;
        ultimoAbono = Number(g.cantidad) || 0;
      }
    }
  });

  // Fórmula: (Abono mensual / 6 días) + Gasto de comida + (KM promedio * costo por KM asumido)
  const gastoFijo = (ultimoAbono / 6) + comidaDiaria + (kmProm * costoKmAsumido);

  panelData.parametros.gastoFijo = gastoFijo;
  guardarPanelData();

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

  if (panelData.movimientos.length > 300) {
    panelData.movimientos.length = 300;
  }

  guardarPanelData();
}

// ======================
// REGISTROS (Admin)
// ======================
function setupIngresoListeners() {
  $("btnGuardarIngreso")?.addEventListener("click", () => {
    const desc = ($("ingresoDescripcion")?.value || "").trim();
    const qty = Number($("ingresoCantidad")?.value || 0);

    if (!desc || !qty || qty <= 0)
      return alert("Completa correctamente los datos del ingreso.");

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
    renderResumenIndex(); // FIX 6: Re-render
  });
}

function setupGastoListeners() {
  $("btnGuardarGasto")?.addEventListener("click", () => {
    const desc = ($("gastoDescripcion")?.value || "").trim();
    const qty = Number($("gastoCantidad")?.value || 0);
    const cat = $("gastoCategoria")?.value || "Otros";

    if (!desc || !qty || qty <= 0) return alert("Datos de gasto inválidos.");

    panelData.gastos.push({
      descripcion: desc,
      cantidad: qty,
      categoria: cat,
      fechaISO: nowISO(),
      fechaLocal: nowLocal()
    });

    if (cat === "Comida" || cat === "Transporte" || cat === "Mantenimiento") {
      calcularGastoFijoAuto();
    }

    pushMovimiento("Gasto", `${desc} (${cat})`, qty);
    guardarPanelData();

    $("gastoDescripcion").value = "";
    $("gastoCantidad").value = "";

    alert("Gasto registrado.");
    renderResumenIndex(); // FIX 6: Re-render
  });
}

function renderDeudas() {
  const list = $("listaDeudas");
  const select = $("abonoSeleccionar");

  if (!list || !select) return;

  list.innerHTML = "";
  select.innerHTML = "";

  panelData.deudas.forEach((d, idx) => {
    const pendiente = (Number(d.monto) || 0) - (Number(d.abonado) || 0);

    list.innerHTML += `
      <li>
        <strong>${d.nombre}</strong><br>
        Total: $${fmtMoney(d.monto)}<br>
        Pagado: $${fmtMoney(d.abonado || 0)}<br>
        Pendiente: <strong>$${fmtMoney(pendiente)}</strong>
      </li>
    `;

    if (pendiente > 0) {
        const opt = document.createElement("option");
        opt.value = idx;
        opt.textContent = `${d.nombre} — $${fmtMoney(pendiente)} pendiente`;
        select.appendChild(opt);
    }
  });

  if (panelData.deudas.length === 0) {
    list.innerHTML = "<li>No hay deudas registradas.</li>";
  }
  
  if (select.children.length === 0) {
    select.innerHTML = `<option value="">-- No hay deudas pendientes --</option>`;
  }
}

function setupDeudaListeners() {
    $("btnRegistrarDeuda")?.addEventListener("click", () => {
      const nombre = ($("deudaNombre")?.value || "").trim();
      const monto = Number($("deudaMonto")?.value || 0);

      if (!nombre || !monto || monto <= 0) return alert("Datos inválidos.");

      panelData.deudas.push({ nombre, monto, abonado: 0 });

      guardarPanelData();
      renderDeudas();

      calcularDeudaTotalAuto();
      calcularGastoFijoAuto();

      $("deudaNombre").value = "";
      $("deudaMonto").value = "";

      alert("Deuda registrada.");
    });

    $("btnRegistrarAbono")?.addEventListener("click", () => {
      const idx = $("abonoSeleccionar")?.value;
      const monto = Number($("abonoMonto")?.value || 0);

      if (idx === "" || !idx || monto <= 0) return alert("Datos inválidos.");

      const deuda = panelData.deudas[idx];
      const pendiente = (Number(deuda.monto) || 0) - (Number(deuda.abonado) || 0);

      if(monto > pendiente) return alert(`El abono excede el saldo pendiente de $${fmtMoney(pendiente)}.`);
      
      deuda.abonado = (Number(deuda.abonado) || 0) + monto;

      panelData.gastos.push({
        descripcion: `Abono a ${deuda.nombre}`,
        cantidad: monto,
        categoria: "Abono a Deuda",
        fechaISO: nowISO(),
        fechaLocal: nowLocal()
      });

      pushMovimiento("Gasto", `Abono a ${deuda.nombre}`, monto);

      guardarPanelData();
      renderDeudas();
      calcularDeudaTotalAuto();
      calcularGastoFijoAuto();
      renderResumenIndex(); // FIX 6: Re-render

      $("abonoMonto").value = "";
      alert("Abono guardado.");
    });
}

function setupKmAndGasListeners() {
  $("kmFinal")?.addEventListener("input", () => {
    const ini = Number($("kmInicial")?.value || 0);
    const fin = Number($("kmFinal")?.value || 0);
    const rec = fin > ini ? fin - ini : 0;
    if ($("kmRecorridos")) $("kmRecorridos").textContent = rec;
  });

  $("btnGuardarKm")?.addEventListener("click", () => {
    const ini = Number($("kmInicial")?.value || 0);
    const fin = Number($("kmFinal")?.value || 0);
    if (isNaN(ini) || isNaN(fin) || fin <= ini) return alert("KM inicial/final inválidos o Final es menor/igual a Inicial.");

    panelData.kmDiarios.push({
      fechaISO: nowISO(),
      fechaLocal: nowLocal(),
      kmInicial: ini,
      kmFinal: fin,
      recorrido: fin - ini
    });

    panelData.parametros.ultimoKMfinal = fin;
    guardarPanelData();

    calcularGastoFijoAuto();

    $("kmInicial").value = "";
    $("kmFinal").value = "";
    $("kmRecorridos").textContent = "0";

    alert("Kilometraje guardado.");
    
    if ($("kmInicial")) $("kmInicial").value = fin;
    renderResumenIndex(); // FIX 6: Re-render
  });

  $("btnGuardarGas")?.addEventListener("click", () => {
    const litros = Number($("litrosGas")?.value || 0);
    const costo = Number($("costoGas")?.value || 0);

    if (!litros || !costo || litros <= 0 || costo <= 0) return alert("Datos inválidos.");

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
    alert("Repostaje guardado.");
    renderResumenIndex(); // FIX 6: Re-render
  });
}

function exportToExcel() {
    if (typeof XLSX === 'undefined') {
        return alert("Error: La librería SheetJS (XLSX) no está cargada. Asegúrate de incluir el script en admin.html.");
    }

    const { ingresos, gastos, kmDiarios, gasolina, deudas, movimientos, turnos } = panelData;
    const dataForSheet = {
        Ingresos: ingresos.map(i => ({ Fecha: i.fechaLocal, Descripción: i.descripcion, Cantidad: i.cantidad })),
        Gastos: gastos.map(g => ({ Fecha: g.fechaLocal, Categoría: g.categoria, Descripción: g.descripcion, Cantidad: g.cantidad })),
        KmDiarios: kmDiarios.map(k => ({ Fecha: k.fechaLocal, 'KM Inicial': k.kmInicial, 'KM Final': k.kmFinal, Recorrido: k.recorrido })),
        Gasolina: gasolina.map(g => ({ Fecha: g.fechaLocal, Litros: g.litros, Costo: g.costo })),
        Deudas: deudas.map(d => ({ Nombre: d.nombre, Monto: d.monto, Abonado: d.abonado, Pendiente: d.monto - d.abonado })),
        Movimientos: movimientos.map(m => ({ Fecha: m.fechaLocal, Tipo: m.tipo, Descripción: m.descripcion, Monto: m.monto })),
        Turnos: turnos.map(t => ({ Inicio: new Date(t.inicio).toLocaleString("es-MX"), Fin: new Date(t.fin).toLocaleString("es-MX"), Horas: t.horas, Ganancia: t.ganancia })),
    };
    
    const wb = XLSX.utils.book_new();

    Object.keys(dataForSheet).forEach(sheetName => {
        const ws = XLSX.utils.json_to_sheet(dataForSheet[sheetName]);
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });

    const fileName = `backup_ubereats_tracker_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, fileName);
    alert(`Archivo ${fileName} generado correctamente.`);
}

function setupIoListeners() {
    $("btnExportar")?.addEventListener("click", () => {
      // ... (export logic)
      const json = JSON.stringify(panelData, null, 2);
      navigator.clipboard.writeText(json)
        .then(() => alert("Datos copiados al portapapeles."))
        .catch(() => {
          const blob = new Blob([json], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `backup_ubereats_tracker_${Date.now()}.json`;
          a.click();
          URL.revokeObjectURL(url);
          alert("Backup descargado.");
        });
    });
    
    $("btnExportarExcel")?.addEventListener("click", exportToExcel); 

    $("btnImportar")?.addEventListener("click", () => {
      const raw = ($("importJson")?.value || "").trim();

      if (!raw) return alert("Pega tu JSON primero.");

      try {
        const parsed = JSON.parse(raw);
        panelData = Object.assign({}, panelData, parsed);
        panelData.parametros = Object.assign({}, panelData.parametros, (parsed.parametros || {}));

        guardarPanelData();
        $("importJson").value = "";
        
        location.reload(); 
        alert("Importación correcta ✔. Recarga de página automática.");

      } catch (e) {
        console.error(e);
        alert("JSON inválido.");
      }
    });
}

// ======================
// TURNOS
// ======================
function actualizarUIturno() {
  const ini = $("btnIniciarTurno");
  const fin = $("btnFinalizarTurno");
  const txt = $("turnoTexto");

  if (!ini || !fin || !txt) return;

  if (turnoActivo) {
    ini.style.display = "none";
    fin.style.display = "inline-block";
    txt.textContent = `Turno en curso iniciado el ${new Date(turnoInicio).toLocaleString("es-MX")}`;
  } else {
    ini.style.display = "inline-block";
    fin.style.display = "none";
    txt.textContent = "Sin turno activo";
  }
}

function iniciarTurno() {
  if (turnoActivo) return alert("Ya tienes un turno activo.");

  turnoActivo = true;
  turnoInicio = nowISO();

  localStorage.setItem("turnoActivo", true);
  localStorage.setItem("turnoInicio", turnoInicio);

  actualizarUIturno();
  alert("Turno iniciado.");
}

function finalizarTurno() {
  if (!turnoActivo) return alert("No hay turno activo.");

  const inicio = new Date(turnoInicio);
  const fin = new Date();
  const horas = Number(((fin - inicio) / 3600000).toFixed(2));

  const ganStr = prompt(`Terminó el turno.\nHoras: ${horas}h\nIngresa Ganancia Bruta (MXN):`);
  
  // FIX 7: Validación robusta para null, empty, NaN y negativo
  const gan = Number(ganStr);
  if (ganStr === null || ganStr.trim() === "" || isNaN(gan) || gan < 0) {
      return alert("Monto inválido o no ingresado. El turno no fue registrado.");
  }
  
  panelData.turnos.push({
    inicio: inicio.toISOString(),
    fin: fin.toISOString(),
    horas,
    ganancia: gan
  });

  panelData.ingresos.push({
    descripcion: `Ganancia turno (${horas}h)`,
    cantidad: gan,
    fechaISO: nowISO(),
    fechaLocal: nowLocal()
  });

  pushMovimiento("Ingreso", `Ganancia turno (${horas}h)`, gan);

  turnoActivo = false;
  turnoInicio = null;

  localStorage.setItem("turnoActivo", false);
  localStorage.removeItem("turnoInicio");

  guardarPanelData();
  actualizarUIturno();
  renderResumenIndex(); // FIX 6: Re-render

  alert("Turno finalizado.");
}

// ======================
// RENDERIZADO (Index)
// ======================
function calcularResumenDatos() {
  const hoy = new Date().toISOString().slice(0, 10);

  const turnosHoy = (panelData.turnos || []).filter(t => (t.inicio || "").slice(0, 10) === hoy);
  const gastosHoy = (panelData.gastos || []).filter(g => (g.fechaISO || "").slice(0, 10) === hoy);

  const horasHoy = turnosHoy.reduce((s, t) => s + (Number(t.horas) || 0), 0);
  const ganHoy   = turnosHoy.reduce((s, t) => s + (Number(t.ganancia) || 0), 0);
  const gastHoy  = gastosHoy.reduce((s, g) => s + (Number(g.cantidad) || 0), 0);

  return { horasHoy, ganHoy, gastHoy };
}

function aggregateDailyData() {
  const data = {};

  const processEntry = (entry, type, amountKey) => {
    // FIX 4: Usa inicio/fechaISO como fuente de verdad.
    let isoDateStr = entry.fechaISO || entry.inicio; 

    if (!isoDateStr) {
      // Intenta inferir de fechaLocal si falta ISO, aunque no es ideal
      const localMatch = (entry.fechaLocal || "").match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (localMatch) {
          isoDateStr = `${localMatch[3]}-${localMatch[2].padStart(2, '0')}-${localMatch[1].padStart(2, '0')}`;
      }
    }
    
    if (!isoDateStr) return; 

    const dateKey = isoDateStr.slice(0, 10); // FIX 4: Clave consistente YYYY-MM-DD

    data[dateKey] = data[dateKey] || { date: dateKey, ingresos: 0, gastos: 0, kmRecorridos: 0 };
    data[dateKey][type] += (Number(entry[amountKey]) || 0);
  };
  
  (panelData.turnos || []).forEach(t => processEntry(t, 'ingresos', 'ganancia'));
  (panelData.gastos || []).forEach(g => processEntry(g, 'gastos', 'cantidad'));
  (panelData.kmDiarios || []).forEach(k => processEntry(k, 'kmRecorridos', 'recorrido'));

  return Object.values(data).sort((a, b) => new Date(a.date) - new Date(b.date));
}

function aggregateKmMensual() {
    const dataMensual = {};

    (panelData.kmDiarios || []).forEach(k => {
        const mesKey = (k.fechaISO || "").slice(0, 7);
        if (!mesKey) return;
        
        dataMensual[mesKey] = dataMensual[mesKey] || { kmRecorridos: 0, costoGasolina: 0 };
        dataMensual[mesKey].kmRecorridos += (Number(k.recorrido) || 0);
    });

    (panelData.gastos || []).forEach(g => {
        if (g.categoria === "Transporte" && g.descripcion.includes("Gasolina")) { 
            const mesKey = (g.fechaISO || "").slice(0, 7);
            if (!mesKey) return;

            dataMensual[mesKey] = dataMensual[mesKey] || { kmRecorridos: 0, costoGasolina: 0 };
            dataMensual[mesKey].costoGasolina += (Number(g.cantidad) || 0);
        }
    });

    const resultado = Object.entries(dataMensual).map(([mesKey, data]) => {
        const [year, month] = mesKey.split('-');
        // Generar cadena localizada SOLO para mostrar
        const dateString = new Date(year, month - 1, 1).toLocaleString('es-MX', { year: 'numeric', month: 'long' });
        
        const costoPorKm = data.kmRecorridos > 0 
            ? data.costoGasolina / data.kmRecorridos 
            : 0;

        return {
            mesKey, // FIX 5: Mantener YYYY-MM para ordenar
            mes: dateString.charAt(0).toUpperCase() + dateString.slice(1),
            kmRecorridos: data.kmRecorridos,
            costoGasolina: data.costoGasolina,
            costoPorKm: costoPorKm
        };
    }).sort((a, b) => {
      // FIX 5: Ordenar por YYYY-MM descendente
      return b.mesKey.localeCompare(a.mesKey);
    });

    return resultado;
}

function renderTablaKmMensual() {
    const tablaContainer = $("tablaKmMensual"); 
    if (!tablaContainer) return;

    const datosMensuales = aggregateKmMensual();
    
    let html = `
        <table class="tabla">
            <thead>
                <tr>
                    <th>Mes</th>
                    <th>KM Recorridos</th>
                    <th>Costo Gasolina</th>
                    <th>Costo por KM</th>
                </tr>
            </thead>
            <tbody>`;

    if (datosMensuales.length === 0) {
        html += `<tr><td colspan="4" style="text-align:center">No hay datos de KM/Gasolina.</td></tr>`;
    } else {
        datosMensuales.forEach(d => {
            html += `
                <tr>
                    <td>${d.mes}</td>
                    <td>${d.kmRecorridos.toFixed(0)} KM</td>
                    <td>$${fmtMoney(d.costoGasolina)}</td>
                    <td>$${d.costoPorKm.toFixed(2)}</td>
                </tr>
            `;
        });
    }

    html += `</tbody></table>`;
    tablaContainer.innerHTML = html;
}

function renderTablaTurnos() {
  const tbody = $("tablaTurnos");
  if (!tbody) return;

  tbody.innerHTML = "";

  const arr = [...(panelData.turnos || [])].reverse();

  if (arr.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center">No hay turnos</td></tr>`;
    return;
  }

  const gastosPorFecha = {};
  (panelData.gastos || []).forEach(g => {
    const key = (g.fechaISO || "").slice(0, 10);
    gastosPorFecha[key] = (gastosPorFecha[key] || 0) + Number(g.cantidad || 0);
  });
  
  arr.forEach(t => {
    const fecha = (t.inicio || "").slice(0, 10);
    const gastosDia = gastosPorFecha[fecha] || 0;
    const neta = (Number(t.ganancia) || 0) - gastosDia;

    tbody.innerHTML += `
      <tr>
        <td>${fecha}</td>
        <td>${(Number(t.horas) || 0).toFixed(2)}</td>
        <td>$${fmtMoney(t.ganancia)}</td>
        <td>$${fmtMoney(gastosDia)}</td> 
        <td>$${fmtMoney(neta)}</td>
      </tr>
    `;
  });
}

function renderCharts() {
  const dailyData = aggregateDailyData();
  const last14Days = dailyData.slice(-14);
  const labels = last14Days.map(d => {
      const [y, m, d_] = d.date.split('-');
      return `${m}/${d_}`; 
  }); 

  // Gráfica de Ganancias vs Gastos
  const ctxGanancias = $("graficaGanancias");
  if (ctxGanancias) {
    if (gananciasChart) gananciasChart.destroy(); 
    // ... (Chart.js configuration)
    gananciasChart = new Chart(ctxGanancias, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Ingresos',
          data: last14Days.map(d => d.ingresos),
          backgroundColor: '#00a000', 
        }, {
          label: 'Gastos',
          data: last14Days.map(d => d.gastos),
          backgroundColor: '#d40000', 
        }]
      },
      options: {
        responsive: true,
        scales: { x: { stacked: false }, y: { beginAtZero: true } },
        plugins: { legend: { position: 'top' }, title: { display: false } }
      }
    });
  }

  // Gráfica de Kilometraje
  const ctxKm = $("graficaKm");
  if (ctxKm) {
    if (kmChart) kmChart.destroy(); 
    // ... (Chart.js configuration)
    kmChart = new Chart(ctxKm, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'KM Recorridos',
          data: last14Days.map(d => d.kmRecorridos),
          borderColor: '#0066ff', 
          backgroundColor: '#0066ff40',
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        scales: { y: { beginAtZero: true } },
        plugins: { legend: { position: 'top' }, title: { display: false } }
      }
    });
  }
}

function calcularProyeccionReal() {
  const p = panelData.parametros || {};
  const deudaTotal = Number(p.deudaTotal || 0);
  const gastoFijo  = Number(p.gastoFijo || 0);

  const turnos = panelData.turnos || [];
  const diasTrabajados = new Set(turnos.map(t => (t.inicio || "").slice(0,10))).size;

  const totalHoras = turnos.reduce((s,t)=>s+ (Number(t.horas)||0),0);
  const totalGan    = turnos.reduce((s,t)=>s+ (Number(t.ganancia)||0),0);

  const horasPromDia = diasTrabajados ? totalHoras / diasTrabajados : 0;
  const ganPromDia   = diasTrabajados ? totalGan / diasTrabajados : 0;

  const gastos = panelData.gastos || [];
  const gastosPorFecha = {};

  gastos.forEach(g=>{
    const key = (g.fechaISO || "").slice(0,10);
    if (!key) return;
    gastosPorFecha[key] = (gastosPorFecha[key] || 0) + Number(g.cantidad || 0);
  });

  const gastoPromDia = Object.values(gastosPorFecha).reduce((s,v)=>s+v,0) /
                        (Object.keys(gastosPorFecha).length || 1);

  const netaPromDia = ganPromDia - gastoPromDia - gastoFijo;

  let diasParaLiquidar = Infinity;
  if (netaPromDia > 0 && deudaTotal > 0) {
    diasParaLiquidar = deudaTotal / netaPromDia;
  }

  if ($("proyDeuda")) $("proyDeuda").textContent = "$" + fmtMoney(deudaTotal);
  if ($("proyHoras")) $("proyHoras").textContent = horasPromDia.toFixed(2) + " h";
  if ($("proyNeta"))  $("proyNeta").textContent  = "$" + fmtMoney(netaPromDia);

  if ($("proyDias")) {
    if (diasParaLiquidar === Infinity || netaPromDia <= 0) {
      $("proyDias").textContent = (deudaTotal > 0) ? "N/A (Ganancia Neta 0 o negativa)" : "Deuda Saldada";
    } else {
      $("proyDias").textContent = Math.ceil(diasParaLiquidar) + " días";
    }
  }
}

function renderResumenIndex() {
  const r = calcularResumenDatos();

  if ($("resHoras")) $("resHoras").textContent = r.horasHoy.toFixed(2);
  if ($("resGananciaBruta")) $("resGananciaBruta").textContent = "$" + fmtMoney(r.ganHoy);
  if ($("resGastos")) $("resGastos").textContent = "$" + fmtMoney(r.gastHoy);
  if ($("resNeta")) $("resNeta").textContent = "$" + fmtMoney(r.ganHoy - r.gastHoy);

  renderTablaTurnos();
  renderTablaKmMensual();
  renderCharts();
  calcularProyeccionReal();
}


// ======================
// TUTORIAL (Tour de Usuario)
// ======================
const tutorialSteps = [
    {
        title: "¡Bienvenido a Uber Eats Tracker!",
        text: "Te guiaré rápidamente por las funciones clave de la aplicación. Haz clic en 'Siguiente'.",
        targetId: null, 
        positionClass: "modal-center",
        buttonText: "Siguiente"
    },
    {
        title: "Resumen del Día",
        text: "Aquí verás tus ganancias y gastos del turno actual, calculados automáticamente.",
        targetId: "cardResumen", 
        positionClass: "modal-top-right",
        buttonText: "Siguiente"
    },
    {
        title: "Administrador de Datos",
        text: "El cerebro de la aplicación. Aquí registrarás tus ingresos, gastos, kilometraje, deudas y más.",
        targetId: "adminButton", // FIX 3: Usamos el ID del botón para saltar de página
        positionClass: "modal-bottom-left",
        buttonText: document.title.includes("Resultados") ? "Ir al Administrador" : "Siguiente",
        action: () => {
            if (document.title.includes("Resultados")) {
                 window.location.href = 'admin.html';
                 return true; 
            }
            return false;
        }
    },
    {
        title: "Registro de Turnos",
        text: "Usa estos botones para marcar el inicio y el fin de tu jornada. Al finalizar, registra tus horas y la ganancia bruta.",
        targetId: "btnIniciarTurno", // Se resolverá al padre "card"
        positionClass: "modal-top-right",
        buttonText: "Siguiente"
    },
    {
        title: "Gestión de Deudas",
        text: "Registra tus deudas fijas (coche, celular) y lleva un control de tus abonos. Esto ayuda al cálculo de la proyección.",
        targetId: "btnRegistrarDeuda", // Se resolverá al padre "card"
        positionClass: "modal-bottom-left",
        buttonText: "Siguiente"
    },
    {
        title: "Importar y Exportar",
        text: "Siempre haz una copia de seguridad de tus datos. Puedes exportar a JSON (copiar y pegar) o a Excel.",
        targetId: "btnExportar", // Se resolverá al padre "card"
        positionClass: "modal-top-right",
        buttonText: "Finalizar Tutorial"
    }
];

let currentStep = 0;

function resolveTarget(step) {
    if (!step.targetId) return null;
    
    let element = $(step.targetId);

    // Si el target es el adminButton y estamos en index, funciona bien.
    // Si el target es un botón en admin.html, buscamos el padre .card para resaltarlo mejor.
    if (document.title.includes("Administración") && element && element.tagName === 'BUTTON' && element.closest(".card")) {
        return element.closest(".card");
    }
    
    // Caso especial: si es el paso 2 (adminButton) pero estamos en admin, no hay target.
    if (document.title.includes("Administración") && step.targetId === "adminButton") {
        return null;
    }
    
    return element;
}

function renderTutorialStep() {
    const step = tutorialSteps[currentStep];
    const overlay = $("tutorialOverlay");
    const modal = $("tutorialModal");
    const title = $("tutorialTitle");
    const text = $("tutorialText");
    const button = $("tutorialNextBtn");
    
    if (!overlay || !modal || !button) return; 

    // Ocultar elementos anteriores
    document.querySelectorAll('.tutorial-highlight').forEach(el => {
        el.classList.remove('tutorial-highlight');
    });
    
    // FIX 8: Mostrar la modal invisiblemente primero para obtener medidas correctas
    // Se asegura que la modal tenga dimensiones antes de calcular offsetWidth/posicionamiento
    modal.style.visibility = 'hidden';
    modal.style.display = 'block';
    
    modal.classList.remove('modal-center', 'modal-top-right', 'modal-bottom-left');
    
    // Aplicar contenido y estilo del nuevo paso
    title.textContent = step.title;
    text.innerHTML = step.text;
    button.textContent = step.buttonText;
    modal.classList.add(step.positionClass);

    const targetElement = resolveTarget(step);

    if (targetElement) {
        // Resaltar elemento
        targetElement.classList.add('tutorial-highlight');
        
        const rect = targetElement.getBoundingClientRect();
        
        // Calcular posición
        let modalLeft, modalTop;
        const modalWidth = modal.offsetWidth;

        if (step.positionClass === 'modal-top-right') {
            // Posicionar a la derecha superior del target
            modalTop = rect.top + window.scrollY + 10;
            modalLeft = rect.right + window.scrollX - modalWidth;
        } else if (step.positionClass === 'modal-bottom-left') {
            // Posicionar a la izquierda inferior del target
            modalTop = rect.bottom + window.scrollY + 10;
            modalLeft = rect.left + window.scrollX;
        }
        
        modal.style.top = `${modalTop}px`;
        modal.style.left = `${modalLeft}px`;
        modal.style.transform = ''; // Reset transform si no está centrado
        
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
        // Posición central (paso inicial o pasos sin target en la página actual)
        modal.classList.add('modal-center');
        modal.style.top = '50%';
        modal.style.left = '50%';
        modal.style.transform = 'translate(-50%, -50%)'; 
    }

    // Finalmente hacerlo visible
    overlay.style.display = 'block';
    modal.style.visibility = 'visible';

    setTimeout(() => {
        overlay.style.opacity = '1';
        modal.style.opacity = '1';
    }, 10); 
}

function nextTutorialStep() {
    const step = tutorialSteps[currentStep];
    
    // Si el paso actual no tiene target en esta página, saltarlo (Ej. paso 1 en admin)
    if (document.title.includes("Administración") && currentStep < 3) {
        currentStep = 3; // Salta al Registro de Turnos
    }
    
    // Ejecutar acción si existe (Ej. ir a admin.html)
    if (step.action && step.action()) {
        return; 
    }
    
    currentStep++;

    if (currentStep < tutorialSteps.length) {
        renderTutorialStep();
    } else {
        // Finalizar el tutorial
        localStorage.setItem(TUTORIAL_COMPLETADO_KEY, 'true');
        $("tutorialOverlay").style.opacity = '0';
        $("tutorialModal").style.opacity = '0';
        
        setTimeout(() => {
            $("tutorialOverlay").style.display = 'none';
            $("tutorialModal").style.display = 'none';
        }, 300);
        
        alert("¡Tutorial Finalizado! Ahora puedes empezar a registrar tus datos.");
    }
}

function iniciarTutorial() {
    if (localStorage.getItem(TUTORIAL_COMPLETADO_KEY)) return;
    
    // Si estamos en la página de admin, saltar al paso 3 (Registro de Turnos)
    if (document.title.includes("Administración")) {
        currentStep = 3; 
    }
    
    // Solo iniciar si el botón existe
    if($("tutorialNextBtn")) {
      renderTutorialStep();
      $("tutorialNextBtn")?.addEventListener('click', nextTutorialStep);
    }
}


// ======================
// INICIALIZACIÓN (DOMContentLoaded)
// ======================
document.addEventListener("DOMContentLoaded", () => {
    // 1. Setup Listeners
    setupIngresoListeners();
    setupGastoListeners();
    setupDeudaListeners();
    setupKmAndGasListeners();
    setupIoListeners();
    
    // 2. Turnos Listeners
    $("btnIniciarTurno")?.addEventListener("click", iniciarTurno);
    $("btnFinalizarTurno")?.addEventListener("click", finalizarTurno);

    // 3. Inicializar UI del Admin
    actualizarUIturno();
    renderDeudas();
    
    if ($("kmInicial") && panelData.parametros.ultimoKMfinal !== null) {
        $("kmInicial").value = panelData.parametros.ultimoKMfinal;
    }

    // 4. Calcular y Pintar Parámetros Automáticos
    calcularDeudaTotalAuto();
    calcularGastoFijoAuto();

    // 5. Bloquear y pintar inputs automáticos
    const inpDeuda = document.getElementById("proyDeudaTotal");
    const inpGasto = document.getElementById("proyGastoFijo");

    if (inpDeuda) inpDeuda.readOnly = true;
    if (inpGasto) inpGasto.readOnly = true;

    // 6. Renderizar Resultados (solo si estamos en index.html)
    if (document.title.includes("Resultados")) {
        renderResumenIndex(); 
    }
    
    // 7. INICIAR EL TUTORIAL
    iniciarTutorial(); 
});
