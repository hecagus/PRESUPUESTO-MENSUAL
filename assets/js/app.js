// =========================
//   VARIABLES GLOBALES
// =========================
let movimientos = JSON.parse(localStorage.getItem("movimientos")) || [];
let categorias = JSON.parse(localStorage.getItem("categorias")) || [
    "Transporte", "Comida", "Servicios"
];
// NUEVO: Deudas como un array de objetos
let deudas = JSON.parse(localStorage.getItem("deudas")) || [];

let kmConfig = JSON.parse(localStorage.getItem("kmConfig")) || null;


// =========================
//   GUARDAR TODO
// =========================
function guardarDatos() {
    localStorage.setItem("movimientos", JSON.stringify(movimientos));
    localStorage.setItem("categorias", JSON.stringify(categorias));
    localStorage.setItem("kmConfig", JSON.stringify(kmConfig));
    // NUEVO: Guardar el array de deudas
    localStorage.setItem("deudas", JSON.stringify(deudas));
    // Se elimina la variable deudaTotal de localStorage, se calcula dinámicamente
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

    if (!categorias.includes(nueva)) {
        categorias.push(nueva);
        guardarDatos();
        cargarCategorias();
    }
    $("nuevaCategoria").value = "";
}


// =========================
//   CARGAR CATEGORÍAS
// =========================
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


// =========================
//   AGREGAR MOVIMIENTO (Ingreso/Gasto)
// =========================
function agregarMovimiento() {
    const fecha = $("fecha")?.value;
    const tipo = $("tipo")?.value;
    const categoria = $("categoria")?.value;
    const monto = parseFloat($("monto")?.value);

    if (!fecha || !monto || isNaN(monto) || tipo === undefined) {
        alert("Completa todos los campos correctamente.");
        return;
    }
    
    // Solo registra Ingresos y Gastos de presupuesto
    movimientos.push({ fecha, tipo, categoria, monto, id: Date.now() });
    guardarDatos();

    alert(`${tipo} agregado correctamente.`);
    cargarTablaTodos(); // Refrescar tabla si está visible
    mostrarDeuda(); // Refrescar totales
}

// =========================
//   REGISTRAR NUEVA DEUDA
// =========================
function registrarNuevaDeuda() {
    const nombre = $("deuda-nombre")?.value.trim();
    const monto = parseFloat($("deuda-monto-inicial")?.value);

    if (!nombre || !monto || isNaN(monto) || monto <= 0) {
        alert("Ingresa un nombre y un monto inicial válido.");
        return;
    }

    const nuevaDeuda = {
        id: Date.now(),
        nombre: nombre,
        montoOriginal: monto,
        montoActual: monto,
        fechaCreacion: new Date().toLocaleDateString(),
        movimientos: [] // Historial de abonos
    };

    deudas.push(nuevaDeuda);
    guardarDatos();
    cargarTablaDeudas();
    mostrarDeuda();
    cerrarFormularioDeuda();
    alert(`Deuda "${nombre}" registrada por $${monto.toFixed(2)}.`);
}

// =========================
//   ABONAR A DEUDA
// =========================
function abonarADeuda() {
    const deudaId = parseInt($("deuda-select-abono")?.value);
    const abonoMonto = parseFloat($("deuda-monto-abono")?.value);

    if (!deudaId || !abonoMonto || isNaN(abonoMonto) || abonoMonto <= 0) {
        alert("Selecciona una deuda e ingresa un monto de abono válido.");
        return;
    }

    const deudaIndex = deudas.findIndex(d => d.id === deudaId);
    if (deudaIndex === -1) return alert("Deuda no encontrada.");

    const deuda = deudas[deudaIndex];
    if (deuda.montoActual - abonoMonto < 0) {
        alert("El abono excede el monto actual de la deuda.");
        return;
    }

    // 1. Registrar el abono en el historial de movimientos de presupuesto (como Gasto)
    movimientos.push({
        fecha: new Date().toISOString().substring(0, 10),
        tipo: "Gasto",
        categoria: "Abono a Deuda",
        descripcion: `Abono a ${deuda.nombre}`,
        monto: abonoMonto,
        id: Date.now() + 1
    });

    // 2. Aplicar el abono a la deuda
    deuda.montoActual -= abonoMonto;
    deuda.movimientos.push({
        fecha: new Date().toLocaleDateString(),
        monto: abonoMonto
    });

    // 3. Si la deuda se paga, marcarla o moverla (opcional, aquí solo se deja en 0)
    if (deuda.montoActual < 0.01) deuda.montoActual = 0;

    guardarDatos();
    cargarTablaDeudas();
    cargarTablaTodos();
    mostrarDeuda();
    cerrarFormularioDeuda();
    alert(`Abono de $${abonoMonto.toFixed(2)} realizado a "${deuda.nombre}".`);
}


// =========================
//   CARGAR TABLA DE DEUDAS
// =========================
function cargarTablaDeudas() {
    const tabla = $("tabla-deudas");
    if (!tabla) return;
    
    // Limpiar cuerpo (dejando el thead si existe)
    let tbody = tabla.querySelector('tbody');
    if (!tbody) {
        tbody = document.createElement('tbody');
        tabla.appendChild(tbody);
    }
    tbody.innerHTML = '';

    if (deudas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3">No hay deudas registradas.</td></tr>';
        return;
    }

    deudas.forEach(deuda => {
        const tr = document.createElement("tr");
        const statusClass = deuda.montoActual > 0 ? 'valor-negativo' : 'valor-positivo';

        tr.innerHTML = `
            <td>${deuda.nombre}</td>
            <td class="${statusClass}">$${deuda.montoActual.toFixed(2)}</td>
            <td><button onclick="eliminarDeuda(${deuda.id})" class="button-small secondary">Eliminar</button></td>
        `;
        tbody.appendChild(tr);
    });
}

