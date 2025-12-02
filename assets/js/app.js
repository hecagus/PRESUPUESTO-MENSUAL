// ======================
// app.js — PARTE 1/5: SETUP, UTILIDADES Y GET GASTOS DÍA
// ======================

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
        comidaDiaria: 200, // Valor por defecto
        costoPorKm: 0.6     // Valor por defecto
    }
};

// ======================
// Cargar / Guardar
// ======================
function cargarPanelData() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);

        // Asegurar que las propiedades existan y cargar valores por defecto si faltan
        panelData = Object.assign({}, panelData, parsed);
        panelData.parametros = Object.assign({
            deudaTotal: 0,
            gastoFijo: 0,
            ultimoKMfinal: null,
            comidaDiaria: 200,
            costoPorKm: 0.6
        }, panelData.parametros, (parsed.parametros || {}));
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

// Cargar al inicio
cargarPanelData();

// ======================
// Utilidades
// ======================
const fmtMoney = n => Number(n || 0).toLocaleString("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
});

const nowISO = () => new Date().toISOString();
const nowLocal = () => new Date().toLocaleString("es-MX");


// ======================
// UTILIDAD: Obtener Gastos de un Día Específico (NUEVA FUNCIÓN)
// Se usa para calcular la ganancia neta en renderTablaTurnos
// ======================
function getGastosDelDia(dateStringISO) {
    // Extrae la parte de la fecha (YYYY-MM-DD)
    const dia = dateStringISO.slice(0, 10);
    
    // Suma todos los gastos que coincidan con esa fecha
    return (panelData.gastos || [])
        .filter(g => (g.fechaISO || "").slice(0, 10) === dia)
        .reduce((s, g) => s + (Number(g.cantidad) || 0), 0);
}
// ======================
// app.js — PARTE 2/5: LÓGICA AUTOMÁTICA Y MANEJO DE INGRESOS/GASTOS
// ======================

// A) calcularDeudaTotalAuto: suma de (monto - abonado)
function calcularDeudaTotalAuto() {
    const deudas = panelData.deudas || [];

    const total = deudas.reduce((s, d) => {
        return s + ((Number(d.monto) || 0) - (Number(d.abonado) || 0));
    }, 0);

    panelData.parametros = panelData.parametros || {};
    panelData.parametros.deudaTotal = total;
    guardarPanelData();

    const inp = $("proyDeudaTotal");
    if (inp) {
        inp.value = total.toFixed(2);
    }
}

// B) calcularGastoFijoAuto (LÓGICA CORREGIDA)
function calcularGastoFijoAuto() {
    panelData.parametros = panelData.parametros || {};
    
    const comidaDiaria = Number(panelData.parametros.comidaDiaria) || 200; 

    // 1. Calcular promedio de KM
    const kmArr = panelData.kmDiarios || [];
    const kmProm = kmArr.length
        ? kmArr.reduce((s, k) => s + (Number(k.recorrido) || 0), 0) / kmArr.length
        : 0;

    // 2. Calcular el Abono Diario Promedio de Deudas (CORREGIDO)
    let abonoDiarioPromedio = 0;

    (panelData.deudas || []).forEach(d => {
        const pendiente = (Number(d.monto) || 0) - (Number(d.abonado) || 0);
        const abonoProgramado = Number(d.abonoProgramado || 0);
        const periodicidad = d.periodicidad || "";
        
        // Solo si hay saldo pendiente y un abono programado
        if (pendiente > 0 && abonoProgramado > 0) {
            let dias = 30; // Base: Mensual
            if (periodicidad === "Semanal") dias = 7;
            if (periodicidad === "Quincenal") dias = 15;
            
            abonoDiarioPromedio += (abonoProgramado / dias);
        }
    });

    // 3. Fórmula de Gasto Fijo DIARIO: 
    // (Abono Programado Diario) + Gasto de comida asumido + (KM promedio * costo por KM asumido)
    const costoPorKm = Number(panelData.parametros.costoPorKm) || 0.6; 
    const gastoFijo = abonoDiarioPromedio + comidaDiaria + (kmProm * costoPorKm);

    panelData.parametros.gastoFijo = gastoFijo;
    guardarPanelData();

    const inp = $("proyGastoFijo");
    if (inp) {
        inp.value = gastoFijo.toFixed(2);
    }
}

