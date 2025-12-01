// ======================
// app.js — PARTE 1/5: SETUP Y UTILIDADES
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
const fmtMoney = n => Number(n).toFixed(2);
const nowISO = () => new Date().toISOString();
const nowLocal = () => new Date().toLocaleString("es-MX");
const getHoyLocal = () => new Date().toLocaleDateString("es-MX"); // CORRECCIÓN: Obtiene solo la fecha local (DD/MM/AAAA)
// ======================
// app.js — PARTE 2/5: LISTENERS DE MOVIMIENTOS
// ======================

function setupIngresoListeners() {
  $("btnGuardarIngreso").addEventListener("click", () => {
    const descripcion = $("ingresoDescripcion").value.trim();
    const cantidad = Number($("ingresoCantidad").value);

    if (!descripcion || isNaN(cantidad) || cantidad <= 0) {
      alert("Por favor, llena todos los campos correctamente para registrar el ingreso.");
      return;
    }

    const newIngreso = {
      descripcion,
      cantidad,
      fechaISO: nowISO(),
      fechaLocal: nowLocal()
    };
    panelData.ingresos.push(newIngreso);
    panelData.movimientos.unshift({
      tipo: "Ingreso",
      descripcion,
      monto: cantidad,
      fechaISO: nowISO(),
      fechaLocal: nowLocal()
    });

    guardarPanelData();
    location.reload();
  });
}

function setupGastoListeners() {
  $("btnGuardarGasto").addEventListener("click", () => {
    const descripcion = $("gastoDescripcion").value.trim();
    const cantidad = Number($("gastoCantidad").value);
    const categoria = $("gastoCategoria").value;

    if (!descripcion || isNaN(cantidad) || cantidad <= 0) {
      alert("Por favor, llena todos los campos correctamente para registrar el gasto.");
      return;
    }

    const newGasto = {
      descripcion,
      cantidad,
      categoria,
      fechaISO: nowISO(),
      fechaLocal: nowLocal()
    };
    panelData.gastos.push(newGasto);
    panelData.movimientos.unshift({
      tipo: "Gasto",
      descripcion: `${descripcion} (${categoria})`,
      monto: cantidad,
      fechaISO: nowISO(),
      fechaLocal: nowLocal()
    });

    guardarPanelData();
    location.reload();
  });
}

function setupKmAndGasListeners() {
  // Precargar KM Inicial
  if ($("kmInicial") && panelData.parametros.ultimoKMfinal) {
    $("kmInicial").value = panelData.parametros.ultimoKMfinal;
  }

  // Listener de KM Final para actualizar recorrido
  const updateRecorrido = () => {
    const kmInicial = Number($("kmInicial").value);
    const kmFinal = Number($("kmFinal").value);
    const recorrido = kmFinal > kmInicial ? kmFinal - kmInicial : 0;
    $("kmRecorridos").textContent = `KM recorridos: ${recorrido}`;
  };

  if ($("kmFinal")) {
    $("kmFinal").addEventListener("input", updateRecorrido);
  }

  $("btnGuardarKm").addEventListener("click", () => {
    const kmInicial = Number($("kmInicial").value);
    const kmFinal = Number($("kmFinal").value);
    const recorrido = kmFinal > kmInicial ? kmFinal - kmInicial : 0;

    if (recorrido <= 0 || kmFinal < kmInicial) {
      alert("El KM Final debe ser mayor al KM Inicial.");
      return;
    }

    const newKm = {
      fechaISO: nowISO(),
      fechaLocal: nowLocal(),
      kmInicial,
      kmFinal,
      recorrido
    };
    panelData.kmDiarios.push(newKm);
    panelData.parametros.ultimoKMfinal = kmFinal;

    guardarPanelData();
    location.reload();
  });

  $("btnGuardarGas").addEventListener("click", () => {
    const litros = Number($("litrosGas").value);
    const costo = Number($("costoGas").value);

    if (litros <= 0 || costo <= 0 || isNaN(litros) || isNaN(costo)) {
      alert("Por favor, introduce valores válidos para Litros y Costo total.");
      return;
    }

    const newGas = {
      fechaISO: nowISO(),
      fechaLocal: nowLocal(),
      litros,
      costo
    };
    panelData.gasolina.push(newGas);

    // Registrar como gasto también
    const newGasto = {
      descripcion: `Gasolina ${litros}L`,
      cantidad: costo,
      categoria: "Transporte",
      fechaISO: nowISO(),
      fechaLocal: nowLocal()
    };
    panelData.gastos.push(newGasto);
    panelData.movimientos.unshift({
      tipo: "Gasto",
      descripcion: `Gasolina ${litros}L`,
      monto: costo,
      fechaISO: nowISO(),
      fechaLocal: nowLocal()
    });

    guardarPanelData();
    location.reload();
  });
}
// ======================
// app.js — PARTE 3/5: LISTENERS DE TURNOS, DEUDAS, Y I/O
// ======================

