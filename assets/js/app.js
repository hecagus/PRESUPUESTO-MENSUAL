/* assets/js/app.js
   Versión final: limpio y funcional
   - Persistencia (localStorage)
   - Turnos (iniciar / finalizar) -> guarda turno y crea ingreso
   - Proyecciones reales basadas en turnos históricos y gastos reales
   - Gráficas (Chart.js) para Ingresos vs Gastos y Km vs Gasolina
   - Export/Import JSON
   - Export CSV proyección
   - Renderizado tablas Admin / Index
*/

/* -------------------------
   STORAGE y datos iniciales
   ------------------------- */
let ingresos = JSON.parse(localStorage.getItem("ingresos")) || [];
let gastos = JSON.parse(localStorage.getItem("gastos")) || [];
let kilometrajes = JSON.parse(localStorage.getItem("kilometrajes")) || [];
let gasolinas = JSON.parse(localStorage.getItem("gasolinas")) || [];
let deudas = JSON.parse(localStorage.getItem("deudas")) || [];
let proyeccionParams = JSON.parse(localStorage.getItem("proyeccionParams")) || {};
let turnos = JSON.parse(localStorage.getItem("turnos")) || [];
let turnoActivo = JSON.parse(localStorage.getItem("turnoActivo")) || false;
let turnoInicio = localStorage.getItem("turnoInicio") || null;

/* -------------------------
   CONSTANTES / HELPERS
   ------------------------- */
const TASA_GANANCIA_HR_DEFAULT = 101.56;
const DEUDA_META_DEFAULT = 19793;
const DIAS_RESTANTES_DEFAULT = 33;

const PROJECTION_INPUT_IDS = [
  "inputDiasRestantes",
  "inputDeudaMeta",
  "inputGananciaHr",
  "gastoComidaDiario",
  "gastoMotoDiario",
  "gastoDeudaOtroDiario",
  "inputHorasTrabajadas"
];

const $ = id => document.getElementById(id);
const safeOn = (id, evt, fn) => { const el = $(id); if (el) el.addEventListener(evt, fn); };
const fmt = n => Number(n||0).toFixed(2);
const generarId = () => Date.now().toString(36) + Math.random().toString(36).slice(2,8);

function persistAll() {
  localStorage.setItem("ingresos", JSON.stringify(ingresos));
  localStorage.setItem("gastos", JSON.stringify(gastos));
  localStorage.setItem("kilometrajes", JSON.stringify(kilometrajes));
  localStorage.setItem("gasolinas", JSON.stringify(gasolinas));
  localStorage.setItem("deudas", JSON.stringify(deudas));
  localStorage.setItem("proyeccionParams", JSON.stringify(proyeccionParams));
  localStorage.setItem("turnos", JSON.stringify(turnos));
  localStorage.setItem("turnoActivo", JSON.stringify(turnoActivo));
  if (turnoInicio) localStorage.setItem("turnoInicio", turnoInicio); else localStorage.removeItem("turnoInicio");
}

/* -------------------------
   Proyección params (guardado/recuperado)
   ------------------------- */
function saveProjectionParams() {
  PROJECTION_INPUT_IDS.forEach(id => {
    const el = $(id);
    if (el) proyeccionParams[id] = el.value;
  });
  persistAll();
}

function loadProjectionParams() {
  PROJECTION_INPUT_IDS.forEach(id => {
    const el = $(id);
    if (el && proyeccionParams[id] !== undefined) el.value = proyeccionParams[id];
  });
}

/* -------------------------
   Categorías y formularios básicos (admin)
   ------------------------- */
const CATEGORIAS_GASTO = ["Transporte","Comida","Servicios","Alquiler","Hogar/Vivienda","Ocio/Entretenimiento","Otros","Abono a Deuda"];

function renderCategorias() {
  const select = $("gastoCategoria");
  if (select) {
    const categoriasVisibles = CATEGORIAS_GASTO.filter(c => c !== "Abono a Deuda");
    select.innerHTML = categoriasVisibles.map(c => `<option value="${c}">${c}</option>`).join('');
  }
}

/* Formularios: Ingreso */
safeOn("formIngreso", "submit", e => {
  e.preventDefault();
  const desc = $("ingresoDescripcion")?.value?.trim();
  const qty = Number($("ingresoCantidad")?.value);
  if (!desc || !qty || Number.isNaN(qty)) return alert("Completa descripción y cantidad válidas.");
  ingresos.push({ id: generarId(), descripcion: desc, cantidad: qty, fecha: new Date().toISOString() });
  persistAll();
  e.target.reset();
  renderAdminTables();
});

