// ======================
// app.js — PARTE 1/5: SETUP Y UTILIDADES & CÁLCULO DE GASTO FIJO
// ======================

const STORAGE_KEY = "panelData";
const $ = id => document.getElementById(id);

// Estructura base (con nuevos parámetros)
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
    ultimoKMfinal: null,
    costoComidaDiaria: 200, // Valor por defecto/fallback
    costoMantenimientoPorKm: 0.6 // Valor por defecto/fallback
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


// --- NUEVAS UTILIDADES DE FECHA PARA FILTRADO LOCAL ---

/**
 * Obtiene la fecha actual en formato local (DD/MM/YYYY) para filtrar los registros de 'hoy'.
 */
function getTodayLocalDateKey() {
    const today = new Date();
    // Asegura el formato DD/MM/YYYY (ej: "02/12/2025")
    const d = today.getDate().toString().padStart(2, '0');
    const m = (today.getMonth() + 1).toString().padStart(2, '0'); 
    const y = today.getFullYear();
    // El formato debe coincidir con el inicio de panelData[x].fechaLocal
    return `${d}/${m}/${y}`;
}

/**
 * Convierte un string ISO (inicio/fin de turno) a la clave de fecha local (DD/MM/YYYY).
 */
function getLocalDayFromISODate(isoDateString) {
    if (!isoDateString) return null;
    try {
        const date = new Date(isoDateString);
        // Usamos 'es-ES' para forzar el formato DD/MM/YYYY
        return date.toLocaleDateString('es-ES', { 
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric' 
        });
    } catch (e) {
        return null;
    }
}

// -----------------------------
// FUNCIONES AUTOMÁTICAS (CÁLCULO DE GASTO FIJO Y DEUDA)
// -----------------------------

// A) calcula el costo promedio por KM basado en el total de KM y el total de Gasolina
function calcularCostoPromedioPorKm() {
    const totalKMRecorridos = (panelData.kmDiarios || []).reduce((sum, entry) => sum + (Number(entry.recorrido) || 0), 0);
    // Filtrar solo gastos de gasolina bajo la categoría Transporte
    const totalCostoGasolina = (panelData.gastos || [])
        .filter(g => g.categoria === "Transporte" && g.descripcion.includes("Gasolina"))
        .reduce((sum, entry) => sum + (Number(entry.cantidad) || 0), 0);
    
    // Obtener el valor configurable como fallback (el que se usará si no hay datos)
    const costoConfigurable = panelData.parametros.costoMantenimientoPorKm || 0.6;

    // Si hay datos reales de KM y costo de gasolina, se usa el promedio real.
    if (totalKMRecorridos > 0 && totalCostoGasolina > 0) {
        return totalCostoGasolina / totalKMRecorridos;
    }
    
    // Si no hay suficientes datos, se usa el valor configurable como fallback/estimación.
    return costoConfigurable; 
}

// B) calcularGastoFijoAuto: calcula promedio basado en compromisos de deuda, promedio real de comida y KM
function calcularGastoFijoAuto() {
  panelData.parametros = panelData.parametros || {};

  // 1. CÁLCULO DEL PROMEDIO DE GASTO DE COMIDA POR DÍA TRABAJADO
  const turnos = panelData.turnos || [];
  // Usa el número de días con al menos un turno para el promedio
  const diasTrabajados = new Set(turnos.map(t => (t.inicio || "").slice(0,10))).size;

  const gastosComida = (panelData.gastos || []).filter(g => g.categoria === "Comida");
  const totalGastoComida = gastosComida.reduce((s, g) => s + (Number(g.cantidad) || 0), 0);
  
  // Si hay días trabajados, usamos el promedio real. Si no, usamos el valor configurable (fallback).
  const comidaPromedioDiaria = diasTrabajados > 0
    ? totalGastoComida / diasTrabajados
    : panelData.parametros.costoComidaDiaria || 200; // <- FALLBACK

  // Se actualiza el parámetro con el valor calculado para que el usuario sepa cuál se está usando
  panelData.parametros.costoComidaDiaria = comidaPromedioDiaria;


  // 2. CALCULAR COSTO PROMEDIO/KM CON DATA REAL
  const costoPorKmCalculado = calcularCostoPromedioPorKm(); 
  panelData.parametros.costoMantenimientoPorKm = costoPorKmCalculado; // Se guarda el valor calculado/fallback


  // 3. CALCULAR KM PROMEDIO DIARIO
  const kmArr = panelData.kmDiarios || [];
  const kmProm = kmArr.length
    ? kmArr.reduce((s, k) => s + (Number(k.recorrido) || 0), 0) / kmArr.length
    : 0;

  let gastoDiarioDeuda = 0;

  // 4. Sumar el gasto diario programado de todas las deudas activas
  (panelData.deudas || []).forEach(d => {
    const pendiente = (Number(d.monto) || 0) - (Number(d.abonado) || 0);
    const pago = Number(d.pagoProgramado) || 0;

    if (pendiente > 0 && pago > 0) {
      if (d.periodicidad === "Semanal") {
        gastoDiarioDeuda += pago / 7;
      } else if (d.periodicidad === "Quincenal") {
        gastoDiarioDeuda += pago / 15;
      } else if (d.periodicidad === "Mensual") {
        gastoDiarioDeuda += pago / 30;
      }
    }
  });

  // 5. CALCULAR GASTO FIJO TOTAL
  // Gasto Fijo: (Costo diario de Deudas) + (Comida promedio REAL/FALLBACK) + (KM promedio * costo por KM REAL/FALLBACK)
  const gastoFijo = gastoDiarioDeuda + comidaPromedioDiaria + (kmProm * costoPorKmCalculado);

  panelData.parametros.gastoFijo = gastoFijo;
  guardarPanelData();

  // 6. ACTUALIZAR UI en admin.html
  const inpGastoFijo = $("proyGastoFijo");
  if (inpGastoFijo) inpGastoFijo.value = gastoFijo.toFixed(2);
  
  const inpComida = $("paramComidaDiaria");
  if (inpComida) inpComida.value = comidaPromedioDiaria.toFixed(2);
  
  const inpCostoKm = $("paramCostoPorKm");
  if (inpCostoKm) inpCostoKm.value = costoPorKmCalculado.toFixed(2);
}