// ======================
// Movimientos (Historial)
// ======================
function pushMovimiento(tipo, descripcion, monto) {
    panelData.movimientos.unshift({
        tipo,
        descripcion,
        monto: Number(monto),
        fechaISO: nowISO(),
        fechaLocal: nowLocal()
    });

    if (panelData.movimientos.length > 300) {
        panelData.movimientos.length = 300;
    }

    guardarPanelData();
}
// ... (omito renderMovimientos por simplicidad, usa la del código original si la necesitas)

// ======================
// Registrar ingreso (Listeners)
// ======================
function setupIngresoListeners() {
    const btn = $("btnGuardarIngreso");
    if (!btn) return;

    btn.addEventListener("click", () => {
        const desc = ($("ingresoDescripcion")?.value || "").trim();
        const qty = Number($("ingresoCantidad")?.value || 0);

        if (!desc || !qty || qty <= 0)
            return alert("Completa correctamente los datos del ingreso.");

        panelData.ingresos.push({
            descripcion: desc,
            cantidad: qty,
            fechaISO: nowISO(),
            fechaLocal: nowLocal()
        });

        pushMovimiento("Ingreso", desc, qty);
        guardarPanelData();

        $("ingresoDescripcion").value = "";
        $("ingresoCantidad").value = "";

        alert("Ingreso registrado.");
        renderResumenIndex();
    });
}

// ======================
// Registrar gasto (Listeners)
// ======================
function setupGastoListeners() {
    const btn = $("btnGuardarGasto");
    if (!btn) return;

    btn.addEventListener("click", () => {
        const desc = ($("gastoDescripcion")?.value || "").trim();
        const qty = Number($("gastoCantidad")?.value || 0);
        const cat = $("gastoCategoria")?.value || "Otros";

        if (!desc || !qty || qty <= 0) return alert("Datos de gasto inválidos.");

        panelData.gastos.push({
            descripcion: desc,
            cantidad: qty,
            categoria: cat,
            fechaISO: nowISO(),
            fechaLocal: nowLocal()
        });

        // Recalcular gasto fijo ya que puede afectar la media de gastos
        calcularGastoFijoAuto(); 

        pushMovimiento("Gasto", `${desc} (${cat})`, qty);
        guardarPanelData();

        $("gastoDescripcion").value = "";
        $("gastoCantidad").value = "";

        alert("Gasto registrado.");
        renderResumenIndex();
    });
}
// ======================
// app.js — PARTE 3/5: LÓGICA DEUDAS, KM, GASOLINA Y TURNOS
// ======================

// ======================
// Deudas (Listeners y Render)
// ======================
function renderDeudas() {
    const list = $("listaDeudas");
    const select = $("abonoSeleccionar");

    if (!list || !select) return;

    list.innerHTML = "";
    select.innerHTML = "";

    panelData.deudas.forEach((d, idx) => {
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

        // Solo agregar deudas con saldo pendiente al selector de abonos
        if (pendiente > 0) {
            const opt = document.createElement("option");
            opt.value = idx;
            opt.textContent = `${d.nombre} — $${fmtMoney(pendiente)} pendiente`;
            select.appendChild(opt);
        }
    });

    if (panelData.deudas.length === 0) {
        list.innerHTML = "<li>No hay deudas registradas.</li>";
    }
    
    if (select.children.length === 0) {
        select.innerHTML = `<option value="">-- No hay deudas pendientes --</option>`;
    }
}

