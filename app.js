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
  gasolina: [], // mantenida por compatibilidad
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

// Estado de turno (guardamos TS como string en localStorage para compat)
let turnoActivo = JSON.parse(localStorage.getItem("turnoActivo")) || false;
let turnoInicio = localStorage.getItem("turnoInicio") || null; // string TS o null

// ---------- UTILIDADES ----------
function safeNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
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
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

// ---------- MANEJO DE DATOS ----------

/**
 * Asegura que la estructura de panelData esté completa para evitar errores al cargar desde versiones antiguas.
 */
function asegurarEstructura() {
  if (!panelData.ingresos) panelData.ingresos = [];
  if (!panelData.gastos) panelData.gastos = [];
  if (!panelData.kmDiarios) panelData.kmDiarios = [];
  if (!panelData.deudas) panelData.deudas = [];
  if (!panelData.movimientos) panelData.movimientos = [];

  // Migración o inicialización de 'turnos' y 'parametros'
  if (!panelData.turnos) panelData.turnos = [];
  if (!panelData.parametros) {
    panelData.parametros = {
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
    };
  }

  // Asegurar las propiedades de parametros
  panelData.parametros.deudaTotal = safeNumber(panelData.parametros.deudaTotal);
  panelData.parametros.gastoFijo = safeNumber(panelData.parametros.gastoFijo);
  if (panelData.parametros.ultimoKMfinal === undefined) panelData.parametros.ultimoKMfinal = null;
  panelData.parametros.costoPorKm = safeNumber(panelData.parametros.costoPorKm);
  panelData.parametros.costoMantenimientoPorKm = safeNumber(panelData.parametros.costoMantenimientoPorKm);
}

/**
 * Carga los datos desde localStorage y maneja la migración de estructuras antiguas.
 */