let turnoActivo = null;

function setupTurnoListeners() {
  const btnIniciar = $("btnIniciarTurno");
  const btnFinalizar = $("btnFinalizarTurno");
  const turnoInfo = $("turnoInfo");

  const updateTurnoUI = () => {
    if (turnoActivo) {
      btnIniciar.style.display = 'none';
      btnFinalizar.style.display = 'block';
      turnoInfo.textContent = `Turno en curso iniciado el ${new Date(turnoActivo.inicio).toLocaleString("es-MX")}.`;
    } else {
      btnIniciar.style.display = 'block';
      btnFinalizar.style.display = 'none';
      turnoInfo.textContent = `Sin turno activo`;
    }
  };

  const cargarTurnoActivo = () => {
    turnoActivo = (panelData.turnos || []).find(t => !t.fin);
    if (turnoInfo) updateTurnoUI();
  };

  if (btnIniciar) {
    btnIniciar.addEventListener("click", () => {
      turnoActivo = {
        inicio: nowISO(),
        ganancia: 0, // Se actualizará al finalizar
        horas: 0
      };
      panelData.turnos.push(turnoActivo);
      guardarPanelData();
      updateTurnoUI();
    });
  }

  if (btnFinalizar) {
    btnFinalizar.addEventListener("click", () => {
      const ganancia = Number(prompt("Introduce la ganancia total del turno:"));

      if (isNaN(ganancia) || ganancia < 0) {
        alert("Ganancia inválida. El turno no fue finalizado.");
        return;
      }

      const fin = new Date();
      const inicio = new Date(turnoActivo.inicio);
      const horas = (fin.getTime() - inicio.getTime()) / (1000 * 60 * 60);

      // Finalizar el turno
      turnoActivo.fin = fin.toISOString();
      turnoActivo.horas = Number(horas.toFixed(2));
      turnoActivo.ganancia = ganancia;

      // Registrar como ingreso
      panelData.ingresos.push({
        descripcion: `Ganancia turno (${turnoActivo.horas}h)`,
        cantidad: ganancia,
        fechaISO: nowISO(),
        fechaLocal: nowLocal()
      });
      panelData.movimientos.unshift({
        tipo: "Ingreso",
        descripcion: `Ganancia turno (${turnoActivo.horas}h)`,
        monto: ganancia,
        fechaISO: nowISO(),
        fechaLocal: nowLocal()
      });

      turnoActivo = null; // Limpiar el estado
      guardarPanelData();
      location.reload();
    });
  }

  // Inicializar al cargar la página
  cargarTurnoActivo();
}

function setupDeudasListeners() {
  $("btnGuardarDeuda").addEventListener("click", () => {
    const nombre = $("deudaNombre").value.trim();
    const monto = Number($("deudaMontoTotal").value);

    if (!nombre || isNaN(monto) || monto <= 0) {
      alert("Por favor, llena todos los campos de la deuda correctamente.");
      return;
    }

    panelData.deudas.push({ nombre, monto, abonado: 0 });
    guardarPanelData();
    location.reload();
  });
}

