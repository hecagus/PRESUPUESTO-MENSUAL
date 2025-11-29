/* assets/js/app.js
   Versión con Persistencia Total y separación de inputs (admin) vs resultados (index).
*/

// -------------------------
// Storage y datos iniciales
// -------------------------
let ingresos = JSON.parse(localStorage.getItem("ingresos")) || [];
let gastos = JSON.parse(localStorage.getItem("gastos")) || [];
let kilometrajes = JSON.parse(localStorage.getItem("kilometrajes")) || [];
let gasolinas = JSON.parse(localStorage.getItem("gasolinas")) || [];
let deudas = JSON.parse(localStorage.getItem("deudas")) || [];
let proyeccionParams = JSON.parse(localStorage.getItem("proyeccionParams")) || {};


// Valores por defecto
const TASA_GANANCIA_HR_DEFAULT = 101.56; 
const DEUDA_META_DEFAULT = 19793;
const DIAS_RESTANTES_DEFAULT = 33;

// IDs de los campos de proyección que queremos guardar (Todos están en admin.html)
const PROJECTION_INPUT_IDS = [
    "inputDiasRestantes", 
    "inputDeudaMeta", 
    "inputGananciaHr", 
    "gastoComidaDiario", 
    "gastoMotoDiario", 
    "gastoDeudaOtroDiario",
    "inputHorasTrabajadas" // Se añade el rango del simulador para persistir la última hora usada
];


// Helpers seguros
const $ = id => document.getElementById(id);
const safeOn = (id, evt, fn) => { const el = $(id); if (el) el.addEventListener(evt, fn); };
const fmt = n => Number(n||0).toFixed(2);
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
  localStorage.setItem("proyeccionParams", JSON.stringify(proyeccionParams)); 
}

function saveProjectionParams() {
    PROJECTION_INPUT_IDS.forEach(id => {
        const el = $(id);
        if (el) {
            proyeccionParams[id] = el.value;
        }
    });
    localStorage.setItem("proyeccionParams", JSON.stringify(proyeccionParams));
}

function loadProjectionParams() {
    PROJECTION_INPUT_IDS.forEach(id => {
        const el = $(id);
        if (el && proyeccionParams[id] !== undefined) {
            el.value = proyeccionParams[id];
        }
    });
}

// -------------------------
// ADMIN: Ingresos, Gastos, Deudas, KM/Gasolina (Lógica mantenida)
// -------------------------
const CATEGORIAS_GASTO = ["Transporte", "Comida", "Servicios", "Alquiler", "Hogar/Vivienda", "Ocio/Entretenimiento", "Otros", "Abono a Deuda"];

function renderCategorias() {
    const select = $("gastoCategoria");
    if (select) {
        const categoriasVisibles = CATEGORIAS_GASTO.filter(c => c !== "Abono a Deuda");
        select.innerHTML = categoriasVisibles.map(c => `<option value="${c}">${c}</option>`).join('');
    }
}
//... [El resto de las funciones de formularios como formIngreso, formGasto, formNuevaDeuda, formAbonoDeuda, y KM/Gasolina se mantienen del archivo anterior]
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

