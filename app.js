// app.js
// Lógica principal de Uber Eats Tracker
// Panel de Resultados (Index): Muestra datos
// Administración (Admin): Recopila datos y gestiona

const STORAGE_KEY = "panelData";
const $ = id => document.getElementById(id);

// Gráficas (globales para poder destruirlas y recrearlas)
let gananciasChart = null;
let kmChart = null;
let deudaWizardStep = 1;

// Estructura base de datos
let panelData = {
  ingresos: [], 
  gastos: [], 
  movimientos: [], 
  turnos: [], 
  kilometraje: { 
    aceite: 0,
    bujia: 0,
    llantas: 0
  },
  deudas: [],
  parametros: {
    deudaTotal: 0,
    gastoFijo: 0,
    ultimoKMfinal: 0, 
    costoPorKm: 0.85, 
    mantenimientoBase: {
      'Aceite (KM)': 3000,
      'Bujía (KM)': 8000,
      'Llantas (KM)': 15000
    }
  }
};

// Estado de turno (persiste en localStorage por separado para acceso rápido)
let turnoActivo = JSON.parse(localStorage.getItem("turnoActivo")) || false;
let turnoInicio = localStorage.getItem("turnoInicio") || null; // string TS o null
let turnoKMInicial = localStorage.getItem("turnoKMInicial") || null; // string KM o null

// ---------- UTILIDADES ----------

function safeNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function fmtMoney(amount) {
  if (amount === undefined || amount === null) return "0.00";
  return safeNumber(amount, 0).toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function getTodayDateString() {
  return new Date().toISOString().slice(0, 10);
}

function calcularHorasTrabajadas(inicioTS, finTS = Date.now()) {
  if (!inicioTS) return 0;
  const diffMs = finTS - new Date(inicioTS).getTime();
  return diffMs / (1000 * 60 * 60); // De milisegundos a horas
}

// ---------- MANEJO DE DATOS ----------

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(panelData));
  localStorage.setItem("turnoActivo", turnoActivo);
  localStorage.setItem("turnoInicio", turnoInicio);
  localStorage.setItem("turnoKMInicial", turnoKMInicial);
}

function cargarPanelData() {
  try {
    const storedData = localStorage.getItem(STORAGE_KEY);
    if (storedData) {
      const parsedData = JSON.parse(storedData);
      // Fusión (merge) robusta de datos para nuevas propiedades
      panelData = {
        ...panelData,
        ...parsedData,
        parametros: {
          ...panelData.parametros,
          ...parsedData.parametros
        }
      };
    }
  } catch (error) {
    console.error("Error al cargar datos:", error);
  }
}

// ---------- LÓGICA DE ADMINISTRACIÓN (admin.html) ----------

/** Actualiza la interfaz del formulario de turno: Iniciar vs. Finalizar */
function actualizarUIturno() {
  const btnIniciar = $("btnIniciarTurno");
  const btnFinalizar = $("btnFinalizarTurno");
  const kmInicialInput = $("kmInicial");
  const kmFinalInput = $("kmFinal");
  const gananciaBrutaInput = $("gananciaBruta");
  const textoTurno = $("turnoTexto");

  if (!btnIniciar || !btnFinalizar || !textoTurno) return;

  if (turnoActivo) {
    textoTurno.textContent = `🟢 Turno activo desde: ${new Date(turnoInicio).toLocaleString()}`;
    btnIniciar.style.display = 'none';
    btnFinalizar.style.display = 'block';

    // Mostrar campos de finalización
    $("labelKmInicial").style.display = 'none';
    kmInicialInput.style.display = 'none';
    $("labelKmFinal").style.display = 'block';
    kmFinalInput.style.display = 'block';
    $("labelGananciaBruta").style.display = 'block';
    gananciaBrutaInput.style.display = 'block';

  } else {
    textoTurno.textContent = '🔴 Sin turno activo';
    btnIniciar.style.display = 'block';
    btnFinalizar.style.display = 'none';

    // Ocultar campos de finalización
    $("labelKmFinal").style.display = 'none';
    kmFinalInput.style.display = 'none';
    gananciaBrutaInput.value = ""; 
    $("labelGananciaBruta").style.display = 'none';
    kmFinalInput.style.display = 'none';

    // Mostrar campos de inicio
    $("labelKmInicial").style.display = 'block';
    kmInicialInput.style.display = 'block';

    // Precargar KM inicial si hay un último registro
    if (panelData.parametros.ultimoKMfinal > 0) {
      kmInicialInput.value = safeNumber(panelData.parametros.ultimoKMfinal).toFixed(0);
    }
  }
}

