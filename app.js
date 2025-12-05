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

/** Devuelve YYYY-MM-DD basado en TS o Date para agrupaciones internas */
function getDateKey(date) {
  const d = date ? new Date(Number(date)) : new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Formatea moneda */
function fmtMoney(amount, decimals = 2) {
  const n = safeNumber(amount, 0);
  return n.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** Fecha local legible (es-MX) */
function fmtDateLocal(ts = Date.now()) {
  return new Date(Number(ts)).toLocaleString('es-MX', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
}

/** Generador simple de ID para deudas */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ---------- MIGRACIONES ROBUSTAS ----------
function runMigrations() {
  // Asegurar que las colecciones existan
  panelData.ingresos = Array.isArray(panelData.ingresos) ? panelData.ingresos : [];
  panelData.gastos = Array.isArray(panelData.gastos) ? panelData.gastos : [];
  panelData.kmDiarios = Array.isArray(panelData.kmDiarios) ? panelData.kmDiarios : [];
  panelData.turnos = Array.isArray(panelData.turnos) ? panelData.turnos : [];
  panelData.deudas = Array.isArray(panelData.deudas) ? panelData.deudas : [];

  const normalizeItem = (item) => {
    if (!item || typeof item !== 'object') return null;
    // timestamp: prefer timestamp -> ts -> derive from fechaLocal -> Date.now()
    let ts = safeNumber(item.timestamp ?? item.ts ?? (item.fechaLocal ? new Date(item.fechaLocal).getTime() : null), null);
    if (!ts) ts = Date.now();
    item.timestamp = Number(ts);
    if (!item.fechaLocal) item.fechaLocal = fmtDateLocal(item.timestamp);
    // eliminar fechaISO y ts antiguo para evitar confusión
    if (item.fechaISO) delete item.fechaISO;
    if (item.ts) delete item.ts;
    return item;
  };

  // Normalizar colecciones
  panelData.ingresos = panelData.ingresos.map(i => normalizeItem(i)).filter(Boolean);
  panelData.gastos = panelData.gastos.map(g => normalizeItem(g)).filter(Boolean);
  panelData.kmDiarios = panelData.kmDiarios.map(k => normalizeItem(k)).filter(Boolean);
  panelData.turnos = panelData.turnos.map(t => {
    const nt = normalizeItem(t);
    // soportar estructuras antiguas: inicio/fin o inicioTS/finTS
    nt.inicioTS = safeNumber(nt.inicioTS ?? nt.inicio ?? nt.ts ?? nt.timestamp ?? null, null);
    nt.finTS = safeNumber(nt.finTS ?? nt.fin ?? nt.timestamp ?? null, null);
    // asegurar horas/ganancia/km fields con fallback
    nt.horas = (nt.horas !== undefined) ? String(nt.horas) : (nt.horas === 0 ? "0.00" : nt.horas);
    nt.ganancia = safeNumber(nt.ganancia ?? nt.cantidad ?? 0, 0);
    nt.kmRecorrido = safeNumber(nt.kmRecorrido ?? nt.recorrido ?? 0, 0);
    return nt;
  }).filter(Boolean);

  // Migración robusta de deudas: soporta estructura antigua
  const migrated = [];
  for (const d of panelData.deudas) {
    if (!d) continue;
    // Si ya tiene id y campos nuevos, normalizamos nombres
    if (d.id && d.montoTotal !== undefined) {
      const newD = {
        id: d.id,
        nombre: d.nombre ?? ("Deuda " + (d.id || generateId())),
        montoTotal: safeNumber(d.montoTotal, 0),
        abonadoTotal: safeNumber(d.abonadoTotal ?? d.abonado ?? 0, 0),
        saldo: safeNumber(d.saldo ?? (safeNumber(d.montoTotal, 0) - safeNumber(d.abonadoTotal ?? d.abonado ?? 0, 0)), 0),
        frecuencia: d.frecuencia ?? "Mensual",
        abonoSugerido: safeNumber(d.abonoSugerido ?? 0, 0),
        creadaEn: Number(d.creadaEn ?? d.timestamp ?? Date.now()),
        historialAbonos: Array.isArray(d.historialAbonos) ? d.historialAbonos : []
      };
      migrated.push(newD);
    } else {
      // deuda antigua: fields likely {nombre, monto, abonado, frecuencia, abonoSugerido}
      const montoOriginal = safeNumber(d.monto ?? d.montoTotal ?? 0, 0);
      const abonado = safeNumber(d.abonado ?? d.abonadoTotal ?? 0, 0);
      const newD = {
        id: generateId(),
        nombre: d.nombre ?? "Deuda Migrada",
        montoTotal: montoOriginal,
        abonadoTotal: abonado,
        saldo: Math.max(0, montoOriginal - abonado),
        frecuencia: d.frecuencia ?? "Mensual",
        abonoSugerido: safeNumber(d.abonoSugerido ?? 0, 0),
        creadaEn: Number(d.creadaEn ?? d.timestamp ?? Date.now()),
        historialAbonos: Array.isArray(d.historialAbonos) ? d.historialAbonos : []
      };
      migrated.push(newD);
    }
  }
  panelData.deudas = migrated;
                                 }

// app.js - Parte 2/5
// Carga / Guardado / Backup / Listeners de Ingresos, Gastos y Gasolina

function cargarPanelData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    // Merge seguro, evitando sobrescribir la estructura base por error
    panelData = { ...panelData, ...parsed };
    panelData.parametros = { ...panelData.parametros, ...(parsed.parametros || {}) };
    runMigrations();
  } catch (e) {
    console.error("Error al cargar panelData:", e);
  }
}

function backupPanelData() {
  try {
    localStorage.setItem(BACKUP_KEY, JSON.stringify(panelData, null, 2));
  } catch (e) {
    console.warn("No se pudo crear backup en localStorage:", e);
  }
}

function guardarPanelData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(panelData));
    backupPanelData();
  } catch (e) {
    console.error("Error guardando panelData:", e);
    alert("Error guardando datos en el navegador.");
  }
}

