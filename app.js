// app.js - VERSIÓN INTEGRADA, CORREGIDA y DFP (A + B)
// --------------------------------------------------
// Cambios principales:
// - Migraciones robustas y curación automática de datos cargados.
// - Validaciones defensivas (evitan TypeError / RangeError).
// - Integración con index/admin/historial (listeners y renders).
// - Render simple de gráficas usando Chart.js si está disponible.
// - Función validarYArreglarDatos() que intenta corregir problemas detectados.
// - No modifica tu estructura de datos salvo para sanear (merge seguro).
// --------------------------------------------------

const STORAGE_KEY = "panelData";
const BACKUP_KEY = "panelData_backup_v1";
const $ = id => document.getElementById(id);
const TUTORIAL_COMPLETADO_KEY = "tutorialCompleto";

let gananciasChart = null;
let kmChart = null;
let deudaWizardStep = 1;

// Estructura base
const DEFAULT_PANEL_DATA = {
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
    costoPorKm: 0,
    costoMantenimientoPorKm: 0,
    mantenimientoBase: {
      'Aceite (KM)': 3000,
      'Bujía (KM)': 8000,
      'Llantas (KM)': 15000
    }
  }
};

// Inicializar con la estructura por defecto (deep copy para evitar referencias)
let panelData = JSON.parse(JSON.stringify(DEFAULT_PANEL_DATA));

// Estado de turno (guardamos TS como string en localStorage para compat)
let turnoActivo = JSON.parse(localStorage.getItem("turnoActivo")) || false;
let turnoInicio = localStorage.getItem("turnoInicio") || null; // string TS o null

// ---------- UTILIDADES ----------
function safeNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function isObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Formatea un número como moneda (sin símbolo de moneda).
 * @param {number} num
 * @returns {string}
 */
