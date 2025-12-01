// ======================
// app.js — PARTE 1/4: SETUP Y UTILIDADES
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
    gastoFijo: 0,
    ultimoKMfinal: null
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

    // Asegurar que las propiedades existan, incluso si el localStorage está vacío o es viejo
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

// Cargar al inicio (antes de DOMContentLoaded)
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
// FUNCIONES AUTOMÁTICAS
// -----------------------------

// A) calcularDeudaTotalAuto: suma de (monto - abonado)
function calcularDeudaTotalAuto() {
  const deudas = panelData.deudas || [];

  const total = deudas.reduce((s, d) => {
    return s + ((Number(d.monto) || 0) - (Number(d.abonado) || 0));
  }, 0);

  panelData.parametros = panelData.parametros || {};
  panelData.parametros.deudaTotal = total;
  guardarPanelData();

  const inp = $("proyDeudaTotal");
  if (inp) {
    inp.value = total.toFixed(2);
  }
}

// B) calcularGastoFijoAuto: calcula promedio basado en abonos y KM
function calcularGastoFijoAuto() {
  panelData.parametros = panelData.parametros || {};
  const comidaDiaria = 200; // Gasto fijo asumido de comida

  const kmArr = panelData.kmDiarios || [];
  const kmProm = kmArr.length
    ? kmArr.reduce((s, k) => s + (Number(k.recorrido) || 0), 0) / kmArr.length
    : 0;

  let ultimoAbono = 0;
  let ultimaFecha = 0;

  // Busca el abono más reciente
  (panelData.gastos || []).forEach(g => {
    if ((g.categoria || "") === "Abono a Deuda") {
      const t = new Date(g.fechaISO || g.fechaLocal).getTime();
      if (!ultimaFecha || t > ultimaFecha) {
        ultimaFecha = t;
        ultimoAbono = Number(g.cantidad) || 0;
      }
    }
  });

  // Fórmula de Gasto Fijo: (Abono mensual / 30 días) + Gasto de comida + (KM promedio * costo por KM)
  // Usaremos un divisor simple para el abono (6 días laborables por semana)
  // Usaremos un costo de combustible/mantenimiento de 0.6 MXN/KM asumido
  const gastoFijo = (ultimoAbono / 6) + comidaDiaria + (kmProm * 0.6);

  panelData.parametros.gastoFijo = gastoFijo;
  guardarPanelData();

  const inp = $("proyGastoFijo");
  if (inp) {
    inp.value = gastoFijo.toFixed(2);
  }
}

// ======================
// Movimientos (Historial)
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
  // No llamamos a renderMovimientos aquí, se hace en DOMContentLoaded para evitar re-renderizados constantes
}

function renderMovimientos() {
  const tbody = $("tablaMovimientos");
  if (!tbody) return;

  tbody.innerHTML = "";
  const rows = panelData.movimientos.slice(0, 25);

  if (rows.length === 0) {
    // Esta tabla no existe en Admin.html ni index.html, pero se deja el código por si se agrega
    // tbody.innerHTML = `<tr><td colspan="4" style="text-align:center">No hay movimientos</td></tr>`;
    return;
  }
}

// Nota: renderMovimientos se llama en DOMContentLoaded, no aquí.
// ======================
// app.js — PARTE 2/4: REGISTROS DE MOVIMIENTOS Y DEUDAS
// ======================

