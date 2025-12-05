// app.js — Versión completa (estable)
// Compatible con index.html, admin.html, historial.html, tutorial.html
// Autor: ChatGPT (entrega para tu proyecto Uber Eats Tracker)

// =========================
// Utilidades y constantes
// =========================
const STORAGE_KEY = "panelData";
const BACKUP_KEY = "panelData_backup_v1";
const TUTORIAL_VISTO_KEY = "tutorialVisto";

const $ = id => document.getElementById(id);

function safeNumber(v, fallback = 0) {
  if (v === null || v === undefined || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function fmtMoney(amount, decimals = 2) {
  const n = safeNumber(amount, 0);
  return n.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function fmtDateLocal(ts = Date.now()) {
  try {
    return new Date(Number(ts)).toLocaleString('es-MX', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  } catch {
    return new Date().toLocaleString('es-MX');
  }
}

function getDateKey(date) {
  const d = date ? new Date(Number(date)) : new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

// =========================
// Estructura base y migraciones ligeras
// =========================
let panelData = {
  ingresos: [],
  gastos: [],
  kmDiarios: [],
  gasolina: [],
  deudas: [],
  turnos: [],
  movimientos: [],
  parametros: {
    deudaTotal: 0,
    gastoFijo: 0,
    ultimoKMfinal: null,
    costoPorKm: 0,
    costoMantenimientoPorKm: 0
  }
};

function runMigrationsIfNeeded(parsed) {
  // Merge parsed into panelData safely
  if (!parsed || typeof parsed !== 'object') return;
  // shallow merge arrays and parametros
  panelData.ingresos = Array.isArray(parsed.ingresos) ? parsed.ingresos : panelData.ingresos;
  panelData.gastos = Array.isArray(parsed.gastos) ? parsed.gastos : panelData.gastos;
  panelData.kmDiarios = Array.isArray(parsed.kmDiarios) ? parsed.kmDiarios : panelData.kmDiarios;
  panelData.gasolina = Array.isArray(parsed.gasolina) ? parsed.gasolina : panelData.gasolina;
  panelData.deudas = Array.isArray(parsed.deudas) ? parsed.deudas : panelData.deudas;
  panelData.turnos = Array.isArray(parsed.turnos) ? parsed.turnos : panelData.turnos;
  panelData.movimientos = Array.isArray(parsed.movimientos) ? parsed.movimientos : panelData.movimientos;
  panelData.parametros = { ...panelData.parametros, ...(parsed.parametros || {}) };

  // Normalize timestamps for collections where relevant
  const normalize = item => {
    if (!item || typeof item !== 'object') return null;
    if (!item.timestamp && item.fechaLocal) {
      try {
        item.timestamp = new Date(item.fechaLocal).getTime();
      } catch {
        item.timestamp = Date.now();
      }
    }
    if (!item.timestamp) item.timestamp = item.ts ?? Date.now();
    return item;
  };
  panelData.ingresos = panelData.ingresos.map(normalize).filter(Boolean);
  panelData.gastos = panelData.gastos.map(normalize).filter(Boolean);
  panelData.kmDiarios = panelData.kmDiarios.map(normalize).filter(Boolean);
  panelData.turnos = panelData.turnos.map(t => {
    if (!t || typeof t !== 'object') return null;
    t.inicioTS = safeNumber(t.inicioTS ?? t.inicio ?? t.horaInicio ?? t.timestamp, null);
    t.finTS = safeNumber(t.finTS ?? t.fin ?? t.horaFin ?? t.timestamp, null);
    t.horas = (t.horas !== undefined) ? safeNumber(t.horas, 0) : (t.inicioTS && t.finTS ? ((t.finTS - t.inicioTS) / 3600000) : 0);
    t.ganancia = safeNumber(t.ganancia ?? t.cantidad ?? 0, 0);
    t.kmRecorrido = safeNumber(t.kmRecorrido ?? t.recorrido ?? (safeNumber(t.kmFin, 0) - safeNumber(t.kmInicio, 0)), 0);
    return t;
  }).filter(Boolean);

  // Normalize deudas
  panelData.deudas = (panelData.deudas || []).map(d => {
    if (!d || typeof d !== 'object') return null;
    return {
      id: d.id ?? (Date.now().toString(36) + Math.random().toString(36).slice(2, 8)),
      nombre: d.nombre ?? d.name ?? "Deuda",
      montoTotal: safeNumber(d.montoTotal ?? d.monto ?? 0, 0),
      abonadoTotal: safeNumber(d.abonadoTotal ?? d.abonado ?? 0, 0),
      saldo: safeNumber(d.saldo ?? (safeNumber(d.montoTotal ?? d.monto ?? 0, 0) - safeNumber(d.abonadoTotal ?? d.abonado ?? 0, 0)), 0),
      frecuencia: d.frecuencia ?? "Mensual",
      abonoSugerido: safeNumber(d.abonoSugerido ?? 0, 0),
      creadaEn: Number(d.creadaEn ?? d.timestamp ?? Date.now()),
      historialAbonos: Array.isArray(d.historialAbonos) ? d.historialAbonos : (Array.isArray(d.historial) ? d.historial : [])
    };
  }).filter(Boolean);

  // Ensure parametros fields exist
  panelData.parametros = panelData.parametros || {};
  panelData.parametros.deudaTotal = safeNumber(panelData.parametros.deudaTotal, 0);
  panelData.parametros.gastoFijo = safeNumber(panelData.parametros.gastoFijo, 0);
  panelData.parametros.ultimoKMfinal = (panelData.parametros.ultimoKMfinal !== undefined) ? panelData.parametros.ultimoKMfinal : null;
  panelData.parametros.costoPorKm = safeNumber(panelData.parametros.costoPorKm, 0);
  panelData.parametros.costoMantenimientoPorKm = safeNumber(panelData.parametros.costoMantenimientoPorKm, 0);
}

// =========================
// Carga/Guardado/Backup
// =========================
function cargarPanelData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    runMigrationsIfNeeded(parsed);
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
  }
}

// =========================
// Tutorial: Modal y bloqueo
// =========================
let tutorialPaso = 0;
const tutorialMensajes = [
  { t: "Bienvenido", m: "Este panel te ayudará a controlar ingresos, gastos y kilometraje." },
  { t: "Administrador", m: "En el Administrador podrás registrar turnos, gasolina, ingresos y gastos." },
  { t: "Panel", m: "El Panel muestra tus métricas, proyecciones y últimos turnos." },
  { t: "Historial", m: "En Historial puedes ver el detalle completo de tus movimientos." },
  { t: "Listo", m: "Comienza a usar el sistema. ¡Éxito en tus entregas!" }
];

function mostrarTutorialUI(show = true) {
  const overlay = $("tutorialOverlay");
  const modal = $("tutorialModal");
  if (!overlay || !modal) return;
  overlay.style.display = show ? "block" : "none";
  modal.style.display = show ? "block" : "none";
}

function iniciarTutorialSiCorresponde() {
  try {
    if (!localStorage.getItem(TUTORIAL_VISTO_KEY)) {
      mostrarTutorialUI(true);
      tutorialPaso = 0;
      const title = $("tutorialTitle");
      const text = $("tutorialText");
      if (title && text && tutorialMensajes[0]) {
        title.textContent = tutorialMensajes[0].t;
        text.textContent = tutorialMensajes[0].m;
      }
      localStorage.setItem(TUTORIAL_VISTO_KEY, "1");
    } else {
      mostrarTutorialUI(false);
    }
  } catch (e) {
    console.error("tutorial init error", e);
  }
}

function avanzarTutorial() {
  tutorialPaso++;
  if (tutorialPaso >= tutorialMensajes.length) {
    mostrarTutorialUI(false);
    return;
  }
  const title = $("tutorialTitle");
  const text = $("tutorialText");
  if (title && text && tutorialMensajes[tutorialPaso]) {
    title.textContent = tutorialMensajes[tutorialPaso].t;
    text.textContent = tutorialMensajes[tutorialPaso].m;
  }
}

// No bloqueamos todos los enlaces; solo si modal visible
document.addEventListener("click", (ev) => {
  const tgt = ev.target;
  if (tgt && (tgt.id === "tutorialNextBtn" || tgt.matches && tgt.matches("#tutorialNextBtn"))) {
    ev.preventDefault();
    avanzarTutorial();
    return;
  }
  // Link blocking: if modal visible, block anchors navigation
  if (tgt && tgt.tagName === "A") {
    const overlay = $("tutorialOverlay");
    const modal = $("tutorialModal");
    const tutorialAbierto = overlay && modal && (overlay.style.display !== "none" || modal.style.display !== "none");
    if (tutorialAbierto) ev.preventDefault();
  }
}, { passive: false });

// =========================
// Listeners: Ingresos/Gastos/Gasolina
// =========================
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
      id: Date.now(),
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
      id: Date.now(),
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
      id: Date.now(),
      descripcion: `Gasolina ${litros.toFixed(2)} L`,
      cantidad: costo,
      litros,
      categoria: "Transporte (Gasolina)",
      fechaLocal: fmtDateLocal(),
      timestamp: Date.now()
    };
    panelData.gastos.push(carga);
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

// =========================
// Turnos y KM
// =========================
let turnoActivo = JSON.parse(localStorage.getItem("turnoActivo") || "false");
let turnoInicio = localStorage.getItem("turnoInicio") || null;

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
  // prefer parametro ultimoKMfinal or input
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
  if (ganancia >= 0 && recorrido >= 0) {
    const nuevoTurno = {
      id: Date.now(),
      inicioTS: inicioTS,
      finTS: finTS,
      horas: Number(horas.toFixed(2)),
      ganancia,
      kmRecorrido: recorrido,
      kmInicial: kmInicialTurno,
      kmFinal: kmFinal,
      fechaLocal: fmtDateLocal(finTS),
      timestamp: finTS
    };
    panelData.turnos.push(nuevoTurno);
    panelData.ingresos.push({
      id: Date.now() + 1,
      descripcion: `Ganancia turno (${horas.toFixed(2)}h)`,
      cantidad: ganancia,
      fechaLocal: fmtDateLocal(finTS),
      timestamp: finTS
    });
    if (recorrido > 0) {
      panelData.kmDiarios.push({
        id: Date.now() + 2,
        fechaLocal: fmtDateLocal(finTS),
        recorrido,
        inicial: kmInicialTurno,
        final: kmFinal,
        timestamp: finTS
      });
      panelData.parametros.ultimoKMfinal = kmFinal;
    }
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
      id: Date.now(),
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

// =========================
// Deudas: wizard y abonos
// =========================
let deudaWizardStep = 1;
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
      id: Date.now().toString(),
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
    const historial = { monto, fechaLocal: fmtDateLocal(), timestamp: Date.now() };
    deuda.historialAbonos = deuda.historialAbonos || [];
    deuda.historialAbonos.push(historial);
    panelData.gastos.push({
      id: Date.now(),
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
      const li = document.createElement("li");
      li.innerHTML = `<strong>${deuda.nombre}</strong> (${deuda.frecuencia})<br>
          Total: $${fmtMoney(deuda.montoTotal)} | Abonado: $${fmtMoney(deuda.abonadoTotal)} | Pendiente: <span style="color:red;">$${fmtMoney(deuda.saldo)}</span>`;
      lista.appendChild(li);
      const opt = document.createElement("option");
      opt.value = deuda.id;
      opt.textContent = `${deuda.nombre} ($${fmtMoney(deuda.saldo)} Pendiente)`;
      select.appendChild(opt);
    }
  }
}

// =========================
// IO: Export / Import / Excel
// =========================
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
        if (!confirm("ADVERTENCIA: reemplazar datos actuales con datos importados?")) return;
        const imported = JSON.parse(json);
        runMigrationsIfNeeded(imported);
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
    if (typeof XLSX === "undefined") return alert("XLSX no disponible.");
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
    XLSX.writeFile(wb, "panelData_export.xlsx");
  } catch (e) {
    console.error("Error exportando Excel:", e);
    alert("Error exportando Excel.");
  }
}

