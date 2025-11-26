/****************************************************
 * Presupuesto Mensual — app.js
 * Guarda datos en localStorage
 * Calcula resumen, gráficas, kilometraje, etc.
 ****************************************************/

// =========================
// LocalStorage Keys
// =========================
const DATA_KEY = "budget_data_v1";
const CFG_KEY = "budget_cfg_v1";

// =========================
// Estructuras
// =========================
let movimientos = JSON.parse(localStorage.getItem(DATA_KEY)) || [];
let config = JSON.parse(localStorage.getItem(CFG_KEY)) || {
    kmInicial: 0,
    kmFinal: 0,
    gastoPesos: 0,
    precioKm: 0
};

// =========================
// Guardado General
// =========================
function saveData() {
    localStorage.setItem(DATA_KEY, JSON.stringify(movimientos));
}

function saveConfig() {
    localStorage.setItem(CFG_KEY, JSON.stringify(config));
}

// =========================================
// UTILIDAD: Formato de moneda
// =========================================
function money(v) {
    return "$" + Number(v).toFixed(2);
}

// =========================================
// Página principal (index.html)
// =========================================
function renderPublic() {
    renderTotals();
    renderRecent();
    renderCharts();
}

// =========================================
// TOTALES
// =========================================
function renderTotals() {
    const totalIng = movimientos
        .filter(m => m.tipo === "ingreso")
        .reduce((sum, m) => sum + Number(m.monto), 0);

    const totalGas = movimientos
        .filter(m => m.tipo === "gasto")
        .reduce((sum, m) => sum + Number(m.monto), 0);

    document.getElementById("total-income").textContent = money(totalIng);
    document.getElementById("total-expense").textContent = money(totalGas);
    document.getElementById("balance").textContent = money(totalIng - totalGas);
}

// =========================================
// Movimientos Recientes
// =========================================
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

// =========================================
// GRÁFICAS
// =========================================
let pieChart, barChart;

function renderCharts() {
    renderPie();
    renderBar();
}

// GRÁFICA PIE — gastos por categoría
function renderPie() {
    const ctx = document.getElementById("pie-expense");

    const cats = {};
    movimientos
        .filter(m => m.tipo === "gasto")
        .forEach(m => {
            cats[m.categoria] = (cats[m.categoria] || 0) + Number(m.monto);
        });

    const labels = Object.keys(cats);
    const data = Object.values(cats);

    if (pieChart) pieChart.destroy();

    pieChart = new Chart(ctx, {
        type: "pie",
        data: {
            labels,
            datasets: [{
                data
            }]
        }
    });
}

// GRÁFICA BARRAS — balance mensual
function renderBar() {
    const ctx = document.getElementById("bar-balance");

    const meses = {};

    movimientos.forEach(m => {
        const mes = m.fecha.slice(0, 7); // YYYY-MM
        if (!meses[mes]) meses[mes] = { ingreso: 0, gasto: 0 };

        if (m.tipo === "ingreso") meses[mes].ingreso += Number(m.monto);
        if (m.tipo === "gasto") meses[mes].gasto += Number(m.monto);
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

// =========================================
// ADMIN: Agregar movimiento
// =========================================
function addMovimiento(fecha, tipo, categoria, descripcion, monto) {
    movimientos.push({
        fecha,
        tipo,
        categoria,
        descripcion,
        monto: Number(monto)
    });

    saveData();
    renderPublic();
}

// =========================================
// ADMIN: Cargar y guardar kilometraje
// =========================================
function calcularKilometraje(kmI, kmF, gastoPesos) {
    const kmRecorridos = kmF - kmI;
    const precioKm = kmRecorridos > 0 ? (gastoPesos / kmRecorridos) : 0;

    // Guardar en configuración
    config.kmInicial = kmI;
    config.kmFinal = kmF;
    config.gastoPesos = gastoPesos;
    config.precioKm = precioKm;

    saveConfig();

    // Registrar automáticamente como gasto
    if (kmRecorridos > 0 && gastoPesos > 0) {
        addMovimiento(
            new Date().toISOString().slice(0, 10),
            "gasto",
            "Kilometraje",
            "Gasto automático por km",
            gastoPesos
        );
    }

    alert("Kilometraje calculado y guardado.\nGasto agregado automáticamente.");

    return precioKm;
}

// =========================================
// ADMIN: Obtener Configuración
// =========================================
function getConfig() {
    return config;
}

// =========================================
// BORRAR TODO (si existiera en admin)
// =========================================
function borrarTodo() {
    if (confirm("¿Seguro que deseas borrar TODOS los movimientos?")) {
        movimientos = [];
        saveData();
        renderPublic();
    }
}
