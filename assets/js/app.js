/* assets/js/app.js
   Versión segura: funciona tanto en index.html como en admin.html.
   - Añade listeners SOLO si los elementos existen.
   - Expone onloadApp(context) que index.html/admin.html llaman.
*/

// -------------------------
// Storage y datos iniciales
// -------------------------
let ingresos = JSON.parse(localStorage.getItem("ingresos")) || [];
let gastos = JSON.parse(localStorage.getItem("gastos")) || [];
let kilometrajes = JSON.parse(localStorage.getItem("kilometrajes")) || [];
let gasolinas = JSON.parse(localStorage.getItem("gasolinas")) || [];
let deudas = JSON.parse(localStorage.getItem("deudas")) || [];

// Helpers seguros
const $ = id => document.getElementById(id);
const safeOn = (id, evt, fn) => { const el = $(id); if (el) el.addEventListener(evt, fn); };
const fmt = n => Number(n||0).toFixed(2);
// Helper para generar ID único de deuda
const generarId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 5);


// -------------------------
// FUNCIONES DE GUARDADO
// -------------------------
function saveAll() {
  localStorage.setItem("ingresos", JSON.stringify(ingresos));
  localStorage.setItem("gastos", JSON.stringify(gastos));
  localStorage.setItem("kilometrajes", JSON.stringify(kilometrajes));
  localStorage.setItem("gasolinas", JSON.stringify(gasolinas));
  localStorage.setItem("deudas", JSON.stringify(deudas));
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
// Se actualizan las categorías disponibles
const CATEGORIAS_GASTO = ["Transporte", "Comida", "Servicios", "Alquiler", "Hogar/Vivienda", "Ocio/Entretenimiento", "Otros", "Abono a Deuda"];

function renderCategorias() {
    const select = $("gastoCategoria");
    if (select) {
        // Aseguramos que la lista no contenga la categoría interna de Abono a Deuda
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

    // 1. Renderizar el SELECT de Abonos
    select.innerHTML = '<option value="">-- Seleccione una deuda --</option>';
    // 2. Renderizar la LISTA de deudas pendientes
    lista.innerHTML = ''; 

    const deudasPendientes = deudas.filter(d => (d.montoActual || 0) > 0);

    if (deudasPendientes.length === 0) {
        lista.innerHTML = '<li>No hay deudas pendientes.</li>';
    }

    deudasPendientes.forEach(d => {
        // Opción para el SELECT de Abonos
        const opt = document.createElement("option");
        opt.value = d.id;
        opt.textContent = `${d.nombre} ($${fmt(d.montoActual)})`;
        select.appendChild(opt);

        // Elemento para la LISTA de Deudas
        const li = document.createElement("li");
        li.innerHTML = `<span>${d.nombre}</span><span class="debt-amount">$${fmt(d.montoActual)}</span>`;
        lista.appendChild(li);
    });
}

// A. Registrar Nueva Deuda
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

// B. Registrar Abono a Deuda
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

    // 1. Actualizar el monto de la deuda
    deudas[deudaIndex].montoActual -= abonoMonto;

    // 2. Registrar el GASTO del abono para el resumen
    gastos.push({ 
        descripcion: `Abono a: ${deuda.nombre}`, 
        cantidad: abonoMonto, 
        categoria: "Abono a Deuda", // Categoría especial para gráficas
        fecha: new Date().toISOString() 
    });

    saveAll();
    e.target.reset();
    alert(`Abono de $${fmt(abonoMonto)} a ${deuda.nombre} registrado.`);
    renderDeudasAdmin();
    renderAdminTables();
});


// ----------------------------------------------------
// KM + GASOLINA CONSOLIDADO (Lógica unificada y precarga)
// ----------------------------------------------------