function cargarPanelData() {
  const data = localStorage.getItem(STORAGE_KEY);
  if (data) {
    try {
      const loadedData = JSON.parse(data);
      panelData = { ...panelData, ...loadedData }; // Sobrescribe con los datos cargados
    } catch (e) {
      console.error("Error al cargar o parsear datos de localStorage:", e);
      // Intentar cargar el backup
      const backupData = localStorage.getItem(BACKUP_KEY);
      if (backupData) {
        try {
          panelData = { ...panelData, ...JSON.parse(backupData) };
          console.warn("Se cargó el backup debido a error de parseo.");
        } catch (e) {
          console.error("Error al cargar el backup.", e);
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
  const json = JSON.stringify(panelData);
  localStorage.setItem(STORAGE_KEY, json);
  localStorage.setItem(BACKUP_KEY, json); // Backup simple
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
    if (textoTurno) textoTurno.innerHTML = `🟢 Turno activo iniciado el ${new Date(safeNumber(turnoInicio)).toLocaleString()}`;
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
  
  // Guardar el KM Inicial en la estructura de panelData para que persista
  // Esto se usa en la función de mantenimiento y alertas.
  // Pero para el turno, lo importante es guardarlo en localStorage con el turno activo.
  
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

  // Los gastos del turno deben venir de un movimiento de 'Gasto Trabajo'
  // Simplificamos: Asumimos que la ganancia neta es Bruta - costos estimados
  // El usuario debería registrar Gastos (ej. gasolina) por separado para precisión.
  const gastoTotalEstimado = costoMantenimiento + costoCombustible;
  const gananciaNeta = gananciaBruta - gastoTotalEstimado;


  const nuevoTurno = {
    id: Date.now(),
    fechaInicio: new Date(fechaInicio).toISOString(),
    fechaFin: new Date(fechaFin).toISOString(),
    horas: horas, // Lo dejamos como número (pero se puede guardar como string en LS)
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
    const esTrabajo = $("gastoEsTrabajo").checked;

    if (!descripcion || monto <= 0) {
      alert("Debe ingresar una descripción y un monto mayor a 0.");
      return;
    }

    registrarMovimiento('Gasto', descripcion, monto, esTrabajo);

    $("gastoDescripcion").value = "";
    $("gastoCantidad").value = "";
    $("gastoEsTrabajo").checked = false;
    alert("Gasto registrado.");
  });
}

function setupAbonoListeners() {
  const btn = $("btnRegistrarAbono");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const deudaId = $("abonoSeleccionar").value;
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
    
    $("abonoMonto").value = "";
    alert("Abono registrado y deuda actualizada.");
  });
}


// ---------- GESTIÓN DE DEUDAS (WIZARD) ----------
function updateDeudaWizardUI() {
    // Esconder todos los pasos
    if ($('deudaStep1')) $('deudaStep1').style.display = 'none';
    if ($('deudaStep2')) $('deudaStep2').style.display = 'none';

    if (panelData.parametros.deudaTotal === 0 && panelData.parametros.gastoFijo === 0) {
        // Mostrar Paso 1
        if ($('deudaStep1')) $('deudaStep1').style.display = 'block';
    } else {
        // Mostrar Paso 2 (o el resumen, pero para la edición)
        // Como no hay un paso de resumen en este código simple, forzamos al paso de edición si ya hay datos.
        if ($('deudaStep2')) $('deudaStep2').style.display = 'block';
        
        // Cargar valores actuales en el paso de edición
        if ($('deudaTotalInput')) $('deudaTotalInput').value = safeNumber(panelData.parametros.deudaTotal).toFixed(2);
        if ($('gastoFijoDiario')) $('gastoFijoDiario').value = safeNumber(panelData.parametros.gastoFijo).toFixed(2);
    }
}

function setupDeudaWizardListeners() {
    // Setup para el paso 1 (Inicial)
    const btnInicializar = $('btnInicializarDeuda');
    if (btnInicializar) btnInicializar.addEventListener('click', () => {
        const deudaInicial = safeNumber($("deudaInicial").value);
        if (deudaInicial <= 0) {
            alert("El monto de la deuda debe ser mayor a 0.");
            return;
        }

        // Crear una deuda inicial
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

        // Avanzar al paso 2
        deudaWizardStep = 2; // Si usáramos un estado
        updateDeudaWizardUI();
        
        // Actualizar UI del paso 2
        if ($('deudaTotalInput')) $('deudaTotalInput').value = safeNumber(panelData.parametros.deudaTotal).toFixed(2);
    });
    
    // Setup para el paso 2 (Guardar Deuda y Gasto Fijo)
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
    
    // Setup para Volver (simplemente actualizar UI para refrescar)
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
  const turnos = panelData.turnos;
  const ingresosTrabajo = panelData.ingresos;
  const gastosTrabajo = panelData.gastos.filter(g => g.esTrabajo);
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
    const fechas = turnos.map(t => new Date(t.fechaFin).toISOString().substring(0, 10)); // Solo YYYY-MM-DD
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
  const ultimoKm = safeNumber(panelData.parametros.ultimoKMfinal);
  const alertas = [];
  
  if (ultimoKm > 0) {
      const baseMant = panelData.parametros.mantenimientoBase;
      const kmAceite = safeNumber(baseMant['Aceite (KM)']);
      const kmBujia = safeNumber(baseMant['Bujía (KM)']);
      const kmLlantas = safeNumber(baseMant['Llantas (KM)']);

      // Esto es una simplificación, asume que el contador KM va desde 0.
      // En una versión real, necesitarías la fecha del último cambio o el KM de cambio.
      // Lo dejamos como un placeholder simple.
      if (ultimoKm % kmAceite > kmAceite * 0.9) {
          alertas.push(`Aceite: Estás cerca de los ${kmAceite}km. Considera cambiarlo.`);
      }
      if (ultimoKm % kmBujia > kmBujia * 0.9) {
          alertas.push(`Bujía: Estás cerca de los ${kmBujia}km. Considera cambiarla.`);
      }
      if (ultimoKm % kmLlantas > kmLlantas * 0.9) {
          alertas.push(`Llantas: Estás cerca de los ${kmLlantas}km. Considera revisarlas.`);
      }
  }

  // Guardar métricas para uso en UI
  panelData.metricas = {
    totalHoras, totalKm, totalGananciaBruta, totalGastosTrabajo,
    diasTrabajados, horasPromedio, kmPromedio, gananciaBrutaProm, gastoTrabajoProm, netoDiarioProm,
    deudaPendiente, gastoFijoDiario, ingresoParaDeuda, diasLibreDeDeudas,
    alertas
  };
}

// ---------- RENDERIZADO DE UI (INDEX) ----------

function renderTablaTurnos() {
  const tablaTurnosBody = $("tablaTurnos");
  if (!tablaTurnosBody) return;

  tablaTurnosBody.innerHTML = "";

  panelData.turnos
    .slice()
    .sort((a, b) => new Date(b.fechaFin) - new Date(a.fechaFin))
    .slice(0, 5)
    .forEach(turno => {
      
      // 🐛 CORRECCIÓN APLICADA: Se usa safeNumber() para asegurar que 'turno.horas' es un número
      // y prevenir el error: turno.horas.toFixed is not a function
      const horasFormateadas = safeNumber(turno.horas).toFixed(2); // <--- LÍNEA CORREGIDA
      // ---------------------------------------------------------------------------------

      const row = `
        <tr>
          <td>${formatearFecha(new Date(turno.fechaFin))}</td>
          <td>${horasFormateadas}h</td>
          <td>${safeNumber(turno.kmRecorridos).toFixed(0)}km</td>
          <td>$${fmtMoney(turno.gananciaNeta)}</td>
        </tr>
      `;
      tablaTurnosBody.innerHTML += row;
    });
}


function renderTablaKmMensual() {
    // Esta función es compleja y se omite por simplicidad en este código
}

function renderCharts() {
    // Esta función es compleja y se omite por simplicidad en este código
}

function renderAlertas(alertas) {
    const lista = $("listaAlertas");
    const card = $("cardAlertas");
    if (!lista || !card) return;

    lista.innerHTML = "";
    if (alertas.length > 0) {
        card.classList.remove('hidden');
        alertas.forEach(alerta => {
            lista.innerHTML += `<li>${alerta}</li>`;
        });
    } else {
        card.classList.add('hidden');
    }
}


function renderResumenIndex() {
  if (!panelData.metricas) calcularMetricas();

  const m = panelData.metricas;

  // Resumen del Día (Horas, Ganancia Bruta, Gastos Trabajo) - Simplificado
  // Este resumen debería ser por *día de hoy*, pero para este código simple,
  // usaremos el promedio histórico o el último turno para el dashboard.
  // **Asumiendo que solo se muestra el promedio o el último turno simple por ahora**
  
  if ($("resHoras")) $("resHoras").textContent = safeNumber(m.horasPromedio).toFixed(2) + "h (Prom)";
  if ($("resGananciaBruta")) $("resGananciaBruta").textContent = `$${fmtMoney(m.gananciaBrutaProm)} (Prom)`;
  if ($("resGastosTrabajo")) $("resGastosTrabajo").textContent = `$${fmtMoney(m.gastoTrabajoProm)} (Prom)`;
  if ($("resGananciaNeta")) $("resGananciaNeta").textContent = `$${fmtMoney(m.netoDiarioProm)}`;
  
  // Proyecciones
  if ($("proyDeuda")) $("proyDeuda").textContent = `$${fmtMoney(m.deudaPendiente)}`;
  if ($("proyGastoFijoDiario")) $("proyGastoFijoDiario").textContent = `$${fmtMoney(m.gastoFijoDiario)}`;
  if ($("proyNetaPromedio")) $("proyNetaPromedio").textContent = `$${fmtMoney(m.netoDiarioProm)}`;
  if ($("proyDias")) {
      $("proyDias").textContent = m.diasLibreDeDeudas !== "N/A"
          ? `${m.diasLibreDeDeudas} días (Estimado)`
          : "¡Ingreso diario neto insuficiente! 😢";
  }
  
  // Actualizar tablas y graficas
  renderTablaTurnos();
  renderTablaKmMensual();
  renderCharts();
  renderAlertas(m.alertas);
}

// ---------- RENDERIZADO DE UI (HISTORIAL) ----------

function renderHistorial() {
    const historialBody = $("historialBody");
    const historialResumen = $("historialResumen");
    
    if (!historialBody || !historialResumen) return;

    historialBody.innerHTML = "";
    
    // Solo mostrar movimientos del historial para simplificar
    panelData.movimientos
        .slice()
        .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
        .forEach(mov => {
            const tipoClass = mov.tipo === 'Ingreso' ? 'ingreso-row' : 'gasto-row';
            const tipoLabel = mov.tipo === 'Ingreso' ? '➕ Ingreso' : '➖ Gasto';
            
            historialBody.innerHTML += `
                <tr class="${tipoClass}">
                    <td>${tipoLabel}</td>
                    <td>${new Date(mov.fecha).toLocaleDateString()} ${new Date(mov.fecha).toLocaleTimeString()}</td>
                    <td>${mov.descripcion}</td>
                    <td>$${fmtMoney(mov.monto)}</td>
                </tr>
            `;
        });
        
    // Resumen Rápido
    const totalIngresos = panelData.movimientos
        .filter(m => m.tipo === 'Ingreso')
        .reduce((sum, m) => sum + safeNumber(m.monto), 0);
        
    const totalGastos = panelData.movimientos
        .filter(m => m.tipo === 'Gasto')
        .reduce((sum, m => sum + safeNumber(m.monto)), 0);
        
    const balance = totalIngresos - totalGastos;
    
    historialResumen.innerHTML = `
        <p><strong>Total Ingresos:</strong> $${fmtMoney(totalIngresos)}</p>
        <p><strong>Total Gastos:</strong> $${fmtMoney(totalGastos)}</p>
        <p><strong>Balance Neto:</strong> $${fmtMoney(balance)}</p>
    `;
}

// ---------- EXPORTACIÓN E IMPORTACIÓN ----------

function exportarJson() {
    const json = JSON.stringify(panelData, null, 2);
    navigator.clipboard.writeText(json)
        .then(() => alert("Datos copiados al portapapeles (JSON)."))
        .catch(err => console.error('Error al copiar el JSON:', err));
}

function importarJson() {
    const jsonText = $("importJson").value.trim();
    if (!jsonText) {
        alert("Pega el contenido JSON para importar.");
        return;
    }
    
    try {
        const importedData = JSON.parse(jsonText);
        
        // Simple validación (debería ser más robusta)
        if (!importedData.ingresos || !importedData.gastos || !importedData.parametros) {
            alert("El JSON no parece ser un archivo de datos válido. Estructura incompleta.");
            return;
        }

        if (!confirm("¿Estás seguro de que quieres reemplazar tus datos actuales? ESTA ACCIÓN ES IRREVERSIBLE.")) {
            return;
        }
        
        // Restaurar
        panelData = importedData;
        
        // Asegurar que la estructura base está correcta y guardar
        asegurarEstructura();
        saveData();
        
        // Recalcular todo y refrescar la página
        alert("Datos restaurados correctamente. La página se recargará.");
        window.location.reload(); 
        
    } catch (e) {
        alert("Error al parsear el JSON. Asegúrate de que el formato sea correcto.");
        console.error("Error de importación:", e);
    }
}

function exportarExcel() {
    const wb = XLSX.utils.book_new();
    
    // 1. Hoja de Turnos
    const turnosData = [
        ["Fecha Fin", "Horas", "KM Inicial", "KM Final", "KM Recorridos", "Ganancia Bruta", "Costo Mant. Est.", "Costo Comb. Est.", "Ganancia Neta Est."],
        ...panelData.turnos.map(t => [
            new Date(t.fechaFin).toLocaleString(),
            safeNumber(t.horas).toFixed(2),
            safeNumber(t.kmInicial).toFixed(0),
            safeNumber(t.kmFinal).toFixed(0),
            safeNumber(t.kmRecorridos).toFixed(0),
            safeNumber(t.gananciaBruta).toFixed(2),
            safeNumber(t.costoMantenimiento).toFixed(2),
            safeNumber(t.costoCombustible).toFixed(2),
            safeNumber(t.gananciaNeta).toFixed(2),
        ])
    ];
    const wsTurnos = XLSX.utils.aoa_to_sheet(turnosData);
    XLSX.utils.book_append_sheet(wb, wsTurnos, "Turnos");

    // 2. Hoja de Movimientos
    const movimientosData = [
        ["Tipo", "Fecha", "Descripción", "Monto", "Es de Trabajo"],
        ...panelData.movimientos.map(m => [
            m.tipo,
            new Date(m.fecha).toLocaleString(),
            m.descripcion,
            safeNumber(m.monto).toFixed(2),
            m.esTrabajo ? "Sí" : "No"
        ])
    ];
    const wsMovimientos = XLSX.utils.aoa_to_sheet(movimientosData);
    XLSX.utils.book_append_sheet(wb, wsMovimientos, "Movimientos");
    
    // 3. Hoja de Deudas
    const deudasData = [
        ["ID", "Descripción", "Monto Original", "Saldo Pendiente", "Estado"],
        ...panelData.deudas.map(d => [
            d.id,
            d.descripcion,
            safeNumber(d.montoOriginal).toFixed(2),
            safeNumber(d.saldo).toFixed(2),
            d.estado
        ])
    ];
    const wsDeudas = XLSX.utils.aoa_to_sheet(deudasData);
    XLSX.utils.book_append_sheet(wb, wsDeudas, "Deudas");


    // Guardar el archivo
    XLSX.writeFile(wb, "UberEatsTracker_Data.xlsx");
}

// ---------- EVENT LISTENERS GLOBALES ----------

function setupIoListeners() {
    // Exportar/Importar JSON
    if ($("btnExportar")) $("btnExportar").addEventListener("click", exportarJson);
    if ($("btnImportar")) $("btnImportar").addEventListener("click", importarJson);
    if ($("btnExportarExcel")) $("btnExportarExcel").addEventListener("click", exportarExcel);
}

// ---------- INICIALIZACIÓN GLOBAL ----------

document.addEventListener("DOMContentLoaded", () => {
  cargarPanelData();
  calcularMetricas();
  
  // Detectar en qué página estamos
  const body = document.body;
  const page = body.getAttribute('data-page');

  // Listeners comunes
  setupIoListeners();

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
    // Aquí se llamarían a renderCharts y renderTablaKmMensual dentro de renderResumenIndex()
    
  } else if (page === 'historial') {
    renderHistorial();
  }
  
  // Mostrar tutorial si no ha sido completado
  if (!localStorage.getItem(TUTORIAL_COMPLETADO_KEY)) {
      showTutorialModal(); // Asume que esta función existe en otro lugar o la definimos abajo
  }

});

