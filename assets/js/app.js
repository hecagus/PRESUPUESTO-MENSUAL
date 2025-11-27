// ======================================
//   VARIABLES GLOBALES
// ======================================
let movimientos = JSON.parse(localStorage.getItem("movimientos")) || [];
let categorias = JSON.parse(localStorage.getItem("categorias")) || ["Transporte", "Comida", "Servicios"];
let deudas = JSON.parse(localStorage.getItem("deudas")) || [];
let kmConfig = JSON.parse(localStorage.getItem("kmConfig")) || null;

// ======================================
//   UTILIDADES
// ======================================
const $ = (id) => document.getElementById(id);

function guardarDatos() {
    localStorage.setItem("movimientos", JSON.stringify(movimientos));
    localStorage.setItem("categorias", JSON.stringify(categorias));
    localStorage.setItem("deudas", JSON.stringify(deudas));
    localStorage.setItem("kmConfig", JSON.stringify(kmConfig));
}

function mostrarLoader() {
    $("loader").style.display = "flex";
}

function ocultarLoader() {
    $("loader").style.display = "none";
}

// ======================================
//   DETECTAR PÁGINA
// ======================================
const pagina = window.location.pathname;

// ======================================
//   FUNCIONES PARA CATEGORÍAS
// ======================================
function cargarCategorias() {
    const select = $("categoria");
    if (!select) return;

    select.innerHTML = "";
    categorias.forEach(cat => {
        const op = document.createElement("option");
        op.value = cat;
        op.textContent = cat;
        select.appendChild(op);
    });
}

function agregarCategoria() {
    const nueva = prompt("Nombre categoría:");
    if (!nueva) return;

    categorias.push(nueva);
    guardarDatos();
    cargarCategorias();
    alert("Categoría agregada.");
}

// ======================================
//   FUNCIONES PARA MOVIMIENTOS
// ======================================
function agregarMovimiento() {
    const tipo = $("tipo").value;
    const categoria = $("categoria").value;
    const monto = parseFloat($("monto").value);

    if (!monto) {
        alert("Ingresa un monto válido.");
        return;
    }

    movimientos.push({
        id: Date.now(),
        tipo,
        categoria,
        monto,
        fecha: new Date().toLocaleString()
    });

    guardarDatos();
    alert("Movimiento agregado.");

    cargarTablaTodos();
    cargarMovimientosRecientes();
    calcularResumen();
}

function cargarTablaTodos() {
    const tabla = $("tabla-todos");
    if (!tabla) return;

    tabla.innerHTML = "";

    if (movimientos.length === 0) {
        tabla.innerHTML = "<tr><td>No hay movimientos</td></tr>";
        return;
    }

    tabla.innerHTML = `
        <tr>
            <th>Fecha</th>
            <th>Tipo</th>
            <th>Categoría</th>
            <th>Monto</th>
        </tr>
    `;

    movimientos.forEach(m => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${m.fecha}</td>
            <td>${m.tipo}</td>
            <td>${m.categoria}</td>
            <td>$${m.monto.toFixed(2)}</td>
        `;
        tabla.appendChild(tr);
    });
}

function cargarMovimientosRecientes() {
    const tabla = $("tabla-recientes");
    if (!tabla) return;

    tabla.innerHTML = "";

    const ultimos = movimientos.slice(-5).reverse();

    if (ultimos.length === 0) {
        tabla.innerHTML = "<tr><td>No hay movimientos</td></tr>";
        return;
    }

    ultimos.forEach(m => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${m.fecha}</td>
            <td>${m.tipo}</td>
            <td>$${m.monto.toFixed(2)}</td>
        `;
        tabla.appendChild(tr);
    });
}

function calcularResumen() {
    const ingresos = movimientos
        .filter(m => m.tipo === "Ingreso")
        .reduce((a, b) => a + b.monto, 0);

    const gastos = movimientos
        .filter(m => m.tipo === "Gasto")
        .reduce((a, b) => a + b.monto, 0);

    if ($("total-ingresos")) $("total-ingresos").textContent = ingresos.toFixed(2);
    if ($("total-gastos")) $("total-gastos").textContent = gastos.toFixed(2);
    if ($("balance")) $("balance").textContent = (ingresos - gastos).toFixed(2);
}

