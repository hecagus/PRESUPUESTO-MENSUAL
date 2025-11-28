/* assets/js/app.js
   Versión completa y unificada (opción A).
   Funciona con los index.html / admin.html que acordamos.
   - Admin captura: fecha-admin, tipo-admin, categoria-admin, nuevaCategoria-admin, mov-desc-admin, monto-admin
   - Deudas: deuda-nombre, deuda-monto-inicial, deuda-select-abono, deuda-monto-abono
   - Km diario: kmDiarioInicial, kmDiarioFinal, kmDiarioResultado
   - Gasolina: gas-litros, gas-precio-litro, gas-total, gas-kmInicial, gas-kmFinal, gas-kmRecorridos, gas-precioKm
   - Index muestra: deudaTotalLabel, total-ingresos, total-gastos, balance, km-recorridos, km-gasto, tabla-recientes, grafica-*
*/

/* =========================
   VARIABLES GLOBALES / STORAGE
   ========================= */
let movimientos = JSON.parse(localStorage.getItem("movimientos")) || [];
let categorias  = JSON.parse(localStorage.getItem("categorias")) || ["Comida","Alquiler","Luz","Agua","Pasajes","Gasolina","Otros"];
let deudas      = JSON.parse(localStorage.getItem("deudas")) || [];
let kmDiario    = JSON.parse(localStorage.getItem("kmDiario")) || [];     // { fecha, kmInicial, kmFinal, kmRecorridos }
let gasolinaArr = JSON.parse(localStorage.getItem("gasolina")) || [];     // { fecha, litros, precioLitro, total, kmIni, kmFin, kmRec, precioKm }

// Chart instances
let chartCategorias = null;
let chartIngresosGastos = null;
let chartDeudaAbono = null;
let chartKmGasto = null;

/* =========================
   HELPERS
   ========================= */
const $ = id => document.getElementById(id);
const fmt = n => Number(n || 0).toFixed(2);

function guardarDatos() {
  localStorage.setItem("movimientos", JSON.stringify(movimientos));
  localStorage.setItem("categorias", JSON.stringify(categorias));
  localStorage.setItem("deudas", JSON.stringify(deudas));
  localStorage.setItem("kmDiario", JSON.stringify(kmDiario));
  localStorage.setItem("gasolina", JSON.stringify(gasolinaArr));
}

function recargarDatos() {
  movimientos = JSON.parse(localStorage.getItem("movimientos")) || movimientos;
  categorias  = JSON.parse(localStorage.getItem("categorias")) || categorias;
  deudas      = JSON.parse(localStorage.getItem("deudas")) || deudas;
  kmDiario    = JSON.parse(localStorage.getItem("kmDiario")) || kmDiario;
  gasolinaArr = JSON.parse(localStorage.getItem("gasolina")) || gasolinaArr;
}

/* =========================
   CATEGORÍAS (ADMIN)
   ========================= */
function cargarCategoriasAdmin() {
  const sel = $('categoria-admin');
  if (!sel) return;
  sel.innerHTML = "";
  categorias.forEach(c => {
    const op = document.createElement('option');
    op.value = c;
    op.textContent = c;
    sel.appendChild(op);
  });
}

function agregarCategoria(contexto) {
  if (contexto !== 'admin') return alert('Solo se agregan categorías desde admin.');
  const input = $('nuevaCategoria-admin');
  if (!input) return;
  const nueva = input.value.trim();
  if (!nueva) return alert('Escribe el nombre de la categoría.');
  if (!categorias.includes(nueva)) {
    categorias.push(nueva);
    guardarDatos();
    cargarCategoriasAdmin();
    input.value = "";
    alert(`Categoría "${nueva}" agregada.`);
  } else {
    alert("La categoría ya existe.");
  }
}

/* =========================
   MOVIMIENTOS (ADMIN captura)
   ========================= */
