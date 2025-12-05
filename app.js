// app.js - Parte 1/5
// Inicialización, constantes, utilidades y migraciones robustas

const STORAGE_KEY = "panelData";
const BACKUP_KEY = "panelData_backup_v1";
const $ = id => document.getElementById(id);
const TUTORIAL_COMPLETADO_KEY = "tutorialCompleto";

let gananciasChart = null;
let kmChart = null;
let deudaWizardStep = 1;

// Estructura base
let panelData = {
  ingresos: [],
  gastos: [],
  kmDiarios: [],
  gasolina: [], // mantenida por compatibilidad, no se usa
  deudas: [],
  movimientos: [], // Colección principal para el Historial (CORREGIDO)
  turnos: [],
  parametros: {
    deudaTotal: 0,
    gastoFijo: 0,
    ultimoKMfinal: null,
    costoPorKm: 0,
    costoMantenimientoPorKm: 0,
    mantenimientoBase: {
      'Aceite (KM)': 3000,
      'Bujía (KM)': 8000,
      'Llantas (KM)': 15000
    }
  }
};

// Estado de turno (guardamos TS como string en localStorage para compat)
let turnoActivo = JSON.parse(localStorage.getItem("turnoActivo")) || false;
let turnoInicio = localStorage.getItem("turnoInicio") || null; // string TS o null

// ---------- UTILIDADES ----------
function safeNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Formatea un número a moneda (ej. 1234.56 -> 1,234.56)
 * @param {number} amount
 * @returns {string}
 */
function fmtMoney(amount) {
    if (amount === undefined || amount === null) return "0.00";
    return safeNumber(amount, 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Calcula la diferencia entre dos timestamps en horas decimales.
 * @param {string} tsInicio - Timestamp de inicio (ISO string).
 * @param {string} tsFin - Timestamp de fin (ISO string).
 * @returns {number} Horas trabajadas (ej. 8.5)
 */
function calcularHorasTrabajadas(tsInicio, tsFin) {
    if (!tsInicio || !tsFin) return 0;
    const inicio = new Date(tsInicio).getTime();
    const fin = new Date(tsFin).getTime();
    const diffMs = fin - inicio;
    if (diffMs <= 0) return 0;
    // (diff en ms) / (1000 ms/s * 60 s/m * 60 m/h)
    return safeNumber(diffMs / 3600000, 0);
}

// Función para obtener la fecha de hoy en formato 'YYYY-MM-DD'
function getTodayDateString() {
    return new Date().toISOString().slice(0, 10);
}

// ===================================
// GESTIÓN DE LOCALSTORAGE Y ESTRUCTURA
// ===================================
// ... (continúa en la parte 2/5)
// app.js - Parte 2/5
// Persistencia de Datos y Lógica de Turno

// ===================================
// GESTIÓN DE LOCALSTORAGE Y ESTRUCTURA
// ===================================

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(panelData));
    localStorage.setItem(BACKUP_KEY, JSON.stringify(panelData));
  } catch (error) {
    console.error("Error al guardar datos:", error);
  }
}

function cargarPanelData() {
  const data = localStorage.getItem(STORAGE_KEY);
  if (data) {
    try {
      panelData = JSON.parse(data);
      // Asegurar que las colecciones existen para evitar errores (Migración ligera)
      panelData.movimientos = panelData.movimientos || [];
      panelData.turnos = panelData.turnos || [];
      panelData.parametros = panelData.parametros || {};
    } catch (error) {
      console.error("Error al parsear datos de localStorage. Usando respaldo.", error);
      cargarRespaldo();
    }
  }
}

function cargarRespaldo() {
  const backup = localStorage.getItem(BACKUP_KEY);
  if (backup) {
    try {
      panelData = JSON.parse(backup);
      console.warn("Datos restaurados desde respaldo.");
    } catch (error) {
      console.error("Error al parsear respaldo. Usando estructura base.", error);
    }
  }
}

// =========================
// LÓGICA DE GESTIÓN DE TURNO (CORREGIDO)
// =========================