// ======================
// Registrar ingreso
// ======================
function setupIngresoListeners() {
  const btn = $("btnGuardarIngreso");
  if (!btn) return;

  btn.addEventListener("click", () => {
    const desc = ($("ingresoDescripcion")?.value || "").trim();
    const qty = Number($("ingresoCantidad")?.value || 0);

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

// ======================
// Registrar gasto
// ======================
function setupGastoListeners() {
  const btn = $("btnGuardarGasto");
  if (!btn) return;

  btn.addEventListener("click", () => {
    const desc = ($("gastoDescripcion")?.value || "").trim();
    const qty = Number($("gastoCantidad")?.value || 0);
    const cat = $("gastoCategoria")?.value || "Otros";

    if (!desc || !qty || qty <= 0) return alert("Datos de gasto inválidos.");

    panelData.gastos.push({
      descripcion: desc,
      cantidad: qty,
      categoria: cat,
      fechaISO: nowISO(),
      fechaLocal: nowLocal()
    });

    // Si es gasto que afecta el cálculo automático, recalcular
    if (cat === "Comida" || cat === "Transporte") calcularGastoFijoAuto();

    pushMovimiento("Gasto", `${desc} (${cat})`, qty);
    guardarPanelData();

    $("gastoDescripcion").value = "";
    $("gastoCantidad").value = "";

    alert("Gasto registrado.");
    renderResumenIndex();
  });
}

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
    const pendiente = (Number(d.monto) || 0) - (Number(d.abonado) || 0);

    list.innerHTML += `
      <li>
        <strong>${d.nombre}</strong><br>
        Total: $${fmtMoney(d.monto)}<br>
        Pagado: $${fmtMoney(d.abonado || 0)}<br>
        Pendiente: <strong>$${fmtMoney(pendiente)}</strong>
      </li>
    `;

    // Solo agregar deudas con saldo pendiente al selector de abonos
    if (pendiente > 0) {
        const opt = document.createElement("option");
        opt.value = idx;
        opt.textContent = `${d.nombre} — $${fmtMoney(pendiente)} pendiente`;
        select.appendChild(opt);
    }
  });

  if (panelData.deudas.length === 0) {
    list.innerHTML = "<li>No hay deudas registradas.</li>";
  }
  
  if (select.children.length === 0) {
    select.innerHTML = `<option value="">-- No hay deudas pendientes --</option>`;
  }
}

// Event Listeners para Deudas (Se llaman en DOMContentLoaded)
function setupDeudaListeners() {
    $("btnRegistrarDeuda")?.addEventListener("click", () => {
      const nombre = ($("deudaNombre")?.value || "").trim();
      const monto = Number($("deudaMonto")?.value || 0);

      if (!nombre || !monto || monto <= 0) return alert("Datos inválidos.");

      panelData.deudas.push({ nombre, monto, abonado: 0 });

      guardarPanelData();
      renderDeudas();

      calcularDeudaTotalAuto();
      calcularGastoFijoAuto();

      $("deudaNombre").value = "";
      $("deudaMonto").value = "";

      alert("Deuda registrada.");
    });

    $("btnRegistrarAbono")?.addEventListener("click", () => {
      const idx = $("abonoSeleccionar")?.value;
      const monto = Number($("abonoMonto")?.value || 0);

      if (idx === "" || !idx || monto <= 0) return alert("Datos inválidos.");

      // Verificar que el índice exista y el monto no exceda el saldo
      const deuda = panelData.deudas[idx];
      const pendiente = (Number(deuda.monto) || 0) - (Number(deuda.abonado) || 0);

      if(monto > pendiente) return alert(`El abono excede el saldo pendiente de $${fmtMoney(pendiente)}.`);
      
      deuda.abonado = (Number(deuda.abonado) || 0) + monto;

      // registrar gasto tipo abono
      panelData.gastos.push({
        descripcion: `Abono a ${deuda.nombre}`,
        cantidad: monto,
        categoria: "Abono a Deuda",
        fechaISO: nowISO(),
        fechaLocal: nowLocal()
      });

      pushMovimiento("Gasto", `Abono a ${deuda.nombre}`, monto);

      guardarPanelData();
      renderDeudas();

      calcularDeudaTotalAuto();
      calcularGastoFijoAuto();

      $("abonoMonto").value = "";
      alert("Abono guardado.");

      renderResumenIndex();
    });
}
// ======================
// app.js — PARTE 3/4: KM, GASOLINA, IO Y TURNOS
// ======================