function obtenerCamposKm() {
  const ini = Number($("kmInicialConsolidado")?.value);
  const fin = Number($("kmFinalConsolidado")?.value);
  const lt = Number($("litrosConsolidado")?.value);
  const totalPagado = Number($("costoTotalConsolidado")?.value);
  const kmRec = (fin > ini) ? (fin - ini) : 0;
  const precioKm = (kmRec > 0 && totalPagado > 0) ? (totalPagado / kmRec) : 0;
  
  // Validaciones básicas de KM
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

    // 1. Unir y ordenar todos los registros de KM por fecha descendente
    const allKmEntries = [
        ...kilometrajes.map(k => ({ kmFinal: k.kmFinal, fecha: k.fecha })),
        ...gasolinas.map(g => ({ kmFinal: g.kmFinal, fecha: g.fecha }))
    ].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    // 2. Tomar el último KM Final
    if (allKmEntries.length > 0) {
        const lastKmFinal = allKmEntries[0].kmFinal;
        // Solo precargar si el campo está vacío o es 0
        if (kmInput.value === "" || Number(kmInput.value) === 0) {
            kmInput.value = lastKmFinal;
        }
        actualizarKmUI();
    }
}

/** Limpia el campo KM Final después de guardar */
function limpiarKmFinal() {
    const kmFinalInput = $("kmFinalConsolidado");
    if(kmFinalInput) kmFinalInput.value = "";
}


// Escuchas para actualizar la UI en vivo
["kmInicialConsolidado", "kmFinalConsolidado", "litrosConsolidado", "costoTotalConsolidado"].forEach(id => {
  const el = $(id);
  if (el) el.addEventListener("input", actualizarKmUI);
});


// 1. Guardar KM Diario (Botón: Guardar KM Diario)
safeOn("btnGuardarKmDiario", "click", () => {
  const data = obtenerCamposKm();
  if (!data) return;

  // Registrar KM Diario
  kilometrajes.push({ 
    kmInicial: data.ini, 
    kmFinal: data.fin, 
    kmRecorridos: data.kmRec, 
    fecha: new Date().toISOString() 
  });
  
  saveAll();
  
  const form = $("formKmConsolidado");
  if(form) form.reset();
  limpiarKmFinal(); // Limpia KM Final
  precargarKmInicial(); // Precarga el KM inicial para el próximo registro
  actualizarKmUI();
  alert("Kilometraje diario guardado");
  renderAdminTables();
});


// 2. Guardar Repostaje (Botón: Guardar Repostaje, o submit general del form)
safeOn("formKmConsolidado", "submit", (e) => {
  e.preventDefault();
  const data = obtenerCamposKm();
  if (!data) return;
  
  // Validaciones Repostaje: debe tener litros y costo total
  if (!Number.isFinite(data.lt) || data.lt <= 0 || !Number.isFinite(data.totalPagado) || data.totalPagado <= 0) {
    return alert("Para Repostaje, debes completar Litros cargados y Costo total válidos.");
  }

  // Costo por litro calculado para la gasolina
  const costoLitro = data.totalPagado / data.lt;

  // 1. Registrar Repostaje
  gasolinas.push({ 
    kmInicial: data.ini, 
    kmFinal: data.fin, 
    kmRecorridos: data.kmRec, 
    litros: data.lt, 
    costoLitro: costoLitro, // calculado
    totalPagado: data.totalPagado, 
    precioPorKm: data.precioKm, 
    fecha: new Date().toISOString() 
  });
  
  // 2. Registrar el GASTO
  gastos.push({ 
    descripcion: `Gasolina ${data.lt}L @ ${fmt(costoLitro)}/L`, 
    cantidad: data.totalPagado, 
    categoria: "Transporte", 
    fecha: new Date().toISOString() 
  });
  
  saveAll();
  
  e.target.reset();
  limpiarKmFinal(); // Limpia KM Final
  precargarKmInicial(); // Precarga el KM inicial para el próximo registro
  actualizarKmUI();
  alert("Repostaje guardado");
  renderAdminTables();
});


