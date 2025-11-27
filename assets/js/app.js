/* assets/js/app.js
   Funcional: admin captura, index muestra.
   Gráficas: categorías, ingresos/gastos, deuda/abonos, km vs gasto.
   IDs usados:
   - index: deudaTotalLabel, total-ingresos, total-gastos, balance, km-recorridos, km-gasto, tabla-recientes,
            grafica-categorias, grafica-ingresos-gastos, grafica-deuda-abono, grafica-km-gasto
   - admin: fecha-admin, tipo-admin, categoria-admin, nuevaCategoria-admin, mov-desc-admin, monto-admin,
            deuda-nombre, deuda-monto-inicial, deuda-select-abono, deuda-monto-abono,
            kmInicial, kmFinal, gastoTotal, precioKm, tabla-todos, tabla-deudas, json-area
*/

let movimientos = JSON.parse(localStorage.getItem("movimientos")) || [];
let categorias = JSON.parse(localStorage.getItem("categorias")) || ["Comida","Alquiler","Luz","Agua","Pasajes","Gasolina","Otros"];
let deudas = JSON.parse(localStorage.getItem("deudas")) || [];
let kmConfig = JSON.parse(localStorage.getItem("kmConfig")) || null;

// Chart instances
let chartCategorias = null;
let chartIngresosGastos = null;
let chartDeudaAbono = null;
let chartKmGasto = null;

// ---------- helpers ----------
const $ = id => document.getElementById(id);

// Save
function guardarDatos() {
  localStorage.setItem("movimientos", JSON.stringify(movimientos));
  localStorage.setItem("categorias", JSON.stringify(categorias));
  localStorage.setItem("deudas", JSON.stringify(deudas));
  localStorage.setItem("kmConfig", JSON.stringify(kmConfig));
}

// Reload from storage (useful)
function recargarDatos() {
  movimientos = JSON.parse(localStorage.getItem("movimientos")) || movimientos;
  categorias = JSON.parse(localStorage.getItem("categorias")) || categorias;
  deudas = JSON.parse(localStorage.getItem("deudas")) || deudas;
  kmConfig = JSON.parse(localStorage.getItem("kmConfig")) || kmConfig;
}

// ---------- CATEGORIAS ----------
function cargarCategoriasAdmin() {
  const sel = $("categoria-admin");
  if (!sel) return;
  sel.innerHTML = "";
  categorias.forEach(c => {
    const op = document.createElement("option");
    op.value = c;
    op.textContent = c;
    sel.appendChild(op);
  });
}

function agregarCategoria(contexto) {
  const inputId = contexto === 'admin' ? 'nuevaCategoria-admin' : null;
  const input = inputId ? $(inputId) : null;
  const nueva = input ? input.value.trim() : prompt("Nombre categoría:");
  if (!nueva) { alert("No ingresaste categoría."); return; }
  if (!categorias.includes(nueva)) {
    categorias.push(nueva);
    guardarDatos();
    cargarCategoriasAdmin();
    if (input) input.value = "";
    alert("Categoría agregada.");
  } else alert("La categoría ya existe.");
}

// ---------- MOVIMIENTOS (ADMIN CAPTURA) ----------
function agregarMovimiento(contexto) {
  // contexto 'admin' expected
  const fecha = $('fecha-admin')?.value;
  const tipo = $('tipo-admin')?.value;
  const categoria = $('categoria-admin')?.value;
  const descripcion = $('mov-desc-admin')?.value || "";
  const monto = parseFloat($('monto-admin')?.value);

  if (!fecha || !tipo || !categoria || isNaN(monto)) {
    alert("Completa todos los campos (fecha, tipo, categoría, monto).");
    return;
  }

  movimientos.push({
    id: Date.now(),
    fecha,
    tipo,
    categoria,
    descripcion,
    monto
  });

  guardarDatos();
  actualizarVistas();
  alert(`${tipo} agregado.`);
}