// Event Listeners para Deudas (Implementa el flujo de 4 pasos)
function setupDeudaListeners() {
    function resetDeudaForm() {
        $("deudaNombre").value = "";
        $("deudaMonto").value = "";
        $("deudaAbonoProgramado").value = ""; 
        $("deudaPeriodicidad").value = "Semanal"; 
        $("deudaPaso1").style.display = "block";
        $("deudaPaso2").style.display = "none";
        $("deudaPaso3").style.display = "none";
        $("deudaPaso4").style.display = "none";
    }

    $("btnPaso1")?.addEventListener("click", () => {
        const nombre = ($("deudaNombre")?.value || "").trim();
        if (!nombre) return alert("Ingresa el nombre de la deuda.");
        $("deudaPaso1").style.display = "none";
        $("deudaPaso2").style.display = "block";
    });

    $("btnPaso2")?.addEventListener("click", () => {
        const monto = Number($("deudaMonto")?.value || 0);
        if (!monto || monto <= 0) return alert("Ingresa un monto válido.");
        $("deudaPaso2").style.display = "none";
        $("deudaPaso3").style.display = "block";
    });

    $("btnPaso3")?.addEventListener("click", () => {
        const abono = Number($("deudaAbonoProgramado")?.value || 0);
        if (isNaN(abono) || abono < 0) return alert("Ingresa un abono válido (0 si no está definido).");
        $("deudaPaso3").style.display = "none";
        $("deudaPaso4").style.display = "block";
    });

    $("btnRegistrarDeuda")?.addEventListener("click", () => {
      const nombre = ($("deudaNombre")?.value || "").trim();
      const monto = Number($("deudaMonto")?.value || 0);
      const abonoProgramado = Number($("deudaAbonoProgramado")?.value || 0);
      const periodicidad = $("deudaPeriodicidad")?.value || "Semanal";

      if (!nombre || !monto || monto <= 0) return alert("Error: faltan datos de Nombre o Monto.");

      panelData.deudas.push({ nombre, monto, abonado: 0, abonoProgramado, periodicidad });

      guardarPanelData();
      renderDeudas(); 
      
      calcularDeudaTotalAuto();
      calcularGastoFijoAuto(); // Recalcular con nueva deuda programada

      resetDeudaForm();
      alert("Deuda registrada.");
    });

    $("btnRegistrarAbono")?.addEventListener("click", () => {
      const idx = $("abonoSeleccionar")?.value;
      const monto = Number($("abonoMonto")?.value || 0);

      if (idx === "" || !idx || monto <= 0) return alert("Datos inválidos.");

      const deuda = panelData.deudas[idx];
      const pendiente = (Number(deuda.monto) || 0) - (Number(deuda.abonado) || 0);

      if(monto > pendiente) return alert(`El abono excede el saldo pendiente de $${fmtMoney(pendiente)}.`);
      
      deuda.abonado = (Number(deuda.abonado) || 0) + monto;

      panelData.gastos.push({
        descripcion: `Abono a ${deuda.nombre}`,
        cantidad: monto,
        categoria: "Abono a Deuda",
        fechaISO: nowISO(),
        fechaLocal: nowLocal()
      });

      pushMovimiento("Gasto", `Abono a ${deuda.nombre}`, monto);

      guardarPanelData();
      renderDeudas();

      calcularDeudaTotalAuto();
      calcularGastoFijoAuto();

      $("abonoMonto").value = "";
      alert("Abono guardado.");

      renderResumenIndex();
    });
}

// ======================
// KM y Gasolina (Listeners)
// ======================
function setupKmAndGasListeners() {
    $("kmFinal")?.addEventListener("input", () => {
        const ini = Number($("kmInicial")?.value || 0);
        const fin = Number($("kmFinal")?.value || 0);
        const rec = fin > ini ? fin - ini : 0;
        if ($("kmRecorridos")) $("kmRecorridos").textContent = rec;
    });

    $("btnGuardarKm")?.addEventListener("click", () => {
        const ini = Number($("kmInicial")?.value || 0);
        const fin = Number($("kmFinal")?.value || 0);
        if (isNaN(ini) || isNaN(fin) || fin <= ini) return alert("KM inicial/final inválidos o Final es menor/igual a Inicial.");

        panelData.kmDiarios.push({
            fechaISO: nowISO(), fechaLocal: nowLocal(), kmInicial: ini, kmFinal: fin, recorrido: fin - ini
        });

        panelData.parametros = panelData.parametros || {};
        panelData.parametros.ultimoKMfinal = fin;
        guardarPanelData();

        calcularGastoFijoAuto(); 

        $("kmInicial").value = ""; $("kmFinal").value = ""; $("kmRecorridos").textContent = "0";

        alert("Kilometraje guardado.");
        renderResumenIndex();
        
        if ($("kmInicial")) $("kmInicial").value = fin;
    });

    $("btnGuardarGas")?.addEventListener("click", () => {
        const litros = Number($("litrosGas")?.value || 0);
        const costo = Number($("costoGas")?.value || 0);

        if (!litros || !costo) return alert("Datos inválidos.");

        panelData.gasolina.push({ fechaISO: nowISO(), fechaLocal: nowLocal(), litros, costo });

        panelData.gastos.push({
            descripcion: `Gasolina ${litros}L`, cantidad: costo, categoria: "Transporte", fechaISO: nowISO(), fechaLocal: nowLocal()
        });

        pushMovimiento("Gasto", `Gasolina ${litros}L`, costo);
        guardarPanelData();
        
        calcularGastoFijoAuto(); // Recalcular con el nuevo gasto de Transporte

        $("litrosGas").value = ""; $("costoGas").value = "";
        alert("Repostaje guardado.");
        renderResumenIndex();
    });
}