/* Formularios: Gasto */
safeOn("formGasto", "submit", e => {
  e.preventDefault();
  const desc = $("gastoDescripcion")?.value?.trim();
  const qty = Number($("gastoCantidad")?.value);
  const cat = $("gastoCategoria")?.value || "Otros";
  if (!desc || !qty || Number.isNaN(qty)) return alert("Completa descripción y cantidad válidas.");
  gastos.push({ id: generarId(), descripcion: desc, cantidad: qty, categoria: cat, fecha: new Date().toISOString() });
  persistAll();
  e.target.reset();
  renderAdminTables();
});

/* Nueva deuda */
safeOn("formNuevaDeuda", "submit", e => {
  e.preventDefault();
  const nombre = $("deudaNombre")?.value?.trim();
  const monto = Number($("deudaMonto")?.value);
  if (!nombre || !monto || Number.isNaN(monto) || monto <= 0) return alert("Ingresa nombre y monto válidos.");
  deudas.push({ id: generarId(), nombre, montoInicial: monto, montoActual: monto, fechaCreacion: new Date().toISOString() });
  persistAll();
  e.target.reset();
  renderDeudasAdmin();
  renderAdminTables();
});

/* Abono a deuda */
safeOn("formAbonoDeuda", "submit", e => {
  e.preventDefault();
  const deudaId = $("selectDeuda")?.value;
  const abonoMonto = Number($("abonoMonto")?.value);
  const deudaIndex = deudas.findIndex(d => d.id === deudaId);
  if (deudaIndex === -1) return alert("Selecciona una deuda válida.");
  if (!abonoMonto || Number.isNaN(abonoMonto) || abonoMonto <= 0) return alert("Monto de abono inválido.");
  if (abonoMonto > deudas[deudaIndex].montoActual) return alert("El abono excede el monto actual de la deuda.");
  deudas[deudaIndex].montoActual -= abonoMonto;
  gastos.push({ id: generarId(), descripcion: `Abono a: ${deudas[deudaIndex].nombre}`, cantidad: abonoMonto, categoria: "Abono a Deuda", fecha: new Date().toISOString() });
  persistAll();
  e.target.reset();
  renderDeudasAdmin();
  renderAdminTables();
});

/* renderDeudasAdmin */
function renderDeudasAdmin() {
  const select = $("selectDeuda");
  const lista = $("lista-deudas");
  if (!select || !lista) return;
  select.innerHTML = '<option value="">-- Seleccione una deuda --</option>';
  lista.innerHTML = '';
  const deudasPendientes = deudas.filter(d => (d.montoActual || 0) > 0);
  if (deudasPendientes.length === 0) {
    lista.innerHTML = '<li>No hay deudas pendientes.</li>';
    return;
  }
  deudasPendientes.forEach(d => {
    const opt = document.createElement("option");
    opt.value = d.id;
    opt.textContent = `${d.nombre} ($${fmt(d.montoActual)})`;
    select.appendChild(opt);
    const li = document.createElement("li");
    li.innerHTML = `<span>${d.nombre}</span><span class="debt-amount">$${fmt(d.montoActual)}</span>`;
    lista.appendChild(li);
  });
}

/* -------------------------
   KM / Gasolina
   ------------------------- */
function obtenerGastoVariableGasolina() {
  const kmTotales = kilometrajes.reduce((s,k)=>s + (k.kmRecorridos||0), 0) + gasolinas.reduce((s,g)=>s + (g.kmRecorridos||0), 0);
  const gastoCombustibleTotal = gasolinas.reduce((s,g)=>s + (g.totalPagado||0), 0);
  const KM_DIARIO_PROMEDIO = 200;
  const precioKmPromedio = kmTotales > 0 ? (gastoCombustibleTotal / kmTotales) : 0;
  const gastoGasolinaDiario = precioKmPromedio * KM_DIARIO_PROMEDIO;
  return { precioKmPromedio, gastoGasolinaDiario: Number(gastoGasolinaDiario.toFixed(2)) };
}

