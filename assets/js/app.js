/* assets/js/app.js
   Versión con Persistencia Total (Transacciones + Proyección) y Exportación a CSV.
*/

// -------------------------
// Storage y datos iniciales
// -------------------------
let ingresos = JSON.parse(localStorage.getItem("ingresos")) || [];
let gastos = JSON.parse(localStorage.getItem("gastos")) || [];
let kilometrajes = JSON.parse(localStorage.getItem("kilometrajes")) || [];
let gasolinas = JSON.parse(localStorage.getItem("gasolinas")) || [];
let deudas = JSON.parse(localStorage.getItem("deudas")) || [];
// Se añade la clave para los parámetros de proyección
let proyeccionParams = JSON.parse(localStorage.getItem("proyeccionParams")) || {};


// Valores por defecto del Desafío Uber Eats (Usados si no hay valor en la interfaz)
const TASA_GANANCIA_HR_DEFAULT = 101.56; 
const DEUDA_META_DEFAULT = 19793;
const DIAS_RESTANTES_DEFAULT = 33;

// IDs de los campos de proyección que queremos guardar
const PROJECTION_INPUT_IDS = [
    "inputDiasRestantes", 
    "inputDeudaMeta", 
    "inputGananciaHr", 
    "gastoComidaDiario", 
    "gastoMotoDiario", 
    "gastoDeudaOtroDiario"
];


// Helpers seguros
const $ = id => document.getElementById(id);
const safeOn = (id, evt, fn) => { const el = $(id); if (el) el.addEventListener(evt, fn); };
const fmt = n => Number(n||0).toFixed(2);
// Helper para generar ID único de deuda
const generarId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 5);


// -------------------------
// FUNCIONES DE GUARDADO (Persistencia Total)
// -------------------------
function saveAll() {
  localStorage.setItem("ingresos", JSON.stringify(ingresos));
  localStorage.setItem("gastos", JSON.stringify(gastos));
  localStorage.setItem("kilometrajes", JSON.stringify(kilometrajes));
  localStorage.setItem("gasolinas", JSON.stringify(gasolinas));
  localStorage.setItem("deudas", JSON.stringify(deudas));
  // Los parámetros de proyección también se guardan, asegurando la persistencia de ambos tipos de datos.
  localStorage.setItem("proyeccionParams", JSON.stringify(proyeccionParams)); 
}

/**
 * Guarda el valor de los inputs de proyección en la variable y en localStorage.
 */
function saveProjectionParams() {
    PROJECTION_INPUT_IDS.forEach(id => {
        const el = $(id);
        if (el) {
            proyeccionParams[id] = el.value;
        }
    });
    localStorage.setItem("proyeccionParams", JSON.stringify(proyeccionParams));
}

/**
 * Carga los valores guardados de proyección en los inputs al inicio.
 */
function loadProjectionParams() {
    PROJECTION_INPUT_IDS.forEach(id => {
        const el = $(id);
        // Si hay un valor guardado, lo asigna. De lo contrario, usa el valor por defecto del HTML.
        if (el && proyeccionParams[id] !== undefined) {
            el.value = proyeccionParams[id];
        }
    });
}


// -------------------------
// ADMIN: Ingresos
// -------------------------
safeOn("formIngreso", "submit", (e) => {
  e.preventDefault();
  const desc = $("ingresoDescripcion")?.value?.trim();
  const qty = Number($("ingresoCantidad")?.value);
  if (!desc || !qty) return alert("Completa descripción y cantidad.");
  ingresos.push({ descripcion: desc, cantidad: qty, fecha: new Date().toISOString() });
  saveAll();
  e.target.reset();
  alert("Ingreso guardado");
  renderAdminTables();
});

// -------------------------
// ADMIN: Gastos
// -------------------------
const CATEGORIAS_GASTO = ["Transporte", "Comida", "Servicios", "Alquiler", "Hogar/Vivienda", "Ocio/Entretenimiento", "Otros", "Abono a Deuda"];

function renderCategorias() {
    const select = $("gastoCategoria");
    if (select) {
        const categoriasVisibles = CATEGORIAS_GASTO.filter(c => c !== "Abono a Deuda");
        select.innerHTML = categoriasVisibles.map(c => `<option value="${c}">${c}</option>`).join('');
    }
}

