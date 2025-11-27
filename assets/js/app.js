// =========================
// VARIABLES GLOBALES
// =========================
let movimientos = JSON.parse(localStorage.getItem("movimientos")) || [];
let categorias = JSON.parse(localStorage.getItem("categorias")) || ["Transporte","Comida","Servicios","Gasolina","Alquiler","Luz","Agua"];
let deudas = JSON.parse(localStorage.getItem("deudas")) || [];
let kmConfig = JSON.parse(localStorage.getItem("kmConfig")) || null;

// =========================
// FUNCIONES BÁSICAS
// =========================
function $(id){ return document.getElementById(id) || null; }
function guardarDatos(){
    localStorage.setItem("movimientos", JSON.stringify(movimientos));
    localStorage.setItem("categorias", JSON.stringify(categorias));
    localStorage.setItem("deudas", JSON.stringify(deudas));
    localStorage.setItem("kmConfig", JSON.stringify(kmConfig));
}

// =========================
// CATEGORÍAS
// =========================
function agregarCategoria(){
    const nueva = $("nuevaCategoria")?.value.trim();
    if(!nueva) return;
    if(!categorias.includes(nueva)){
        categorias.push(nueva);
        guardarDatos();
        cargarCategorias();
    }
    $("nuevaCategoria").value="";
}
function cargarCategorias(){
    const select=$("categoria");
    if(!select) return;
    select.innerHTML="";
    categorias.forEach(cat=>{
        const op=document.createElement("option");
        op.value=cat;
        op.textContent=cat;
        select.appendChild(op);
    });
}

// =========================
// MOVIMIENTOS
// =========================
function agregarMovimiento(){
    const fecha=$("fecha")?.value;
    const tipo=$("tipo")?.value;
    const categoria=$("categoria")?.value;
    const monto=parseFloat($("monto")?.value);
    const descripcion=$("mov-desc")?.value.trim() || "";

    if(!fecha || !tipo || !categoria || !monto || isNaN(monto)){
        return alert("Completa todos los campos correctamente.");
    }

    movimientos.push({id:Date.now(),fecha,tipo,categoria,monto,descripcion});
    guardarDatos();
    cargarTablaTodos();
    mostrarDeuda();
    alert(`${tipo} agregado correctamente.`);
}

// =========================
// DEUDAS
// =========================
function registrarNuevaDeuda(){
    const nombre=$("deuda-nombre")?.value.trim();
    const monto=parseFloat($("deuda-monto-inicial")?.value);
    if(!nombre || !monto || isNaN(monto) || monto<=0) return alert("Nombre o monto inválido.");

    deudas.push({id:Date.now(),nombre,montoOriginal:monto,montoActual:monto,fechaCreacion:new Date().toLocaleDateString(),movimientos:[]});
    guardarDatos();
    cargarTablaDeudas();
    mostrarDeuda();
    cerrarFormularioDeuda();
    alert(`Deuda "${nombre}" registrada.`);
}
function abonarADeuda(){
    const deudaId=parseInt($("deuda-select-abono")?.value);
    const abonoMonto=parseFloat($("deuda-monto-abono")?.value);
    if(!deudaId || !abonoMonto || isNaN(abonoMonto) || abonoMonto<=0) return alert("Monto inválido.");
    const deuda=deudas.find(d=>d.id===deudaId);
    if(!deuda) return alert("Deuda no encontrada");
    if(deuda.montoActual-abonoMonto<0) return alert("Abono excede el monto actual");

    deuda.montoActual-=abonoMonto;
    deuda.movimientos.push({fecha:new Date().toLocaleDateString(),monto:abonoMonto});

    // Registrar gasto como movimiento
    movimientos.push({id:Date.now()+1,fecha:new Date().toISOString().substring(0,10),tipo:"Gasto",categoria:"Abono a Deuda",descripcion:`Abono a ${deuda.nombre}`,monto:abonoMonto});

    guardarDatos();
    cargarTablaDeudas();
    cargarTablaTodos();
    mostrarDeuda();
    cerrarFormularioDeuda();
    alert(`Abono $${abonoMonto} realizado a "${deuda.nombre}"`);
}
function eliminarDeuda(id){
    if(!confirm("¿Eliminar deuda?")) return;
    deudas=deudas.filter(d=>d.id!==id);
    guardarDatos();
    cargarTablaDeudas();
    mostrarDeuda();
}
function cargarTablaDeudas(){
    const tabla=$("tabla-deudas");
    if(!tabla) return;
    let tbody=tabla.querySelector('tbody');
    if(!tbody){tbody=document.createElement('tbody');tabla.appendChild(tbody);}
    tbody.innerHTML="";
    if(deudas.length===0){tbody.innerHTML='<tr><td colspan="3">No hay deudas registradas.</td></tr>';return;}
    deudas.forEach(d=>{
        const tr=document.createElement("tr");
        const status=d.montoActual>0?'valor-negativo':'valor-positivo';
        tr.innerHTML=`<td>${d.nombre}</td><td class="${status}">$${d.montoActual.toFixed(2)}</td>
        <td><button onclick="eliminarDeuda(${d.id})" class="button-small secondary">Eliminar</button></td>`;
        tbody.appendChild(tr);
    });
}
function mostrarFormularioDeuda(){cargarSelectDeudas();$("deuda-modal").style.display="flex";}
function cerrarFormularioDeuda(){ $("deuda-modal").style.display="none";}
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
// KILOMETRAJE
// =========================
function calcularKm(){
    const kmIni=parseFloat($("kmInicial")?.value);
    const kmFin=parseFloat($("kmFinal")?.value);
    const gasto=parseFloat($("gastoTotal")?.value);
    if(isNaN(kmIni)||isNaN(kmFin)||isNaN(gasto)) return alert("Completa los campos");

    const kmRec=kmFin-kmIni;
    const precioKm=kmRec>0?gasto/kmRec:0;
    $("precioKm").textContent=precioKm.toFixed(2);

    kmConfig={kmInicial:kmIni,kmFinal:kmFin,gastoTotal:gasto,precioKm};
    guardarDatos();

    // Registrar gasto de gasolina como movimiento
    movimientos.push({id:Date.now()+999,fecha:new Date().toISOString().substring(0,10),tipo:"Gasto",categoria:"Gasolina",descripcion:"Gasto combustible",monto:gasto});
    guardarDatos();
    cargarTablaTodos();
    mostrarDeuda();
    alert("Kilometraje guardado y gasto registrado");
}
function cargarConfiguracionKm(){
    if(!kmConfig) return;
    $("kmInicial").value=kmConfig.kmInicial;
    $("kmFinal").value=kmConfig.kmFinal;
    $("gastoTotal").value=kmConfig.gastoTotal;
    $("precioKm").textContent=kmConfig.precioKm.toFixed(2);
}

