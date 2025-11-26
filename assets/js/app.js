// =========================
//   VARIABLES GLOBALES
// =========================
let movimientos = JSON.parse(localStorage.getItem("movimientos")) || [];
let categorias = JSON.parse(localStorage.getItem("categorias")) || [
    "Transporte", "Comida", "Servicios"
];

let kmConfig = JSON.parse(localStorage.getItem("kmConfig")) || null;

// SISTEMA DE DEUDA TOTAL
let deudaTotal = parseFloat(localStorage.getItem("deudaTotal")) || 0;


// =========================
//   GUARDAR TODO
// =========================
function guardarDatos() {
    localStorage.setItem("movimientos", JSON.stringify(movimientos));
    localStorage.setItem("categorias", JSON.stringify(categorias));
    localStorage.setItem("kmConfig", JSON.stringify(kmConfig));
    localStorage.setItem("deudaTotal", deudaTotal.toString());
}


// ==================================================
//   SAFE GET — Evita errores si el elemento no existe
// ==================================================
function $(id) {
    return document.getElementById(id) || null;
}


// =========================
//   AGREGAR NUEVA CATEGORÍA
// =========================
function agregarCategoria() {
    const nueva = $("nuevaCategoria")?.value.trim();
    if (!nueva) return;

    categorias.push(nueva);
    guardarDatos();
    cargarCategorias();
    $("nuevaCategoria").value = "";
}


// =========================
//   CARGAR CATEGORÍAS
// =========================
function cargarCategorias() {
    const select = $("categoria");
    if (!select) return; // Evita errores

    select.innerHTML = "";

    categorias.forEach(cat => {
        const op = document.createElement("option");
        op.value = cat;
        op.textContent = cat;
        select.appendChild(op);
    });
}


// =========================
//   AGREGAR MOVIMIENTO
// =========================
function agregarMovimiento() {
    const fecha = $("fecha")?.value;
    const tipo = $("tipo")?.value;
    const categoria = $("categoria")?.value;
    const monto = parseFloat($("monto")?.value);

    if (!fecha || !monto) {
        alert("Completa todos los campos");
        return;
    }

    // ------------------------
    // NUEVO: SISTEMA DE DEUDA
    // ------------------------
    if (tipo === "Abono Deuda") {
        deudaTotal -= monto;
        if (deudaTotal < 0) deudaTotal = 0;
    }

    if (tipo === "Nueva Deuda") {
        deudaTotal += monto;
    }

    movimientos.push({ fecha, tipo, categoria, monto });
    guardarDatos();

    alert("Movimiento agregado correctamente");
    mostrarDeuda();
}


// =========================
//   CALCULAR KILOMETRAJE
// =========================
function calcularKm() {
    const kmInicial = parseFloat($("kmInicial")?.value);
    const kmFinal = parseFloat($("kmFinal")?.value);
    const gastoTotal = parseFloat($("gastoTotal")?.value);

    if (!kmInicial || !kmFinal || !gastoTotal) {
        alert("Completa todos los campos de kilometraje");
        return;
    }

    const kmRecorridos = kmFinal - kmInicial;
    const precioKm = kmRecorridos > 0 ? gastoTotal / kmRecorridos : 0;

    if ($("precioKm")) $("precioKm").textContent = precioKm.toFixed(2);

    kmConfig = { kmInicial, kmFinal, gastoTotal, precioKm };
    guardarDatos();

    alert("Kilometraje guardado");
}


// =========================
//   CARGAR CONFIGURACIÓN KM
// =========================
function cargarConfiguracionKm() {
    if (!kmConfig) return;

    if ($("kmInicial")) $("kmInicial").value = kmConfig.kmInicial;
    if ($("kmFinal")) $("kmFinal").value = kmConfig.kmFinal;
    if ($("gastoTotal")) $("gastoTotal").value = kmConfig.gastoTotal;

    if ($("precioKm")) {
        $("precioKm").textContent = kmConfig.precioKm.toFixed(2);
    }
}


// =========================
// MOSTRAR DEUDA EN PANTALLA
// =========================
function mostrarDeuda() {
    const label = $("deudaTotalLabel");
    if (label) label.textContent = deudaTotal.toFixed(2);
}


// =========================
//   INICIALIZAR APP
// =========================
window.onload = () => {
    cargarCategorias();
    cargarConfiguracionKm();
    mostrarDeuda();
};