// ======================
// KM y Gasolina
// ======================
function setupKmAndGasListeners() {
  $("kmFinal")?.addEventListener("input", () => {
    const ini = Number($("kmInicial")?.value || 0);
    const fin = Number($("kmFinal")?.value || 0);
    const rec = fin > ini ? fin - ini : 0;
    if ($("kmRecorridos")) $("kmRecorridos").textContent = rec;
  });

  $("btnGuardarKm")?.addEventListener("click", () => {
    const ini = Number($("kmInicial")?.value || 0);
    const fin = Number($("kmFinal")?.value || 0);
    if (isNaN(ini) || isNaN(fin) || fin <= ini) return alert("KM inicial/final inválidos o Final es menor/igual a Inicial.");

    panelData.kmDiarios.push({
      fechaISO: nowISO(),
      fechaLocal: nowLocal(),
      kmInicial: ini,
      kmFinal: fin,
      recorrido: fin - ini
    });

    panelData.parametros = panelData.parametros || {};
    panelData.parametros.ultimoKMfinal = fin;
    guardarPanelData();

    calcularGastoFijoAuto();

    $("kmInicial").value = "";
    $("kmFinal").value = "";
    $("kmRecorridos").textContent = "0";

    alert("Kilometraje guardado.");
    renderResumenIndex();
    
    // Asignar el último KM final para el siguiente registro
    if ($("kmInicial")) $("kmInicial").value = fin;
  });

  $("btnGuardarGas")?.addEventListener("click", () => {
    const litros = Number($("litrosGas")?.value || 0);
    const costo = Number($("costoGas")?.value || 0);

    if (!litros || !costo) return alert("Datos inválidos.");

    panelData.gasolina.push({
      fechaISO: nowISO(),
      fechaLocal: nowLocal(),
      litros,
      costo
    });

    // registrar gasto de gasolina
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


// ======================
// // ======================
// Importar / Exportar JSON
// ======================
function setupIoListeners() {
    // CORRECCIÓN: Usar los IDs del admin.html que coinciden con los botones
    const btnExportar = $("btnExportar"); // El ID es 'btnExportar'
    const btnImportar = $("btnImportar"); // El ID es 'btnImportar'
    const textarea = $("importJson"); // El ID del textarea

    if (btnExportar) {
        btnExportar.addEventListener("click", () => {
          const json = JSON.stringify(panelData, null, 2);
    
          navigator.clipboard.writeText(json)
            .then(() => alert("Datos copiados al portapapeles."))
            .catch(() => {
              const blob = new Blob([json], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
    
              a.href = url;
              a.download = `backup_ubereats_tracker_${Date.now()}.json`;
              a.click();
    
              URL.revokeObjectURL(url);
              alert("Backup descargado.");
            });
        });
    }

    if (btnImportar) {
        btnImportar.addEventListener("click", () => {
          const raw = (textarea?.value || "").trim();
    
          if (!raw) return alert("Pega tu JSON primero.");
    
          try {
            const parsed = JSON.parse(raw);
    
            // Combinar datos existentes con los importados
            panelData = Object.assign({}, panelData, parsed);
            panelData.parametros = Object.assign({}, panelData.parametros, (parsed.parametros || {}));
    
            guardarPanelData();
            textarea.value = "";
            
            // Refrescar UI completamente
            location.reload(); 
    
            alert("Importación correcta ✔. Recarga de página automática.");
    
          } catch (e) {
            console.error(e);
            alert("JSON inválido.");
          }
        });
    }

    // El botón Exportar Excel (btnExportarExcel) no tiene funcionalidad implementada, es correcto que no haga nada.
}


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
    txt.textContent = `Turno en curso iniciado el ${new Date(turnoInicio).toLocaleString("es-MX")}`;
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

  if (!gan) return alert("Monto inválido. El turno no fue registrado.");

  panelData.turnos.push({
    inicio: inicio.toISOString(),
    fin: fin.toISOString(),
    horas,
    ganancia: gan
  });

  // El ingreso de la ganancia se registra aquí
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
// ======================
// app.js — PARTE 4/4: RENDERIZADO DE RESULTADOS E INICIALIZACIÓN
// ======================

// ======================
// Resumen del día
// ======================
function calcularResumenDatos() {
  const hoy = new Date().toISOString().slice(0, 10);

  // Obtener turnos y gastos DE HOY
  const turnosHoy = (panelData.turnos || []).filter(t => (t.inicio || "").slice(0, 10) === hoy);
  const gastosHoy = (panelData.gastos || []).filter(g => (g.fechaISO || "").slice(0, 10) === hoy);

  const horasHoy = turnosHoy.reduce((s, t) => s + (Number(t.horas) || 0), 0);
  const ganHoy   = turnosHoy.reduce((s, t) => s + (Number(t.ganancia) || 0), 0);
  const gastHoy  = gastosHoy.reduce((s, g) => s + (Number(g.cantidad) || 0), 0);

  return { horasHoy, ganHoy, gastHoy };
}

// ======================
// AGREGACIÓN DE DATOS DIARIOS PARA GRÁFICAS
// ======================
function aggregateDailyData() {
  const data = {};

  const processEntry = (entry, type, amountKey) => {
    const date = (entry.fechaISO || entry.inicio || "").slice(0, 10);
    if (!date) return;

    data[date] = data[date] || { date, ingresos: 0, gastos: 0, kmRecorridos: 0 };
    data[date][type] += (Number(entry[amountKey]) || 0);
  };

  (panelData.turnos || []).forEach(t => processEntry(t, 'ingresos', 'ganancia'));
  (panelData.gastos || []).forEach(g => processEntry(g, 'gastos', 'cantidad'));
  (panelData.kmDiarios || []).forEach(k => processEntry(k, 'kmRecorridos', 'recorrido'));

  // Convertir objeto a array y ordenar por fecha
  return Object.values(data).sort((a, b) => new Date(a.date) - new Date(b.date));
}

// ======================
// CÁLCULO DE MÉTRICAS MENSUALES DE KM (NUEVA FUNCIÓN)
// ======================
function aggregateKmMensual() {
    const dataMensual = {};

    // 1. Agrupar KM por mes
    (panelData.kmDiarios || []).forEach(k => {
        const date = new Date(k.fechaISO);
        // Formato YYYY-MM para la clave
        const mesKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        dataMensual[mesKey] = dataMensual[mesKey] || { kmRecorridos: 0, costoGasolina: 0 };
        dataMensual[mesKey].kmRecorridos += (Number(k.recorrido) || 0);
    });

    // 2. Sumar el costo de la gasolina por mes
    (panelData.gastos || []).forEach(g => {
        // Asumiendo que todos los gastos de gasolina se registran bajo "Transporte"
        if (g.categoria === "Transporte" && g.descripcion.includes("Gasolina")) { 
            const date = new Date(g.fechaISO);
            const mesKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            
            dataMensual[mesKey] = dataMensual[mesKey] || { kmRecorridos: 0, costoGasolina: 0 };
            dataMensual[mesKey].costoGasolina += (Number(g.cantidad) || 0);
        }
    });

    // 3. Calcular métricas finales y formatear
    const resultado = Object.entries(dataMensual).map(([mesKey, data]) => {
        const [year, month] = mesKey.split('-');
        // Formatear el nombre del mes
        const dateString = new Date(year, month - 1, 1).toLocaleString('es-MX', { year: 'numeric', month: 'long' });
        
        const costoPorKm = data.kmRecorridos > 0 
            ? data.costoGasolina / data.kmRecorridos 
            : 0;

        return {
            mes: dateString.charAt(0).toUpperCase() + dateString.slice(1),
            kmRecorridos: data.kmRecorridos,
            costoGasolina: data.costoGasolina,
            costoPorKm: costoPorKm
        };
    }).sort((a, b) => {
      // Ordenar por año-mes descendente (más reciente primero)
      const keyA = a.mes.split(' ')[1] + new Date(a.mes).getMonth();
      const keyB = b.mes.split(' ')[1] + new Date(b.mes).getMonth();
      return keyB.localeCompare(keyA);
    });

    return resultado;
}


// ======================
// RENDERIZADO DE TABLA DE KM MENSUAL (NUEVA FUNCIÓN)
// ======================
function renderTablaKmMensual() {
    const tablaContainer = $("tablaKmMensual"); 
    if (!tablaContainer) return;

    const datosMensuales = aggregateKmMensual();
    
    let html = `
        <table class="tabla">
            <thead>
                <tr>
                    <th>Mes</th>
                    <th>KM Recorridos</th>
                    <th>Costo Gasolina</th>
                    <th>Costo por KM</th>
                </tr>
            </thead>
            <tbody>`;

    if (datosMensuales.length === 0) {
        html += `<tr><td colspan="4" style="text-align:center">No hay datos de KM/Gasolina.</td></tr>`;
    } else {
        datosMensuales.forEach(d => {
            html += `
                <tr>
                    <td>${d.mes}</td>
                    <td>${d.kmRecorridos.toFixed(0)} KM</td>
                    <td>$${fmtMoney(d.costoGasolina)}</td>
                    <td>$${d.costoPorKm.toFixed(2)}</td>
                </tr>
            `;
        });
    }

    html += `</tbody></table>`;
    tablaContainer.innerHTML = html;
}
// ======================
// Render resumen index
// ======================
function renderResumenIndex() {
  const r = calcularResumenDatos();

  if ($("resHoras")) $("resHoras").textContent = r.horasHoy.toFixed(2);
  if ($("resGananciaBruta")) $("resGananciaBruta").textContent = "$" + fmtMoney(r.ganHoy);
  if ($("resGastos")) $("resGastos").textContent = "$" + fmtMoney(r.gastHoy);
  if ($("resNeta")) $("resNeta").textContent = "$" + fmtMoney(r.ganHoy - r.gastHoy);

  renderTablaTurnos();
  renderTablaKmMensual(); // <<< LLAMADA INTEGRADA
  renderCharts();
  calcularProyeccionReal();
}

// ======================
// Tabla Turnos
// ======================
function renderTablaTurnos() {
  const tbody = $("tablaTurnos");
  if (!tbody) return;

  tbody.innerHTML = "";

  const arr = [...(panelData.turnos || [])].reverse();

  if (arr.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center">No hay turnos</td></tr>`;
    return;
  }

  arr.forEach(t => {
    // Nota: Los campos de Gastos y Neta en esta tabla son simplificados,
    // usando la ganancia del turno como Neta y Gastos en $0.00 (según tu código original)
    // Para ser precisos, habría que calcular los gastos de ese día en específico.
    tbody.innerHTML += `
      <tr>
        <td>${(t.inicio || "").slice(0,10)}</td>
        <td>${(Number(t.horas) || 0).toFixed(2)}</td>
        <td>$${fmtMoney(t.ganancia)}</td>
        <td>$0.00</td> 
        <td>$${fmtMoney(t.ganancia)}</td>
      </tr>
    `;
  });
}

// ======================
// Proyección Real
// ======================
function calcularProyeccionReal() {
  const p = panelData.parametros || {};
  const deudaTotal = Number(p.deudaTotal || 0);
  const gastoFijo  = Number(p.gastoFijo || 0);

  const turnos = panelData.turnos || [];
  const diasTrabajados = new Set(turnos.map(t => (t.inicio || "").slice(0,10))).size;

  const totalHoras = turnos.reduce((s,t)=>s+ (Number(t.horas)||0),0);
  const totalGan    = turnos.reduce((s,t)=>s+ (Number(t.ganancia)||0),0);

  const horasPromDia = diasTrabajados ? totalHoras / diasTrabajados : 0;
  const ganPromDia   = diasTrabajados ? totalGan / diasTrabajados : 0;

  const gastos = panelData.gastos || [];
  const gastosPorFecha = {};

  gastos.forEach(g=>{
    const key = (g.fechaISO || "").slice(0,10);
    if (!key) return;
    gastosPorFecha[key] = (gastosPorFecha[key] || 0) + Number(g.cantidad || 0);
  });

  const gastoPromDia = Object.values(gastosPorFecha).reduce((s,v)=>s+v,0) /
                        (Object.keys(gastosPorFecha).length || 1);

  const netaPromDia = ganPromDia - gastoPromDia - gastoFijo;

  let diasParaLiquidar = Infinity;
  if (netaPromDia > 0 && deudaTotal > 0) {
    diasParaLiquidar = deudaTotal / netaPromDia;
  }

  if ($("proyDeuda")) $("proyDeuda").textContent = "$" + fmtMoney(deudaTotal);
  if ($("proyHoras")) $("proyHoras").textContent = horasPromDia.toFixed(2) + " h";
  if ($("proyNeta"))  $("proyNeta").textContent  = "$" + fmtMoney(netaPromDia);

  if ($("proyDias")) {
    if (diasParaLiquidar === Infinity || netaPromDia <= 0) {
      $("proyDias").textContent = (deudaTotal > 0) ? "N/A (Ganancia Neta 0 o negativa)" : "Deuda Saldada";
    } else {
      $("proyDias").textContent = Math.ceil(diasParaLiquidar) + " días";
    }
  }
}

// ======================
// GRÁFICAS (CHART.JS)
// ======================
let gananciasChart = null;
let kmChart = null;

function renderCharts() {
  const dailyData = aggregateDailyData();

  // Tomar solo los últimos 14 días
  const last14Days = dailyData.slice(-14);
  const labels = last14Days.map(d => d.date.slice(5)); 

  // 1. Gráfica de Ganancias vs Gastos
  const ctxGanancias = $("graficaGanancias");
  if (ctxGanancias) {
    if (gananciasChart) gananciasChart.destroy(); 

    gananciasChart = new Chart(ctxGanancias, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Ingresos',
          data: last14Days.map(d => d.ingresos),
          backgroundColor: '#00a000', 
        }, {
          label: 'Gastos',
          data: last14Days.map(d => d.gastos),
          backgroundColor: '#d40000', 
        }]
      },
      options: {
        responsive: true,
        scales: {
          x: { stacked: false },
          y: { beginAtZero: true }
        },
        plugins: {
          legend: { position: 'top' },
          title: { display: false }
        }
      }
    });
  }

  // 2. Gráfica de Kilometraje
  const ctxKm = $("graficaKm");
  if (ctxKm) {
    if (kmChart) kmChart.destroy(); 

    kmChart = new Chart(ctxKm, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'KM Recorridos',
          data: last14Days.map(d => d.kmRecorridos),
          borderColor: '#0066ff', 
          backgroundColor: '#0066ff40',
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        scales: { y: { beginAtZero: true } },
        plugins: {
          legend: { position: 'top' },
          title: { display: false }
        }
      }
    });
  }
}

