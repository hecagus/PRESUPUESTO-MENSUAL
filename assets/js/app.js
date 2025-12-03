// ======================
// app.js — PARTE 1/5: SETUP, UTILIDADES Y AUTO-CÁLCULOS
// ======================

const STORAGE_KEY = "panelData";
const $ = id => document.getElementById(id);

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

// ======================
// Cargar / Guardar
// ======================
function cargarPanelData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);

    // Asegurar que las propiedades existan
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

// Cargar al inicio (antes de DOMContentLoaded)
cargarPanelData();

// ======================
// Utilidades
// ======================
const fmtMoney = n => Number(n || 0).toLocaleString("es-MX", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const nowISO = () => new Date().toISOString();
const nowLocal = () => new Date().toLocaleString("es-MX");

// -----------------------------
// FUNCIONES AUTOMÁTICAS
// -----------------------------

// A) calcularDeudaTotalAuto: suma de (monto - abonado)
function calcularDeudaTotalAuto() {
  const deudas = panelData.deudas || [];

  const total = deudas.reduce((s, d) => {
    return s + ((Number(d.monto) || 0) - (Number(d.abonado) || 0));
  }, 0);

  panelData.parametros = panelData.parametros || {};
  panelData.parametros.deudaTotal = total;
  guardarPanelData();

  const inp = $("proyDeudaTotal");
  if (inp) {
    inp.value = total.toFixed(2);
  }
}

// B) calcularGastoFijoAuto: calcula promedio basado en abonos y KM
function calcularGastoFijoAuto() {
  panelData.parametros = panelData.parametros || {};
  const comidaDiaria = 200; // Gasto fijo asumido de comida

  const kmArr = panelData.kmDiarios || [];
  const kmProm = kmArr.length
    ? kmArr.reduce((s, k) => s + (Number(k.recorrido) || 0), 0) / kmArr.length
    : 0;

  let ultimoAbono = 0;
  let ultimaFecha = 0;

  // Busca el abono más reciente
  (panelData.gastos || []).forEach(g => {
    if ((g.categoria || "") === "Abono a Deuda") {
      const t = new Date(g.fechaISO || g.fechaLocal).getTime();
      if (!ultimaFecha || t > ultimaFecha) {
        ultimaFecha = t;
        ultimoAbono = Number(g.cantidad) || 0;
      }
    }
  });

  // Fórmula de Gasto Fijo: (Abono mensual / 6 días) + Gasto de comida + (KM promedio * costo por KM)
  const gastoFijo = (ultimoAbono / 6) + comidaDiaria + (kmProm * 0.6); // 0.6 MXN/KM asumido

  panelData.parametros.gastoFijo = gastoFijo;
  guardarPanelData();

  const inp = $("proyGastoFijo");
  if (inp) {
    inp.value = gastoFijo.toFixed(2);
  }
}

// ======================
// Movimientos (Historial) - Se mantiene la función por si se usa
// ======================
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
// app.js — PARTE 2/5: REGISTROS DE MOVIMIENTOS Y DEUDAS
// ======================

// ======================
// Registrar ingreso
// ======================
function setupIngresoListeners() {
  const btn = $("btnGuardarIngreso");
  if (!btn) return;

  btn.addEventListener("click", () => {
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
    // renderResumenIndex se llama al final en DOMContentLoaded si estamos en index.html
  });
}

// ======================
// Registrar gasto
// ======================
function setupGastoListeners() {
  const btn = $("btnGuardarGasto");
  if (!btn) return;

  btn.addEventListener("click", () => {
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

    // Si es gasto que afecta el cálculo automático, recalcular
    if (cat === "Comida" || cat === "Transporte") calcularGastoFijoAuto();

    pushMovimiento("Gasto", `${desc} (${cat})`, qty);
    guardarPanelData();

    $("gastoDescripcion").value = "";
    $("gastoCantidad").value = "";

    alert("Gasto registrado.");
  });
}

// ======================
// Deudas
// ======================
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

    // Solo agregar deudas con saldo pendiente al selector de abonos
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

// Event Listeners para Deudas
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

      // registrar gasto tipo abono
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

      $("abonoMonto").value = "";
      alert("Abono guardado.");
    });
}
// ======================
// app.js — PARTE 3/5: KM, GASOLINA, IO Y TURNOS
// ======================