function obtenerCamposKm() {
  const ini = Number($("kmInicialConsolidado")?.value);
  const fin = Number($("kmFinalConsolidado")?.value);
  const lt = Number($("litrosConsolidado")?.value);
  const totalPagado = Number($("costoTotalConsolidado")?.value);
  const kmRec = (fin > ini) ? (fin - ini) : 0;
  const precioKm = (kmRec > 0 && totalPagado > 0) ? (totalPagado / kmRec) : 0;
  if (!Number.isFinite(ini) || !Number.isFinite(fin) || fin <= ini) return false;
  return { ini, fin, lt, totalPagado, kmRec, precioKm };
}

function actualizarKmUI() {
  const ini = Number($("kmInicialConsolidado")?.value || 0);
  const fin = Number($("kmFinalConsolidado")?.value || 0);
  const totalPagado = Number($("costoTotalConsolidado")?.value || 0);
  const kmRec = (fin > ini) ? (fin - ini) : 0;
  const precioKm = (kmRec > 0 && totalPagado > 0) ? (totalPagado / kmRec) : 0;
  if ($("kmRecorridosConsolidado")) $("kmRecorridosConsolidado").textContent = kmRec;
  if ($("precioKmConsolidado")) $("precioKmConsolidado").textContent = fmt(precioKm);
}

function precargarKmInicial() {
  const kmInput = $("kmInicialConsolidado");
  if (!kmInput) return;
  const allKmEntries = [
    ...kilometrajes.map(k => ({ kmFinal: k.kmFinal, fecha: k.fecha })),
    ...gasolinas.map(g => ({ kmFinal: g.kmFinal, fecha: g.fecha }))
  ].sort((a,b)=>new Date(b.fecha)-new Date(a.fecha));
  if (allKmEntries.length > 0) {
    const lastKmFinal = allKmEntries[0].kmFinal;
    if (kmInput.value === "" || Number(kmInput.value) === 0) kmInput.value = lastKmFinal;
    actualizarKmUI();
  }
}

["kmInicialConsolidado","kmFinalConsolidado","litrosConsolidado","costoTotalConsolidado"].forEach(id=>{
  const el = $(id);
  if (el) el.addEventListener("input", actualizarKmUI);
});

safeOn("btnGuardarKmDiario","click",()=>{
  const data = obtenerCamposKm();
  if (!data) return alert("KM Inicial y KM Final inválidos.");
  kilometrajes.push({ id: generarId(), kmInicial: data.ini, kmFinal: data.fin, kmRecorridos: data.kmRec, fecha: new Date().toISOString() });
  persistAll();
  const form = $("formKmConsolidado");
  if (form) form.reset();
  precargarKmInicial();
  actualizarKmUI();
  renderAdminTables();
});

safeOn("formKmConsolidado","submit", e=>{
  e.preventDefault();
  const data = obtenerCamposKm();
  if (!data) return alert("KM Inicial y KM Final inválidos.");
  if (!Number.isFinite(data.lt) || data.lt <= 0 || !Number.isFinite(data.totalPagado) || data.totalPagado <= 0) {
    return alert("Para repostaje completa litros y costo total válidos.");
  }
  const costoLitro = data.totalPagado / data.lt;
  gasolinas.push({ id: generarId(), kmInicial: data.ini, kmFinal: data.fin, kmRecorridos: data.kmRec, litros: data.lt, costoLitro, totalPagado: data.totalPagado, precioPorKm: data.precioKm, fecha: new Date().toISOString() });
  gastos.push({ id: generarId(), descripcion:`Gasolina ${data.lt}L @ ${fmt(costoLitro)}/L`, cantidad: data.totalPagado, categoria: "Transporte", fecha: new Date().toISOString() });
  persistAll();
  e.target.reset();
  precargarKmInicial();
  actualizarKmUI();
  renderAdminTables();
});

/* -------------------------
   TURNOS (iniciar / finalizar)
   ------------------------- */
function iniciarTurno() {
  if (turnoActivo) return;
  turnoActivo = true;
  turnoInicio = new Date().toISOString();
  persistAll();
  actualizarBotonesTurno();
  alert("Turno iniciado.");
}

