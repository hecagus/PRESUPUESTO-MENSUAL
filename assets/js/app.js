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

// -------------------------
// KM DIARIO (no gasolina)
// -------------------------
safeOn("formKmDiario", "submit", (e) => {
  e.preventDefault();
  const ini = Number($("kmInicialDiario")?.value);
  const fin = Number($("kmFinalDiario")?.value);
  if (!Number.isFinite(ini) || !Number.isFinite(fin) || fin <= ini) return alert("KM inválidos.");
  const rec = fin - ini;
  kilometrajes.push({ kmInicial: ini, kmFinal: fin, kmRecorridos: rec, fecha: new Date().toISOString() });
  saveAll();
  e.target.reset();
  if ($("kmDiarioResultado")) $("kmDiarioResultado").textContent = rec;
  alert("Kilometraje diario guardado");
  renderAdminTables();
});

// -------------------------
// GASOLINA + cálculo en vivo
// -------------------------
function actualizarGasUI() {
  const ini = Number($("kmInicial")?.value || 0);
  const fin = Number($("kmFinal")?.value || 0);
  const lt = Number($("litros")?.value || 0);
  const costo = Number($("costoLitro")?.value || 0);
  const kmRec = (fin > ini) ? (fin - ini) : 0;
  const total = lt * costo;
  const precioKm = kmRec > 0 ? total / kmRec : 0;
  if ($("kmRecorridos")) $("kmRecorridos").textContent = kmRec;
  if ($("precioKm")) $("precioKm").textContent = fmt(precioKm);
}

["kmInicial","kmFinal","litros","costoLitro"].forEach(id => {
  const el = $(id);
  if (el) el.addEventListener("input", actualizarGasUI);
});

// Guardar repostaje
safeOn("formGasolina", "submit", (e) => {
  e.preventDefault();
  const ini = Number($("kmInicial")?.value);
  const fin = Number($("kmFinal")?.value);
  const lt = Number($("litros")?.value);
  const costo = Number($("costoLitro")?.value);
  if (!Number.isFinite(ini) || !Number.isFinite(fin) || fin <= ini) return alert("KM inválidos.");
  
  // CORRECCIÓN 1: El typo 'cost o' ha sido corregido a 'costo' para la validación.
  if (!Number.isFinite(lt) || lt <= 0 || !Number.isFinite(costo) || costo <= 0) return alert("Litros y costo por litro válidos.");
  
  const kmRec = fin - ini;
  const total = lt * costo;
  const precioKm = kmRec > 0 ? total / kmRec : 0;
  gasolinas.push({ kmInicial: ini, kmFinal: fin, kmRecorridos: kmRec, litros: lt, costoLitro: costo, totalPagado: total, precioPorKm: precioKm, fecha: new Date().toISOString() });
  // también añadimos gasto a 'gastos' para que el resumen lo considere
  gastos.push({ descripcion: `Gasolina ${lt}L @ ${fmt(costo)}`, cantidad: total, categoria: "Gasolina", fecha: new Date().toISOString() });
  saveAll();
  e.target.reset();
  if ($("kmRecorridos")) $("kmRecorridos").textContent = "0";
  if ($("precioKm")) $("precioKm").textContent = "0.00";
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
  } catch (err) {
    alert("JSON inválido: " + err.message);
  }
});