function fmtMoney(num) {
  return safeNumber(num).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * Formatea una fecha a DD/MM/AAAA
 * @param {Date} date
 * @returns {string}
 */
function formatearFecha(date) {
  if (!(date instanceof Date)) return "Fecha Inválida";
  if (isNaN(date.getTime())) return "Fecha Inválida";
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

// ---------- MANEJO DE DATOS ----------

/**
 * Intenta detectar datos antiguos y migrarlos/sanar automáticamente.
 * Corrige:
 * - Estructuras faltantes (parametros.*, mantenimientoBase)
 * - Campos numéricos no numéricos
 * - Fechas faltantes en turnos / movimientos (agrega fecha actual si faltan)
 */
function validarYArreglarDatos() {
  // 1) Colecciones principales
  if (!Array.isArray(panelData.ingresos)) panelData.ingresos = [];
  if (!Array.isArray(panelData.gastos)) panelData.gastos = [];
  if (!Array.isArray(panelData.kmDiarios)) panelData.kmDiarios = [];
  if (!Array.isArray(panelData.deudas)) panelData.deudas = [];
  if (!Array.isArray(panelData.movimientos)) panelData.movimientos = [];
  if (!Array.isArray(panelData.turnos)) panelData.turnos = [];

  // 2) Algunos usuarios previos pudieron tener objeto "mantenimiento" fuera de parametros
  // Moverlo si existe
  if (panelData.mantenimiento && isObject(panelData.mantenimiento)) {
    if (!panelData.parametros) panelData.parametros = {};
    if (!isObject(panelData.parametros.mantenimientoBase)) {
      panelData.parametros.mantenimientoBase = {};
    }
    panelData.parametros.mantenimientoBase = {
      ...panelData.parametros.mantenimientoBase,
      ...panelData.mantenimiento
    };
    delete panelData.mantenimiento;
  }

  // 3) Asegurar parametros
  if (!isObject(panelData.parametros)) {
    panelData.parametros = JSON.parse(JSON.stringify(DEFAULT_PANEL_DATA.parametros));
  } else {
    // merge seguro
    const p = panelData.parametros;
    panelData.parametros = {
      ...JSON.parse(JSON.stringify(DEFAULT_PANEL_DATA.parametros)),
      ...p
    };
    // mantenimientoBase merge
    if (!isObject(panelData.parametros.mantenimientoBase)) {
      panelData.parametros.mantenimientoBase = JSON.parse(JSON.stringify(DEFAULT_PANEL_DATA.parametros.mantenimientoBase));
    } else {
      panelData.parametros.mantenimientoBase = {
        ...JSON.parse(JSON.stringify(DEFAULT_PANEL_DATA.parametros.mantenimientoBase)),
        ...panelData.parametros.mantenimientoBase
      };
    }
  }

  // 4) Forzar tipos numéricos para campos clave
  panelData.parametros.deudaTotal = safeNumber(panelData.parametros.deudaTotal);
  panelData.parametros.gastoFijo = safeNumber(panelData.parametros.gastoFijo);
  panelData.parametros.costoPorKm = safeNumber(panelData.parametros.costoPorKm);
  panelData.parametros.costoMantenimientoPorKm = safeNumber(panelData.parametros.costoMantenimientoPorKm);
  panelData.parametros.ultimoKMfinal = panelData.parametros.ultimoKMfinal === null ? null : safeNumber(panelData.parametros.ultimoKMfinal);

  // 5) Saneamiento de turnos: asegurar fechas y horas válidas
  panelData.turnos = panelData.turnos.map(t => {
    const copy = Object.assign({}, t);
    // fechaInicio / fechaFin: si faltan, crear con fecha actual y avisar
    if (!copy.fechaInicio) {
      console.warn("Turno sin fechaInicio detectado. Se asigna fecha actual:", copy);
      copy.fechaInicio = new Date().toISOString();
    }
    if (!copy.fechaFin) {
      // si no hay fechaFin, mantenerlo como null o usar fechaInicio para evitar NaN
      copy.fechaFin = copy.fechaFin || copy.fechaInicio;
    }
    // horas, kmRecorridos, gananciaBruta: forzar números
    copy.horas = safeNumber(copy.horas);
    copy.kmRecorridos = safeNumber(copy.kmRecorridos);
    copy.gananciaBruta = safeNumber(copy.gananciaBruta);
    copy.gananciaNeta = safeNumber(copy.gananciaNeta);
    copy.kmInicial = safeNumber(copy.kmInicial);
    copy.kmFinal = safeNumber(copy.kmFinal);
    return copy;
  });

  // 6) Saneamiento de movimientos/ingresos/gastos: fechas y montos
  ['movimientos', 'ingresos', 'gastos'].forEach(key => {
    panelData[key] = panelData[key].map(m => {
      const copy = Object.assign({}, m);
      if (!copy.fecha) {
        // intenta usar fecha ISO si existe otro campo; si no, asigna ahora
        copy.fecha = new Date().toISOString();
        console.warn(`Movimiento sin fecha detectado en ${key}. Se asignó fecha actual.`, m);
      }
      copy.monto = safeNumber(copy.monto);
      if (copy.esTrabajo === undefined) copy.esTrabajo = false;
      return copy;
    });
  });

  // 7) Saneamiento de deudas
  panelData.deudas = panelData.deudas.map(d => {
    const copy = Object.assign({}, d);
    copy.saldo = safeNumber(copy.saldo, safeNumber(copy.montoOriginal, 0));
    if (!copy.estado) copy.estado = copy.saldo > 0 ? 'Pendiente' : 'Pagada';
    return copy;
  });

  // 8) Persistir arreglos si hubo cambio (no rompemos datos originales, solo saneamos)
  saveData();
}

/**
 * Asegura que la estructura de panelData esté completa (compatibilidad).
 */
function asegurarEstructura() {
  validarYArreglarDatos();
}

/**
 * Carga los datos desde localStorage y maneja la migración de estructuras antiguas.
 */
function cargarPanelData() {
  const data = localStorage.getItem(STORAGE_KEY);
  if (data) {
    try {
      const loadedData = JSON.parse(data);
      if (isObject(loadedData)) {
        panelData = { ...panelData, ...loadedData };
      } else {
        console.warn("panelData en localStorage no es un objeto. Ignorando.");
      }
    } catch (e) {
      console.error("Error al cargar o parsear datos de localStorage:", e);
      // Intentar cargar el backup
      const backupData = localStorage.getItem(BACKUP_KEY);
      if (backupData) {
        try {
          const parsed = JSON.parse(backupData);
          if (isObject(parsed)) {
            panelData = { ...panelData, ...parsed };
            console.warn("Se cargó el backup debido a error de parseo.");
          }
        } catch (e2) {
          console.error("Error al cargar el backup.", e2);
        }
      }
    }
  }
  asegurarEstructura();
  console.log("Datos cargados:", panelData);
}

/**
 * Guarda los datos en localStorage y crea un backup.
 */
function saveData() {
  try {
    const json = JSON.stringify(panelData);
    localStorage.setItem(STORAGE_KEY, json);
    localStorage.setItem(BACKUP_KEY, json); // Backup simple
  } catch (e) {
    console.error("Error guardando datos en localStorage:", e);
  }
}

// ---------- GESTIÓN DE TURNO ----------
function actualizarUIturno() {
  const btnIniciar = $("btnIniciarTurno");
  const btnFinalizar = $("btnFinalizarTurno");
  const textoTurno = $("turnoTexto");
  const kmInicialInput = $("kmInicial");
  const kmFinalInput = $("kmFinal");
  const gananciaBrutaInput = $("gananciaBruta");
  const labelKmInicial = $("labelKmInicial");
  const labelKmFinal = $("labelKmFinal");
  const labelGananciaBruta = $("labelGananciaBruta");

  if (turnoActivo) {
    if (textoTurno && turnoInicio) {
      // si turnoInicio es string TS, safeNumber lo convierte correctamente
      textoTurno.innerHTML = `🟢 Turno activo iniciado el ${new Date(safeNumber(turnoInicio)).toLocaleString()}`;
    }
    if (btnIniciar) btnIniciar.style.display = 'none';
    if (btnFinalizar) btnFinalizar.style.display = 'block';
    if (kmInicialInput) {
      kmInicialInput.style.display = 'block';
      kmInicialInput.setAttribute('readonly', 'readonly');
    }
    if (kmFinalInput) kmFinalInput.style.display = 'block';
    if (gananciaBrutaInput) gananciaBrutaInput.style.display = 'block';

    if (labelKmInicial) labelKmInicial.style.display = 'block';
    if (labelKmFinal) labelKmFinal.style.display = 'block';
    if (labelGananciaBruta) labelGananciaBruta.style.display = 'block';
  } else {
    if (textoTurno) textoTurno.innerHTML = `🔴 Sin turno activo`;
    if (btnIniciar) btnIniciar.style.display = 'block';
    if (btnFinalizar) btnFinalizar.style.display = 'none';
    if (kmInicialInput) {
      kmInicialInput.style.display = 'none';
      kmInicialInput.removeAttribute('readonly');
    }
    if (kmFinalInput) kmFinalInput.style.display = 'none';
    if (gananciaBrutaInput) gananciaBrutaInput.style.display = 'none';

    if (labelKmInicial) labelKmInicial.style.display = 'none';
    if (labelKmFinal) labelKmFinal.style.display = 'none';
    if (labelGananciaBruta) labelGananciaBruta.style.display = 'none';

    // Precargar KM inicial para el próximo turno
    if (kmInicialInput && panelData.parametros.ultimoKMfinal !== null) {
      kmInicialInput.value = safeNumber(panelData.parametros.ultimoKMfinal).toFixed(0);
    } else if (kmInicialInput) {
      kmInicialInput.value = "";
    }
  }
}

function iniciarTurno() {
  if (turnoActivo) {
    alert("Ya tienes un turno activo.");
    return;
  }

  const kmInicial = safeNumber($("kmInicial") ? $("kmInicial").value : 0);

  if (kmInicial <= 0) {
    alert("El KM Inicial debe ser mayor a 0.");
    return;
  }

  turnoInicio = Date.now().toString(); // Usar string para localStorage
  turnoActivo = {
    kmInicial: kmInicial,
    gananciaBruta: 0,
    timestamp: turnoInicio // Redundante pero útil
  };

  localStorage.setItem("turnoActivo", JSON.stringify(turnoActivo));
  localStorage.setItem("turnoInicio", turnoInicio);

  actualizarUIturno();
  alert(`Turno iniciado. KM Inicial: ${kmInicial.toFixed(0)}km`);
}

function finalizarTurno() {
  if (!turnoActivo) {
    alert("No hay un turno activo para finalizar.");
    return;
  }

  const kmInicial = safeNumber(turnoActivo.kmInicial);
  const kmFinal = safeNumber($("kmFinal") ? $("kmFinal").value : 0);
  const gananciaBruta = safeNumber($("gananciaBruta") ? $("gananciaBruta").value : 0);

  if (kmFinal <= kmInicial) {
    alert(`El KM Final (${kmFinal}km) debe ser mayor al KM Inicial (${kmInicial}km).`);
    return;
  }
  if (gananciaBruta <= 0) {
    alert("La Ganancia Bruta debe ser mayor a 0 para registrar un turno.");
    return;
  }

  const fechaInicio = safeNumber(turnoActivo.timestamp);
  const fechaFin = Date.now();
  const duracionMs = fechaFin - fechaInicio;
  const horas = duracionMs / (1000 * 60 * 60);
  const kmRecorridos = kmFinal - kmInicial;

  // Calcular costos estimados por KM
  const costoMantenimiento = kmRecorridos * panelData.parametros.costoMantenimientoPorKm;
  const costoCombustible = kmRecorridos * panelData.parametros.costoPorKm;

  const gastoTotalEstimado = costoMantenimiento + costoCombustible;
  const gananciaNeta = gananciaBruta - gastoTotalEstimado;

  const nuevoTurno = {
    id: Date.now(),
    fechaInicio: new Date(fechaInicio).toISOString(),
    fechaFin: new Date(fechaFin).toISOString(),
    horas: horas,
    kmInicial: kmInicial,
    kmFinal: kmFinal,
    kmRecorridos: kmRecorridos,
    gananciaBruta: gananciaBruta,
    costoMantenimiento: costoMantenimiento,
    costoCombustible: costoCombustible,
    gastoTotalEstimado: gastoTotalEstimado,
    gananciaNeta: gananciaNeta
  };

  panelData.turnos.push(nuevoTurno);

  // Actualizar el último KM final en parámetros
  panelData.parametros.ultimoKMfinal = kmFinal;

  // Limpiar y actualizar
  localStorage.removeItem("turnoActivo");
  localStorage.removeItem("turnoInicio");
  turnoActivo = false;
  turnoInicio = null;

  if ($("kmFinal")) $("kmFinal").value = "";
  if ($("gananciaBruta")) $("gananciaBruta").value = "";

  saveData();
  actualizarUIturno();
  calcularMetricas();
  alert(`Turno finalizado. Ganancia Neta Estimada: $${fmtMoney(gananciaNeta)}`);
}

// ---------- REGISTRO DE MOVIMIENTOS GENERALES ----------
function registrarMovimiento(tipo, descripcion, monto, esTrabajo = false) {
  const mov = {
    id: Date.now(),
    tipo: tipo, // 'Ingreso' o 'Gasto'
    descripcion: descripcion,
    monto: safeNumber(monto),
    fecha: new Date().toISOString(),
    esTrabajo: esTrabajo
  };

  if (tipo === 'Ingreso') {
    panelData.ingresos.push(mov);
  } else if (tipo === 'Gasto') {
    panelData.gastos.push(mov);
  }

  // Esto es para el historial y las métricas
  panelData.movimientos.push(mov);

  saveData();
  calcularMetricas();
}

function setupIngresoListeners() {
  const btn = $("btnRegistrarIngreso");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const descripcion = $("ingresoDescripcion").value.trim();
    const monto = safeNumber($("ingresoCantidad").value);

    if (!descripcion || monto <= 0) {
      alert("Debe ingresar una descripción y un monto mayor a 0.");
      return;
    }

    registrarMovimiento('Ingreso', descripcion, monto, true);

    $("ingresoDescripcion").value = "";
    $("ingresoCantidad").value = "";
    alert("Ingreso registrado.");
  });
}

