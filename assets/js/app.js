// =========================
//   assets/js/app.js
//   Versión corregida: sincroniza admin/index y evita duplicados
// =========================

// VARIABLES GLOBALES
let movimientos = JSON.parse(localStorage.getItem("movimientos")) || [];
let categorias = JSON.parse(localStorage.getItem("categorias")) || ["Transporte", "Comida", "Servicios"];
let deudas = JSON.parse(localStorage.getItem("deudas")) || [];
let kmConfig = JSON.parse(localStorage.getItem("kmConfig")) || null;


// =========================
//   GUARDAR TODO
// =========================
function guardarDatos() {
    localStorage.setItem("movimientos", JSON.stringify(movimientos));
    localStorage.setItem("categorias", JSON.stringify(categorias));
    localStorage.setItem("kmConfig", JSON.stringify(kmConfig));
    localStorage.setItem("deudas", JSON.stringify(deudas));
}


// SAFE GET
function $(id) {
    return document.getElementById(id) || null;
}


// =========================
//   CATEGORÍAS
// =========================
function agregarCategoria() {
    const nueva = $("nuevaCategoria")?.value?.trim();
    if (!nueva) return;
    if (!categorias.includes(nueva)) {
        categorias.push(nueva);
        guardarDatos();
        cargarCategorias();
        alert(`Categoria "${nueva}" agregada.`);
    } else {
        alert("La categoría ya existe.");
    }
    if ($("nuevaCategoria")) $("nuevaCategoria").value = "";
}

function cargarCategorias() {
    const selects = document.querySelectorAll('#categoria');
    selects.forEach(select => {
        if (!select) return;
        select.innerHTML = "";
        categorias.forEach(cat => {
            const op = document.createElement("option");
            op.value = cat;
            op.textContent = cat;
            select.appendChild(op);
        });
    });
}


// =========================
//   MOVIMIENTOS
// =========================
function agregarMovimiento() {
    const fecha = $("fecha")?.value;
    const tipo = $("tipo")?.value;
    const categoria = $("categoria")?.value;
    const montoRaw = $("monto")?.value;
    const descripcion = $("mov-desc")?.value || "";

    const monto = parseFloat(montoRaw);

    if (!fecha || isNaN(monto) || monto <= 0 || !tipo) {
        alert("Completa todos los campos correctamente.");
        return;
    }

    // Manejar tipos especiales
    if (tipo === "Nueva Deuda") {
        // Usar el campo descripción como nombre (si existe) o pedir nombre
        const nombre = descripcion.trim() || prompt("Nombre de la nueva deuda:");
        if (!nombre) return alert("Debes proporcionar un nombre para la deuda.");
        // Registrar deuda (monto inicial)
        const nuevaDeuda = {
            id: Date.now(),
            nombre,
            montoOriginal: monto,
            montoActual: monto,
            fechaCreacion: new Date().toLocaleDateString(),
            movimientos: []
        };
        deudas.push(nuevaDeuda);
        guardarDatos();
        cargarTablaDeudas();
        mostrarDeuda();
        alert(`Deuda "${nombre}" registrada por $${monto.toFixed(2)}.`);
        return;
    }

    if (tipo === "Abono Deuda") {
        // Si el formulario principal se usa para abonos, necesitamos seleccionar deuda por nombre en 'mov-desc' o mediante prompt
        let deudaId = null;
        // Intentamos extraer id si el usuario escribió "id:12345" en descripción, si no pedimos el nombre
        const match = descripcion.match(/id:([0-9]+)/);
        if (match) deudaId = parseInt(match[1]);
        else {
            const nombre = descripcion.trim() || prompt("Escribe el nombre exacto de la deuda a abonar:");
            if (!nombre) return alert("Se necesita el nombre de la deuda.");
            const d = deudas.find(x => x.nombre.toLowerCase() === nombre.toLowerCase());
            if (!d) return alert("Deuda no encontrada.");
            deudaId = d.id;
        }

        // Realizar abono usando la función dedicada
        abonarADeudaPorFormulario(deudaId, monto);
        return;
    }

    // Tipos normales: Ingreso / Gasto
    const mov = {
        fecha,
        tipo,
        categoria: categoria || "",
        descripcion,
        monto,
        id: Date.now()
    };

    movimientos.push(mov);
    guardarDatos();
    cargarTablaTodos();
    cargarMovimientosRecientes();
    calcularResumen();
    mostrarDeuda();
    alert(`${tipo} agregado correctamente.`);
}