// =========================
// TABLAS
// =========================
function cargarTablaTodos(){
    const tabla=$("tabla-todos");
    if(!tabla) return;
    let tbody=tabla.querySelector('tbody');
    if(!tbody){tbody=document.createElement('tbody');tabla.appendChild(tbody);}
    tbody.innerHTML="";
    if(movimientos.length===0){tbody.innerHTML='<tr><td colspan="5">No hay movimientos.</td></tr>';return;}
    const movs=[...movimientos].sort((a,b)=>new Date(b.fecha)-new Date(a.fecha));
    movs.forEach(m=>{
        const cls=m.tipo==='Ingreso'?'valor-positivo':'valor-negativo';
        const tr=document.createElement("tr");
        tr.innerHTML=`<td>${m.fecha}</td><td>${m.tipo}</td><td>${m.categoria}</td><td class="${cls}">$${m.monto.toFixed(2)}</td>
        <td><button onclick="eliminarMovimiento(${m.id})" class="button-small secondary">X</button></td>`;
        tbody.appendChild(tr);
    });
}
function eliminarMovimiento(id){movimientos=movimientos.filter(m=>m.id!==id);guardarDatos();cargarTablaTodos();mostrarDeuda();}

// =========================
// RESUMEN FINANCIERO
// =========================
function mostrarDeuda(){
    // Total deuda
    const totalDeuda=deudas.reduce((sum,d)=>sum+d.montoActual,0);
    $("deudaTotalLabel").textContent=totalDeuda.toFixed(2);

    // Ingresos/Gastos
    const totalIngresos=movimientos.filter(m=>m.tipo==='Ingreso').reduce((sum,m)=>sum+m.monto,0);
    const totalGastos=movimientos.filter(m=>m.tipo==='Gasto').reduce((sum,m)=>sum+m.monto,0);
    $("total-ingresos").textContent=totalIngresos.toFixed(2);
    $("total-gastos").textContent=totalGastos.toFixed(2);

    // Balance
    const balance=totalIngresos-totalGastos;
    $("balance").textContent=balance.toFixed(2);

    // Kilometraje
    const kmTotal=kmConfig?kmConfig.kmFinal-kmConfig.kmInicial:0;
    $("kmTotal").textContent=kmTotal;
    $("gastoCombustible").textContent=kmConfig?kmConfig.gastoTotal.toFixed(2):"0.00";

    // Graficas
    renderGraficas();
}

// =========================
// GRÁFICAS
// =========================
function renderGraficas(){
    const ctxCat=document.getElementById("grafica-categorias");
    const ctxMes=document.getElementById("grafica-mensual");
    if(!ctxCat || !ctxMes) return;

    // Categorías
    const categoriasGastos={};
    categorias.forEach(cat=>categoriasGastos[cat]=0);
    movimientos.filter(m=>m.tipo==='Gasto').forEach(m=>{
        if(categoriasGastos[m.categoria]!==undefined) categoriasGastos[m.categoria]+=m.monto;
        else categoriasGastos[m.categoria]=m.monto;
    });

    new Chart(ctxCat,{type:'bar',data:{labels:Object.keys(categoriasGastos),datasets:[{label:'Gastos por Categoría',data:Object.values(categoriasGastos),backgroundColor:'rgba(255,99,132,0.5)'}]},options:{responsive:true}});

    // Balance mensual
    const meses={};
    movimientos.forEach(m=>{
        const date=new Date(m.fecha);
        const key=date.getFullYear()+"-"+(date.getMonth()+1);
        if(!meses[key]) meses[key]={Ingreso:0,Gasto:0,Deuda:0};
        meses[key][m.tipo]= (meses[key][m.tipo]||0)+m.monto;
    });

    const labels=Object.keys(meses);
    const ingresos=labels.map(l=>meses[l].Ingreso||0);
    const gastos=labels.map(l=>meses[l].Gasto||0);

    new Chart(ctxMes,{
        type:'line',
        data:{
            labels,
            datasets:[
                {label:'Ingresos',data:ingresos,borderColor:'green',fill:false},
                {label:'Gastos',data:gastos,borderColor:'red',fill:false},
            ]
        },
        options:{responsive:true}
    });
}

// =========================
// INICIALIZACIÓN
// =========================
function onloadApp(){
    cargarCategorias();
    cargarTablaTodos();
    cargarTablaDeudas();
    mostrarDeuda();
}
function showSection(id){
    document.querySelectorAll(".section").forEach(s=>s.style.display="none");
    const sec=$(id);
    if(sec) sec.style.display="block";
}
