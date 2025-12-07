// app.js (Parte 1/5: Estructura y Utils)
const STORAGE_KEY = "panelData";
const $ = id => document.getElementById(id);
let gananciasChart = null; let kmChart = null;

const DEFAULT_PANEL_DATA = {
  ingresos: [], gastos: [], turnos: [], movimientos: [],
  cargasCombustible: [], 
  parametros: {
    deudaTotal: 0, gastoFijo: 0, 
    ultimoKMfinal: 0, // DATO CRÍTICO: Se actualiza con Cargas y Fin de Turno
    costoPorKm: 0,
    mantenimientoBase: { 'Aceite': 3000, 'Bujía': 8000, 'Llantas': 15000 }
  }
};

let panelData = JSON.parse(JSON.stringify(DEFAULT_PANEL_DATA));
let turnoActivo = JSON.parse(localStorage.getItem("turnoActivo")) || false;

function safeNumber(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }
function fmtMoney(n) { return safeNumber(n).toFixed(2); }
function formatearFecha(d) { return new Date(d).toLocaleDateString(); }

// app.js (Parte 2/5: Datos)

function validarYArreglarDatos() {
  ['ingresos', 'gastos', 'turnos', 'cargasCombustible'].forEach(k => {
    if (!Array.isArray(panelData[k])) panelData[k] = [];
  });
  if (!panelData.parametros) panelData.parametros = DEFAULT_PANEL_DATA.parametros;
  
  // Asegurar numéricos
  panelData.parametros.ultimoKMfinal = safeNumber(panelData.parametros.ultimoKMfinal);
  
  // Recalcular costo real al cargar
  calcularMetricasCombustible(false);
  saveData();
}

function cargarPanelData() {
  const data = localStorage.getItem(STORAGE_KEY);
  if (data) {
    try { panelData = { ...panelData, ...JSON.parse(data) }; } 
    catch (e) { console.error(e); }
  }
  validarYArreglarDatos();
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(panelData));
}

function exportarJson() {
    navigator.clipboard.writeText(JSON.stringify(panelData)).then(() => alert("Copiado."));
}

function importarJson() {
    try {
        const json = $("importJson").value;
        if (!json) return;
        panelData = { ...DEFAULT_PANEL_DATA, ...JSON.parse(json) };
        validarYArreglarDatos();
        alert("Datos restaurados.");
        window.location.reload();
    } catch (e) { alert("Error en JSON"); }
}

// app.js (Parte 3/5: Cálculos de Combustible y Métricas)

function calcularMetricasCombustible(updateUI = true) {
    // Ordenar cargas por KM
    const cargas = panelData.cargasCombustible.sort((a, b) => a.kmActual - b.kmActual);
    
    // Necesitamos al menos 2 cargas para calcular rendimiento real
    if (cargas.length >= 2) {
        // Tomamos las últimas 3 para promedio reciente
        const recientes = cargas.slice(-3);
        let litrosTotales = 0;
        let kmRecorridos = 0;
        let costoTotal = 0;

        for (let i = 1; i < recientes.length; i++) {
            const actual = recientes[i];
            const prev = recientes[i-1];
            const dist = actual.kmActual - prev.kmActual;
            
            if (dist > 0) {
                kmRecorridos += dist;
                // El costo y litros son lo que consumiste para llegar aquí (la carga actual repone eso)
                litrosTotales += actual.litros;
                costoTotal += actual.costo;
            }
        }

        if (kmRecorridos > 0) {
            panelData.parametros.costoPorKm = costoTotal / kmRecorridos;
        }
    }

    // Proyección
    const ultimoKM = safeNumber(panelData.parametros.ultimoKMfinal);
    // Si no hay cargas, asumimos 0 para proyección
    const ultimaCargaKM = cargas.length > 0 ? cargas[cargas.length - 1].kmActual : ultimoKM;
    const recorridoDesdeCarga = ultimoKM - ultimaCargaKM;
    
    const tanquePromedioKM = 350; // Ajustable
    const restante = tanquePromedioKM - recorridoDesdeCarga;
    
    if (updateUI) {
        const lblCosto = $("costoPorKmDisplay");
        const lblProy = $("proyeccionRepostaje");
        if(lblCosto) lblCosto.innerText = `$${fmtMoney(panelData.parametros.costoPorKm)}`;
        if(lblProy) lblProy.innerText = restante < 50 ? "¡URGENTE CARGAR!" : `${restante.toFixed(0)} km rest.`;
    }
    saveData();
}