// C) calcularDeudaTotalAuto: suma de (monto - abonado)
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
// ======================
// app.js — PARTE 2/5: MOVIMIENTOS, REGISTRAR INGRESO Y GASTO
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
    // NOTA: 'Transporte' incluye gasolina. 'Abono a Deuda' se manejará por separado
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
// app.js — PARTE 3/5: DEUDAS Y KM/GASOLINA
// ======================
function renderDeudas() {
  const list = $("listaDeudas");
  const select = $("abonoSeleccionar");

  if (!list || !select) return;

  list.innerHTML = "";
  select.innerHTML = "";

  panelData.deudas.forEach((d, idx) => {
    const pendiente = (Number(d.monto) || 0) - (Number(d.abonado) || 0);
    
    // Calcular el costo diario para mostrarlo, si está programado
    let pagoDiario = 0;
    if (d.pagoProgramado > 0) {
        if (d.periodicidad === "Semanal") pagoDiario = d.pagoProgramado / 7;
        else if (d.periodicidad === "Quincenal") pagoDiario = d.pagoProgramado / 15;
        else if (d.periodicidad === "Mensual") pagoDiario = d.pagoProgramado / 30;
    }
    const infoPago = d.pagoProgramado > 0 
        ? `<br>Compromiso: $${fmtMoney(d.pagoProgramado)} (${d.periodicidad}) ≈ $${pagoDiario.toFixed(2)}/día`
        : "";

    list.innerHTML += `
      <li>
        <strong>${d.nombre}</strong><br>
        Total: $${fmtMoney(d.monto)}<br>
        Pagado: $${fmtMoney(d.abonado || 0)}<br>
        Pendiente: <strong>$${fmtMoney(pendiente)}</strong>
        ${infoPago} 
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
      
      // NUEVOS CAMPOS
      const pagoProgramado = Number($("deudaPagoProgramado")?.value || 0);
      const periodicidad = $("deudaPeriodicidad")?.value || "Mensual";

      if (!nombre || !monto || monto <= 0) return alert("Datos inválidos.");

      // Se registran los nuevos campos
      panelData.deudas.push({ 
          nombre, 
          monto, 
          abonado: 0,
          pagoProgramado, 
          periodicidad 
      });

      guardarPanelData();
      renderDeudas();

      calcularDeudaTotalAuto();
      // Recalcular el gasto fijo con la nueva lógica
      calcularGastoFijoAuto(); 

      $("deudaNombre").value = "";
      $("deudaMonto").value = "";
      $("deudaPagoProgramado").value = ""; // Limpiar nuevo campo

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

    calcularGastoFijoAuto(); // Recalcular ya que cambia el promedio de costo por KM

    $("litrosGas").value = "";
    $("costoGas").value = "";
    alert("Repostaje guardado.");
    renderResumenIndex();
  });
}
// ======================
// app.js — PARTE 4/5: IMPORTAR/EXPORTAR Y TURNOS (FIX)
// ======================

// Importar / Exportar JSON y Guardar Parámetros (FUNCIÓN CORREGIDA)
// ======================
function setupIoListeners() {
    $("btnExportar")?.addEventListener("click", () => {
      const json = JSON.stringify(panelData, null, 2);

      // Intenta usar el portapapeles (más rápido) o descarga un archivo
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

    $("btnImportar")?.addEventListener("click", () => {
      const raw = ($("importJson")?.value || "").trim();

      if (!raw) return alert("Pega tu JSON primero.");

      try {
        const parsed = JSON.parse(raw);

        // Combinar datos existentes con los importados
        panelData = Object.assign({}, panelData, parsed);
        panelData.parametros = Object.assign({}, panelData.parametros, (parsed.parametros || {}));

        guardarPanelData();
        $("importJson").value = "";
        
        // Refrescar UI completamente
        location.reload(); 

        alert("Importación correcta ✔. Recarga de página automática.");

      } catch (e) {
        console.error(e);
        alert("JSON inválido.");
      }
    });
    
    // NUEVO: Exportar a Excel (Requiere librería SheetJS en index.html)
    $("btnExportarExcel")?.addEventListener("click", () => {
      if (typeof XLSX === 'undefined') return alert("Error: La librería de Excel no está cargada. Asegúrate de incluir el script en index.html.");

      const wb = XLSX.utils.book_new();

      // HOJA 1: Movimientos
      const movimientosWs = XLSX.utils.json_to_sheet(panelData.movimientos.map(m => ({
          Fecha: m.fechaLocal.split(',')[0],
          Hora: m.fechaLocal.split(',')[1].trim(),
          Tipo: m.tipo,
          Descripcion: m.descripcion,
          Monto: m.monto
      })));
      XLSX.utils.book_append_sheet(wb, movimientosWs, "Movimientos");

      // HOJA 2: Turnos
      const turnosWs = XLSX.utils.json_to_sheet(panelData.turnos.map(t => ({
          Inicio: getLocalDayFromISODate(t.inicio),
          Fin: getLocalDayFromISODate(t.fin),
          Horas: t.horas,
          Ganancia: t.ganancia
      })));
      XLSX.utils.book_append_sheet(wb, turnosWs, "Turnos");

      // HOJA 3: Gastos
      const gastosWs = XLSX.utils.json_to_sheet(panelData.gastos.map(g => ({
          Fecha: g.fechaLocal.split(',')[0],
          Descripcion: g.descripcion,
          Categoria: g.categoria,
          Cantidad: g.cantidad
      })));
      XLSX.utils.book_append_sheet(wb, gastosWs, "Gastos");
      
      // HOJA 4: Deudas
      const deudasWs = XLSX.utils.json_to_sheet(panelData.deudas.map(d => ({
          Nombre: d.nombre,
          MontoTotal: d.monto,
          MontoAbonado: d.abonado,
          Pendiente: (Number(d.monto) || 0) - (Number(d.abonado) || 0)
      })));
      XLSX.utils.book_append_sheet(wb, deudasWs, "Deudas");

      // Exportar el archivo
      XLSX.writeFile(wb, `reporte_ubereats_tracker_${Date.now()}.xlsx`);
      alert("Reporte EXCEL (.xlsx) generado.");
    });
    
    // Guardar Parámetros de Proyección Manuales
    $("btnGuardarParametros")?.addEventListener("click", () => {
        const comida = Number($("paramComidaDiaria")?.value || 0);
        const kmCost = Number($("paramCostoPorKm")?.value || 0);
        
        if (comida < 0 || kmCost < 0) return alert("Los costos no pueden ser negativos.");

        panelData.parametros.costoComidaDiaria = comida;
        panelData.parametros.costoMantenimientoPorKm = kmCost;
        
        guardarPanelData();
        // Recalcular el gasto fijo con los nuevos valores
        calcularGastoFijoAuto(); 
        alert("Ajustes de parámetros guardados.");
    });
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

  if (!gan || isNaN(gan)) return alert("Monto inválido. El turno no fue registrado.");

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
// app.js — PARTE 5/5: RENDERIZADO, AGREGACIÓN Y INICIALIZACIÓN
// ======================

/**
 * Función que calcula y renderiza los resultados del resumen diario (HORAS, INGRESO, GASTO, NETA).
 * Utiliza getTodayLocalDateKey() y getLocalDayFromISODate() para asegurar que la data sea
 * agrupada por el día local actual (DD/MM/YYYY).
 */
function renderResumenIndex() {
    // Obtiene la clave del día de hoy en formato local (e.g., "02/12/2025")
    const todayKey = getTodayLocalDateKey(); 

    // 1. Filtrar los ingresos y gastos de HOY
    // .startsWith(todayKey) funciona porque fechaLocal es "DD/MM/YYYY, HH:MM..."
    const ingresosHoy = panelData.ingresos.filter(i => i.fechaLocal.startsWith(todayKey));
    const gastosHoy = panelData.gastos.filter(g => g.fechaLocal.startsWith(todayKey));
    
    // 2. Filtrar turnos de HOY
    // Se considera que un turno es "del día" si su hora de FINALIZACIÓN cae en la fecha local de hoy.
    const turnosDelDia = panelData.turnos.filter(t => getLocalDayFromISODate(t.fin) === todayKey);

    // 3. Sumar las métricas
    const totalIngresos = ingresosHoy.reduce((sum, i) => sum + i.cantidad, 0);
    const totalGastos = gastosHoy.reduce((sum, g) => sum + g.cantidad, 0);
    const totalHoras = turnosDelDia.reduce((sum, t) => sum + t.horas, 0);

    const totalNeta = totalIngresos - totalGastos;

    // 4. Renderizar en index.html
    const resHoras = $('resHoras');
    const resGananciaBruta = $('resGananciaBruta');
    const resGastos = $('resGastos');
    const resNeta = $('resNeta');

    if (resHoras) resHoras.textContent = totalHoras.toFixed(2);
    // fmtMoney ya incluye el símbolo "$", solo se pasa el valor
    if (resGananciaBruta) resGananciaBruta.textContent = fmtMoney(totalIngresos);
    if (resGastos) resGastos.textContent = fmtMoney(totalGastos);
    if (resNeta) resNeta.textContent = fmtMoney(totalNeta);

    // Llamar a otras funciones de renderizado/cálculo
    renderTablaTurnos();
    renderTablaKmMensual(); 
    renderCharts();
    calcularProyeccionReal();
}

// ======================
// AGREGACIÓN DE DATOS DIARIOS PARA GRÁFICAS (CORREGIDO)
// ======================
function aggregateDailyData() {
  const data = {};

  const processEntry = (entry, type, amountKey) => {
    
    // CORRECCIÓN CLAVE: Usar la fecha Local para agrupar y luego formatearla a ISO (YYYY-MM-DD)
    const rawDate = entry.fechaLocal || ""; 
    if (!rawDate) return;

    // Extraer solo la fecha: "DD/MM/YYYY"
    const localDate = rawDate.split(',')[0].trim();
    
    // Convertir a formato "YYYY-MM-DD" para ordenar correctamente en el objeto de datos
    const parts = localDate.split('/');
    if (parts.length !== 3) return;
    const dateKey = `${parts[2]}-${parts[1]}-${parts[0]}`; 

    data[dateKey] = data[dateKey] || { date: dateKey, ingresos: 0, gastos: 0, kmRecorridos: 0 };
    data[dateKey][type] += (Number(entry[amountKey]) || 0);
  };
    
  // 1. Procesar Gastos e Ingresos (que tienen fechaLocal)
  (panelData.ingresos || []).forEach(i => processEntry(i, 'ingresos', 'cantidad'));
  (panelData.gastos || []).forEach(g => processEntry(g, 'gastos', 'cantidad'));
  
  // 2. Procesar KM (que también tienen fechaLocal)
  (panelData.kmDiarios || []).forEach(k => {
      const rawDate = k.fechaLocal || ""; 
      if (!rawDate) return;

      const localDate = rawDate.split(',')[0].trim();
      const parts = localDate.split('/');
      if (parts.length !== 3) return;
      const dateKey = `${parts[2]}-${parts[1]}-${parts[0]}`; 

      data[dateKey] = data[dateKey] || { date: dateKey, ingresos: 0, gastos: 0, kmRecorridos: 0 };
      data[dateKey]['kmRecorridos'] += (Number(k.recorrido) || 0);
  });
  
  // Convertir objeto a array y ordenar por fecha (el dateKey YYYY-MM-DD es ordenable)
  return Object.values(data).sort((a, b) => a.date.localeCompare(b.date));
}


// ======================
// CÁLCULO DE MÉTRICAS MENSUALES DE KM
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
        // Asumiendo que todos los gastos de gasolina se registran bajo "Transporte" y tienen "Gasolina" en la descripción
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
// RENDERIZADO DE TABLA DE KM MENSUAL
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
    // La tabla muestra la neta asumiendo que el gasto de ese día fue 0.00
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

  // Neta promedio diaria: Ganancia promedio - Gasto promedio (para evitar duplicar costos fijos)
  const netaPromDia = ganPromDia - gastoPromDia; 

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
    // calcularGastoFijoAuto llenará los inputs paramComidaDiaria, paramCostoPorKm y proyGastoFijo
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
});