function setupAbonoListeners() {
  const selectDeuda = $("selectDeudaAbono");

  const renderDeudasAbono = () => {
    selectDeuda.innerHTML = "";
    panelData.deudas.forEach((d, index) => {
      const pendiente = d.monto - d.abonado;
      const option = document.createElement("option");
      option.value = index;
      option.textContent = `${d.nombre} – $${fmtMoney(pendiente)} pendiente`;
      selectDeuda.appendChild(option);
    });
  };

  renderDeudasAbono();

  $("btnRegistrarAbono").addEventListener("click", () => {
    const selectedIndex = Number(selectDeuda.value);
    const abonoMonto = Number($("montoAbonado").value);

    if (selectedIndex === -1 || isNaN(abonoMonto) || abonoMonto <= 0) {
      alert("Selecciona una deuda y un monto válido para el abono.");
      return;
    }

    const deuda = panelData.deudas[selectedIndex];
    const pendiente = deuda.monto - deuda.abonado;

    if (abonoMonto > pendiente) {
      alert(`El abono ($${fmtMoney(abonoMonto)}) excede el pendiente ($${fmtMoney(pendiente)}).`);
      return;
    }

    // 1. Aplicar abono a la deuda
    deuda.abonado += abonoMonto;
    
    // 2. Registrar como gasto
    const descripcion = `Abono a ${deuda.nombre}`;
    panelData.gastos.push({
      descripcion,
      cantidad: abonoMonto,
      categoria: "Abono a Deuda",
      fechaISO: nowISO(),
      fechaLocal: nowLocal()
    });
    panelData.movimientos.unshift({
      tipo: "Gasto",
      descripcion,
      monto: abonoMonto,
      fechaISO: nowISO(),
      fechaLocal: nowLocal()
    });

    guardarPanelData();
    location.reload();
  });
}

function setupIoListeners() {
  const textarea = $("importJson");

  $("btnExportar").addEventListener("click", () => {
    const jsonStr = JSON.stringify(panelData, null, 2);
    navigator.clipboard.writeText(jsonStr).then(() => {
      alert("Datos copiados al portapapeles.");
    }).catch(err => {
      console.error('Error al copiar:', err);
      alert("Error al copiar los datos. Por favor, inténtalo de nuevo.");
    });
  });

  $("btnImportar").addEventListener("click", () => {
    try {
      const importedData = JSON.parse(textarea.value);
      if (importedData.ingresos && importedData.gastos) { // Simple validación
        localStorage.setItem(STORAGE_KEY, JSON.stringify(importedData));
        alert("Importación correcta ✔. Recarga de página automática.");
        location.reload();
      } else {
        alert("El JSON importado no parece ser válido.");
      }
    } catch (e) {
      alert("Error al procesar el JSON. Verifica el formato.");
      console.error(e);
    }
  });

  // El botón de Excel no tiene funcionalidad implementada, es correcto que no haga nada.
}
// ======================
// app.js — PARTE 4/5: CÁLCULOS Y AGREGACIÓN DE DATOS (CORRECCIONES DE FECHA)
// ======================

function calcularDeudaTotal() {
  let total = 0;
  (panelData.deudas || []).forEach(d => {
    total += (Number(d.monto) || 0) - (Number(d.abonado) || 0);
  });
  panelData.parametros.deudaTotal = total;
}

function calcularGastoFijo() {
  const todosGastos = panelData.gastos || [];
  
  // 1. Gastos de Comida (Promedio simple)
  const gastosComida = todosGastos.filter(g => g.categoria === "Comida");
  const promedioComida = gastosComida.length > 0 ? gastosComida.reduce((s, g) => s + (Number(g.cantidad) || 0), 0) / gastosComida.length : 0;

  // 2. Costo por KM (de los últimos 30 días, si fuera posible, o general)
  const kmTotales = (panelData.kmDiarios || []).reduce((s, k) => s + (Number(k.recorrido) || 0), 0);
  const costoGasTotal = todosGastos.filter(g => g.descripcion.includes("Gasolina")).reduce((s, g) => s + (Number(g.cantidad) || 0), 0);
  
  // Evitar división por cero
  const costoPorKm = kmTotales > 0 ? costoGasTotal / kmTotales : 0.37; 
  
  // 3. Gasto Fijo Estimado (Ejemplo: Promedio Comida + 100 KM * CostoPorKm)
  // Nota: Se usa un valor base de 100 KM para la estimación diaria
  const gastoFijoEstimado = promedioComida + (100 * costoPorKm); 

  panelData.parametros.gastoFijo = Number(gastoFijoEstimado.toFixed(2));
}