// ======================
// KM y Gasolina
// ======================
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

    panelData.parametros = panelData.parametros || {};
    panelData.parametros.ultimoKMfinal = fin;
    guardarPanelData();

    calcularGastoFijoAuto();

    $("kmInicial").value = "";
    $("kmFinal").value = "";
    $("kmRecorridos").textContent = "0";

    alert("Kilometraje guardado.");
    
    // Asignar el último KM final para el siguiente registro
    if ($("kmInicial")) $("kmInicial").value = fin;
  });

  $("btnGuardarGas")?.addEventListener("click", () => {
    const litros = Number($("litrosGas")?.value || 0);
    const costo = Number($("costoGas")?.value || 0);

    if (!litros || !costo) return alert("Datos inválidos.");

    panelData.gasolina.push({
      fechaISO: nowISO(),
      fechaLocal: nowLocal(),
      litros,
      costo
    });

    // registrar gasto de gasolina
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
  });
}


// ======================
// Exportar a Excel
// ======================
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


// ======================
// Importar / Exportar JSON
// ======================
function setupIoListeners() {
    $("btnExportar")?.addEventListener("click", () => {
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

        // Combinar datos existentes con los importados
        panelData = Object.assign({}, panelData, parsed);
        panelData.parametros = Object.assign({}, panelData.parametros, (parsed.parametros || {}));

        guardarPanelData();
        $("importJson").value = "";
        
        // Refrescar UI completamente
        location.reload(); 

        alert("Importación correcta ✔. Recarga de página automática.");

      } catch (e) {
        console.error(e);
        alert("JSON inválido.");
      }
    });
}


// ======================
// Turnos
// ======================
let turnoActivo = JSON.parse(localStorage.getItem("turnoActivo")) || false;
let turnoInicio = localStorage.getItem("turnoInicio") || null;

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

  const ganStr = prompt(`Terminó el turno.\nHoras: ${horas}\nGanancia (MXN):`);
  const gan = Number(ganStr);

  if (!gan) return alert("Monto inválido. El turno no fue registrado.");

  panelData.turnos.push({
    inicio: inicio.toISOString(),
    fin: fin.toISOString(),
    horas,
    ganancia: gan
  });

  // El ingreso de la ganancia se registra aquí
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

  alert("Turno finalizado.");
}

// ======================
// app.js — PARTE 4/5: RENDERIZADO Y GRÁFICAS
// ======================

let gananciasChart = null;
let kmChart = null;

// ======================
// Resumen del día
// ======================
function calcularResumenDatos() {
  const hoy = new Date().toISOString().slice(0, 10);

  // Obtener turnos y gastos DE HOY
  const turnosHoy = (panelData.turnos || []).filter(t => (t.inicio || "").slice(0, 10) === hoy);
  const gastosHoy = (panelData.gastos || []).filter(g => (g.fechaISO || "").slice(0, 10) === hoy);

  const horasHoy = turnosHoy.reduce((s, t) => s + (Number(t.horas) || 0), 0);
  const ganHoy   = turnosHoy.reduce((s, t) => s + (Number(t.ganancia) || 0), 0);
  const gastHoy  = gastosHoy.reduce((s, g) => s + (Number(g.cantidad) || 0), 0);

  return { horasHoy, ganHoy, gastHoy };
}

// ======================
// AGREGACIÓN DE DATOS DIARIOS PARA GRÁFICAS
// ======================
function aggregateDailyData() {
  const data = {};

  const processEntry = (entry, type, amountKey) => {
    
    const rawDate = entry.fechaLocal || ""; 
    if (!rawDate) return;

    // Extraer solo la fecha: "DD/MM/YYYY"
    const localDate = rawDate.split(',')[0].trim();
    
    // Convertir a formato "YYYY-MM-DD" para ordenar
    const parts = localDate.split('/');
    if (parts.length !== 3) return;
    const dateKey = `${parts[2]}-${parts[1]}-${parts[0]}`; 

    data[dateKey] = data[dateKey] || { date: dateKey, ingresos: 0, gastos: 0, kmRecorridos: 0 };
    data[dateKey][type] += (Number(entry[amountKey]) || 0);
  };
  
  // Procesar las entradas (Se usa el ingreso del turno, no todos los ingresos)
  (panelData.turnos || []).forEach(t => processEntry(t, 'ingresos', 'ganancia'));
  (panelData.gastos || []).forEach(g => processEntry(g, 'gastos', 'cantidad'));
  (panelData.kmDiarios || []).forEach(k => processEntry(k, 'kmRecorridos', 'recorrido'));

  return Object.values(data).sort((a, b) => new Date(a.date) - new Date(b.date));
}