// =========================
// Cálculos automáticos y métricas
// =========================
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
  const totalKm = (panelData.kmDiarios || []).reduce((s, k) => s + safeNumber(k.recorrido ?? k.km, 0), 0);
  const totalGas = (panelData.gastos || []).filter(g => g.categoria === "Transporte (Gasolina)").reduce((s, g) => s + safeNumber(g.cantidad, 0), 0);
  const totalMant = (panelData.gastos || []).filter(g => g.categoria === "Mantenimiento VEHÍCULO").reduce((s, g) => s + safeNumber(g.cantidad, 0), 0);
  const basePreventivoPerKm = ((300 / 3000) + (500 / 8000) + (1200 / 15000));
  let costoGasKm = 0, costoMantKm = basePreventivoPerKm;
  if (totalKm > 0) {
    costoGasKm = totalGas / totalKm;
    costoMantKm = (totalMant + (basePreventivoPerKm * totalKm)) / totalKm;
  }
  panelData.parametros.costoPorKm = costoGasKm;
  panelData.parametros.costoMantenimientoPorKm = costoMantKm;
}

// =========================
// Render: tablas, graficas, resumen
// =========================
let gananciasChart = null;
let kmChart = null;

function renderTablaTurnos() {
  const tbody = $("tablaTurnos");
  if (!tbody) return;
  const ultimos = [...(panelData.turnos || [])].sort((a, b) => safeNumber(b.timestamp, b.finTS ?? b.fin ?? 0) - safeNumber(a.timestamp, a.finTS ?? a.fin ?? 0)).slice(0, 10);
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
    stats[mes].km += safeNumber(k.recorrido ?? k.km, 0);
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

function renderCharts() {
  if (typeof Chart === "undefined") return;
  try {
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
      const ing = (panelData.ingresos || []).filter(it => getDateKey(it.timestamp) === key).reduce((s, it) => s + safeNumber(it.cantidad ?? it.monto ?? it.amount, 0), 0);
      const gas = (panelData.gastos || []).filter(g => getDateKey(g.timestamp) === key && (String(g.categoria || "").includes("TRABAJO") || String(g.categoria || "").includes("Transporte") || String(g.categoria || "").includes("Gasolina"))).reduce((s, g) => s + safeNumber(g.cantidad ?? g.monto, 0), 0);
      incomes.push(ing);
      expenses.push(gas);
    }

    const ctx1 = $("graficaGanancias");
    if (ctx1) {
      if (gananciasChart) gananciasChart.destroy();
      gananciasChart = new Chart(ctx1.getContext('2d'), {
        type: 'bar',
        data: { labels, datasets: [{ label: 'Ingresos', data: incomes, stack: 'stack1' }, { label: 'Gastos Trabajo', data: expenses, stack: 'stack1' }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true } }, scales: { y: { beginAtZero: true } } }
      });
    }

    const ctx2 = $("graficaKm");
    if (ctx2) {
      if (kmChart) kmChart.destroy();
      const kmLabels = [];
      const kmData = [];
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        const key = getDateKey(d);
        const totalKm = (panelData.kmDiarios || []).filter(k => getDateKey(k.timestamp) === key).reduce((s, k) => s + safeNumber(k.recorrido ?? k.km, 0), 0);
        kmLabels.push(d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit' }));
        kmData.push(totalKm);
      }
      kmChart = new Chart(ctx2.getContext('2d'), { type: 'line', data: { labels: kmLabels, datasets: [{ label: 'KM Recorridos', data: kmData, fill: false }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } } });
    }
  } catch (e) {
    console.error("Error renderCharts:", e);
  }
}