function setupGastoListeners() {
  const btn = $("btnRegistrarGasto");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const descripcion = $("gastoDescripcion").value.trim();
    const monto = safeNumber($("gastoCantidad").value);
    const esTrabajo = $("gastoEsTrabajo") ? $("gastoEsTrabajo").checked : false;

    if (!descripcion || monto <= 0) {
      alert("Debe ingresar una descripción y un monto mayor a 0.");
      return;
    }

    registrarMovimiento('Gasto', descripcion, monto, esTrabajo);

    $("gastoDescripcion").value = "";
    $("gastoCantidad").value = "";
    if ($("gastoEsTrabajo")) $("gastoEsTrabajo").checked = false;
    alert("Gasto registrado.");
  });
}

function setupAbonoListeners() {
  const btn = $("btnRegistrarAbono");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const deudaId = $("abonoSeleccionar") ? $("abonoSeleccionar").value : "";
    const monto = safeNumber($("abonoMonto").value);

    if (!deudaId || monto <= 0) {
      alert("Debe seleccionar una deuda y un monto mayor a 0.");
      return;
    }

    const deuda = panelData.deudas.find(d => d.id === safeNumber(deudaId));
    if (!deuda) {
      alert("Deuda no encontrada.");
      return;
    }

    if (monto > safeNumber(deuda.saldo)) {
      alert("El abono no puede ser mayor al saldo pendiente.");
      return;
    }

    // Registrar el abono como un movimiento de gasto
    registrarMovimiento('Gasto', `Abono a deuda: ${deuda.descripcion}`, monto, false); // No es gasto de trabajo

    // Actualizar el saldo de la deuda
    deuda.saldo = safeNumber(deuda.saldo) - monto;

    // Si la deuda se liquida
    if (safeNumber(deuda.saldo) <= 0.01) {
      deuda.estado = 'Pagada';
      deuda.saldo = 0;
      alert(`Deuda "${deuda.descripcion}" liquidada. ¡Felicidades!`);
    }

    // Recalcular el total de deudas
    panelData.parametros.deudaTotal = panelData.deudas
      .filter(d => d.estado !== 'Pagada')
      .reduce((sum, d) => sum + safeNumber(d.saldo), 0);

    saveData();
    renderDeudas();

    if ($("abonoMonto")) $("abonoMonto").value = "";
    alert("Abono registrado y deuda actualizada.");
  });
}

