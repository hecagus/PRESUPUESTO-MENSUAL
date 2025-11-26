/****************************************************
 * Presupuesto Mensual — app.js
 * Manejo de movimientos, categorías y kilometraje
 ****************************************************/

// =========================
// LocalStorage Keys
// =========================
const DATA_KEY = "budget_data_v1";
const CFG_KEY = "budget_cfg_v1";
const CAT_KEY = "budget_categories_v1";

// =========================
// Datos almacenados
// =========================
let movimientos = JSON.parse(localStorage.getItem(DATA_KEY)) || [];

let config = JSON.parse(localStorage.getItem(CFG_KEY)) || {
    kmInicial: 0,
    kmFinal: 0,
    gastoPesos: 0,
    precioKm: 0
};

// Categorías separadas por tipo
let categorias = JSON.parse(localStorage.getItem(CAT_KEY)) || {
    ingreso: ["Quincenal", "Mensual", "Propinas", "Uber", "Otros"],
    gasto: ["Comida", "Gasolina", "Internet", "Renta", "Servicios", "Despensa"]
};

// =========================
// Guardar datos
// =========================
function saveData() {
    localStorage.setItem(DATA_KEY, JSON.stringify(movimientos));
}
function saveConfig() {
    localStorage.setItem(CFG_KEY, JSON.stringify(config));
}
function saveCategorias() {
    localStorage.setItem(CAT_KEY, JSON.stringify(categorias));
}

// =========================
// FORMATO MONEDA
// =========================
function money(v) {
    return "$" + Number(v).toFixed(2);
}

// ===================================================
// RENDER PÁGINA PRINCIPAL
// ===================================================
function renderPublic() {
    renderTotals();
    renderRecent();
    renderCharts();
}

// TOTAL INGRESOS/GASTOS/BALANCE
function renderTotals() {
    const totalIng = movimientos.filter(m => m.tipo === "ingreso")
                                .reduce((a, b) => a + Number(b.monto), 0);

    const totalGas = movimientos.filter(m => m.tipo === "gasto")
                                .reduce((a, b) => a + Number(b.monto), 0);

    document.getElementById("total-income").textContent = money(totalIng);
    document.getElementById("total-expense").textContent = money(totalGas);
    document.getElementById("balance").textContent = money(totalIng - totalGas);
}

// MOVIMIENTOS RECIENTES
function renderRecent() {
    const tbody = document.querySelector("#recent-table tbody");
    tbody.innerHTML = "";

    const ultimos = [...movimientos].slice(-10).reverse();

    for (const m of ultimos) {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${m.fecha}</td>
            <td>${m.tipo}</td>
            <td>${m.categoria}</td>
            <td>${m.descripcion || "-"}</td>
            <td>${money(m.monto)}</td>
        `;
        tbody.appendChild(tr);
    }
}

// ===================================================
// GRÁFICAS
// ===================================================
let pieChart, barChart;

function renderCharts() {
    renderPie();
    renderBar();
}

// PIE — gastos por categoría
function renderPie() {
    const ctx = document.getElementById("pie-expense");
    if (!ctx) return;

    const cats = {};
    movimientos.filter(m => m.tipo === "gasto").forEach(m => {
        cats[m.categoria] = (cats[m.categoria] || 0) + Number(m.monto);
    });

    const labels = Object.keys(cats);
    const data = Object.values(cats);

    if (pieChart) pieChart.destroy();

    pieChart = new Chart(ctx, {
        type: "pie",
        data: {
            labels,
            datasets: [{ data }]
        }
    });
}

// BARRAS — balance mensual
function renderBar() {
    const ctx = document.getElementById("bar-balance");
    if (!ctx) return;

    const meses = {};

    movimientos.forEach(m => {
        const mes = m.fecha.slice(0, 7); // YYYY-MM
        if (!meses[mes]) meses[mes] = { ingreso: 0, gasto: 0 };

        if (m.tipo === "ingreso") meses[mes].ingreso += Number(m.monto);
        if (m.tipo === "gasto")   meses[mes].gasto   += Number(m.monto);
    });

    const labels = Object.keys(meses);
    const income = labels.map(m => meses[m].ingreso);
    const expense = labels.map(m => meses[m].gasto);

    if (barChart) barChart.destroy();

    barChart = new Chart(ctx, {
        type: "bar",
        data: {
            labels,
            datasets: [
                { label: "Ingresos", data: income },
                { label: "Gastos", data: expense }
            ]
        }
    });
}

// ===================================================
// ADMIN: CATEGORÍAS
// ===================================================
function cambiarTipo() {
    const tipo = document.getElementById("movTipo").value;
    const select = document.getElementById("movCategoria");
    if (!select) return;

    select.innerHTML = "";

    if (!tipo || !categorias[tipo]) return;

    categorias[tipo].forEach(cat => {
        const op = document.createElement("option");
        op.value = cat;
        op.textContent = cat;
        select.appendChild(op);
    });
}

function agregarNuevoTipo() {
    const tipo = document.getElementById("movTipo").value;
    const nuevo = document.getElementById("nuevoTipo").value.trim();

    if (!tipo) return alert("Selecciona si es ingreso o gasto.");
    if (!nuevo) return alert("Escribe una nueva categoría.");

    categorias[tipo].push(nuevo);
    saveCategorias();

    document.getElementById("nuevoTipo").value = "";
    cambiarTipo(); // recargar select

    alert("Categoría agregada.");
}

// ===================================================
// ADMIN: MOVIMIENTO
// ===================================================
function agregarMovimiento() {
    const fecha = document.getElementById("movFecha").value;
    const tipo = document.getElementById("movTipo").value;
    const categoria = document.getElementById("movCategoria").value;
    const monto = document.getElementById("movMonto").value;

    if (!fecha || !tipo || !categoria || !monto) {
        return alert("Completa todos los campos.");
    }

    movimientos.push({
        fecha,
        tipo,
        categoria,
        descripcion: "",
        monto: Number(monto)
    });

    saveData();
    renderPublic();

    alert("Movimiento agregado.");
}

// ===================================================
// ADMIN: KILOMETRAJE
// ===================================================
function calcularKm() {
    const kmI = Number(document.getElementById("kmInicial").value);
    const kmF = Number(document.getElementById("kmFinal").value);
    const gasto = Number(document.getElementById("kmGasto").value);

    const kmRec = kmF - kmI;
    const precio = kmRec > 0 ? gasto / kmRec : 0;

    config = { kmInicial: kmI, kmFinal: kmF, gastoPesos: gasto, precioKm: precio };
    saveConfig();

    document.getElementById("precioKmCalc").textContent = precio.toFixed(2);

    if (gasto > 0) {
        movimientos.push({
            fecha: new Date().toISOString().slice(0, 10),
            tipo: "gasto",
            categoria: "Kilometraje",
            descripcion: "Gasto automático por km",
            monto: gasto
        });
        saveData();
        renderPublic();
    }

    alert("Kilometraje guardado y gasto registrado.");
}

function cargarKm() {
    document.getElementById("kmInicial").value = config.kmInicial;
    document.getElementById("kmFinal").value = config.kmFinal;
    document.getElementById("kmGasto").value = config.gastoPesos;
    document.getElementById("precioKmCalc").textContent = config.precioKm.toFixed(2);
}

// ===================================================
// BORRAR TODO
// ===================================================
function borrarTodo() {
    if (!confirm("¿Seguro que quieres borrar todos los datos?")) return;
    movimientos = [];
    saveData();
    renderPublic();
}