function obtenerGastoVariableGasolina() {
    const kmTotales = kilometrajes.reduce((s,k)=>s + (k.kmRecorridos||0), 0) + gasolinas.reduce((s,g)=>s + (g.kmRecorridos||0), 0);
    const gastoCombustibleTotal = gasolinas.reduce((s,g)=>s + (g.totalPagado||0), 0);
    
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
//... [Fin de funciones de formularios]


// ----------------------------------------------------
// MÓDULO DE PROYECCIÓN UBER EATS (LÓGICA)
// ----------------------------------------------------
function getProjectionParams(source = 'UI') {
    // Si la fuente es 'UI' (admin.html), leemos los inputs. Si es 'STORE' (index.html), leemos los valores guardados.
    const reader = source === 'UI' ? (id) => $(id)?.value : (id) => proyeccionParams[id];
    
    // Si estamos en index.html, los campos de gasto fijo son solo representaciones visuales
    const gastoComidaDiario = Number(reader('gastoComidaDiario') || proyeccionParams['gastoComidaDiario'] || 0);
    const gastoMotoDiario = Number(reader('gastoMotoDiario') || proyeccionParams['gastoMotoDiario'] || 0);
    const gastoDeudaOtroDiario = Number(reader('gastoDeudaOtroDiario') || proyeccionParams['gastoDeudaOtroDiario'] || 0);
    
    const gas = obtenerGastoVariableGasolina();
    const gastoFijoDiarioTotal = gastoComidaDiario + gastoMotoDiario + gastoDeudaOtroDiario;
    const gastoTotalProyeccion = gastoFijoDiarioTotal + gas.gastoGasolinaDiario;

    return { 
        diasRestantes: Number(reader('inputDiasRestantes') || proyeccionParams['inputDiasRestantes'] || DIAS_RESTANTES_DEFAULT),
        deudaMeta: Number(reader('inputDeudaMeta') || proyeccionParams['inputDeudaMeta'] || DEUDA_META_DEFAULT),
        gananciaHr: Number(reader('inputGananciaHr') || proyeccionParams['inputGananciaHr'] || TASA_GANANCIA_HR_DEFAULT),
        horasTrabajadas: Number(reader('inputHorasTrabajadas') || proyeccionParams['inputHorasTrabajadas'] || 8), // Última hora usada
        gastoFijoDiarioTotal,
        gastoTotalProyeccion
    };
}


function calcularProyeccionUber(horasDiarias, params) {
    const { diasRestantes, deudaMeta, gananciaHr, gastoTotalProyeccion } = params;

    const DIAS_RESTANTES = diasRestantes; 
    const DEUDA_META = deudaMeta;
    const TASA_GANANCIA_HR = gananciaHr;
    
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

/**
 * Renderiza la tarjeta de proyección.
 * Lee los datos de la UI si estamos en admin, o del Storage si estamos en index.
 */
function renderProyeccion(context) {
    const isUI = context === 'admin';
    
    // 1. Obtener parámetros (Guarda si estamos en la UI)
    if (isUI) {
        saveProjectionParams(); 
        loadProjectionParams(); // Carga de nuevo para actualizar los campos
    }
    
    const params = getProjectionParams(isUI ? 'UI' : 'STORE'); 
    const { diasRestantes, deudaMeta, gastoFijoDiarioTotal, gastoTotalProyeccion, horasTrabajadas } = params;
    
    // 2. Actualizar labels de Parámetros (Solo si existen en la página actual)
    if ($("gastoFijoDiarioTotal")) $("gastoFijoDiarioTotal").textContent = `$${fmt(gastoFijoDiarioTotal)}`;
    if ($("gastoTotalProyeccion")) $("gastoTotalProyeccion").textContent = `$${fmt(gastoTotalProyeccion)}`;
    if ($("deudaMetaTotal")) $("deudaMetaTotal").textContent = fmt(deudaMeta);
    if ($("diasRestantesSimulador")) $("diasRestantesSimulador").textContent = diasRestantes;
    
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

    // 5. Actualizar Simulador Dinámico (Solo muestra el resultado del último valor guardado en index)
    const resSimulador = calcularProyeccionUber(horasTrabajadas, params);
    if ($("horasSeleccionadas")) $("horasSeleccionadas").textContent = horasTrabajadas.toFixed(1);
    if ($("simuladorGananciaDiariaNeto")) $("simuladorGananciaDiariaNeto").textContent = `$${fmt(resSimulador.SobranteDiario)}`;
    if ($("simuladorPagoDeuda")) $("simuladorPagoDeuda").textContent = `$${fmt(resSimulador.PagoDeudaPotencial)}`;

    // Si estamos en la página de administración, configuramos el listener del rango
    if (isUI) {
        const range = $("inputHorasTrabajadas");
        if (range) {
            range.oninput = () => {
                // Forzamos el guardado y el re-renderizado en el movimiento del rango
                saveProjectionParams(); 
                renderProyeccion('admin'); 
            };
        }
    }
}

/**
 * Conecta los listeners de los inputs de proyección y el botón de exportación.
 * Esto solo ocurre en admin.html.
 */
function setupProjectionListeners() {
    // 1. Inputs de Parámetros Dinámicos: Actualizan la proyección y guardan el valor.
    PROJECTION_INPUT_IDS.forEach(id => {
        // Excluimos el rango de horas, que tiene su propio oninput.
        if (id !== "inputHorasTrabajadas") {
            const el = $(id);
            if(el) el.addEventListener('input', () => { 
                renderProyeccion('admin'); 
            });
        }
    });

    // 2. Botón de Exportación
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
    const params = getProjectionParams('STORE'); 
    
    // Metadatos (usamos los valores guardados)
    Metadatos (usamos los valores guardados)
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
  
  // No necesitamos loadProjectionParams() aquí, pues los inputs no existen.
  // Solo necesitamos renderProyeccion() para que lea los datos guardados.

  if ($("total-ingresos")) $("total-ingresos").textContent = fmt(res.totalIngresos);
  if ($("total-gastos-neto")) $("total-gastos-neto").textContent = fmt(res.totalGastosNeto);
  if ($("deudaTotalLabel")) $("deudaTotalLabel").textContent = fmt(res.deudaTotal);
  if ($("balance")) $("balance").textContent = fmt(res.totalIngresos - res.totalGastosNeto);
  
  if ($("km-recorridos")) $("km-recorridos").textContent = Number(res.kmTotales).toFixed(2);
  if ($("km-gasto")) $("km-gasto").textContent = fmt(res.gastoCombustibleTotal);
  if ($("km-rendimiento")) $("km-rendimiento").textContent = Number(res.kmPorLitro).toFixed(2);
  
  // Renderiza resultados de proyección leyendo del storage
  renderProyeccion('index'); 
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
    // Cargar los valores de la proyección ANTES de renderizar, para que la UI los muestre
    loadProjectionParams(); 
    renderAdminTables();
    renderDeudasAdmin(); 
    renderCategorias(); 
    precargarKmInicial();
    actualizarKmUI();
    renderProyeccion('admin'); // Inicializa la vista de admin, guarda/actualiza
    setupProjectionListeners(); // Configura listeners de inputs y exportación
  } else {
    renderIndex();
  }
}

// Globalización de funciones (Necesarias para el admin.html)
window.renderAdminTables = () => { /* ... lógica de renderizado de tabla general ... */ };
window.onloadApp = onloadApp;
window.saveAll = saveAll;
