/* assets/js/app.js
   Versión mejorada con:
   - Sistema de turnos (iniciar/finalizar)
   - Registro de turnos con horas y ganancia (se guarda como ingreso)
   - Proyecciones reales basadas en turnos históricos
   - Gráficas (renderizadas en index.html)
   - Export/Import y demás funcionalidad previa mantenida
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
let turnos = JSON.parse(localStorage.getItem("turnos")) || []; // nuevo: historial de turnos
let turnoActivo = JSON.parse(localStorage.getItem("turnoActivo")) || false;
let turnoInicio = localStorage.getItem("turnoInicio") || null;

/* -------------------------
   CONSTANTES Y HELPERS
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
const generarId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 5);

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
   ADMIN: ingresos/gastos/deudas/km/gasolina
   ------------------------- */
const CATEGORIAS_GASTO = ["Transporte","Comida","Servicios","Alquiler","Hogar/Vivienda","Ocio/Entretenimiento","Otros","Abono a Deuda"];

function renderCategorias() {
    const select = $("gastoCategoria");
    if (select) {
        const categoriasVisibles = CATEGORIAS_GASTO.filter(c => c !== "Abono a Deuda");
        select.innerHTML = categoriasVisibles.map(c => `<option value="${c}">${c}</option>`).join('');
    }
}

// Formularios (igual que antes)
safeOn("formIngreso", "submit", (e) => {
  e.preventDefault();
  const desc = $("ingresoDescripcion")?.value?.trim();
  const qty = Number($("ingresoCantidad")?.value);
  if (!desc || !qty) return alert("Completa descripción y cantidad.");
  ingresos.push({ id: generarId(), descripcion: desc, cantidad: qty, fecha: new Date().toISOString() });
  persistAll();
  e.target.reset();
  alert("Ingreso guardado");
  renderAdminTables();
});

safeOn("formGasto", "submit", (e) => {
  e.preventDefault();
  const desc = $("gastoDescripcion")?.value?.trim();
  const qty = Number($("gastoCantidad")?.value);
  const cat = $("gastoCategoria")?.value || "Otros";
  if (!desc || !qty) return alert("Completa descripción y cantidad.");
  gastos.push({ id: generarId(), descripcion: desc, cantidad: qty, categoria: cat, fecha: new Date().toISOString() });
  persistAll();
  e.target.reset();
  alert("Gasto guardado");
  renderAdminTables();
});