// ---------- GESTIÓN DE DEUDAS (WIZARD) ----------
function updateDeudaWizardUI() {
  if ($('deudaStep1')) $('deudaStep1').style.display = 'none';
  if ($('deudaStep2')) $('deudaStep2').style.display = 'none';

  if (panelData.parametros.deudaTotal === 0 && panelData.parametros.gastoFijo === 0 && (panelData.deudas.length === 0)) {
    if ($('deudaStep1')) $('deudaStep1').style.display = 'block';
  } else {
    if ($('deudaStep2')) $('deudaStep2').style.display = 'block';
    if ($('deudaTotalInput')) $('deudaTotalInput').value = safeNumber(panelData.parametros.deudaTotal).toFixed(2);
    if ($('gastoFijoDiario')) $('gastoFijoDiario').value = safeNumber(panelData.parametros.gastoFijo).toFixed(2);
  }
}

function setupDeudaWizardListeners() {
  const btnInicializar = $('btnInicializarDeuda');
  if (btnInicializar) btnInicializar.addEventListener('click', () => {
    const deudaInicial = safeNumber($("deudaInicial").value);
    if (deudaInicial <= 0) {
      alert("El monto de la deuda debe ser mayor a 0.");
      return;
    }

    const nuevaDeuda = {
      id: Date.now(),
      descripcion: 'Deuda Inicial (Total a Pagar)',
      montoOriginal: deudaInicial,
      saldo: deudaInicial,
      estado: 'Pendiente',
      fechaRegistro: new Date().toISOString()
    };

    panelData.deudas.push(nuevaDeuda);
    panelData.parametros.deudaTotal = deudaInicial;

    deudaWizardStep = 2;
    updateDeudaWizardUI();
    if ($('deudaTotalInput')) $('deudaTotalInput').value = safeNumber(panelData.parametros.deudaTotal).toFixed(2);
  });

  const btnFinalizar = $('btnFinalizarDeuda');
  if (btnFinalizar) btnFinalizar.addEventListener('click', () => {
    const deudaTotal = safeNumber($("deudaTotalInput").value);
    const gastoFijo = safeNumber($("gastoFijoDiario").value);

    panelData.parametros.deudaTotal = deudaTotal;
    panelData.parametros.gastoFijo = gastoFijo;

    saveData();
    renderDeudas();
    calcularMetricas();
    alert("Parámetros de deuda y gasto fijo actualizados.");
  });

  const btnVolver = $('btnVolverDeuda');
  if (btnVolver) btnVolver.addEventListener('click', () => {
    updateDeudaWizardUI();
  });
}

