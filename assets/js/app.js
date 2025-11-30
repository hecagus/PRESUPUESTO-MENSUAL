// ==============================
// SISTEMA DE ALMACENAMIENTO
// ==============================
let data = {
    ingresos: [],
    gastos: [],
    km: [],
    gas: [],
    deudas: [],
    movimientos: [],
    turnos: [],
    proyeccion: {
        deudaTotal: 0,
        gastoFijo: 0
    }
};

function cargarDatos() {
    const saved = localStorage.getItem("panelData");
    if (saved) data = JSON.parse(saved);
}

function guardarDatos() {
    localStorage.setItem("panelData", JSON.stringify(data));
}

cargarDatos();


// ==============================
// UTILIDADES
// ==============================
function agregarMovimiento(tipo, descripcion, monto) {
    const mov = {
        tipo,
        descripcion,
        monto,
        fecha: new Date().toLocaleString()
    };
    data.movimientos.unshift(mov);
    guardarDatos();
    mostrarMovimientos();
}


// ==============================
// REGISTRAR INGRESO
// ==============================
document.getElementById("btnGuardarIngreso").addEventListener("click", () => {
    const desc = document.getElementById("ingresoDescripcion").value;
    const cant = Number(document.getElementById("ingresoCantidad").value);

    if (!desc || !cant) return alert("Completa todos los campos");

    data.ingresos.push({ desc, cant, fecha: new Date().toLocaleDateString() });
    agregarMovimiento("Ingreso", desc, cant);

    guardarDatos();

    document.getElementById("ingresoDescripcion").value = "";
    document.getElementById("ingresoCantidad").value = "";
});


// ==============================
// REGISTRAR GASTO
// ==============================
document.getElementById("btnGuardarGasto").addEventListener("click", () => {
    const desc = document.getElementById("gastoDescripcion").value;
    const cant = Number(document.getElementById("gastoCantidad").value);
    const cat = document.getElementById("gastoCategoria").value;

    if (!desc || !cant) return alert("Completa todos los campos");

    data.gastos.push({ desc, cant, cat, fecha: new Date().toLocaleDateString() });
    agregarMovimiento("Gasto", `${desc} (${cat})`, cant);

    guardarDatos();

    document.getElementById("gastoDescripcion").value = "";
    document.getElementById("gastoCantidad").value = "";
});
/* ============================================================
   =============  SECCIÓN: DEUDAS Y ABONOS  ====================
   ============================================================ */

function cargarDeudas() {
    let lista = document.getElementById("listaDeudas");
    let select = document.getElementById("abonoSeleccionar");

    if (!lista || !select) return; // si estamos en index.html

    lista.innerHTML = "";
    select.innerHTML = "";

    deudas.forEach((d, i) => {
        let pendiente = d.monto - d.abonado;

        // Lista en pantalla
        let li = document.createElement("li");
        li.innerHTML = `
            <strong>${d.nombre}</strong><br>
            Total: $${d.monto} — Pagado: $${d.abonado} — Pendiente: <strong>$${pendiente}</strong>
        `;
        lista.appendChild(li);

        // Select para abonos
        let opt = document.createElement("option");
        opt.value = i;
        opt.textContent = `${d.nombre} ($${pendiente} pendiente)`;
        select.appendChild(opt);
    });

    guardarDatos();
}

document.getElementById("btnRegistrarDeuda")?.addEventListener("click", () => {
    let nombre = document.getElementById("deudaNombre").value;
    let monto = parseFloat(document.getElementById("deudaMonto").value);

    if (!nombre || monto <= 0) return alert("Completa los campos");

    deudas.push({ nombre, monto, abonado: 0 });
    guardarDatos();
    cargarDeudas();

    document.getElementById("deudaNombre").value = "";
    document.getElementById("deudaMonto").value = "";

    alert("Deuda registrada");
});

document.getElementById("btnRegistrarAbono")?.addEventListener("click", () => {
    let idx = document.getElementById("abonoSeleccionar").value;
    let monto = parseFloat(document.getElementById("abonoMonto").value);

    if (idx === "" || monto <= 0) return alert("Completa los campos");

    deudas[idx].abonado += monto;
    guardarDatos();
    cargarDeudas();

    document.getElementById("abonoMonto").value = "";

    alert("Abono guardado");
});



/* ============================================================
   ======== SECCIÓN: KM DIARIOS Y GASOLINA =====================
   ============================================================ */

document.getElementById("kmFinal")?.addEventListener("input", () => {
    let ini = parseFloat(document.getElementById("kmInicial").value) || 0;
    let fin = parseFloat(document.getElementById("kmFinal").value) || 0;

    document.getElementById("kmRecorridos").textContent = (fin - ini);
});

