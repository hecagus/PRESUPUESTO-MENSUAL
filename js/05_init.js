/* 05_init.js */
import { loadData, getState, iniciarTurno, finalizarTurno, registrarGasolina, agregarMovimiento, agregarGastoRecurrente, registrarAbono, getDashboardStats, getWalletStats } from './02_data.js';
import * as Render from './03_render.js';
import { CATEGORIAS_GASTOS, $ } from './01_consts_utils.js';
import { initCharts } from './04_charts.js';

// --- WIZARDS (FLUJOS PASO A PASO) ---

const wizardGasolina = () => {
    // Paso 1
    const litros = prompt("⛽ Paso 1/3: ¿Litros cargados?");
    if (!litros) return;
    
    // Paso 2
    const costo = prompt("💰 Paso 2/3: ¿Costo TOTAL ($)?");
    if (!costo) return;
    
    // Paso 3
    const ultimoKM = getState().parametros.ultimoKMfinal;
    const km = prompt(`🏎️ Paso 3/3: Kilometraje ACTUAL del tablero:\n(Anterior: ${ultimoKM})`, ultimoKM);
    if (!km) return;

    const res = registrarGasolina(litros, costo, km);
    alert(`✅ Registrado.\nRendimiento real de este tanque: $${res.costoKmReal.toFixed(2)}/km`);
    refreshAdmin();
};

const wizardGastoInteligente = () => {
    // Paso 1: Macro Categoría
    const tipo = prompt("¿Qué tipo de gasto es?\n1. 🛵 MOTO (Operativo)\n2. 🏠 HOGAR (Personal)");
    if(tipo !== "1" && tipo !== "2") return;
    
    const esMoto = tipo === "1";
    const lista = esMoto ? CATEGORIAS_GASTOS.moto : CATEGORIAS_GASTOS.hogar;
    
    // Paso 2: Subcategoría
    let menu = "Selecciona:\n";
    lista.forEach((c, i) => menu += `${i+1}. ${c}\n`);
    const sel = prompt(menu);
    const catDesc = lista[parseInt(sel)-1];
    if (!catDesc) return;
    
    // Paso 3: Monto
    const monto = prompt(`Gasto: ${catDesc}\n¿Monto Total ($)?`);
    if (!monto) return;

    // Paso 4: Recurrencia (Para Meta Diaria)
    const esFijo = confirm("¿Es un gasto RECURRENTE (Renta, Plan, Seguro)?\n\nAceptar = SÍ (Configurar frecuencia)\nCancelar = NO (Gasto único)");
    
    if (esFijo) {
        const freqs = ["", "Semanal", "Quincenal", "Mensual", "Bimestral"];
        const fSel = prompt("Frecuencia:\n1. Semanal\n2. Quincenal\n3. Mensual\n4. Bimestral");
        const frecuencia = freqs[fSel] || "Mensual";
        const dia = prompt("¿Día de pago ideal? (Ej: 15)");
        
        agregarGastoRecurrente(catDesc, monto, frecuencia, dia);
        alert("✅ Gasto Fijo guardado. Tu Meta Diaria ha subido.");
    }

    // Registrar el gasto de HOY
    agregarMovimiento('gasto', catDesc, monto, esMoto ? 'Moto' : 'Hogar');
    alert("✅ Gasto registrado en historial.");
    refreshAdmin();
};

// --- EVENTOS ---
const bindAdminEvents = () => {
    // Botones de Turno
    const btnInicio = $("btnIniciarTurno");
    const btnFin = $("btnFinalizarTurno");
    
    if (btnInicio) btnInicio.onclick = () => {
        const km = prompt("Confirma KM Inicial:", getState().parametros.ultimoKMfinal);
        if (km) { iniciarTurno(km); refreshAdmin(); }
    };
    
    if (btnFin) btnFin.onclick = () => {
        const km = prompt("KM Final del tablero:");
        const ganancia = prompt("💵 Ganancia Total ($) del turno:");
        if (km && ganancia) {
            finalizarTurno(km, ganancia);
            alert("✅ Turno Cerrado.");
            refreshAdmin();
        }
    };

    // Botones de Abono
    const btnAbono = $("btnRegistrarAbono");
    if(btnAbono) btnAbono.onclick = () => {
        const id = $("abonoSeleccionar").value;
        const m = $("abonoMonto").value;
        if(id && m) { registrarAbono(id, m); alert("Abono aplicado"); refreshAdmin(); }
    };
    
    // INYECCIÓN DE BOTONES WIZARD (Si no existen en HTML)
    const cardTurnos = document.getElementById("cardTurnos"); // o busca un anchor point
    if(cardTurnos && !document.getElementById("btnWizardGas")) {
        const div = document.createElement("div");
        div.style.marginTop = "15px";
        div.style.display = "grid";
        div.style.gridTemplateColumns = "1fr 1fr";
        div.style.gap = "10px";
        div.innerHTML = `
            <button id="btnWizardGas" style="background:#fef3c7; color:#b45309; border:1px solid #fcd34d; padding:10px; border-radius:8px; font-weight:bold;">⛽ Cargar Gasolina</button>
            <button id="btnWizardGasto" style="background:#e0e7ff; color:#3730a3; border:1px solid #c7d2fe; padding:10px; border-radius:8px; font-weight:bold;">💸 Registrar Gasto</button>
        `;
        cardTurnos.appendChild(div);
        
        // Bindear eventos a los nuevos botones
        setTimeout(() => {
            $("btnWizardGas").onclick = wizardGasolina;
            $("btnWizardGasto").onclick = wizardGastoInteligente;
        }, 100);
    }
};

const refreshAdmin = () => {
    const s = getState();
    Render.renderTurnoControl(s.turnoActivo); // Usar variable global local de Data no expuesta directamente, mejor getTurnoActivo o asumimos load refresca
    // Corrección: Data.getTurnoActivo no está expuesto en exports de data directo.
    // Usaremos un reload táctico o exponemos getter en data.js
    // Para simplificar: window.location.reload() es lo más seguro en PWA simple.
    // PERO, para hacerlo SPA style:
    window.location.reload(); 
};

// --- ARRANQUE ---
document.addEventListener("DOMContentLoaded", () => {
    loadData();
    Render.renderGlobalMenu();
    
    const page = document.body.getAttribute('data-page');
    
    if (page === 'index') {
        Render.renderDashboard(getDashboardStats());
        initCharts();
    } else if (page === 'admin') {
        const s = getState();
        // Render inicial Admin
        Render.renderTurnoControl(JSON.parse(localStorage.getItem("turnoActivo")));
        Render.renderMetaDiaria(s.parametros.gastoFijo);
        Render.renderAdminLists(s.deudas);
        bindAdminEvents();
    } else if (page === 'wallet') {
        Render.renderWalletUI(getWalletStats());
    } else if (page === 'historial') {
        Render.renderHistorial(getState().movimientos);
    }
});