// ---------- Listeners: Ingresos ----------
function setupIngresoListeners() {
  const btn = $("btnGuardarIngreso");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const descEl = $("ingresoDescripcion");
    const cantEl = $("ingresoCantidad");
    const desc = descEl ? String(descEl.value || "").trim() : "Ingreso manual";
    const cantidad = safeNumber(cantEl ? cantEl.value : 0, 0);
    if (cantidad <= 0) return alert("Introduce una cantidad válida y mayor a cero.");
    const nuevo = {
      descripcion: desc || "Ingreso manual",
      cantidad,
      fechaLocal: fmtDateLocal(),
      timestamp: Date.now()
    };
    panelData.ingresos.push(nuevo);
    if (descEl) descEl.value = "";
    if (cantEl) cantEl.value = "";
    guardarPanelData();
    calcularMetricasAutomaticas();
    renderResumenIndex();
    alert("Ingreso guardado.");
  });
}

// ---------- Listeners: Gastos Generales ----------
function setupGastoListeners() {
  const btn = $("btnGuardarGasto");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const descEl = $("gastoDescripcion");
    const cantEl = $("gastoCantidad");
    const catEl = $("gastoCategoria");
    const desc = descEl ? String(descEl.value || "").trim() : "";
    const cantidad = safeNumber(cantEl ? cantEl.value : 0, 0);
    const categoria = catEl ? String(catEl.value || "") : "";
    if (cantidad <= 0 || !categoria) return alert("Introduce una cantidad y categoría válidas.");
    const gasto = {
      descripcion: desc || categoria,
      cantidad,
      categoria,
      fechaLocal: fmtDateLocal(),
      timestamp: Date.now()
    };
    panelData.gastos.push(gasto);
    if (descEl) descEl.value = "";
    if (cantEl) cantEl.value = "";
    guardarPanelData();
    calcularMetricasAutomaticas();
    renderResumenIndex();
    alert("Gasto guardado.");
  });
}

// ---------- Listeners: Gasolina (litros) ----------
function setupGasListeners() {
  const btn = $("btnGuardarGas");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const litrosEl = $("litrosGas");
    const costoEl = $("costoGas");
    const litros = safeNumber(litrosEl ? litrosEl.value : 0, 0);
    const costo = safeNumber(costoEl ? costoEl.value : 0, 0);
    if (litros <= 0 || costo <= 0) return alert("Introduce un Costo y Litros válidos y mayores a cero.");
    const carga = {
      descripcion: `Gasolina ${litros.toFixed(2)} L`,
      cantidad: costo,
      litros,
      categoria: "Transporte (Gasolina)",
      fechaLocal: fmtDateLocal(),
      timestamp: Date.now()
    };
    panelData.gastos.push(carga);
    // Also keep gasolina array for backward compatibility / historical liters
    panelData.gasolina = panelData.gasolina || [];
    panelData.gasolina.push({ litros, costo, fechaLocal: carga.fechaLocal, timestamp: carga.timestamp });
    if (litrosEl) litrosEl.value = "";
    if (costoEl) costoEl.value = "";
    guardarPanelData();
    calcularMetricasAutomaticas();
    renderResumenIndex();
    alert(`Carga de ${litros.toFixed(2)}L por $${fmtMoney(costo)} guardada.`);
  });
}

// app.js - Parte 3/5
// Lógica de Turnos, KM, Wizard de Deudas y Abonos

