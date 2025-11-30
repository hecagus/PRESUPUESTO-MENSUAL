// ======================
// app.js — PARTE 1/4
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

// cargar al inicio (nota: algunas inicializaciones se hacen en DOMContentLoaded)
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

// A) calcularDeudaTotalAuto: suma de (monto - abonado), guarda y pinta input readonly
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
    inp.readOnly = true;
    inp.style.background = "#eee";
  }
}

// B) calcularGastoFijoAuto: busca último abono en panelData.gastos (categoria "Abono a Deuda")
function calcularGastoFijoAuto() {
  panelData.parametros = panelData.parametros || {};
  const comidaDiaria = 200;

  const kmArr = panelData.kmDiarios || [];
  const kmProm = kmArr.length
    ? kmArr.reduce((s, k) => s + (Number(k.recorrido) || 0), 0) / kmArr.length
    : 0;

  let ultimoAbono = 0;
  let ultimaFecha = null;

  (panelData.gastos || []).forEach(g => {
    if ((g.categoria || "") === "Abono a Deuda") {
      const fecha = g.fechaISO || g.fechaLocal;
      if (!fecha) return;
      const t = new Date(fecha).getTime();
      if (!ultimaFecha || t > ultimaFecha) {
        ultimaFecha = t;
        ultimoAbono = Number(g.cantidad) || 0;
      }
    }
  });

  const gastoFijo = (ultimoAbono / 6) + comidaDiaria + (kmProm * 0.6);

  panelData.parametros.gastoFijo = gastoFijo;
  guardarPanelData();

  const inp = $("proyGastoFijo");
  if (inp) {
    inp.value = gastoFijo.toFixed(2);
    inp.readOnly = true;
    inp.style.background = "#eee";
  }
}

// ======================
// Movimientos
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
  renderMovimientos();
}

