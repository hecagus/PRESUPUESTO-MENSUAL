// =========================
//   VARIABLES GLOBALES
// =========================
let movimientos = JSON.parse(localStorage.getItem("movimientos")) || [];
let categorias = JSON.parse(localStorage.getItem("categorias")) || ["Transporte", "Comida", "Servicios"];
let deudas = JSON.parse(localStorage.getItem("deudas")) || [];
let kmConfig = JSON.parse(localStorage.getItem("kmConfig")) || null;

// =========================
//   GUARDAR DATOS
// =========================
function guardarDatos() {
    localStorage.setItem("movimientos", JSON.stringify(movimientos));
    localStorage.setItem("categorias", JSON.stringify(categorias));
    localStorage.setItem("kmConfig", JSON.stringify(kmConfig));
    localStorage.setItem("deudas", JSON.stringify(deudas));
}

// =========================
//   FUNCIONES AUXILIARES
// =========================
function $(id){return document.getElementById(id) || null;}

// =========================
//   CATEGORÍAS
// =========================
function agregarCategoria(){
    const nueva = $("nuevaCategoria")?.value.trim();
    if(!nueva) return;
    if(!categorias.includes(nueva)){
        categorias.push(nueva);
        guardarDatos();
        cargarCategorias();
    }
    $("nuevaCategoria").value = "";
}
function cargarCategorias(){
    const select = $("categoria");
    if(!select) return;
    select.innerHTML = "";
    categorias.forEach(cat=>{
        const op=document.createElement("option");
        op.value=cat; op.textContent=cat;
        select.appendChild(op);
    });
}

// =========================
//   MOVIMIENTOS
// =========================
function agregarMovimiento(){
    const fecha=$("fecha")?.value;
    const tipo=$("tipo")?.value;
    const categoria=$("categoria")?.value;
    const monto=parseFloat($("monto")?.value);
    if(!fecha || !tipo || !categoria || isNaN(monto)){
        alert("Completa todos los campos correctamente."); return;
    }
    movimientos.push({fecha,tipo,categoria,monto,id:Date.now()});
    guardarDatos();
    cargarTablaTodos();
    mostrarDeuda();
    alert(`${tipo} agregado correctamente.`);
}
function cargarTablaTodos(){
    const tabla=$("tabla-todos");
    if(!tabla) return;
    let tbody=tabla.querySelector('tbody');
    if(!tbody){tbody=document.createElement('tbody'); tabla.appendChild(tbody);}
    tbody.innerHTML='';
    if(movimientos.length===0){tbody.innerHTML='<tr><td colspan="5">No hay movimientos registrados.</td></tr>'; return;}
    const movs=[...movimientos].sort((a,b)=>new Date(b.fecha)-new Date(a.fecha));
    movs.forEach(mov=>{
        const tr=document.createElement("tr");
        const cls=mov.tipo==='Ingreso'?'valor-positivo':'valor-negativo';
        tr.innerHTML=`<td>${mov.fecha}</td><td>${mov.tipo}</td><td>${mov.categoria}</td><td class="${cls}">$${mov.monto.toFixed(2)}</td><td><button onclick="eliminarMovimiento(${mov.id})" class="button-small secondary">X</button></td>`;
        tbody.appendChild(tr);
    });
}
function eliminarMovimiento(id){
    movimientos=movimientos.filter(m=>m.id!==id);
    guardarDatos();
    cargarTablaTodos();
    mostrarDeuda();
}

// =========================
//   DEUDAS
// =========================
function mostrarFormularioDeuda(){cargarSelectDeudas(); $("deuda-modal").style.display='flex';}
function cerrarFormularioDeuda(){$("deuda-modal").style.display='none';}

function registrarNuevaDeuda(){
    const nombre=$("deuda-nombre")?.value.trim();
    const monto=parseFloat($("deuda-monto-inicial")?.value);
    if(!nombre||isNaN(monto)||monto<=0){alert("Ingresa un nombre y un monto válido."); return;}
    const nuevaDeuda={id:Date.now(),nombre,montoOriginal:monto,montoActual:monto,fechaCreacion:new Date().toLocaleDateString(),movimientos:[]};
    deudas.push(nuevaDeuda);
    guardarDatos();
    cargarTablaDeudas();
    mostrarDeuda();
    cerrarFormularioDeuda();
    alert(`Deuda "${nombre}" registrada por $${monto.toFixed(2)}`);
}