// ---------- Turnos UI ----------
function actualizarUIturno() {
  const btnIniciar = $("btnIniciarTurno");
  const btnFinalizar = $("btnFinalizarTurno");
  const texto = $("turnoTexto");
  if (!btnIniciar || !btnFinalizar || !texto) return;
  if (turnoActivo && turnoInicio) {
    const inicioDate = new Date(Number(turnoInicio));
    texto.innerHTML = "🟢 Turno activo. Iniciado el: " + inicioDate.toLocaleString('es-MX', {
      hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short'
    });
    btnIniciar.style.display = 'none';
    btnFinalizar.style.display = 'inline-block';
  } else {
    texto.innerHTML = "🔴 Sin turno activo";
    btnIniciar.style.display = 'inline-block';
    btnFinalizar.style.display = 'none';
  }
}

function iniciarTurno() {
  const kmInicialEl = $("kmInicial");
  const kmInicial = safeNumber(kmInicialEl ? kmInicialEl.value : panelData.parametros.ultimoKMfinal, 0);
  if (!kmInicial || kmInicial === 0) {
    return alert("¡Alerta! Debes registrar el kilometraje inicial (Odómetro) antes de empezar.");
  }
  turnoActivo = true;
  turnoInicio = Date.now().toString();
  localStorage.setItem("turnoActivo", "true");
  localStorage.setItem("turnoInicio", turnoInicio);
  panelData.parametros.kmInicialTurno = kmInicial;
  guardarPanelData();
  actualizarUIturno();
  alert("Turno iniciado a las " + new Date(Number(turnoInicio)).toLocaleTimeString());
}

function finalizarTurno() {
  if (!turnoActivo || !turnoInicio) return;
  const finTS = Date.now();
  const inicioTS = Number(turnoInicio);
  if (!Number.isFinite(inicioTS)) return alert("Error en fecha de inicio. Inicia un nuevo turno.");
  const diffMs = finTS - inicioTS;
  const horas = diffMs / (1000 * 60 * 60);
  const gananciaTurno = prompt("Introduce la GANANCIA BRUTA total del turno ($):", "0");
  if (gananciaTurno === null) return alert("Cancelado: no se registró la ganancia. Finaliza el turno cuando tengas el monto.");
  const ganancia = safeNumber(gananciaTurno, 0);
  const kmFinal = safeNumber($("kmFinal") ? $("kmFinal").value : 0, 0);
  const kmInicialTurno = safeNumber(panelData.parametros.kmInicialTurno ?? $("kmInicial")?.value, 0);
  if (!Number.isFinite(kmFinal)) return alert("KM Final inválido.");
  const recorrido = kmFinal - kmInicialTurno;
  if (Number.isNaN(recorrido) || recorrido < 0) {
    return alert(`Error: El KM Final (${kmFinal}) no puede ser menor que el KM Inicial (${kmInicialTurno}). Corrige el KM Final.`);
  }
  // Registrar sólo si al menos se cumple el recorrido (>=0) y ganancia es número válido (>=0)
  if (ganancia >= 0 && recorrido >= 0) {
    const nuevoTurno = {
      inicioTS: inicioTS,
      finTS: finTS,
      horas: horas.toFixed(2),
      ganancia,
      kmRecorrido: recorrido,
      kmInicial: kmInicialTurno,
      kmFinal: kmFinal,
      fechaLocal: fmtDateLocal(finTS),
      timestamp: finTS
    };
    panelData.turnos.push(nuevoTurno);
    panelData.ingresos.push({
      descripcion: `Ganancia turno (${horas.toFixed(2)}h)`,
      cantidad: ganancia,
      fechaLocal: fmtDateLocal(finTS),
      timestamp: finTS
    });
    if (recorrido > 0) {
      panelData.kmDiarios.push({
        fechaLocal: fmtDateLocal(finTS),
        recorrido,
        inicial: kmInicialTurno,
        final: kmFinal,
        timestamp: finTS
      });
      panelData.parametros.ultimoKMfinal = kmFinal;
    }
    // Reset estado
    turnoActivo = false;
    turnoInicio = null;
    localStorage.removeItem("turnoActivo");
    localStorage.removeItem("turnoInicio");
    delete panelData.parametros.kmInicialTurno;
    if ($("kmInicial")) $("kmInicial").value = kmFinal.toFixed(0);
    if ($("kmFinal")) $("kmFinal").value = "";
    guardarPanelData();
    actualizarUIturno();
    calcularMetricasAutomaticas();
    renderResumenIndex();
    alert(`Turno finalizado. Duración: ${horas.toFixed(2)}h. KM: ${recorrido.toFixed(0)}. Ganancia: $${fmtMoney(ganancia)}.`);
  } else {
    alert("Ganancia/KM inválida. El turno no ha sido finalizado.");
  }
}