function finalizarTurno() {
  if (!turnoActivo) return alert("No hay turno activo.");
  const inicio = new Date(turnoInicio);
  const fin = new Date();
  const horas = Number(((fin - inicio) / 1000 / 60 / 60).toFixed(2));
  // solicitar ganancia
  let entrada = prompt(`Turno finalizado.\nHoras trabajadas: ${horas} h\nIngresa la GANANCIA neta del turno (MXN):`);
  if (entrada === null) return; // usuario canceló
  entrada = entrada.replace(',', '.').trim();
  const ganancia = Number(entrada);
  if (!ganancia || Number.isNaN(ganancia) || ganancia <= 0) {
    return alert("Ganancia inválida. No se registró el turno.");
  }
  // crear objeto turno
  const turnoObj = { id: generarId(), inicio: inicio.toISOString(), fin: fin.toISOString(), horas, ganancia };
  turnos.push(turnoObj);
  // registrar ingreso automático
  ingresos.push({ id: generarId(), descripcion: `Ganancia turno (${horas} h)`, cantidad: ganancia, fecha: new Date().toISOString(), turnoId: turnoObj.id });
  // reset
  turnoActivo = false;
  turnoInicio = null;
  persistAll();
  actualizarBotonesTurno();
  renderAdminTables();
  renderIndex(); // actualizar vistas y gráficas
  alert("Turno registrado correctamente.");
}

function actualizarBotonesTurno() {
  const btnInicio = $("btnIniciarTurno");
  const btnFin = $("btnFinalizarTurno");
  if (!btnInicio || !btnFin) return;
  if (turnoActivo) {
    btnInicio.style.display = "none";
    btnFin.style.display = "inline-block";
  } else {
    btnInicio.style.display = "inline-block";
    btnFin.style.display = "none";
  }
}

/* -------------------------
   PROYECCIÓN REAL
   - usa turnos históricos para obtener ganancia/hr real
   - combina con gastos fijos y gasolina variable
   ------------------------- */
function getProjectionParams(source='UI') {
  const reader = source==='UI' ? (id) => $(id)?.value : (id) => proyeccionParams[id];
  const gastoComidaDiario = Number(reader('gastoComidaDiario') || proyeccionParams['gastoComidaDiario'] || 0);
  const gastoMotoDiario = Number(reader('gastoMotoDiario') || proyeccionParams['gastoMotoDiario'] || 0);
  const gastoDeudaOtroDiario = Number(reader('gastoDeudaOtroDiario') || proyeccionParams['gastoDeudaOtroDiario'] || 0);
  const gas = obtenerGastoVariableGasolina();
  const gastoFijoDiarioTotal = gastoComidaDiario + gastoMotoDiario + gastoDeudaOtroDiario;
  const gastoTotalProyeccion = gastoFijoDiarioTotal + gas.gastoGasolinaDiario;

  // calcular ganancia/hr real a partir de turnos
  let gananciaHrReal = TASA_GANANCIA_HR_DEFAULT;
  if (turnos.length > 0) {
    const totalGan = turnos.reduce((s,t) => s + (t.ganancia||0), 0);
    const totalHoras = turnos.reduce((s,t) => s + (t.horas||0), 0);
    if (totalHoras > 0) gananciaHrReal = totalGan / totalHoras;
  }

  return {
    diasRestantes: Number(reader('inputDiasRestantes') || proyeccionParams['inputDiasRestantes'] || DIAS_RESTANTES_DEFAULT),
    deudaMeta: Number(reader('inputDeudaMeta') || proyeccionParams['inputDeudaMeta'] || DEUDA_META_DEFAULT),
    gananciaHr: Number(reader('inputGananciaHr') || proyeccionParams['inputGananciaHr'] || gananciaHrReal),
    horasTrabajadas: Number(reader('inputHorasTrabajadas') || proyeccionParams['inputHorasTrabajadas'] || 8),
    gastoFijoDiarioTotal,
    gastoTotalProyeccion
  };
}

function calcularProyeccion(horasDiarias, params) {
  const { diasRestantes, deudaMeta, gananciaHr, gastoTotalProyeccion } = params;
  const gananciaDiaria = horasDiarias * gananciaHr;
  const sobranteDiario = Math.max(0, gananciaDiaria - gastoTotalProyeccion);
  const pagoDeudaPotencial = sobranteDiario * diasRestantes;
  const porcentajeCubierto = deudaMeta > 0 ? (pagoDeudaPotencial / deudaMeta) * 100 : 0;
  const deudaLiquidada = pagoDeudaPotencial >= deudaMeta;
  return {
    horasDiarias,
    gananciaDiaria: Number(gananciaDiaria.toFixed(2)),
    gananciaSemanal: Number((gananciaDiaria*7).toFixed(2)),
    gananciaTotalDias: Number((gananciaDiaria*diasRestantes).toFixed(2)),
    sobranteDiario: Number(sobranteDiario.toFixed(2)),
    pagoDeudaPotencial: Number(pagoDeudaPotencial.toFixed(2)),
    porcentajeCubierto: Math.min(100, Number(porcentajeCubierto.toFixed(2))),
    deudaLiquidada
  };
}