// Placeholder para las funciones que usan inputs en admin.html que no están en el archivo base (setupGasListeners, setupKmListeners)
// No es necesario definirlas si no existen en el HTML o no generan el error.

// =========================
//    TUTORIAL MODAL
// =========================
// Funciones para el tutorial (simplicidad)
let tutorialSteps = [
    { title: "Bienvenido", text: "Este es tu Panel de Control. Presiona 'Siguiente' para comenzar un recorrido rápido." },
    { title: "Panel de Resultados", text: "Aquí verás tus métricas clave: horas promedio, ganancia neta diaria, y proyecciones de deuda. Los datos se actualizan con cada turno o registro." },
    { title: "Administración", text: "En la sección de Administración (⚙), podrás registrar Ingresos, Gastos, Deudas, y gestionar tus Turnos (Iniciar/Finalizar)." },
    { title: "Gestión de Turno", text: "Es crucial usar 'Iniciar Turno' al empezar y 'Finalizar Turno' al terminar, registrando tu KM Final y Ganancia Bruta. Esto calcula tu eficiencia." },
    { title: "Finalizado", text: "¡Listo! Empieza por ir a Administración para configurar tus parámetros iniciales (deuda, gasto fijo) y registrar tu primer turno. ¡A trabajar!" }
];
let currentTutorialStep = 0;

