// ====================================
//        VARIABLES EN LOCALSTORAGE
// ====================================
let ingresos = JSON.parse(localStorage.getItem("ingresos")) || [];
let gastos = JSON.parse(localStorage.getItem("gastos")) || [];
let kilometrajes = JSON.parse(localStorage.getItem("kilometrajes")) || [];
let gasolinas = JSON.parse(localStorage.getItem("gasolinas")) || [];

// ====================================
//         GUARDAR INGRESO
// ====================================
document.getElementById("formIngreso").addEventListener("submit", (e) => {
  e.preventDefault();

  ingresos.push({
    descripcion: ingresoDescripcion.value,
    cantidad: Number(ingresoCantidad.value),
    fecha: new Date().toLocaleString()
  });

  localStorage.setItem("ingresos", JSON.stringify(ingresos));
  e.target.reset();
  alert("Ingreso guardado");
});

// ====================================
//          GUARDAR GASTO
// ====================================
document.getElementById("formGasto").addEventListener("submit", (e) => {
  e.preventDefault();

  gastos.push({
    descripcion: gastoDescripcion.value,
    cantidad: Number(gastoCantidad.value),
    categoria: gastoCategoria.value,
    fecha: new Date().toLocaleString()
  });

  localStorage.setItem("gastos", JSON.stringify(gastos));
  e.target.reset();
  alert("Gasto guardado");
});

// ====================================
//     KM DIARIO (NO GASOLINA)
// ====================================
document.getElementById("formKmDiario").addEventListener("submit", (e) => {
  e.preventDefault();

  let kmIni = Number(kmInicialDiario.value);
  let kmFin = Number(kmFinalDiario.value);
  let kmRec = kmFin - kmIni;

  kilometrajes.push({
    kmInicial: kmIni,
    kmFinal: kmFin,
    kmRecorridos: kmRec,
    fecha: new Date().toLocaleString()
  });

  localStorage.setItem("kilometrajes", JSON.stringify(kilometrajes));
  e.target.reset();
  alert("Kilometraje diario guardado");
});

// ====================================
//    GASOLINA + CÁLCULO AUTOMÁTICO
// ====================================
const kmInicial = document.getElementById("kmInicial");
const kmFinal = document.getElementById("kmFinal");
const litros = document.getElementById("litros");
const costoLitro = document.getElementById("costoLitro");

function actualizarGasolina() {
  let ini = Number(kmInicial.value);
  let fin = Number(kmFinal.value);
  let lt = Number(litros.value);
  let costo = Number(costoLitro.value);

  let kmRec = fin - ini;
  let total = lt * costo;
  let precioKm = kmRec > 0 ? total / kmRec : 0;

  document.getElementById("kmRecorridos").textContent = kmRec;
  document.getElementById("precioKm").textContent = precioKm.toFixed(2);
}

[kmInicial, kmFinal, litros, costoLitro].forEach(input => {
  input.addEventListener("input", actualizarGasolina);
});

// ====================================
//   GUARDAR REPOSTAJE DE GASOLINA
// ====================================
document.getElementById("formGasolina").addEventListener("submit", (e) => {
  e.preventDefault();

  let kmIni = Number(kmInicial.value);
  let kmFinVal = Number(kmFinal.value);
  let lt = Number(litros.value);
  let costo = Number(costoLitro.value);

  let kmRec = kmFinVal - kmIni;
  let total = lt * costo;
  let precioKm = kmRec > 0 ? total / kmRec : 0;

  gasolinas.push({
    kmInicial: kmIni,
    kmFinal: kmFinVal,
    kmRecorridos: kmRec,
    litros: lt,
    costoLitro: costo,
    totalPagado: total,
    precioPorKm: precioKm,
    fecha: new Date().toLocaleString()
  });

  localStorage.setItem("gasolinas", JSON.stringify(gasolinas));

  // Limpieza automática
  e.target.reset();
  document.getElementById("kmRecorridos").textContent = "0";
  document.getElementById("precioKm").textContent = "0.00";

  alert("Repostaje guardado");
});
