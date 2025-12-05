// ===============================
//  UTILIDADES Y LOCALSTORAGE
// ===============================
const $ = id => document.getElementById(id);

function guardarData() {
    localStorage.setItem("panelData", JSON.stringify(panelData));
    localStorage.setItem("panelData_backup_v1", JSON.stringify(panelData));
}

function cargarData() {
    const data = localStorage.getItem("panelData");
    if (!data) return null;

    try {
        return JSON.parse(data);
    } catch {
        return null;
    }
}

// ===============================
//  ESTRUCTURA PRINCIPAL
// ===============================
let panelData = cargarData() || {
    ingresos: [],
    gastos: [],
    gasolina: [],
    kmDiarios: [],
    turnos: [],
    deudas: [],
    parametros: {
        gastoFijoDiario: 0,
        deudaTotal: 0
    }
};

// ===============================
//  FECHAS
// ===============================
function hoy() {
    const d = new Date();
    return d.toISOString().slice(0, 10);
}

// ===============================
//  TUTORIAL (Overlay + Modal)
// ===============================
let tutorialPaso = 0;
let tutorialActivo = false;

const tutorialOverlay = $("tutorialOverlay");
const tutorialModal = $("tutorialModal");
const tutorialTitle = $("tutorialTitle");
const tutorialText = $("tutorialText");
const tutorialNextBtn = $("tutorialNextBtn");

const tutorialMensajes = [
    { t: "Bienvenido", m: "Este panel te ayudará a controlar ingresos, gastos y kilometraje." },
    { t: "Administrador", m: "En el Administrador podrás registrar turnos, gasolina, ingresos y gastos." },
    { t: "Panel", m: "El Panel muestra tus métricas, proyecciones y últimos turnos." },
    { t: "Historial", m: "En Historial puedes ver el detalle completo de tus movimientos." },
    { t: "Listo", m: "Comienza a usar el sistema. ¡Éxito en tus entregas!" }
];

function iniciarTutorial() {
    tutorialActivo = true;
    tutorialPaso = 0;
    tutorialOverlay.style.display = "block";
    tutorialModal.style.display = "block";
    mostrarTutorialPaso();
}

function mostrarTutorialPaso() {
    const p = tutorialMensajes[tutorialPaso];
    tutorialTitle.textContent = p.t;
    tutorialText.textContent = p.m;
}

tutorialNextBtn?.addEventListener("click", () => {
    tutorialPaso++;
    if (tutorialPaso >= tutorialMensajes.length) {
        tutorialOverlay.style.display = "none";
        tutorialModal.style.display = "none";
        tutorialActivo = false;
        return;
    }
    mostrarTutorialPaso();
});

// ===============================
//  SOLUCIÓN: Enlaces funcionando
// ===============================
document.querySelectorAll("a").forEach(a => {
    a.addEventListener("click", (e) => {
        const overlay = $("tutorialOverlay");
        const modal = $("tutorialModal");

        const tutorialAbierto =
            overlay && modal &&
            (overlay.style.display !== "none" || modal.style.display !== "none");

        if (tutorialAbierto) {
            e.preventDefault();
        }
    });
});

// AUTO-INICIAR TUTORIAL SOLO PRIMERA VEZ
if (!localStorage.getItem("tutorialVisto")) {
    iniciarTutorial();
    localStorage.setItem("tutorialVisto", "1");
}
// ====================================
//  TURNOS
// ====================================
function iniciarTurno() {
    let km = prompt("KM Inicial (odómetro):", "0");
    km = Number(km);

    const turno = {
        id: Date.now(),
        fecha: hoy(),
        horaInicio: Date.now(),
        horaFin: null,
        kmInicio: km,
        kmFin: null
    };

    panelData.turnos.push(turno);
    guardarData();
    mostrarEstadoTurno();
}

function finalizarTurno() {
    const t = panelData.turnos.find(x => !x.horaFin);
    if (!t) return;

    let kmf = prompt("KM Final (odómetro):", "0");
    kmf = Number(kmf);

    if (kmf <= t.kmInicio) {
        alert("El KM final debe ser mayor.");
        return;
    }

    t.horaFin = Date.now();
    t.kmFin = kmf;

    const horas = (t.horaFin - t.horaInicio) / 3600000;
    const km = t.kmFin - t.kmInicio;

    panelData.kmDiarios.push({
        fecha: hoy(),
        horas,
        km
    });

    guardarData();
    mostrarEstadoTurno();
}