// ======================
// Turnos (Lógica y Listeners)
// ======================
let turnoActivo = JSON.parse(localStorage.getItem("turnoActivo")) || false;
let turnoInicio = localStorage.getItem("turnoInicio") || null;

function actualizarUIturno() {
    const ini = $("btnIniciarTurno");
    const fin = $("btnFinalizarTurno");
    const txt = $("turnoTexto");

    if (!ini || !fin || !txt) return;

    if (turnoActivo) {
        ini.style.display = "none";
        fin.style.display = "inline-block";
        txt.textContent = `Turno en curso iniciado el ${new Date(turnoInicio).toLocaleString("es-MX")}`;
    } else {
        ini.style.display = "inline-block";
        fin.style.display = "none";
        txt.textContent = "Sin turno activo";
    }
}

function iniciarTurno() {
    if (turnoActivo) return alert("Ya tienes un turno activo.");

    turnoActivo = true;
    turnoInicio = nowISO();

    localStorage.setItem("turnoActivo", true);
    localStorage.setItem("turnoInicio", turnoInicio);

    actualizarUIturno();
    alert("Turno iniciado.");
}

function finalizarTurno() {
    if (!turnoActivo) return alert("No hay turno activo.");

    const inicio = new Date(turnoInicio);
    const fin = new Date();
    const horas = Number(((fin - inicio) / 3600000).toFixed(2));

    const ganStr = prompt(`Terminó el turno.\nHoras: ${horas}\nGanancia (MXN):`);
    const gan = Number(ganStr);

    if (!gan) return alert("Monto inválido. El turno no fue registrado.");

    panelData.turnos.push({ inicio: inicio.toISOString(), fin: fin.toISOString(), horas, ganancia: gan });

    // El ingreso de la ganancia se registra aquí
    panelData.ingresos.push({ descripcion: `Ganancia turno (${horas}h)`, cantidad: gan, fechaISO: nowISO(), fechaLocal: nowLocal() });

    pushMovimiento("Ingreso", `Ganancia turno (${horas}h)`, gan);

    turnoActivo = false;
    turnoInicio = null;

    localStorage.setItem("turnoActivo", false);
    localStorage.removeItem("turnoInicio");

    guardarPanelData();
    actualizarUIturno();

    alert("Turno finalizado.");
    renderResumenIndex();
}
// ======================
// app.js — PARTE 4/5: RENDERIZADO, TABLAS Y PROYECCIÓN (RESULTADOS)
// ======================

// ======================
// Resumen del día
// ======================
function calcularResumenDatos() {
    const hoy = new Date().toISOString().slice(0, 10);

    // Obtener turnos y gastos DE HOY
    const turnosHoy = (panelData.turnos || []).filter(t => (t.inicio || "").slice(0, 10) === hoy);
    const gastosHoy = (panelData.gastos || []).filter(g => (g.fechaISO || "").slice(0, 10) === hoy);

    const horasHoy = turnosHoy.reduce((s, t) => s + (Number(t.horas) || 0), 0);
    const ganHoy    = turnosHoy.reduce((s, t) => s + (Number(t.ganancia) || 0), 0);
    const gastHoy   = gastosHoy.reduce((s, g) => s + (Number(g.cantidad) || 0), 0);

    return { horasHoy, ganHoy, gastHoy };
}

// ======================
// Render resumen index
// ======================
function renderResumenIndex() {
    const r = calcularResumenDatos();

    if ($("resHoras")) $("resHoras").textContent = r.horasHoy.toFixed(2);
    if ($("resGananciaBruta")) $("resGananciaBruta").textContent = "$" + fmtMoney(r.ganHoy);
    if ($("resGastos")) $("resGastos").textContent = "$" + fmtMoney(r.gastHoy);
    if ($("resNeta")) $("resNeta").textContent = "$" + fmtMoney(r.ganHoy - r.gastHoy);

    renderTablaTurnos();
    renderTablaKmMensual();
    renderCharts();
    calcularProyeccionReal();
}