function calcularMetricasGenerales() {
    const turnos = panelData.turnos;
    const dias = new Set(turnos.map(t => t.fechaInicio.split('T')[0])).size || 1;
    
    // Ingresos totales
    const ingresosExt = panelData.ingresos.reduce((s,i) => s + safeNumber(i.monto), 0);
    const gananciaTurnos = turnos.reduce((s,t) => s + safeNumber(t.gananciaBruta), 0);
    const totalIngresos = ingresosExt + gananciaTurnos;

    // Gastos Operativos (Combustible + Mantenimiento + Otros Trabajo)
    const gastosOp = panelData.gastos.filter(g => g.esTrabajo).reduce((s,g) => s + safeNumber(g.monto), 0);
    
    const neta = totalIngresos - gastosOp;
    
    return {
        netaPromedio: neta / dias,
        kmTotal: turnos.reduce((s,t) => s + safeNumber(t.kmRecorrido), 0),
        gananciaBruta: totalIngresos,
        gastosTotales: gastosOp
    };
}
// app.js (Parte 4/5: Turno y Wizard Gasolina)

function actualizarUITurno() {
    const btnIni = $("btnIniciarTurno");
    const containerCierre = $("cierreTurnoContainer");
    
    if (turnoActivo) {
        $("turnoTexto").innerHTML = "🟢 En curso";
        btnIni.style.display = "none";
        $("btnFinalizarTurno").style.display = "block";
        containerCierre.style.display = "block"; // Mostrar inputs para cerrar
    } else {
        $("turnoTexto").innerHTML = "🔴 Sin turno";
        btnIni.style.display = "block";
        $("btnFinalizarTurno").style.display = "none";
        containerCierre.style.display = "none";
    }
    calcularMetricasCombustible(true);
}

function iniciarTurno() {
    const inicio = Date.now();
    // KM Inicial es automático del sistema. No se pide.
    const kmInicial = safeNumber(panelData.parametros.ultimoKMfinal);
    
    turnoActivo = { inicio, kmInicial };
    localStorage.setItem("turnoActivo", JSON.stringify(turnoActivo));
    actualizarUITurno();
}

function finalizarTurno() {
    const kmFinalInput = safeNumber($("kmFinalTurno").value);
    const ganancia = safeNumber($("gananciaBruta").value);
    const kmInicial = safeNumber(turnoActivo.kmInicial);

    if (kmFinalInput <= kmInicial) return alert("El KM Final debe ser mayor al inicial.");
    if (ganancia <= 0) return alert("Ingresa ganancia.");

    const recorrido = kmFinalInput - kmInicial;
    const horas = (Date.now() - turnoActivo.inicio) / 3600000;

    panelData.turnos.push({
        fechaInicio: new Date(turnoActivo.inicio).toISOString(),
        fechaFin: new Date().toISOString(),
        kmRecorrido: recorrido,
        gananciaBruta: ganancia,
        horas: horas
    });

    // ACTUALIZACIÓN DEL KILOMETRAJE GLOBAL
    panelData.parametros.ultimoKMfinal = kmFinalInput;

    turnoActivo = false;
    localStorage.removeItem("turnoActivo");
    
    $("kmFinalTurno").value = "";
    $("gananciaBruta").value = "";
    saveData();
    actualizarUITurno();
    alert("Turno finalizado y KM actualizado.");
}

// --- WIZARD GASOLINA ---

function setupGasolinaWizard() {
    const p1 = $("gasWizardPaso1"), p2 = $("gasWizardPaso2"), p3 = $("gasWizardPaso3");
    
    // Paso 1 -> 2
    $("btnGasSiguiente1").onclick = () => {
        if(safeNumber($("gasLitros").value) <= 0) return alert("Ingresa litros");
        p1.style.display = "none"; p2.style.display = "block";
    };
    
    // Paso 2 -> 3
    $("btnGasSiguiente2").onclick = () => {
        if(safeNumber($("gasCosto").value) <= 0) return alert("Ingresa costo");
        p2.style.display = "none"; p3.style.display = "block";
    };
    
    // Atrás
    $("btnGasAtras2").onclick = () => { p2.style.display = "none"; p1.style.display = "block"; };
    $("btnGasAtras3").onclick = () => { p3.style.display = "none"; p2.style.display = "block"; };

    // GUARDAR CARGA
    $("btnRegistrarCargaFinal").onclick = () => {
        const litros = safeNumber($("gasLitros").value);
        const costo = safeNumber($("gasCosto").value);
        const kmActual = safeNumber($("gasKmActual").value);
        const ultimoKM = safeNumber(panelData.parametros.ultimoKMfinal);

        if (kmActual <= ultimoKM && ultimoKM > 0) 
            return alert(`El KM (${kmActual}) debe ser mayor al anterior (${ultimoKM})`);

        // Registrar Carga
        const carga = { fecha: new Date().toISOString(), litros, costo, kmActual };
        panelData.cargasCombustible.push(carga);

        // Registrar como Gasto automáticamente
        panelData.gastos.push({
            tipo: 'Gasto', descripcion: 'Gasolina', monto: costo, 
            fecha: new Date().toISOString(), esTrabajo: true 
        });

        // ACTUALIZAR KM GLOBAL
        panelData.parametros.ultimoKMfinal = kmActual;

        // Reset UI
        $("gasLitros").value = ""; $("gasCosto").value = ""; $("gasKmActual").value = "";
        p3.style.display = "none"; p1.style.display = "block";
        
        saveData();
        calcularMetricasCombustible(true);
        alert("Carga registrada.");
    };
}
// app.js (Parte 5/5: Listeners e Init)