// Abono vía formulario: NO duplicar flujo del modal
function abonarADeudaPorFormulario(deudaId, abonoMonto) {
    const deudaIndex = deudas.findIndex(d => d.id === deudaId);
    if (deudaIndex === -1) return alert("Deuda no encontrada.");

    const deuda = deudas[deudaIndex];
    if (abonoMonto <= 0) return alert("Monto de abono inválido.");
    if (abonoMonto > deuda.montoActual) return alert("El abono excede el monto pendiente.");

    // Registrar abono como movimiento (Gasto) — único push
    movimientos.push({
        fecha: new Date().toISOString().substring(0, 10),
        tipo: "Gasto",
        categoria: "Abono a Deuda",
        descripcion: `Abono a ${deuda.nombre}`,
        monto: abonoMonto,
        id: Date.now()
    });

    deuda.montoActual = Math.max(0, deuda.montoActual - abonoMonto);
    deuda.movimientos.push({ fecha: new Date().toLocaleDateString(), monto: abonoMonto });

    guardarDatos();
    cargarTablaDeudas();
    cargarTablaTodos();
    cargarMovimientosRecientes();
    calcularResumen();
    mostrarDeuda();
    alert(`Abono de $${abonoMonto.toFixed(2)} realizado a "${deuda.nombre}".`);
}


// =========================
//   DEUDAS (modal)
 // Registrar nueva deuda desde modal
function registrarNuevaDeuda() {
    const nombre = $("deuda-nombre")?.value?.trim();
    const monto = parseFloat($("deuda-monto-inicial")?.value);
    if (!nombre || isNaN(monto) || monto <= 0) {
        alert("Ingresa un nombre y un monto inicial válido.");
        return;
    }
    const nuevaDeuda = {
        id: Date.now(),
        nombre,
        montoOriginal: monto,
        montoActual: monto,
        fechaCreacion: new Date().toLocaleDateString(),
        movimientos: []
    };
    deudas.push(nuevaDeuda);
    guardarDatos();
    cargarTablaDeudas();
    mostrarDeuda();
    cerrarFormularioDeuda();
    alert(`Deuda "${nombre}" registrada por $${monto.toFixed(2)}.`);
}

function abonarADeuda() {
    const deudaId = parseInt($("deuda-select-abono")?.value);
    const abonoMonto = parseFloat($("deuda-monto-abono")?.value);

    if (!deudaId || isNaN(abonoMonto) || abonoMonto <= 0) {
        alert("Selecciona una deuda e ingresa un monto de abono válido.");
        return;
    }

    const deudaIndex = deudas.findIndex(d => d.id === deudaId);
    if (deudaIndex === -1) return alert("Deuda no encontrada.");

    const deuda = deudas[deudaIndex];
    if (abonoMonto > deuda.montoActual) return alert("El abono excede el monto actual de la deuda.");

    // Registrar abono como movimiento (Gasto)
    movimientos.push({
        fecha: new Date().toISOString().substring(0, 10),
        tipo: "Gasto",
        categoria: "Abono a Deuda",
        descripcion: `Abono a ${deuda.nombre}`,
        monto: abonoMonto,
        id: Date.now()
    });

    deuda.montoActual = Math.max(0, deuda.montoActual - abonoMonto);
    deuda.movimientos.push({ fecha: new Date().toLocaleDateString(), monto: abonoMonto });

    guardarDatos();
    cargarTablaDeudas();
    cargarTablaTodos();
    cargarMovimientosRecientes();
    calcularResumen();
    mostrarDeuda();
    cerrarFormularioDeuda();
    alert(`Abono de $${abonoMonto.toFixed(2)} realizado a "${deuda.nombre}".`);
}