// ---------- KM listeners ----------
function setupKmListeners() {
  const kmInicialInput = $("kmInicial");
  const kmFinalInput = $("kmFinal");
  const kmRecorridosSpan = $("kmRecorridos");
  if (!kmInicialInput || !kmFinalInput || !kmRecorridosSpan) return;
  kmInicialInput.value = panelData.parametros.ultimoKMfinal !== null ? Number(panelData.parametros.ultimoKMfinal).toFixed(0) : "0";
  const updateRecorridos = () => {
    const ki = safeNumber(kmInicialInput.value, 0);
    const kf = safeNumber(kmFinalInput.value, 0);
    const recorridos = kf - ki;
    kmRecorridosSpan.textContent = (Number.isFinite(recorridos) && recorridos >= 0) ? recorridos.toFixed(0) : "0";
  };
  kmFinalInput.addEventListener("input", updateRecorridos);
  const btn = $("btnGuardarKm");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const ki = safeNumber(kmInicialInput.value, 0);
    const kf = safeNumber(kmFinalInput.value, 0);
    const recorrido = kf - ki;
    if (!Number.isFinite(recorrido) || recorrido <= 0) {
      return alert("Error: El KM Final debe ser mayor que el KM Inicial para guardar el registro de recorrido.");
    }
    panelData.kmDiarios.push({
      fechaLocal: fmtDateLocal(),
      recorrido,
      inicial: ki,
      final: kf,
      timestamp: Date.now()
    });
    panelData.parametros.ultimoKMfinal = kf;
    kmInicialInput.value = kf.toFixed(0);
    kmFinalInput.value = "";
    kmRecorridosSpan.textContent = "0";
    guardarPanelData();
    calcularMetricasAutomaticas();
    renderResumenIndex();
    alert(`Registro de ${recorrido.toFixed(0)} KM guardado.`);
  });
}

// ---------- Deudas: Wizard y Abonos ----------
function updateDeudaWizardUI() {
  const steps = [$("deudaStep1"), $("deudaStep2"), $("deudaStep3"), $("deudaStep4")];
  if (!steps[0]) return;
  steps.forEach((step, idx) => { if (step) step.style.display = (idx + 1 === deudaWizardStep) ? 'block' : 'none'; });
  if ($("btnDeudaBack")) $("btnDeudaBack").style.display = (deudaWizardStep > 1) ? 'inline-block' : 'none';
  if ($("btnDeudaNext")) $("btnDeudaNext").style.display = (deudaWizardStep < 4) ? 'inline-block' : 'none';
  if ($("btnRegistrarDeudaFinal")) $("btnRegistrarDeudaFinal").style.display = (deudaWizardStep === 4) ? 'inline-block' : 'none';
}

function setupDeudaWizardListeners() {
  const validateStep = (step) => {
    if (step === 1) {
      const nombre = $("deudaNombre")?.value.trim();
      if (!nombre) { alert("⚠ El nombre de la deuda no puede estar vacío."); return false; }
      return true;
    }
    if (step === 2) {
      const monto = safeNumber($("deudaMonto")?.value, 0);
      if (monto <= 0) { alert("⚠ El Monto Total debe ser mayor a cero."); return false; }
      return true;
    }
    if (step === 3) {
      const freq = $("deudaFrecuencia")?.value;
      if (!freq) { alert("⚠ Debes seleccionar una frecuencia de pago."); return false; }
      return true;
    }
    if (step === 4) {
      const abono = safeNumber($("deudaAbonoSugerido")?.value, 0);
      if (abono <= 0) { alert("⚠ El Abono Sugerido debe ser mayor a cero."); return false; }
      return true;
    }
    return false;
  };

  if ($("btnDeudaNext")) $("btnDeudaNext").addEventListener("click", () => {
    if (validateStep(deudaWizardStep)) {
      if (deudaWizardStep < 4) { deudaWizardStep++; updateDeudaWizardUI(); }
    }
  });
  if ($("btnDeudaBack")) $("btnDeudaBack").addEventListener("click", () => {
    if (deudaWizardStep > 1) { deudaWizardStep--; updateDeudaWizardUI(); }
  });
  if ($("btnRegistrarDeudaFinal")) $("btnRegistrarDeudaFinal").addEventListener("click", () => {
    if (!validateStep(4)) return;
    const nombre = $("deudaNombre")?.value.trim();
    const montoTotal = safeNumber($("deudaMonto")?.value, 0);
    const frecuencia = $("deudaFrecuencia")?.value;
    const abonoSugerido = safeNumber($("deudaAbonoSugerido")?.value, 0);
    if (!nombre || montoTotal <= 0 || !frecuencia || abonoSugerido <= 0) return alert("Error al registrar la deuda. Revise los campos.");
    const nueva = {
      id: generateId(),
      nombre,
      montoTotal,
      saldo: montoTotal,
      frecuencia,
      abonoSugerido,
      abonadoTotal: 0,
      creadaEn: Date.now(),
      historialAbonos: []
    };
    panelData.deudas.push(nueva);
    // Reset wizard fields safely
    if ($("deudaNombre")) $("deudaNombre").value = "";
    if ($("deudaMonto")) $("deudaMonto").value = "";
    if ($("deudaFrecuencia")) $("deudaFrecuencia").value = "";
    if ($("deudaAbonoSugerido")) $("deudaAbonoSugerido").value = "";
    deudaWizardStep = 1;
    updateDeudaWizardUI();
    guardarPanelData();
    calcularMetricasAutomaticas();
    renderDeudas();
    alert(`Deuda "${nombre}" registrada correctamente.`);
  });
}