function renderMovimientos() {
  const tbody = $("tablaMovimientos");
  if (!tbody) return;

  tbody.innerHTML = "";
  const rows = panelData.movimientos.slice(0, 25);

  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center">No hay movimientos</td></tr>`;
    return;
  }

  rows.forEach(r => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.tipo}</td>
      <td>${r.descripcion}</td>
      <td>$${fmtMoney(r.monto)}</td>
      <td>${r.fechaLocal}</td>
    `;
    tbody.appendChild(tr);
  });
}

renderMovimientos();
// ======================
// app.js — PARTE 2/4
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
    renderResumenIndex();
  });
}
setupIngresoListeners();

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

    // Si es gasto de comida, recalcular gasto fijo
    if (cat === "Comida") calcularGastoFijoAuto();

    pushMovimiento("Gasto", `${desc} (${cat})`, qty);
    guardarPanelData();

    $("gastoDescripcion").value = "";
    $("gastoCantidad").value = "";

    alert("Gasto registrado.");
    renderResumenIndex();
  });
}
setupGastoListeners();

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

    const opt = document.createElement("option");
    opt.value = idx;
    opt.textContent = `${d.nombre} — $${fmtMoney(pendiente)} pendiente`;
    select.appendChild(opt);
  });

  if (panelData.deudas.length === 0) {
    list.innerHTML = "<li>No hay deudas registradas.</li>";
    select.innerHTML = `<option value="">-- No hay deudas --</option>`;
  }
}

$("btnRegistrarDeuda")?.addEventListener("click", () => {
  const nombre = ($("deudaNombre")?.value || "").trim();
  const monto = Number($("deudaMonto")?.value || 0);

  if (!nombre || !monto || monto <= 0) return alert("Datos inválidos.");

  panelData.deudas.push({ nombre, monto, abonado: 0 });

  guardarPanelData();
  renderDeudas();

  // recalcular automáticamente
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

  // asegurar campo abonado
  panelData.deudas[idx].abonado = (Number(panelData.deudas[idx].abonado) || 0) + monto;

  // registrar gasto tipo abono
  panelData.gastos.push({
    descripcion: `Abono a ${panelData.deudas[idx].nombre}`,
    cantidad: monto,
    categoria: "Abono a Deuda",
    fechaISO: nowISO(),
    fechaLocal: nowLocal()
  });

  pushMovimiento("Gasto", `Abono a ${panelData.deudas[idx].nombre}`, monto);

  guardarPanelData();
  renderDeudas();

  // recalcular automáticamente al registrar abono
  calcularDeudaTotalAuto();
  calcularGastoFijoAuto();

  $("abonoMonto").value = "";
  alert("Abono guardado.");

  renderResumenIndex();
});

renderDeudas();
// ======================
// app.js — PARTE 3/4
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
    if (isNaN(ini) || isNaN(fin) || fin <= ini) return alert("KM inválidos.");

    panelData.kmDiarios.push({
      fechaISO: nowISO(),
      fechaLocal: nowLocal(),
      kmInicial: ini,
      kmFinal: fin,
      recorrido: fin - ini
    });

    // Guardar KM final para usarlo mañana como inicial
    panelData.parametros = panelData.parametros || {};
    panelData.parametros.ultimoKMfinal = fin;
    guardarPanelData();

    // recalcular gasto fijo al guardar KM
    calcularGastoFijoAuto();

    // limpiar inputs
    $("kmInicial").value = "";
    $("kmFinal").value = "";
    $("kmRecorridos").textContent = "0";

    alert("Kilometraje guardado.");
    renderResumenIndex();
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

    // registrar gasto
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
    renderResumenIndex();
  });
}
setupKmAndGasListeners();

// ======================
// Importar / Exportar JSON
// ======================
$("btnExportar")?.addEventListener("click", () => {
  const json = JSON.stringify(panelData, null, 2);

  navigator.clipboard.writeText(json)
    .then(() => alert("Datos copiados al portapapeles."))
    .catch(() => {
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");

      a.href = url;
      a.download = `backup_${Date.now()}.json`;
      a.click();

      URL.revokeObjectURL(url);

      alert("Backup descargado.");
    });
});

$("btnImportar")?.addEventListener("click", () => {
  const raw = ($("importJson")?.value || "").trim();

  if (!raw) return alert("Pega tu JSON primero.");

  try {
    const parsed = JSON.parse(raw);

    panelData = Object.assign({}, panelData, parsed);
    panelData.parametros = Object.assign({}, panelData.parametros, parsed.parametros);

    guardarPanelData();

    renderMovimientos();
    renderDeudas();
    renderResumenIndex();

    // recalcular parámetros automáticos después de la importación
    calcularDeudaTotalAuto();
    calcularGastoFijoAuto();

    alert("Importación correcta ✔");

  } catch (e) {
    console.error(e);
    alert("JSON inválido.");
  }
});
// ======================
// app.js — PARTE 4/4
// ======================

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
    txt.textContent = "Turno en curso";
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

  if (!gan) return alert("Monto inválido.");

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

  alert("Turno finalizado.");
  renderResumenIndex();
}

// ======================
// Inicializar y UI fija
// ======================
document.addEventListener("DOMContentLoaded", () => {
  cargarPanelData();
  actualizarUIturno();

  // Poner KM inicial automático si existe último KM final
  if (panelData.parametros && panelData.parametros.ultimoKMfinal) {
    const inputIni = $("kmInicial");
    if (inputIni) inputIni.value = panelData.parametros.ultimoKMfinal;
  }

  // Marcar inputs de proyección como solo lectura y gris
  const inpDeuda = $("proyDeudaTotal");
  const inpGasto = $("proyGastoFijo");
  if (inpDeuda) { inpDeuda.readOnly = true; inpDeuda.style.background = "#eee"; }
  if (inpGasto) { inpGasto.readOnly = true; inpGasto.style.background = "#eee"; }

  renderMovimientos();
  renderDeudas();
  renderResumenIndex();
  renderTablaTurnos();
  renderCharts();

  // parámetros automáticos al cargar admin.html
  calcularDeudaTotalAuto();
  calcularGastoFijoAuto();
});

// ======================
// Resumen del día (ARREGLADO)
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

  arr.forEach(t => {
    tbody.innerHTML += `
      <tr>
        <td>${(t.inicio || "").slice(0,10)}</td>
        <td>${(Number(t.horas) || 0).toFixed(2)}</td>
        <td>$${fmtMoney(t.ganancia)}</td>
        <td>$0.00</td>
        <td>$${fmtMoney(t.ganancia)}</td>
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
    if (diasParaLiquidar === Infinity) {
      $("proyDias").style.display = "none";
    } else {
      $("proyDias").style.display = "inline";
      $("proyDias").textContent = Math.ceil(diasParaLiquidar) + " días";
    }
  }
}

// ======================
// Gráficas & Export (mismos helpers que antes)
// ======================
// ... (si tu versión tiene funciones de gráficos, mantenlas aquí)
// Puedes pegar las funciones aggregateGananciasGastos, renderCharts, export a Excel, etc.
// FIN DEL ARCHIVO