function renderDeudas() {
  const lista = $("listaDeudas");
  const selectAbono = $("abonoSeleccionar");
  if (!lista || !selectAbono) return;

  lista.innerHTML = "";
  selectAbono.innerHTML = "<option value=''>-- Seleccionar Deuda --</option>";

  panelData.deudas
    .slice()
    .sort((a, b) => safeNumber(b.saldo) - safeNumber(a.saldo))
    .forEach(deuda => {
      const saldo = safeNumber(deuda.saldo);
      const estadoClass = deuda.estado === 'Pagada' ? 'success' : (saldo > 0 ? 'danger' : '');

      lista.innerHTML += `
        <li class="list-item ${estadoClass}">
          <span>${deuda.descripcion}</span>
          <strong>$${fmtMoney(deuda.saldo)}</strong>
          <span class="nota">${deuda.estado}</span>
        </li>
      `;

      if (deuda.estado !== 'Pagada' && saldo > 0) {
        selectAbono.innerHTML += `
          <option value="${deuda.id}">
            ${deuda.descripcion} - $${fmtMoney(deuda.saldo)}
          </option>
        `;
      }
    });

  // Mostrar deuda total consolidada
  const totalPendiente = panelData.deudas
    .filter(d => d.estado !== 'Pagada')
    .reduce((sum, d) => sum + safeNumber(d.saldo), 0);

  panelData.parametros.deudaTotal = totalPendiente;
  saveData(); // Persistir el total calculado
}