let resultadosEscenariosFijos = [];

function renderProyeccion(context) {
  const isUI = context === 'admin';
  if (isUI) { saveProjectionParams(); loadProjectionParams(); }
  const params = getProjectionParams(isUI ? 'UI' : 'STORE');
  const { diasRestantes, deudaMeta, gastoFijoDiarioTotal, gastoTotalProyeccion, horasTrabajadas } = params;

  if ($("gastoFijoDiarioTotal")) $("gastoFijoDiarioTotal").textContent = `$${fmt(gastoFijoDiarioTotal)}`;
  if ($("gastoTotalProyeccion")) $("gastoTotalProyeccion").textContent = `$${fmt(gastoTotalProyeccion)}`;
  if ($("deudaMetaTotal")) $("deudaMetaTotal").textContent = fmt(deudaMeta);
  if ($("diasRestantesSimulador")) $("diasRestantesSimulador").textContent = diasRestantes;

  resultadosEscenariosFijos = [
    calcularProyeccion(8, params),
    calcularProyeccion(10, params),
    calcularProyeccion(12, params)
  ];

  // render tabla
  const tablaBody = $("tabla-proyeccion")?.querySelector('tbody');
  const barrasDiv = $("proyeccion-barras");
  if (tablaBody) tablaBody.innerHTML = '';
  if (barrasDiv) barrasDiv.innerHTML = '';

  resultadosEscenariosFijos.forEach((res, idx) => {
    const nombre = ['Moderado (8h)','Agresivo (10h)','Máximo (12h)'][idx];
    if (tablaBody) {
      const tr = document.createElement('tr');
      const pagoClase = res.pagoDeudaPotencial > 0 ? 'valor-positivo' : '';
      tr.innerHTML = `<td>${nombre}</td><td>$${fmt(res.gananciaTotalDias)}</td><td class="${pagoClase}">$${fmt(res.pagoDeudaPotencial)}</td>`;
      tablaBody.appendChild(tr);
    }
    if (barrasDiv) {
      const barra = document.createElement('div');
      const etiqueta = res.deudaLiquidada ? '✅ ¡DEUDA LIQUIDADA!' : `${res.porcentajeCubierto}% de la meta`;
      const color = res.deudaLiquidada ? '#2ecc71' : '#f39c12';
      barra.innerHTML = `<p>${nombre}: ${etiqueta}</p>
        <div style="background:#e0e0e0;height:20px;border-radius:5px;overflow:hidden;margin-bottom:12px;">
          <div style="width:${res.porcentajeCubierto}%;background:${color};height:100%;text-align:right;color:white;line-height:20px;padding-right:6px;">
            ${Math.round(res.porcentajeCubierto)}%
          </div>
        </div>`;
      barrasDiv.appendChild(barra);
    }
  });

  // simulador dinámico
  const resSim = calcularProyeccion(horasTrabajadas, params);
  if ($("horasSeleccionadas")) $("horasSeleccionadas").textContent = Number(horasTrabajadas).toFixed(1);
  if ($("simuladorGananciaDiariaNeto")) $("simuladorGananciaDiariaNeto").textContent = `$${fmt(resSim.sobranteDiario)}`;
  if ($("simuladorPagoDeuda")) $("simuladorPagoDeuda").textContent = `$${fmt(resSim.pagoDeudaPotencial)}`;

  if (isUI) {
    const range = $("inputHorasTrabajadas");
    if (range) range.oninput = ()=>{ saveProjectionParams(); renderProyeccion('admin'); };
  }
}

/* -------------------------
   Export CSV de proyección
   ------------------------- */