function mostrarEstadoTurno() {
    const t = panelData.turnos.find(x => !x.horaFin);

    if ($("turnoTexto")) {
        if (t) {
            $("turnoTexto").textContent = `🟢 Turno activo – KM inicial: ${t.kmInicio}`;
            $("btnIniciarTurno").style.display = "none";
            $("btnFinalizarTurno").style.display = "block";
        } else {
            $("turnoTexto").textContent = "🔴 Sin turno activo";
            $("btnIniciarTurno").style.display = "block";
            $("btnFinalizarTurno").style.display = "none";
        }
    }
}

// ====================================
//  INGRESOS / GASTOS
// ====================================
function guardarIngreso() {
    const desc = $("ingresoDescripcion").value.trim();
    const cant = Number($("ingresoCantidad").value);

    if (!desc || cant <= 0) return alert("Datos inválidos");

    panelData.ingresos.push({
        id: Date.now(),
        fecha: hoy(),
        descripcion: desc,
        monto: cant
    });

    guardarData();
    $("ingresoDescripcion").value = "";
    $("ingresoCantidad").value = "";
    alert("Ingreso guardado.");
}

function guardarGasto() {
    const desc = $("gastoDescripcion")?.value.trim();
    const cant = Number($("gastoCantidad")?.value);
    const cat = $("gastoCategoria")?.value;

    if (!desc || cant <= 0 || !cat) return alert("Datos inválidos");

    panelData.gastos.push({
        id: Date.now(),
        fecha: hoy(),
        descripcion: desc,
        monto: cant,
        categoria: cat
    });

    guardarData();
    alert("Gasto registrado.");
}

// ====================================
//  GASOLINA
// ====================================
function guardarGasolina() {
    const litros = Number($("litrosGas").value);
    const costo = Number($("costoGas").value);

    if (litros <= 0 || costo <= 0) return alert("Valores inválidos");

    panelData.gasolina.push({
        id: Date.now(),
        fecha: hoy(),
        litros,
        costo
    });

    panelData.gastos.push({
        id: Date.now() + 1,
        fecha: hoy(),
        descripcion: "Gasolina",
        monto: costo,
        categoria: "Gasolina TRABAJO"
    });

    guardarData();
    alert("Gasolina registrada correctamente.");
}
// =====================================
//   DEUDAS
// =====================================
function registrarDeuda(nombre, monto, frecuencia, abono) {
    if (!nombre || monto <= 0 || !frecuencia || abono <= 0)
        return alert("Datos inválidos.");

    panelData.deudas.push({
        id: Date.now(),
        nombre,
        montoTotal: monto,
        montoPendiente: monto,
        frecuencia,
        abonoSugerido: abono,
        historial: []
    });

    actualizarParametrosAuto();
    guardarData();
    renderDeudas();
}

function registrarAbono() {
    const id = $("abonoSeleccionar").value;
    const monto = Number($("abonoMonto").value);

    const deuda = panelData.deudas.find(d => d.id == id);
    if (!deuda) return alert("Deuda no encontrada.");

    if (monto <= 0 || monto > deuda.montoPendiente)
        return alert("Abono inválido.");

    deuda.montoPendiente -= monto;
    deuda.historial.push({
        id: Date.now(),
        fecha: hoy(),
        monto
    });

    panelData.gastos.push({
        id: Date.now() + 1,
        fecha: hoy(),
        descripcion: `Abono – ${deuda.nombre}`,
        monto,
        categoria: "Abono a Deuda TRABAJO"
    });

    actualizarParametrosAuto();
    guardarData();
    renderDeudas();
    alert("Abono registrado.");
}

function renderDeudas() {
    const lista = $("listaDeudas");
    const sel = $("abonoSeleccionar");

    if (!lista || !sel) return;

    lista.innerHTML = "";
    sel.innerHTML = "";

    panelData.deudas.forEach(d => {
        const li = document.createElement("li");
        li.textContent = `${d.nombre} – Pendiente: $${d.montoPendiente.toFixed(2)}`;
        lista.appendChild(li);

        const op = document.createElement("option");
        op.value = d.id;
        op.textContent = d.nombre;
        sel.appendChild(op);
    });

    actualizarParametrosAuto();
}
// ========================================
//  PARÁMETROS AUTOMÁTICOS (DEUDA + GASTO FIJO)
// ========================================
function actualizarParametrosAuto() {
    const deudaPend = panelData.deudas.reduce((t, d) => t + d.montoPendiente, 0);

    const gastoFijo = panelData.gastos
        .filter(g => g.categoria.includes("HOGAR"))
        .reduce((t, g) => t + g.monto, 0) / 30;

    panelData.parametros.deudaTotal = deudaPend;
    panelData.parametros.gastoFijoDiario = gastoFijo;

    if ($("proyDeudaTotal")) $("proyDeudaTotal").value = deudaPend.toFixed(2);
    if ($("proyGastoFijo")) $("proyGastoFijo").value = gastoFijo.toFixed(2);

    guardarData();
}