// ---------- CÁLCULOS Y MÉTRICAS ----------
function calcularMetricas() {
  const turnos = Array.isArray(panelData.turnos) ? panelData.turnos : [];
  const ingresosTrabajo = Array.isArray(panelData.ingresos) ? panelData.ingresos : [];
  const gastosTrabajo = Array.isArray(panelData.gastos) ? panelData.gastos.filter(g => g.esTrabajo) : [];
  const gastoFijoDiario = safeNumber(panelData.parametros.gastoFijo);

  // 1. Resumen Histórico
  const totalHoras = turnos.reduce((sum, t) => sum + safeNumber(t.horas), 0);
  const totalKm = turnos.reduce((sum, t) => sum + safeNumber(t.kmRecorridos), 0);
  const totalGananciaBruta = turnos.reduce((sum, t) => sum + safeNumber(t.gananciaBruta), 0) + ingresosTrabajo.reduce((sum, i) => sum + safeNumber(i.monto), 0);

  // Incluir gasolina, mantenimiento y otros gastos de trabajo
  const totalGastosTrabajo = gastosTrabajo.reduce((sum, g) => sum + safeNumber(g.monto), 0);

  // Métricas diarias promedio (usando el rango de fechas de los turnos)
  let diasTrabajados = 0;
  if (turnos.length > 0) {
    const fechas = turnos
      .map(t => {
        if (!t || !t.fechaFin) {
          console.warn("Dato de fecha de turno faltante o inválido detectado:", t && t.fechaFin);
          return null;
        }
        const date = new Date(t.fechaFin);
        if (isNaN(date.getTime())) {
          console.warn("Dato de fecha de turno inválido (RangeError) detectado:", t.fechaFin);
          return null;
        }
        return date.toISOString().substring(0, 10); // YYYY-MM-DD
      })
      .filter(f => f !== null);

    const fechasUnicas = new Set(fechas);
    diasTrabajados = fechasUnicas.size;
  }

  const horasPromedio = diasTrabajados > 0 ? totalHoras / diasTrabajados : 0;
  const kmPromedio = diasTrabajados > 0 ? totalKm / diasTrabajados : 0;
  const gananciaBrutaProm = diasTrabajados > 0 ? totalGananciaBruta / diasTrabajados : 0;
  const gastoTrabajoProm = diasTrabajados > 0 ? totalGastosTrabajo / diasTrabajados : 0;
  const netoDiarioProm = gananciaBrutaProm - gastoTrabajoProm;

  // 2. Proyecciones (Proyección de Deuda)
  const deudaPendiente = safeNumber(panelData.parametros.deudaTotal);

  // Ingreso Diario para Deuda = Neto Diario Promedio - Gasto Fijo Diario
  const ingresoParaDeuda = netoDiarioProm - gastoFijoDiario;

  let diasLibreDeDeudas = "N/A";
  if (deudaPendiente > 0 && ingresoParaDeuda > 0) {
    diasLibreDeDeudas = Math.ceil(deudaPendiente / ingresoParaDeuda);
  }

  // 3. Alertas Operativas (Ejemplo: Mantenimiento)
  const ultimoKm = panelData.parametros.ultimoKMfinal === null ? null : safeNumber(panelData.parametros.ultimoKMfinal);
  const alertas = [];

  // Lectura segura de mantenimientoBase con fallback
  const baseMant = (panelData.parametros && typeof panelData.parametros.mantenimientoBase === 'object' && panelData.parametros.mantenimientoBase !== null)
    ? panelData.parametros.mantenimientoBase
    : DEFAULT_PANEL_DATA.parametros.mantenimientoBase;

  // Obtener valores individuales con fallback seguro
  const kmAceite = safeNumber(baseMant['Aceite (KM)']);
  const kmBujia = safeNumber(baseMant['Bujía (KM)']);
  const kmLlantas = safeNumber(baseMant['Llantas (KM)']);

  // Lógica robusta para proximidad a mantenimiento: si conocemos ultimoKm, avisamos si estamos dentro del 10% final antes del siguiente múltiplo
  if (ultimoKm !== null && ultimoKm > 0) {
    if (kmAceite > 0) {
      const proximidad = kmAceite - (ultimoKm % kmAceite);
      if (proximidad <= Math.ceil(kmAceite * 0.1)) {
        alertas.push(`Aceite: Estás a ~${proximidad}km del siguiente cambio de ${kmAceite}km. Considera cambiarlo.`);
      }
    }
    if (kmBujia > 0) {
      const proximidad = kmBujia - (ultimoKm % kmBujia);
      if (proximidad <= Math.ceil(kmBujia * 0.1)) {
        alertas.push(`Bujía: Estás a ~${proximidad}km del siguiente cambio de ${kmBujia}km. Considera revisarla.`);
      }
    }
    if (kmLlantas > 0) {
      const proximidad = kmLlantas - (ultimoKm % kmLlantas);
      if (proximidad <= Math.ceil(kmLlantas * 0.1)) {
        alertas.push(`Llantas: Estás a ~${proximidad}km del siguiente intervalo de ${kmLlantas}km. Revisa presión/estado.`);
      }
    }
  }

  // Guardar métricas para uso en UI
  panelData.metricas = {
    totalHoras,
    totalKm,
    totalGananciaBruta,
    totalGastosTrabajo,
    diasTrabajados,
    horasPromedio,
    kmPromedio,
    gananciaBrutaProm,
    gastoTrabajoProm,
    netoDiarioProm,
    deudaPendiente,
    gastoFijoDiario,
    ingresoParaDeuda,
    diasLibreDeDeudas,
    alertas
  };

  // Persistir métricas mínimas por si las necesita UI inmediatamente
  saveData();
}

// ---------- RENDERIZADO DE UI ----------
function renderTablaTurnos() {
  const tablaTurnosBody = $("tablaTurnos");
  if (!tablaTurnosBody) return;

  tablaTurnosBody.innerHTML = "";

  panelData.turnos
    .slice()
    .sort((a, b) => {
      const da = a && a.fechaFin ? new Date(a.fechaFin) : new Date(0);
      const db = b && b.fechaFin ? new Date(b.fechaFin) : new Date(0);
      return db - da;
    })
    .slice(0, 5)
    .forEach(turno => {
      const fechaFinDate = turno && turno.fechaFin ? new Date(turno.fechaFin) : null;
      const fechaTexto = fechaFinDate && !isNaN(fechaFinDate.getTime()) ? formatearFecha(fechaFinDate) : "Fecha Inválida";
      const horasFormateadas = safeNumber(turno.horas).toFixed(2);
      const kmRec = safeNumber(turno.kmRecorridos).toFixed(0);
      const ganNeta = fmtMoney(safeNumber(turno.gananciaNeta));
      const row = `
        <tr>
          <td>${fechaTexto}</td>
          <td>${horasFormateadas}h</td>
          <td>${kmRec}km</td>
          <td>$${ganNeta}</td>
        </tr>
      `;
      tablaTurnosBody.innerHTML += row;
    });
}