// ======================
// Tabla Turnos (CORREGIDA)
// ======================
function renderTablaTurnos() {
    const tbody = $("tablaTurnos");
    if (!tbody) return;

    tbody.innerHTML = "";

    // Muestra los turnos del más reciente al más antiguo
    const arr = [...(panelData.turnos || [])].reverse();

    if (arr.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center">No hay turnos</td></tr>`;
        return;
    }

    arr.forEach(t => {
        const fechaTurno = (t.inicio || "").slice(0, 10);
        
        // 🚨 CORRECCIÓN: Obtener los gastos registrados para ese día específico
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

// ======================
// Proyección Real
// ======================
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

    const gastos = panelData.gastos || [];
    const gastosPorFecha = {};

    gastos.forEach(g=>{
        const key = (g.fechaISO || "").slice(0,10);
        if (!key) return;
        gastosPorFecha[key] = (gastosPorFecha[key] || 0) + Number(g.cantidad || 0);
    });

    const gastoPromDia = Object.values(gastosPorFecha).reduce((s,v)=>s+v,0) /
                         (Object.keys(gastosPorFecha).length || 1);

    const netaPromDia = ganPromDia - gastoPromDia - gastoFijo;

    let diasParaLiquidar = Infinity;
    if (netaPromDia > 0 && deudaTotal > 0) {
        diasParaLiquidar = deudaTotal / netaPromDia;
    }

    if ($("proyDeuda")) $("proyDeuda").textContent = "$" + fmtMoney(deudaTotal);
    if ($("proyHoras")) $("proyHoras").textContent = horasPromDia.toFixed(2) + " h";
    if ($("proyNeta"))  $("proyNeta").textContent  = "$" + fmtMoney(netaPromDia);

    if ($("proyDias")) {
        if (diasParaLiquidar === Infinity || netaPromDia <= 0) {
            $("proyDias").textContent = (deudaTotal > 0) ? "N/A (Ganancia Neta 0 o negativa)" : "Deuda Saldada";
        } else {
            $("proyDias").textContent = Math.ceil(diasParaLiquidar) + " días";
        }
    }
}
// ======================
// app.js — PARTE 5/5: AGREGACIÓN DE DATOS, GRÁFICAS E INICIALIZACIÓN
// ======================

// ======================
// AJUSTES DE PARÁMETROS (Listeners)
// ======================
function setupParametrosListeners() {
    // Esta función solo debe ejecutarse en index.html
    $("btnGuardarParametros")?.addEventListener("click", () => {
        const comida = Number($("paramComidaDiaria")?.value || 0);
        const costoKm = Number($("paramCostoPorKm")?.value || 0);

        if (isNaN(comida) || isNaN(costoKm) || comida < 0 || costoKm < 0) {
            return alert("Ingresa valores válidos para los parámetros (Comida/Costo por KM).");
        }

        panelData.parametros.comidaDiaria = comida;
        panelData.parametros.costoPorKm = costoKm;
        
        guardarPanelData();
        calcularGastoFijoAuto(); // Recalcular gasto fijo con los nuevos parámetros

        alert("Parámetros actualizados.");
    });
}

// ======================
// AGREGACIÓN DE DATOS DIARIOS PARA GRÁFICAS
// ======================
function aggregateDailyData() {
    const data = {};

    const processEntry = (entry, type, amountKey) => {
        
        // Usar la fecha ISO para la clave principal, y la fecha Local como fallback
        const date = (entry.fechaISO || entry.inicio || "").slice(0, 10);
        if (!date) {
            // Fallback: intentar convertir fechaLocal a YYYY-MM-DD
            const rawDate = entry.fechaLocal || ""; 
            if (!rawDate) return;
            const localDate = rawDate.split(',')[0].trim();
            const parts = localDate.split('/');
            if (parts.length !== 3) return;
            const dateKey = `${parts[2]}-${parts[1]}-${parts[0]}`;  
            
            data[dateKey] = data[dateKey] || { date: dateKey, ingresos: 0, gastos: 0, kmRecorridos: 0 };
            data[dateKey][type] += (Number(entry[amountKey]) || 0);
            return;
        }

        data[date] = data[date] || { date, ingresos: 0, gastos: 0, kmRecorridos: 0 };
        data[date][type] += (Number(entry[amountKey]) || 0);
    };
    
    (panelData.ingresos || []).forEach(t => processEntry(t, 'ingresos', 'cantidad'));
    (panelData.gastos || []).forEach(g => processEntry(g, 'gastos', 'cantidad'));
    (panelData.kmDiarios || []).forEach(k => processEntry(k, 'kmRecorridos', 'recorrido'));
    (panelData.turnos || []).forEach(t => processEntry(t, 'ingresos', 'ganancia'));

    return Object.values(data).sort((a, b) => new Date(a.date) - new Date(b.date));
}

// ======================
// CÁLCULO DE MÉTRICAS MENSUALES DE KM
// ======================
function aggregateKmMensual() {
    const dataMensual = {};

    // 1. Agrupar KM por mes
    (panelData.kmDiarios || []).forEach(k => {
        const date = new Date(k.fechaISO);
        const mesKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        dataMensual[mesKey] = dataMensual[mesKey] || { kmRecorridos: 0, costoGasolina: 0 };
        dataMensual[mesKey].kmRecorridos += (Number(k.recorrido) || 0);
    });

    // 2. Sumar el costo de la gasolina por mes
    (panelData.gastos || []).forEach(g => {
        if (g.categoria === "Transporte" && g.descripcion.includes("Gasolina")) { 
            const date = new Date(g.fechaISO);
            const mesKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            
            dataMensual[mesKey] = dataMensual[mesKey] || { kmRecorridos: 0, costoGasolina: 0 };
            dataMensual[mesKey].costoGasolina += (Number(g.cantidad) || 0);
        }
    });

    // 3. Calcular métricas finales y formatear
    const resultado = Object.entries(dataMensual).map(([mesKey, data]) => {
        const [year, month] = mesKey.split('-');
        const dateString = new Date(year, month - 1, 1).toLocaleString('es-MX', { year: 'numeric', month: 'long' });
        
        const costoPorKm = data.kmRecorridos > 0 ? data.costoGasolina / data.kmRecorridos : 0;

        return {
            mes: dateString.charAt(0).toUpperCase() + dateString.slice(1),
            kmRecorridos: data.kmRecorridos,
            costoGasolina: data.costoGasolina,
            costoPorKm: costoPorKm
        };
    }).sort((a, b) => {
        // Ordenar por año y mes (del más nuevo al más viejo)
        return b.mes.localeCompare(a.mes);
    });

    return resultado;
}

// ======================
// RENDERIZADO DE TABLA DE KM MENSUAL
// ======================
function renderTablaKmMensual() {
    const tablaContainer = $("tablaKmMensual"); 
    if (!tablaContainer) return;

    const datosMensuales = aggregateKmMensual();
    
    let html = `
        <table class="tabla">
            <thead>
                <tr>
                    <th>Mes</th>
                    <th>KM Recorridos</th>
                    <th>Costo Gasolina</th>
                    <th>Costo por KM</th>
                </tr>
            </thead>
            <tbody>`;

    if (datosMensuales.length === 0) {
        html += `<tr><td colspan="4" style="text-align:center">No hay datos de KM/Gasolina.</td></tr>`;
    } else {
        datosMensuales.forEach(d => {
            html += `
                <tr>
                    <td>${d.mes}</td>
                    <td>${d.kmRecorridos.toFixed(0)} KM</td>
                    <td>$${fmtMoney(d.costoGasolina)}</td>
                    <td>$${d.costoPorKm.toFixed(2)}</td>
                </tr>
            `;
        });
    }

    html += `</tbody></table>`;
    tablaContainer.innerHTML = html;
}

// ======================
// Importar / Exportar JSON (Listeners)
// ======================
function setupIoListeners() {
    $("btnExportar")?.addEventListener("click", () => {
        const json = JSON.stringify(panelData, null, 2);

        navigator.clipboard.writeText(json)
            .then(() => alert("Datos copiados al portapapeles."))
            .catch(() => {
                // Fallback si no funciona el portapapeles
                const blob = new Blob([json], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `backup_ubereats_tracker_${Date.now()}.json`;
                a.click();
                URL.revokeObjectURL(url);
                alert("Backup descargado.");
            });
    });

    $("btnExportarExcel")?.addEventListener("click", exportToExcel); 

    $("btnImportar")?.addEventListener("click", () => {
        const raw = ($("importJson")?.value || "").trim();
        if (!raw) return alert("Pega tu JSON primero.");

        try {
            const parsed = JSON.parse(raw);
            panelData = Object.assign({}, panelData, parsed);
            panelData.parametros = Object.assign({}, panelData.parametros, (parsed.parametros || {}));

            guardarPanelData();
            $("importJson").value = "";
            
            location.reload(); 

            alert("Importación correcta ✔. Recarga de página automática.");
        } catch (e) {
            console.error(e);
            alert("JSON inválido.");
        }
    });
}

// ======================
// Exportar a Excel
// ======================
function exportToExcel() {
    const data = panelData;
    if (!data) return alert("No hay datos para exportar.");
    
    if (typeof XLSX === 'undefined') return alert("Error: La librería XLSX no está cargada. Asegúrate de estar en la página de Resultados (index.html).");

    const wb = XLSX.utils.book_new();

    const addSheet = (name, arr) => {
        if (!arr || arr.length === 0) return;
        const ws = XLSX.utils.json_to_sheet(arr);
        XLSX.utils.book_append_sheet(wb, ws, name);
    };

    addSheet("Ingresos", data.ingresos);
    addSheet("Gastos", data.gastos);
    addSheet("Turnos", data.turnos);
    addSheet("KM Diarios", data.kmDiarios);
    addSheet("Gasolina", data.gasolina);
    addSheet("Deudas", data.deudas);
    addSheet("Movimientos", data.movimientos);

    XLSX.writeFile(wb, `datos_ubereats_tracker_${Date.now()}.xlsx`);
    alert("Exportación a Excel completada.");
}

// ======================
// GRÁFICAS (CHART.JS)
// ======================
let gananciasChart = null;
let kmChart = null;

function renderCharts() {
    const dailyData = aggregateDailyData();

    // Tomar solo los últimos 14 días
    const last14Days = dailyData.slice(-14);
    const labels = last14Days.map(d => d.date.slice(5)); 

    // 1. Gráfica de Ganancias vs Gastos
    const ctxGanancias = $("graficaGanancias");
    if (ctxGanancias) {
        if (gananciasChart) gananciasChart.destroy(); 

        gananciasChart = new Chart(ctxGanancias, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Ingresos',
                    data: last14Days.map(d => d.ingresos),
                    backgroundColor: '#00a000', 
                }, {
                    label: 'Gastos',
                    data: last14Days.map(d => d.gastos),
                    backgroundColor: '#d40000', 
                }]
            },
            options: {
                responsive: true,
                scales: {
                    x: { stacked: false },
                    y: { beginAtZero: true }
                },
                plugins: { legend: { position: 'top' }, title: { display: false } }
            }
        });
    }

    // 2. Gráfica de Kilometraje
    const ctxKm = $("graficaKm");
    if (ctxKm) {
        if (kmChart) kmChart.destroy(); 

        kmChart = new Chart(ctxKm, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'KM Recorridos',
                    data: last14Days.map(d => d.kmRecorridos),
                    borderColor: '#0066ff', 
                    backgroundColor: '#0066ff40',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                scales: { y: { beginAtZero: true } },
                plugins: { legend: { position: 'top' }, title: { display: false } }
            }
        });
    }
}


// ======================
// INICIALIZACIÓN (DOMContentLoaded)
// ======================
document.addEventListener("DOMContentLoaded", () => {
    // 1. Setup Listeners
    setupIngresoListeners();
    setupGastoListeners();
    setupDeudaListeners();
    setupKmAndGasListeners();
    setupIoListeners();
    setupParametrosListeners(); 
    
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
    
    // 5. Cargar parámetros manuales en Index.html (si aplica)
    if (document.title.includes("Resultados")) { 
        if ($("paramComidaDiaria")) $("paramComidaDiaria").value = panelData.parametros.comidaDiaria.toFixed(2);
        if ($("paramCostoPorKm")) $("paramCostoPorKm").value = panelData.parametros.costoPorKm.toFixed(2);
    }

    // 6. Bloquear y pintar inputs automáticos
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

    // 7. Renderizar Resultados (solo si estamos en index.html)
    if (document.title.includes("Resultados")) {
        renderResumenIndex(); 
    }
    
});
