// ======================
// app.js — PARTE 1/3
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
    gastoFijo: 0
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

// Cargar al inicio
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
// NUEVAS FUNCIONES (INTEGRADAS)
// -----------------------------

// A) calcularDeudaTotalAuto: suma de (monto - abonado), guarda y pinta input readonly
function calcularDeudaTotalAuto() {
  const deudas = panelData.deudas || [];

  const total = deudas.reduce((s, d) => {
    const pendiente = (Number(d.monto) || 0) - (Number(d.abonado) || 0);
    return s + pendiente;
  }, 0);

  panelData.parametros = panelData.parametros || {};
  panelData.parametros.deudaTotal = total;
  guardarPanelData();

  const inp = document.getElementById("proyDeudaTotal");
  if (inp) {
    inp.value = total.toFixed(2);
    inp.readOnly = true;
    inp.style.background = "#eee";
  }
}

// B) calcularGastoFijoAuto: encuentra el último abono (por fecha) y aplica la fórmula
function calcularGastoFijoAuto() {
  panelData.parametros = panelData.parametros || {};

  const comidaDiaria = 200;

  const kmArr = panelData.kmDiarios || [];
  const kmProm = kmArr.length
    ? kmArr.reduce((s, k) => s + (Number(k.recorrido) || 0), 0) / kmArr.length
    : 0;

  // buscar el último abono en panelData.gastos con categoria "Abono a Deuda"
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

  const inp = document.getElementById("proyGastoFijo");
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
// Registrar ingreso
// ======================
function setupIngresoListeners() {
  const btn = $("btnGuardarIngreso");
  if (!btn) return;

  btn.addEventListener("click", () => {
    const desc = $("ingresoDescripcion")?.value?.trim();
    const qty = Number($("ingresoCantidad")?.value);

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
    const desc = $("gastoDescripcion")?.value?.trim();
    const qty = Number($("gastoCantidad")?.value);
    const cat = $("gastoCategoria")?.value || "Otros";

    if (!desc || !qty || qty <= 0) return alert("Datos de gasto inválidos.");

    panelData.gastos.push({
      descripcion: desc,
      cantidad: qty,
      categoria: cat,
      fechaISO: nowISO(),
      fechaLocal: nowLocal()
    });

    pushMovimiento("Gasto", `${desc} (${cat})`, qty);
    guardarPanelData();

    $("gastoDescripcion").value = "";
    $("gastoCantidad").value = "";

    // Si es gasto de comida, recalcular gasto fijo
    if (cat === "Comida") {
      calcularGastoFijoAuto();
    }

    alert("Gasto registrado.");
    renderResumenIndex();
  });
}
setupGastoListeners();
// ======================
// app.js — PARTE 2/3
// ======================

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
    const pendiente = d.monto - (d.abonado || 0);

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

// registrar deuda
$("btnRegistrarDeuda")?.addEventListener("click", () => {
  const nombre = $("deudaNombre")?.value?.trim();
  const monto = Number($("deudaMonto")?.value);

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

// registrar abono
$("btnRegistrarAbono")?.addEventListener("click", () => {
  const idx = $("abonoSeleccionar")?.value;
  const monto = Number($("abonoMonto")?.value);

  if (idx === "" || monto <= 0) return alert("Datos inválidos.");

  panelData.deudas[idx].abonado += monto;
  if (panelData.deudas[idx].abonado > panelData.deudas[idx].monto)
    panelData.deudas[idx].abonado = panelData.deudas[idx].monto;

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

  // recalcular automáticamente (al registrar abono)
  calcularDeudaTotalAuto();
  calcularGastoFijoAuto();

  $("abonoMonto").value = "";
  alert("Abono guardado.");

  renderResumenIndex();
});

renderDeudas();

// ======================
// KM y Gasolina
// ======================
function setupKmAndGasListeners() {
  $("kmFinal")?.addEventListener("input", () => {
    const ini = Number($("kmInicial")?.value) || 0;
    const fin = Number($("kmFinal")?.value) || 0;
    const rec = (fin > ini) ? (fin - ini) : 0;

    if ($("kmRecorridos")) $("kmRecorridos").textContent = rec;
  });

  $("btnGuardarKm")?.addEventListener("click", () => {
    const ini = Number($("kmInicial")?.value);
    const fin = Number($("kmFinal")?.value);
    if (fin <= ini) return alert("KM inválidos.");

    panelData.kmDiarios.push({
      fechaISO: nowISO(),
      fechaLocal: nowLocal(),
      kmInicial: ini,
      kmFinal: fin,
      recorrido: fin - ini
    });

    guardarPanelData();

    // recalcular gasto fijo al guardar KM
    calcularGastoFijoAuto();

    $("kmInicial").value = "";
    $("kmFinal").value = "";
    $("kmRecorridos").textContent = "0";

    alert("Kilometraje guardado.");
    renderResumenIndex();
  });

  $("btnGuardarGas")?.addEventListener("click", () => {
    const litros = Number($("litrosGas")?.value);
    const costo = Number($("costoGas")?.value);

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
  const raw = $("importJson")?.value;

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
    alert("JSON inválido.");
  }
});
// ======================
// app.js — PARTE 3/3
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

document.addEventListener("DOMContentLoaded", () => {
  cargarPanelData();
  actualizarUIturno();
  renderMovimientos();
  renderDeudas();
  renderResumenIndex();
  renderTablaTurnos();
  renderCharts();

  // recalcular y pintar parámetros automáticos al cargar admin.html
  calcularDeudaTotalAuto();
  calcularGastoFijoAuto();
});

// ======================
// Resumen del día (Index)
// ======================
function calcularResumenDatos() {
  const hoy = new Date().toISOString().slice(0, 10);

  const ingresosHoy = panelData.ingresos.filter(i => (i.fechaISO || "").slice(0, 10) === hoy);
  const gastosHoy = panelData.gastos.filter(g => (g.fechaISO || "").slice(0, 10) === hoy);
  const turnosHoy = panelData.turnos.filter(t => (t.inicio || "").slice(0, 10) === hoy);

  return {
    horasHoy: turnosHoy.reduce((s, t) => s + t.horas, 0),
    ganHoy: ingresosHoy.reduce((s, i) => s + i.cantidad, 0),
    gastHoy: gastosHoy.reduce((s, g) => s + g.cantidad, 0)
  };
}

function renderResumenIndex() {
  const r = calcularResumenDatos();

  $("resHoras") && ( $("resHoras").textContent = r.horasHoy.toFixed(2) );
  $("resGananciaBruta") && ( $("resGananciaBruta").textContent = "$" + fmtMoney(r.ganHoy) );
  $("resGastos") && ( $("resGastos").textContent = "$" + fmtMoney(r.gastHoy) );
  $("resNeta") && ( $("resNeta").textContent = "$" + fmtMoney(r.ganHoy - r.gastHoy) );

  renderTablaTurnos();
  renderCharts();
  calcularProyeccionReal();
}

// ======================
// Tabla turnos
// ======================
function renderTablaTurnos() {
  const tbody = $("tablaTurnos");
  if (!tbody) return;

  tbody.innerHTML = "";

  const arr = [...panelData.turnos].reverse();

  if (arr.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center">No hay turnos</td></tr>`;
    return;
  }

  arr.forEach(t => {
    tbody.innerHTML += `
      <tr>
        <td>${(t.inicio || "").slice(0,10)}</td>
        <td>${t.horas.toFixed(2)}</td>
        <td>$${fmtMoney(t.ganancia)}</td>
        <td>$0.00</td>
        <td>$${fmtMoney(t.ganancia)}</td>
      </tr>
    `;
  });
}

// ======================
// Proyección real
// ======================
function calcularProyeccionReal() {
  const p = panelData.parametros;
  const deudaTotal = Number(p.deudaTotal || 0);
  const gastoFijo = Number(p.gastoFijo || 0);

  const turnos = panelData.turnos;
  const diasTrabajados = new Set(turnos.map(t => t.inicio.slice(0,10))).size;

  const totalHoras = turnos.reduce((s,t)=>s+t.horas,0);
  const totalGan = turnos.reduce((s,t)=>s+t.ganancia,0);

  const horasPromDia = diasTrabajados ? totalHoras/diasTrabajados : 0;
  const ganPromDia   = diasTrabajados ? totalGan/diasTrabajados : 0;

  const gastos = panelData.gastos;
  const gastosPorFecha = {};

  gastos.forEach(g=>{
    const key=(g.fechaISO||"").slice(0,10);
    gastosPorFecha[key]=(gastosPorFecha[key]||0)+g.cantidad;
  });

  const gastoPromDia = Object.values(gastosPorFecha).reduce((s,v)=>s+v,0) /
                        (Object.keys(gastosPorFecha).length || 1);

  const netaPromDia = ganPromDia - gastoPromDia;
  const netaParaDeuda = netaPromDia - gastoFijo;

  let diasParaLiquidar = Infinity;
  if(netaParaDeuda>0 && deudaTotal>0){
    diasParaLiquidar = deudaTotal/netaParaDeuda;
  }

  $("proyDeuda") && ( $("proyDeuda").textContent = "$"+fmtMoney(deudaTotal) );
  $("proyHoras") && ( $("proyHoras").textContent = horasPromDia.toFixed(2)+" h" );
  $("proyNeta") && ( $("proyNeta").textContent = "$"+fmtMoney(netaPromDia) );
  $("proyDias") && (
    $("proyDias").textContent = (diasParaLiquidar===Infinity ? "Imposible" : Math.ceil(diasParaLiquidar)+" días")
  );
}

// guardar parámetros
$("btnGuardarProyeccion")?.addEventListener("click", ()=>{
  panelData.parametros.deudaTotal = Number($("proyDeudaTotal")?.value) || 0;
  panelData.parametros.gastoFijo  = Number($("proyGastoFijo")?.value) || 0;

  guardarPanelData();
  calcularProyeccionReal();

  alert("Parámetros guardados.");
});

// ======================
// Gráficas
// ======================
let chartGanancias = null;
let chartKm = null;

function aggregateGananciasGastos(days = 14){
  const labels=[], ingresosArr=[], gastosArr=[];
  const today = new Date();

  for(let i=days-1;i>=0;i--){
    const d = new Date(today.getTime()-i*86400000);
    const key = d.toISOString().slice(0,10);

    labels.push(key);

    const ing = panelData.ingresos.filter(x=>x.fechaISO?.slice(0,10)===key)
                                  .reduce((s,v)=>s+v.cantidad,0);

    const gas = panelData.gastos.filter(x=>x.fechaISO?.slice(0,10)===key)
                                 .reduce((s,v)=>s+v.cantidad,0);

    ingresosArr.push(ing);
    gastosArr.push(gas);
  }

  return {labels, ingresosArr, gastosArr};
}

function renderCharts(){
  const ctx1 = $("graficaGanancias");

  // Ganancias vs Gastos
  if(ctx1){
    const agg = aggregateGananciasGastos();

    if(chartGanancias) chartGanancias.destroy();

    chartGanancias = new Chart(ctx1, {
      type:"bar",
      data:{
        labels: agg.labels,
        datasets:[
          {label:"Ingresos", data:agg.ingresosArr},
          {label:"Gastos", data:agg.gastosArr}
        ]
      },
      options:{ responsive:true }
    });
  }

  // KM / Gasolina
  const ctx2 = $("graficaKm");
  if(ctx2){
    const labels = panelData.gasolina.map(g=>g.fechaISO.slice(0,10));
    const datosGas = panelData.gasolina.map(g=>g.costo);

    if(chartKm) chartKm.destroy();

    chartKm = new Chart(ctx2, {
      type:"line",
      data:{
        labels,
        datasets:[
          { label:"Gasto gasolina", data:datosGas }
        ]
      },
      options:{ responsive:true }
    });
  }
}

// ======================
// Exportar a Excel (.xlsx)
// ======================
const scriptXLSX = document.createElement("script");
scriptXLSX.src =
  "https://cdn.jsdelivr.net/npm/xlsx/dist/xlsx.full.min.js";
document.head.appendChild(scriptXLSX);

$("btnExportarExcel")?.addEventListener("click", () => {

  try {
      const libro = XLSX.utils.book_new();

      function agregarHoja(nombre, objArray) {
          const hoja = XLSX.utils.json_to_sheet(objArray);
          XLSX.utils.book_append_sheet(libro, hoja, nombre);
      }

      agregarHoja("Ingresos", panelData.ingresos);
      agregarHoja("Gastos", panelData.gastos);
      agregarHoja("Movimientos", panelData.movimientos);
      agregarHoja("Turnos", panelData.turnos);
      agregarHoja("KM_Diarios", panelData.kmDiarios);
      agregarHoja("Gasolina", panelData.gasolina);
      agregarHoja("Deudas", panelData.deudas);
      agregarHoja("Parametros", [panelData.parametros]);

      const fecha = new Date().toISOString().slice(0,10);
      XLSX.writeFile(libro, `UberEats_Export_${fecha}.xlsx`);

      alert("📄 Archivo Excel generado correctamente ✔");

  } catch (e) {
      console.error(e);
      alert("Error al generar Excel");
  }
});

// ======================
// Inicializar al cargar
// ======================
document.addEventListener("DOMContentLoaded", () => {
  cargarPanelData();
  actualizarUIturno();
  renderMovimientos();
  renderDeudas();
  renderResumenIndex();
  renderTablaTurnos();
  renderCharts();

  // recalcular y pintar parámetros automáticos al cargar admin.html
  calcularDeudaTotalAuto();
  calcularGastoFijoAuto();
});
