// =====================================================
//  FUNCIONES BASE
// =====================================================
const $ = id => document.getElementById(id);

// Cargar datos
let movimientos = JSON.parse(localStorage.getItem("movimientos")) || [];
let categorias  = JSON.parse(localStorage.getItem("categorias")) || ["Comida","Gasolina","Servicios","Renta"];
let deudas      = JSON.parse(localStorage.getItem("deudas")) || [];
let kmConfig    = JSON.parse(localStorage.getItem("km")) || { kmInicial:0, kmFinal:0, gastoTotal:0 };

// Guardar datos
function guardarDatos(){
    localStorage.setItem("movimientos", JSON.stringify(movimientos));
    localStorage.setItem("categorias",  JSON.stringify(categorias));
    localStorage.setItem("deudas",      JSON.stringify(deudas));
    localStorage.setItem("km",          JSON.stringify(kmConfig));
}

// =====================================================
// INICIO DE APP
// =====================================================
function onloadApp(contexto){
    cargarCategorias(contexto);
    cargarTabla(contexto);
    mostrarResumen();
    cargarGraficaCategorias();
}

// =====================================================
//  CATEGORÍAS
// =====================================================
function cargarCategorias(contexto){
    const idSelect = contexto === "index" ? "categoria-index" : "categoria-admin";  
    const select = $(idSelect);
    if (!select) return;

    select.innerHTML = "";
    categorias.forEach(cat => {
        let opt = document.createElement("option");
        opt.value = cat;
        opt.textContent = cat;
        select.appendChild(opt);
    });
}

function agregarCategoria(contexto){
    const inputId = contexto === "index" ? "nuevaCategoria-index" : "nuevaCategoria-admin";
    const nueva = $(inputId).value.trim();
    if (!nueva) return;

    if (!categorias.includes(nueva)) {
        categorias.push(nueva);
        guardarDatos();
        cargarCategorias(contexto);
    }

    $(inputId).value = "";
    alert("Categoría agregada");
}

// =====================================================
//  MOVIMIENTOS
// =====================================================
function agregarMovimiento(contexto){
    const fecha = $(contexto === "index" ? "fecha-index" : "fecha-admin").value;
    const tipo  = $(contexto === "index" ? "tipo-index"  : "tipo-admin").value;
    const cat   = $(contexto === "index" ? "categoria-index" : "categoria-admin").value;
    const monto = parseFloat($(contexto === "index" ? "monto-index" : "monto-admin").value);
    const desc  = $(contexto === "index" ? "mov-desc-index" : "mov-desc-admin").value;

    if (!fecha || !tipo || isNaN(monto)) {
        alert("Completa todos los campos");
        return;
    }

    movimientos.push({
        id: Date.now(),
        fecha,
        tipo,
        categoria: cat,
        descripcion: desc || "",
        monto
    });

    guardarDatos();
    mostrarResumen();
    cargarTabla(contexto);

    alert("Movimiento agregado correctamente");
}

