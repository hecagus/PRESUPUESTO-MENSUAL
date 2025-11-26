/****************************************************
 * Presupuesto Mensual — app.js (versión reforzada)
 * - Detecta y reporta errores en consola
 * - Registra eventos en DOMContentLoaded
 * - Exports funciones globales que usa admin.html
 ****************************************************/

console.log("[app.js] Iniciando script...");

// -------------------------
// Keys localStorage
// -------------------------
const DATA_KEY = "budget_data_v1";
const CFG_KEY  = "budget_cfg_v1";
const CAT_KEY  = "budget_categories_v1";

// -------------------------
// State inicial
// -------------------------
let movimientos = JSON.parse(localStorage.getItem(DATA_KEY)) || [];
let config = JSON.parse(localStorage.getItem(CFG_KEY)) || {
  kmInicial: 0,
  kmFinal: 0,
  gastoPesos: 0,
  precioKm: 0
};
let categorias = JSON.parse(localStorage.getItem(CAT_KEY)) || {
  ingreso: ["Quincenal", "Mensual", "Propinas", "Uber", "Otros"],
  gasto:  ["Comida", "Gasolina", "Internet", "Renta", "Servicios", "Despensa"]
};

// -------------------------
// Helpers de guardado
// -------------------------
function saveData() { localStorage.setItem(DATA_KEY, JSON.stringify(movimientos)); }
function saveConfig(){ localStorage.setItem(CFG_KEY, JSON.stringify(config)); }
function saveCategorias(){ localStorage.setItem(CAT_KEY, JSON.stringify(categorias)); }

// -------------------------
// Utilidades
// -------------------------
function money(v){ return "$" + Number(v || 0).toFixed(2); }
function safeGet(id){
  const el = document.getElementById(id);
  if (!el) console.warn(`[app.js] Elemento no encontrado: #${id}`);
  return el;
}

// -------------------------
// RENDER PÚBLICO
// -------------------------
function renderPublic(){
  try {
    renderTotals();
    renderRecent();
    renderCharts();
  } catch (e) {
    console.error("[app.js] Error renderPublic:", e);
  }
}

function renderTotals(){
  const totalIng = movimientos.filter(m => m.tipo === "ingreso").reduce((s,m)=> s + Number(m.monto || 0), 0);
  const totalGas = movimientos.filter(m => m.tipo === "gasto").reduce((s,m)=> s + Number(m.monto || 0), 0);

  const elI = safeGet("total-income");
  const elG = safeGet("total-expense");
  const elB = safeGet("balance");
  if (elI) elI.textContent = money(totalIng);
  if (elG) elG.textContent = money(totalGas);
  if (elB) elB.textContent = money(totalIng - totalGas);
}