function calcularResumenDatos() {
  const todayKey = getDateKey();
  const ingresosHoy = (panelData.ingresos || []).filter(i => getDateKey(i.timestamp) === todayKey);
  const gastosHoy = (panelData.gastos || []).filter(g => getDateKey(g.timestamp) === todayKey);
  const turnosHoy = (panelData.turnos || []).filter(t => getDateKey(t.timestamp ?? t.finTS ?? t.fin) === todayKey);
  const horasHoy = turnosHoy.reduce((s, t) => s + safeNumber(t.horas, 0), 0);
  const ganHoy = ingresosHoy.reduce((s, i) => s + safeNumber(i.cantidad ?? i.monto ?? i.amount, 0), 0);
  const gastTrabajoHoy = gastosHoy.filter(g => typeof g.categoria === 'string' && (g.categoria.includes("TRABAJO") || g.categoria.includes("Transporte") || g.categoria.includes("Gasolina"))).reduce((s, g) => s + safeNumber(g.cantidad ?? g.monto, 0), 0);
  const netaHoy = ganHoy - gastTrabajoHoy;
  const kmHoy = (panelData.kmDiarios || []).filter(k => getDateKey(k.timestamp) === todayKey).reduce((s, k) => s + safeNumber(k.recorrido ?? k.km, 0), 0);
  return { horasHoy, ganHoy, gastTrabajoHoy, netaHoy, kmHoy, ingresosHoy, gastosHoy, turnosHoy };
}

