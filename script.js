// ======================== VARIABLES ========================
let movimientos = JSON.parse(localStorage.getItem("budget_data_v1") || "[]");

let cfg = JSON.parse(localStorage.getItem("budget_cfg_v1") || JSON.stringify({
    kmInicial: 0,
    kmFinal: 0,
    precioPorKm: 0
}));

let categoriasBase = ["Transporte", "Alquiler", "Gasolina"];
let ingresosBase = ["Quincenal", "Mensual", "Propinas", "Otros"];

let categorias = [...categoriasBase];
let ingresos = [...ingresosBase];

// ======================== FUNCIONES ========================
function showSection(seccion) {
    document.getElementById("resumen").style.display = "none";
    document.getElementById("admin").style.display = "none";
    document.getElementById(seccion).style.display = "block";
    render();
}

function guardarLocal() {
    localStorage.setItem("budget_data_v1", JSON.stringify(movimientos));
    localStorage.setItem("budget_cfg_v1", JSON.stringify(cfg));
}

// ------------------ AGREGAR NUEVO TIPO ---------------------
function agregarNuevoIngreso() {
    let val = document.getElementById("nuevo-ingreso").value.trim();
    if (!val) return;
    ingresos.push(val);
    renderSelects();
}

function agregarNuevaCategoria() {
    let val = document.getElementById("nuevo-gasto").value.trim();
    if (!val) return;
    categorias.push(val);
    renderSelects();
}

// ------------------ AGREGAR MOVIMIENTO ---------------------
function agregarMovimiento() {
    let obj = {
        fecha: document.getElementById("mov-fecha").value,
        tipo: document.getElementById("mov-tipo").value,
        categoria: (document.getElementById("mov-tipo").value === "Ingreso")
            ? document.getElementById("ingreso-tipo").value
            : document.getElementById("gasto-cat").value,
        desc: document.getElementById("mov-desc").value,
        monto: Number(document.getElementById("mov-monto").value)
    };

    movimientos.push(obj);
    guardarLocal();
    render();
}

// ------------------ BORRAR UNO ---------------------
function borrarMovimiento(i) {
    movimientos.splice(i, 1);
    guardarLocal();
    render();
}

// ------------------ SELECTS ---------------------
function renderSelects() {
    document.getElementById("ingreso-tipo").innerHTML =
        ingresos.map(x => `<option>${x}</option>`).join("");

    document.getElementById("gasto-cat").innerHTML =
        categorias.map(x => `<option>${x}</option>`).join("");
}

// ------------------ KILOMETRAJE ---------------------
function calcularKilometraje() {
    let ini = Number(document.getElementById("km-inicial").value);
    let fin = Number(document.getElementById("km-final").value);
    let gasto = Number(prompt("¿Cuánto gastaste en gasolina hoy? (en pesos)"));

    let km = fin - ini;
    let precioKm = gasto / km;

    document.getElementById("km-total").value = km;
    document.getElementById("precio-km").value = precioKm.toFixed(2);
    document.getElementById("gasto-total").value = gasto;

    cfg.kmInicial = ini;
    cfg.kmFinal = fin;
    cfg.precioPorKm = precioKm;

    guardarLocal();
}

function guardarConfig() {
    guardarLocal();
    alert("Configuración guardada");
}

// ------------------ RENDER GENERAL ---------------------
function render() {

    renderSelects();

    // ----- Cálculos -----
    let totalIng = movimientos.filter(m => m.tipo === "Ingreso")
        .reduce((a, b) => a + b.monto, 0);

    let totalGas = movimientos.filter(m => m.tipo === "Gasto")
        .reduce((a, b) => a + b.monto, 0);

    document.getElementById("total-ingresos").innerHTML = "$" + totalIng.toFixed(2);
    document.getElementById("total-gastos").innerHTML = "$" + totalGas.toFixed(2);
    document.getElementById("balance").innerHTML = "$" + (totalIng - totalGas).toFixed(2);

    // ----- Movimientos en tabla -----
    let tabla = movimientos.map((m, i) =>
        `<tr>
            <td>${m.fecha}</td>
            <td>${m.tipo}</td>
            <td>${m.categoria}</td>
            <td>${m.desc}</td>
            <td>$${m.monto.toFixed(2)}</td>
            <td><button onclick="borrarMovimiento(${i})">X</button></td>
        </tr>`).join("");

    document.getElementById("tabla-todos").innerHTML =
        "<tr><th>Fecha</th><th>Tipo</th><th>Cat/Tipo</th><th>Desc</th><th>Monto</th><th></th></tr>" +
        tabla;
}

// ------------------ EXPORTAR / IMPORTAR ---------------------
function exportarJSON() {
    document.getElementById("json-area").value =
        JSON.stringify({ data: movimientos, cfg: cfg }, null, 2);
}

function importarJSON() {
    try {
        let obj = JSON.parse(document.getElementById("json-area").value);
        movimientos = obj.data;
        cfg = obj.cfg;
        guardarLocal();
        render();
    } catch (e) {
        alert("JSON inválido");
    }
}

// Inicial
render();
