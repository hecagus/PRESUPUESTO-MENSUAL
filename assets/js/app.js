// ======================\
// app.js — PARTE 1/5: SETUP Y UTILIDADES
// ======================\

const STORAGE_KEY = "panelData";
const $ = id => document.getElementById(id);

// Estructura base
let panelData = {
  ingresos: [],
  gastos: [],
  kmDiarios: [],
  gasolina: [],
  deudas: [],
  movimientos: [],
  turnos: [],
  parametros: {
    deudaTotal: 0,
    gastoFijo: 0,
    ultimoKMfinal: null,
    // Nuevos parámetros manuales de Ajustes (Valores por defecto)
    comidaDiaria: 200, 
    costoPorKm: 0.6
  }
};

// ======================\
// Cargar / Guardar
// ======================\
function cargarPanelData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);

    panelData = Object.assign({}, panelData, parsed);
    // Asegurar que los parámetros manuales existan, incluso en datos viejos
    panelData.parametros = Object.assign({
        deudaTotal: 0,
        gastoFijo: 0,
        ultimoKMfinal: null,
        comidaDiaria: 200, 
        costoPorKm: 0.6
    }, (parsed.parametros || {}));

  } catch (e) {
    console.error("Error al cargar panelData:", e);
  }
}

function guardarPanelData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(panelData));
  } catch (e) {
    console.error("Error guardando panelData:", e);
  }
}

// Cargar al inicio (antes de DOMContentLoaded)
cargarPanelData();

// ======================\
// Utilidades
// ======================\
const fmtMoney = n => Number(n || 0).toFixed(2);
const fmtDate = (iso) => new Date(iso).toLocaleDateString('es-MX', {
    day: '2-digit', month: '2-digit', year: 'numeric'
});

// UTILIDAD: Calcular Promedio de Gasto por Categoría (para Comida)
function getPromedioGastoCategoria(categoria, dias=30) {
    const haceXDias = new Date();
    haceXDias.setDate(haceXDias.getDate() - dias);

    const gastosRelevantes = (panelData.gastos || []).filter(g => 
        g.categoria === categoria && new Date(g.fechaISO) >= haceXDias
    );

    const gastosPorFecha = {};
    gastosRelevantes.forEach(g => {
        const key = (g.fechaISO || "").slice(0, 10);
        gastosPorFecha[key] = (gastosPorFecha[key] || 0) + Number(g.cantidad || 0);
    });

    const numDiasConGasto = Object.keys(gastosPorFecha).length;
    
    if (numDiasConGasto === 0) return 0;

    const totalGastado = Object.values(gastosPorFecha).reduce((s, v) => s + v, 0);

    return totalGastado / numDiasConGasto;
}

// UTILIDAD: Obtener Gastos de un Día Específico (para renderTablaTurnos)
function getGastosDelDia(dateStringISO) {
    // Extrae la parte de la fecha (YYYY-MM-DD)
    const dia = dateStringISO.slice(0, 10);
    
    // Suma todos los gastos que coincidan con esa fecha
    return (panelData.gastos || [])
        .filter(g => (g.fechaISO || "").slice(0, 10) === dia)
        .reduce((s, g) => s + (Number(g.cantidad) || 0), 0);
}

// ======================\
// app.js — PARTE 2/5: LISTENERS Y MANEJADORES DE FORMULARIOS
// ======================\