function eliminarDeuda(id) {
    if (!confirm("¿Eliminar esta deuda? Esto no afectará movimientos ya registrados.")) return;
    deudas = deudas.filter(d => d.id !== id);
    guardarDatos();
    cargarTablaDeudas();
    mostrarDeuda();
}


// Cargar select de deudas (modal o donde haga falta)
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
//   TABLAS
// =========================
function cargarTablaDeudas() {
    const tabla = $("tabla-deudas");
    if (!tabla) return;

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
            <td>
                <button onclick="mostrarFormularioDeuda()" class="button-small">Abonar</button>
                <button onclick="eliminarDeuda(${deuda.id})" class="button-small secondary">Eliminar</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    cargarSelectDeudas();
}

function cargarTablaTodos() {
    const tabla = $("tabla-todos");
    if (!tabla) return;

    // Limpiamos el contenido y reconstruimos cabecera + cuerpo
    tabla.innerHTML = '';

    if (movimientos.length === 0) {
        tabla.innerHTML = '<tr><td>No hay movimientos registrados.</td></tr>';
        return;
    }

    const thead = document.createElement('thead');
    thead.innerHTML = `
        <tr>
            <th>Fecha</th>
            <th>Tipo</th>
            <th>Categoría</th>
            <th>Monto</th>
            <th>Acción</th>
        </tr>
    `;
    tabla.appendChild(thead);

    const tbody = document.createElement('tbody');

    // ordenar por fecha (más reciente primero)
    const movimientosOrdenados = [...movimientos].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    movimientosOrdenados.forEach(mov => {
        const tr = document.createElement("tr");
        const montoClass = mov.tipo === 'Ingreso' ? 'valor-positivo' : 'valor-negativo';
        tr.innerHTML = `
            <td>${mov.fecha}</td>
            <td>${mov.tipo}</td>
            <td>${mov.categoria || '-'}</td>
            <td class="${montoClass}">$${parseFloat(mov.monto).toFixed(2)}</td>
            <td><button onclick="eliminarMovimiento(${mov.id})" class="button-small secondary">X</button></td>
        `;
        tbody.appendChild(tr);
    });

    tabla.appendChild(tbody);
}


// =========================
//   ELIMINAR MOVIMIENTO
// =========================
function eliminarMovimiento(id) {
    movimientos = movimientos.filter(m => m.id !== id);
    guardarDatos();
    cargarTablaTodos();
    cargarMovimientosRecientes();
    calcularResumen();
    mostrarDeuda();
}


// =========================
//   KILOMETRAJE
// =========================
function calcularKm() {
    const kmInicial = parseFloat($("kmInicial")?.value);
    const kmFinal = parseFloat($("kmFinal")?.value);
    const gastoTotal = parseFloat($("gastoTotal")?.value);

    if (isNaN(kmInicial) || isNaN(kmFinal) || isNaN(gastoTotal) || kmFinal <= kmInicial) {
        alert("Completa los campos de kilometraje correctamente (kmFinal debe ser mayor que kmInicial).");
        return;
    }

    const kmRecorridos = kmFinal - kmInicial;
    const precioKm = gastoTotal / kmRecorridos;

    kmConfig = { kmInicial, kmFinal, gastoTotal, precioKm };
    guardarDatos();

    if ($("precioKm")) $("precioKm").textContent = precioKm.toFixed(2);
    alert("Kilometraje guardado.");
}

function cargarConfiguracionKm() {
    if (!kmConfig) return;
    if ($("kmInicial")) $("kmInicial").value = kmConfig.kmInicial;
    if ($("kmFinal")) $("kmFinal").value = kmConfig.kmFinal;
    if ($("gastoTotal")) $("gastoTotal").value = kmConfig.gastoTotal;
    if ($("precioKm")) $("precioKm").textContent = kmConfig.precioKm.toFixed(2);
}