function iniciarTurno() {
  const kmInicial = safeNumber($("kmInicial").value);
  if (kmInicial <= 0) {
    alert("¡Error! El KM Inicial debe ser un número positivo.");
    return;
  }

  turnoActivo = true;
  turnoInicio = new Date().toISOString();
  turnoKMInicial = kmInicial;

  $("kmFinal").value = ""; 
  $("gananciaBruta").value = ""; 

  alert(`Turno iniciado con KM Inicial: ${kmInicial} km.`);
  actualizarUIturno();
  saveData();
}

function finalizarTurno() {
  const kmFinal = safeNumber($("kmFinal").value);
  const gananciaBruta = safeNumber($("gananciaBruta").value);
  const kmInicial = safeNumber(turnoKMInicial);

  if (!turnoActivo || !turnoInicio) {
    alert("No hay turno activo para finalizar.");
    return;
  }

  if (kmFinal <= kmInicial) {
    alert(`¡Error! El KM Final (${kmFinal}) debe ser mayor que el KM Inicial (${kmInicial}).`);
    return;
  }
  if (gananciaBruta < 0) { // Permitimos 0 por si el turno fue muy malo
    alert("¡Error! La Ganancia Bruta no puede ser negativa.");
    return;
  }

  const horas = calcularHorasTrabajadas(turnoInicio);
  const kmRecorridos = kmFinal - kmInicial;
  const costoOperativo = kmRecorridos * safeNumber(panelData.parametros.costoPorKm);
  const gananciaNetaEstimada = gananciaBruta - costoOperativo;

  const nuevoTurno = {
    id: Date.now(),
    fecha: getTodayDateString(),
    inicio: turnoInicio,
    fin: new Date().toISOString(),
    horas: safeNumber(horas),
    kmInicial: kmInicial,
    kmFinal: kmFinal,
    kmRecorridos: kmRecorridos,
    gananciaBruta: gananciaBruta,
    costoOperativo: costoOperativo,
    gananciaNeta: gananciaNetaEstimada
  };

  panelData.turnos.push(nuevoTurno);
  panelData.parametros.ultimoKMfinal = kmFinal;

  // Actualizar kilometraje de mantenimiento
  panelData.kilometraje.aceite += kmRecorridos;
  panelData.kilometraje.bujia += kmRecorridos;
  panelData.kilometraje.llantas += kmRecorridos;

  // Resetear estado del turno
  turnoActivo = false;
  turnoInicio = null;
  turnoKMInicial = null;

  alert(`Turno finalizado. Ganancia Neta Estimada: $${fmtMoney(gananciaNetaEstimada)}.`);
  actualizarUIturno();
  saveData();
  // Al finalizar un turno, es buena práctica volver al panel
  window.location.href = "index.html"; 
}

function handleRegistrarIngreso() {
  const descripcion = $("ingresoDescripcion").value.trim();
  const cantidad = safeNumber($("ingresoCantidad").value);

  if (!descripcion || cantidad <= 0) {
    alert("Complete la descripción y asegúrese de que el monto sea positivo.");
    return;
  }

  const nuevoIngreso = {
    id: Date.now(),
    tipo: "Ingreso",
    fecha: new Date().toISOString(),
    descripcion: descripcion,
    monto: cantidad
  };

  panelData.ingresos.push(nuevoIngreso);
  panelData.movimientos.push(nuevoIngreso);

  $("ingresoDescripcion").value = "";
  $("ingresoCantidad").value = "";
  alert("Ingreso registrado.");
  saveData();
}

function handleRegistrarGasto() {
  const descripcion = $("gastoDescripcion").value.trim();
  const cantidad = safeNumber($("gastoCantidad").value);
  const tipo = $("gastoTipo").value; // 'trabajo' o 'fijo'

  if (!descripcion || cantidad <= 0) {
    alert("Complete la descripción y asegúrese de que el monto sea positivo.");
    return;
  }

  const nuevoGasto = {
    id: Date.now(),
    tipo: "Gasto",
    subtipo: tipo,
    fecha: new Date().toISOString(),
    descripcion: descripcion,
    monto: cantidad * -1 // Almacenar como negativo
  };

  panelData.gastos.push(nuevoGasto);
  panelData.movimientos.push(nuevoGasto);

  $("gastoDescripcion").value = "";
  $("gastoCantidad").value = "";
  alert(`Gasto (${tipo}) registrado.`);
  saveData();
}