function setupAbonoListeners() {
  const btn = $("btnRegistrarAbono");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const id = $("abonoSeleccionar")?.value;
    const monto = safeNumber($("abonoMonto")?.value, 0);
    if (!id || monto <= 0) return alert("Selecciona una deuda y un monto válido.");
    const deuda = panelData.deudas.find(d => d.id === id);
    if (!deuda) return alert("Deuda no encontrada.");
    const pendiente = safeNumber(deuda.saldo, 0);
    if (monto > pendiente) {
      return alert(`⚠ El abono de $${fmtMoney(monto)} es mayor que el saldo pendiente de $${fmtMoney(pendiente)}. Abona hasta $${fmtMoney(pendiente)}.`);
    }
    deuda.abonadoTotal = safeNumber(deuda.abonadoTotal, 0) + monto;
    deuda.saldo = Math.max(0, safeNumber(deuda.saldo, 0) - monto);
    const historial = {
      monto,
      fechaLocal: fmtDateLocal(),
      timestamp: Date.now()
    };
    deuda.historialAbonos = deuda.historialAbonos || [];
    deuda.historialAbonos.push(historial);
    panelData.gastos.push({
      descripcion: `Abono a ${deuda.nombre}`,
      cantidad: monto,
      categoria: "Abono a Deuda TRABAJO",
      fechaLocal: historial.fechaLocal,
      timestamp: historial.timestamp
    });
    if ($("abonoMonto")) $("abonoMonto").value = "";
    guardarPanelData();
    calcularMetricasAutomaticas();
    renderDeudas();
    renderResumenIndex();
    alert(`Abono de $${fmtMoney(monto)} registrado a ${deuda.nombre}. Saldo restante: $${fmtMoney(deuda.saldo)}.`);
  });
}

function renderDeudas() {
  const lista = $("listaDeudas");
  const select = $("abonoSeleccionar");
  if (!lista || !select) return;
  lista.innerHTML = "";
  select.innerHTML = '<option value="">-- Seleccionar Deuda --</option>';
  for (const deuda of panelData.deudas) {
    if (safeNumber(deuda.saldo, 0) > 0) {
      lista.innerHTML += `
        <li>
          <strong>${deuda.nombre}</strong> (${deuda.frecuencia})<br>
          Total: $${fmtMoney(deuda.montoTotal)} | Abonado: $${fmtMoney(deuda.abonadoTotal)} | Pendiente: <span style="color:red;">$${fmtMoney(deuda.saldo)}</span>
        </li>
      `;
      select.innerHTML += `<option value="${deuda.id}">${deuda.nombre} ($${fmtMoney(deuda.saldo)} Pendiente)</option>`;
    }
  }
      }
// app.js - Parte 4/5
// IO (Import/Export/Excel), cálculos automáticos, render de tabla de turnos y KM mensual

function setupIoListeners() {
  const btnExport = $("btnExportar");
  const btnImport = $("btnImportar");
  const btnExcel = $("btnExportarExcel");
  if (btnExport) {
    btnExport.addEventListener("click", () => {
      try {
        const json = JSON.stringify(panelData, null, 2);
        navigator.clipboard.writeText(json).then(() => alert("Datos copiados al portapapeles (JSON)."));
      } catch (e) {
        console.error("Error al copiar JSON:", e);
        alert("No se pudo copiar los datos.");
      }
    });
  }
  if (btnImport) {
    btnImport.addEventListener("click", () => {
      const ta = $("importJson");
      if (!ta) return;
      const json = ta.value.trim();
      if (!json) return alert("Pega los datos JSON en el campo de texto.");
      try {
        const imported = JSON.parse(json);
        if (!confirm("ADVERTENCIA: reemplazar datos actuales con datos importados?")) return;
        panelData = { ...panelData, ...imported };
        // Reasegurar estructura base y migrar
        runMigrations();
        guardarPanelData();
        alert("Datos restaurados correctamente. Recargando...");
        window.location.reload();
      } catch (e) {
        console.error("Error parseando JSON:", e);
        alert("Error al parsear el JSON. Asegúrate de que el formato sea correcto.");
      }
    });
  }
  if (btnExcel) btnExcel.addEventListener("click", exportToExcel);
}

