// app.js - VERSIÓN FINAL: SOPORTE COMPLETO DE FRECUENCIAS, EXCEL Y ALERTAS
// ---------------------------------------------------------------------

const STORAGE_KEY = "panelData";
const $ = id => document.getElementById(id);
let gananciasChart = null;
let kmChart = null;

// --- CONFIGURACIÓN DE FRECUENCIAS y CATEGORÍAS ---
const DIAS_POR_FRECUENCIA = {
    'Diario': 1,
    'Semanal': 7,
    'Quincenal': 15,
    'Mensual': 30,
    'Bimestral': 60,
    'No Recurrente': 0
};

const CATEGORIAS_GASTOS = {
    moto: [
        "Mantenimiento (Aceite/Filtros)", "Reparación Mecánica", "Llantas/Frenos",
        "Peajes/Casetas", "Lavado/Limpieza", "Accesorios/Equipo", "Seguro/Trámites", "✏️ Otra / Nueva..."
    ],
    hogar: [
        "Comida del día (Calle)", "Despensa/Supermercado", "Renta/Alquiler",
        "Luz/Agua/Gas", "Internet/Streaming", "Celular/Datos", "Salud/Farmacia",
        "Ropa/Personal", "Diversión/Salidas", "✏️ Otra / Nueva..."
    ]
};

const TUTORIAL_VIEWED_KEY = "tutorialViewed";

const DEFAULT_PANEL_DATA = {
  ingresos: [], gastos: [], turnos: [], movimientos: [], cargasCombustible: [], deudas: [],
  gastosFijosMensuales: [], 
  parametros: {
    deudaTotal: 0, 
    gastoFijo: 0, 
    ultimoKMfinal: 0, 
    costoPorKm: 0,
    mantenimientoBase: { 'Aceite (KM)': 3000, 'Bujía (KM)': 8000, 'Llantas (KM)': 15000 }
  }
};

let panelData = JSON.parse(JSON.stringify(DEFAULT_PANEL_DATA));
let turnoActivo = JSON.parse(localStorage.getItem("turnoActivo")) || false;