function renderResumenIndex() {
  if (!$("resHoras")) return;
  const r = calcularResumenDatos();
  $("resHoras").textContent = `${(r.horasHoy || 0).toFixed(2)}h`;
  if ($("resGananciaBruta")) $("resGananciaBruta").textContent = `$${fmtMoney(r.ganHoy)}`;
  if ($("resGastosTrabajo")) $("resGastosTrabajo").textContent = `$${fmtMoney(r.gastTrabajoHoy)}`;
  if ($("resNeta")) $("resNeta").textContent = `$${fmtMoney(r.netaHoy)}`;
  if ($("proyDeuda")) $("proyDeuda").textContent = `$${fmtMoney(panelData.parametros.deudaTotal)}`;
  if ($("proyGastoFijoDiario")) $("proyGastoFijoDiario").textContent = `$${fmtMoney(panelData.parametros.gastoFijo)}`;
  if ($("proyNetaPromedio")) {
    const totalIng = (panelData.ingresos || []).reduce((s, i) => s + safeNumber(i.cantidad ?? i.monto, 0), 0);
    const totalGastTrabajo = (panelData.gastos || []).filter(g => typeof g.categoria === 'string' && (g.categoria.includes("TRABAJO") || g.categoria.includes("Transporte") || g.categoria.includes("Mantenimiento VEHÍCULO") || g.categoria.includes("Abono a Deuda"))).reduce((s, g) => s + safeNumber(g.cantidad ?? g.monto, 0), 0);
    const diasTrabajados = Math.max(1, new Set((panelData.ingresos || []).map(i => getDateKey(i.timestamp))).size);
    const netoDiarioProm = (totalIng - totalGastTrabajo) / diasTrabajados;
    $("proyNetaPromedio").textContent = `$${fmtMoney(netoDiarioProm)}`;
  }
  renderTablaTurnos();
  renderTablaKmMensual();
  renderCharts();
  renderDeudas();
}