// Manejador genérico para guardar un movimiento (Ingreso/Gasto)
function guardarMovimiento(tipo, descripcionId, cantidadId, categoriaId) {
    const descripcion = $(descripcionId).value.trim();
    const cantidad = Number($(cantidadId).value);
    const categoria = categoriaId ? $(categoriaId).value : 'Ingreso';

    if (!descripcion || isNaN(cantidad) || cantidad <= 0) {
        alert("Por favor, introduce una descripción y un monto válido.");
        return;
    }

    const fechaISO = new Date().toISOString();
    const fechaLocal = new Date().toLocaleTimeString('es-MX', {
        day: 'numeric', month: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });

    const nuevoMovimiento = {
        descripcion,
        cantidad,
        categoria,
        fechaISO,
        fechaLocal
    };

    if (tipo === 'ingreso') {
        panelData.ingresos.push(nuevoMovimiento);
    } else {
        panelData.gastos.push(nuevoMovimiento);
    }
    
    // Si es un gasto, necesitamos actualizar la proyección (puede afectar el promedio de comida)
    if (tipo === 'gasto') {
        calcularGastoFijoAuto();
    }

    panelData.movimientos.push(nuevoMovimiento);
    guardarPanelData();
    
    // Limpiar campos
    $(descripcionId).value = "";
    $(cantidadId).value = "";

    // Actualizar todas las vistas que dependen de estos datos
    renderResumenIndex();
    calcularProyeccionReal(); 

    alert(`${tipo === 'ingreso' ? 'Ingreso' : 'Gasto'} guardado: $${fmtMoney(cantidad)}.`);
}

function setupIngresoListeners() {
    $("btnGuardarIngreso")?.addEventListener("click", () => {
        guardarMovimiento('ingreso', 'ingresoDescripcion', 'ingresoCantidad');
    });
}

function setupGastoListeners() {
    $("btnGuardarGasto")?.addEventListener("click", () => {
        guardarMovimiento('gasto', 'gastoDescripcion', 'gastoCantidad', 'gastoCategoria');
    });
}

function setupKmAndGasListeners() {
    // ------------------ KM ------------------
    $("btnGuardarKm")?.addEventListener("click", () => {
        const kmInicial = Number($("kmInicial").value);
        const kmFinal = Number($("kmFinal").value);

        if (isNaN(kmInicial) || isNaN(kmFinal) || kmFinal <= kmInicial) {
            alert("Por favor, introduce valores válidos donde KM Final sea mayor que KM Inicial.");
            return;
        }

        const recorrido = kmFinal - kmInicial;
        const fechaISO = new Date().toISOString();

        panelData.kmDiarios.push({ kmInicial, kmFinal, recorrido, fechaISO });
        panelData.parametros.ultimoKMfinal = kmFinal; 
        
        guardarPanelData();
        
        // Actualizar UI
        $("kmRecorridos").textContent = recorrido;
        $("kmInicial").value = kmFinal; // Sugerir el final como inicio para el siguiente
        $("kmFinal").value = "";
        
        // Recalcular métricas
        // Las siguientes llamadas son esenciales para actualizar las proyecciones y tablas
        renderKmMensual();
        calcularGastoFijoAuto(); 
        calcularProyeccionReal();
        alert(`KM recorridos guardados: ${recorrido} KM.`);
    });
    
    $("kmInicial")?.addEventListener("input", actualizarKmRecorridos);
    $("kmFinal")?.addEventListener("input", actualizarKmRecorridos);

    function actualizarKmRecorridos() {
        const kmInicial = Number($("kmInicial").value);
        const kmFinal = Number($("kmFinal").value);
        if (!isNaN(kmInicial) && !isNaN(kmFinal) && kmFinal > kmInicial) {
            $("kmRecorridos").textContent = (kmFinal - kmInicial).toFixed(2);
        } else {
            $("kmRecorridos").textContent = "0";
        }
    }


    // ------------------ GASOLINA ------------------
    $("btnGuardarGas")?.addEventListener("click", () => {
        const litros = Number($("litrosGas").value);
        const costo = Number($("costoGas").value);

        if (isNaN(litros) || isNaN(costo) || litros <= 0 || costo <= 0) {
            alert("Por favor, introduce valores válidos para Litros y Costo.");
            return;
        }

        const fechaISO = new Date().toISOString();
        panelData.gasolina.push({ litros, costo, fechaISO });
        guardarPanelData();
        
        $("litrosGas").value = "";
        $("costoGas").value = "";

        // Recalcular métricas
        renderKmMensual();
        calcularGastoFijoAuto(); 
        calcularProyeccionReal();
        alert(`Registro de gasolina guardado: ${litros} L por $${fmtMoney(costo)}.`);
    });
}