function exportToExcel() {
  try {
    const wb = XLSX.utils.book_new();
    const wsIngresos = XLSX.utils.json_to_sheet(panelData.ingresos || []);
    XLSX.utils.book_append_sheet(wb, wsIngresos, "Ingresos");
    const wsGastos = XLSX.utils.json_to_sheet(panelData.gastos || []);
    XLSX.utils.book_append_sheet(wb, wsGastos, "Gastos");
    const wsKm = XLSX.utils.json_to_sheet(panelData.kmDiarios || []);
    XLSX.utils.book_append_sheet(wb, wsKm, "Kilometraje");
    const simplifiedDeudas = (panelData.deudas || []).map(d => ({
      id: d.id,
      nombre: d.nombre,
      montoTotal: d.montoTotal,
      saldoPendiente: d.saldo,
      abonadoTotal: d.abonadoTotal,
      frecuencia: d.frecuencia,
      creadaEn: fmtDateLocal(d.creadaEn)
    }));
    const wsDeudas = XLSX.utils.json_to_sheet(simplifiedDeudas);
    XLSX.utils.book_append_sheet(wb, wsDeudas, "Deudas");
    const simplifiedTurnos = (panelData.turnos || []).map(t => ({
      Fecha: fmtDateLocal(t.timestamp ?? t.finTS ?? t.fin),
      HoraInicio: new Date(Number(t.inicioTS ?? 0)).toLocaleTimeString(),
      HoraFin: new Date(Number(t.finTS ?? 0)).toLocaleTimeString(),
      Duracion_Horas: t.horas,
      Ganancia_Bruta: t.ganancia,
      KM_Recorrido: t.kmRecorrido
    }));
    const wsTurnos = XLSX.utils.json_to_sheet(simplifiedTurnos);
    XLSX.utils.book_append_sheet(wb, wsTurnos, "Turnos");
    XLSX.writeFile(wb, "panelData_export.xlsx");
  } catch (e) {
    console.error("Error exportando Excel:", e);
    alert("Error exportando Excel.");
  }
}

// ---------- Cálculos automáticos ----------
function calcularMetricasAutomaticas() {
  calcularDeudaTotalAuto();
  calcularGastoFijoAuto();
  calcularCostosPorKmAuto();
  guardarPanelData();
}

function calcularDeudaTotalAuto() {
  const total = (panelData.deudas || []).reduce((s, d) => s + Math.max(0, safeNumber(d.saldo, 0)), 0);
  panelData.parametros.deudaTotal = total;
  if ($("proyDeudaTotal")) $("proyDeudaTotal").value = `$${fmtMoney(total)}`;
}

function calcularGastoFijoAuto() {
  const gastosHogar = (panelData.gastos || []).filter(g => typeof g.categoria === 'string' && g.categoria.includes("HOGAR"));
  if (gastosHogar.length === 0) {
    panelData.parametros.gastoFijo = 0;
    if ($("proyGastoFijo")) $("proyGastoFijo").value = "$0.00";
    return;
  }
  const daySet = new Set();
  for (const g of gastosHogar) {
    const ts = safeNumber(g.timestamp, null);
    const key = ts ? getDateKey(ts) : getDateKey(g.fechaLocal ? new Date(g.fechaLocal).getTime() : Date.now());
    daySet.add(key);
  }
  const totalMonto = gastosHogar.reduce((s, g) => s + safeNumber(g.cantidad, 0), 0);
  const dias = Math.max(1, daySet.size);
  const gastoDiario = totalMonto / dias;
  panelData.parametros.gastoFijo = gastoDiario;
  if ($("proyGastoFijo")) $("proyGastoFijo").value = `$${fmtMoney(gastoDiario)}`;
}

function calcularCostosPorKmAuto() {
  const totalKm = (panelData.kmDiarios || []).reduce((s, k) => s + safeNumber(k.recorrido, 0), 0);
  const totalGas = (panelData.gastos || []).filter(g => g.categoria === "Transporte (Gasolina)").reduce((s, g) => s + safeNumber(g.cantidad, 0), 0);
  const totalMant = (panelData.gastos || []).filter(g => g.categoria === "Mantenimiento VEHÍCULO").reduce((s, g) => s + safeNumber(g.cantidad, 0), 0);
  // Estimación preventiva por KM usando parámetros base
  const basePreventivoPerKm = (
    (300 / 3000) + // aceite
    (500 / 8000) + // bujía
    (1200 / 15000) // llantas
  ); // approx per km
  let costoGasKm = 0, costoMantKm = basePreventivoPerKm;
  if (totalKm > 0) {
    costoGasKm = totalGas / totalKm;
    costoMantKm = (totalMant + (basePreventivoPerKm * totalKm)) / totalKm;
  }
  panelData.parametros.costoPorKm = costoGasKm;
  panelData.parametros.costoMantenimientoPorKm = costoMantKm;
}