function calcularResumenDatos() {
  const hoyLocal = getHoyLocal(); // CORRECCIÓN: Usamos fecha local

  // Usamos la fecha de fin del turno convertida a formato local para filtrar
  const turnosHoy = (panelData.turnos || []).filter(t => (new Date(t.fin || t.inicio).toLocaleDateString("es-MX")) === hoyLocal); 
  
  // Usamos la fecha local guardada en los gastos para filtrar
  const gastosHoy = (panelData.gastos || []).filter(g => (g.fechaLocal || "").split(',')[0].trim() === hoyLocal);

  const horasHoy = turnosHoy.reduce((s, t) => s + (Number(t.horas) || 0), 0);
  const gananciaBrutaHoy = turnosHoy.reduce((s, t) => s + (Number(t.ganancia) || 0), 0);
  const gastosTotalesHoy = gastosHoy.reduce((s, g) => s + (Number(g.cantidad) || 0), 0);
  const netaHoy = gananciaBrutaHoy - gastosTotalesHoy;
  
  // Guardar en calculosExtra (solo los datos de "hoy" para el resumen)
  panelData.calculosExtra = panelData.calculosExtra || {};
  panelData.calculosExtra.totalIngresosDia = gananciaBrutaHoy;
  panelData.calculosExtra.totalGastosDia = gastosTotalesHoy;
  panelData.calculosExtra.balanceDelDia = netaHoy;

  return { horasHoy, gananciaBrutaHoy, gastosTotalesHoy, netaHoy };
}

// ======================
// AGREGACIÓN DE DATOS DIARIOS PARA GRÁFICAS (CORRECCIÓN MAYOR)
// ======================
function aggregateDailyData() {
  const data = {};

  const processEntry = (entry, type, amountKey) => {
    
    // CORRECCIÓN CLAVE: Usar la fecha Local para agrupar
    const rawDate = entry.fechaLocal || (entry.inicio || entry.fin || ""); 
    if (!rawDate) return;

    // Extraer solo la fecha: "DD/MM/YYYY" de la cadena local "DD/MM/YYYY, HH:MM..."
    const localDate = rawDate.split(',')[0].trim();
    
    // Convertir a formato "YYYY-MM-DD" para ordenar correctamente y usar como key
    const parts = localDate.split('/');
    if (parts.length !== 3) return;
    const dateKey = `${parts[2]}-${parts[1]}-${parts[0]}`; 

    data[dateKey] = data[dateKey] || { date: dateKey, ingresos: 0, gastos: 0, kmRecorridos: 0 };
    data[dateKey][type] += (Number(entry[amountKey]) || 0);
  };

  // Se corrige para sumar todos los ingresos
  (panelData.ingresos || []).forEach(t => processEntry(t, 'ingresos', 'cantidad'));
  (panelData.gastos || []).forEach(g => processEntry(g, 'gastos', 'cantidad'));
  (panelData.kmDiarios || []).forEach(k => processEntry(k, 'kmRecorridos', 'recorrido'));

  // Ordenar por fecha (dateKey YYYY-MM-DD)
  return Object.values(data).sort((a, b) => new Date(a.date) - new Date(b.date));
}

// ======================
// AGREGACIÓN DE KM MENSUAL (CORRECCIÓN DE FECHA)
// ======================
function aggregateKmMensual() {
    const dataMensual = {};

    // 1. Agrupar KM por mes
    const processKms = (k) => {
        const localDateParts = (k.fechaLocal || "").split(',')[0].split('/'); // DD/MM/YYYY
        if(localDateParts.length !== 3) return;
        
        const month = localDateParts[1];
        const year = localDateParts[2];
        const mesKey = `${year}-${month}`; // Formato YYYY-MM
        
        dataMensual[mesKey] = dataMensual[mesKey] || { kmRecorridos: 0, costoGasolina: 0 };
        dataMensual[mesKey].kmRecorridos += (Number(k.recorrido) || 0);
    };

    // 2. Sumar el costo de la gasolina por mes
    const processGastos = (g) => {
        if (g.categoria === "Transporte" && g.descripcion.includes("Gasolina")) { 
            const localDateParts = (g.fechaLocal || "").split(',')[0].split('/'); // DD/MM/YYYY
            if(localDateParts.length !== 3) return;
            
            const month = localDateParts[1];
            const year = localDateParts[2];
            const mesKey = `${year}-${month}`; // Formato YYYY-MM
            
            dataMensual[mesKey] = dataMensual[mesKey] || { kmRecorridos: 0, costoGasolina: 0 };
            dataMensual[mesKey].costoGasolina += (Number(g.cantidad) || 0);
        }
    };
    
    (panelData.kmDiarios || []).forEach(processKms);
    (panelData.gastos || []).forEach(processGastos);
    
    const result = Object.values(dataMensual).map(item => {
        item.costoPorKm = item.kmRecorridos > 0 ? item.costoGasolina / item.kmRecorridos : 0;
        return item;
    });

    return result;
}
// ======================
// app.js — PARTE 5/5: RENDERIZADO E INICIALIZACIÓN
// ======================