// ------------------ AJUSTES MANUALES ------------------
function setupParametrosListeners() {
    const p = panelData.parametros;
    
    // Cargar valores guardados en los inputs (para admin.html)
    if ($("paramComidaDiaria")) $("paramComidaDiaria").value = p.comidaDiaria;
    if ($("paramCostoPorKm")) $("paramCostoPorKm").value = p.costoPorKm;

    $("btnGuardarParametros")?.addEventListener("click", () => {
        const comida = Number($("paramComidaDiaria").value);
        const costoKm = Number($("paramCostoPorKm").value);

        if (isNaN(comida) || comida < 0 || isNaN(costoKm) || costoKm < 0) {
            alert("Asegúrate de que los valores de ajuste sean números positivos.");
            return;
        }

        panelData.parametros.comidaDiaria = comida;
        panelData.parametros.costoPorKm = costoKm;
        
        guardarPanelData();
        
        // Recalcular la proyección
        calcularGastoFijoAuto();
        calcularProyeccionReal();
        alert("Ajustes de proyección guardados exitosamente.");
    });
}

// ======================\
// app.js — PARTE 3/5: TURNOS Y CÁLCULOS AUTOMÁTICOS
// ======================\

let turnoActivo = JSON.parse(localStorage.getItem("turnoActivo") || "null");

function actualizarUIturno() {
    const btnIniciar = $("btnIniciarTurno");
    const btnFinalizar = $("btnFinalizarTurno");
    const texto = $("turnoTexto");

    if (!btnIniciar || !btnFinalizar || !texto) return;

    if (turnoActivo) {
        btnIniciar.style.display = 'none';
        btnFinalizar.style.display = 'block';
        const horaInicio = new Date(turnoActivo.inicio).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
        texto.textContent = `Turno en curso iniciado a las ${horaInicio}.`;
    } else {
        btnIniciar.style.display = 'block';
        btnFinalizar.style.display = 'none';
        texto.textContent = "Inicia un turno cuando empieces a trabajar.";
    }
}

function iniciarTurno() {
    if (turnoActivo) return;

    const fechaISO = new Date().toISOString();
    turnoActivo = {
        inicio: fechaISO,
        ganancia: 0,
        ingresos: []
    };
    localStorage.setItem("turnoActivo", JSON.stringify(turnoActivo));
    actualizarUIturno();
    alert("Turno iniciado.");
}

function finalizarTurno() {
    if (!turnoActivo) return;

    const fin = new Date().toISOString();
    const inicioDate = new Date(turnoActivo.inicio);
    const finDate = new Date(fin);
    const msDiff = finDate - inicioDate;
    const horas = msDiff / (1000 * 60 * 60);

    // Sumar todos los ingresos registrados desde el inicio del turno
    const totalGanancia = panelData.ingresos
        .filter(i => i.fechaISO >= turnoActivo.inicio && i.fechaISO <= fin)
        .reduce((sum, i) => sum + Number(i.cantidad), 0);
    
    // Crear el registro del turno
    const nuevoTurno = {
        inicio: turnoActivo.inicio,
        fin: fin,
        horas: horas.toFixed(2),
        ganancia: totalGanancia.toFixed(2)
    };
    
    panelData.turnos.push(nuevoTurno);
    
    // Limpiar el estado
    turnoActivo = null;
    localStorage.removeItem("turnoActivo");
    guardarPanelData();
    
    actualizarUIturno();
    
    // Forzar renderizado
    renderResumenIndex();
    calcularProyeccionReal();
    renderTablaTurnos();

    alert(`Turno finalizado. Horas trabajadas: ${nuevoTurno.horas}h. Ganancia Bruta: $${nuevoTurno.ganancia}.`);
}