// =====================================================
//  TABLA DE MOVIMIENTOS (INDEX y ADMIN)
// =====================================================
function cargarTabla(contexto){
    const tablaId = contexto === "index" ? "tabla-recientes" : "tabla-admin";
    const tabla = $(tablaId);
    if (!tabla) return;

    tabla.innerHTML = `
        <tr>
            <th>Fecha</th>
            <th>Tipo</th>
            <th>Categoría</th>
            <th>Descripción</th>
            <th>Monto</th>
        </tr>
    `;

    movimientos.slice().reverse().forEach(m => {
        let tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${m.fecha}</td>
            <td>${m.tipo}</td>
            <td>${m.categoria}</td>
            <td>${m.descripcion}</td>
            <td>$${m.monto.toFixed(2)}</td>
        `;
        tabla.appendChild(tr);
    });
}

// =====================================================
//  RESÚMENES: INGRESOS, GASTOS, KM, BALANCE, DEUDA
// =====================================================
function mostrarResumen(){
    let ingresos = movimientos.filter(m => m.tipo === "Ingreso")
                              .reduce((s,m)=>s+m.monto,0);

    let gastos   = movimientos.filter(m => m.tipo === "Gasto")
                              .reduce((s,m)=>s+m.monto,0);

    let balance = ingresos - gastos;

    // Deuda
    let deudaTotal = deudas.reduce((t,d)=>t+d.montoActual,0);

    // Mostrar resultados
    if ($("total-ingresos")) $("total-ingresos").textContent = ingresos.toFixed(2);
    if ($("total-gastos"))   $("total-gastos").textContent   = gastos.toFixed(2);
    if ($("balance"))        $("balance").textContent        = balance.toFixed(2);
    if ($("deudaTotalLabel"))$("deudaTotalLabel").textContent = deudaTotal.toFixed(2);

    // Kilometraje
    if ($("km-recorridos")) $("km-recorridos").textContent = (kmConfig.kmFinal - kmConfig.kmInicial).toFixed(1);
    if ($("km-gasto")) $("km-gasto").textContent = kmConfig.gastoTotal.toFixed(2);
}

// =====================================================
//  GRAFICA
// =====================================================
function cargarGraficaCategorias(){
    const canvas = $("grafica-categorias");
    if (!canvas) return;

    const gastos = movimientos.filter(m => m.tipo === "Gasto");

    const dataCat = {};

    gastos.forEach(g => {
        dataCat[g.categoria] = (dataCat[g.categoria] || 0) + g.monto;
    });

    new Chart(canvas, {
        type: "bar",
        data: {
            labels: Object.keys(dataCat),
            datasets: [{
                label: "Gastos por categoría",
                data: Object.values(dataCat),
                backgroundColor: "#e74c3c"
            }]
        },
        options: { responsive:true }
    });
}

// =====================================================
//  DEUDAS
// =====================================================
function registrarDeuda(){
    const nombre = $("deuda-nombre").value.trim();
    const monto  = parseFloat($("deuda-monto-inicial").value);

    if (!nombre || isNaN(monto)){
        alert("Completa los campos");
        return;
    }

    deudas.push({
        id: Date.now(),
        nombre,
        montoActual: monto
    });

    guardarDatos();
    mostrarResumen();
    cargarDeudasAdmin();
    alert("Deuda registrada");
}

function abonarDeuda(){
    const id   = $("deuda-select-abono").value;
    const abono = parseFloat($("deuda-monto-abono").value);

    if (!id || isNaN(abono)){
        alert("Completa los campos");
        return;
    }

    let deuda = deudas.find(d => d.id == id);
    deuda.montoActual -= abono;
    if (deuda.montoActual < 0) deuda.montoActual = 0;

    guardarDatos();
    mostrarResumen();
    cargarDeudasAdmin();
    alert("Abono aplicado");
}

function cargarDeudasAdmin(){
    const tabla = $("tabla-deudas");
    if (!tabla) return;

    tabla.innerHTML = `
        <tr><th>Nombre</th><th>Monto</th><th>Acción</th></tr>
    `;

    const select = $("deuda-select-abono");
    if (select) select.innerHTML = `<option value="">-- Selecciona una deuda --</option>`;

    deudas.forEach(d => {
        let tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${d.nombre}</td>
            <td>$${d.montoActual.toFixed(2)}</td>
            <td><button onclick="eliminarDeuda(${d.id})" class="button-small secondary">Eliminar</button></td>
        `;
        tabla.appendChild(tr);

        if (select){
            let op = document.createElement("option");
            op.value = d.id;
            op.textContent = d.nombre;
            select.appendChild(op);
        }
    });
}

function eliminarDeuda(id){
    deudas = deudas.filter(d => d.id !== id);
    guardarDatos();
    cargarDeudasAdmin();
    mostrarResumen();
}
