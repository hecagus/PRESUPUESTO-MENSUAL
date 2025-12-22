/* 05_init.js */
import { 
    loadData, getState, getDashboardStats, getAdminStats, getWalletStats,
    iniciarTurno, finalizarTurno, registrarGasolina, 
    agregarMovimiento, agregarGastoRecurrente, registrarAbono 
} from './02_data.js';
import * as Render from './03_render.js';
import { CATEGORIAS_GASTOS, $ } from './01_consts_utils.js';
import { initCharts } from './04_charts.js';

// --- REFRESCO REACTIVO (SIN RELOAD) ---
const refreshUI = () => {
    const page = document.body.getAttribute('data-page');
    // Forzar lectura fresca de estado
    const s = getState();
    
    if (page === 'index') {
        const stats = getDashboardStats();
        Render.renderDashboard(stats);
        if (typeof initCharts === 'function') initCharts();
    } else if (page === 'admin') {
        const stats = getAdminStats();
        Render.renderTurnoControl(stats.turnoActivo);
        Render.renderMetaDiaria(stats.metaDiaria);
        Render.renderAdminLists(stats.deudas);
    } else if (page === 'wallet') {
        Render.renderWalletUI(getWalletStats());
    } else if (page === 'historial') {
        Render.renderHistorial(s.movimientos);
    }
};

// --- WIZARDS (Lógica Interactiva) ---
const wizardGasolina = () => {
    const litros = prompt("⛽ Paso 1/3: ¿Litros cargados?");
    if (!litros) return;
    const costo = prompt("💰 Paso 2/3: ¿Costo TOTAL ($)?");
    if (!costo) return;
    const ultimoKM = getState().parametros.ultimoKMfinal || 0;
    const km = prompt(`🏎️ Paso 3/3: Kilometraje ACTUAL del tablero:\n(Anterior: ${ultimoKM})`, ultimoKM);
    if (!km) return;

    const res = registrarGasolina(litros, costo, km);
    alert(`✅ Registrado.\nRendimiento: $${res.costoKmReal ? res.costoKmReal.toFixed(2) : '0.00'}/km`);
    refreshUI();
};

const wizardGastoInteligente = () => {
    const tipo = prompt("1. 🛵 MOTO (Operativo)\n2. 🏠 HOGAR (Personal)\n3. Cancelar");
    if(tipo !== "1" && tipo !== "2") return;
    
    const esMoto = tipo === "1";
    const lista = esMoto ? CATEGORIAS_GASTOS.moto : CATEGORIAS_GASTOS.hogar;
    
    let menu = "Escribe el NÚMERO:\n";
    lista.forEach((c, i) => menu += `${i+1}. ${c}\n`);
    const sel = prompt(menu);
    const catDesc = lista[parseInt(sel)-1];
    
    if (!catDesc) { alert("Opción no válida"); return; }
    
    const monto = prompt(`Gasto: ${catDesc}\n¿Monto Total ($)?`);
    if (!monto) return;

    const esFijo = confirm("¿Es un gasto RECURRENTE (Renta, Plan)?\n\nAceptar = SÍ\nCancelar = NO");
    
    if (esFijo) {
        const fSel = prompt("Frecuencia:\n1. Semanal\n2. Quincenal\n3. Mensual");
        const freqs = ["", "Semanal", "Quincenal", "Mensual"];
        const frecuencia = freqs[fSel] || "Mensual";
        const dia = prompt("¿Día de pago? (Ej: 15)");
        agregarGastoRecurrente(catDesc, monto, frecuencia, dia);
    }

    agregarMovimiento('gasto', catDesc, monto, esMoto ? 'Moto' : 'Hogar');
    alert("✅ Gasto registrado");
    refreshUI();
};

// --- EVENTOS ---
const bindEvents = () => {
    const btnI = $("btnIniciarTurno");
    if (btnI) btnI.onclick = () => {
        const km = prompt("Confirma KM Inicial:", getState().parametros.ultimoKMfinal || 0);
        if (km) { iniciarTurno(km); refreshUI(); }
    };

    const btnF = $("btnFinalizarTurno");
    if (btnF) btnF.onclick = () => {
        const km = prompt("KM Final del tablero:");
        const gan = prompt("Ganancia Total ($):");
        if (km && gan) { finalizarTurno(km, gan); alert("Turno Cerrado"); refreshUI(); }
    };

    const btnA = $("btnRegistrarAbono");
    if (btnA) btnA.onclick = () => {
        const id = $("abonoSeleccionar").value;
        const m = $("abonoMonto").value;
        if(id && m) { registrarAbono(id, m); alert("Abono aplicado"); refreshUI(); }
    };

    // Inyectar Botones Wizard Admin
    const cardTurnos = document.getElementById("cardTurnos");
    if (cardTurnos && !document.getElementById("btnWizardGas")) {
        const div = document.createElement("div");
        div.style.marginTop = "15px";
        div.style.display = "grid";
        div.style.gridTemplateColumns = "1fr 1fr";
        div.style.gap = "10px";
        div.innerHTML = `
            <button id="btnWizardGas" class="btn-secondary" style="background:#fff7ed; color:#c2410c; border:1px solid #fdba74;">⛽ Gasolina</button>
            <button id="btnWizardGasto" class="btn-secondary" style="background:#eff6ff; color:#1d4ed8; border:1px solid #93c5fd;">💸 Gastos</button>
        `;
        cardTurnos.appendChild(div);
        
        document.getElementById("btnWizardGas").onclick = wizardGasolina;
        document.getElementById("btnWizardGasto").onclick = wizardGastoInteligente;
    }
};

// --- INIT PRINCIPAL ---
document.addEventListener("DOMContentLoaded", () => {
    // 1. Cargar Datos
    try { loadData(); } catch (e) { console.error("Error data", e); }

    // 2. Renderizar Menú (CRÍTICO: Prioridad 1)
    Render.renderGlobalMenu();

    // 3. Renderizar UI Inicial
    refreshUI();

    // 4. Bindear Eventos (Si aplica)
    const page = document.body.getAttribute('data-page');
    if (page === 'admin') {
        bindEvents();
    }
    
    console.log(`Sistema v2.2 (Fix) cargado: ${page}`);
});