// =========================
//   RESUMEN / TOTALES
// =========================
function mostrarDeuda() {
    const deudaTotal = deudas.reduce((sum, d) => sum + d.montoActual, 0);
    const label = $("deudaTotalLabel");
    if (label) label.textContent = deudaTotal.toFixed(2);
}

function calcularResumen() {
    const totalIngresos = movimientos.filter(m => m.tipo === 'Ingreso').reduce((s, m) => s + m.monto, 0);
    const totalGastos = movimientos.filter(m => m.tipo === 'Gasto' || m.tipo === 'Abono a Deuda').reduce((s, m) => s + m.monto, 0);
    const balance = totalIngresos - totalGastos;

    if ($("total-ingresos")) $("total-ingresos").textContent = totalIngresos.toFixed(2);
    if ($("total-gastos")) $("total-gastos").textContent = totalGastos.toFixed(2);
    if ($("balance")) $("balance").textContent = balance.toFixed(2);

    // aplicar clases
    const balanceElement = $("balance");
    if (balanceElement && balanceElement.parentNode) {
        balanceElement.parentNode.classList.remove('valor-positivo', 'valor-negativo');
        if (balance > 0) balanceElement.parentNode.classList.add('valor-positivo');
        if (balance < 0) balanceElement.parentNode.classList.add('valor-negativo');
    }
}

// Movimientos recientes (tabla pequeña)
function cargarMovimientosRecientes() {
    const tabla = $("tabla-recientes");
    if (!tabla) return;
    tabla.innerHTML = '';

    const ultimos = [...movimientos].sort((a,b) => new Date(b.fecha) - new Date(a.fecha)).slice(0,5);
    if (ultimos.length === 0) {
        tabla.innerHTML = '<tr><td>No hay movimientos</td></tr>';
        return;
    }

    const tbody = document.createElement('tbody');
    ultimos.forEach(m => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${m.fecha}</td><td>${m.tipo}</td><td>$${parseFloat(m.monto).toFixed(2)}</td>`;
        tbody.appendChild(tr);
    });
    tabla.appendChild(tbody);
}


// =========================
//   EXPORT / IMPORT (BÁSICO)
// =========================
function exportarJSON() {
    const data = {
        movimientos,
        categorias,
        deudas,
        kmConfig
    };
    const json = JSON.stringify(data, null, 2);
    if ($("json-area")) $("json-area").value = json;
    // además descargamos un archivo
    const blob = new Blob([json], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `presupuesto_export_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function importarJSON() {
    const text = $("json-area")?.value;
    if (!text) return alert("Pega el JSON en el textarea primero.");
    try {
        const parsed = JSON.parse(text);
        if (parsed.movimientos) movimientos = parsed.movimientos;
        if (parsed.categorias) categorias = parsed.categorias;
        if (parsed.deudas) deudas = parsed.deudas;
        if (parsed.kmConfig) kmConfig = parsed.kmConfig;
        guardarDatos();
        window.onloadApp(); // recargar vistas
        alert("Importación completada.");
    } catch (e) {
        alert("JSON inválido: " + e.message);
    }
}


// =========================
//   MODAL (admin.html)
// =========================
function mostrarFormularioDeuda() {
    if (typeof cargarSelectDeudas === 'function') cargarSelectDeudas();
    const modal = $("deuda-modal");
    if (modal) modal.style.display = 'flex';
}
function cerrarFormularioDeuda() {
    const modal = $("deuda-modal");
    if (modal) modal.style.display = 'none';
}


// =========================
//   INICIALIZAR APP
// =========================
function onloadApp() {
    cargarCategorias();
    cargarTablaTodos();
    cargarTablaDeudas();
    cargarSelectDeudas();
    mostrarDeuda();
    cargarMovimientosRecientes();
    calcularResumen();
    cargarConfiguracionKm();
    // Si quieres: inicializar gráficas aquí (Chart.js) usando datos de movimientos
}

// Exponer para uso en HTML
window.onloadApp = onloadApp;