// ------------------ DEUDAS ------------------
function setupDeudaListeners() {
    // ... (Lógica de los 4 pasos para registrar deuda, se mantiene igual, omitida aquí por longitud) ...

    // Manejador de Abono
    $("btnRegistrarAbono")?.addEventListener("click", () => {
        const index = $("abonoSeleccionar").value;
        const monto = Number($("abonoMonto").value);

        if (index === "" || isNaN(monto) || monto <= 0) {
            alert("Selecciona una deuda y un monto de abono válido.");
            return;
        }

        const deuda = panelData.deudas[index];
        const abonadoActual = Number(deuda.abonado) || 0;
        const nuevoAbonado = abonadoActual + monto;
        
        if (nuevoAbonado > Number(deuda.monto)) {
            alert("El abono excede el monto total de la deuda. Ajusta el monto.");
            return;
        }

        deuda.abonado = nuevoAbonado;

        // Registrar el abono como un gasto para el historial
        const fechaISO = new Date().toISOString();
        const fechaLocal = new Date().toLocaleTimeString('es-MX', {
            day: 'numeric', month: 'numeric', year: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
        panelData.gastos.push({
            descripcion: `Abono a ${deuda.nombre}`,
            cantidad: monto,
            categoria: 'Abono a Deuda',
            fechaISO,
            fechaLocal
        });

        guardarPanelData();
        renderDeudas();
        calcularDeudaTotalAuto(); // Recalcula la deuda total pendiente
        calcularProyeccionReal(); 

        $("abonoMonto").value = "";
        alert(`Abono de $${fmtMoney(monto)} registrado a ${deuda.nombre}.`);
    });
}


// ------------------ CÁLCULOS AUTOMÁTICOS ------------------

function calcularDeudaTotalAuto() {
    let totalPendiente = 0;

    (panelData.deudas || []).forEach(d => {
        const pendiente = (Number(d.monto) || 0) - (Number(d.abonado) || 0);
        if (pendiente > 0) {
            totalPendiente += pendiente;
        }
    });

    panelData.parametros.deudaTotal = totalPendiente;
    guardarPanelData();

    const inp = $("proyDeudaTotal");
    if (inp) {
        inp.value = totalPendiente.toFixed(2);
    }
}


// B) calcularGastoFijoAuto (LÓGICA OPTIMIZADA)
function calcularGastoFijoAuto() {
    panelData.parametros = panelData.parametros || {};

    // 1. Cargar parámetros manuales
    const comidaDiariaManual = Number(panelData.parametros.comidaDiaria) || 200; 
    const costoPorKm = Number(panelData.parametros.costoPorKm) || 0.6; 

    // 2. Calcular promedio de KM
    const kmArr = panelData.kmDiarios || [];
    const kmProm = kmArr.length
        ? kmArr.reduce((s, k) => s + (Number(k.recorrido) || 0), 0) / kmArr.length
        : 0;
        
    // 3. Obtener el Gasto de Comida Diario: Promedio de los últimos 30 días registrados.
    const promedioComidaRegistrada = getPromedioGastoCategoria("Comida", 30); 
    
    // Usar el promedio de los gastos reales. Si es 0 (no hay historial), usar el valor manual asumido.
    const gastoComidaDiario = promedioComidaRegistrada > 0 ? promedioComidaRegistrada : comidaDiariaManual;


    // 4. Calcular el Abono Diario Promedio de Deudas ACTIVAS (PROGRAMADO)
    let abonoDiarioPromedio = 0;

    (panelData.deudas || []).forEach(d => {
        const pendiente = (Number(d.monto) || 0) - (Number(d.abonado) || 0);
        const abonoProgramado = Number(d.abonoProgramado || 0);
        const periodicidad = d.periodicidad || "";
        
        // Solo si hay saldo pendiente y un abono programado fijo
        if (pendiente > 0 && abonoProgramado > 0) {
            let dias = 30; // Base: Mensual
            if (periodicidad === "Semanal") dias = 7;
            if (periodicidad === "Quincenal") dias = 15;
            
            abonoDiarioPromedio += (abonoProgramado / dias);
        }
    });

    // 5. Fórmula Gasto Fijo DIARIO (Total del Gasto Programado y Asumido)
    const gastoFijo = abonoDiarioPromedio + gastoComidaDiario + (kmProm * costoPorKm);

    panelData.parametros.gastoFijo = gastoFijo;
    guardarPanelData();

    const inp = $("proyGastoFijo");
    if (inp) {
        inp.value = gastoFijo.toFixed(2);
    }
}

// ======================\
// app.js — PARTE 4/5: FUNCIONES DE RENDERIZADO Y PROYECCIÓN
// ======================\

// Función de resumen diario (solo para index.html)
function renderResumenIndex() {
    const hoyISO = new Date().toISOString().slice(0, 10);

    const ingresosHoy = (panelData.ingresos || [])
        .filter(i => i.fechaISO.slice(0, 10) === hoyISO)
        .reduce((s, i) => s + Number(i.cantidad), 0);

    // NOTA: Los gastos de hoy son todos, incluyendo abonos y gasolina
    const gastosHoy = (panelData.gastos || []) 
        .filter(g => g.fechaISO.slice(0, 10) === hoyISO)
        .reduce((s, g) => s + Number(g.cantidad), 0);

    const netaHoy = ingresosHoy - gastosHoy;

    if ($("resHoras")) $("resHoras").textContent = (panelData.turnos.slice(-1)[0]?.horas || 0);
    if ($("resGananciaBruta")) $("resGananciaBruta").textContent = "$" + fmtMoney(ingresosHoy);
    if ($("resGastos")) $("resGastos").textContent = "$" + fmtMoney(gastosHoy);
    if ($("resNeta")) $("resNeta").textContent = "$" + fmtMoney(netaHoy);

    // Renderizar tablas y gráficas
    renderTablaTurnos();
    renderKmMensual();
    calcularProyeccionReal(); 
    // renderGraficas(); // Asumiendo que esta función está definida aparte
}


// Función de renderizado de Deudas (CORREGIDA: Solo muestra deudas pendientes)
function renderDeudas() {
    const list = $("listaDeudas");
    const select = $("abonoSeleccionar");

    if (!list || !select) return;

    list.innerHTML = "";
    select.innerHTML = "";

    // 1. Filtrar solo deudas con saldo pendiente
    const deudasPendientes = panelData.deudas.filter(d => {
        const pendiente = (Number(d.monto) || 0) - (Number(d.abonado) || 0);
        return pendiente > 0;
    });

    deudasPendientes.forEach(d => {
        // Obtenemos el índice original para registrar el abono correctamente
        const originalIndex = panelData.deudas.findIndex(original => original.nombre === d.nombre && original.monto === d.monto);

        const pendiente = (Number(d.monto) || 0) - (Number(d.abonado) || 0);
        const programado = Number(d.abonoProgramado || 0);
        const periodicidad = d.periodicidad || "";

        list.innerHTML += `
            <li>
                <strong>${d.nombre}</strong><br>
                Total: $${fmtMoney(d.monto)}<br>
                Pagado: $${fmtMoney(d.abonado || 0)}<br>
                Programado: $${fmtMoney(programado)} ${periodicidad}<br>
                Pendiente: <strong>$${fmtMoney(pendiente)}</strong>
            </li>
        `;

        // Llenar el <select> para abonar
        if (pendiente > 0) {
            const opt = document.createElement("option");
            opt.value = originalIndex; 
            opt.textContent = `${d.nombre} — $${fmtMoney(pendiente)} pendiente`;
            select.appendChild(opt);
        }
    });

    if (deudasPendientes.length === 0) {
        list.innerHTML = "<li style='color: green; font-weight: bold;'>¡Felicidades, has liquidado todas tus deudas pendientes!</li>";
    }
    
    // Deshabilitar abono si no hay deudas pendientes
    const hasPendingDebt = select.children.length > 0;
    select.disabled = !hasPendingDebt;
    $("abonoMonto").disabled = !hasPendingDebt;
    $("btnRegistrarAbono").disabled = !hasPendingDebt;
    if (!hasPendingDebt) {
        select.innerHTML = `<option value="">-- No hay deudas pendientes --</option>`;
    }
}


// Tabla Turnos (CORREGIDA: muestra Gastos del Día usando getGastosDelDia)
function renderTablaTurnos() {
    const tbody = $("tablaTurnos");
    if (!tbody) return;

    tbody.innerHTML = "";

    const arr = [...(panelData.turnos || [])].reverse();

    if (arr.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center">No hay turnos registrados.</td></tr>`;
        return;
    }

    arr.forEach(t => {
        const fechaTurno = fmtDate(t.inicio);
        
        // **LÍNEA CLAVE: Obtenemos todos los gastos de ese día**
        const gastosDelDia = getGastosDelDia(t.inicio);
        const neta = (Number(t.ganancia) || 0) - gastosDelDia;

        tbody.innerHTML += `
            <tr>
                <td>${fechaTurno}</td>
                <td>${(Number(t.horas) || 0).toFixed(2)}</td>
                <td>$${fmtMoney(t.ganancia)}</td>
                <td>$${fmtMoney(gastosDelDia)}</td> 
                <td>$${fmtMoney(neta)}</td>
            </tr>
        `;
    });
}


// Proyección Real (CORREGIDA: Evita Doble Conteo)
function calcularProyeccionReal() {
    const p = panelData.parametros || {};
    const deudaTotal = Number(p.deudaTotal || 0);
    const gastoFijo  = Number(p.gastoFijo || 0); 
    
    const turnos = panelData.turnos || [];
    const diasTrabajados = new Set(turnos.map(t => (t.inicio || "").slice(0,10))).size;

    const totalHoras = turnos.reduce((s,t)=>s+ (Number(t.horas)||0),0);
    const totalGan     = turnos.reduce((s,t)=>s+ (Number(t.ganancia)||0),0);

    const horasPromDia = diasTrabajados ? totalHoras / diasTrabajados : 0;
    const ganPromDia   = diasTrabajados ? totalGan / diasTrabajados : 0;
    
    // 1. CALCULAR GASTO OPERATIVO PROMEDIO (Gastos No-Fijos/Otros)
    const gastos = panelData.gastos || [];
    
    // Filtramos para EXCLUIR los gastos que ya están considerados en el Gasto Fijo Calculado:
    // Abono a Deuda, Comida, Transporte y Mantenimiento.
    const gastosOperativos = gastos.filter(g => 
        g.categoria !== "Abono a Deuda" && 
        g.categoria !== "Comida" &&
        g.categoria !== "Transporte" &&
        g.categoria !== "Mantenimiento" 
    ); 

    const gastosPorFecha = {};

    gastosOperativos.forEach(g=>{
        const key = (g.fechaISO || "").slice(0,10);
        if (!key) return;
        gastosPorFecha[key] = (gastosPorFecha[key] || 0) + Number(g.cantidad || 0);
    });

    const numDiasConGastoOperativo = Object.keys(gastosPorFecha).length;
    const gastoPromDiaOperativo = numDiasConGastoOperativo > 0 
                                  ? Object.values(gastosPorFecha).reduce((s,v)=>s+v,0) / numDiasConGastoOperativo 
                                  : 0;

    // 2. CÁLCULO DE LA NETA PROMEDIO
    // Neta Promedio = Ganancia Bruta Promedio - Gasto Fijo Calculado - Gasto Operativo (Otros gastos)
    const netaPromDia = ganPromDia - gastoFijo - gastoPromDiaOperativo;

    let diasParaLiquidar = Infinity;
    if (netaPromDia > 0 && deudaTotal > 0) {
        diasParaLiquidar = deudaTotal / netaPromDia;
    }

    // 3. Renderizar resultados
    if ($("proyDeuda")) $("proyDeuda").textContent = "$" + fmtMoney(deudaTotal);
    if ($("proyHoras")) $("proyHoras").textContent = horasPromDia.toFixed(2) + " h";
    
    if ($("proyNeta"))  $("proyNeta").textContent  = "$" + fmtMoney(netaPromDia);

    if ($("proyDias")) {
        if (deudaTotal <= 0) {
            $("proyDias").textContent = "Deuda Saldada";
        } else if (netaPromDia <= 0) {
            $("proyDias").textContent = "N/A (Ganancia Neta 0 o negativa)";
        } else {
            $("proyDias").textContent = Math.ceil(diasParaLiquidar) + " días";
        }
    }
}
// ... (Otras funciones de renderizado, por ejemplo, renderKmMensual, renderGraficas, se omiten si no se modificaron) ...

// ======================\
// app.js — PARTE 5/5: INICIALIZACIÓN, I/O Y TUTORIAL
// ======================\

// Función para Exportar / Importar (se mantiene igual, omitida aquí por longitud)
function setupIoListeners() {
    // ... (Lógica de exportar JSON, exportar Excel, importar JSON) ...
}


// TUTORIAL (Sección de bienvenida)
function mostrarTutorial() {
    // Solo si estamos en la página de resultados (index.html) y no hay turnos registrados
    if (!document.title.includes("Resultados") || panelData.turnos.length > 0) {
        return;
    }
    
    const main = document.querySelector('main.container');
    if (!main) return;

    // Utilizamos una tarjeta fija en la parte superior para el tutorial
    const tutorialHTML = `
        <section class="card" id="tutorialCard" style="border: 3px solid #0066ff; background: #f0f8ff;">
            <h2>Primeros Pasos (Tutorial Rápido) 🚀</h2>
            <ol>
                <li>⚙ **Ve al Administrador:** Haz clic en el botón **"⚙ Ir al Administrador"** en la esquina superior.</li>
                <li>📝 **Registra Parámetros Fijos:** En el Administrador, ve a la sección **"Ajustes de Gastos Fijos"** para:
                    <ul>
                        <li>**Deudas:** Registra cualquier deuda pendiente con su periodicidad.</li>
                        <li>**Ajustes Manuales:** Define el **"Costo por KM"** y el **"Costo asumido de Comida"** (base inicial).</li>
                    </ul>
                </li>
                <li>▶️ **¡Empieza a Trabajar!** En el Administrador, haz clic en **"Iniciar Turno"** y al terminar, en **"Finalizar Turno"** para registrar tus ganancias y horas.</li>
            </ol>
            <p style="font-style: italic;">A medida que registres KM y gastos de Comida, las proyecciones se harán más precisas automáticamente, reemplazando los valores manuales.</p>
            <button class="btn-primary" onclick="document.getElementById('tutorialCard').remove()">Entendido, ¡Empezar!</button>
        </section>
    `;
    
    // Insertar antes del primer elemento del main (Resumen del Día)
    main.insertAdjacentHTML('afterbegin', tutorialHTML);
}


// ======================\
// INICIALIZACIÓN (DOMContentLoaded)
// ======================\
document.addEventListener("DOMContentLoaded", () => {
    // 1. Setup Listeners
    setupIngresoListeners();
    setupGastoListeners();
    setupDeudaListeners();
    setupKmAndGasListeners();
    setupIoListeners();
    setupParametrosListeners(); // NUEVO: Listeners para ajustes manuales
    
    // 2. Turnos Listeners
    $("btnIniciarTurno")?.addEventListener("click", iniciarTurno);
    $("btnFinalizarTurno")?.addEventListener("click", finalizarTurno);

    // 3. Inicializar UI del Admin
    actualizarUIturno();
    renderDeudas();
    
    // Asignar el último KM final guardado como KM Inicial si existe
    if ($("kmInicial") && panelData.parametros.ultimoKMfinal !== null) {
        $("kmInicial").value = panelData.parametros.ultimoKMfinal;
    }

    // 4. Calcular y Pintar Parámetros Automáticos
    calcularDeudaTotalAuto();
    calcularGastoFijoAuto();

    // 5. Bloquear y pintar inputs automáticos
    const inpDeuda = document.getElementById("proyDeudaTotal");
    const inpGasto = document.getElementById("proyGastoFijo");

    if (inpDeuda) {
        inpDeuda.readOnly = true;
        inpDeuda.style.background = "#eee";
    }

    if (inpGasto) {
        inpGasto.readOnly = true;
        inpGasto.style.background = "#eee";
    }

    // 6. Renderizar Resultados (solo si estamos en index.html)
    if (document.title.includes("Resultados")) {
        renderResumenIndex(); 
    }
    
    // 7. Mostrar Tutorial si es la primera vez (solo en index.html)
    mostrarTutorial();
    
});