function renderCharts() {
  const ctxGanancias = $('graficaGanancias');
  const ctxKm = $('graficaKm');

  // Si Chart.js no está cargado, salimos sin errores
  if (!ctxGanancias || !ctxKm || typeof Chart === 'undefined') return;

  // Preparar datasets simples (últimos 7 turnos por fecha)
  const turnos = panelData.turnos
    .slice()
    .sort((a, b) => new Date(a.fechaFin) - new Date(b.fechaFin))
    .slice(-14); // hasta 14 puntos

  const labels = turnos.map(t => {
    const d = t && t.fechaFin ? new Date(t.fechaFin) : new Date();
    return d.toLocaleDateString();
  });

  const ganancias = turnos.map(t => safeNumber(t.gananciaNeta));
  const kms = turnos.map(t => safeNumber(t.kmRecorridos));

  // Destruir si existen (evita duplicados)
  try {
    if (gananciasChart) {
      gananciasChart.destroy();
      gananciasChart = null;
    }
    if (kmChart) {
      kmChart.destroy();
      kmChart = null;
    }
  } catch (e) {
    console.warn("Error destruyendo charts previos:", e);
  }

  // Crear charts (sin especificar colores, como pediste)
  gananciasChart = new Chart(ctxGanancias.getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Ganancia Neta por turno',
        data: ganancias,
        fill: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false
    }
  });

  kmChart = new Chart(ctxKm.getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Km recorridos',
        data: kms
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false
    }
  });
}

function renderAlertas(alertas) {
  const lista = $("listaAlertas");
  const card = $("cardAlertas");
  if (!lista || !card) return;
  lista.innerHTML = "";
  if (Array.isArray(alertas) && alertas.length > 0) {
    alertas.forEach(a => {
      lista.innerHTML += `<li>${a}</li>`;
    });
    card.classList.remove('hidden');
  } else {
    card.classList.add('hidden');
  }
}

function renderResumenIndex() {
  if (!panelData.metricas) calcularMetricas();

  const m = panelData.metricas || {};

  if ($("resHoras")) $("resHoras").textContent = safeNumber(m.horasPromedio).toFixed(2) + "h (Prom)";
  if ($("resGananciaBruta")) $("resGananciaBruta").textContent = `$${fmtMoney(m.gananciaBrutaProm)} (Prom)`;
  if ($("resGastosTrabajo")) $("resGastosTrabajo").textContent = `$${fmtMoney(m.gastoTrabajoProm)} (Prom)`;
  if ($("resGananciaNeta")) $("resGananciaNeta").textContent = `$${fmtMoney(m.netoDiarioProm)}`;

  if ($("proyDeuda")) $("proyDeuda").textContent = `$${fmtMoney(m.deudaPendiente)}`;
  if ($("proyGastoFijoDiario")) $("proyGastoFijoDiario").textContent = `$${fmtMoney(m.gastoFijoDiario)}`;
  if ($("proyNetaPromedio")) $("proyNetaPromedio").textContent = `$${fmtMoney(m.netoDiarioProm)}`;
  if ($("proyDias")) {
    $("proyDias").textContent = m.diasLibreDeDeudas !== "N/A"
      ? `${m.diasLibreDeDeudas} días (Estimado)`
      : "¡Ingreso diario neto insuficiente! 😢";
  }

  renderTablaTurnos();
  renderCharts();
  renderAlertas(m.alertas || []);
}

function renderHistorial() {
  const historialBody = $("historialBody");
  const historialResumen = $("historialResumen");

  if (!historialBody || !historialResumen) return;

  historialBody.innerHTML = "";

  panelData.movimientos
    .slice()
    .sort((a, b) => {
      const da = a && a.fecha ? new Date(a.fecha) : new Date(0);
      const db = b && b.fecha ? new Date(b.fecha) : new Date(0);
      return db - da;
    })
    .forEach(mov => {
      const tipoClass = mov.tipo === 'Ingreso' ? 'ingreso-row' : 'gasto-row';
      const tipoLabel = mov.tipo === 'Ingreso' ? '➕ Ingreso' : '➖ Gasto';
      const fecha = mov && mov.fecha ? new Date(mov.fecha) : null;
      const fechaTexto = fecha && !isNaN(fecha.getTime()) ? `${fecha.toLocaleDateString()} ${fecha.toLocaleTimeString()}` : "Fecha Inválida";

      historialBody.innerHTML += `
        <tr class="${tipoClass}">
          <td>${tipoLabel}</td>
          <td>${fechaTexto}</td>
          <td>${mov.descripcion}</td>
          <td>$${fmtMoney(mov.monto)}</td>
        </tr>
      `;
    });

  const totalIngresos = panelData.movimientos
    .filter(m => m.tipo === 'Ingreso')
    .reduce((sum, m) => sum + safeNumber(m.monto), 0);

  const totalGastos = panelData.movimientos
    .filter(m => m.tipo === 'Gasto')
    .reduce((sum, m) => sum + safeNumber(m.monto), 0);

  const balance = totalIngresos - totalGastos;

  historialResumen.innerHTML = `
    <p><strong>Total Ingresos:</strong> $${fmtMoney(totalIngresos)}</p>
    <p><strong>Total Gastos:</strong> $${fmtMoney(totalGastos)}</p>
    <p><strong>Balance Neto:</strong> $${fmtMoney(balance)}</p>
  `;
}

