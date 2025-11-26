// =========================
//   VARIABLES GLOBALES
// =========================
let movimientos = JSON.parse(localStorage.getItem("movimientos")) || [];
let categorias = JSON.parse(localStorage.getItem("categorias")) || ["Transporte", "Comida", "Servicios"];
let kmConfig = JSON.parse(localStorage.getItem("kmConfig")) || null;

// NUEVO: SISTEMA DE DEUDA TOTAL
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

// =========================
//   AGREGAR NUEVA CATEGORÍA
// =========================
function agregarCategoria() {
    const nueva = document.getElementById("nuevaCategoria").value.trim();
    if (nueva !== "") {
        categorias.push(nueva);
        guardarDatos();
        cargarCategorias();
        document.getElementById("nuevaCategoria").value = "";
    }
}

// =========================
//   CARGAR CATEGORÍAS
// =========================
function cargarCategorias() {
    const select = document.getElementById("categoria");
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
    const fecha = document.getElementById("fecha").value;
    const tipo = document.getElementById("tipo").value;
    const categoria = document.getElementById("categoria").value;
    const monto = parseFloat(document.getElementById("monto").value);

    if (!fecha || !monto) {
        alert("Completa todos los campos");
        return;
    }

    // ------------------------
    // NUEVO: SISTEMA DE DEUDA
    // ------------------------
    if (categoria === "Abono Deuda") {
        deudaTotal -= monto; // disminuye la deuda
        if (deudaTotal < 0) deudaTotal = 0;
    }

    if (categoria === "Nueva Deuda") {
        deudaTotal += monto; // aumenta la deuda
    }

    movimientos.push({ fecha, tipo, categoria, monto });
    guardarDatos();
    alert("Movimiento agregado correctamente");
}

// =========================
//   CALCULAR KILOMETRAJE
// =========================
function calcularKm() {
    const kmInicial = parseFloat(document.getElementById("kmInicial").value);
    const kmFinal = parseFloat(document.getElementById("kmFinal").value);
    const gastoTotal = parseFloat(document.getElementById("gastoTotal").value);

    if (!kmInicial || !kmFinal || !gastoTotal) {
        alert("Completa todos los campos de kilometraje");
        return;
    }

    const kmRecorridos = kmFinal - kmInicial;
    const precioKm = kmRecorridos > 0 ? gastoTotal / kmRecorridos : 0;

    document.getElementById("precioKm").textContent = precioKm.toFixed(2);

    kmConfig = { kmInicial, kmFinal, gastoTotal, precioKm };
    guardarDatos();
}

// =========================
//   CARGAR CONFIGURACIÓN KM
// =========================
function cargarConfiguracionKm() {
    if (!kmConfig) return;

    document.getElementById("kmInicial").value = kmConfig.kmInicial;
    document.getElementById("kmFinal").value = kmConfig.kmFinal;
    document.getElementById("gastoTotal").value = kmConfig.gastoTotal;
    document.getElementById("precioKm").textContent = kmConfig.precioKm.toFixed(2);
}

// =========================
// MOSTRAR DEUDA EN PANTALLA
// =========================
function mostrarDeuda() {
    const label = document.getElementById("deudaTotalLabel");
    if (label) {
        label.textContent = deudaTotal.toFixed(2);
    }
}

// =========================
//   INICIALIZAR APP
// =========================
window.onload = () => {
    cargarCategorias();
    cargarConfiguracionKm();
    mostrarDeuda();
};