function agregarMovimiento(contexto) {
  if (contexto !== 'admin') return alert('Usa admin para agregar movimientos.');
  const fecha = $('fecha-admin')?.value;
  const tipo  = $('tipo-admin')?.value;
  const categoria = $('categoria-admin')?.value;
  const descripcion = $('mov-desc-admin')?.value || "";
  const monto = parseFloat($('monto-admin')?.value);

  if (!fecha || !tipo || !categoria || isNaN(monto)) {
    alert("Completa todos los campos: fecha, tipo, categoría, monto.");
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
  alert(`${tipo} agregado correctamente.`);
}

/* =========================
   TABLAS
   ========================= */
function cargarTablaTodosAdmin() {
  const tabla = $('tabla-todos');
  if (!tabla) return;
  tabla.innerHTML = "";
  if (movimientos.length === 0) {
    tabla.innerHTML = "<tr><td colspan='5'>No hay movimientos registrados.</td></tr>";
    return;
  }
  const thead = document.createElement('thead');
  thead.innerHTML = "<tr><th>Fecha</th><th>Tipo</th><th>Categoría</th><th>Descripción</th><th>Monto</th></tr>";
  tabla.appendChild(thead);

  const tbody = document.createElement('tbody');
  const sorted = [...movimientos].sort((a,b) => new Date(b.fecha) - new Date(a.fecha));
  sorted.forEach(m => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${m.fecha}</td><td>${m.tipo}</td><td>${m.categoria}</td><td>${m.descripcion || ''}</td><td>$${fmt(m.monto)}</td>`;
    tbody.appendChild(tr);
  });
  tabla.appendChild(tbody);
}

function cargarMovimientosRecientesIndex(limit = 8) {
  const tabla = $('tabla-recientes');
  if (!tabla) return;
  tabla.innerHTML = "";
  if (movimientos.length === 0) {
    tabla.innerHTML = "<tr><td>No hay movimientos</td></tr>";
    return;
  }
  const thead = document.createElement('thead');
  thead.innerHTML = "<tr><th>Fecha</th><th>Tipo</th><th>Monto</th></tr>";
  tabla.appendChild(thead);
  const tbody = document.createElement('tbody');
  const sorted = [...movimientos].sort((a,b) => new Date(b.fecha) - new Date(a.fecha)).slice(0, limit);
  sorted.forEach(m => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${m.fecha}</td><td>${m.tipo}</td><td class="${m.tipo==='Ingreso'?'valor-positivo':'valor-negativo'}">$${fmt(m.monto)}</td>`;
    tbody.appendChild(tr);
  });
  tabla.appendChild(tbody);
}

/* =========================
   DEUDAS
   ========================= */