// ---------- EXPORTACIÓN E IMPORTACIÓN (CORREGIDA) ----------
function exportarJson() {
  try {
    const json = JSON.stringify(panelData, null, 2);
    navigator.clipboard.writeText(json)
      .then(() => alert("Datos copiados al portapapeles (JSON)."))
      .catch(err => {
        console.error('Error al copiar el JSON:', err);
        alert("Error al copiar al portapapeles. Vea la consola para el JSON.");
      });
  } catch (e) {
    console.error("Error preparando JSON para exportar:", e);
    alert("Error preparanado datos para exportar.");
  }
}

/**
 * Función que intenta restaurar los datos desde el JSON pegado por el usuario.
 */
function importarJson() {
  const el = $("importJson");
  const jsonText = el ? el.value.trim() : "";
  if (!jsonText) {
    alert("Pega el contenido JSON para restaurar.");
    return;
  }

  try {
    const importedData = JSON.parse(jsonText);

    // Verificación básica de estructura:
    if (!importedData || typeof importedData !== 'object' ||
      !('ingresos' in importedData) || !('gastos' in importedData) || !('parametros' in importedData) || !('turnos' in importedData)) {
      alert("El JSON no parece ser un archivo de datos válido. Estructura incompleta o dañada.");
      return;
    }

    if (!confirm("ADVERTENCIA: ¿Estás seguro de que quieres reemplazar tus datos actuales? ESTA ACCIÓN ES IRREVERSIBLE.")) {
      return;
    }

    // Restaurar los datos (asignación segura)
    panelData = { ...JSON.parse(JSON.stringify(DEFAULT_PANEL_DATA)), ...importedData };
    asegurarEstructura();
    saveData();

    alert("✅ Datos restaurados correctamente. La página se recargará para aplicar los cambios.");
    window.location.reload();
  } catch (e) {
    alert(`❌ Error al parsear el JSON. Asegúrate de que el formato sea correcto. Detalle: ${e.message}`);
    console.error("Error de importación:", e);
  }
}

function exportarExcel() {
  if (typeof XLSX === 'undefined') {
    alert("La librería de Excel no está cargada. Asegúrate de estar en la página de administración.");
    return;
  }
  const wb = XLSX.utils.book_new();

  // Aquí puedes construir hojas con XLSX.utils. (Omitido por brevedad)
  XLSX.writeFile(wb, "UberEatsTracker_Data.xlsx");
}

// ---------- EVENT LISTENERS GLOBALES ----------
function setupIoListeners() {
  if ($("btnExportar")) $("btnExportar").addEventListener("click", exportarJson);
  if ($("btnImportar")) $("btnImportar").addEventListener("click", importarJson);
  if ($("btnExportarExcel")) $("btnExportarExcel").addEventListener("click", exportarExcel);
}

// ---------- INICIALIZACIÓN GLOBAL ----------
function showTutorialModal() {
  console.log("Mostrando tutorial...");
}

document.addEventListener("DOMContentLoaded", () => {
  // 1) Cargar y sanear datos
  cargarPanelData();

  // 2) Recalcular métricas tras cargar y sanear
  calcularMetricas();

  const body = document.body;
  const page = body ? body.getAttribute('data-page') : null;

  // 3) Listeners globales
  setupIoListeners();

  // 4) Listeners y render por página
  if (page === 'admin') {
    setupIngresoListeners();
    setupGastoListeners();
    setupDeudaWizardListeners();
    setupAbonoListeners();

    if ($("btnIniciarTurno")) $("btnIniciarTurno").addEventListener("click", iniciarTurno);
    if ($("btnFinalizarTurno")) $("btnFinalizarTurno").addEventListener("click", finalizarTurno);

    actualizarUIturno();
    renderDeudas();
    updateDeudaWizardUI();

  } else if (page === 'index') {
    renderResumenIndex();
  } else if (page === 'historial') {
    renderHistorial();
  }

  if (!localStorage.getItem(TUTORIAL_COMPLETADO_KEY)) {
    showTutorialModal();
  }
});