function abonarADeuda(){
    const deudaId=parseInt($("deuda-select-abono")?.value);
    const abonoMonto=parseFloat($("deuda-monto-abono")?.value);
    if(!deudaId||isNaN(abonoMonto)||abonoMonto<=0){alert("Selecciona una deuda e ingresa un monto válido."); return;}
    const deuda=deudas.find(d=>d.id===deudaId);
    if(!deuda){alert("Deuda no encontrada."); return;}
    if(deuda.montoActual-abonoMonto<0){alert("El abono excede el monto actual."); return;}
    movimientos.push({fecha:new Date().toISOString().substring(0,10),tipo:"Gasto",categoria:"Abono a Deuda",descripcion:`Abono a ${deuda.nombre}`,monto:abonoMonto,id:Date.now()+1});
    deuda.montoActual-=abonoMonto;
    deuda.movimientos.push({fecha:new Date().toLocaleDateString(),monto:abonoMonto});
    guardarDatos();
    cargarTablaDeudas();
    cargarTablaTodos();
    mostrarDeuda();
    cerrarFormularioDeuda();
    alert(`Abono de $${abonoMonto.toFixed(2)} realizado a "${deuda.nombre}".`);
}

function cargarTablaDeudas(){
    const tabla=$("tabla-deudas");
    if(!tabla) return;
    let tbody=tabla.querySelector('tbody');
    if(!tbody){tbody=document.createElement('tbody'); tabla.appendChild(tbody);}
    tbody.innerHTML='';
    if(deudas.length===0){tbody.innerHTML='<tr><td colspan="3">No hay deudas registradas.</td></tr>'; return;}
    deudas.forEach(d=>{
        const tr=document.createElement("tr");
        const cls=d.montoActual>0?'valor-negativo':'valor-positivo';
        tr.innerHTML=`<td>${d.nombre}</td><td class="${cls}">$${d.montoActual.toFixed(2)}</td><td><button onclick="eliminarDeuda(${d.id})" class="button-small secondary">Eliminar</button></td>`;
        tbody.appendChild(tr);
    });
}

function eliminarDeuda(id){
    if(!confirm("¿Seguro que quieres eliminar esta deuda?")) return;
    deudas=deudas.filter(d=>d.id!==id);
    guardarDatos();
    cargarTablaDeudas();
    mostrarDeuda();
}

function cargarSelectDeudas(){
    const select=$("deuda-select-abono");
    if(!select) return;
    select.innerHTML='<option value="">-- Selecciona una Deuda --</option>';
    deudas.filter(d=>d.montoActual>0).forEach(d=>{
        const op=document.createElement("option");
        op.value=d.id;
        op.textContent=`${d.nombre} ($${d.montoActual.toFixed(2)})`;
        select.appendChild(op);
    });
}

// =========================
//   KILOMETRAJE
// =========================
function calcularKm(){
    const kmInicial=parseFloat($("kmInicial")?.value);
    const kmFinal=parseFloat($("kmFinal")?.value);
    const gastoTotal=parseFloat($("gastoTotal")?.value);
    if(isNaN(kmInicial)||isNaN(kmFinal)||isNaN(gastoTotal)){alert("Completa todos los campos de kilometraje"); return;}
    const kmRecorridos=kmFinal-kmInicial;
    const precioKm=kmRecorridos>0?gastoTotal/kmRecorridos:0;
    if($("precioKm")) $("precioKm").textContent=precioKm.toFixed(2);
    kmConfig={kmInicial,kmFinal,gastoTotal,precioKm};
    guardarDatos();
    alert("Kilometraje guardado");
}

function cargarConfiguracionKm(){
    if(!kmConfig) return;
    if($("kmInicial")) $("kmInicial").value=kmConfig.kmInicial;
    if($("kmFinal")) $("kmFinal").value=kmConfig.kmFinal;
    if($("gastoTotal")) $("gastoTotal").value=kmConfig.gastoTotal;
    if($("precioKm")) $("precioKm").textContent=kmConfig.precioKm.toFixed(2);
}

// =========================
//   MOSTRAR TOTALES / DEUDA
// =========================
function mostrarDeuda(){
    const deudaTotal=deudas.reduce((sum,d)=>sum+d.montoActual,0);
    if($("deudaTotalLabel")) $("deudaTotalLabel").textContent=deudaTotal.toFixed(2);

    const totalIngresos=movimientos.filter(m=>m.tipo==='Ingreso').reduce((s,m)=>s+m.monto,0);
    const totalGastos=movimientos.filter(m=>m.tipo==='Gasto').reduce((s,m)=>s+m.monto,0);
    const balance=totalIngresos-totalGastos;

    if($("total-ingresos")) $("total-ingresos").textContent=totalIngresos.toFixed(2);
    if($("total-gastos")) $("total-gastos").textContent=totalGastos.toFixed(2);
    if($("balance")) $("balance").textContent=balance.toFixed(2);

    const balanceEl=$("balance");
    if(balanceEl){
        balanceEl.parentNode.classList.remove('valor-positivo','valor-negativo');
        if(balance>0) balanceEl.parentNode.classList.add('valor-positivo');
        if(balance<0) balanceEl.parentNode.classList.add('valor-negativo');
    }
}

// =========================
//   INICIALIZAR APP
// =========================
function onloadApp(){
    cargarCategorias();
    cargarConfiguracionKm();
    mostrarDeuda();
        }