// --- FUNCIONES DE DATOS Y RESPALDO (EXPORTACIÓN/IMPORTACIÓN) ---

function handleExportJson() {
    // Incluir estado del turno activo para el respaldo completo
    const fullData = {
        ...panelData,
        turnoActivo: turnoActivo,
        turnoInicio: turnoInicio,
        turnoKMInicial: turnoKMInicial
    };

    const dataString = JSON.stringify(fullData, null, 2);

    if (navigator.clipboard) {
        navigator.clipboard.writeText(dataString)
            .then(() => alert("✅ JSON copiado al portapapeles."))
            .catch(err => {
                console.error('Error al copiar:', err);
                alert("❌ Error al copiar. Consulte la consola.");
            });
    } else {
        // Fallback for older browsers
        const dummy = document.createElement("textarea");
        document.body.appendChild(dummy);
        dummy.value = dataString;
        dummy.select();
        document.execCommand("copy");
        document.body.removeChild(dummy);
        alert("✅ JSON copiado al portapapeles (método antiguo).");
    }
}

function handleImportJson() {
    const jsonText = $("importJson").value.trim();
    if (!jsonText) {
        alert("⚠️ Pegue el texto JSON en el área de texto antes de restaurar.");
        return;
    }

    if (!confirm("🚨 ¿Está seguro de querer restaurar los datos? Esto reemplazará todos los datos actuales de su sesión.")) {
        return;
    }

    try {
        const importedData = JSON.parse(jsonText);

        // Validación simple de la estructura
        if (!Array.isArray(importedData.turnos) || !Array.isArray(importedData.movimientos)) {
            alert("❌ Error: El JSON importado parece no tener la estructura correcta (faltan arrays clave como 'turnos' o 'movimientos').");
            return;
        }

        // 1. Overwrite global data
        panelData = {
            ...panelData, // Mantiene la estructura base
            ...importedData
        };

        // 2. Restore Turno State (se asume que están en el respaldo)
        turnoActivo = importedData.turnoActivo || false;
        turnoInicio = importedData.turnoInicio || null;
        turnoKMInicial = importedData.turnoKMInicial || null;

        // 3. Save and Reload
        saveData(); 
        alert("✅ ¡Datos restaurados con éxito! Recargando la página.");
        window.location.reload();

    } catch (e) {
        console.error("Error al analizar JSON:", e);
        alert("❌ Error al restaurar los datos. Asegúrese de que el JSON sea válido.");
    }
}

function handleExportExcel() {
    // Esta función requiere la librería 'xlsx.full.min.js' (ya incluida en admin.html)
    // Lógica avanzada de exportación a Excel...
    alert("Exportación a Excel en progreso (requiere librería XLSX y lógica de formateo).");
    
    // Aquí iría el código de XLSX para crear el libro con varias hojas (turnos, movimientos, etc.)
}


// ---------- LÓGICA DE RESULTADOS/DASHBOARD (index.html) ----------

/**
 * Calcula las métricas de un día específico.
 */
function getMetricsForDay(dateStr) {
  let horas = 0;
  let gananciaBruta = 0;
  let gastosTrabajo = 0;
  let kmRecorridos = 0;

  // 1. Turnos del día
  panelData.turnos
    .filter(t => t.fecha === dateStr)
    .forEach(t => {
      horas += safeNumber(t.horas);
      gananciaBruta += safeNumber(t.gananciaBruta);
      kmRecorridos += safeNumber(t.kmRecorridos);
      // Incluir costo operativo como gasto de trabajo
      gastosTrabajo += safeNumber(t.costoOperativo);
    });

  // 2. Gastos de trabajo del día
  panelData.gastos
    .filter(g => g.subtipo === 'trabajo' && g.fecha.startsWith(dateStr))
    .forEach(g => {
      gastosTrabajo += safeNumber(g.monto) * -1; 
    });
    
    // 3. Ingresos extra del día
    panelData.ingresos
    .filter(i => i.fecha.startsWith(dateStr))
    .forEach(i => {
      gananciaBruta += safeNumber(i.monto);
    });

  const gananciaNeta = gananciaBruta - gastosTrabajo;
  const gananciaPorHora = horas > 0 ? gananciaNeta / horas : 0;

  return {
    horas: horas,
    gananciaBruta: gananciaBruta,
    gastosTrabajo: gastosTrabajo,
    gananciaNeta: gananciaNeta,
    kmRecorridos: kmRecorridos,
    gananciaPorHora: gananciaPorHora
  };
}