// ---------- Render Tabla Turnos ----------
function renderTablaTurnos() {
  const tbody = $("tablaTurnos");
  if (!tbody) return;
  const ultimos = [...(panelData.turnos || [])].sort((a, b) => safeNumber(b.timestamp, 0) - safeNumber(a.timestamp, 0)).slice(0, 10);
  if (ultimos.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center">No hay turnos recientes</td></tr>`;
    return;
  }
  tbody.innerHTML = ultimos.map(t => {
    const fecha = new Date(safeNumber(t.timestamp, t.finTS ?? t.fin ?? Date.now())).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit' });
    const costoOpKm = safeNumber(panelData.parametros.costoPorKm, 0) + safeNumber(panelData.parametros.costoMantenimientoPorKm, 0);
    const neta = safeNumber(t.ganancia, 0) - (safeNumber(t.kmRecorrido, 0) * costoOpKm);
    return `
      <tr>
        <td>${fecha}</td>
        <td>${Number(t.horas || 0).toFixed(1)}h</td>
        <td>${(safeNumber(t.kmRecorrido, 0)).toFixed(0)} km</td>
        <td>$${fmtMoney(neta)}</td>
      </tr>
    `;
  }).join("");
                                                      }


// app.js - Parte 5/5
// Render charts (seguro), render tablaKmMensual, resumen e init

function renderTablaKmMensual() {
  const container = $("tablaKmMensual");
  if (!container) return;
  const stats = {};
  const allKm = panelData.kmDiarios || [];
  const allGastos = panelData.gastos || [];
  const monthLabel = (tsOrDate) => new Date(Number(tsOrDate)).toLocaleDateString('es-MX', { year: 'numeric', month: 'short' });

  for (const k of allKm) {
    const mes = monthLabel(k.timestamp ?? k.fechaLocal ?? Date.now());
    stats[mes] = stats[mes] || { km: 0, gas: 0 };
    stats[mes].km += safeNumber(k.recorrido, 0);
  }
  for (const g of allGastos) {
    if (g.categoria === "Transporte (Gasolina)") {
      const mes = monthLabel(g.timestamp ?? g.fechaLocal ?? Date.now());
      stats[mes] = stats[mes] || { km: 0, gas: 0 };
      stats[mes].gas += safeNumber(g.cantidad, 0);
    }
  }
  const rows = Object.keys(stats).sort((a, b) => {
    const da = new Date(a).getTime();
    const db = new Date(b).getTime();
    return db - da;
  }).map(mes => {
    const d = stats[mes];
    const costoKm = d.km > 0 ? (d.gas / d.km) : 0;
    return `<tr><td>${mes}</td><td>${d.km.toFixed(0)} km</td><td>$${fmtMoney(d.gas)}</td><td>$${fmtMoney(costoKm)}</td></tr>`;
  }).join("");
  container.innerHTML = `
    <table class="tabla">
      <thead><tr><th>Mes</th><th>KM</th><th>Gasolina ($)</th><th>$/KM</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="4" style="text-align:center">Sin datos</td></tr>'}</tbody>
    </table>
  `;
}

// ---------- Charts seguros (Chart.js) ----------
function renderCharts() {
  // defensas: si Chart no está cargado, salir silenciosamente
  if (typeof Chart === "undefined") return;
  try {
    // Datos últimos 14 días (ingresos vs gastos trabajo)
    const days = 14;
    const labels = [];
    const incomes = [];
    const expenses = [];
    const today = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const key = getDateKey(d);
      labels.push(d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit' }));
      // sumar ingresos/gastos de ese dayKey
      const ing = (panelData.ingresos || []).filter(it => getDateKey(it.timestamp) === key).reduce((s, it) => s + safeNumber(it.cantidad, 0), 0);
      const gas = (panelData.gastos || []).filter(g => getDateKey(g.timestamp) === key && (String(g.categoria || "").includes("TRABAJO") || String(g.categoria || "").includes("Transporte"))).reduce((s, g) => s + safeNumber(g.cantidad, 0), 0);
      incomes.push(ing);
      expenses.push(gas);
    }

    // Ganancias chart
    const ctx1 = $("graficaGanancias");
    if (ctx1) {
      if (gananciasChart) gananciasChart.destroy();
      gananciasChart = new Chart(ctx1.getContext('2d'), {
        type: 'bar',
        data: {
          labels,
          datasets: [
            { label: 'Ingresos', data: incomes, stack: 'stack1' },
            { label: 'Gastos Trabajo', data: expenses, stack: 'stack1' }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: true } },
          scales: { y: { beginAtZero: true } }
        }
      });
    }

    // KM chart: Ganancia neta por KM o KM recorridos por día
    const ctx2 = $("graficaKm");
    if (ctx2) {
      if (kmChart) kmChart.destroy();
      // Mostrar KM diarios
      const kmLabels = [];
      const kmData = [];
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        const key = getDateKey(d);
        const totalKm = (panelData.kmDiarios || []).filter(k => getDateKey(k.timestamp) === key).reduce((s, k) => s + safeNumber(k.recorrido, 0), 0);
        kmLabels.push(d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit' }));
        kmData.push(totalKm);
      }
      kmChart = new Chart(ctx2.getContext('2d'), {
        type: 'line',
        data: { labels: kmLabels, datasets: [{ label: 'KM Recorridos', data: kmData, fill: false }] },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
      });
    }
  } catch (e) {
    console.error("Error renderCharts:", e);
  }
}