// ---------- TABLAS ----------
function cargarTablaTodosAdmin() {
  const tabla = $('tabla-todos');
  if (!tabla) return;
  tabla.innerHTML = "";
  if (movimientos.length === 0) {
    tabla.innerHTML = "<tr><td colspan='5'>No hay movimientos.</td></tr>";
    return;
  }
  const thead = document.createElement('thead');
  thead.innerHTML = `<tr><th>Fecha</th><th>Tipo</th><th>Categoría</th><th>Descripción</th><th>Monto</th></tr>`;
  tabla.appendChild(thead);
  const tbody = document.createElement('tbody');
  const sorted = [...movimientos].sort((a,b)=> new Date(b.fecha) - new Date(a.fecha));
  sorted.forEach(m => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${m.fecha}</td><td>${m.tipo}</td><td>${m.categoria}</td><td>${m.descripcion || ''}</td><td>$${m.monto.toFixed(2)}</td>`;
    tbody.appendChild(tr);
  });
  tabla.appendChild(tbody);
}

function cargarMovimientosRecientesIndex(limit = 8) {
  const tabla = $('tabla-recientes');
  if (!tabla) return;
  tabla.innerHTML = `<tr><th>Fecha</th><th>Tipo</th><th>Monto</th></tr>`;
  const sorted = [...movimientos].sort((a,b)=> new Date(b.fecha) - new Date(a.fecha)).slice(0,limit);
  sorted.forEach(m => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${m.fecha}</td><td>${m.tipo}</td><td class="${m.tipo==='Ingreso'?'valor-positivo':'valor-negativo'}">$${m.monto.toFixed(2)}</td>`;
    tabla.appendChild(tr);
  });
}