function actualizarUIturno() {
  const btnIniciar = $("btnIniciarTurno");
  const btnFinalizar = $("btnFinalizarTurno");
  const labelKmInicial = $("labelKmInicial");
  const labelKmFinal = $("labelKmFinal");
  const labelGananciaBruta = $("labelGananciaBruta");
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
    if (labelKmFinal) labelKmFinal.style.display = 'block';
    if (kmFinalInput) kmFinalInput.style.display = 'block';
    if (labelGananciaBruta) labelGananciaBruta.style.display = 'block';
    if (gananciaBrutaInput) gananciaBrutaInput.style.display = 'block';
    // Ocultar KM inicial (ya está registrado)
    if (labelKmInicial) labelKmInicial.style.display = 'none';
    if (kmInicialInput) kmInicialInput.style.display = 'none';

  } else {
    textoTurno.textContent = '🔴 Sin turno activo';
    btnIniciar.style.display = 'block';
    btnFinalizar.style.display = 'none';
    
    // Ocultar campos de finalización
    if (labelKmFinal) labelKmFinal.style.display = 'none';
    if (kmFinalInput) kmFinalInput.style.display = 'none';
    if (labelGananciaBruta) labelGananciaBruta.style.display = 'none';
    if (gananciaBrutaInput) gananciaBrutaInput.style.display = 'none';
    // Mostrar campo KM inicial para precarga
    if (labelKmInicial) labelKmInicial.style.display = 'block';
    if (kmInicialInput) kmInicialInput.style.display = 'block';
    // Precargar KM inicial (Solo si existe el input)
    if ($("kmInicial") && panelData.parametros.ultimoKMfinal !== null) {
      $("kmInicial").value = safeNumber(panelData.parametros.ultimoKMfinal).toFixed(0);
    }
  }
}

function iniciarTurno() {
  if (turnoActivo) {
    alert("Ya hay un turno activo.");
    return;
  }
  const kmInicial = safeNumber($("kmInicial") ? $("kmInicial").value : 0);

  if (kmInicial <= 0) {
    alert("Debe registrar un KM inicial válido para comenzar el turno.");
    return;
  }

  turnoInicio = new Date().toISOString();
  turnoActivo = true;
  localStorage.setItem("turnoActivo", "true");
  localStorage.setItem("turnoInicio", turnoInicio);
  panelData.parametros.kmInicioTurno = kmInicial; // Guardar KM inicial del turno en parámetros
  saveData();
  actualizarUIturno();
  alert("Turno iniciado con KM: " + kmInicial + ".");
}

function finalizarTurno() {
  if (!turnoActivo || !turnoInicio) {
    alert("No hay un turno activo para finalizar.");
    return;
  }

  const kmFinal = safeNumber($("kmFinal").value);
  const gananciaBruta = safeNumber($("gananciaBruta").value);
  const kmInicial = safeNumber(panelData.parametros.kmInicioTurno);
  const costoPorKm = safeNumber(panelData.parametros.costoPorKm);

  if (kmFinal <= kmInicial || gananciaBruta <= 0) {
    alert("Revise los datos: KM Final debe ser mayor al KM Inicial y la Ganancia Bruta debe ser positiva.");
    return;
  }

  const kmRecorridos = kmFinal - kmInicial;
  const tsFin = new Date().toISOString();
  const horasTrabajadas = calcularHorasTrabajadas(turnoInicio, tsFin);
  const costoOperativo = kmRecorridos * costoPorKm;
  const gananciaNeta = safeNumber(gananciaBruta - costoOperativo);

  // 1. REGISTRAR TURNO EN LA COLECCIÓN 'turnos'
  const nuevoTurno = {
    fecha: tsFin,
    tsInicio: turnoInicio,
    tsFin: tsFin,
    horas: safeNumber(horasTrabajadas, 2),
    kmInicial: kmInicial,
    kmFinal: kmFinal,
    kmRecorridos: kmRecorridos,
    gananciaBruta: gananciaBruta,
    costoOperativo: costoOperativo,
    gananciaNeta: gananciaNeta
  };
  panelData.turnos.unshift(nuevoTurno); // Agregar al inicio

  // 2. CREAR MOVIMIENTOS EN LA COLECCIÓN 'movimientos'
  panelData.movimientos.unshift({
    fecha: tsFin,
    tipo: 'Ingreso (Turno)',
    descripcion: `Ganancia Bruta del Turno (${kmRecorridos} KM)`,
    monto: gananciaBruta
  });

  panelData.movimientos.unshift({
    fecha: tsFin,
    tipo: 'Gasto (Operativo)',
    descripcion: `Costo Operativo Estimado del Turno (${kmRecorridos} KM)`,
    monto: -costoOperativo // Se guarda como negativo
  });

  // 3. ACTUALIZAR PARÁMETROS FINALES
  panelData.parametros.ultimoKMfinal = kmFinal;
  panelData.parametros.kmInicioTurno = null; // Limpiar

  // 4. LIMPIAR ESTADO DE TURNO
  turnoActivo = false;
  turnoInicio = null;
  localStorage.removeItem("turnoActivo");
  localStorage.removeItem("turnoInicio");
  
  // 5. GUARDAR Y ACTUALIZAR UI
  saveData();
  alert(`Turno finalizado. Ganancia Neta: $${fmtMoney(gananciaNeta)}. Horas: ${horasTrabajadas.toFixed(2)}h.`);
  actualizarUIturno();
  renderResumenIndex(); // Actualizar panel si es index
}

