// =========================
//   CARGAR TABLA DE DEUDAS
// =========================
function cargarTablaDeudas() {
    const tabla = $("tabla-deudas");
    if (!tabla) return;

    const tbody = tabla.querySelector("tbody");
    tbody.innerHTML = "";

    if (deudas.length === 0) {
        tbody.innerHTML = "<tr><td colspan='3'>Sin deudas registradas</td></tr>";
        return;
    }

    deudas.forEach(deuda => {
        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>${deuda.nombre}</td>
            <td>$${deuda.montoActual.toFixed(2)}</td>
            <td>
                <button class="button-small" onclick="mostrarFormularioDeuda()">Abonar</button>
            </td>
        `;

        tbody.appendChild(tr);
    });

    cargarSelectDeudas();
}

// =========================
//   LLENAR SELECT PARA ABONAR
// =========================
function cargarSelectDeudas() {
    const select = $("deuda-select-abono");
    if (!select) return;

    select.innerHTML = "";

    if (deudas.length === 0) {
        const op = document.createElement("option");
        op.textContent = "No hay deudas";
        op.value = "";
        select.appendChild(op);
        return;
    }

    deudas.forEach(d => {
        const op = document.createElement("option");
        op.value = d.id;
        op.textContent = `${d.nombre} — $${d.montoActual.toFixed(2)}`;
        select.appendChild(op);
    });
}


// =========================
//   MOSTRAR TOTAL DE DEUDA EN INDEX
// =========================
function mostrarDeuda() {
    const total = deudas.reduce((acc, d) => acc + d.montoActual, 0);
    const lbl = $("deudaTotalLabel");
    if (lbl) lbl.textContent = total.toFixed(2);
}


// =========================
//   TABLA DE MOVIMIENTOS (TODOS)
// =========================
function cargarTablaTodos() {
    const tabla = $("tabla-todos");
    if (!tabla) return;

    tabla.innerHTML = "";

    if (movimientos.length === 0) {
        tabla.innerHTML = "<tr><td>No hay movimientos registrados.</td></tr>";
        return;
    }

    const encabezado = `
        <tr>
            <th>Fecha</th>
            <th>Tipo</th>
            <th>Categoria</th>
            <th>Monto</th>
        </tr>
    `;

    tabla.innerHTML = encabezado;

    movimientos.forEach(m => {
        const fila = document.createElement("tr");

        fila.innerHTML = `
            <td>${m.fecha}</td>
            <td>${m.tipo}</td>
            <td>${m.categoria || "-"}</td>
            <td>$${parseFloat(m.monto).toFixed(2)}</td>
        `;

        tabla.appendChild(fila);
    });
}


// =========================
//   KILOMETRAJE
// =========================
function calcularKm() {
    const kmInicial = parseFloat($("kmInicial")?.value);
    const kmFinal = parseFloat($("kmFinal")?.value);
    const gastoTotal = parseFloat($("gastoTotal")?.value);

    if (!kmInicial || !kmFinal || !gastoTotal || kmFinal <= kmInicial) {
        alert("Completa todos los valores correctamente.");
        return;
    }

    const kmRecorridos = kmFinal - kmInicial;
    const precio = gastoTotal / kmRecorridos;

    kmConfig = { kmInicial, kmFinal, gastoTotal, precioKm: precio };
    guardarDatos();

    $("precioKm").textContent = precio.toFixed(2);
    alert("Kilometraje guardado.");
}

function cargarConfiguracionKm() {
    if (!kmConfig) {
        alert("No hay datos guardados.");
        return;
    }

    $("kmInicial").value = kmConfig.kmInicial;
    $("kmFinal").value = kmConfig.kmFinal;
    $("gastoTotal").value = kmConfig.gastoTotal;
    $("precioKm").textContent = kmConfig.precioKm.toFixed(2);
}


// =========================
//   RESUMEN (INGRESOS / GASTOS)
// =========================
function calcularResumen() {
    const ingresos = movimientos
        .filter(m => m.tipo === "Ingreso")
        .reduce((acc, m) => acc + m.monto, 0);

    const gastos = movimientos
        .filter(m => m.tipo === "Gasto")
        .reduce((acc, m) => acc + m.monto, 0);

    const balance = ingresos - gastos;

    if ($("total-ingresos")) $("total-ingresos").textContent = ingresos.toFixed(2);
    if ($("total-gastos")) $("total-gastos").textContent = gastos.toFixed(2);
    if ($("balance")) $("balance").textContent = balance.toFixed(2);
}


// =========================
//   MOVIMIENTOS RECIENTES
// =========================
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
        const fila = document.createElement("tr");

        fila.innerHTML = `
            <td>${m.fecha}</td>
            <td>${m.tipo}</td>
            <td>$${m.monto.toFixed(2)}</td>
        `;

        tabla.appendChild(fila);
    });
}


// =========================
//   CARGA INICIAL (window.onloadApp)
// =========================
window.onloadApp = () => {
    cargarCategorias();
    cargarTablaTodos();
    cargarTablaDeudas();
    cargarSelectDeudas();
    mostrarDeuda();
    cargarMovimientosRecientes();
    calcularResumen();
};
