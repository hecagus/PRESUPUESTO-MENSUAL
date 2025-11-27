// =========================
//   VARIABLES GLOBALES
// =========================
let movimientos = JSON.parse(localStorage.getItem("movimientos")) || [];
let categorias = JSON.parse(localStorage.getItem("categorias")) || ["Transporte", "Comida", "Servicios"];
let deudas = JSON.parse(localStorage.getItem("deudas")) || [];
let kmConfig = JSON.parse(localStorage.getItem("kmConfig")) || { km: 0, precio: 0 };

// =========================
//   GUARDAR LOCALSTORAGE
// =========================
function guardarDatos() {
    localStorage.setItem("movimientos", JSON.stringify(movimientos));
    localStorage.setItem("categorias", JSON.stringify(categorias));
    localStorage.setItem("deudas", JSON.stringify(deudas));
    localStorage.setItem("kmConfig", JSON.stringify(kmConfig));
}

// =========================
//   CARGAR CATEGORÍAS
// =========================
function cargarCategorias(origen) {
    let select = document.getElementById(`categoria-${origen}`);
    if (!select) return;

    select.innerHTML = "";
    categorias.forEach(cat => {
        let op = document.createElement("option");
        op.value = cat;
        op.textContent = cat;
        select.appendChild(op);
    });
}

// =========================
//   AGREGAR CATEGORÍA
// =========================
function agregarCategoria(origen) {
    let input = document.getElementById(`nuevaCategoria-${origen}`);
    if (!input) return;

    let nueva = input.value.trim();
    if (nueva === "") return;

    categorias.push(nueva);
    guardarDatos();
    cargarCategorias(origen);

    input.value = "";
}

// =========================
//   AGREGAR MOVIMIENTO
// =========================
function agregarMovimiento(origen) {
    let fecha = document.getElementById(`fecha-${origen}`).value;
    let tipo = document.getElementById(`tipo-${origen}`).value;
    let categoria = document.getElementById(`categoria-${origen}`).value;
    let descripcion = document.getElementById(`mov-desc-${origen}`).value;
    let monto = parseFloat(document.getElementById(`monto-${origen}`).value);

    if (!fecha || !tipo || !categoria || isNaN(monto)) {
        alert("Completa todos los campos.");
        return;
    }

    movimientos.push({
        fecha, tipo, categoria, descripcion, monto
    });

    guardarDatos();
    alert("Movimiento guardado");

    onloadApp(origen);
}

// =========================
//   DEUDAS
// =========================
function mostrarFormularioDeuda() {
    document.getElementById("deuda-modal").style.display = "block";
}

function cerrarFormularioDeuda() {
    document.getElementById("deuda-modal").style.display = "none";
}

function registrarNuevaDeuda() {
    let nombre = document.getElementById("deuda-nombre").value;
    let monto = parseFloat(document.getElementById("deuda-monto-inicial").value);

    if (!nombre || isNaN(monto)) {
        alert("Completa los campos");
        return;
    }

    deudas.push({ nombre, monto });
    guardarDatos();
    cargarDeudas();
}

function abonarADeuda() {
    let idx = document.getElementById("deuda-select-abono").value;
    let abono = parseFloat(document.getElementById("deuda-monto-abono").value);

    if (idx === "" || isNaN(abono)) return;

    deudas[idx].monto -= abono;
    if (deudas[idx].monto < 0) deudas[idx].monto = 0;

    guardarDatos();
    cargarDeudas();
}