// =========================
//   ELIMINAR DEUDA
// =========================
function eliminarDeuda(id) {
    if (!confirm("¿Estás seguro de que quieres eliminar esta deuda? (Esto no afecta los movimientos de gasto ya realizados).")) {
        return;
    }
    deudas = deudas.filter(d => d.id !== id);
    guardarDatos();
    cargarTablaDeudas();
    mostrarDeuda();
}


// =========================
//   CARGAR SELECT DEUDAS (para abonos)
// =========================
function cargarSelectDeudas() {
    const select = $("deuda-select-abono");
    if (!select) return;

    select.innerHTML = '<option value="">-- Selecciona una Deuda --</option>';

    deudas.filter(d => d.montoActual > 0).forEach(deuda => {
        const op = document.createElement("option");
        op.value = deuda.id;
        op.textContent = `${deuda.nombre} ($${deuda.montoActual.toFixed(2)})`;
        select.appendChild(op);
    });
}

// =========================
//   CALCULAR KILOMETRAJE
// =========================
function calcularKm() {
    // ... Lógica sin cambios ...
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
    // ... Lógica sin cambios ...
    if (!kmConfig) return;

    if ($("kmInicial")) $("kmInicial").value = kmConfig.kmInicial;
    if ($("kmFinal")) $("kmFinal").value = kmConfig.kmFinal;
    if ($("gastoTotal")) $("gastoTotal").value = kmConfig.gastoTotal;

    if ($("precioKm")) {
        $("precioKm").textContent = kmConfig.precioKm.toFixed(2);
    }
}


// =========================
//   CALCULAR Y MOSTRAR DEUDA/TOTALES
// =========================
function mostrarDeuda() {
    // Cálculo de Deuda Total: Suma los montos actuales de todas las deudas
    let deudaTotal = deudas.reduce((sum, d) => sum + d.montoActual, 0);
    const label = $("deudaTotalLabel");
    if (label) label.textContent = deudaTotal.toFixed(2);
    
    // Cálculo de Ingresos y Gastos totales (se necesita para el resumen)
    let totalIngresos = movimientos
        .filter(m => m.tipo === 'Ingreso')
        .reduce((sum, m) => sum + m.monto, 0);

    let totalGastos = movimientos
        .filter(m => m.tipo === 'Gasto')
        .reduce((sum, m) => sum + m.monto, 0);

    let balance = totalIngresos - totalGastos;
    
    // Mostrar en el resumen
    if ($("total-ingresos")) $("total-ingresos").textContent = totalIngresos.toFixed(2);
    if ($("total-gastos")) $("total-gastos").textContent = totalGastos.toFixed(2);
    if ($("balance")) $("balance").textContent = balance.toFixed(2);
    
    // Aplicar clases de color si el balance es negativo/positivo
    const balanceElement = $("balance");
    if (balanceElement) {
        balanceElement.parentNode.classList.remove('valor-positivo', 'valor-negativo');
        if (balance > 0) balanceElement.parentNode.classList.add('valor-positivo');
        if (balance < 0) balanceElement.parentNode.classList.add('valor-negativo');
    }
}

// =========================
//   CARGAR TABLA DE TODOS LOS MOVIMIENTOS
// =========================
function cargarTablaTodos() {
    const tabla = $("tabla-todos");
    if (!tabla) return;
    
    let tbody = tabla.querySelector('tbody');
    if (!tbody) {
        tbody = document.createElement('tbody');
        tabla.appendChild(tbody);
    }
    tbody.innerHTML = '';

    if (movimientos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5">No hay movimientos registrados.</td></tr>';
        return;
    }

    // Ordenar por fecha (más reciente primero)
    const movimientosOrdenados = [...movimientos].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    movimientosOrdenados.forEach(mov => {
        const tr = document.createElement("tr");
        const montoClass = mov.tipo === 'Ingreso' ? 'valor-positivo' : 'valor-negativo';

        tr.innerHTML = `
            <td>${mov.fecha}</td>
            <td>${mov.tipo}</td>
            <td>${mov.categoria}</td>
            <td class="${montoClass}">$${mov.monto.toFixed(2)}</td>
            <td><button onclick="eliminarMovimiento(${mov.id})" class="button-small secondary">X</button></td>
        `;
        tbody.appendChild(tr);
    });
}

// =========================
//   ELIMINAR MOVIMIENTO
// =========================
function eliminarMovimiento(id) {
    movimientos = movimientos.filter(m => m.id !== id);
    guardarDatos();
    cargarTablaTodos();
    mostrarDeuda(); // Recalcular totales
}

// =========================
//   INICIALIZAR APP
// =========================
window.onload = () => {
    cargarCategorias();
    cargarConfiguracionKm();
    mostrarDeuda(); // Muestra totales y deuda
    // La carga de tablas se hace al cambiar a la pestaña Admin
};

// Necesario para el modal
function cerrarFormularioDeuda() {
    $("deuda-modal").style.display = 'none';
}
