const STORAGE_KEY = "panelData";
const $ = id => document.getElementById(id);
const TUTORIAL_COMPLETADO_KEY = "tutorialCompleto";

// Variables globales para instancias de Chart.js
let gananciasChart = null;
let kmChart = null;

// Global state for Debt Wizard
let deudaWizardStep = 1;

// Estructura base de datos
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
    // Nuevos parámetros para el cálculo acumulado
    costoPorKm: 0, 
    costoMantenimientoPorKm: 0
  }
};

// Estado del turno
let turnoActivo = JSON.parse(localStorage.getItem("turnoActivo")) || false;
let turnoInicio = localStorage.getItem("turnoInicio") || null;

// ======================
// 1. CARGA Y GUARDADO
// ======================
function cargarPanelData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    panelData = { ...panelData, ...parsed };
    // Asegura que los nuevos parámetros se carguen si existen
    panelData.parametros = { ...panelData.parametros, ...(parsed.parametros || {}) };
  } catch (e) {
    console.error("Error al cargar panelData:", e);
  }
}

function guardarPanelData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(panelData));
  } catch (e) {
    console.error("Error guardando panelData:", e);
    alert("Error: No se pudo guardar la información en tu navegador.");
  }
}

function getLocalISODate(date = new Date()) {
    const offset = date.getTimezoneOffset();
    const localTime = new Date(date.getTime() - (offset * 60 * 1000));
    return localTime.toISOString().slice(0, 23).replace('T', ' ');
}