function renderKmGasolina() {
  if ($("kmInicial") && panelData.parametros.ultimoKMfinal) {
    $("kmInicial").value = panelData.parametros.ultimoKMfinal;
    $("kmFinal").dispatchEvent(new Event('input')); // Actualizar recorrido si es necesario
  }
}

function renderProyeccionAdmin() {
  calcularDeudaTotal();
  calcularGastoFijo();
  
  if ($("proyDeudaTotal")) {
    $("proyDeudaTotal").value = fmtMoney(panelData.parametros.deudaTotal);
    $("proyGastoFijo").value = fmtMoney(panelData.parametros.gastoFijo);
  }

  // Deshabilitar campos si el turno está activo
  const turnoActivo = (panelData.turnos || []).find(t => !t.fin);
  const inpIngreso = $("ingresoCantidad");
  const inpGasto = $("gastoCantidad");

  if (turnoActivo) {
    if (inpIngreso) {
      inpIngreso.readOnly = false;
      inpIngreso.style.background = "white";
    }
    // Permitir registrar gastos y abonos
    if (inpGasto) {
      inpGasto.readOnly = false;
      inpGasto.style.background = "white";
    }
  } else {
    // Si no hay turno activo, deshabilitar ingreso, pero permitir gastos para precargar gasolina/comida.
    if (inpIngreso) {
      inpIngreso.readOnly = true;
      inpIngreso.style.background = "#eee";
    }
  }
}

function renderTablaTurnos() {
  const tbody = $("tablaTurnos");
  if (!tbody) return;

  const arr = (panelData.turnos || []).filter(t => t.fin).sort((a, b) => new Date(b.inicio) - new Date(a.inicio));

  tbody.innerHTML = "";
  arr.forEach(t => {
    // CORRECCIÓN: Mostrar la fecha del inicio del turno en formato local
    const fechaTurnoLocal = new Date(t.inicio || t.fin).toLocaleDateString("es-MX");
    const gananciaNeta = t.ganancia; // Asumiendo que el gasto del turno se calcula en el resumen diario

    tbody.innerHTML += `
      <tr>
        <td>${fechaTurnoLocal}</td>
        <td>${(Number(t.horas) || 0).toFixed(2)}</td>
        <td>$${fmtMoney(t.ganancia)}</td>
        <td>$0.00</td> <td>$${fmtMoney(gananciaNeta)}</td>
      </tr>
    `;
  });
}

let kmChart, gananciasChart;

function renderGraficaGanancias() {
  const datosDiarios = aggregateDailyData();
  const ultimos14Dias = datosDiarios.slice(-14);
  
  // Mapear los datos para la gráfica
  const labels = ultimos14Dias.map(d => {
      // Formatear la clave YYYY-MM-DD a un formato más legible para la gráfica, ej: "MM-DD"
      const parts = d.date.split('-'); 
      return `${parts[1]}-${parts[2]}`; // MM-DD
  });
  const ingresos = ultimos14Dias.map(d => d.ingresos);
  const gastos = ultimos14Dias.map(d => d.gastos);

  // Destruir el gráfico anterior si existe
  if (gananciasChart) {
      gananciasChart.destroy();
  }

  const ctx = $('graficaGanancias');
  if (!ctx) return;

  gananciasChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Ingresos',
          data: ingresos,
          backgroundColor: 'rgba(0, 160, 0, 0.8)',
        },
        {
          label: 'Gastos',
          data: gastos,
          backgroundColor: 'rgba(212, 0, 0, 0.8)',
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });
}