// ========================================
//  CÁLCULO DE MÉTRICAS PRINCIPALES
// ========================================
function calcularMetricas() {
    const hoyIngresos = panelData.ingresos
        .filter(i => i.fecha === hoy())
        .reduce((t, x) => t + x.monto, 0);

    const hoyGastosTrabajo = panelData.gastos
        .filter(g => g.fecha === hoy() && g.categoria.includes("TRABAJO"))
        .reduce((t, x) => t + x.monto, 0);

    const hoyHoras = panelData.kmDiarios
        .filter(k => k.fecha === hoy())
        .reduce((t, x) => t + x.horas, 0);

    const hoyNeta = hoyIngresos - hoyGastosTrabajo;

    // Rellenar panel (index.html)
    if ($("resHoras")) $("resHoras").textContent = hoyHoras.toFixed(2) + "h";
    if ($("resGananciaBruta")) $("resGananciaBruta").textContent = `$${hoyIngresos.toFixed(2)}`;
    if ($("resGastosTrabajo")) $("resGastosTrabajo").textContent = `$${hoyGastosTrabajo.toFixed(2)}`;
    if ($("resNeta")) $("resNeta").textContent = `$${hoyNeta.toFixed(2)}`;

    calcularProyecciones();
    renderTablaTurnos();
    renderHistoricoKm();
    renderGraficas();
}

// ========================================
//  PROYECCIONES FINANCIERAS
// ========================================
function calcularProyecciones() {
    const netas = panelData.kmDiarios.map(d => {
        const ing = panelData.ingresos.filter(i => i.fecha === d.fecha).reduce((t, x) => t + x.monto, 0);
        const gas = panelData.gastos.filter(g => g.fecha === d.fecha && g.categoria.includes("TRABAJO")).reduce((t, x) => t + x.monto, 0);
        return ing - gas;
    });

    const promedioNeta = netas.length ? netas.reduce((a, b) => a + b, 0) / netas.length : 0;

    if ($("proyNetaPromedio")) $("proyNetaPromedio").textContent = `$${promedioNeta.toFixed(2)}`;

    const deuda = panelData.parametros.deudaTotal;
    const gastoFijo = panelData.parametros.gastoFijoDiario;

    const gananciaNetaFinal = promedioNeta - gastoFijo;

    const dias = gananciaNetaFinal > 0 ? deuda / gananciaNetaFinal : Infinity;

    if ($("proyDeuda")) $("proyDeuda").textContent = `$${deuda.toFixed(2)}`;
    if ($("proyGastoFijoDiario")) $("proyGastoFijoDiario").textContent = `$${gastoFijo.toFixed(2)}`;
    if ($("proyDias"))
        $("proyDias").textContent =
            dias === Infinity ? "Necesitas más ganancia" : `${Math.ceil(dias)} días`;

    // Métricas por hora y por km
    const totalHoras = panelData.kmDiarios.reduce((t, x) => t + x.horas, 0);
    const totalKm = panelData.kmDiarios.reduce((t, x) => t + x.km, 0);
    const totalNeta = netas.reduce((a, b) => a + b, 0);

    if (totalHoras > 0) $("proyNetaHoraProm").textContent = `$${(totalNeta / totalHoras).toFixed(2)}`;
    if (totalKm > 0) {
        $("proyNetaKmProm").textContent = `$${(totalNeta / totalKm).toFixed(3)}`;
        const costoTrabajo = panelData.gastos
            .filter(g => g.categoria.includes("TRABAJO"))
            .reduce((t, x) => t + x.monto, 0);

        $("proyCostoTotalKm").textContent = `$${(costoTrabajo / totalKm).toFixed(4)}`;

        const costoGas = panelData.gasolina.reduce((t, x) => t + x.costo, 0);
        $("proyCostoGasKm").textContent = `$${(costoGas / totalKm).toFixed(4)}`;
    }
}
// ========================================
//  TABLA – Últimos Turnos
// ========================================
function renderTablaTurnos() {
    const tbody = $("tablaTurnos");
    if (!tbody) return;

    tbody.innerHTML = "";

    panelData.kmDiarios.slice(-10).forEach(d => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${d.fecha}</td>
            <td>${d.horas.toFixed(2)}</td>
            <td>${d.km}</td>
            <td>$${(d.km > 0 ? (d.km * 0.5).toFixed(2) : "0.00")}</td>
        `;
        tbody.appendChild(tr);
    });
}

// ========================================
//  TABLA – KM mensual
// ========================================
function renderHistoricoKm() {
    const div = $("tablaKmMensual");
    if (!div) return;

    let map = {};
    panelData.kmDiarios.forEach(k => {
        const mes = k.fecha.slice(0, 7);
        map[mes] = (map[mes] || 0) + k.km;
    });

    div.innerHTML = Object.entries(map)
        .map(([m, km]) => `<p><strong>${m}:</strong> ${km} km</p>`)
        .join("");
}

// ========================================
//  HISTORIAL (movimientos)
// ========================================
function renderHistorial() {
    const body = $("historialBody");
    const resumen = $("historialResumen");
    if (!body) return;

    body.innerHTML = "";

    const movs = [
        ...panelData.ingresos.map(i => ({ tipo: "Ingreso", ...i })),
        ...panelData.gastos.map(g => ({ tipo: "Gasto", ...g }))
    ].sort((a, b) => b.id - a.id);

    movs.forEach(m => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${m.tipo}</td>
            <td>${m.fecha}</td>
            <td>${m.descripcion || "-"}</td>
            <td>$${m.monto.toFixed(2)}</td>
        `;
        body.appendChild(tr);
    });

    const totalIng = panelData.ingresos.reduce((t, x) => t + x.monto, 0);
    const totalGas = panelData.gastos.reduce((t, x) => t + x.monto, 0);

    if (resumen)
        resumen.innerHTML = `
            <p>Total ingresos: <strong>$${totalIng.toFixed(2)}</strong></p>
            <p>Total gastos: <strong>$${totalGas.toFixed(2)}</strong></p>
            <p>Neto: <strong>$${(totalIng - totalGas).toFixed(2)}</strong></p>
        `;
}