safeOn("formGasto", "submit", (e) => {
  e.preventDefault();
  const desc = $("gastoDescripcion")?.value?.trim();
  const qty = Number($("gastoCantidad")?.value);
  const cat = $("gastoCategoria")?.value || "Otros";
  if (!desc || !qty) return alert("Completa descripción y cantidad.");
  gastos.push({ descripcion: desc, cantidad: qty, categoria: cat, fecha: new Date().toISOString() });
  saveAll();
  e.target.reset();
  alert("Gasto guardado");
  renderAdminTables();
});

// ----------------------------------------------------
// DEUDAS Y ABONOS 
// ----------------------------------------------------

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

    deudas.push({
        id: generarId(),
        nombre: nombre,
        montoInicial: monto,
        montoActual: monto,
        fechaCreacion: new Date().toISOString()
    });

    saveAll();
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

    gastos.push({ 
        descripcion: `Abono a: ${deuda.nombre}`, 
        cantidad: abonoMonto, 
        categoria: "Abono a Deuda", 
        fecha: new Date().toISOString() 
    });

    saveAll();
    e.target.reset();
    alert(`Abono de $${fmt(abonoMonto)} a ${deuda.nombre} registrado.`);
    renderDeudasAdmin();
    renderAdminTables();
});


// ----------------------------------------------------
// KM + GASOLINA CONSOLIDADO
// ----------------------------------------------------

function obtenerGastoVariableGasolina() {
    const kmTotales = kilometrajes.reduce((s,k)=>s + (k.kmRecorridos||0), 0) + gasolinas.reduce((s,g)=>s + (g.kmRecorridos||0), 0);
    const gastoCombustibleTotal = gasolinas.reduce((s,g)=>s + (g.totalPagado||0), 0);
    
    // Asumimos un recorrido promedio de 200km para el cálculo diario de proyección
    const KM_DIARIO_PROMEDIO = 200; 

    const precioKmPromedio = kmTotales > 0 ? (gastoCombustibleTotal / kmTotales) : 0;
    
    const gastoGasolinaDiario = precioKmPromedio * KM_DIARIO_PROMEDIO;
    
    return {
        precioKmPromedio,
        gastoGasolinaDiario: Number(gastoGasolinaDiario.toFixed(2))
    };
}