// ======================
// CÁLCULO Y RENDERIZADO DE MÉTRICAS MENSUALES DE KM
// ======================
function aggregateKmMensual() {
    const dataMensual = {};

    (panelData.kmDiarios || []).forEach(k => {
        const date = new Date(k.fechaISO);
        const mesKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        dataMensual[mesKey] = dataMensual[mesKey] || { kmRecorridos: 0, costoGasolina: 0 };
        dataMensual[mesKey].kmRecorridos += (Number(k.recorrido) || 0);
    });

    (panelData.gastos || []).forEach(g => {
        if (g.categoria === "Transporte" && g.descripcion.includes("Gasolina")) { 
            const date = new Date(g.fechaISO);
            const mesKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            
            dataMensual[mesKey] = dataMensual[mesKey] || { kmRecorridos: 0, costoGasolina: 0 };
            dataMensual[mesKey].costoGasolina += (Number(g.cantidad) || 0);
        }
    });

    const resultado = Object.entries(dataMensual).map(([mesKey, data]) => {
        const [year, month] = mesKey.split('-');
        const dateString = new Date(year, month - 1, 1).toLocaleString('es-MX', { year: 'numeric', month: 'long' });
        
        const costoPorKm = data.kmRecorridos > 0 
            ? data.costoGasolina / data.kmRecorridos 
            : 0;

        return {
            mes: dateString.charAt(0).toUpperCase() + dateString.slice(1),
            kmRecorridos: data.kmRecorridos,
            costoGasolina: data.costoGasolina,
            costoPorKm: costoPorKm
        };
    }).sort((a, b) => {
      // Ordenar por año-mes descendente (más reciente primero)
      const keyA = new Date(a.mes).getTime();
      const keyB = new Date(b.mes).getTime();
      return keyB - keyA;
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

// ======================
// Render resumen index
// ======================
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
// Tabla Turnos
// ======================
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

// ======================
// Proyección Real
// ======================
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

// ======================
// GRÁFICAS (CHART.JS)
// ======================
function renderCharts() {
  const dailyData = aggregateDailyData();

  const last14Days = dailyData.slice(-14);
  const labels = last14Days.map(d => {
      const [y, m, d_] = d.date.split('-');
      return `${m}/${d_}`; 
  }); 

  // 1. Gráfica de Ganancias vs Gastos
  const ctxGanancias = $("graficaGanancias");
  if (ctxGanancias) {
    if (gananciasChart) gananciasChart.destroy(); 

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
        scales: {
          x: { stacked: false },
          y: { beginAtZero: true }
        },
        plugins: {
          legend: { position: 'top' },
          title: { display: false }
        }
      }
    });
  }

  // 2. Gráfica de Kilometraje
  const ctxKm = $("graficaKm");
  if (ctxKm) {
    if (kmChart) kmChart.destroy(); 

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
        plugins: {
          legend: { position: 'top' },
          title: { display: false }
        }
      }
    });
  }
}
// ======================
// app.js — PARTE 5/5: LÓGICA DEL TUTORIAL E INICIALIZACIÓN
// ======================
const TUTORIAL_COMPLETADO_KEY = "tutorialCompleto";

// -----------------
// Definición de Pasos
// -----------------
const tutorialSteps = [
    {
        title: "¡Bienvenido a Uber Eats Tracker!",
        text: "Te guiaré rápidamente por las funciones clave de la aplicación. Haz clic en 'Siguiente'.",
        target: null, 
        positionClass: "modal-center",
        buttonText: "Siguiente"
    },
    {
        title: "Resumen del Día",
        text: "Aquí verás tus ganancias y gastos del turno actual, calculados automáticamente.",
        target: document.title.includes("Resultados") ? $("cardResumen") : null,
        positionClass: "modal-top-right",
        buttonText: "Siguiente"
    },
    {
        title: "Administrador de Datos",
        text: "El cerebro de la aplicación. Aquí registrarás tus ingresos, gastos, kilometraje, deudas y más.",
        target: document.title.includes("Resultados") ? $("adminButton") : $("header")?.querySelector(".btn-admin"),
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
        target: $("btnIniciarTurno") ? $("btnIniciarTurno").closest(".card") : null,
        positionClass: "modal-top-right",
        buttonText: "Siguiente"
    },
    {
        title: "Gestión de Deudas",
        text: "Registra tus deudas fijas (coche, celular) y lleva un control de tus abonos. Esto ayuda al cálculo de la proyección.",
        target: $("btnRegistrarDeuda") ? $("btnRegistrarDeuda").closest(".card") : null,
        positionClass: "modal-bottom-left",
        buttonText: "Siguiente"
    },
    {
        title: "Importar y Exportar",
        text: "Siempre haz una copia de seguridad de tus datos. Puedes exportar a JSON (copiar y pegar) o a Excel.",
        target: $("btnExportar") ? $("btnExportar").closest(".card") : null,
        positionClass: "modal-top-right",
        buttonText: "Finalizar Tutorial"
    }
];