function showTutorialModal() {
    const overlay = $("tutorialOverlay");
    const modal = $("tutorialModal");
    const nextBtn = $("tutorialNextBtn");
    
    if (!overlay || !modal) return;
    
    // Resetear al inicio
    currentTutorialStep = 0;
    
    // Mostrar
    overlay.style.display = 'block';
    modal.style.display = 'block';
    updateTutorialModal();
    
    if (nextBtn) {
        // Asegurar que solo hay un listener
        nextBtn.onclick = null;
        nextBtn.addEventListener('click', handleTutorialNext);
    }
}

function updateTutorialModal() {
    const step = tutorialSteps[currentTutorialStep];
    const title = $("tutorialTitle");
    const text = $("tutorialText");
    const nextBtn = $("tutorialNextBtn");

    if (title) title.textContent = step.title;
    if (text) text.textContent = step.text;
    
    if (currentTutorialStep === tutorialSteps.length - 1) {
        if (nextBtn) nextBtn.textContent = "Cerrar y Entendido";
    } else {
        if (nextBtn) nextBtn.textContent = "Siguiente";
    }
}

function handleTutorialNext() {
    if (currentTutorialStep < tutorialSteps.length - 1) {
        currentTutorialStep++;
        updateTutorialModal();
    } else {
        // Fin del tutorial
        const overlay = $("tutorialOverlay");
        const modal = $("tutorialModal");
        if (overlay) overlay.style.display = 'none';
        if (modal) modal.style.display = 'none';
        
        localStorage.setItem(TUTORIAL_COMPLETADO_KEY, "true");
        alert("¡Tutorial completado! Ahora a la Administración para empezar.");
    }
}