function renderRecent(){
  const tbody = document.querySelector("#recent-table tbody");
  if (!tbody) return;
  tbody.innerHTML = "";
  const ultimos = [...movimientos].slice(-12).reverse();
  for (const m of ultimos){
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${m.fecha || ""}</td>
      <td>${m.tipo || ""}</td>
      <td>${m.categoria || m.income_type || ""}</td>
      <td>${m.descripcion || "-"}</td>
      <td>${money(m.monto)}</td>
    `;
    tbody.appendChild(tr);
  }
}

// Charts (simple safe wrappers)
let pieChart = null, barChart = null;
function renderCharts(){
  renderPie();
  renderBar();
}

function renderPie(){
  const canvas = safeGet("pie-expense");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const byCat = {};
  movimientos.filter(m => m.tipo === "gasto").forEach(g => {
    const cat = g.categoria || "Otros";
    byCat[cat] = (byCat[cat] || 0) + Number(g.monto || 0);
  });
  const labels = Object.keys(byCat);
  const data = Object.values(byCat);
  if (pieChart) try{ pieChart.destroy(); }catch(e){}
  pieChart = new Chart(ctx, {
    type: "pie",
    data: { labels, datasets: [{ data, backgroundColor: generateColors(labels.length) }] },
    options: { plugins:{ legend:{ position:"bottom" } } }
  });
}

function renderBar(){
  const canvas = safeGet("bar-balance");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const months = {};
  movimientos.forEach(m=>{
    const f = String(m.fecha || "").slice(0,7);
    if (!f) return;
    months[f] = months[f] || { ing:0, gas:0 };
    if (m.tipo === "ingreso") months[f].ing += Number(m.monto || 0);
    if (m.tipo === "gasto")   months[f].gas += Number(m.monto || 0);
  });
  const labels = Object.keys(months).sort();
  const income = labels.map(l => months[l].ing);
  const expense = labels.map(l => months[l].gas);
  if (barChart) try{ barChart.destroy(); }catch(e){}
  barChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets:[
        { label: "Ingresos", data: income },
        { label: "Gastos", data: expense }
      ]
    },
    options: { plugins:{ legend:{ position:"top" } }, responsive:true }
  });
}

function generateColors(n){
  const base = ['#0066cc','#2b9af3','#00a86b','#ffb020','#ff6b6b','#7b61ff','#00b5ad','#f77f00','#9fb0ff','#ffd6a5','#caffbf','#bdb2ff'];
  const out = [];
  for (let i=0;i<n;i++) out.push(base[i % base.length]);
  return out;
}

// -------------------------
// FUNCIONES REQUERIDAS POR admin.html
// -------------------------

// llenar el select de categorías según tipo seleccionado
function cambiarTipo(){
  try{
    const tipoSel = safeGet("movTipo");
    const catSel  = safeGet("movCategoria");
    if (!tipoSel || !catSel) return;
    const tipo = tipoSel.value;
    catSel.innerHTML = ""; // limpiar
    if (!tipo) {
      const op = document.createElement("option"); op.value=""; op.textContent = "Seleccione..."; catSel.appendChild(op);
      return;
    }
    const list = categorias[tipo] || [];
    if (list.length === 0){
      const op = document.createElement("option"); op.value=""; op.textContent = "(sin tipos)"; catSel.appendChild(op);
      return;
    }
    list.forEach(item=>{
      const op = document.createElement("option"); op.value = item; op.textContent = item; catSel.appendChild(op);
    });
  } catch(e){ console.error("[app.js] cambiarTipo error:", e); }
}

// agregar nueva categoría al tipo actual
function agregarNuevoTipo(){
  try{
    const tipo = (safeGet("movTipo") && safeGet("movTipo").value) || "";
    const nuevo = (safeGet("nuevoTipo") && safeGet("nuevoTipo").value || "").trim();
    if (!tipo) return alert("Selecciona si es ingreso o gasto antes de añadir un tipo.");
    if (!nuevo) return alert("Escribe el nombre de la nueva categoría/tipo.");
    categorias[tipo] = categorias[tipo] || [];
    if (categorias[tipo].includes(nuevo)) return alert("Ese tipo ya existe.");
    categorias[tipo].push(nuevo);
    saveCategorias();
    (safeGet("nuevoTipo") && (safeGet("nuevoTipo").value = ""));
    cambiarTipo();
    alert("Tipo agregado correctamente.");
  } catch(e){ console.error("[app.js] agregarNuevoTipo error:", e); }
}

// agregar movimiento (llamado desde admin.html)
function agregarMovimiento(){
  try{
    const fecha = (safeGet("movFecha") && safeGet("movFecha").value) || "";
    const tipo  = (safeGet("movTipo") && safeGet("movTipo").value) || "";
    const categoria = (safeGet("movCategoria") && safeGet("movCategoria").value) || "";
    const montoRaw  = (safeGet("movMonto") && safeGet("movMonto").value);
    const monto = Number(montoRaw);
    if (!fecha) return alert("Selecciona una fecha.");
    if (!tipo) return alert("Selecciona tipo (ingreso/gasto).");
    if (!categoria) return alert("Selecciona o crea una categoría.");
    if (isNaN(monto) || monto <= 0) return alert("Ingresa un monto válido mayor que 0.");
    movimientos.push({ fecha, tipo, categoria, descripcion: "", monto: +monto });
    saveData();
    renderPublic();
    alert("Movimiento agregado.");
    // limpiar campos (opcional)
    if (safeGet("movMonto")) safeGet("movMonto").value = "";
    // si estás en admin.html, refrescar lista
    if (typeof renderAdmin === "function") try{ renderAdmin(); }catch(e){}
  } catch(e){ console.error("[app.js] agregarMovimiento error:", e); alert("Error al agregar movimiento."); }
}

// calcular kilometraje y guardar (llamado desde admin)
function calcularKm(){
  try{
    const kmI = Number((safeGet("kmInicial") && safeGet("kmInicial").value) || 0);
    const kmF = Number((safeGet("kmFinal") && safeGet("kmFinal").value) || 0);
    const gasto = Number((safeGet("kmGasto") && safeGet("kmGasto").value) || 0);
    if (isNaN(kmI) || isNaN(kmF) ) return alert("Kilometraje inválido.");
    if (kmF < kmI) return alert("El kilometraje final debe ser mayor o igual al inicial.");
    const diff = kmF - kmI;
    const precio = diff > 0 ? (gasto / diff) : 0;
    config.kmInicial = kmI; config.kmFinal = kmF; config.gastoPesos = gasto; config.precioKm = precio;
    saveConfig();
    const priceEl = safeGet("precioKmCalc");
    if (priceEl) priceEl.textContent = precio.toFixed(2);
    // crear movimiento gasto automático solo si hay gasto > 0
    if (gasto > 0){
      movimientos.push({
        fecha: new Date().toISOString().slice(0,10),
        tipo: "gasto",
        categoria: "Gasolina",
        descripcion: `Gasto gasolina - ${diff} km`,
        monto: +gasto
      });
      saveData(); renderPublic();
    }
    alert("Kilometraje guardado. Gasto registrado (si aplicó).");
  } catch(e){ console.error("[app.js] calcularKm error:", e); alert("Error calculando kilometraje."); }
}

// cargar configuración al formulario
function cargarKm(){
  try{
    const p1 = safeGet("kmInicial"); if (p1) p1.value = config.kmInicial || 0;
    const p2 = safeGet("kmFinal");   if (p2) p2.value = config.kmFinal || 0;
    const p3 = safeGet("kmGasto");   if (p3) p3.value = config.gastoPesos || 0;
    const priceEl = safeGet("precioKmCalc"); if (priceEl) priceEl.textContent = (config.precioKm || 0).toFixed(2);
  } catch(e){ console.error("[app.js] cargarKm error:", e); }
}

// función auxiliar para refrescar admin UI (opcional, si existe)
function renderAdmin(){
  try{
    // recargar selects
    cambiarTipo();
    // actualizar listas personalizadas si las usas
    // (implementar si se añadió sección para mostrar custom list)
  } catch(e){ console.error("[app.js] renderAdmin error:", e); }
}

// borrar todo (opcional)
function borrarTodo(){
  if (!confirm("¿Borrar todos los movimientos?")) return;
  movimientos = [];
  saveData();
  renderPublic();
  alert("Datos borrados.");
}

// -------------------------
// Inicialización al cargar la página
// -------------------------
document.addEventListener("DOMContentLoaded", () => {
  console.log("[app.js] DOM listo. Inicializando UI...");
  // try to populate selects and fields safely
  try {
    // si hay index.html visible
    renderPublic();
  } catch(e){ console.warn(e); }

  // Si estamos en admin.html, enlazamos botones (por si usan onclick inline o no)
  try {
    // cargar config y categorias en campos si existen
    cargarKm();
    cambiarTipo();

    // ligar botones por id si existen (para mayor robustez)
    const btnAddTipo = safeGet("btnAddTipo"); // opcional, si lo agregas en HTML
    if (btnAddTipo) btnAddTipo.addEventListener("click", agregarNuevoTipo);

    const btnAddMovimiento = safeGet("btnAddMovimiento"); // opcional
    if (btnAddMovimiento) btnAddMovimiento.addEventListener("click", agregarMovimiento);

    const btnCalcularKm = safeGet("btnCalcularKm");
    if (btnCalcularKm) btnCalcularKm.addEventListener("click", calcularKm);

    const btnCargarKm = safeGet("btnCargarKm");
    if (btnCargarKm) btnCargarKm.addEventListener("click", cargarKm);

  } catch(e){ console.error("[app.js] Error ligando eventos admin:", e); }
});

// -------------------------
// Exportar algunas funciones al global por compatibilidad con inline onclick
// -------------------------
window.cambiarTipo = cambiarTipo;
window.agregarNuevoTipo = agregarNuevoTipo;
window.agregarMovimiento = agregarMovimiento;
window.calcularKm = calcularKm;
window.cargarKm = cargarKm;
window.borrarTodo = borrarTodo;
window.renderPublic = renderPublic;

console.log("[app.js] Cargado correctamente.");