document.getElementById("btnGuardarKm")?.addEventListener("click", () => {
    let kmInicial = parseFloat(document.getElementById("kmInicial").value);
    let kmFinal = parseFloat(document.getElementById("kmFinal").value);

    if (isNaN(kmInicial) || isNaN(kmFinal) || kmFinal <= kmInicial) {
        return alert("KM incorrectos");
    }

    let recorrido = kmFinal - kmInicial;

    kmDiarios.push({
        fecha: new Date().toLocaleString(),
        kmInicial,
        kmFinal,
        recorrido
    });

    guardarDatos();

    document.getElementById("kmInicial").value = "";
    document.getElementById("kmFinal").value = "";
    document.getElementById("kmRecorridos").textContent = "0";

    alert("KM guardados");
});

document.getElementById("btnGuardarGas")?.addEventListener("click", () => {
    let litros = parseFloat(document.getElementById("litrosGas").value);
    let costo = parseFloat(document.getElementById("costoGas").value);

    if (litros <= 0 || costo <= 0) return alert("Datos inválidos");

    gasolina.push({
        fecha: new Date().toLocaleString(),
        litros,
        costo
    });

    guardarDatos();

    document.getElementById("litrosGas").value = "";
    document.getElementById("costoGas").value = "";

    alert("Repostaje guardado");
});



/* ============================================================
   ============= EXPORTAR / IMPORTAR DATOS =====================
   ============================================================ */

document.getElementById("btnExportar")?.addEventListener("click", () => {
    let data = {
        ingresos,
        gastos,
        kmDiarios,
        gasolina,
        deudas,
        turnos,
        parametros
    };

    let texto = JSON.stringify(data, null, 2);
    navigator.clipboard.writeText(texto);

    alert("Datos copiados al portapapeles");
});

document.getElementById("btnImportar")?.addEventListener("click", () => {
    let json = document.getElementById("importJson").value;

    try {
        let data = JSON.parse(json);

        ingresos = data.ingresos || [];
        gastos = data.gastos || [];
        kmDiarios = data.kmDiarios || [];
        gasolina = data.gasolina || [];
        deudas = data.deudas || [];
        turnos = data.turnos || [];
        parametros = data.parametros || {};

        guardarDatos();
        cargarDeudas();
        renderMovimientos();

        alert("Datos importados correctamente");
    } catch (e) {
        alert("JSON inválido");
    }
});



/* ============================================================
   =========== TABLA DE MOVIMIENTOS RECIENTES =================
   ============================================================ */