// ======================
// INICIALIZACIÓN (DOMContentLoaded)
// ======================
document.addEventListener("DOMContentLoaded", () => {
    // 1. Setup Listeners
    setupIngresoListeners();
    setupGastoListeners();
    setupDeudaListeners();
    setupKmAndGasListeners();
    setupIoListeners();
    
    // 2. Turnos Listeners
    $("btnIniciarTurno")?.addEventListener("click", iniciarTurno);
    $("btnFinalizarTurno")?.addEventListener("click", finalizarTurno);

    // 3. Inicializar UI del Admin
    actualizarUIturno();
    renderDeudas();
    
    // Asignar el último KM final guardado como KM Inicial si existe
    if ($("kmInicial") && panelData.parametros.ultimoKMfinal !== null) {
        $("kmInicial").value = panelData.parametros.ultimoKMfinal;
    }

    // 4. Calcular y Pintar Parámetros Automáticos
    calcularDeudaTotalAuto();
    calcularGastoFijoAuto();

    // 5. Bloquear y pintar inputs automáticos
    const inpDeuda = document.getElementById("proyDeudaTotal");
    const inpGasto = document.getElementById("proyGastoFijo");

    if (inpDeuda) {
        inpDeuda.readOnly = true;
        inpDeuda.style.background = "#eee";
    }

    if (inpGasto) {
        inpGasto.readOnly = true;
        inpGasto.style.background = "#eee";
    }

    // 6. Renderizar Resultados (solo si estamos en index.html)
    if (document.title.includes("Resultados")) {
        renderResumenIndex(); 
    }
  // app.js — PARTE 4/4 (aggregateDailyData)
function aggregateDailyData() {
  const data = {};

  const processEntry = (entry, type, amountKey) => {
    
    // CAMBIO CLAVE: Usar la fecha Local para agrupar
    // La fecha Local está en formato "DD/MM/YYYY, HH:MM..."
    const rawDate = entry.fechaLocal || ""; 
    if (!rawDate) return;

    // Extraer solo la fecha: "DD/MM/YYYY"
    const localDate = rawDate.split(',')[0].trim();
    
    // Convertir a formato "YYYY-MM-DD" para ordenar correctamente
    const parts = localDate.split('/');
    if (parts.length !== 3) return;
    const dateKey = `${parts[2]}-${parts[1]}-${parts[0]}`; 

    data[dateKey] = data[dateKey] || { date: dateKey, ingresos: 0, gastos: 0, kmRecorridos: 0 };
    data[dateKey][type] += (Number(entry[amountKey]) || 0);
  };
  
  // ... el resto de la función (sin cambios)
  (panelData.ingresos || []).forEach(t => processEntry(t, 'ingresos', 'cantidad'));
  (panelData.gastos || []).forEach(g => processEntry(g, 'gastos', 'cantidad'));
  // ... etc.

  // Convertir objeto a array y ordenar por fecha (dateKey YYYY-MM-DD)
  return Object.values(data).sort((a, b) => new Date(a.date) - new Date(b.date));
}
  
});