// ======================================
//   DEUDAS
// ======================================
function agregarDeuda() {
    const nombre = $("deuda-nombre").value;
    const monto = parseFloat($("deuda-monto").value);

    if (!nombre || !monto) {
        alert("Completa los datos.");
        return;
    }

    deudas.push({
        id: Date.now(),
        nombre,
        montoOriginal: monto,
        montoActual: monto
    });

    guardarDatos();
    cargarTablaDeudas();
    mostrarDeuda();
}

function cargarTablaDeudas() {
    const tabla = $("tabla-deudas");
    if (!tabla) return;

    const tbody = tabla.querySelector("tbody");
    tbody.innerHTML = "";

    if (deudas.length === 0) {
        tbody.innerHTML = "<tr><td colspan='3'>Sin deudas</td></tr>";
        return;
    }

    deudas.forEach(d => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${d.nombre}</td>
            <td>$${d.montoActual.toFixed(2)}</td>
            <td><button onclick="abonar(${d.id})">Abonar</button></td>
        `;
        tbody.appendChild(tr);
    });
}

function abonar(id) {
    const deuda = deudas.find(d => d.id === id);
    const abono = parseFloat(prompt("Monto del abono:"));
    if (!abono) return;

    deuda.montoActual -= abono;
    if (deuda.montoActual < 0) deuda.montoActual = 0;

    guardarDatos();
    cargarTablaDeudas();
    mostrarDeuda();
    calcularResumen();
}

function mostrarDeuda() {
    const total = deudas.reduce((a, b) => a + b.montoActual, 0);
    if ($("deudaTotalLabel")) $("deudaTotalLabel").textContent = total.toFixed(2);
}

// ======================================
//   KILOMETRAJE
// ======================================
function calcularKm() {
    const ki = parseFloat($("kmInicial").value);
    const kf = parseFloat($("kmFinal").value);
    const gasto = parseFloat($("gastoTotal").value);

    if (!ki || !kf || !gasto || kf <= ki) {
        alert("Datos incorrectos.");
        return;
    }

    const km = kf - ki;
    const precio = gasto / km;

    kmConfig = { kmInicial: ki, kmFinal: kf, gastoTotal: gasto, precioKm: precio };
    guardarDatos();

    $("precioKm").textContent = precio.toFixed(2);
}

// ======================================
//   BACKUP AUTOMÁTICO
// ======================================
function descargarBackup() {
    const datos = {
        movimientos,
        categorias,
        deudas,
        kmConfig
    };

    const blob = new Blob([JSON.stringify(datos, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "backup.json";
    a.click();

    URL.revokeObjectURL(url);
}

// ======================================
//   MODO OSCURO
// ======================================
function toggleModo() {
    document.body.classList.toggle("dark");
    localStorage.setItem("modoOscuro", document.body.classList.contains("dark"));
}

function cargarModo() {
    const modo = localStorage.getItem("modoOscuro") === "true";
    if (modo) document.body.classList.add("dark");
}

// ======================================
//   INICIO ADMIN
// ======================================
function iniciarAdmin() {
    cargarCategorias();
    cargarTablaTodos();
    cargarTablaDeudas();
    cargarModo();
}

// ======================================
//   INICIO INDEX
// ======================================
function iniciarIndex() {
    cargarMovimientosRecientes();
    cargarResumen();
    mostrarDeuda();
    cargarModo();
}

// ======================================
//   EJECUCIÓN AUTOMÁTICA
// ======================================
window.onload = () => {
    mostrarLoader();
    setTimeout(() => {
        ocultarLoader();

        if (pagina.includes("admin")) {
            iniciarAdmin();
        } else {
            iniciarIndex();
        }

    }, 300);
};