function renderGraficaKm() {
  const datosDiarios = aggregateDailyData();
  const kmData = datosDiarios.map(d => ({ date: d.date, kmRecorridos: d.kmRecorridos }));

  const labels = kmData.map(d => {
      const parts = d.date.split('-'); 
      return `${parts[1]}-${parts[2]}`; // MM-DD
  });
  const kmRecorridos = kmData.map(d => d.kmRecorridos);

  if (kmChart) {
    kmChart.destroy();
  }

  const ctx = $('graficaKm');
  if (!ctx) return;
  
  kmChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'KM Recorridos',
        data: kmRecorridos,
        borderColor: 'rgba(0, 102, 255, 1)',
        backgroundColor: 'rgba(0, 102, 255, 0.2)',
        tension: 0.4,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });
}


function renderTablaKmMensual() {
    const dataMensual = aggregateKmMensual();
    const container = $("tablaKmMensual");
    if (!container) return;

    if (dataMensual.length === 0) {
        container.innerHTML = "<p>No hay datos de KM y Gasolina para mostrar.</p>";
        return;
    }

    // Usar la última entrada para la tabla de resumen
    const ultimaEntrada = dataMensual[dataMensual.length - 1];

    // Formatear el nombre del mes (ej: "11" a "Noviembre")
    const [year, month] = ultimaEntrada.date.split('-');
    const dateForMonthName = new Date(year, month - 1, 1);
    const monthName = dateForMonthName.toLocaleString('es-MX', { month: 'long' });
    const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);

    container.innerHTML = `
        <table class="tabla">
            <thead>
                <tr>
                    <th>Mes</th>
                    <th>KM Recorridos</th>
                    <th>Costo Gasolina</th>
                    <th>Costo por KM</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>${capitalizedMonth} de ${year}</td>
                    <td>${ultimaEntrada.kmRecorridos.toFixed(0)} KM</td>
                    <td>$${fmtMoney(ultimaEntrada.costoGasolina)}</td>
                    <td>$${fmtMoney(ultimaEntrada.costoPorKm)}</td>
                </tr>
            </tbody>
        </table>
    `;
}


function renderResumenIndex() {
  const resumen = calcularResumenDatos();
  
  $("resHoras").textContent = `${resumen.horasHoy.toFixed(2)}h`;
  $("resGananciaBruta").textContent = `$${fmtMoney(resumen.gananciaBrutaHoy)}`;
  $("resGastos").textContent = `$${fmtMoney(resumen.gastosTotalesHoy)}`;
  $("resNeta").textContent = `$${fmtMoney(resumen.netaHoy)}`;

  // Proyección Real
  const promedioHoras = (panelData.turnos || []).reduce((s, t) => s + t.horas, 0) / (panelData.turnos || []).length || 0;
  
  // Usar la ganancia neta del día (la que calcula la app)
  const promedioNeta = (panelData.calculosExtra || {}).balanceDelDia || resumen.netaHoy;

  // Calcular días estimados
  const diasEstimados = panelData.parametros.deudaTotal > 0 && promedioNeta > 0 ? panelData.parametros.deudaTotal / promedioNeta : "N/A (Ganancia Neta 0 o negativa)";

  $("proyDeuda").textContent = `$${fmtMoney(panelData.parametros.deudaTotal)}`;
  $("proyHoras").textContent = `${promedioHoras.toFixed(2)} h`;
  $("proyNeta").textContent = `$${fmtMoney(promedioNeta)}`;
  $("proyDias").textContent = typeof diasEstimados === 'number' ? `${diasEstimados.toFixed(0)} días` : diasEstimados;
  
  // Renderizar tablas y gráficas
  renderTablaTurnos();
  renderTablaKmMensual();
  renderGraficaGanancias();
  renderGraficaKm();
}


document.addEventListener("DOMContentLoaded", () => {
  // Solo en Admin.html
  if (document.title.includes("Administración")) {
    setupIngresoListeners();
    setupGastoListeners();
    setupKmAndGasListeners();
    setupTurnoListeners();
    setupDeudasListeners();
    setupAbonoListeners();
    setupIoListeners();
    renderKmGasolina();
    renderProyeccionAdmin();
  }

  // Solo en index.html
  if (document.title.includes("Resultados")) {
    renderResumenIndex();
  }
});