// ========================================
//  EXPORTACIÓN
// ========================================
function exportarJSON() {
    navigator.clipboard.writeText(JSON.stringify(panelData, null, 2));
    alert("JSON copiado al portapapeles.");
}

function exportarExcel() {
    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.json_to_sheet(panelData.ingresos);
    const ws2 = XLSX.utils.json_to_sheet(panelData.gastos);
    const ws3 = XLSX.utils.json_to_sheet(panelData.kmDiarios);
    const ws4 = XLSX.utils.json_to_sheet(panelData.deudas);

    XLSX.utils.book_append_sheet(wb, ws1, "Ingresos");
    XLSX.utils.book_append_sheet(wb, ws2, "Gastos");
    XLSX.utils.book_append_sheet(wb, ws3, "KM Diarios");
    XLSX.utils.book_append_sheet(wb, ws4, "Deudas");

    XLSX.writeFile(wb, "panelData.xlsx");
}

// ========================================
//  IMPORTACIÓN
// ========================================
function importarJSON() {
    const txt = $("importJson").value;
    if (!txt) return alert("Pega un JSON válido.");

    try {
        panelData = JSON.parse(txt);
        guardarData();
        alert("Datos restaurados.");
        location.reload();
    } catch {
        alert("JSON inválido.");
    }
}

// ========================================
//  EVENTOS
// ========================================
if ($("btnIniciarTurno")) $("btnIniciarTurno").onclick = iniciarTurno;
if ($("btnFinalizarTurno")) $("btnFinalizarTurno").onclick = finalizarTurno;

if ($("btnGuardarIngreso")) $("btnGuardarIngreso").onclick = guardarIngreso;
if ($("btnGuardarGasto")) $("btnGuardarGasto").onclick = guardarGasto;
if ($("btnGuardarGas")) $("btnGuardarGas").onclick = guardarGasolina;

if ($("btnRegistrarAbono")) $("btnRegistrarAbono").onclick = registrarAbono;
if ($("btnExportar")) $("btnExportar").onclick = exportarJSON;
if ($("btnImportar")) $("btnImportar").onclick = importarJSON;
if ($("btnExportarExcel")) $("btnExportarExcel").onclick = exportarExcel;

// ========================================
//  RENDER INICIAL
// ========================================
mostrarEstadoTurno();
renderDeudas();
calcularMetricas();
renderHistorial();