function renderResumenIndex() {
  const todayMetrics = getMetricsForDay(getTodayDateString());

  // Resumen del Día
  if ($("resHoras")) $("resHoras").textContent = `${todayMetrics.horas.toFixed(2)}h`;
  if ($("resGananciaBruta")) $("resGananciaBruta").textContent = `$${fmtMoney(todayMetrics.gananciaBruta)}`;
  if ($("resGastosTrabajo")) $("resGastosTrabajo").textContent = `$${fmtMoney(todayMetrics.gastosTrabajo)}`;
  if ($("resGananciaNeta")) $("resGananciaNeta").textContent = `$${fmtMoney(todayMetrics.gananciaNeta)}`;
  if ($("resKmRecorridos")) $("resKmRecorridos").textContent = `${todayMetrics.kmRecorridos.toFixed(1)} km`;
  if ($("resGananciaPorHora")) $("resGananciaPorHora").textContent = `$${fmtMoney(todayMetrics.gananciaPorHora)}/h`;

  // Proyecciones (implementación simplificada)
  renderProyecciones();
  renderTablaTurnos();
  // renderCharts(); // Descomentar al tener Chart.js
  checkAndRenderAlertas();
}

function renderProyecciones() {
  // Simulación de cálculo de promedio de 7 días (ajustar con lógica real si es necesario)
  // **Asumiendo un cálculo promedio aquí para que el panel no esté vacío:**
  const NET_PROMEDIO_7_DIAS = panelData.turnos.length > 0 
                            ? panelData.turnos.reduce((sum, t) => sum + safeNumber(t.gananciaNeta), 0) / panelData.turnos.length 
                            : 0; 
  
  const gastoFijoDiario = safeNumber(panelData.parametros.gastoFijo);
  const deudaTotal = safeNumber(panelData.parametros.deudaTotal);
  
  if ($("proyKmTotal")) $("proyKmTotal").textContent = `${safeNumber(panelData.parametros.ultimoKMfinal).toFixed(0)} KM`;
  if ($("proyDeuda")) $("proyDeuda").textContent = `$${fmtMoney(deudaTotal)}`;
  if ($("proyGastoFijoDiario")) $("proyGastoFijoDiario").textContent = `$${fmtMoney(gastoFijoDiario)}`;
  if ($("proyNetaPromedio")) $("proyNetaPromedio").textContent = `$${fmtMoney(NET_PROMEDIO_7_DIAS)}`;

  // Cálculo de tiempo libre de deudas
  const excedenteDiario = NET_PROMEDIO_7_DIAS - gastoFijoDiario;
  let tiempoLibreDeDeudas = "Calculando...";

  if (deudaTotal > 0) {
    if (excedenteDiario > 10) { // Un mínimo para considerarlo avance
      tiempoLibreDeDeudas = `${Math.ceil(deudaTotal / excedenteDiario)} días`;
    } else {
      tiempoLibreDeDeudas = "Sin avance (Neto < Gasto Fijo)";
    }
  } else {
    tiempoLibreDeDeudas = "¡Libre de Deudas! 🎉";
  }

  if ($("proyDias")) $("proyDias").textContent = tiempoLibreDeDeudas;
}

function renderTablaTurnos() {
    const tablaTurnos = $("tablaTurnos");
    if (!tablaTurnos) return;

    tablaTurnos.innerHTML = "";
    // Mostrar solo los últimos 5 turnos ordenados por fecha/ID
    panelData.turnos
        .sort((a, b) => b.id - a.id)
        .slice(0, 5)
        .forEach(turno => {
            tablaTurnos.innerHTML += `
                <tr>
                    <td>${turno.fecha}</td>
                    <td>${turno.horas.toFixed(2)}</td>
                    <td>${turno.kmRecorridos.toFixed(1)}</td>
                    <td>$${fmtMoney(turno.gananciaNeta)}</td>
                </tr>
            `;
        });
}