function exportToCSV() {
  if (resultadosEscenariosFijos.length === 0) return alert("No hay proyección para exportar.");
  const gas = obtenerGastoVariableGasolina();
  const params = getProjectionParams('STORE');
  const metadata = {
    gananciaHr: params.gananciaHr,
    diasRestantes: params.diasRestantes,
    deudaMeta: params.deudaMeta,
    gastoFijoDiario: params.gastoFijoDiarioTotal,
    gastoGasolinaDiario: gas.gastoGasolinaDiario
  };

  let csv = "data:text/csv;charset=utf-8,";
  csv += "Parametro,Valor\n";
  for (const k in metadata) csv += `${k},${metadata[k]}\n`;
  csv += "\nEscenario,GananciaDiaria,GananciaSemanal,GananciaTotal,SobranteDiario,PagoDeuda,Porcentaje,DeudaLiquidada\n";
  resultadosEscenariosFijos.forEach(r=>{
    csv += `${r.horasDiarias},${r.gananciaDiaria},${r.gananciaSemanal},${r.gananciaTotalDias},${r.sobranteDiario},${r.pagoDeudaPotencial},${r.porcentajeCubierto},${r.deudaLiquidada?"SI":"NO"}\n`;
  });
  const uri = encodeURI(csv);
  const link = document.createElement("a");
  link.href = uri;
  link.download = `proyeccion_${params.diasRestantes}dias.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/* -----------------------------
   Export / Import JSON
   ------------------------- */
function exportData() {
  const payload = { ingresos, gastos, kilometrajes, gasolinas, deudas, proyeccionParams, turnos, turnoActivo, turnoInicio };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `backup_finanzas_${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importData() {
  const area = $("json-area");
  if (!area) return alert("No encontré el área para pegar JSON.");
  try {
    const data = JSON.parse(area.value);
    ingresos = data.ingresos || [];
    gastos = data.gastos || [];
    kilometrajes = data.kilometrajes || [];
    gasolinas = data.gasolinas || [];
    deudas = data.deudas || [];
    proyeccionParams = data.proyeccionParams || {};
    turnos = data.turnos || [];
    turnoActivo = data.turnoActivo || false;
    turnoInicio = data.turnoInicio || null;
    persistAll();
    loadProjectionParams();
    renderAdminTables();
    renderIndex();
    actualizarBotonesTurno();
    alert("Datos importados correctamente.");
  } catch (err) {
    console.error(err);
    alert("Error al parsear JSON. Revisa el formato.");
  }
}

/* -------------------------
   Resumen Index / Gráficas
   ------------------------- */
function calcularResumen() {
  const totalIngresos = ingresos.reduce((s,i)=>s + (i.cantidad||0), 0);
  const gastosOperacionales = gastos.filter(g => g.categoria !== "Abono a Deuda");
  const totalGastosNeto = gastosOperacionales.reduce((s,g)=>s + (g.cantidad||0), 0);
  const deudaTotal = deudas.reduce((s,d)=>s + (d.montoActual || 0), 0);
  const kmTotales = kilometrajes.reduce((s,k)=>s + (k.kmRecorridos||0), 0) + gasolinas.reduce((s,g)=>s + (g.kmRecorridos||0), 0);
  const gastoCombustibleTotal = gasolinas.reduce((s,g)=>s + (g.totalPagado||0), 0);
  const totalLitros = gasolinas.reduce((s,g)=>s + (g.litros||0), 0);
  const kmPorLitro = totalLitros > 0 ? (kmTotales / totalLitros) : 0;
  return { totalIngresos, totalGastosNeto, deudaTotal, kmTotales, gastoCombustibleTotal, kmPorLitro };
}

/* Chart instances */
let chartGanVsGas = null;
let chartKmVsGas = null;

function renderIndex() {
  const res = calcularResumen();
  if ($("total-ingresos")) $("total-ingresos").textContent = fmt(res.totalIngresos);
  if ($("total-gastos-neto")) $("total-gastos-neto").textContent = fmt(res.totalGastosNeto);
  if ($("deudaTotalLabel")) $("deudaTotalLabel").textContent = fmt(res.deudaTotal);
  if ($("balance")) $("balance").textContent = fmt(res.totalIngresos - res.totalGastosNeto);
  if ($("km-recorridos")) $("km-recorridos").textContent = Number(res.kmTotales).toFixed(2);
  if ($("km-gasto")) $("km-gasto").textContent = fmt(res.gastoCombustibleTotal);
  if ($("km-rendimiento")) $("km-rendimiento").textContent = Number(res.kmPorLitro).toFixed(2);

  renderProyeccion('index');
  renderCharts();
}

/* Agregación para gráficas */
function aggregateDailyFinanzas(days = 14) {
  const msDay = 24*60*60*1000;
  const today = new Date();
  let labels=[], ingresosByDay=[], gastosByDay=[];
  for (let i = days-1; i >= 0; i--) {
    const dt = new Date(today - i*msDay);
    const key = dt.toISOString().slice(0,10);
    labels.push(key);
    const ing = ingresos.filter(it => (it.fecha||'').slice(0,10) === key).reduce((s,i)=>s + (i.cantidad||0),0);
    const gas = gastos.filter(g => (g.fecha||'').slice(0,10) === key).reduce((s,g)=>s + (g.cantidad||0),0);
    ingresosByDay.push(Number(ing.toFixed(2)));
    gastosByDay.push(Number(gas.toFixed(2)));
  }
  return { labels, ingresosByDay, gastosByDay };
}

function aggregateKmGas() {
  const labels = gasolinas.map(g => (g.fecha||'').slice(0,10));
  const km = gasolinas.map(g => Number((g.kmRecorridos||0).toFixed(2)));
  const gasto = gasolinas.map(g => Number((g.totalPagado||0).toFixed(2)));
  return { labels, km, gasto };
}

function renderCharts() {
  if (typeof Chart === 'undefined') return;
  // Ingresos vs Gastos
  const agg = aggregateDailyFinanzas(14);
  const ctx1 = $("chartGanVsGas")?.getContext('2d');
  if (ctx1) {
    if (chartGanVsGas) chartGanVsGas.destroy();
    chartGanVsGas = new Chart(ctx1, {
      type: 'bar',
      data: {
        labels: agg.labels,
        datasets: [
          { label: 'Ingresos', data: agg.ingresosByDay },
          { label: 'Gastos', data: agg.gastosByDay }
        ]
      },
      options: {
        responsive: true,
        plugins: { legend: { position: 'top' } },
        scales: { y: { beginAtZero: true } }
      }
    });
  }
  // Km vs Gasto gasolina
  const agg2 = aggregateKmGas();
  const ctx2 = $("chartKmGas")?.getContext('2d');
  if (ctx2) {
    if (chartKmVsGas) chartKmVsGas.destroy();
    chartKmVsGas = new Chart(ctx2, {
      type: 'line',
      data: {
        labels: agg2.labels,
        datasets: [
          { label: 'Km recorridos', data: agg2.km, yAxisID: 'y1' },
          { label: 'Gasto gasolina (MXN)', data: agg2.gasto, yAxisID: 'y' }
        ]
      },
      options: {
        responsive: true,
        scales: {
          y: { type: 'linear', position: 'left', beginAtZero: true },
          y1: { type: 'linear', position: 'right', beginAtZero: true, grid: { drawOnChartArea: false } }
        }
      }
    });
  }
}

/* -------------------------
   Render tabla movimientos (Admin)
   - soporte para tabla-todos y tablas separadas
   ------------------------- */
function renderAdminTables() {
  // Tabla simple (tabla-todos) si existe
  const tabla = $("tabla-todos");
  if (tabla) {
    const movimientos = [
      ...ingresos.map(i=>({...i, tipo:'Ingreso', monto: i.cantidad})),
      ...gastos.map(g=>({...g, tipo:'Gasto', monto: g.cantidad}))
    ].sort((a,b)=>new Date(b.fecha)-new Date(a.fecha)).slice(0,10);
    const body = tabla.querySelector('tbody') || tabla.createTBody();
    let header = tabla.querySelector('thead');
    if (!header) {
      header = tabla.createTHead();
      header.innerHTML = `<tr><th>Tipo</th><th>Descripción / Categoría</th><th>Monto</th><th>Fecha</th></tr>`;
    }
    body.innerHTML = '';
    movimientos.forEach(m => {
      const tr = body.insertRow();
      const fechaFmt = new Date(m.fecha).toLocaleString();
      const montoFmt = fmt(m.monto);
      const montoClase = m.tipo === 'Ingreso' ? 'valor-positivo' : 'debt-amount';
      tr.innerHTML = `<td>${m.tipo}</td><td>${m.descripcion || m.categoria}</td><td class="${montoClase}">$${montoFmt}</td><td>${fechaFmt}</td>`;
    });
    if (movimientos.length === 0) body.innerHTML = '<tr><td colspan="4" style="text-align:center;">No hay movimientos recientes.</td></tr>';
  }

  // Tablas detalladas si existen (opcional)
  const tIngresos = $("tablaIngresosBody");
  if (tIngresos) tIngresos.innerHTML = ingresos.map(i=>`<tr><td>${i.descripcion}</td><td>$${fmt(i.cantidad)}</td><td>${new Date(i.fecha).toLocaleString()}</td></tr>`).join('');
  const tGastos = $("tablaGastosBody");
  if (tGastos) tGastos.innerHTML = gastos.map(g=>`<tr><td>${g.descripcion}</td><td>$${fmt(g.cantidad)}</td><td>${g.categoria}</td><td>${new Date(g.fecha).toLocaleString()}</td></tr>`).join('');
  const tKm = $("tablaKmBody");
  if (tKm) tKm.innerHTML = kilometrajes.map(k=>`<tr><td>${k.kmInicial}</td><td>${k.kmFinal}</td><td>${k.kmRecorridos}</td><td>${new Date(k.fecha).toLocaleString()}</td></tr>`).join('');
  const tGas = $("tablaGasolinaBody");
  if (tGas) tGas.innerHTML = gasolinas.map(g=>`<tr><td>${g.litros} L</td><td>$${fmt(g.totalPagado)}</td><td>${g.kmRecorridos} km</td><td>${new Date(g.fecha).toLocaleString()}</td></tr>`).join('');
  const tTurn = $("tablaTurnosBody");
  if (tTurn) tTurn.innerHTML = turnos.map(t=>`<tr><td>${new Date(t.inicio).toLocaleString()}</td><td>${new Date(t.fin).toLocaleString()}</td><td>${t.horas} h</td><td>$${fmt(t.ganancia)}</td></tr>`).join('');

  // actualizar deudas y categorías
  renderDeudasAdmin();
  renderCategorias();
}

/* -------------------------
   Listeners proyección / export CSV / import
   ------------------------- */
function setupProjectionListeners() {
  PROJECTION_INPUT_IDS.forEach(id=>{
    if (id === "inputHorasTrabajadas") return;
    const el = $(id);
    if (el) el.addEventListener('input', ()=> renderProyeccion('admin'));
  });
  safeOn("btnExportProjection","click", exportToCSV);
  safeOn("btnExport","click", exportData);
  safeOn("btnImport","click", importData);
}

/* -------------------------
   Inicialización según contexto
   ------------------------- */
function onloadApp(context) {
  // recarga desde storage
  ingresos = JSON.parse(localStorage.getItem("ingresos")) || ingresos;
  gastos = JSON.parse(localStorage.getItem("gastos")) || gastos;
  kilometrajes = JSON.parse(localStorage.getItem("kilometrajes")) || kilometrajes;
  gasolinas = JSON.parse(localStorage.getItem("gasolinas")) || gasolinas;
  deudas = JSON.parse(localStorage.getItem("deudas")) || deudas;
  proyeccionParams = JSON.parse(localStorage.getItem("proyeccionParams")) || proyeccionParams;
  turnos = JSON.parse(localStorage.getItem("turnos")) || turnos;
  turnoActivo = JSON.parse(localStorage.getItem("turnoActivo")) || turnoActivo;
  turnoInicio = localStorage.getItem("turnoInicio") || turnoInicio;

  if (context === 'admin') {
    loadProjectionParams();
    renderAdminTables();
    renderDeudasAdmin();
    renderCategorias();
    precargarKmInicial();
    actualizarKmUI();
    renderProyeccion('admin');
    setupProjectionListeners();
    safeOn("btnIniciarTurno","click", iniciarTurno);
    safeOn("btnFinalizarTurno","click", finalizarTurno);
    actualizarBotonesTurno();
    safeOn("btnExportProjection","click", exportToCSV);
  } else {
    // index
    renderIndex();
    safeOn("btnIniciarTurno","click", iniciarTurno);
    safeOn("btnFinalizarTurno","click", finalizarTurno);
    setupProjectionListeners();
    actualizarBotonesTurno();
  }
}

/* -------------------------
   Exponer funciones globales
   ------------------------- */
window.onloadApp = onloadApp;
window.iniciarTurno = iniciarTurno;
window.finalizarTurno = finalizarTurno;
window.exportData = exportData;
window.importData = importData;
window.exportToCSV = exportToCSV;
window.renderAdminTables = renderAdminTables;
window.saveAll = persistAll;

/* -------------------------
   Auto-init cuando el archivo se carga (si el DOM ya está listo)
   ------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  // Si tu HTML llama onloadApp('index'|'admin') evita doble inicialización;
  // Esto solo ayuda si olvidaste la llamada en HTML.
  try {
    // detecta si estamos en admin o index por la presencia de un id clave
    if ($("tabla-todos") || $("formIngreso")) {
      // admin
      onloadApp('admin');
    } else {
      onloadApp('index');
    }
  } catch (e) {
    console.error("Error init app:", e);
  }
});