// ---------- Render resumen y proyecciones ----------
function calcularResumenDatos() {
  const todayKey = getDateKey(); // YYYY-MM-DD
  const ingresosHoy = (panelData.ingresos || []).filter(i => getDateKey(i.timestamp) === todayKey);
  const gastosHoy = (panelData.gastos || []).filter(g => getDateKey(g.timestamp) === todayKey);
  const turnosHoy = (panelData.turnos || []).filter(t => getDateKey(t.timestamp) === todayKey);
  const horasHoy = turnosHoy.reduce((s, t) => s + safeNumber(t.horas, 0), 0);
  const ganHoy = ingresosHoy.reduce((s, i) => s + safeNumber(i.cantidad, 0), 0);
  const gastTrabajoHoy = gastosHoy.filter(g => typeof g.categoria === 'string' && (g.categoria.includes("TRABAJO") || g.categoria.includes("Transporte"))).reduce((s, g) => s + safeNumber(g.cantidad, 0), 0);
  const netaHoy = ganHoy - gastTrabajoHoy;
  const kmHoy = (panelData.kmDiarios || []).filter(k => getDateKey(k.timestamp) === todayKey).reduce((s, k) => s + safeNumber(k.recorrido, 0), 0);
  return { horasHoy, ganHoy, gastTrabajoHoy, netaHoy, kmHoy, ingresosHoy, gastosHoy, turnosHoy };
}

function renderResumenIndex() {
  if (!$("resHoras")) return;
  const r = calcularResumenDatos();
  $("resHoras").textContent = `${(r.horasHoy || 0).toFixed(2)}h`;
  $("resGananciaBruta").textContent = `$${fmtMoney(r.ganHoy)}`;
  $("resGastosTrabajo").textContent = `$${fmtMoney(r.gastTrabajoHoy)}`;
  $("resNeta").textContent = `$${fmtMoney(r.netaHoy)}`;
  // Proyecciones
  if ($("proyDeuda")) $("proyDeuda").textContent = `$${fmtMoney(panelData.parametros.deudaTotal)}`;
  if ($("proyGastoFijoDiario")) $("proyGastoFijoDiario").textContent = `$${fmtMoney(panelData.parametros.gastoFijo)}`;
  if ($("proyNetaPromedio")) {
    // Calculamos neta diaria promedio aproximada:
    const totalIng = (panelData.ingresos || []).reduce((s, i) => s + safeNumber(i.cantidad, 0), 0);
    const totalGastTrabajo = (panelData.gastos || []).filter(g => typeof g.categoria === 'string' && (g.categoria.includes("TRABAJO") || g.categoria.includes("Transporte") || g.categoria.includes("Mantenimiento VEHÍCULO") || g.categoria.includes("Abono a Deuda"))).reduce((s, g) => s + safeNumber(g.cantidad, 0), 0);
    const diasTrabajados = Math.max(1, new Set((panelData.ingresos || []).map(i => getDateKey(i.timestamp))).size);
    const netoDiarioProm = (totalIng - totalGastTrabajo) / diasTrabajados;
    $("proyNetaPromedio").textContent = `$${fmtMoney(netoDiarioProm)}`;
  }
  // Actualizar tablas y graficas
  renderTablaTurnos();
  renderTablaKmMensual();
  renderCharts();
  renderDeudas();
}

// ---------- INIT ----------
function initApp() {
  cargarPanelData();
  // Detectar si estamos en admin o index por título
  const title = (document.title || "").toLowerCase();
  // Listeners comunes
  setupIoListeners();
  // Admin page
  if (title.includes("administración") || title.includes("administracion")) {
    setupIngresoListeners();
    setupGastoListeners();
    setupGasListeners();
    setupDeudaWizardListeners();
    setupAbonoListeners();
    setupKmListeners();
    if ($("btnIniciarTurno")) $("btnIniciarTurno").addEventListener("click", iniciarTurno);
    if ($("btnFinalizarTurno")) $("btnFinalizarTurno").addEventListener("click", finalizarTurno);
    actualizarUIturno();
    renderDeudas();
    updateDeudaWizardUI();
  }
  // Index page
  if (title.includes("resultados") || title.includes("dashboard") || title.includes("panel de resultados")) {
    renderResumenIndex();
  }
  // Precargar KM inicial
  if ($("kmInicial") && panelData.parametros.ultimoKMfinal !== null) {
    $("kmInicial").value = Number(panelData.parametros.ultimoKMfinal).toFixed(0);
  }
  // Calculos iniciales
  calcularMetricasAutomaticas();
  // UI inicial
  actualizarUIturno();
}

document.addEventListener("DOMContentLoaded", initApp);