// -------------------------
// RENDERS (admin e index)
// -------------------------
function renderAdminTables() {
  // tabla-todos (mostramos últimos movimientos básicos)
  const tabla = $("tabla-todos");
  if (tabla) {
    tabla.innerHTML = "";
    const thead = document.createElement("thead");
    thead.innerHTML = "<tr><th>Tipo</th><th>Descripción / Categoria</th><th>Monto</th><th>Fecha</th></tr>";
    tabla.appendChild(thead);
    const tbody = document.createElement("tbody");
    // unificar list: ingresos (tipo Ingreso), gastos (tipo Gasto)
    const items = [
      // Añadimos una marca de tipo para distinguir en la tabla, si es necesario
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
  const totalGastos = gastos.reduce((s,g)=>s + (g.cantidad||0), 0);
  // NOTA: Se asume que 'montoActual' en deudas es el campo correcto, si deudas fuera a implementarse.
  const deudaTotal = deudas.reduce((s,d)=>s + (d.montoActual || 0), 0); 
  const kmTotales = kilometrajes.reduce((s,k)=>s + (k.kmRecorridos||0), 0) + gasolinas.reduce((s,g)=>s + (g.kmRecorridos||0), 0);
  const gastoCombustibleTotal = gasolinas.reduce((s,g)=>s + (g.totalPagado||0), 0);
  const precioKmPromedio = kmTotales > 0 ? (gastoCombustibleTotal / kmTotales) : 0;
  return { totalIngresos, totalGastos, deudaTotal, kmTotales, gastoCombustibleTotal, precioKmPromedio };
}

function renderIndex() {
  const res = calcularResumen();
  if ($("total-ingresos")) $("total-ingresos").textContent = fmt(res.totalIngresos);
  if ($("total-gastos")) $("total-gastos").textContent = fmt(res.totalGastos);
  if ($("deudaTotalLabel")) $("deudaTotalLabel").textContent = fmt(res.deudaTotal);
  if ($("balance")) $("balance").textContent = fmt(res.totalIngresos - res.totalGastos);
  if ($("km-recorridos")) $("km-recorridos").textContent = Number(res.kmTotales).toFixed(2);
  if ($("km-gasto")) $("km-gasto").textContent = fmt(res.gastoCombustibleTotal);
  
  // tablas y gráficas: solo si existen canvases
  
  // gráfica de categorías (pie)
  const canvasCat = $("grafica-categorias");
  if (canvasCat && typeof Chart !== "undefined") {
    const map = {};
    // categorías desde gastos
    gastos.forEach(g => { map[g.categoria] = (map[g.categoria]||0) + g.cantidad; });
    const labels = Object.keys(map);
    const data = labels.map(l => map[l]);
    // destroy previous if any
    if (window._chartCategorias) window._chartCategorias.destroy();
    window._chartCategorias = new Chart(canvasCat.getContext('2d'), { type:'pie', data:{ labels, datasets:[{ data, backgroundColor: labels.map((_,i)=>`hsl(${i*55 % 360} 70% 60%)`) }] } });
  }
  
  // Ingresos vs Gastos (por mes)
  const canvasIG = $("grafica-ingresos-gastos");
  if (canvasIG && typeof Chart !== "undefined") {
    const monthly = {};
    
    // CORRECCIÓN 2: Se simplificó y se mantuvo solo la lógica de cálculo por mes correcta, 
    // eliminando el bloque de código redundante e incorrecto.
    ingresos.forEach(i => { 
      const d=new Date(i.fecha); 
      if (!isNaN(d)) { 
        const k=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; 
        monthly[k]=monthly[k]||{Ingreso:0,Gasto:0}; 
        monthly[k].Ingreso+=i.cantidad; 
      }
    });
    
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
    // Se asume que los abonos a deuda se registran como gastos con categoría "Abono a Deuda".
    const totalAbonos = gastos.filter(g => g.categoria === "Abono a Deuda").reduce((s,g)=>s + (g.cantidad||0),0);
    if (window._chartDA) window._chartDA.destroy();
    window._chartDA = new Chart(canvasDA.getContext('2d'), { 
      type:'bar', 
      data:{ 
        labels:['Deuda Pendiente','Total Abonos'], 
        datasets:[{ label:'$', data:[totalDeuda,totalAbonos], backgroundColor: ['#f39c12', '#2ecc71'] }] 
      } 
    });
  }
  
  // Km vs Gasto
  const canvasKM = $("grafica-km-gasto");
  if (canvasKM && typeof Chart !== "undefined") {
    const kmTotales = kilometrajes.reduce((s,k)=>s + (k.kmRecorridos||0),0) + gasolinas.reduce((s,g)=>s + (g.kmRecorridos||0),0);
    const gastoComb = gasolinas.reduce((s,g)=>s + (g.totalPagado||0),0);
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
  } else {
    renderIndex();
  }
}

// Hacer accesible globalmente
window.onloadApp = onloadApp;
window.saveAll = saveAll;
window.renderAdminTables = renderAdminTables;
window.renderIndex = renderIndex;
