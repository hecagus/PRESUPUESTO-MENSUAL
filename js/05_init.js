/* 05_init.js - CONEXIÓN TOTAL */
import { 
    loadData, getState, getDashboardStats, getAdminStats, getWalletStats,
    iniciarTurno, finalizarTurno, registrarGasolina, 
    agregarMovimiento, agregarGastoRecurrente, 
    agregarDeuda, registrarAbono 
} from './02_data.js';
import * as Render from './03_render.js';
import { CATEGORIAS_GASTOS, $ } from './01_consts_utils.js';
import { initCharts } from './04_charts.js';

// --- REFRESCO DE PANTALLA ---
const refreshUI = () => {
    const page = document.body.getAttribute('data-page');
    // Siempre cargar estado fresco
    const s = getState(); 
    
    if (page === 'index') {
        const stats = getDashboardStats();
        Render.renderDashboard(stats);
        if (typeof initCharts === 'function') initCharts();
    } else if (page === 'admin') {
        const stats = getAdminStats();
        // Esto quita el "Cargando..."
        Render.renderTurnoControl(stats.turnoActivo);
        Render.renderMetaDiaria(stats.metaDiaria);
        Render.renderAdminLists(stats.deudas);
    } else if (page === 'wallet') {
        Render.renderWalletUI(getWalletStats());
    } else if (page === 'historial') {
        Render.renderHistorial(s.movimientos);
    }
};

// --- WIZARDS (LÓGICA DE NEGOCIO) ---

const wizardGasolina = () => {
    const litros = prompt("⛽ Paso 1: ¿Litros cargados?");
    if (!litros) return;
    const costo = prompt("💰 Paso 2: ¿Costo TOTAL ($)?");
    if (!costo) return;
    const ultimoKM = getState().parametros.ultimoKMfinal || 0;
    const km = prompt(`🏎️ Paso 3: Kilometraje ACTUAL:\n(Anterior: ${ultimoKM})`, ultimoKM);
    if (!km) return;

    const res = registrarGasolina(litros, costo, km);
    alert(`✅ Registrado.\nRendimiento: $${res.costoKmReal ? res.costoKmReal.toFixed(2) : '0.00'}/km`);
    refreshUI();
};

const wizardGastoInteligente = () => {
    const tipo = prompt("¿Tipo de Gasto?\n1. 🛵 MOTO (Operativo)\n2. 🏠 HOGAR (Personal)");
    if(tipo !== "1" && tipo !== "2") return;
    
    const esMoto = tipo === "1";
    const lista = esMoto ? CATEGORIAS_GASTOS.moto : CATEGORIAS_GASTOS.hogar;
    
    let menu = "Escribe el número:\n";
    lista.forEach((c, i) => menu += `${i+1}. ${c}\n`);
    const sel = prompt(menu);
    const catDesc = lista[parseInt(sel)-1];
    
    if (!catDesc) { alert("Opción inválida"); return; }
    
    const monto = prompt(`Gasto: ${catDesc}\n¿Monto Total ($)?`);
    if (!monto) return;

    const esFijo = confirm("¿Es un gasto RECURRENTE (Renta, Plan, Seguro)?\n\n[Aceptar] = SÍ (Afecta Meta Diaria)\n[Cancelar] = NO (Gasto único)");
    
    if (esFijo) {
        const fSel = prompt("Frecuencia:\n1. Semanal\n2. Quincenal\n3. Mensual");
        const freqs = ["", "Semanal", "Quincenal", "Mensual"];
        const frecuencia = freqs[fSel] || "Mensual";
        const dia = prompt("¿Día de pago ideal? (Ej: 15)");
        agregarGastoRecurrente(catDesc, monto, frecuencia, dia);
        alert("✅ Gasto Fijo agregado a Meta Diaria.");
    }

    agregarMovimiento('gasto', catDesc, monto, esMoto ? 'Moto' : 'Hogar');
    alert("✅ Gasto registrado");
    refreshUI();
};

const wizardNuevaDeuda = () => {
    const nombre = prompt("📝 Nombre de la Deuda (Ej: Banco):");
    if(!nombre) return;
    const total = prompt("💰 Monto TOTAL a deber ($):");
    if(!total) return;
    const cuota = prompt("📅 ¿Cuánto pagas por cuota? ($):");
    if(!cuota) return;
    
    const fSel = prompt("Frecuencia de pago:\n1. Semanal\n2. Quincenal\n3. Mensual");
    const freqs = ["", "Semanal", "Quincenal", "Mensual"];
    const frecuencia = freqs[fSel] || "Mensual";
    
    agregarDeuda(nombre, total, cuota, frecuencia);
    alert("✅ Deuda registrada. Tu Meta Diaria subió.");
    refreshUI();
};

// --- EVENTOS (CLICK LISTENERS) ---
const bindAdminEvents = () => {
    // Turnos
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

    // Botones Rápidos (Ahora en HTML)
    const btnGas = $("btnWizardGas");
    if (btnGas) btnGas.onclick = wizardGasolina;

    const btnGasto = $("btnWizardGasto");
    if (btnGasto) btnGasto.onclick = wizardGastoInteligente;

    // Deudas
    const btnNewDeuda = $("btnWizardDeuda");
    if (btnNewDeuda) btnNewDeuda.onclick = wizardNuevaDeuda;

    const btnAbono = $("btnRegistrarAbono");
    if (btnAbono) btnAbono.onclick = () => {
        const id = $("abonoSeleccionar").value;
        const m = $("abonoMonto").value;
        if(id && m) { registrarAbono(id, m); alert("✅ Abono aplicado"); refreshUI(); }
    };

    // Respaldo
    const btnJSON = $("btnCopiarJSON");
    if (btnJSON) btnJSON.onclick = () => {
        navigator.clipboard.writeText(JSON.stringify(getState()));
        alert("📋 Datos copiados al portapapeles");
    };
};

// --- ARRANQUE ---
document.addEventListener("DOMContentLoaded", () => {
    loadData(); // Cargar LocalStorage
    Render.renderGlobalMenu(); // Menú siempre visible
    
    refreshUI(); // Pintar estado actual
    
    const page = document.body.getAttribute('data-page');
    if (page === 'admin') {
        bindAdminEvents();
    }
    
    console.log("Sistema Reparado y Cargado: " + page);
});