function obtenerCamposKm() {
  const ini = Number($("kmInicialConsolidado")?.value);
  const fin = Number($("kmFinalConsolidado")?.value);
  const lt = Number($("litrosConsolidado")?.value);
  const totalPagado = Number($("costoTotalConsolidado")?.value);
  const kmRec = (fin > ini) ? (fin - ini) : 0;
  const precioKm = (kmRec > 0 && totalPagado > 0) ? (totalPagado / kmRec) : 0;
  
  if (!Number.isFinite(ini) || !Number.isFinite(fin) || fin <= ini) {
    alert("KM Inicial y KM Final son inválidos.");
    return false;
  }
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

function limpiarKmFinal() {
    const kmFinalInput = $("kmFinalConsolidado");
    if(kmFinalInput) kmFinalInput.value = "";
}


["kmInicialConsolidado", "kmFinalConsolidado", "litrosConsolidado", "costoTotalConsolidado"].forEach(id => {
  const el = $(id);
  if (el) el.addEventListener("input", actualizarKmUI);
});


safeOn("btnGuardarKmDiario", "click", () => {
  const data = obtenerCamposKm();
  if (!data) return;

  kilometrajes.push({ 
    kmInicial: data.ini, 
    kmFinal: data.fin, 
    kmRecorridos: data.kmRec, 
    fecha: new Date().toISOString() 
  });
  
  saveAll();
  
  const form = $("formKmConsolidado");
  if(form) form.reset();
  limpiarKmFinal();
  precargarKmInicial();
  actualizarKmUI();
  alert("Kilometraje diario guardado");
  renderAdminTables();
});


safeOn("formKmConsolidado", "submit", (e) => {
  e.preventDefault();
  const data = obtenerCamposKm();
  if (!data) return;
  
  if (!Number.isFinite(data.lt) || data.lt <= 0 || !Number.isFinite(data.totalPagado) || data.totalPagado <= 0) {
    return alert("Para Repostaje, debes completar Litros cargados y Costo total válidos.");
  }

  const costoLitro = data.totalPagado / data.lt;

  gasolinas.push({ 
    kmInicial: data.ini, 
    kmFinal: data.fin, 
    kmRecorridos: data.kmRec, 
    litros: data.lt, 
    costoLitro: costoLitro, 
    totalPagado: data.totalPagado, 
    precioPorKm: data.precioKm, 
    fecha: new Date().toISOString() 
  });
  
  gastos.push({ 
    descripcion: `Gasolina ${data.lt}L @ ${fmt(costoLitro)}/L`, 
    cantidad: data.totalPagado, 
    categoria: "Transporte", 
    fecha: new Date().toISOString() 
  });
  
  saveAll();
  
  e.target.reset();
  limpiarKmFinal();
  precargarKmInicial();
  actualizarKmUI();
  alert("Repostaje guardado");
  renderAdminTables();
});


// -------------------------
// EXPORT / IMPORT
// -------------------------
safeOn("btnExport", "click", () => {
  const data = { ingresos, gastos, kilometrajes, gasolinas, deudas, proyeccionParams }; // Exportar todos los datos
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `backup_presupuesto_${Date.now()}.json`; a.click();
  URL.revokeObjectURL(url);
});

safeOn("btnImport", "click", () => {
  const area = $("json-area");
  if (!area) return alert("Textarea de importación no encontrada.");
  try {
    const parsed = JSON.parse(area.value);
    ingresos = parsed.ingresos || ingresos;
    gastos = parsed.gastos || gastos;
    kilometrajes = parsed.kilometrajes || kilometrajes;
    gasolinas = parsed.gasolinas || gasolinas;
    deudas = parsed.deudas || deudas;
    proyeccionParams = parsed.proyeccionParams || proyeccionParams; // Importar parámetros de proyección
    saveAll();
    alert("Importación completada");
    renderAdminTables();
    renderDeudasAdmin(); 
    precargarKmInicial();
    renderIndex(); 
  } catch (err) {
    alert("JSON inválido: " + err.message);
  }
});


// ----------------------------------------------------
// MÓDULO DE PROYECCIÓN UBER EATS (LÓGICA)
// ----------------------------------------------------

function calcularProyeccionUber(horasDiarias, params) {
    
    const { diasRestantes, deudaMeta, gananciaHr, gastoTotalProyeccion } = params;

    const DIAS_RESTANTES = Number(diasRestantes) || DIAS_RESTANTES_DEFAULT; 
    const DEUDA_META = Number(deudaMeta) || DEUDA_META_DEFAULT;
    const TASA_GANANCIA_HR = Number(gananciaHr) || TASA_GANANCIA_HR_DEFAULT;
    
    const gananciaDiaria = horasDiarias * TASA_GANANCIA_HR;
    const gananciaSemanal = gananciaDiaria * 7;
    const gananciaTotalDias = gananciaDiaria * DIAS_RESTANTES;
    
    const SobranteDiario = Math.max(0, gananciaDiaria - gastoTotalProyeccion);

    const PagoDeudaPotencial = SobranteDiario * DIAS_RESTANTES;
    
    const PorcentajeDeudaCubierta = (PagoDeudaPotencial / DEUDA_META) * 100;
    
    const DeudaLiquidada = PagoDeudaPotencial >= DEUDA_META;

    return {
        horasDiarias,
        gananciaDiaria: Number(gananciaDiaria.toFixed(2)),
        gananciaSemanal: Number(gananciaSemanal.toFixed(2)),
        gananciaTotalDias: Number(gananciaTotalDias.toFixed(2)),
        SobranteDiario: Number(SobranteDiario.toFixed(2)),
        PagoDeudaPotencial: Number(PagoDeudaPotencial.toFixed(2)),
        PorcentajeDeudaCubierta: Math.min(100, Number(PorcentajeDeudaCubierta.toFixed(2))),
        DeudaLiquidada
    };
}

let resultadosEscenariosFijos = [];

function renderProyeccion() {
    const gas = obtenerGastoVariableGasolina();
    
    // 1. Guardar y Obtener parámetros
    saveProjectionParams(); 

    const gastoComidaDiario = Number($('gastoComidaDiario')?.value || 0);
    const gastoMotoDiario = Number($('gastoMotoDiario')?.value || 0);
    const gastoDeudaOtroDiario = Number($('gastoDeudaOtroDiario')?.value || 0);
    const diasRestantes = Number($('inputDiasRestantes')?.value || DIAS_RESTANTES_DEFAULT);
    const deudaMeta = Number($('inputDeudaMeta')?.value || DEUDA_META_DEFAULT);
    const gananciaHr = Number($('inputGananciaHr')?.value || TASA_GANANCIA_HR_DEFAULT);

    const gastoFijoDiarioTotal = gastoComidaDiario + gastoMotoDiario + gastoDeudaOtroDiario;
    const gastoTotalProyeccion = gastoFijoDiarioTotal + gas.gastoGasolinaDiario;
    
    // 2. Actualizar labels
    if ($("gastoFijoDiarioTotal")) $("gastoFijoDiarioTotal").textContent = `$${fmt(gastoFijoDiarioTotal)}`;
    if ($("gastoTotalProyeccion")) $("gastoTotalProyeccion").textContent = `$${fmt(gastoTotalProyeccion)}`;
    if ($("deudaMetaTotal")) $("deudaMetaTotal").textContent = fmt(deudaMeta);
    if ($("diasRestantesSimulador")) $("diasRestantesSimulador").textContent = diasRestantes;
    
    const params = { diasRestantes, deudaMeta, gananciaHr, gastoFijoDiarioTotal, gastoTotalProyeccion };
    
    // 3. Ejecutar Escenarios Fijos
    resultadosEscenariosFijos = [
        calcularProyeccionUber(8, params), 
        calcularProyeccionUber(10, params), 
        calcularProyeccionUber(12, params) 
    ];
    
    // 4. Renderizar Tabla y Barras
    const tablaBody = $("tabla-proyeccion")?.querySelector('tbody');
    const barrasDiv = $("proyeccion-barras");
    
    if (tablaBody) tablaBody.innerHTML = '';
    if (barrasDiv) barrasDiv.innerHTML = '';
    
    resultadosEscenariosFijos.forEach((res, index) => {
        const tr = document.createElement("tr");
        const nombreEscenario = ['Moderado (8h)', 'Agresivo (10h)', 'Máximo (12h)'][index];
        const pagoClase = res.PagoDeudaPotencial > 0 ? 'valor-positivo' : '';

        tr.innerHTML = `
            <td>${nombreEscenario}</td>
            <td>$${fmt(res.gananciaTotalDias)}</td>
            <td class="${pagoClase}">$${fmt(res.PagoDeudaPotencial)}</td>
        `;
        if (tablaBody) tablaBody.appendChild(tr);

        const barra = document.createElement("div");
        const etiqueta = res.DeudaLiquidada ? 
            '✅ ¡DEUDA LIQUIDADA!' : 
            `${res.PorcentajeDeudaCubierta}% de la meta`;

        barra.innerHTML = `
            <p>${nombreEscenario}: ${etiqueta}</p>
            <div style="background: #e0e0e0; height: 20px; border-radius: 5px; overflow: hidden; margin-bottom: 15px;">
                <div style="width: ${res.PorcentajeDeudaCubierta}%; background: ${res.DeudaLiquidada ? '#2ecc71' : '#f39c12'}; height: 100%; text-align: right; color: white; line-height: 20px; padding-right: 5px;">
                    ${Math.round(res.PorcentajeDeudaCubierta)}%
                </div>
            </div>
        `;
        if (barrasDiv) barrasDiv.appendChild(barra);
    });

    // 5. Conectar y actualizar el Simulador Dinámico
    const range = $("inputHorasTrabajadas");
    if (range) {
        const actualizarSimulador = () => {
            const horas = Number(range.value);
            const res = calcularProyeccionUber(horas, params);
            
            if ($("horasSeleccionadas")) $("horasSeleccionadas").textContent = horas.toFixed(1);
            if ($("simuladorGananciaDiariaNeto")) $("simuladorGananciaDiariaNeto").textContent = `$${fmt(res.SobranteDiario)}`;
            if ($("simuladorPagoDeuda")) $("simuladorPagoDeuda").textContent = `$${fmt(res.PagoDeudaPotencial)}`;
        };
        
        range.oninput = actualizarSimulador;
        actualizarSimulador(); 
    }
}

function setupProjectionListeners() {
    PROJECTION_INPUT_IDS.forEach(id => {
        const el = $(id);
        if(el) el.addEventListener('input', renderProyeccion);
    });

    safeOn("btnExportProjection", "click", exportToCSV);
}


// ----------------------------------------------------
// EXPORTACIÓN A CSV DE PROYECCIÓN
// ----------------------------------------------------

function exportToCSV() {
    if (resultadosEscenariosFijos.length === 0) {
        return alert("No hay datos de proyección para exportar. Asegúrate de que los parámetros están llenos.");
    }
    
    const gas = obtenerGastoVariableGasolina();
    
    const metadata = {
        'Tasa_Ganancia_x_Hora': Number($('inputGananciaHr')?.value || TASA_GANANCIA_HR_DEFAULT),
        'Dias_Restantes_Meta': Number($('inputDiasRestantes')?.value || DIAS_RESTANTES_DEFAULT),
        'Deuda_Total_Meta': Number($('inputDeudaMeta')?.value || DEUDA_META_DEFAULT),
        'Gasto_Comida_Diario': Number($('gastoComidaDiario')?.value || 0),
        'Pago_Moto_Diario': Number($('gastoMotoDiario')?.value || 0),
        'Otra_Deuda_Diaria': Number($('gastoDeudaOtroDiario')?.value || 0),
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


// -------------------------
// INDEX: resumen y gráficas
// -------------------------

function calcularResumen() {
  const totalIngresos = ingresos.reduce((s,i)=>s + (i.cantidad||0), 0);
  
  const gastosOperacionales = gastos.filter(g => g.categoria !== "Abono a Deuda");
  const totalGastosNeto = gastosOperacionales.reduce((s,g)=>s + (g.cantidad||0), 0);
  
  const deudaTotal = deudas.reduce((s,d)=>s + (d.montoActual || 0), 0); 
  const kmTotales = kilometrajes.reduce((s,k)=>s + (k.kmRecorridos||0), 0) + gasolinas.reduce((s,g)=>s + (g.kmRecorridos||0), 0);
  const gastoCombustibleTotal = gasolinas.reduce((s,g)=>s + (g.totalPagado||0), 0);
  const totalLitros = gasolinas.reduce((s,g)=>s + (g.litros||0), 0);
  
  const kmPorLitro = totalLitros > 0 ? (kmTotales / totalLitros) : 0;
  const precioKmPromedio = kmTotales > 0 ? (gastoCombustibleTotal / kmTotales) : 0;
  
  return { totalIngresos, totalGastosNeto, deudaTotal, kmTotales, gastoCombustibleTotal, precioKmPromedio, kmPorLitro };
}

function renderIndex() {
  const res = calcularResumen();
  
  // Cargar los parámetros guardados ANTES de renderizar la proyección
  loadProjectionParams(); 

  if ($("total-ingresos")) $("total-ingresos").textContent = fmt(res.totalIngresos);
  if ($("total-gastos-neto")) $("total-gastos-neto").textContent = fmt(res.totalGastosNeto);
  if ($("deudaTotalLabel")) $("deudaTotalLabel").textContent = fmt(res.deudaTotal);
  if ($("balance")) $("balance").textContent = fmt(res.totalIngresos - res.totalGastosNeto);
  
  if ($("km-recorridos")) $("km-recorridos").textContent = Number(res.kmTotales).toFixed(2);
  if ($("km-gasto")) $("km-gasto").textContent = fmt(res.gastoCombustibleTotal);
  if ($("km-rendimiento")) $("km-rendimiento").textContent = Number(res.kmPorLitro).toFixed(2);
  
  // (Lógica de Gráficas omitida por brevedad, asumiendo que funciona)
  
  renderProyeccion(); 
  setupProjectionListeners(); 
}

// -------------------------
// Inicialización según contexto
// -------------------------
function onloadApp(context) {
  // Recarga inicial de todos los arrays desde storage
  ingresos = JSON.parse(localStorage.getItem("ingresos")) || ingresos;
  gastos = JSON.parse(localStorage.getItem("gastos")) || gastos;
  kilometrajes = JSON.parse(localStorage.getItem("kilometrajes")) || kilometrajes;
  gasolinas = JSON.parse(localStorage.getItem("gasolinas")) || gasolinas;
  deudas = JSON.parse(localStorage.getItem("deudas")) || deudas;
  proyeccionParams = JSON.parse(localStorage.getItem("proyeccionParams")) || proyeccionParams;

  if (context === 'admin') {
    renderAdminTables();
    renderDeudasAdmin(); 
    renderCategorias(); 
    precargarKmInicial();
    actualizarKmUI();
  } else {
    renderIndex();
  }
}

// Hacer accesible globalmente
window.onloadApp = onloadApp;
window.saveAll = saveAll;