function renderDeudasAdmin() {
    const select = $("selectDeuda");
    const lista = $("lista-deudas");
    if (!select || !lista) return;
    select.innerHTML = '<option value="">-- Seleccione una deuda --</option>';
    lista.innerHTML = '';
    const deudasPendientes = deudas.filter(d => (d.montoActual || 0) > 0);
    if (deudasPendientes.length === 0) {
        lista.innerHTML = '<li>No hay deudas pendientes.</li>';
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

safeOn("formNuevaDeuda", "submit", (e) => {
    e.preventDefault();
    const nombre = $("deudaNombre")?.value?.trim();
    const monto = Number($("deudaMonto")?.value);
    if (!nombre || !monto || monto <= 0) return alert("Ingresa un nombre y un monto válido para la deuda.");
    deudas.push({ id: generarId(), nombre: nombre, montoInicial: monto, montoActual: monto, fechaCreacion: new Date().toISOString() });
    persistAll();
    e.target.reset();
    alert("Deuda registrada con éxito.");
    renderDeudasAdmin();
    renderAdminTables();
});

safeOn("formAbonoDeuda", "submit", (e) => {
    e.preventDefault();
    const deudaId = $("selectDeuda")?.value;
    const abonoMonto = Number($("abonoMonto")?.value);
    const deudaIndex = deudas.findIndex(d => d.id === deudaId);
    if (deudaIndex === -1) return alert("Selecciona una deuda válida.");
    if (!abonoMonto || abonoMonto <= 0) return alert("Ingresa un monto de abono válido.");
    const deuda = deudas[deudaIndex];
    if (abonoMonto > deuda.montoActual) {
        return alert(`El abono ($${fmt(abonoMonto)}) excede el monto actual de la deuda ($${fmt(deuda.montoActual)}).`);
    }
    deudas[deudaIndex].montoActual -= abonoMonto;
    gastos.push({ id: generarId(), descripcion: `Abono a: ${deuda.nombre}`, cantidad: abonoMonto, categoria: "Abono a Deuda", fecha: new Date().toISOString() });
    persistAll();
    e.target.reset();
    alert(`Abono de $${fmt(abonoMonto)} a ${deuda.nombre} registrado.`);
    renderDeudasAdmin();
    renderAdminTables();
});

/* -------------------------
   KM / Gasolina (igual)
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
    ].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    if (allKmEntries.length > 0) {
        const lastKmFinal = allKmEntries[0].kmFinal;
        if (kmInput.value === "" || Number(kmInput.value) === 0) {
            kmInput.value = lastKmFinal;
        }
        actualizarKmUI();
    }
}
["kmInicialConsolidado", "kmFinalConsolidado", "litrosConsolidado", "costoTotalConsolidado"].forEach(id => {
  const el = $(id);
  if (el) el.addEventListener("input", actualizarKmUI);
});

/* Guardado de km y repostaje (mantengo lógica) */
safeOn("btnGuardarKmDiario", "click", () => {
  const data = obtenerCamposKm();
  if (!data) return alert("KM Inicial y KM Final son inválidos.");
  kilometrajes.push({ id: generarId(), kmInicial: data.ini, kmFinal: data.fin, kmRecorridos: data.kmRec, fecha: new Date().toISOString() });
  persistAll();
  const form = $("formKmConsolidado");
  if(form) form.reset();
  precargarKmInicial();
  actualizarKmUI();
  alert("Kilometraje diario guardado");
  renderAdminTables();
});

safeOn("formKmConsolidado", "submit", (e) => {
  e.preventDefault();
  const data = obtenerCamposKm();
  if (!data) return alert("KM Inicial y KM Final son inválidos.");
  if (!Number.isFinite(data.lt) || data.lt <= 0 || !Number.isFinite(data.totalPagado) || data.totalPagado <= 0) {
    return alert("Para Repostaje, debes completar Litros cargados y Costo total válidos.");
  }
  const costoLitro = data.totalPagado / data.lt;
  gasolinas.push({ id: generarId(), kmInicial: data.ini, kmFinal: data.fin, kmRecorridos: data.kmRec, litros: data.lt, costoLitro: costoLitro, totalPagado: data.totalPagado, precioPorKm: data.precioKm, fecha: new Date().toISOString() });
  gastos.push({ id: generarId(), descripcion: `Gasolina ${data.lt}L @ ${fmt(costoLitro)}/L`, cantidad: data.totalPagado, categoria: "Transporte", fecha: new Date().toISOString() });
  persistAll();
  e.target.reset();
  precargarKmInicial();
  actualizarKmUI();
  alert("Repostaje guardado");
  renderAdminTables();
});

/* -------------------------
   TURNOS: iniciar / finalizar
   ------------------------- */
function iniciarTurno() {
    if (turnoActivo) return;
    turnoActivo = true;
    turnoInicio = new Date().toISOString();
    persistAll();
    actualizarBotonesTurno();
    alert("✔ Turno iniciado");
}

function finalizarTurno() {
    if (!turnoActivo) return;

    // Calcular horas trabajadas
    const inicio = new Date(turnoInicio);
    const fin = new Date();
    const horasTrabajadas = ((fin - inicio) / 1000 / 60 / 60);
    const horasRounded = Number(horasTrabajadas.toFixed(2));

    // Pedir ganancia
    const entrada = prompt(`Terminando turno. Horas trabajadas: ${horasRounded} h\nIngresa la GANANCIA del turno (MXN):`);
    const ganancia = Number(entrada);
    if (!ganancia || ganancia <= 0) {
        return alert("Ganancia inválida. Aborto de finalización de turno.");
    }

    // Registrar turno
    const turnoObj = {
        id: generarId(),
        inicio: inicio.toISOString(),
        fin: fin.toISOString(),
        horas: horasRounded,
        ganancia: ganancia
    };
    turnos.push(turnoObj);

    // Registrar como ingreso automático (mantener histórico)
    ingresos.push({ id: generarId(), descripcion: `Ganancia turno (${turnoObj.horas} h)`, cantidad: ganancia, fecha: new Date().toISOString(), turnoId: turnoObj.id });

    // reset turno activo
    turnoActivo = false;
    turnoInicio = null;
    persistAll();
    actualizarBotonesTurno();
    renderAdminTables();
    alert("✔ Turno finalizado y ganancia registrada.");
}

/* Mostrar/ocultar botones en index */
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
   PROYECCIÓN (ahora REAL)
   - Usa promedio ganancia/hr de turnos si existe
   - Usa gasto fijo y gasolina real
   ------------------------- */
function getProjectionParams(source = 'UI') {
    const reader = source === 'UI' ? (id) => $(id)?.value : (id) => proyeccionParams[id];
    const gastoComidaDiario = Number(reader('gastoComidaDiario') || proyeccionParams['gastoComidaDiario'] || 0);
    const gastoMotoDiario = Number(reader('gastoMotoDiario') || proyeccionParams['gastoMotoDiario'] || 0);
    const gastoDeudaOtroDiario = Number(reader('gastoDeudaOtroDiario') || proyeccionParams['gastoDeudaOtroDiario'] || 0);

    const gas = obtenerGastoVariableGasolina();
    const gastoFijoDiarioTotal = gastoComidaDiario + gastoMotoDiario + gastoDeudaOtroDiario;
    const gastoTotalProyeccion = gastoFijoDiarioTotal + gas.gastoGasolinaDiario;

    // obtener ganancia/hr real: promedio ganancia por hora de turnos historicos
    let gananciaHrReal = TASA_GANANCIA_HR_DEFAULT;
    if (turnos.length > 0) {
        const totalGan = turnos.reduce((s,t) => s + (t.ganancia || 0), 0);
        const totalHoras = turnos.reduce((s,t) => s + (t.horas || 0), 0);
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

function calcularProyeccionUber(horasDiarias, params) {
    const { diasRestantes, deudaMeta, gananciaHr, gastoTotalProyeccion } = params;
    const gananciaDiaria = horasDiarias * gananciaHr;
    const SobranteDiario = Math.max(0, gananciaDiaria - gastoTotalProyeccion);
    const PagoDeudaPotencial = SobranteDiario * diasRestantes;
    const PorcentajeDeudaCubierta = (PagoDeudaPotencial / deudaMeta) * 100;
    const DeudaLiquidada = PagoDeudaPotencial >= deudaMeta;
    return {
        horasDiarias,
        gananciaDiaria: Number(gananciaDiaria.toFixed(2)),
        gananciaSemanal: Number((gananciaDiaria * 7).toFixed(2)),
        gananciaTotalDias: Number((gananciaDiaria * diasRestantes).toFixed(2)),
        SobranteDiario: Number(SobranteDiario.toFixed(2)),
        PagoDeudaPotencial: Number(PagoDeudaPotencial.toFixed(2)),
        PorcentajeDeudaCubierta: Math.min(100, Number(PorcentajeDeudaCubierta.toFixed(2))),
        DeudaLiquidada
    };
}

let resultadosEscenariosFijos = [];

function renderProyeccion(context) {
    const isUI = context === 'admin';
    if (isUI) {
        saveProjectionParams();
        loadProjectionParams();
    }
    const params = getProjectionParams(isUI ? 'UI' : 'STORE');
    const { diasRestantes, deudaMeta, gastoFijoDiarioTotal, gastoTotalProyeccion, horasTrabajadas } = params;

    if ($("gastoFijoDiarioTotal")) $("gastoFijoDiarioTotal").textContent = `$${fmt(gastoFijoDiarioTotal)}`;
    if ($("gastoTotalProyeccion")) $("gastoTotalProyeccion").textContent = `$${fmt(gastoTotalProyeccion)}`;
    if ($("deudaMetaTotal")) $("deudaMetaTotal").textContent = fmt(deudaMeta);
    if ($("diasRestantesSimulador")) $("diasRestantesSimulador").textContent = diasRestantes;

    resultadosEscenariosFijos = [
        calcularProyeccionUber(8, params),
        calcularProyeccionUber(10, params),
        calcularProyeccionUber(12, params)
    ];

    // Render tabla (index/admin)
    const tablaBody = $("tabla-proyeccion")?.querySelector('tbody');
    const barrasDiv = $("proyeccion-barras");

    if (tablaBody) tablaBody.innerHTML = '';
    if (barrasDiv) barrasDiv.innerHTML = '';

    resultadosEscenariosFijos.forEach((res, index) => {
        const tr = document.createElement("tr");
        const nombreEscenario = ['Moderado (8h)', 'Agresivo (10h)', 'Máximo (12h)'][index];
        const pagoClase = res.PagoDeudaPotencial > 0 ? 'valor-positivo' : '';
        tr.innerHTML = `<td>${nombreEscenario}</td><td>$${fmt(res.gananciaTotalDias)}</td><td class="${pagoClase}">$${fmt(res.PagoDeudaPotencial)}</td>`;
        if (tablaBody) tablaBody.appendChild(tr);

        const barra = document.createElement("div");
        const etiqueta = res.DeudaLiquidada ? '✅ ¡DEUDA LIQUIDADA!' : `${res.PorcentajeDeudaCubierta}% de la meta`;
        const barraColor = res.DeudaLiquidada ? '#2ecc71' : '#f39c12';
        barra.innerHTML = `
            <p>${nombreEscenario}: ${etiqueta}</p>
            <div style="background: #e0e0e0; height: 20px; border-radius: 5px; overflow: hidden; margin-bottom: 15px;">
                <div style="width: ${res.PorcentajeDeudaCubierta}%; background: ${barraColor}; height: 100%; text-align: right; color: white; line-height: 20px; padding-right: 5px;">
                    ${Math.round(res.PorcentajeDeudaCubierta)}%
                </div>
            </div>
        `;
        if (barrasDiv) barrasDiv.appendChild(barra);
    });

    // Simulador dinámico
    const resSimulador = calcularProyeccionUber(horasTrabajadas, params);
    if ($("horasSeleccionadas")) $("horasSeleccionadas").textContent = Number(horasTrabajadas).toFixed(1);
    if ($("simuladorGananciaDiariaNeto")) $("simuladorGananciaDiariaNeto").textContent = `$${fmt(resSimulador.SobranteDiario)}`;
    if ($("simuladorPagoDeuda")) $("simuladorPagoDeuda").textContent = `$${fmt(resSimulador.PagoDeudaPotencial)}`;

    if (isUI) {
        const range = $("inputHorasTrabajadas");
        if (range) range.oninput = () => { saveProjectionParams(); renderProyeccion('admin'); };
    }
}

/* -------------------------
   Export CSV (mantengo)
   ------------------------- */
function exportToCSV() {
    if (resultadosEscenariosFijos.length === 0) {
        return alert("No hay datos de proyección para exportar. Asegúrate de que los parámetros están llenos.");
    }
    const gas = obtenerGastoVariableGasolina();
    const params = getProjectionParams('STORE');
    const metadata = {
        'Tasa_Ganancia_x_Hora': params.gananciaHr,
        'Dias_Restantes_Meta': params.diasRestantes,
        'Deuda_Total_Meta': params.deudaMeta,
        'Gasto_Comida_Diario': params['gastoComidaDiario'],
        'Pago_Moto_Diario': params['gastoMotoDiario'],
        'Otra_Deuda_Diaria': params['gastoDeudaOtroDiario'],
        'Gasto_Gasolina_Diario_Proyectado': gas.gastoGasolinaDiario,
    };

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "PARAMETROS DEL SIMULADOR\n";
    for (const key in metadata) {
        csvContent += `${key},${key.replace(/_/g, ' ')},${metadata[key]}\n`;
    }
    csvContent += "\n";

    const headers = [
        "Escenario (Horas)",
        "Ganancia Diaria (MXN)",
        "Ganancia Semanal (MXN)",
        "Ganancia Total (" + metadata.Dias_Restantes_Meta + " Días)",
        "Sobrante Neto Diario",
        "Pago Potencial Deuda",
        "Porcentaje Cubierto (%)",
        "Deuda Liquidada"
    ];
    csvContent += headers.join(",") + "\n";

    resultadosEscenariosFijos.forEach(res => {
        const row = [
            `${res.horasDiarias}h`,
            res.gananciaDiaria,
            res.gananciaSemanal,
            res.gananciaTotalDias,
            res.SobranteDiario,
            res.PagoDeudaPotencial,
            res.PorcentajeDeudaCubierta,
            res.DeudaLiquidada ? "SI" : "NO"
        ];
        csvContent += row.join(",") + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Proyeccion_Uber_meta_${metadata.Dias_Restantes_Meta}dias.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/* -------------------------
   Export / Import JSON
   ------------------------- */
function exportData() {
    const dataToExport = { ingresos, gastos, kilometrajes, gasolinas, deudas, proyeccionParams, turnos };
    const jsonString = JSON.stringify(dataToExport, null, 2);
    const filename = `backup_presupuesto_${Date.now()}.json`;
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    alert(`Datos exportados como ${filename}. Revisa tu carpeta de descargas.`);
}

function importData() {
    const jsonArea = $("json-area");
    try {
        const data = JSON.parse(jsonArea.value);
        if (data.ingresos && data.gastos && data.deudas) {
            ingresos = data.ingresos;
            gastos = data.gastos;
            kilometrajes = data.kilometrajes || [];
            gasolinas = data.gasolinas || [];
            deudas = data.deudas;
            proyeccionParams = data.proyeccionParams || {};
            turnos = data.turnos || [];
            persistAll();
            alert("✅ Datos importados con éxito. Recargando la página para aplicar los cambios.");
            window.location.reload();
        } else {
            alert("Error: El JSON no contiene la estructura de datos esperada (ingresos, gastos, deudas).");
        }
    } catch (err) {
        alert("❌ Error al leer el JSON. Verifica que el formato sea válido.");
        console.error("Import Error:", err);
    }
}

/* -------------------------
   INDEX: resumen y gráficas
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
  renderCharts(); // renderizar gráficas
}

/* -------------------------
   Generar datos agregados para gráficas
   - Ganancias vs Gastos por día (últimos 14 días)
   - Km recorridos vs gasto gasolina (últimos registros)
   ------------------------- */
function aggregateDailyFinanzas(days = 14) {
    const msDay = 24*60*60*1000;
    const today = new Date();
    let labels = [];
    let ingresosByDay = [];
    let gastosByDay = [];
    for (let i = days-1; i >= 0; i--) {
        const dt = new Date(today - i*msDay);
        const key = dt.toISOString().slice(0,10);
        labels.push(key);
        const ing = ingresos.filter(it => (it.fecha||'').slice(0,10) === key).reduce((s,i)=>s + (i.cantidad||0), 0);
        const gas = gastos.filter(g => (g.fecha||'').slice(0,10) === key).reduce((s,g)=>s + (g.cantidad||0), 0);
        ingresosByDay.push(Number(ing.toFixed(2)));
        gastosByDay.push(Number(gas.toFixed(2)));
    }
    return { labels, ingresosByDay, gastosByDay };
}

function aggregateKmGas() {
    // map gasolinas entries by date
    const labels = gasolinas.map(g => (g.fecha || '').slice(0,10));
    const km = gasolinas.map(g => Number((g.kmRecorridos||0).toFixed(2)));
    const gasto = gasolinas.map(g => Number((g.totalPagado||0).toFixed(2)));
    return { labels, km, gasto };
}

function renderCharts() {
    // cargar Chart.js debe estar en index.html via CDN
    if (typeof Chart === 'undefined') return;

    // Ganancias vs Gastos (14 días)
    const agg = aggregateDailyFinanzas(14);
    const ctx1 = $("chartGanVsGas")?.getContext('2d');
    if (ctx1) {
        if (chartGanVsGas) chartGanVsGas.destroy();
        chartGanVsGas = new Chart(ctx1, {
            type: 'bar',
            data: {
                labels: agg.labels,
                datasets: [
                    { label: 'Ingresos', data: agg.ingresosByDay, stack: '1' },
                    { label: 'Gastos', data: agg.gastosByDay, stack: '1' }
                ]
            },
            options: {
                responsive: true,
                plugins: { legend: { position: 'top' } },
                scales: {
                    x: { stacked: true },
                    y: { stacked: false, beginAtZero: true }
                }
            }
        });
    }

    // Km recorridos vs gasto gasolina (últimos registros)
    const agg2 = aggregateKmGas();
    const ctx2 = $("chartKmGas")?.getContext('2d');
    if (ctx2) {
        if (chartKmVsGas) chartKmVsGas.destroy();
        chartKmVsGas = new Chart(ctx2, {
            type: 'line',
            data: {
                labels: agg2.labels,
                datasets: [
                    { label: 'Km recorridos', data: agg2.km, fill: false, yAxisID: 'y1' },
                    { label: 'Gasto gasolina (MXN)', data: agg2.gasto, fill: false, yAxisID: 'y' }
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
   Tabla movimientos (admin)
   ------------------------- */
function renderAdminTables() {
    const tabla = $("tabla-todos");
    if (!tabla) return;
    const movimientos = [
        ...ingresos.map(i => ({...i, tipo: 'Ingreso', monto: i.cantidad})),
        ...gastos.map(g => ({...g, tipo: 'Gasto', monto: g.cantidad}))
    ].sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).slice(0, 10);

    const body = tabla.querySelector('tbody') || tabla.createTBody();
    let header = tabla.querySelector('thead');
    if (!header) {
        header = tabla.createTHead();
        header.innerHTML = `<tr><th>Tipo</th><th>Descripción / Categoría</th><th>Monto</th><th>Fecha</th></tr>`;
    }
    body.innerHTML = '';
    movimientos.forEach(mov => {
        const tr = body.insertRow();
        const montoFmt = fmt(mov.monto);
        const montoClase = mov.tipo === 'Ingreso' ? 'valor-positivo' : 'debt-amount';
        const fechaFmt = new Date(mov.fecha).toLocaleString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        tr.innerHTML = `<td>${mov.tipo}</td><td>${mov.descripcion || mov.categoria}</td><td class="${montoClase}">$${montoFmt}</td><td>${fechaFmt}</td>`;
    });
    if (movimientos.length === 0) {
        body.innerHTML = '<tr><td colspan="4" style="text-align:center;">No hay movimientos recientes.</td></tr>';
    }
}

/* -------------------------
   Inicialización según contexto
   ------------------------- */
function onloadApp(context) {
  // recargar arrays
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
    safeOn("btnExport", "click", exportData);
    safeOn("btnImport", "click", importData);
    // botones de turno en admin (si existen)
    safeOn("btnIniciarTurno", "click", iniciarTurno);
    safeOn("btnFinalizarTurno", "click", finalizarTurno);
    actualizarBotonesTurno();
  } else {
    renderIndex();
    // listeners para botones de turno en index
    safeOn("btnIniciarTurno", "click", iniciarTurno);
    safeOn("btnFinalizarTurno", "click", finalizarTurno);
    setupProjectionListeners();
    actualizarBotonesTurno();
  }
}

/* -------------------------
   Listeners para inputs proyección
   ------------------------- */
function setupProjectionListeners() {
    PROJECTION_INPUT_IDS.forEach(id => {
        if (id !== "inputHorasTrabajadas") {
            const el = $(id);
            if(el) el.addEventListener('input', () => {
                renderProyeccion('admin');
            });
        }
    });
    safeOn("btnExportProjection", "click", exportToCSV);
}

/* -------------------------
   Exponer funciones globales
   ------------------------- */
window.renderAdminTables = renderAdminTables;
window.onloadApp = onloadApp;
window.saveAll = persistAll;
window.iniciarTurno = iniciarTurno;
window.finalizarTurno = finalizarTurno;
window.exportData = exportData;
window.importData = importData;
window.exportToCSV = exportToCSV;