// ---------- DEUDAS ----------
function cargarDeudasAdmin() {
  const tabla = document.querySelector('#tabla-deudas tbody');
  const sel = $('deuda-select-abono');
  if (!tabla || !sel) return;
  tabla.innerHTML = "";
  sel.innerHTML = "<option value=''>-- Selecciona una deuda --</option>";
  deudas.forEach((d, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${d.nombre}</td><td>$${d.montoActual.toFixed(2)}</td><td><button class="button-small secondary" onclick="eliminarDeuda(${i})">Eliminar</button></td>`;
    tabla.appendChild(tr);
    const op = document.createElement('option');
    op.value = i;
    op.textContent = `${d.nombre} ($${d.montoActual.toFixed(2)})`;
    sel.appendChild(op);
  });
  // actualizar label en index
  const lbl = $('deudaTotalLabel');
  if (lbl) lbl.textContent = deudas.reduce((s,d)=>s+d.montoActual,0).toFixed(2);
}

function mostrarFormularioDeuda() {
  const modal = $('deuda-modal');
  if (!modal) return;
  cargarDeudasAdmin();
  modal.style.display = 'flex';
}
function cerrarFormularioDeuda() {
  const modal = $('deuda-modal');
  if (!modal) return;
  modal.style.display = 'none';
}

function registrarNuevaDeuda() {
  const nombre = $('deuda-nombre')?.value?.trim();
  const monto = parseFloat($('deuda-monto-inicial')?.value);
  if (!nombre || isNaN(monto) || monto <= 0) { alert('Nombre o monto inválido'); return; }
  deudas.push({ id: Date.now(), nombre, montoOriginal: monto, montoActual: monto, movimientos: [] });
  guardarDatos();
  cargarDeudasAdmin();
  cerrarFormularioDeuda();
  alert('Deuda registrada');
}

function abonarADeuda() {
  const idx = $('deuda-select-abono')?.value;
  const abono = parseFloat($('deuda-monto-abono')?.value);
  if (idx === "" || isNaN(abono) || abono <= 0) { alert('Selecciona deuda e ingresa monto válido'); return; }
  const d = deudas[idx];
  if (!d) { alert('Deuda no encontrada'); return; }
  if (abono > d.montoActual) { alert('Abono excede monto'); return; }

  // registrar abono como movimiento (Gasto) para tracking
  movimientos.push({
    id: Date.now()+1,
    fecha: new Date().toISOString().substring(0,10),
    tipo: 'Gasto',
    categoria: 'Abono a Deuda',
    descripcion: `Abono a ${d.nombre}`,
    monto: abono
  });

  d.montoActual = Math.max(0, d.montoActual - abono);
  d.movimientos.push({ fecha: new Date().toLocaleDateString(), monto: abono });

  guardarDatos();
  cargarDeudasAdmin();
  cargarMovimientosRecientesIndex();
  cargarTablaTodosAdmin();
  cerrarFormularioDeuda();
  alert('Abono realizado');
}

function eliminarDeuda(i) {
  if (!confirm('Eliminar deuda?')) return;
  deudas.splice(i,1);
  guardarDatos();
  cargarDeudasAdmin();
}

// ---------- KILOMETRAJE ----------
function calcularKm() {
  const ini = parseFloat($('kmInicial')?.value);
  const fin = parseFloat($('kmFinal')?.value);
  const gasto = parseFloat($('gastoTotal')?.value);
  if (isNaN(ini) || isNaN(fin) || isNaN(gasto) || fin <= ini) { alert('Datos km invalidos'); return; }
  const kmRec = fin - ini;
  const precioKm = kmRec > 0 ? gasto / kmRec : 0;
  kmConfig = { kmInicial: ini, kmFinal: fin, gastoTotal: gasto, precioKm };
  guardarDatos();
  // registrar gasto gasolina como movimiento (solo registro)
  movimientos.push({
    id: Date.now() + 999,
    fecha: new Date().toISOString().substring(0,10),
    tipo: 'Gasto',
    categoria: 'Gasolina',
    descripcion: 'Gasto combustible (registro km)',
    monto: gasto
  });
  guardarDatos();
  actualizarVistas();
  alert('Kilometraje guardado y gasto registrado');
}

function cargarConfiguracionKm() {
  recargarDatos();
  if (!kmConfig) return;
  const precioEl = $('precioKm'); if (precioEl) precioEl.textContent = kmConfig.precioKm ? kmConfig.precioKm.toFixed(2) : '0.00';
  const kmRecEl = $('km-recorridos'); if (kmRecEl) kmRecEl.textContent = kmConfig.kmFinal && kmConfig.kmInitial ? (kmConfig.kmFinal - kmConfig.kmInicial) : (kmConfig.kmFinal && kmConfig.kmInicial ? (kmConfig.kmFinal - kmConfig.kmInicial) : (kmConfig.kmFinal ? (kmConfig.kmFinal - (kmConfig.kmInicial||0)) : 0));
  // set inputs if present
  if ($('kmInicial')) $('kmInicial').value = kmConfig.kmInicial || '';
  if ($('kmFinal')) $('kmFinal').value = kmConfig.kmFinal || '';
  if ($('gastoTotal')) $('gastoTotal').value = kmConfig.gastoTotal || '';
}

// ---------- RESUMEN / GRAFICAS ----------
function actualizarResumenIndex() {
  recargarDatos();
  const ingresos = movimientos.filter(m=>m.tipo==='Ingreso').reduce((s,m)=>s+m.monto,0);
  const gastos = movimientos.filter(m=>m.tipo==='Gasto').reduce((s,m)=>s+m.monto,0);
  const deudaTotal = deudas.reduce((s,d)=>s + (d.montoActual||0),0);
  const kmRec = kmConfig ? (kmConfig.kmFinal - kmConfig.kmInicial) || 0 : 0;
  const gastoComb = kmConfig ? (kmConfig.gastoTotal || 0) : 0;

  if ($('total-ingresos')) $('total-ingresos').textContent = ingresos.toFixed(2);
  if ($('total-gastos')) $('total-gastos').textContent = gastos.toFixed(2);
  if ($('balance')) $('balance').textContent = (ingresos - gastos).toFixed(2);
  if ($('deudaTotalLabel')) $('deudaTotalLabel').textContent = deudaTotal.toFixed(2);
  if ($('km-recorridos')) $('km-recorridos').textContent = kmRec.toFixed(2);
  if ($('km-gasto')) $('km-gasto').textContent = gastoComb.toFixed(2);

  // graficas
  renderGraficasIndex();
}

function renderGraficasIndex() {
  // CATEGORIAS (pie)
  const canvasCat = $('grafica-categorias');
  if (canvasCat) {
    const map = {};
    categorias.forEach(c=>map[c]=0);
    movimientos.filter(m=>m.tipo==='Gasto').forEach(m=> map[m.categoria] = (map[m.categoria]||0)+m.monto);
    const labels = Object.keys(map);
    const data = Object.values(map);
    if (chartCategorias) chartCategorias.destroy();
    chartCategorias = new Chart(canvasCat.getContext('2d'), { type:'pie', data:{ labels, datasets:[{ data, backgroundColor: labels.map((_,i)=>`hsl(${i*60 % 360} 70% 60%)`) }] } });
  }

  // INGRESOS vs GASTOS (bar)
  const canvasIG = $('grafica-ingresos-gastos');
  if (canvasIG) {
    const meses = {};
    movimientos.forEach(m=>{
      const d = new Date(m.fecha); if (isNaN(d)) return;
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      if (!meses[key]) meses[key]={Ingreso:0,Gasto:0};
      meses[key][m.tipo] = (meses[key][m.tipo]||0) + m.monto;
    });
    const labels = Object.keys(meses).sort();
    const ingresos = labels.map(l => meses[l].Ingreso || 0);
    const gastos = labels.map(l => meses[l].Gasto || 0);
    if (chartIngresosGastos) chartIngresosGastos.destroy();
    chartIngresosGastos = new Chart(canvasIG.getContext('2d'), {
      type:'bar',
      data:{ labels, datasets:[{ label:'Ingresos', data:ingresos, backgroundColor:'green' }, { label:'Gastos', data:gastos, backgroundColor:'red' }] },
      options:{ responsive:true, scales:{ y:{ beginAtZero:true } } }
    });
  }

  // DEUDA vs ABONOS (simple totals)
  const canvasDA = $('grafica-deuda-abono');
  if (canvasDA) {
    const totalDeuda = deudas.reduce((s,d)=>s + (d.montoActual||0),0);
    const totalAbonos = movimientos.filter(m=>m.categoria==='Abono a Deuda').reduce((s,m)=>s + m.monto,0);
    if (chartDeudaAbono) chartDeudaAbono.destroy();
    chartDeudaAbono = new Chart(canvasDA.getContext('2d'), {
      type:'bar',
      data:{ labels:['Deuda pendiente','Total abonos registrados'], datasets:[{ label:'$', data:[totalDeuda, totalAbonos], backgroundColor:['#ff9f43','#00d2d3'] }] },
      options:{ responsive:true, scales:{ y:{ beginAtZero:true } } }
    });
  }

  // KM vs Gasto
  const canvasKM = $('grafica-km-gasto');
  if (canvasKM) {
    const km = kmConfig ? ((kmConfig.kmFinal - kmConfig.kmInicial) || 0) : 0;
    const gasto = kmConfig ? (kmConfig.gastoTotal || 0) : 0;
    if (chartKmGasto) chartKmGasto.destroy();
    chartKmGasto = new Chart(canvasKM.getContext('2d'), {
      type:'bar',
      data:{ labels:['Km recorridos','Gasto combustible'], datasets:[{ label:'Valor', data:[km, gasto], backgroundColor:['#6a89cc','#60a3bc'] }] },
      options:{ responsive:true, scales:{ y:{ beginAtZero:true } } }
    });
  }
}

// ---------- EXPORT / IMPORT ----------
function exportarJSON() {
  const data = { movimientos, categorias, deudas, kmConfig };
  const blob = new Blob([JSON.stringify(data, null,2)], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `backup_presupuesto_${Date.now()}.json`; a.click();
  URL.revokeObjectURL(url);
}

function importarJSON() {
  const area = $('json-area');
  if (!area) return alert('Textarea no encontrada');
  try {
    const parsed = JSON.parse(area.value);
    movimientos = parsed.movimientos || [];
    categorias = parsed.categorias || categorias;
    deudas = parsed.deudas || [];
    kmConfig = parsed.kmConfig || kmConfig;
    guardarDatos();
    actualizarVistas();
    alert('Importación completada');
  } catch (e) { alert('JSON inválido: '+e.message); }
}

// ---------- UTIL / ACTUALIZAR VISTAS ----------
function actualizarVistas() {
  recargarDatos();
  cargarCategoriasAdmin();
  cargarDeudasAdmin();
  cargarTablaTodosAdmin();
  cargarMovimientosRecientesIndex();
  actualizarResumenIndex();
  renderGraficasIndex();
}

// helper wrapper to call the correct update functions for index/admin
function onloadApp(contexto) {
  recargarDatos();
  if (contexto === 'admin') {
    cargarCategoriasAdmin();
    cargarDeudasAdmin();
    cargarTablaTodosAdmin();
    cargarConfiguracionKm();
  } else {
    // index
    cargarMovimientosRecientesIndex();
    actualizarResumenIndex();
    renderGraficasIndex();
  }
}

// expose functions globally used in HTML
window.onloadApp = onloadApp;
window.agregarCategoria = agregarCategoria;
window.agregarMovimiento = agregarMovimiento;
window.mostrarFormularioDeuda = mostrarFormularioDeuda;
window.cerrarFormularioDeuda = cerrarFormularioDeuda;
window.registrarNuevaDeuda = registrarNuevaDeuda;
window.abonarADeuda = abonarADeuda;
window.eliminarDeuda = eliminarDeuda;
window.calcularKm = calcularKm;
window.cargarConfiguracionKm = cargarConfiguracionKm;
window.exportarJSON = exportarJSON;
window.importarJSON = importarJSON;
window.cargarTablaTodosAdmin = cargarTablaTodosAdmin;
window.cargarMovimientosRecientesIndex = cargarMovimientosRecientesIndex;
window.actualizarVistas = actualizarVistas;