function fmtMoney(amount) {
  return (amount || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

cargarPanelData(); // Carga de datos al iniciar
// ======================
// 2. LISTENERS DE ENTRADA
// ======================
function setupIngresoListeners() {
    $("btnGuardarIngreso")?.addEventListener("click", () => {
        const desc = $("ingresoDescripcion").value.trim();
        const cant = Number($("ingresoCantidad").value);
        if (cant > 0) {
            panelData.ingresos.push({
                descripcion: desc || "Ingreso manual",
                cantidad: cant,
                fechaISO: new Date().toISOString(),
                fechaLocal: new Date().toLocaleString()
            });
            $("ingresoDescripcion").value = "";
            $("ingresoCantidad").value = "";
            guardarPanelData();
            alert("Ingreso guardado.");
            renderResumenIndex(); // Actualiza el panel de resultados
        } else {
            alert("Introduce una cantidad válida.");
        }
    });
}

function setupGastoListeners() {
    $("btnGuardarGasto")?.addEventListener("click", () => {
        const desc = $("gastoDescripcion").value.trim();
        const cant = Number($("gastoCantidad").value);
        const cat = $("gastoCategoria").value;
        if (cant > 0 && cat) {
            panelData.gastos.push({
                descripcion: desc || cat,
                cantidad: cant,
                categoria: cat,
                fechaISO: new Date().toISOString(),
                fechaLocal: new Date().toLocaleString()
            });
            $("gastoDescripcion").value = "";
            $("gastoCantidad").value = "";
            guardarPanelData();
            alert("Gasto guardado.");
            calcularGastoFijoAuto(); // Recalcula el promedio al haber un gasto
            renderResumenIndex(); // Actualiza el panel de resultados
        } else {
            alert("Introduce una cantidad y categoría válidas.");
        }
    });
}

// ======================
// 3. CONTROL DE TURNO
// ======================
function actualizarUIturno() {
    const btnIniciar = $("btnIniciarTurno");
    const btnFinalizar = $("btnFinalizarTurno");
    const texto = $("turnoTexto");

    if (!btnIniciar || !btnFinalizar || !texto) return;

    if (turnoActivo) {
        texto.innerHTML = "🟢 Turno activo. Iniciado el: " + new Date(turnoInicio).toLocaleTimeString();
        btnIniciar.style.display = 'none';
        btnFinalizar.style.display = 'inline-block';
    } else {
        texto.innerHTML = "🔴 Sin turno activo";
        btnIniciar.style.display = 'inline-block';
        btnFinalizar.style.display = 'none';
    }
}

function iniciarTurno() {
    turnoActivo = true;
    turnoInicio = new Date().toISOString();
    localStorage.setItem("turnoActivo", "true");
    localStorage.setItem("turnoInicio", turnoInicio);
    actualizarUIturno();
    alert("Turno iniciado.");
}

function finalizarTurno() {
    if (!turnoActivo || !turnoInicio) return;

    const fin = new Date().toISOString();
    const inicio = new Date(turnoInicio);
    const diffMs = new Date(fin) - inicio;
    const horas = diffMs / (1000 * 60 * 60);

    const gananciaTurno = prompt("Introduce la GANANCIA BRUTA total del turno ($):");
    const ganancia = Number(gananciaTurno) || 0;

    if (ganancia >= 0) {
        // 1. Registrar turno
        panelData.turnos.push({
            inicio: turnoInicio,
            fin: fin,
            horas: horas.toFixed(2),
            ganancia: ganancia
        });

        // 2. Registrar el ingreso del turno (para gráficas y resumen diario)
        panelData.ingresos.push({
            descripcion: `Ganancia turno (${horas.toFixed(2)}h)`,
            cantidad: ganancia,
            fechaISO: fin,
            fechaLocal: new Date(fin).toLocaleString()
        });
        
        // 3. Resetear estado
        turnoActivo = false;
        turnoInicio = null;
        localStorage.removeItem("turnoActivo");
        localStorage.removeItem("turnoInicio");

        guardarPanelData();
        actualizarUIturno();
        renderResumenIndex(); // Actualiza el panel de resultados
        alert(`Turno finalizado. Duración: ${horas.toFixed(2)}h. Ganancia: $${fmtMoney(ganancia)}.`);
    } else {
        alert("Ganancia inválida. El turno no ha sido finalizado.");
    }
}
// ======================
// 4. CONTROL DE DEUDAS
// ======================
function renderDeudas() {
    const ul = $("listaDeudas");
    const select = $("abonoSeleccionar");
    if (!ul || !select) return;

    const deudasPendientes = panelData.deudas.filter(d => !d.liquidada);

    ul.innerHTML = deudasPendientes.map(d => {
        const pendiente = d.monto - d.abonado;
        return `
            <li>
                <strong>${d.nombre}</strong> (${d.frecuencia})<br>
                Total: $${fmtMoney(d.monto)} | Abonado: $${fmtMoney(d.abonado)}<br>
                Pendiente: <strong style="color: #dc3545;">$${fmtMoney(pendiente)}</strong> 
                (Sugerido: $${fmtMoney(d.abonoSugerido)})
            </li>
        `;
    }).join("") || "<li>No hay deudas pendientes.</li>";

    select.innerHTML = deudasPendientes.map(d => 
        `<option value="${d.nombre}">${d.nombre} ($${fmtMoney(d.monto - d.abonado)})</option>`
    ).join("") || "<option value=''>No hay deudas</option>";
}

function setupDeudaListeners() {
    // ... Lógica del Wizard de Deudas (Se omite el detalle por ser largo, pero ya está implementado en tu versión) ...
    // ... y la lógica para registrar abonos.
    
    // Función de registro final del abono (Simplificada)
    $("btnRegistrarAbono")?.addEventListener("click", () => {
        const nombre = $("abonoSeleccionar").value;
        const monto = Number($("abonoMonto").value);

        if (nombre && monto > 0) {
            const deuda = panelData.deudas.find(d => d.nombre === nombre);
            if (deuda) {
                deuda.abonado += monto;
                if (deuda.abonado >= deuda.monto) {
                    deuda.liquidada = true;
                }
                
                // Registrar abono como GASTO (categoría Abono a Deuda)
                panelData.gastos.push({
                    descripcion: `Abono a ${nombre}`,
                    cantidad: monto,
                    categoria: "Abono a Deuda",
                    fechaISO: new Date().toISOString(),
                    fechaLocal: new Date().toLocaleString()
                });
                
                $("abonoMonto").value = "";
                guardarPanelData();
                calcularDeudaTotalAuto();
                renderDeudas();
                renderResumenIndex();
                alert(`Abono de $${fmtMoney(monto)} registrado a ${nombre}.`);
            }
        } else {
            alert("Selecciona una deuda y un monto válido.");
        }
    });
}

// ======================
// 5. KM y GASOLINA
// ======================
function setupKmAndGasListeners() {
    // KM
    const kmInicialInput = $("kmInicial");
    const kmFinalInput = $("kmFinal");
    const kmRecorridosSpan = $("kmRecorridos");

    if (kmInicialInput && kmFinalInput && kmRecorridosSpan) {
        const updateRecorridos = () => {
            const kmInicial = Number(kmInicialInput.value);
            const kmFinal = Number(kmFinalInput.value);
            const recorridos = kmFinal - kmInicial;
            kmRecorridosSpan.textContent = recorridos >= 0 ? recorridos.toFixed(0) : "0";
        };
        kmInicialInput.addEventListener("input", updateRecorridos);
        kmFinalInput.addEventListener("input", updateRecorridos);

        $("btnGuardarKm")?.addEventListener("click", () => {
            const kmInicial = Number(kmInicialInput.value);
            const kmFinal = Number(kmFinalInput.value);
            const recorrido = kmFinal - kmInicial;
            
            if (recorrido > 0) {
                panelData.kmDiarios.push({
                    fechaISO: new Date().toISOString(),
                    recorrido: recorrido,
                    inicial: kmInicial,
                    final: kmFinal
                });
                panelData.parametros.ultimoKMfinal = kmFinal;

                kmInicialInput.value = kmFinal;
                kmFinalInput.value = "";
                kmRecorridosSpan.textContent = "0";

                guardarPanelData();
                calcularGastoFijoAuto(); // Recalcula el promedio
                renderResumenIndex();
                alert(`Registro de ${recorrido.toFixed(0)} KM guardado.`);
            } else {
                alert("KM Final debe ser mayor que KM Inicial.");
            }
        });
    }

    // GASOLINA
    $("btnGuardarGas")?.addEventListener("click", () => {
        const litros = Number($("litrosGas").value);
        const costo = Number($("costoGas").value);
        
        if (litros > 0 && costo > 0) {
            
            // 1. Registrar como GASTO
            panelData.gastos.push({
                descripcion: `Gasolina ${litros.toFixed(2)}L`,
                cantidad: costo,
                categoria: "Transporte",
                fechaISO: new Date().toISOString(),
                fechaLocal: new Date().toLocaleString()
            });

            // 2. Registrar en historial de gasolina (opcional, para referencia)
            panelData.gasolina.push({
                fechaISO: new Date().toISOString(),
                litros: litros,
                costo: costo
            });

            $("litrosGas").value = "";
            $("costoGas").value = "";
            
            guardarPanelData();
            calcularGastoFijoAuto(); // Recalcula el promedio al haber un gasto
            renderResumenIndex();
            alert(`Carga de $${fmtMoney(costo)} por ${litros.toFixed(2)}L guardada.`);
        } else {
            alert("Introduce valores válidos.");
        }
    });
}

// ======================
// 6. IO / RESPALDO
// ======================
function setupIoListeners() {
    // ... Lógica de Exportar/Importar (JSON y Excel)
}
// ======================
// 6. CÁLCULOS AUTOMÁTICOS (Modificado para usar datos acumulados)
// ======================
function calcularDeudaTotalAuto() {
    const totalDeuda = panelData.deudas.reduce((sum, d) => {
        const pendiente = d.monto - d.abonado;
        return sum + (d.liquidada ? 0 : pendiente);
    }, 0);
    panelData.parametros.deudaTotal = totalDeuda;
    if ($("proyDeudaTotal")) $("proyDeudaTotal").value = `$${fmtMoney(totalDeuda)}`;
    guardarPanelData();
}

function calcularGastoFijoAuto() {
    // 1. Calcular KM acumulados
    const totalKm = (panelData.kmDiarios || []).reduce((sum, k) => sum + (Number(k.recorrido) || 0), 0);
    
    // 2. Acumular costos (Gasolina y Mantenimiento)
    let totalCostoGas = 0;
    let totalCostoMantenimiento = 0;
    let totalGastosComida = 0;

    (panelData.gastos || []).forEach(g => {
        const costo = Number(g.cantidad) || 0;
        if (g.categoria === "Transporte" && g.descripcion.toLowerCase().includes("gasolina")) {
            totalCostoGas += costo;
        } else if (g.categoria === "Mantenimiento") {
            totalCostoMantenimiento += costo;
        } else if (g.categoria === "Comida") {
            totalGastosComida += costo;
        }
    });

    // 3. Calcular Costo por Kilómetro (Gasolina y Mantenimiento)
    let costoPorKmReal = 0;
    let costoMantenimientoPorKm = 0;
    
    if (totalKm > 0) {
        costoPorKmReal = totalCostoGas / totalKm;
        costoMantenimientoPorKm = totalCostoMantenimiento / totalKm;
    }

    // 4. Calcular Gasto Fijo Diario (Promedio)
    
    // Días trabajados es la clave para promediar los gastos diarios (usamos ingresos como proxy)
    const diasTrabajados = new Set(panelData.ingresos.map(i => i.fechaISO.slice(0, 10))).size || 1;
    
    // Promedio diario de los 3 principales gastos
    const gastoDiarioComida = totalGastosComida / diasTrabajados;
    const gastoDiarioGas = totalCostoGas / diasTrabajados;
    const gastoDiarioMant = totalCostoMantenimiento / diasTrabajados;
    
    const gastoFijo = gastoDiarioComida + gastoDiarioGas + gastoDiarioMant;

    // 5. Actualizar Parámetros
    panelData.parametros.gastoFijo = gastoFijo;
    panelData.parametros.costoPorKm = costoPorKmReal; 
    panelData.parametros.costoMantenimientoPorKm = costoMantenimientoPorKm;
    
    // 6. Renderizar en la UI (en admin.html)
    if ($("proyGastoFijo")) $("proyGastoFijo").value = `$${gastoFijo.toFixed(2)}`;
    
    guardarPanelData();
}
// ======================
// 7. RENDERIZADO (INDEX)
// ======================
function calcularResumenDatos() {
  // Obtenemos fecha ISO local YYYY-MM-DD
  const hoy = getLocalISODate().slice(0, 10);

  // Filtramos todos los ingresos y gastos del día
  const ingresosHoy = (panelData.ingresos || []).filter(i => (i.fechaISO || "").startsWith(hoy));
  const gastosHoy = (panelData.gastos || []).filter(g => (g.fechaISO || "").startsWith(hoy));
  
  // Para las horas, seguimos usando los turnos
  const turnosHoy = (panelData.turnos || []).filter(t => (t.inicio || "").startsWith(hoy));

  const horasHoy = turnosHoy.reduce((s, t) => s + (Number(t.horas) || 0), 0);
  const ganHoy   = ingresosHoy.reduce((s, i) => s + (Number(i.cantidad) || 0), 0);
  const gastHoy  = gastosHoy.reduce((s, g) => s + (Number(g.cantidad) || 0), 0);

  return { horasHoy, ganHoy, gastHoy };
}

function aggregateDailyData() {
  const data = {};

  const process = (entry, type, keyMonto) => {
    let fecha = entry.fechaISO || entry.inicio;
    if(!fecha) return;
    const dia = fecha.slice(0, 10);

    if (!data[dia]) data[dia] = { date: dia, ingresos: 0, gastos: 0, km: 0 };
    data[dia][type] += (Number(entry[keyMonto]) || 0);
  };
  
  (panelData.ingresos || []).forEach(i => process(i, 'ingresos', 'cantidad'));
  (panelData.gastos || []).forEach(g => process(g, 'gastos', 'cantidad'));
  (panelData.kmDiarios || []).forEach(k => process(k, 'km', 'recorrido'));

  return Object.values(data).sort((a, b) => a.date.localeCompare(b.date));
}

function renderTablaKmMensual() {
    const container = $("tablaKmMensual"); 
    if (!container) return;

    const stats = {};

    // Agrupar KM
    (panelData.kmDiarios || []).forEach(k => {
        const mes = (k.fechaISO || "").slice(0, 7); // YYYY-MM
        if (!mes) return;
        if (!stats[mes]) stats[mes] = { km: 0, gas: 0 };
        stats[mes].km += (Number(k.recorrido) || 0);
    });

    // Agrupar Gasolina 
    (panelData.gastos || []).forEach(g => {
        if (g.categoria === "Transporte" && g.descripcion.toLowerCase().includes("gasolina")) { 
            const mes = (g.fechaISO || "").slice(0, 7);
            if (!mes) return;
            if (!stats[mes]) stats[mes] = { km: 0, gas: 0 };
            stats[mes].gas += (Number(g.cantidad) || 0);
        }
    });

    const rows = Object.entries(stats)
        .sort((a,b) => b[0].localeCompare(a[0])) 
        .map(([mes, d]) => {
            const costoKm = d.km > 0 ? d.gas / d.km : 0;
            return `
                <tr>
                    <td>${mes}</td>
                    <td>${d.km.toFixed(0)} km</td>
                    <td>$${fmtMoney(d.gas)}</td>
                    <td>$${costoKm.toFixed(2)}</td>
                </tr>`;
        }).join("");

    container.innerHTML = `
        <table class="tabla">
            <thead><tr><th>Mes</th><th>KM</th><th>Gasolina</th><th>$/KM</th></tr></thead>
            <tbody>${rows || '<tr><td colspan="4" style="text-align:center">Sin datos</td></tr>'}</tbody>
        </table>`;
}

function renderTablaTurnos() {
  const tbody = $("tablaTurnos");
  if (!tbody) return;

  const ultimos = [...(panelData.turnos || [])].reverse().slice(0, 10); 

  tbody.innerHTML = ultimos.map(t => {
      const fecha = (t.inicio || "").slice(0, 10);
      return `
        <tr>
            <td>${fecha}</td>
            <td>${Number(t.horas).toFixed(1)}h</td>
            <td>$${fmtMoney(t.ganancia)}</td>
        </tr>
      `;
  }).join("") || `<tr><td colspan="3" style="text-align:center">No hay turnos recientes</td></tr>`;
}

function renderCharts() {
  // ... Lógica de gráficas ...
}

function renderProyecciones() {
    const p = panelData.parametros;
    if ($("proyDeuda")) $("proyDeuda").textContent = `$${fmtMoney(p.deudaTotal)}`;
    
    // Calcular promedio neto diario real
    const totalGan = panelData.ingresos.reduce((s,i) => s + (i.cantidad||0), 0);
    const totalGast = panelData.gastos.reduce((s,i) => s + (i.cantidad||0), 0); 
    const diasTrabajados = new Set(panelData.ingresos.map(i => i.fechaISO.slice(0,10))).size || 1;
    
    // Promedio neto = (Ingreso Total - Gasto Total) / Días trabajados
    const netoDiario = (totalGan - totalGast) / diasTrabajados; 
    
    if ($("proyNeta")) $("proyNeta").textContent = `$${fmtMoney(netoDiario)}`;
    
    if ($("proyDias")) {
        if(netoDiario <= 0) {
             $("proyDias").textContent = "Infinito (Mejora tus ingresos)";
        } else {
             const dias = Math.ceil(p.deudaTotal / netoDiario);
             $("proyDias").textContent = `${dias} días aprox.`;
        }
    }
    
    // LÓGICA PARA RENDIMIENTO DEL VEHÍCULO (NUEVA SECCIÓN)
    if ($("proyCostoGasKm")) $("proyCostoGasKm").textContent = `$${p.costoPorKm.toFixed(4)}`;
    if ($("proyCostoMantKm")) $("proyCostoMantKm").textContent = `$${p.costoMantenimientoPorKm.toFixed(4)}`;
    
    const costoTotalKm = (p.costoPorKm || 0) + (p.costoMantenimientoPorKm || 0);
    if ($("proyCostoTotalKm")) $("proyCostoTotalKm").textContent = `$${costoTotalKm.toFixed(4)}`;
}

function renderResumenIndex() {
  if (!$("resHoras")) return; 

  const r = calcularResumenDatos();
  $("resHoras").textContent = r.horasHoy.toFixed(2);
  $("resGananciaBruta").textContent = `$${fmtMoney(r.ganHoy)}`;
  $("resGastos").textContent = `$${fmtMoney(r.gastHoy)}`;
  $("resNeta").textContent = `$${fmtMoney(r.ganHoy - r.gastHoy)}`;

  renderTablaTurnos();
  renderTablaKmMensual(); 
  renderCharts();
  renderProyecciones();
}

// ======================
// 8. TUTORIAL
// ======================
// ... (Lógica de tutorial, no se modifica)

// ======================
// 9. INIT
// ======================
document.addEventListener("DOMContentLoaded", () => {
    setupIngresoListeners();
    setupGastoListeners();
    setupDeudaListeners();
    setupKmAndGasListeners();
    setupIoListeners();

    $("btnIniciarTurno")?.addEventListener("click", iniciarTurno);
    $("btnFinalizarTurno")?.addEventListener("click", finalizarTurno);

    actualizarUIturno();
    renderDeudas();
    
    // Iniciar vista del wizard de deudas
    // La función debe estar definida en la Parte 3 si usas el wizard
    // updateDeudaWizardUI(); 

    // Cargar parámetros en UI
    calcularDeudaTotalAuto();
    calcularGastoFijoAuto();

    // Rellenar KM inicial si existe historial
    if ($("kmInicial") && panelData.parametros.ultimoKMfinal !== null) {
        $("kmInicial").value = panelData.parametros.ultimoKMfinal;
    }

    // Renderizar dashboard si estamos en index
    renderResumenIndex();

    // Iniciar tutorial
    // initTutorial();
});