// =========================
// Historial / Render movimientos
// =========================
function renderHistorial() {
  const body = $("historialBody");
  const resumen = $("historialResumen");
  if (!body) return;
  body.innerHTML = "";
  const movs = [
    ...(panelData.ingresos || []).map(i => ({ tipo: "Ingreso", fecha: i.fechaLocal ?? i.fecha ?? fmtDateLocal(i.timestamp), descripcion: i.descripcion ?? "-", monto: safeNumber(i.cantidad ?? i.monto, 0) })),
    ...(panelData.gastos || []).map(g => ({ tipo: "Gasto", fecha: g.fechaLocal ?? g.fecha ?? fmtDateLocal(g.timestamp), descripcion: g.descripcion ?? "-", monto: safeNumber(g.cantidad ?? g.monto, 0) }))
  ].sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
  for (const m of movs) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${m.tipo}</td><td>${m.fecha}</td><td>${m.descripcion}</td><td>$${fmtMoney(m.monto)}</td>`;
    body.appendChild(tr);
  }
  const totalIng = (panelData.ingresos || []).reduce((t, x) => t + safeNumber(x.cantidad ?? x.monto, 0), 0);
  const totalGas = (panelData.gastos || []).reduce((t, x) => t + safeNumber(x.cantidad ?? x.monto, 0), 0);
  if (resumen) resumen.innerHTML = `<p>Total ingresos: <strong>$${fmtMoney(totalIng)}</strong></p><p>Total gastos: <strong>$${fmtMoney(totalGas)}</strong></p><p>Neto: <strong>$${fmtMoney(totalIng - totalGas)}</strong></p>`;
}

// =========================
// Inicialización y listeners globales
// =========================
function setupAllListeners() {
  setupIngresoListeners();
  setupGastoListeners();
  setupGasListeners();
  setupDeudaWizardListeners();
  setupAbonoListeners();
  setupKmListeners();
  setupIoListeners();

  if ($("btnIniciarTurno")) $("btnIniciarTurno").addEventListener("click", iniciarTurno);
  if ($("btnFinalizarTurno")) $("btnFinalizarTurno").addEventListener("click", finalizarTurno);

  if ($("tutorialNextBtn")) $("tutorialNextBtn").addEventListener("click", (e) => { e.preventDefault(); avanzarTutorial(); });

  // Quick navigation buttons (if present)
  if ($("adminButton")) $("adminButton").addEventListener("click", (e) => { /* normal anchor will work */ });
  if ($("historialButton")) $("historialButton").addEventListener("click", (e) => { /* normal anchor will work */ });

  // Export / Import mapped in setupIoListeners
}

// =========================
// Safe initial render
// =========================
function initApp() {
  cargarPanelData();
  // Ensure parametros exist
  panelData.parametros = panelData.parametros || {};
  panelData.parametros.deudaTotal = safeNumber(panelData.parametros.deudaTotal, 0);
  panelData.parametros.gastoFijo = safeNumber(panelData.parametros.gastoFijo, 0);
  panelData.parametros.ultimoKMfinal = (panelData.parametros.ultimoKMfinal !== undefined) ? panelData.parametros.ultimoKMfinal : null;
  panelData.parametros.costoPorKm = safeNumber(panelData.parametros.costoPorKm, 0);
  panelData.parametros.costoMantenimientoPorKm = safeNumber(panelData.parametros.costoMantenimientoPorKm, 0);

  setupAllListeners();
  iniciarTutorialSiCorresponde();
  actualizarUIturno();
  calcularMetricasAutomaticas();
  renderResumenIndex();
  renderHistorial();
  renderTablaTurnos();
  renderTablaKmMensual();
  renderDeudas();
}

// Auto init
document.addEventListener("DOMContentLoaded", initApp);