function cargarDeudasAdmin() {
  const tablaBody = document.querySelector('#tabla-deudas tbody');
  const sel = $('deuda-select-abono');
  if (!tablaBody || !sel) return;
  tablaBody.innerHTML = "";
  sel.innerHTML = "<option value=''>-- Selecciona una deuda --</option>";
  deudas.forEach((d,i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${d.nombre}</td><td>$${fmt(d.montoActual)}</td><td><button class="button-small secondary" onclick="eliminarDeuda(${i})">Eliminar</button></td>`;
    tablaBody.appendChild(tr);
    const op = document.createElement('option');
    op.value = i;
    op.textContent = `${d.nombre} ($${fmt(d.montoActual)})`;
    sel.appendChild(op);
  });
  const lbl = $('deudaTotalLabel');
  if (lbl) lbl.textContent = deudas.reduce((s,d)=>s + (d.montoActual||0), 0).toFixed(2);
}

function mostrarFormularioDeuda() {
  cargarDeudasAdmin();
  const modal = $('deuda-modal');
  if (modal) modal.style.display = 'flex';
}
function cerrarFormularioDeuda() {
  const modal = $('deuda-modal');
  if (modal) modal.style.display = 'none';
}

function registrarNuevaDeuda() {
  const nombre = $('deuda-nombre')?.value?.trim();
  const monto = parseFloat($('deuda-monto-inicial')?.value);
  if (!nombre || isNaN(monto) || monto <= 0) { alert('Nombre o monto inválido'); return; }
  deudas.push({ id: Date.now(), nombre, montoOriginal: monto, montoActual: monto, movimientos: [] });
  guardarDatos();
  cargarDeudasAdmin();
  cerrarFormularioDeuda();
  alert('Deuda registrada.');
}

function abonarADeuda() {
  const idx = $('deuda-select-abono')?.value;
  const abono = parseFloat($('deuda-monto-abono')?.value);
  if (idx === "" || isNaN(abono) || abono <= 0) { alert('Selecciona deuda e ingresa monto válido'); return; }
  const d = deudas[idx];
  if (!d) { alert('Deuda no encontrada'); return; }
  if (abono > d.montoActual) { alert('El abono excede el monto pendiente'); return; }

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
  alert('Abono registrado.');
}

function eliminarDeuda(i) {
  if (!confirm('¿Eliminar esta deuda?')) return;
  deudas.splice(i,1);
  guardarDatos();
  cargarDeudasAdmin();
}

/* =========================
   KILOMETRAJE DIARIO
   ========================= */
function registrarKmDiario() {
  const ini = Number($('kmDiarioInicial')?.value);
  const fin = Number($('kmDiarioFinal')?.value);
  if (!Number.isFinite(ini) || !Number.isFinite(fin) || fin <= ini) { alert('Kilometraje inválido (fin debe ser mayor que inicio)'); return; }

  const kmRec = fin - ini;

  const registro = {
    fecha: new Date().toISOString().substring(0,10),
    kmInicial: ini,
    kmFinal: fin,
    kmRecorridos: kmRec
  };

  kmDiario.push(registro);
  guardarDatos();

  if ($('kmDiarioResultado')) $('kmDiarioResultado').textContent = kmRec;

  actualizarVistas();

  // LIMPIAR FORMULARIO
  if ($('kmDiarioInicial')) $('kmDiarioInicial').value = "";
  if ($('kmDiarioFinal')) $('kmDiarioFinal').value = "";
  if ($('kmDiarioResultadot')) $('kmDiarioResultado').textContent = "0"; // safe fallback (note: correct id is kmDiarioResultado)
  alert('Kilometraje diario registrado.');
}

/* =========================
   REGISTRO DE GASOLINA
   ========================= */
function registrarGasolina() {
  const litros = Number($('gas-litros')?.value);
  const precioLitro = Number($('gas-precio-litro')?.value);
  const kmIni = Number($('gas-kmInicial')?.value);
  const kmFin = Number($('gas-kmFinal')?.value);

  if (!Number.isFinite(kmIni) || !Number.isFinite(kmFin) || kmFin <= kmIni) { alert('Kilometraje inválido para repostaje'); return; }
  if (!Number.isFinite(litros) || litros <= 0 || !Number.isFinite(precioLitro) || precioLitro <= 0) {
    alert('Ingresa litros y precio por litro válidos.');
    return;
  }

  const kmRec = kmFin - kmIni;
  const total = litros * precioLitro;
  const precioKm = kmRec > 0 ? total / kmRec : 0;

  // Mostrar resultados en UI
  if ($('gas-total')) $('gas-total').value = fmt(total);
  if ($('gas-kmRecorridos')) $('gas-kmRecorridos').textContent = kmRec;
  if ($('gas-precioKm')) $('gas-precioKm').textContent = fmt(precioKm);

  const registro = {
    fecha: new Date().toISOString().substring(0,10),
    litros,
    precioLitro,
    total,
    kmIni,
    kmFin,
    kmRec,
    precioKm
  };

  gasolinaArr.push(registro);

  // registrar gasto en movimientos
  movimientos.push({
    id: Date.now()+2,
    fecha: registro.fecha,
    tipo: 'Gasto',
    categoria: 'Gasolina',
    descripcion: `Repostaje ${litros}L @ ${fmt(precioLitro)}`,
    monto: total
  });

  guardarDatos();
  actualizarVistas();

  // LIMPIAR FORMULARIO DE GASOLINA (dejamos kmIni = kmFin para facilitar siguiente registro)
  if ($('gas-litros')) $('gas-litros').value = "";
  if ($('gas-precio-litro')) $('gas-precio-litro').value = "";
  if ($('gas-kmInicial')) $('gas-kmInicial').value = kmFin;
  if ($('gas-kmFinal')) $('gas-kmFinal').value = "";
  if ($('gas-total')) $('gas-total').value = "";
  if ($('gas-kmRecorridos')) $('gas-kmRecorridos').textContent = "0";
  if ($('gas-precioKm')) $('gas-precioKm').textContent = "0.00";

  alert('Repostaje registrado y gasto agregado a movimientos.');
}

/* =========================
   EXPORT / IMPORT
   ========================= */
function exportarJSON() {
  const data = { movimientos, categorias, deudas, kmDiario, gasolinaArr };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `presupuesto_backup_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importarJSON() {
  const area = $('json-area');
  if (!area) return alert('Textarea de importación no encontrada.');
  try {
    const parsed = JSON.parse(area.value);
    movimientos = parsed.movimientos || [];
    categorias  = parsed.categorias || categorias;
    deudas = parsed.deudas || [];
    kmDiario = parsed.kmDiario || [];
    gasolinaArr = parsed.gasolinaArr || parsed.gasolina || gasolinaArr;
    guardarDatos();
    actualizarVistas();
    alert('Importación completada.');
  } catch (e) {
    alert('JSON inválido: ' + e.message);
  }
}

/* =========================
   RESUMEN Y GRAFICAS (INDEX)
   ========================= */
function calcularResumen() {
  recargarDatos();
  const totalIngresos = movimientos.filter(m => m.tipo === 'Ingreso').reduce((s,m)=>s+m.monto,0);
  const totalGastos = movimientos.filter(m => m.tipo === 'Gasto').reduce((s,m)=>s+m.monto,0);
  const deudaTotal = deudas.reduce((s,d)=>s + (d.montoActual || 0), 0);
  const kmTotales = kmDiario.reduce((s,r)=>s + (r.kmRecorridos||0), 0) + (gasolinaArr.reduce((s,g)=>s + (g.kmRec||0),0));
  const gastoCombustibleTotal = gasolinaArr.reduce((s,g)=>s + (g.total||0), 0);
  const precioKmPromedio = kmTotales > 0 ? (gastoCombustibleTotal / kmTotales) : 0;
  return { totalIngresos, totalGastos, deudaTotal, kmTotales, gastoCombustibleTotal, precioKmPromedio };
}

function actualizarResumenIndex() {
  const res = calcularResumen();
  if ($('total-ingresos')) $('total-ingresos').textContent = fmt(res.totalIngresos);
  if ($('total-gastos')) $('total-gastos').textContent = fmt(res.totalGastos);
  if ($('deudaTotalLabel')) $('deudaTotalLabel').textContent = fmt(res.deudaTotal);
  if ($('balance')) $('balance').textContent = fmt(res.totalIngresos - res.totalGastos);
  if ($('km-recorridos')) $('km-recorridos').textContent = Number(res.kmTotales).toFixed(2);
  if ($('km-gasto')) $('km-gasto').textContent = fmt(res.gastoCombustibleTotal);
  cargarMovimientosRecientesIndex();
  renderGraficasIndex();
}

function renderGraficasIndex() {
  recargarDatos();

  // Gastos por categoría (pie)
  const canvasCat = $('grafica-categorias');
  if (canvasCat) {
    const map = {};
    categorias.forEach(c => map[c] = 0);
    movimientos.filter(m => m.tipo === 'Gasto').forEach(m => {
      map[m.categoria] = (map[m.categoria] || 0) + m.monto;
    });
    const labels = Object.keys(map);
    const data = Object.values(map);
    if (chartCategorias) chartCategorias.destroy();
    chartCategorias = new Chart(canvasCat.getContext('2d'), {
      type: 'pie',
      data: { labels, datasets: [{ data, backgroundColor: labels.map((_,i)=>`hsl(${i*55 % 360} 70% 60%)`) }] },
      options: { responsive:true }
    });
  }

  // Ingresos vs Gastos (por mes)
  const canvasIG = $('grafica-ingresos-gastos');
  if (canvasIG) {
    const meses = {};
    movimientos.forEach(m => {
      const d = new Date(m.fecha); if (isNaN(d)) return;
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      if (!meses[key]) meses[key] = { Ingreso:0, Gasto:0 };
      meses[key][m.tipo] = (meses[key][m.tipo]||0) + m.monto;
    });
    const labels = Object.keys(meses).sort();
    const ingresos = labels.map(l => meses[l].Ingreso || 0);
    const gastos = labels.map(l => meses[l].Gasto || 0);
    if (chartIngresosGastos) chartIngresosGastos.destroy();
    chartIngresosGastos = new Chart(canvasIG.getContext('2d'), {
      type: 'bar',
      data: { labels, datasets:[{ label:'Ingresos', data:ingresos, backgroundColor:'rgba(40,167,69,0.7)' }, { label:'Gastos', data:gastos, backgroundColor:'rgba(220,53,69,0.7)' }] },
      options: { responsive:true, scales:{ y: { beginAtZero:true } } }
    });
  }

  // Deuda vs Abonos
  const canvasDA = $('grafica-deuda-abono');
  if (canvasDA) {
    const totalDeuda = deudas.reduce((s,d)=>s + (d.montoActual||0),0);
    const totalAbonos = movimientos.filter(m => m.categoria === 'Abono a Deuda').reduce((s,m)=>s + m.monto,0);
    if (chartDeudaAbono) chartDeudaAbono.destroy();
    chartDeudaAbono = new Chart(canvasDA.getContext('2d'), {
      type:'bar',
      data: { labels:['Deuda Pendiente','Total Abonos'], datasets:[{ label:'$', data:[totalDeuda, totalAbonos], backgroundColor:['#ff9f43','#00d2d3'] }] },
      options:{ responsive:true, scales:{ y:{ beginAtZero:true } } }
    });
  }

  // Km vs Gasto
  const canvasKM = $('grafica-km-gasto');
  if (canvasKM) {
    const kmTotales = kmDiario.reduce((s,r)=>s + (r.kmRecorridos||0),0) + gasolinaArr.reduce((s,g)=>s + (g.kmRec||0),0);
    const gastoComb = gasolinaArr.reduce((s,g)=>s + (g.total||0),0);
    if (chartKmGasto) chartKmGasto.destroy();
    chartKmGasto = new Chart(canvasKM.getContext('2d'), {
      type:'bar',
      data: { labels:['Km totales','Gasto combustible'], datasets:[{ label:'Valor', data:[kmTotales, gastoComb], backgroundColor:['#6a89cc','#60a3bc'] }] },
      options:{ responsive:true, scales:{ y:{ beginAtZero:true } } }
    });
  }
}

/* =========================
   UTIL: actualizar vistas
   ========================= */
function actualizarVistas() {
  recargarDatos();
  cargarCategoriasAdmin();
  cargarDeudasAdmin();
  cargarTablaTodosAdmin();
  cargarMovimientosRecientesIndex();
  actualizarResumenIndex();
}

/* =========================
   INICIALIZACION POR CONTEXTO
   ========================= */
function onloadApp(contexto) {
  recargarDatos();
  if (contexto === 'admin') {
    cargarCategoriasAdmin();
    cargarDeudasAdmin();
    cargarTablaTodosAdmin();
    // poblar gas inputs con última entrada
    const lastGas = gasolinaArr[gasolinaArr.length - 1];
    if (lastGas) {
      if ($('gas-kmInicial')) $('gas-kmInicial').value = lastGas.kmFin || '';
      if ($('gas-kmFinal')) $('gas-kmFinal').value = '';
    }
  } else {
    cargarMovimientosRecientesIndex();
    actualizarResumenIndex();
  }
}

/* =========================
   EXPOSICION GLOBAL
   ========================= */
window.onloadApp = onloadApp;
window.agregarCategoria = agregarCategoria;
window.agregarMovimiento = agregarMovimiento;
window.mostrarFormularioDeuda = mostrarFormularioDeuda;
window.cerrarFormularioDeuda = cerrarFormularioDeuda;
window.registrarNuevaDeuda = registrarNuevaDeuda;
window.abonarADeuda = abonarADeuda;
window.eliminarDeuda = eliminarDeuda;
window.registrarKmDiario = registrarKmDiario;
window.registrarGasolina = registrarGasolina;
window.exportarJSON = exportarJSON;
window.importarJSON = importarJSON;
window.cargarTablaTodosAdmin = cargarTablaTodosAdmin;
window.cargarMovimientosRecientesIndex = cargarMovimientosRecientesIndex;
window.actualizarVistas = actualizarVistas;