function setupListeners() {
    if($("btnIniciarTurno")) $("btnIniciarTurno").onclick = iniciarTurno;
    if($("btnFinalizarTurno")) $("btnFinalizarTurno").onclick = finalizarTurno;
    
    if($("btnRegistrarIngreso")) $("btnRegistrarIngreso").onclick = () => {
        const desc = $("ingresoDescripcion").value;
        const monto = safeNumber($("ingresoCantidad").value);
        if(monto > 0) {
            panelData.ingresos.push({descripcion: desc, monto, fecha: new Date().toISOString()});
            saveData(); alert("Ingreso registrado");
            $("ingresoDescripcion").value=""; $("ingresoCantidad").value="";
        }
    };

    if($("btnRegistrarGasto")) $("btnRegistrarGasto").onclick = () => {
        const desc = $("gastoDescripcion").value;
        const monto = safeNumber($("gastoCantidad").value);
        const tipo = $("gastoTipo").value;
        if(monto > 0) {
            panelData.gastos.push({
                descripcion: desc, monto, fecha: new Date().toISOString(), 
                esTrabajo: (tipo === 'trabajo')
            });
            saveData(); alert("Gasto registrado");
            $("gastoDescripcion").value=""; $("gastoCantidad").value="";
        }
    };
    
    // Deudas
    if($("btnSiguienteDeuda")) $("btnSiguienteDeuda").onclick = () => {
        const m = safeNumber($("deudaMontoTotal").value);
        const d = $("deudaDescripcion").value;
        if(m > 0) {
            panelData.deudas.push({id: Date.now(), desc: d, total: m, saldo: m});
            saveData(); renderDeudas();
            $("deudaMontoTotal").value=""; $("deudaDescripcion").value="";
        }
    };
    
    if($("btnRegistrarAbono")) $("btnRegistrarAbono").onclick = () => {
        const id = $("abonoSeleccionar").value;
        const monto = safeNumber($("abonoMonto").value);
        const deuda = panelData.deudas.find(d => d.id == id);
        if(deuda && monto > 0 && monto <= deuda.saldo) {
            deuda.saldo -= monto;
            panelData.gastos.push({descripcion: `Abono ${deuda.desc}`, monto, fecha: new Date().toISOString(), esTrabajo: false});
            saveData(); renderDeudas(); alert("Abono registrado");
            $("abonoMonto").value="";
        } else { alert("Datos inválidos"); }
    };

    // Respaldos
    if($("btnExportar")) $("btnExportar").onclick = exportarJson;
    if($("btnImportar")) $("btnImportar").onclick = importarJson;
}

function renderDeudas() {
    const s = $("abonoSeleccionar");
    const l = $("listaDeudas");
    if(!s || !l) return;
    s.innerHTML = ""; l.innerHTML = "";
    
    panelData.deudas.forEach(d => {
        if(d.saldo > 0) {
            const opt = document.createElement("option");
            opt.value = d.id; opt.text = d.desc;
            s.add(opt);
            
            l.innerHTML += `<li>${d.desc}: $${fmtMoney(d.saldo)} restan</li>`;
        }
    });
}

document.addEventListener("DOMContentLoaded", () => {
    cargarPanelData();
    const page = document.body.getAttribute('data-page');
    
    if (page === 'admin') {
        setupGasolinaWizard();
        setupListeners();
        actualizarUITurno();
        renderDeudas();
    }
    // Lógica para index.html o historial.html iría aquí reutilizando calcularMetricasGenerales
});
