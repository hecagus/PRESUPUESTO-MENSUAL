// =========================
//   VARIABLES GLOBALES
// =========================
let movimientos = JSON.parse(localStorage.getItem("movimientos")) || [];
let categorias = JSON.parse(localStorage.getItem("categorias")) || ["Transporte", "Comida", "Servicios"];

let registrosKm = JSON.parse(localStorage.getItem("registrosKm")) || [];
let registrosGasolina = JSON.parse(localStorage.getItem("registrosGasolina")) || [];


// =========================
//   GUARDAR KM DIARIOS
// =========================
document.getElementById("formKm")?.addEventListener("submit", function (e) {
    e.preventDefault();

    let kmInicial = Number(document.getElementById("kmInicial").value);
    let kmFinal = Number(document.getElementById("kmFinal").value);

    let kmRecorridos = kmFinal - kmInicial;

    if (kmRecorridos < 0) {
        alert("Los KM finales no pueden ser menores que los iniciales.");
        return;
    }

    registrosKm.push({
        fecha: new Date().toLocaleDateString(),
        kmInicial,
        kmFinal,
        kmRecorridos
    });

    localStorage.setItem("registrosKm", JSON.stringify(registrosKm));

    // LIMPIAR FORMULARIO AUTOMÁTICO
    document.getElementById("formKm").reset();

    alert("KM guardados correctamente.");
});


// =========================
//   GUARDAR REGISTRO GASOLINA
// =========================
document.getElementById("formGasolina")?.addEventListener("submit", function (e) {
    e.preventDefault();

    let litros = Number(document.getElementById("litros").value);
    let costoLitro = Number(document.getElementById("costoLitro").value);

    let total = litros * costoLitro;

    registrosGasolina.push({
        fecha: new Date().toLocaleDateString(),
        litros,
        costoLitro,
        total
    });

    localStorage.setItem("registrosGasolina", JSON.stringify(registrosGasolina));

    // LIMPIAR FORMULARIO AUTOMÁTICO
    document.getElementById("formGasolina").reset();

    alert("Registro de gasolina guardado correctamente.");
});


// =========================
//   CÁLCULO DE COSTO POR KM
// =========================
function calcularCostoPorKm() {
    if (registrosKm.length === 0 || registrosGasolina.length === 0) return 0;

    let kmTotales = registrosKm.reduce((sum, r) => sum + r.kmRecorridos, 0);
    let dineroGastado = registrosGasolina.reduce((sum, g) => sum + g.total, 0);

    return kmTotales > 0 ? (dineroGastado / kmTotales).toFixed(2) : 0;
}


// =========================
//   MOSTRAR DATOS EN TABLAS
// =========================
function renderTablas() {
    let tablaKm = document.getElementById("tablaKmBody");
    let tablaGas = document.getElementById("tablaGasBody");

    if (tablaKm) {
        tablaKm.innerHTML = registrosKm.map(r => `
            <tr>
                <td>${r.fecha}</td>
                <td>${r.kmInicial}</td>
                <td>${r.kmFinal}</td>
                <td>${r.kmRecorridos}</td>
            </tr>
        `).join("");
    }

    if (tablaGas) {
        tablaGas.innerHTML = registrosGasolina.map(g => `
            <tr>
                <td>${g.fecha}</td>
                <td>${g.litros}</td>
                <td>$${g.costoLitro}</td>
                <td>$${g.total}</td>
            </tr>
        `).join("");
    }

    let costoKm = document.getElementById("costoKm");
    if (costoKm) costoKm.textContent = "$" + calcularCostoPorKm();
}

renderTablas();