function renderMovimientos() {
    let tabla = document.getElementById("tablaMovimientos");
    if (!tabla) return;

    tabla.innerHTML = "";

    let movimientos = [];

    ingresos.forEach(i => movimientos.push({ tipo: "Ingreso", desc: i.descripcion, monto: i.cantidad, fecha: i.fecha }));
    gastos.forEach(g => movimientos.push({ tipo: "Gasto", desc: g.descripcion + " (" + g.categoria + ")", monto: g.cantidad, fecha: g.fecha }));

    movimientos = movimientos.reverse().slice(0, 20);

    movimientos.forEach(m => {
        let tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${m.tipo}</td>
            <td>${m.desc}</td>
            <td>$${m.monto}</td>
            <td>${m.fecha}</td>
        `;
        tabla.appendChild(tr);
    });
}
/* ============================================================
   =============  PROYECCIÓN REAL BASADA EN TUS DATOS ===========
   ============================================================ */

// Cargar parámetros guardados
function cargarParametros() {
    if (document.getElementById("proyDeudaTotal")) {
        document.getElementById("proyDeudaTotal").value = parametros.deudaTotal || 0;
        document.getElementById("proyGastoFijo").value = parametros.gastoFijo || 0;
    }
}
cargarParametros();


// Guardar parámetros
document.getElementById("btnGuardarProyeccion")?.addEventListener("click", () => {
    parametros.deudaTotal = parseFloat(document.getElementById("proyDeudaTotal").value) || 0;
    parametros.gastoFijo = parseFloat(document.getElementById("proyGastoFijo").value) || 0;

    guardarDatos();
    calcularProyeccionReal();

    alert("Parámetros guardados");
});


// FUNCIÓN PRINCIPAL DE PROYECCIÓN
function calcularProyeccionReal() {
    if (!document.getElementById("proyDiasTrabajados")) return;

    /* ================================
       1. CÁLCULOS BÁSICOS
       ================================= */

    let totalGanado = ingresos.reduce((t, i) => t + i.cantidad, 0);
    let totalGastado = gastos.reduce((t, g) => t + g.cantidad, 0);
    let diasTrabajados = turnos.length;

    let totalHoras = turnos.reduce((t, x) => t + x.horas, 0);
    let horasProm = diasTrabajados ? totalHoras / diasTrabajados : 0;

    let gananciaPromDia = diasTrabajados ? totalGanado / diasTrabajados : 0;
    let gastoPromDia = diasTrabajados ? totalGastado / diasTrabajados : 0;

    let gananciaNetaReal = gananciaPromDia - gastoPromDia;

    /* ================================
       2. KM Y GASOLINA
       ================================= */

    let kmProm = kmDiarios.length
        ? kmDiarios.reduce((t, x) => t + x.recorrido, 0) / kmDiarios.length
        : 0;

    let gasProm = gasolina.length
        ? gasolina.reduce((t, x) => t + x.costo, 0) / gasolina.length
        : 0;

    /* ================================
       3. CÁLCULO DE DÍAS PARA PAGAR DEUDA
       ================================= */

    let deudaTotal = parametros.deudaTotal || 0;
    let gastoFijo = parametros.gastoFijo || 0;

    let netoDiario = gananciaNetaReal - gastoFijo;

    let diasParaPagar = 0;

    if (netoDiario > 0) {
        diasParaPagar = deudaTotal / netoDiario;
    } else {
        diasParaPagar = Infinity;
    }

    /* ================================
       4. MOSTRAR EN PANTALLA
       ================================= */

    document.getElementById("proyDiasTrabajados").textContent = diasTrabajados;
    document.getElementById("proyHorasPromedio").textContent = horasProm.toFixed(2);

    document.getElementById("proyGananciaPromedio").textContent =
        "$" + gananciaPromDia.toFixed(2);

    document.getElementById("proyGananciaNetaReal").textContent =
        "$" + gananciaNetaReal.toFixed(2);

    document.getElementById("proyKmPromedio").textContent = kmProm.toFixed(1);
    document.getElementById("proyGasolinaPromedio").textContent = "$" + gasProm.toFixed(2);

    if (diasParaPagar === Infinity) {
        document.getElementById("proyDiasEstimados").textContent =
            "No es posible (ganancia neta negativa)";
    } else {
        document.getElementById("proyDiasEstimados").textContent =
            diasParaPagar.toFixed(1) + " días";
    }
}

calcularProyeccionReal();
// ======================================================
// SISTEMA DE TURNOS (COMPATIBLE CON TU ADMIN.HTML ACTUAL)
// ======================================================

let turnoActivo = JSON.parse(localStorage.getItem("turnoActivo")) || false;
let turnoInicio = localStorage.getItem("turnoInicio") || null;

function actualizarUIturno() {
    const btnIni = document.getElementById("btnIniciarTurno");
    const btnFin = document.getElementById("btnFinalizarTurno");
    const txt = document.getElementById("turnoTexto");

    if (!btnIni || !btnFin || !txt) return;

    if (turnoActivo) {
        btnIni.style.display = "none";
        btnFin.style.display = "inline-block";
        txt.textContent = "Turno en curso";
    } else {
        btnIni.style.display = "inline-block";
        btnFin.style.display = "none";
        txt.textContent = "Sin turno activo";
    }
}

function iniciarTurno() {
    if (turnoActivo) return alert("Ya hay un turno en curso.");

    turnoActivo = true;
    turnoInicio = new Date().toISOString();

    localStorage.setItem("turnoActivo", true);
    localStorage.setItem("turnoInicio", turnoInicio);

    actualizarUIturno();
}

function finalizarTurno() {
    if (!turnoActivo) return alert("No hay turno activo.");

    const inicio = new Date(turnoInicio);
    const fin = new Date();
    const horas = ((fin - inicio) / 1000 / 60 / 60).toFixed(2);

    const gan = Number(prompt(`Terminó el turno.\nHoras trabajadas: ${horas}\nIngresa la GANANCIA del turno:`));
    if (!gan) return alert("Ganancia inválida.");

    data.turnos.push({
        inicio: inicio.toISOString(),
        fin: fin.toISOString(),
        horas: Number(horas),
        ganancia: gan
    });

    agregarMovimiento("Ingreso", `Ganancia turno (${horas}h)`, gan);

    turnoActivo = false;
    turnoInicio = null;

    localStorage.setItem("turnoActivo", false);
    localStorage.removeItem("turnoInicio");

    guardarDatos();
    actualizarUIturno();
}

// listeners
document.addEventListener("DOMContentLoaded", () => {
    const ini = document.getElementById("btnIniciarTurno");
    const fin = document.getElementById("btnFinalizarTurno");

    if (ini) ini.onclick = iniciarTurno;
    if (fin) fin.onclick = finalizarTurno;

    actualizarUIturno();
});