let currentStep = 0;

// -----------------
// Lógica del Tour
// -----------------
function iniciarTutorial() {
    if (localStorage.getItem(TUTORIAL_COMPLETADO_KEY)) return;
    
    // Si estamos en la página de admin, saltar al paso 3 (sección Turnos)
    if (document.title.includes("Administración")) {
        currentStep = 3; 
    }

    renderTutorialStep();
}

function renderTutorialStep() {
    const step = tutorialSteps[currentStep];
    const overlay = $("tutorialOverlay");
    const modal = $("tutorialModal");
    const title = $("tutorialTitle");
    const text = $("tutorialText");
    const button = $("tutorialNextBtn");
    
    if (!overlay || !modal || !button) return; 

    // Ocultar modal y quitar highlight del paso anterior
    document.querySelectorAll('.tutorial-highlight').forEach(el => {
        el.classList.remove('tutorial-highlight');
        el.style.boxShadow = '';
    });
    
    modal.classList.remove('modal-center', 'modal-top-right', 'modal-bottom-left');
    
    // Aplicar contenido y estilo del nuevo paso
    title.textContent = step.title;
    text.innerHTML = step.text;
    button.textContent = step.buttonText;
    modal.classList.add(step.positionClass);

    if (step.target) {
        // Resaltar elemento
        step.target.classList.add('tutorial-highlight');
        
        // Calcular la posición de la modal cerca del target
        const rect = step.target.getBoundingClientRect();
        
        // Ajustar la posición de la modal basada en la clase
        if (step.positionClass === 'modal-top-right') {
            modal.style.top = `${rect.top + window.scrollY + 10}px`;
            modal.style.left = `${rect.right + window.scrollX - modal.offsetWidth}px`;
        } else if (step.positionClass === 'modal-bottom-left') {
            modal.style.top = `${rect.bottom + window.scrollY - modal.offsetHeight - 10}px`;
            modal.style.left = `${rect.left + window.scrollX}px`;
        } else {
            modal.style.top = '50%';
            modal.style.left = '50%';
        }
        
        step.target.scrollIntoView({ behavior: 'smooth', block: 'center' });

    } else {
        modal.style.top = '50%';
        modal.style.left = '50%';
    }

    // Mostrar overlay y modal
    overlay.style.display = 'block';
    modal.style.display = 'block';

    setTimeout(() => {
        overlay.style.opacity = '1';
        modal.style.opacity = '1';
    }, 10); 
}

function nextTutorialStep() {
    const step = tutorialSteps[currentStep];
    
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

// -----------------
// Listener Principal del Tutorial
// -----------------
$("tutorialNextBtn")?.addEventListener('click', nextTutorialStep);


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
    
    // Asignar el último KM final guardado como KM Inicial si existe
    if ($("kmInicial") && panelData.parametros.ultimoKMfinal !== null) {
        $("kmInicial").value = panelData.parametros.ultimoKMfinal;
    }

    // 4. Calcular y Pintar Parámetros Automáticos
    calcularDeudaTotalAuto();
    calcularGastoFijoAuto();

    // 5. Bloquear y pintar inputs automáticos
    const inpDeuda = document.getElementById("proyDeudaTotal");
    const inpGasto = document.getElementById("proyGastoFijo");

    if (inpDeuda) {
        inpDeuda.readOnly = true;
        inpDeuda.style.background = "#eee";
    }

    if (inpGasto) {
        inpGasto.readOnly = true;
        inpGasto.style.background = "#eee";
    }

    // 6. Renderizar Resultados (solo si estamos en index.html)
    if (document.title.includes("Resultados")) {
        renderResumenIndex(); 
    }
    
    // 7. INICIAR EL TUTORIAL
    iniciarTutorial(); 
});