// ---------- UTILIDADES ----------
function safeNumber(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }
function fmtMoney(n) { return safeNumber(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
function formatearFecha(d) { return new Date(d).toLocaleDateString(); }

// ---------- GESTIÓN DE DATOS ----------

function exportarAExcel() {
    if (typeof XLSX === 'undefined') return alert('Librería XLSX no cargada.');

    const wb = XLSX.utils.book_new();
    const data = panelData;
    const now = new Date().toISOString().slice(0, 10);
    
    // 1. Hoja de Movimientos (Ingresos + Gastos)
    const movimientos = data.gastos.map(g => ({
        Tipo: g.tipo || (g.esTrabajo ? 'Gasto Operativo' : 'Gasto Personal'),
        Fecha: new Date(g.fecha).toLocaleDateString(),
        Monto: g.monto,
        Descripcion: g.descripcion,
        Categoria: g.categoria || 'N/A',
        Frecuencia: g.frecuencia || 'N/A',
    })).concat(data.ingresos.map(i => ({
        Tipo: 'Ingreso',
        Fecha: new Date(i.fecha).toLocaleDateString(),
        Monto: i.monto,
        Descripcion: i.descripcion,
        Categoria: 'N/A',
        Frecuencia: 'N/A',
    })));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(movimientos), 'Movimientos');

    // 2. Hoja de Turnos
    const turnos = data.turnos.map(t => ({
        Fecha_Inicio: new Date(t.fechaInicio).toLocaleDateString(),
        Horas: t.horas.toFixed(2),
        KM_Inicio: t.kmInicial,
        KM_Final: t.kmFinal,
        KM_Recorrido: t.kmRecorrido,
        Ganancia_Bruta: t.gananciaBruta,
        Ganancia_Neta: t.gananciaNeta,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(turnos), 'Turnos');
    
    // 3. Hoja de Deudas y Fijos
    const deudas = data.deudas.map(d => ({
        Nombre: d.desc,
        Monto_Total: d.montoOriginal,
        Saldo_Pendiente: d.saldo,
        Cuota_Frecuente: d.montoCuota,
        Frecuencia: d.frecuencia,
        Proximo_Pago: new Date(d.proximoPago).toLocaleDateString(),
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(deudas), 'Deudas');

    const fijos = data.gastosFijosMensuales.map(g => ({
        Gasto: g.categoria,
        Monto: g.monto,
        Frecuencia: g.frecuencia,
        Dia_Pago: g.diaPago
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(fijos), 'Gastos_Fijos_Recurrentes');

    XLSX.writeFile(wb, `Rastreador_Data_${now}.xlsx`);
    alert('Exportación a Excel finalizada.');
}

function getDailyDebtContribution() {
    let totalDiario = 0;
    panelData.deudas.forEach(d => {
        const montoCuota = safeNumber(d.montoCuota);
        if (montoCuota > 0 && d.saldo > 0) {
            const dias = DIAS_POR_FRECUENCIA[d.frecuencia] || 30;
            if (dias > 0) {
                totalDiario += montoCuota / dias;
            }
        }
    });
    return totalDiario;
}

function recalcularMetaDiaria() {
    // 1. GASTOS FIJOS (NORMALIZADOS A DIARIO)
    const cuotaFijosDiaria = panelData.gastosFijosMensuales.reduce((dailySum, g) => {
        const days = DIAS_POR_FRECUENCIA[g.frecuencia] || 30; 
        const costPerDay = safeNumber(g.monto) / days; 
        return dailySum + costPerDay;
    }, 0); 
    const totalFijos = cuotaFijosDiaria * 30;
    
    // 2. DEUDAS (CONTRIBUCIÓN DIARIA)
    const cuotaDeudasDiaria = getDailyDebtContribution();

    // 3. META DIARIA TOTAL
    const metaTotal = cuotaFijosDiaria + cuotaDeudasDiaria;
    
    panelData.parametros.gastoFijo = metaTotal; 
    
    if($("metaDiariaDisplay")) $("metaDiariaDisplay").innerText = `$${fmtMoney(metaTotal)}`;
    if($("totalFijoMensualDisplay")) $("totalFijoMensualDisplay").innerText = `$${fmtMoney(totalFijos)}`;
    
    saveData();
}

function validarYArreglarDatos() {
  ['ingresos', 'gastos', 'deudas', 'movimientos', 'turnos', 'cargasCombustible', 'gastosFijosMensuales'].forEach(k => {
    if (!Array.isArray(panelData[k])) panelData[k] = [];
  });
  if (!panelData.parametros) panelData.parametros = DEFAULT_PANEL_DATA.parametros;
  panelData.parametros.ultimoKMfinal = safeNumber(panelData.parametros.ultimoKMfinal);
  
  recalcularMetaDiaria();
  calcularMetricasCombustible(false);
  saveData();
}

function cargarPanelData() {
  const data = localStorage.getItem(STORAGE_KEY);
  if (data) { try { panelData = { ...panelData, ...JSON.parse(data) }; } catch (e) {} }
  validarYArreglarDatos();
}

function saveData() { localStorage.setItem(STORAGE_KEY, JSON.stringify(panelData)); }
function exportarJson() { navigator.clipboard.writeText(JSON.stringify(panelData)).then(() => alert("Copiado.")); }
function importarJson() {
    try {
        const json = $("importJson").value; if (!json) return;
        panelData = { ...DEFAULT_PANEL_DATA, ...JSON.parse(json) };
        validarYArreglarDatos(); alert("Restaurado."); window.location.reload();
    } catch (e) { alert("Error JSON"); }
}

// ---------- ALERTAS DE MANTENIMIENTO E INICIO ----------

function checkMantenimientoAlerts() {
    const ul = $("listaAlertas");
    const card = $("cardAlertas");
    if(!ul || !card) return;
    
    ul.innerHTML = "";
    card.classList.add('hidden');
    const alerts = [];

    const kmFinal = safeNumber(panelData.parametros.ultimoKMfinal);
    const maintenanceBase = panelData.parametros.mantenimientoBase;
    
    // Alerta de KM de mantenimiento (Lógica simple: alertar si el KM actual es múltiplo del umbral)
    for (const key in maintenanceBase) {
        const threshold = safeNumber(maintenanceBase[key]);
        if (threshold > 0 && kmFinal > 0) {
            // Revisa si el KM Final es cercano a un múltiplo del umbral (Ej: 3000, 6000, 9000...)
            const remainder = kmFinal % threshold;
            const kmToNextService = threshold - remainder;

            if (kmToNextService <= 200 && kmToNextService > 0) {
                alerts.push(`🚨 ¡Mantenimiento de ${key.replace('(KM)', '').trim()} en ${kmToNextService.toFixed(0)} KM! (Umbral: ${threshold} KM)`);
            }
        }
    }

    // Alerta de Pagos Recurrentes (Día de pago igual o menor al día actual)
    const today = new Date().getDate();
    panelData.gastosFijosMensuales.forEach(g => {
        const diaPago = safeNumber(g.diaPago);
        if (g.frecuencia.includes('Mensual') || g.frecuencia.includes('Quincenal')) {
            if (diaPago === today || (diaPago > today && diaPago <= today + 3)) { // Hoy o en los próximos 3 días
                alerts.push(`💸 Pago Recurrente: ${g.categoria} ($${fmtMoney(g.monto)}) vence el día ${diaPago}.`);
            }
        }
    });

    if (alerts.length > 0) {
        alerts.forEach(alert => {
            const li = document.createElement("li");
            li.innerText = alert;
            ul.appendChild(li);
        });
        card.classList.remove('hidden');
    }
}


function checkTutorial() {
    const tutorialViewed = localStorage.getItem(TUTORIAL_VIEWED_KEY);
    if (tutorialViewed !== "true" && document.body.getAttribute('data-page') === 'index') {
        // Redirigir o mostrar modal, basado en la implementación de tutorial.html
        // Ya que el modal está en index.html, lo mostramos directamente
        const TUTORIAL_STEPS = [
            { title: "¡Bienvenido/a!", text: "Esta guía rápida te mostrará cómo usar el nuevo sistema de rastreo avanzado.", button: "Comenzar" },
            { title: "Turnos y KM", text: "Usa 'Iniciar Turno' y 'Finalizar Turno'. El KM se enlaza automáticamente para calcular tu consumo.", button: "Siguiente" },
            { title: "Gasolina y Costos", text: "La primera vez que uses el Asistente de Carga de Gasolina (3 Pasos), ¡activarás tu métrica de Costo Real por KM!", button: "Siguiente" },
            { title: "Gastos Inteligentes", text: "Clasifica tus gastos como Operativos o Personales. Define gastos recurrentes con su frecuencia.", button: "Siguiente" },
            { title: "Obligaciones y Metas", text: "Tus gastos fijos y deudas crean una 'Meta Diaria'. ¡Asegúrate de superarla para ahorrar y pagar tus compromisos!", button: "Finalizar" }
        ];

        let currentStep = 0;
        const modal = $("tutorialModal");
        const overlay = $("tutorialOverlay");
        const nextBtn = $("tutorialNextBtn");

        const updateModal = () => {
             if (currentStep >= TUTORIAL_STEPS.length) {
                modal.style.display = "none";
                overlay.style.display = "none";
                localStorage.setItem(TUTORIAL_VIEWED_KEY, "true");
                return;
            }
            const stepData = TUTORIAL_STEPS[currentStep];
            $("tutorialTitle").innerText = stepData.title;
            $("tutorialText").innerText = stepData.text;
            nextBtn.innerText = stepData.button;
        };

        nextBtn.onclick = () => {
            currentStep++;
            updateModal();
        };

        updateModal();
        modal.style.display = "block";
        overlay.style.display = "block";
    }
}

// ---------- UI RENDERIZADO ----------

function renderGastosFijos() {
    const ul = $("listaGastosFijos"); if(!ul) return; ul.innerHTML = "";
    if (panelData.gastosFijosMensuales.length === 0) { ul.innerHTML = "<li style='color:#777; font-style:italic;'>No tienes gastos fijos activos.</li>"; return; }
    panelData.gastosFijosMensuales.forEach((g, index) => {
        const li = document.createElement("li"); li.style.display = "flex"; li.style.justifyContent = "space-between"; li.style.alignItems = "center"; li.style.padding = "5px 0"; li.style.borderBottom = "1px solid #eee";
        li.innerHTML = `
            <span><strong>${g.categoria}</strong> (${g.frecuencia} - Día ${g.diaPago}):</span>
            <span>$${fmtMoney(g.monto)} 
                <button class="btn-danger" style="padding:2px 6px; font-size:0.7rem; margin-left:10px;" onclick="eliminarGastoFijo(${index})">X</button>
            </span>
        `;
        ul.appendChild(li);
    });
}
window.eliminarGastoFijo = function(index) {
    if(confirm("¿Ya no pagarás este servicio?")) {
        panelData.gastosFijosMensuales.splice(index, 1);
        recalcularMetaDiaria();
        renderGastosFijos();
        alert("Gasto fijo eliminado.");
    }
};

function renderDeudas() { 
    const l=$("listaDeudas"), s=$("abonoSeleccionar"); if(!l)return; l.innerHTML=""; s.innerHTML="";
    panelData.deudas.forEach(d => { 
        if(d.saldo>0.1) { 
            const proximo = d.proximoPago ? formatearFecha(new Date(d.proximoPago)) : 'N/A';
            const montoCuota = safeNumber(d.montoCuota);
            l.innerHTML+=`<li><strong>${d.desc}</strong> ($${fmtMoney(d.saldo)} restan) | Cuota: $${fmtMoney(montoCuota)} (${d.frecuencia}) | Próx. Pago: ${proximo}</li>`; 
            const o=document.createElement("option"); o.value=d.id; o.text=d.desc; s.add(o); 
        } 
    });
}

function renderIndex() {
    const m = calcularMetricasGenerales();
    calcularMetricasCombustible(true);
    const set = (id,v) => { if($(id)) $(id).innerText = v; };

    set("resHoras", `${m.horasTotal.toFixed(2)}h`);
    set("resGananciaBruta", `$${fmtMoney(m.brutaProm)}`);
    set("resGananciaNeta", `$${fmtMoney(m.netoDiario)}`);
    set("resKmRecorridos", `${m.kmTotal.toFixed(0)} km`);
    set("proyKmTotal", `${m.kmTotal.toFixed(0)} KM`);
    set("proyDeuda", `$${fmtMoney(m.deuda)}`);
    set("proyGastoFijoDiario", `$${fmtMoney(m.meta)}`);
    set("proyNetaPromedio", `$${fmtMoney(m.netoDiario)}`);
    set("proyDias", m.diasLibre);
    
    checkMantenimientoAlerts(); // <--- Muestra las alertas
    checkTutorial();
}

// ---------- WIZARDS Y LISTENERS (Recorte por espacio) ----------

function actualizarUITurno() {
  const btn = $("btnIniciarTurno"); if(!btn) return;
  calcularMetricasCombustible(true);
  if (turnoActivo) {
    $("turnoTexto").innerHTML = `🟢 En curso (${new Date(turnoActivo.inicio).toLocaleTimeString()})`;
    btn.style.display = 'none'; $("btnFinalizarTurno").style.display = 'block'; $("cierreTurnoContainer").style.display = 'block';
  } else {
    $("turnoTexto").innerHTML = `🔴 Sin turno`;
    btn.style.display = 'block'; $("btnFinalizarTurno").style.display = 'none'; $("cierreTurnoContainer").style.display = 'none';
  }
}

function iniciarTurno() {
  const kmInicial = safeNumber(panelData.parametros.ultimoKMfinal);
  if (kmInicial <= 0 && !confirm("KM Inicial es 0. ¿Continuar?")) return;
  turnoActivo = { inicio: Date.now(), kmInicial };
  localStorage.setItem("turnoActivo", JSON.stringify(turnoActivo)); actualizarUITurno();
}

function finalizarTurno() {
  const kmFinal = safeNumber($("kmFinalTurno").value);
  const ganancia = safeNumber($("gananciaBruta").value);
  if (kmFinal <= turnoActivo.kmInicial) return alert("KM Final debe ser mayor al inicial.");
  if (ganancia <= 0) return alert("Ingresa ganancia.");
  const rec = kmFinal - turnoActivo.kmInicial;
  const horas = (Date.now() - turnoActivo.inicio) / 36e5;
  const costo = rec * panelData.parametros.costoPorKm;
  panelData.turnos.push({
    id: Date.now(), fechaInicio: new Date(turnoActivo.inicio).toISOString(), fechaFin: new Date().toISOString(),
    horas, kmInicial: turnoActivo.kmInicial, kmFinal, kmRecorrido: rec,
    gananciaBruta: ganancia, gananciaNeta: ganancia - costo
  });
  panelData.parametros.ultimoKMfinal = kmFinal;
  turnoActivo = false; localStorage.removeItem("turnoActivo");
  saveData(); actualizarUITurno();
  $("kmFinalTurno").value = ""; $("gananciaBruta").value = "";
  alert(`Turno finalizado. Neta Est.: $${fmtMoney(ganancia - costo)}`);
}

function setupGasolinaWizard() {
    const p1 = $("gasWizardPaso1"), p2 = $("gasWizardPaso2"), p3 = $("gasWizardPaso3");
    $("btnGasSiguiente1").onclick = () => { if($("gasLitros").value > 0) { p1.style.display="none"; p2.style.display="block"; } };
    $("btnGasSiguiente2").onclick = () => { if($("gasCosto").value > 0) { p2.style.display="none"; p3.style.display="block"; } };
    $("btnGasAtras2").onclick = () => { p2.style.display="none"; p1.style.display="block"; };
    $("btnGasAtras3").onclick = () => { p3.style.display="none"; p2.style.display="block"; };

    $("btnRegistrarCargaFinal").onclick = () => {
        const km = safeNumber($("gasKmActual").value);
        const last = safeNumber(panelData.parametros.ultimoKMfinal);
        if (km <= last && last > 0) return alert("KM debe ser mayor al anterior.");
        const carga = { id: Date.now(), fecha: new Date().toISOString(), kmActual: km, litros: safeNumber($("gasLitros").value), costo: safeNumber($("gasCosto").value) };
        panelData.cargasCombustible.push(carga);
        panelData.gastos.push({ id: Date.now(), tipo: 'Gasto', descripcion: 'Carga Gasolina', monto: carga.costo, fecha: carga.fecha, esTrabajo: true });
        panelData.parametros.ultimoKMfinal = km;
        $("gasLitros").value=""; $("gasCosto").value=""; $("gasKmActual").value="";
        p3.style.display="none"; p1.style.display="block";
        saveData(); calcularMetricasCombustible(true); actualizarUITurno();
        alert("Carga registrada.");
    };
}

function setupGastosInteligentes() {
    const radios = document.getElementsByName("gastoTipoRadio");
    const select = $("gastoCategoriaSelect");
    const inputManual = $("gastoCategoriaManual"); 
    const selectFrecuencia = $("gastoFrecuenciaSelect"); 
    const divDia = $("divDiaPago");
    
    const llenarCategorias = (tipo) => {
        select.innerHTML = "";
        CATEGORIAS_GASTOS[tipo].forEach(cat => {
            const opt = document.createElement("option"); opt.value = cat; opt.text = cat; select.add(opt);
        });
        inputManual.style.display = "none"; inputManual.value = "";
    };

    select.addEventListener("change", (e) => {
        inputManual.style.display = e.target.value.includes("Otra") ? "block" : "none";
        if(e.target.value.includes("Otra")) inputManual.focus();
    });
    
    if (selectFrecuencia) {
        selectFrecuencia.addEventListener("change", (e) => {
            divDia.style.display = e.target.value === 'No Recurrente' ? "none" : "block";
        });
    }

    radios.forEach(r => r.addEventListener("change", (e) => llenarCategorias(e.target.value)));
    llenarCategorias("moto");
}

function setupDeudaWizard() {
    const p1 = $("deudaWizardStep1"), p2 = $("deudaWizardStep2"), p3 = $("deudaWizardStep3");
    
    // Paso 1 -> 2
    $("btnDeudaNext1").onclick = () => {
        const nombre = $("deudaNombre").value.trim();
        if (!nombre) return alert("Ingresa el nombre de la deuda.");
        p1.style.display = "none"; p2.style.display = "block";
    };

    // Paso 2 -> 3
    $("btnDeudaNext2").onclick = () => {
        const monto = safeNumber($("deudaMontoTotal").value);
        const montoCuota = safeNumber($("deudaMontoCuota").value);
        
        if (monto <= 0) return alert("Ingresa un monto total válido.");
        if (montoCuota <= 0) return alert("Ingresa el monto de la cuota."); 

        p2.style.display = "none"; p3.style.display = "block";
    };
    
    // Atrás
    $("btnDeudaBack2").onclick = () => { p2.style.display = "none"; p1.style.display = "block"; };
    $("btnDeudaBack3").onclick = () => { p3.style.display = "none"; p2.style.display = "block"; };

    // Finalizar Registro
    $("btnRegistrarDeudaFinal").onclick = () => {
        const nombre = $("deudaNombre").value.trim();
        const montoTotal = safeNumber($("deudaMontoTotal").value);
        const montoCuota = safeNumber($("deudaMontoCuota").value);
        const frecuencia = $("deudaFrecuencia").value;
        const proximoPago = $("deudaProximoPago").value;

        if (!proximoPago) return alert("Selecciona la fecha del próximo pago.");
        
        const nuevaDeuda = {
            id: Date.now(), desc: nombre, montoOriginal: montoTotal, saldo: montoTotal,
            frecuencia: frecuencia, proximoPago: proximoPago, creadaEn: new Date().toISOString(),
            montoCuota: montoCuota
        };
        
        panelData.deudas.push(nuevaDeuda);
        panelData.parametros.deudaTotal += montoTotal; 
        saveData();
        recalcularMetaDiaria();
        renderDeudas();
        
        $("deudaNombre").value = "";
        $("deudaMontoTotal").value = "";
        $("deudaMontoCuota").value = "";
        $("deudaProximoPago").value = "";
        p3.style.display = "none"; p1.style.display = "block";
        alert(`Deuda "${nombre}" registrada.`);
    };
}


function setupListeners() {
    if($("btnRegistrarIngreso")) $("btnRegistrarIngreso").onclick = () => {
        const d = $("ingresoDescripcion").value; const m = safeNumber($("ingresoCantidad").value);
        if(m > 0) { panelData.ingresos.push({id: Date.now(), descripcion: d, monto: m, fecha: new Date().toISOString()}); saveData(); alert("Ingreso OK"); $("ingresoDescripcion").value=""; $("ingresoCantidad").value=""; }
    };

    if($("btnRegistrarGasto")) $("btnRegistrarGasto").onclick = () => {
        const monto = safeNumber($("gastoCantidad").value);
        if (monto <= 0) return alert("Ingresa un monto.");
        const tipoRadio = document.querySelector('input[name="gastoTipoRadio"]:checked').value;
        const selectCat = $("gastoCategoriaSelect").value;
        const manualCat = $("gastoCategoriaManual").value.trim();
        const descExtra = $("gastoDescripcion").value.trim();
        const frecuencia = $("gastoFrecuenciaSelect").value;
        
        let categoriaFinal = selectCat;
        if (selectCat.includes("Otra") && manualCat) { categoriaFinal = manualCat; }
        else if (selectCat.includes("Otra") && !manualCat) { return alert("Escribe el nombre de la categoría."); }

        const descCompleta = descExtra ? `${categoriaFinal}: ${descExtra}` : categoriaFinal;
        const esRecurrente = frecuencia !== 'No Recurrente';
        const diaPago = esRecurrente ? safeNumber($("gastoDiaPago").value) : null;

        panelData.gastos.push({
            id: Date.now(), fecha: new Date().toISOString(), descripcion: descCompleta,
            categoria: categoriaFinal, monto: monto, esTrabajo: (tipoRadio === 'moto'),
            esFijo: esRecurrente, frecuencia: frecuencia, diaPago: diaPago, tipo: 'Gasto'
        });

        if (esRecurrente) {
            panelData.gastosFijosMensuales.push({
                id: Date.now(), categoria: categoriaFinal, descripcion: descExtra,
                monto: monto, diaPago: diaPago || 1, frecuencia: frecuencia
            });
            recalcularMetaDiaria();
            renderGastosFijos();
        }

        saveData();
        alert(esRecurrente ? `Gasto registrado y agregado a Obligaciones Mensuales.` : `Gasto registrado: ${descCompleta}`);
        
        $("gastoCantidad").value = ""; $("gastoDescripcion").value = "";
        $("gastoCategoriaManual").value = ""; $("gastoCategoriaManual").style.display = "none";
        $("gastoCategoriaSelect").selectedIndex = 0;
        $("gastoFrecuenciaSelect").value = "No Recurrente";
        $("divDiaPago").style.display = "none";
    };

    if($("btnRegistrarAbono")) $("btnRegistrarAbono").onclick = () => {
        const id = $("abonoSeleccionar").value; const m = safeNumber($("abonoMonto").value);
        const d = panelData.deudas.find(x=>x.id==id);
        if(d && m>0 && m<=d.saldo) { 
            d.saldo-=m; 
            panelData.parametros.deudaTotal -= m;
            panelData.gastos.push({id:Date.now(), descripcion:`Abono ${d.desc}`, monto:m, fecha:new Date().toISOString(), esTrabajo:false}); 
            saveData(); 
            recalcularMetaDiaria(); 
            renderDeudas(); 
            alert("Abonado"); 
        }
    };

    if($("btnExportar")) $("btnExportar").onclick = exportarJson;
    if($("btnImportar")) $("btnImportar").onclick = importarJson;
    if($("btnExportarExcel")) $("btnExportarExcel").onclick = exportarAExcel; // <--- BOTÓN EXCEL
}

// INICIALIZACIÓN
document.addEventListener("DOMContentLoaded", () => {
    cargarPanelData();
    const page = document.body.getAttribute('data-page');
    if (page === 'admin') {
        setupGasolinaWizard();
        setupGastosInteligentes();
        setupDeudaWizard(); 
        setupListeners();
        actualizarUITurno();
        renderDeudas();
        renderGastosFijos();
        // Cargar Umbrales de Mantenimiento al cargar la página
        if($("mantenimientoAceite")) $("mantenimientoAceite").value = panelData.parametros.mantenimientoBase['Aceite (KM)'];
        if($("mantenimientoBujia")) $("mantenimientoBujia").value = panelData.parametros.mantenimientoBase['Bujía (KM)'];
        if($("mantenimientoLlantas")) $("mantenimientoLlantas").value = panelData.parametros.mantenimientoBase['Llantas (KM)'];

        if($("btnGuardarMantenimiento")) $("btnGuardarMantenimiento").onclick = () => {
            const base = panelData.parametros.mantenimientoBase;
            base['Aceite (KM)'] = safeNumber($("mantenimientoAceite").value);
            base['Bujía (KM)'] = safeNumber($("mantenimientoBujia").value);
            base['Llantas (KM)'] = safeNumber($("mantenimientoLlantas").value);
            saveData(); alert("Umbrales guardados.");
        };

    } else if (page === 'index') {
        renderIndex();
    }
});