// ... (continúa en la parte 3/5)
// app.js - Parte 3/5
// Manejadores de Formularios y Lógica de Datos

// =========================
// MANEJADORES DE FORMULARIOS
// =========================

function handleRegistrarIngreso() {
  const desc = $("ingresoDescripcion").value.trim();
  const monto = safeNumber($("ingresoCantidad").value);

  if (desc === "" || monto <= 0) {
    alert("Debe ingresar una descripción y un monto positivo.");
    return;
  }

  const ingreso = {
    fecha: new Date().toISOString(),
    descripcion: desc,
    monto: monto
  };
  panelData.ingresos.unshift(ingreso);

  // CORREGIDO: Trazabilidad del movimiento para Historial
  panelData.movimientos.unshift({
    fecha: ingreso.fecha,
    tipo: 'Ingreso (Extra)',
    descripcion: desc,
    monto: monto
  });

  saveData();
  renderIngresos(); // Actualiza el total
  alert("Ingreso registrado.");
  $("ingresoDescripcion").value = "";
  $("ingresoCantidad").value = "";
}

function handleRegistrarGasto() {
  const desc = $("gastoDescripcion").value.trim();
  const monto = safeNumber($("gastoCantidad").value);
  const tipo = $("gastoTipo").value; // 'trabajo' o 'fijo'

  if (desc === "" || monto <= 0) {
    alert("Debe ingresar una descripción y un monto positivo.");
    return;
  }

  const gasto = {
    fecha: new Date().toISOString(),
    descripcion: desc,
    monto: monto,
    tipo: tipo
  };
  panelData.gastos.unshift(gasto);

  // CORREGIDO: Trazabilidad del movimiento para Historial
  panelData.movimientos.unshift({
    fecha: gasto.fecha,
    tipo: `Gasto (${tipo === 'fijo' ? 'Fijo/Hogar' : 'Trabajo'})`,
    descripcion: desc,
    monto: -monto // Se guarda como negativo
  });

  saveData();
  renderGastos(); // Actualiza el total
  alert("Gasto registrado.");
  $("gastoDescripcion").value = "";
  $("gastoCantidad").value = "";
}