// -------------------------
// EXPORT / IMPORT
// -------------------------
safeOn("btnExport", "click", () => {
  const data = { ingresos, gastos, kilometrajes, gasolinas, deudas };
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

// -------------------------
// RENDERS (admin e index)
// -------------------------
function renderAdminTables() {
  const tabla = $("tabla-todos");
  if (tabla) {
    tabla.innerHTML = "";
    const thead = document.createElement("thead");
    thead.innerHTML = "<tr><th>Tipo</th><th>Descripción / Categoria</th><th>Monto</th><th>Fecha</th></tr>";
    tabla.appendChild(thead);
    const tbody = document.createElement("tbody");
    const items = [
      ...gastos.map(g => ({ tipo: "Gasto", desc: g.descripcion || g.categoria, monto: g.cantidad, fecha: g.fecha })),
      ...ingresos.map(i => ({ tipo: "Ingreso", desc: i.descripcion, monto: i.cantidad, fecha: i.fecha }))
    ].sort((a,b) => new Date(b.fecha) - new Date(a.fecha)).slice(0,50);
    if (items.length === 0) {
      tbody.innerHTML = "<tr><td colspan='4'>No hay movimientos</td></tr>";
    } else {
      items.forEach(it => {
        const tr = document.createElement("tr");
        const montoClase = it.tipo === "Ingreso" ? "valor-positivo" : "valor-negativo";
        tr.innerHTML = `<td>${it.tipo}</td><td>${it.desc}</td><td class="${montoClase}">$${fmt(it.monto)}</td><td>${new Date(it.fecha).toLocaleString()}</td>`;
        tbody.appendChild(tr);
      });
    }
    tabla.appendChild(tbody);
  }
}

// -------------------------
// INDEX: resumen y gráficas
// -------------------------
function calcularResumen() {
  const totalIngresos = ingresos.reduce((s,i)=>s + (i.cantidad||0), 0);
  
  // 1. Cálculo del Gasto Neto (Excluyendo Abonos a Deuda)
  const gastosOperacionales = gastos.filter(g => g.categoria !== "Abono a Deuda");
  const totalGastosNeto = gastosOperacionales.reduce((s,g)=>s + (g.cantidad||0), 0);
  
  const deudaTotal = deudas.reduce((s,d)=>s + (d.montoActual || 0), 0); 
  const kmTotales = kilometrajes.reduce((s,k)=>s + (k.kmRecorridos||0), 0) + gasolinas.reduce((s,g)=>s + (g.kmRecorridos||0), 0);
  const gastoCombustibleTotal = gasolinas.reduce((s,g)=>s + (g.totalPagado||0), 0);
  const totalLitros = gasolinas.reduce((s,g)=>s + (g.litros||0), 0);
  
  // 2. Cálculo de Rendimiento
  const kmPorLitro = totalLitros > 0 ? (kmTotales / totalLitros) : 0;
  const precioKmPromedio = kmTotales > 0 ? (gastoCombustibleTotal / kmTotales) : 0;
  
  return { totalIngresos, totalGastosNeto, deudaTotal, kmTotales, gastoCombustibleTotal, precioKmPromedio, kmPorLitro };
}

function renderIndex() {
  const res = calcularResumen();
  if ($("total-ingresos")) $("total-ingresos").textContent = fmt(res.totalIngresos);
  // Se actualiza la tarjeta de Gasto Neto
  if ($("total-gastos-neto")) $("total-gastos-neto").textContent = fmt(res.totalGastosNeto);
  if ($("deudaTotalLabel")) $("deudaTotalLabel").textContent = fmt(res.deudaTotal);
  // Balance ahora usa Gasto Neto
  if ($("balance")) $("balance").textContent = fmt(res.totalIngresos - res.totalGastosNeto);
  
  if ($("km-recorridos")) $("km-recorridos").textContent = Number(res.kmTotales).toFixed(2);
  if ($("km-gasto")) $("km-gasto").textContent = fmt(res.gastoCombustibleTotal);
  // Se actualiza la tarjeta de Rendimiento
  if ($("km-rendimiento")) $("km-rendimiento").textContent = Number(res.kmPorLitro).toFixed(2);
  
  // Gráfica de categorías (pie)
  const canvasCat = $("grafica-categorias");
  if (canvasCat && typeof Chart !== "undefined") {
    const map = {};
    // La gráfica de categorías debe incluir Abonos a Deuda para ser completa
    gastos.forEach(g => { map[g.categoria] = (map[g.categoria]||0) + g.cantidad; });
    const labels = Object.keys(map);
    const data = labels.map(l => map[l]);
    if (window._chartCategorias) window._chartCategorias.destroy();
    window._chartCategorias = new Chart(canvasCat.getContext('2d'), { type:'pie', data:{ labels, datasets:[{ data, backgroundColor: labels.map((_,i)=>`hsl(${i*55 % 360} 70% 60%)`) }] } });
  }
  
  // Ingresos vs Gastos (por mes)
  const canvasIG = $("grafica-ingresos-gastos");
  if (canvasIG && typeof Chart !== "undefined") {
    const monthly = {};
    
    // Los ingresos siguen siendo todos
    ingresos.forEach(i => { 
      const d=new Date(i.fecha); 
      if (!isNaN(d)) { 
        const k=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; 
        monthly[k]=monthly[k]||{Ingreso:0,Gasto:0}; 
        monthly[k].Ingreso+=i.cantidad; 
      }
    });
    
    // Los gastos aquí deben ser TODOS (incluidos abonos) para tener una vista completa del dinero que salió
    gastos.forEach(g => { 
      const d=new Date(g.fecha); 
      if (!isNaN(d)) { 
        const k=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; 
        monthly[k]=monthly[k]||{Ingreso:0,Gasto:0}; 
        monthly[k].Gasto+=g.cantidad; 
      }
    });
    
    const labels = Object.keys(monthly).sort();
    const ingresosData = labels.map(l => monthly[l].Ingreso || 0);
    const gastosData = labels.map(l => monthly[l].Gasto || 0);
    
    if (window._chartIG) window._chartIG.destroy();
    window._chartIG = new Chart(canvasIG.getContext('2d'), { 
      type:'bar', 
      data:{ 
        labels, 
        datasets:[
          { label:'Ingresos', data:ingresosData, backgroundColor: 'rgba(75, 192, 192, 0.6)' }, 
          { label:'Gastos', data:gastosData, backgroundColor: 'rgba(255, 99, 132, 0.6)' }
        ] 
      }, 
      options:{ responsive:true }
    });
  }
  
  // Deuda vs Abonos
  const canvasDA = $("grafica-deuda-abono");
  if (canvasDA && typeof Chart !== "undefined") {
    const totalDeuda = deudas.reduce((s,d)=>s + (d.montoActual||0),0);
    const totalAbonos = gastos.filter(g => g.categoria === "Abono a Deuda").reduce((s,g)=>s + (g.cantidad||0),0);
    if (window._chartDA) window._chartDA.destroy();
    window._chartDA = new Chart(canvasDA.getContext('2d'), { 
      type:'bar', 
      data:{ 
        labels:['Deuda Pendiente','Total Abonos Realizados'], 
        datasets:[{ label:'$', data:[totalDeuda,totalAbonos], backgroundColor: ['#f39c12', '#2ecc71'] }] 
      } 
    });
  }
  
  // Km vs Gasto
  const canvasKM = $("grafica-km-gasto");
  if (canvasKM && typeof Chart !== "undefined") {
    const kmTotales = res.kmTotales;
    const gastoComb = res.gastoCombustibleTotal;
    if (window._chartKM) window._chartKM.destroy();
    window._chartKM = new Chart(canvasKM.getContext('2d'), { 
      type:'bar', 
      data:{ 
        labels:['Km totales','Gasto combustible'], 
        datasets:[{ label:'Valor', data:[kmTotales,gastoComb], backgroundColor: ['#3498db', '#e74c3c'] }] 
      } 
    });
  }
}

// -------------------------
// Inicialización según contexto
// -------------------------
function onloadApp(context) {
  // recarga arrays desde storage
  ingresos = JSON.parse(localStorage.getItem("ingresos")) || ingresos;
  gastos = JSON.parse(localStorage.getItem("gastos")) || gastos;
  kilometrajes = JSON.parse(localStorage.getItem("kilometrajes")) || kilometrajes;
  gasolinas = JSON.parse(localStorage.getItem("gasolinas")) || gasolinas;
  deudas = JSON.parse(localStorage.getItem("deudas")) || deudas;

  if (context === 'admin') {
    renderAdminTables();
    renderDeudasAdmin(); 
    renderCategorias(); // Carga las categorías
    precargarKmInicial();
    actualizarKmUI();
  } else {
    renderIndex();
  }
}

// Hacer accesible globalmente
window.onloadApp = onloadApp;
window.saveAll = saveAll;
window.renderAdminTables = renderAdminTables;
window.renderIndex = renderIndex;
window.actualizarKmUI = actualizarKmUI;
window.renderDeudasAdmin = renderDeudasAdmin;
window.precargarKmInicial = precargarKmInicial;