function cargarDeudas() {
    let tabla = document.querySelector("#tabla-deudas tbody");
    let select = document.getElementById("deuda-select-abono");

    if (!tabla || !select) return;

    tabla.innerHTML = "";
    select.innerHTML = "";

    deudas.forEach((d, i) => {
        let tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${d.nombre}</td>
            <td>$${d.monto.toFixed(2)}</td>
            <td><button onclick="eliminarDeuda(${i})">Eliminar</button></td>
        `;
        tabla.appendChild(tr);

        let op = document.createElement("option");
        op.value = i;
        op.textContent = d.nombre;
        select.appendChild(op);
    });

    // Mostrar total en index
    let lbl = document.getElementById("deudaTotalLabel");
    if (lbl) lbl.textContent = deudas.reduce((t, d) => t + d.monto, 0).toFixed(2);
}

function eliminarDeuda(i) {
    deudas.splice(i, 1);
    guardarDatos();
    cargarDeudas();
}

// =========================
//   KILOMETRAJE
// =========================
function calcularKm() {
    let ini = parseFloat(document.getElementById("kmInicial").value);
    let fin = parseFloat(document.getElementById("kmFinal").value);
    let gasto = parseFloat(document.getElementById("gastoTotal").value);

    if (isNaN(ini) || isNaN(fin) || isNaN(gasto)) return;

    let km = fin - ini;
    let precio = gasto / km;

    kmConfig.km = km;
    kmConfig.precio = precio;

    guardarDatos();

    document.getElementById("precioKm").textContent = precio.toFixed(2);
}

function cargarConfiguracionKm() {
    if (document.getElementById("kmInicial")) {
        document.getElementById("precioKm").textContent = kmConfig.precio.toFixed(2);
    }

    if (document.getElementById("km-recorridos")) {
        document.getElementById("km-recorridos").textContent = kmConfig.km;
        document.getElementById("km-gasto").textContent = (kmConfig.km * kmConfig.precio).toFixed(2);
    }
}

// =========================
//   TABLA DE MOVIMIENTOS INDEX
// =========================
function cargarMovimientosIndex() {
    let tabla = document.getElementById("tabla-recientes");
    if (!tabla) return;

    tabla.innerHTML = `
        <tr><th>Fecha</th><th>Tipo</th><th>Categoría</th><th>Monto</th></tr>
    `;

    movimientos.slice(-10).reverse().forEach(m => {
        tabla.innerHTML += `
            <tr>
                <td>${m.fecha}</td>
                <td>${m.tipo}</td>
                <td>${m.categoria}</td>
                <td>$${m.monto.toFixed(2)}</td>
            </tr>
        `;
    });
}

// =========================
//  CALCULAR RESUMEN INDEX
// =========================
function actualizarResumenIndex() {
    let ingresos = movimientos.filter(m => m.tipo === "Ingreso").reduce((t, m) => t + m.monto, 0);
    let gastos = movimientos.filter(m => m.tipo === "Gasto").reduce((t, m) => t + m.monto, 0);
    let balance = ingresos - gastos;

    if (document.getElementById("total-ingresos")) {
        document.getElementById("total-ingresos").textContent = ingresos.toFixed(2);
        document.getElementById("total-gastos").textContent = gastos.toFixed(2);
        document.getElementById("balance").textContent = balance.toFixed(2);
    }
}

// =========================
//   GRAFICAS
// =========================
let grafica;

function cargarGraficaCategorias() {
    let ctx = document.getElementById("grafica-categorias");
    if (!ctx) return;

    let gastosPorCat = {};

    movimientos
        .filter(m => m.tipo === "Gasto")
        .forEach(m => {
            gastosPorCat[m.categoria] = (gastosPorCat[m.categoria] || 0) + m.monto;
        });

    if (grafica) grafica.destroy();

    grafica = new Chart(ctx, {
        type: "pie",
        data: {
            labels: Object.keys(gastosPorCat),
            datasets: [{
                data: Object.values(gastosPorCat),
                backgroundColor: ["#ff6384", "#36a2eb", "#ffce56", "#66bb6a", "#ba68c8"]
            }]
        }
    });
}

// =========================
//   INICIO
// =========================
function onloadApp(origen) {
    cargarCategorias(origen);
    cargarDeudas();
    cargarConfiguracionKm();
    cargarMovimientosIndex();
    actualizarResumenIndex();
    cargarGraficaCategorias();
}