function handleRegistrarAbono() {
  const deudaId = $("abonoSeleccionar").value;
  const abonoMonto = safeNumber($("abonoMonto").value);

  if (!deudaId || abonoMonto <= 0) {
    alert("Debe seleccionar una deuda y un monto positivo para abonar.");
    return;
  }

  const deuda = panelData.deudas.find(d => d.id === deudaId);
  if (!deuda) {
    alert("Deuda no encontrada.");
    return;
  }

  // CORREGIDO: Implementación de la validación de abono
  const saldoPendiente = deuda.montoTotal - deuda.montoAbonado;
  if (abonoMonto > saldoPendiente) {
    alert(`Error: El abono de $${fmtMoney(abonoMonto)} excede el saldo pendiente de $${fmtMoney(saldoPendiente)}.`);
    return;
  }

  deuda.montoAbonado += abonoMonto;
  deuda.abonos.unshift({
    fecha: new Date().toISOString(),
    monto: abonoMonto
  });

  // CORREGIDO: Trazabilidad del movimiento para Historial
  panelData.movimientos.unshift({
    fecha: new Date().toISOString(),
    tipo: 'Abono Deuda',
    descripcion: `Abono a: ${deuda.descripcion}`,
    monto: -abonoMonto // Se guarda como negativo
  });

  saveData();
  alert(`Abono de $${fmtMoney(abonoMonto)} registrado a ${deuda.descripcion}.`);
  $("abonoMonto").value = "";
  renderDeudas(); // Actualiza la lista de deudas y el dropdown
}

// ... (continúa en la parte 4/5)
// app.js - Parte 4/5
// Métricas, Renderizado y Alertas

// =========================
// FUNCIONES DE RENDERIZADO (INDEX Y ADMIN)
// =========================

// ... (Otras funciones de renderizado como renderDeudas, renderTablaTurnos, etc. se asume que existían)

/**
 * Calcula el kilometraje total acumulado y genera alertas de mantenimiento.
 */
function checkAndRenderAlertas() {
    const cardAlertas = $("cardAlertas");
    const listaAlertas = $("listaAlertas");

    if (!cardAlertas || !listaAlertas) return;

    // 1. Calcular KM Total Acumulado (usando el último KM final conocido)
    const ultimoKMfinal = safeNumber(panelData.parametros.ultimoKMfinal);
    
    // Si no hay KM registrado, ocultar y salir
    if (ultimoKMfinal === 0) {
        cardAlertas.classList.add('hidden');
        return;
    }

    listaAlertas.innerHTML = '';
    let alertasPendientes = false;

    // 2. Iterar sobre los umbrales de mantenimiento
    const mantenimientoBase = panelData.parametros.mantenimientoBase;

    for (const [item, umbral] of Object.entries(mantenimientoBase)) {
        // En un proyecto real, necesitarías la fecha o KM del *último* cambio de cada item
        // Asumiremos por simplicidad que el KM actual (ultimoKMfinal) es el total
        // recorrido desde el inicio/último reset (simulando un odómetro).

        if (ultimoKMfinal >= safeNumber(umbral)) {
            const mensaje = `${item} ha superado o alcanzado el umbral de ${umbral} KM. ¡Mantenimiento necesario!`;
            listaAlertas.innerHTML += `<li>${mensaje}</li>`;
            alertasPendientes = true;
        }
    }

    // 3. Renderizar KM total acumulado en el panel
    if ($("proyKmTotal")) {
        $("proyKmTotal").textContent = `${ultimoKMfinal.toLocaleString('es-MX')} KM`;
    }

    // 4. Mostrar u ocultar la tarjeta de alertas
    if (alertasPendientes) {
        cardAlertas.classList.remove('hidden');
    } else {
        cardAlertas.classList.add('hidden');
    }
}


// =========================
// RENDERIZADO DE HISTORIAL (CORREGIDO)
// =========================

function renderHistorial() {
    const tablaBody = $("historialBody");
    if (!tablaBody) return;

    tablaBody.innerHTML = "";

    // CORREGIDO: Usar panelData.movimientos y ordenar por fecha descendente
    const movimientosOrdenados = panelData.movimientos
        .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    movimientosOrdenados.forEach(mov => {
        const monto = safeNumber(mov.monto);
        const signo = monto >= 0 ? '+' : '';
        const clase = monto >= 0 ? 'color: var(--success); font-weight: 600;' : 'color: var(--danger);';
        
        tablaBody.innerHTML += `
            <tr>
                <td>${mov.tipo}</td>
                <td>${new Date(mov.fecha).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                <td>${mov.descripcion}</td>
                <td style="${clase}">${signo}$${fmtMoney(Math.abs(monto))}</td>
            </tr>
        `;
    });
}