function checkAndRenderAlertas() {
    const listaAlertas = $("listaAlertas");
    const cardAlertas = $("cardAlertas");
    if (!listaAlertas || !cardAlertas) return;

    listaAlertas.innerHTML = "";
    let alertasCount = 0;

    for (const [nombre, umbral] of Object.entries(panelData.parametros.mantenimientoBase)) {
        const kmKey = nombre.split(' ')[0].toLowerCase();
        const kmActual = panelData.kilometraje[kmKey] || 0;
        if (kmActual >= umbral) {
            listaAlertas.innerHTML += `<li>Mantenimiento de **${nombre.split(' ')[0]}** pendiente. ${kmActual.toFixed(0)} KM / ${umbral} KM.</li>`;
            alertasCount++;
        }
    }

    if (alertasCount > 0) {
        cardAlertas.classList.remove("hidden");
    } else {
        cardAlertas.classList.add("hidden");
        listaAlertas.innerHTML = "<li>No hay alertas de mantenimiento pendientes.</li>";
    }
}

// Lógica de renderCharts y renderHistorial... (omito por brevedad, asumiendo que usan los datos correctos)
function renderCharts() { /* Lógica de Chart.js */ }
function renderHistorial() { 
  const historialBody = $("historialBody");
  if (!historialBody) return;

  historialBody.innerHTML = "";
  // Ordenar movimientos por fecha descendente
  panelData.movimientos
    .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
    .forEach(mov => {
      const montoFmt = `$${fmtMoney(Math.abs(mov.monto))}`;
      const tipoDisplay = mov.tipo === "Gasto" ? `Gasto (${mov.subtipo})` : mov.tipo;
      
      historialBody.innerHTML += `
        <tr>
          <td>${tipoDisplay}</td>
          <td>${new Date(mov.fecha).toLocaleDateString()}</td>
          <td>${mov.descripcion}</td>
          <td style="color: ${mov.monto < 0 ? '#dc3545' : '#06C167'};">
            ${mov.monto < 0 ? '-' : ''}${montoFmt}
          </td>
        </tr>
      `;
    });
}


// ---------- LISTENERS DE FORMULARIOS DE ADMIN (admin.html) ----------

function setupAdminListeners() {
  // Turno
  if ($("btnIniciarTurno")) $("btnIniciarTurno").addEventListener("click", iniciarTurno);
  if ($("btnFinalizarTurno")) $("btnFinalizarTurno").addEventListener("click", finalizarTurno);

  // Ingreso
  if ($("btnRegistrarIngreso")) $("btnRegistrarIngreso").addEventListener("click", handleRegistrarIngreso);

  // Gasto
  if ($("btnRegistrarGasto")) $("btnRegistrarGasto").addEventListener("click", handleRegistrarGasto);

  // Parámetros
  if ($("btnGuardarKmParam")) $("btnGuardarKmParam").addEventListener("click", () => {
    panelData.parametros.costoPorKm = safeNumber($("costoPorKm").value);
    saveData();
    alert("Parámetro Costo/KM guardado.");
  });

  // Deudas (Parámetros fijos)
  if ($("btnFinalizarDeuda")) $("btnFinalizarDeuda").addEventListener("click", () => {
    panelData.parametros.gastoFijo = safeNumber($("gastoFijoDiario").value);
    // Asumo que la deuda total también se registra aquí o en otro paso del wizard
    // panelData.parametros.deudaTotal = safeNumber($("deudaMontoTotal").value); 
    saveData();
    alert("Gasto Fijo guardado.");
  });

  // ** DATOS Y RESPALDO (CORREGIDO) **
  if ($("btnExportarExcel")) $("btnExportarExcel").addEventListener("click", handleExportExcel);
  if ($("btnExportar")) $("btnExportar").addEventListener("click", handleExportJson);
  if ($("btnImportar")) $("btnImportar").addEventListener("click", handleImportJson);
  // ** FIN DE CORRECCIÓN **
}

// ---------- INICIALIZACIÓN GLOBAL (Selecciona qué ejecutar) ----------
function initApp() {
  cargarPanelData(); 

  const page = document.body.dataset.page || "index"; // Usar data-page del body

  // 1. Lógica de Administración (admin.html)
  if (page === "admin") {
    setupAdminListeners();
    actualizarUIturno(); 
    // Cargar parámetros en los inputs
    if ($("costoPorKm")) $("costoPorKm").value = panelData.parametros.costoPorKm;
    if ($("gastoFijoDiario")) $("gastoFijoDiario").value = panelData.parametros.gastoFijo;
  }

  // 2. Lógica de Resultados/Dashboard (index.html)
  if (page === "index") {
    renderResumenIndex();
  }

  // 3. Lógica de Historial (historial.html)
  if (page === "historial") {
    renderHistorial();
  }

}

document.addEventListener("DOMContentLoaded", initApp);