// ... (continúa en la parte 5/5)
// app.js - Parte 5/5
// Listeners e Inicialización

// =========================
// GESTIÓN DE IMPORTACIÓN/EXPORTACIÓN (CORREGIDO)
// =========================

function handleImportJson() {
    const jsonText = $("importJson").value.trim();
    if (!jsonText) {
        alert("Pegue el JSON de respaldo en el área de texto.");
        return;
    }

    try {
        const importedData = JSON.parse(jsonText);
        
        // CORREGIDO: Validación básica para asegurar que es nuestro formato
        if (!importedData || !importedData.parametros || !Array.isArray(importedData.movimientos)) {
            throw new Error("El JSON no tiene la estructura de 'panelData'.");
        }

        if (!confirm("ADVERTENCIA: ¿Está seguro de que desea restaurar los datos? Esto sobrescribirá todos los datos actuales.")) {
            return;
        }

        panelData = importedData;
        
        // Sincronizar estado de turno
        const ultimoTurno = importedData.turnos.length > 0 ? importedData.turnos[0] : null;
        if (ultimoTurno && !ultimoTurno.tsFin) {
            // Si el último turno en el JSON no fue finalizado, lo reactivamos
            turnoActivo = true;
            turnoInicio = ultimoTurno.tsInicio;
            localStorage.setItem("turnoActivo", "true");
            localStorage.setItem("turnoInicio", turnoInicio);
        } else {
            turnoActivo = false;
            turnoInicio = null;
            localStorage.removeItem("turnoActivo");
            localStorage.removeItem("turnoInicio");
        }

        saveData(); // Guardar la data importada
        alert("Datos restaurados correctamente. La página se recargará.");
        window.location.reload();

    } catch (error) {
        console.error("Error al importar JSON:", error);
        alert(`Error al restaurar los datos: ${error.message}`);
    }
}

// ... (Otras funciones de import/export/excel)

// =========================
// SETUP DE LISTENERS
// =========================

function setupIoListeners() {
  if ($("btnImportar")) $("btnImportar").addEventListener("click", handleImportJson); // CORREGIDO
  // ... (otros listeners)
}

function setupIngresoListeners() {
  if ($("btnRegistrarIngreso")) $("btnRegistrarIngreso").addEventListener("click", handleRegistrarIngreso);
}

// ... (Otros setupListeners)

// =========================
// INICIALIZACIÓN GLOBAL (CORREGIDO)
// =========================
function initApp() {
  cargarPanelData();
  const title = (document.title || "").toLowerCase();
  setupIoListeners(); 

  // Páginas de Administración y Turno
  if (title.includes("administración") || title.includes("administracion")) {
    // ... (llamadas a setupListeners)
    setupIngresoListeners(); 
    // ... (otros setupListeners)
    if ($("btnIniciarTurno")) $("btnIniciarTurno").addEventListener("click", iniciarTurno);
    if ($("btnFinalizarTurno")) $("btnFinalizarTurno").addEventListener("click", finalizarTurno);
    
    actualizarUIturno(); 
    // ... (renderizados iniciales)
  }
  
  // Página de Resultados (Panel)
  if (title.includes("resultados") || title.includes("dashboard") || title.includes("panel de resultados")) {
    // ... (renderizados de gráficas y tablas)
    checkAndRenderAlertas(); // NUEVO: Revisar y mostrar alertas
  }

  // Página de Historial (NUEVO)
  if (title.includes("historial")) {
    renderHistorial(); // NUEVO: Renderizar la tabla de movimientos
  }
  
  // Precargar KM inicial (se movió al final para asegurar que se ejecuta después de cargar la data)
  if ($("kmInicial") && panelData.parametros.ultimoKMfinal !== null) {
      $("kmInicial").value = safeNumber(panelData.parametros.ultimoKMfinal).toFixed(0);
  }

  // Si estamos en la página de administración, actualizamos el estado visual del turno inmediatamente
  if (title.includes("administración") || title.includes("administracion")) {
      actualizarUIturno(); 
  }
}

document.addEventListener("DOMContentLoaded", initApp);
