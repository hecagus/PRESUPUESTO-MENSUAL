/* 05_init.js */
import { 
    loadData, getState, getDashboardStats, getAdminStats, 
    iniciarTurno, finalizarTurno, registrarGasolina, 
    agregarMovimiento, agregarGastoRecurrente, registrarAbono 
} from './02_data.js';
import * as Render from './03_render.js';
import { CATEGORIAS_GASTOS, DIAS_POR_FRECUENCIA, $ } from './01_consts_utils.js';
import { initCharts } from './04_charts.js';

// --- WIZARDS (FLUJOS INTERACTIVOS) ---

const flowCargaGasolina = () => {
    // 1. Litros
    const litros = prompt("⛽ Paso 1/3: ¿Cuántos LITROS cargaste?");
    if (!litros) return;

    // 2. Costo
    const costo = prompt("💰 Paso 2/3: ¿Costo TOTAL pagado ($)?");
    if (!costo) return;

    // 3. Kilometraje (Vital para el cálculo real)
    const ultimoKM = getState().parametros.ultimoKMfinal;
    const km = prompt(`🏎️ Paso 3/3: Kilometraje ACTUAL del tablero:\n(Último registrado: ${ultimoKM})`, ultimoKM);
    if (!km) return;

    const res = registrarGasolina(litros, costo, km);
    alert(`✅ Carga Registrada.\nCosto Real calc: $${res.costoKmReal.toFixed(2)} / km`);
    refreshAdminUI();
};

const flowGastoInteligente = () => {
    // 1. Selección de Tipo (Simulando Menú)
    const tipo = prompt("¿Qué tipo de gasto es?\n\n1. 🛵 MOTO (Operativo)\n2. 🏠 HOGAR (Personal)\n3. ❌ Cancelar");
    
    let categoriaPrincipal = "";
    let listaOpciones = [];

    if (tipo === "1") {
        categoriaPrincipal = "Moto";
        listaOpciones = CATEGORIAS_GASTOS.moto;
    } else if (tipo === "2") {
        categoriaPrincipal = "Hogar";
        listaOpciones = CATEGORIAS_GASTOS.hogar;
    } else {
        return;
    }

    // 2. Selección de Subcategoría (Simulando Menú Desplegable)
    let menuTexto = `Selecciona la categoría de ${categoriaPrincipal}:\n`;
    listaOpciones.forEach((cat, index) => {
        menuTexto += `${index + 1}. ${cat}\n`;
    });
    
    const seleccionIndex = prompt(menuTexto);
    const index = parseInt(seleccionIndex) - 1;
    
    if (isNaN(index) || index < 0 || index >= listaOpciones.length) {
        alert("Selección inválida.");
        return;
    }
    
    const descripcion = listaOpciones[index];

    // 3. Monto
    const monto = prompt(`Registrando: ${descripcion}\n¿Cuánto gastaste ($)?`);
    if (!monto) return;

    // 4. ¿Es Recurrente? (Para Meta Diaria)
    const esRecurrente = confirm(`¿Este gasto de "${descripcion}" se repite cada mes/semana?\n\nAceptar = SÍ (Configurar Frecuencia)\nCancelar = NO (Gasto Único)`);

    if (esRecurrente) {
        // Configurar Frecuencia
        const freqMenu = "Elige Frecuencia:\n1. Semanal\n2. Quincenal\n3. Mensual\n4. Bimestral";
        const freqRes = prompt(freqMenu);
        const mapasFreq = ["", "Semanal", "Quincenal", "Mensual", "Bimestral"];
        const frecuencia = mapasFreq[freqRes] || "Mensual";

        const diaPago = prompt("¿Qué día del mes se suele pagar? (Ej: 15, 30, 1)");

        agregarGastoRecurrente(descripcion, monto, frecuencia, diaPago);
        agregarMovimiento('gasto', descripcion, monto, categoriaPrincipal); // Lo registramos también como gasto de hoy
        alert("✅ Gasto Recurrente Guardado y Meta Actualizada.");

    } else {
        // Gasto Normal
        agregarMovimiento('gasto', descripcion, monto, categoriaPrincipal);
        alert("✅ Gasto Registrado.");
    }
    
    refreshAdminUI();
};

// --- CONTROL DE EVENTOS ---

const bindAdminEvents = () => {
    const btnInicio = $("btnIniciarTurno");
    const btnFin = $("btnFinalizarTurno");
    const btnAbono = $("btnRegistrarAbono");

    // Verificar si existen botones para Gasolina/Gastos en el HTML actual del usuario
    // Si no existen IDs específicos en el HTML de Admin para estos wizards, 
    // asumimos que el usuario podría querer botones flotantes o usar los existentes si los hay.
    // BASADO EN TU 'ADMIN.HTML', NO VEO BOTONES DE GASOLINA O GASTOS.
    // VOY A INYECTARLOS DINÁMICAMENTE PARA QUE PUEDAS USARLOS.

    injectActionButtons(); // Función auxiliar abajo

    if (btnInicio) {
        btnInicio.onclick = () => {
            const ultimoKM = getState().parametros.ultimoKMfinal || 0;
            const kmInput = prompt(`⏱️ Iniciar Turno\nConfirma KM Inicial:`, ultimoKM);
            if (kmInput) {
                iniciarTurno(kmInput);
                refreshAdminUI();
            }
        };
    }

    if (btnFin) {
        btnFin.onclick = () => {
            const kmInput = prompt("🏁 Finalizar Turno\nKM Final del odómetro:");
            const dineroInput = prompt("💵 Ganancia Total ($) del turno:");
            
            if (kmInput && dineroInput) {
                finalizarTurno(kmInput, dineroInput);
                alert("✅ Turno cerrado.");
                refreshAdminUI();
            }
        };
    }
    
    if (btnAbono) {
        btnAbono.onclick = () => {
            const id = $("abonoSeleccionar").value;
            const monto = $("abonoMonto").value;
            if(id && monto) {
                registrarAbono(id, monto);
                alert("Abono aplicado");
                refreshAdminUI();
            }
        };
    }
};

const injectActionButtons = () => {
    // Busca el card de Turnos para insertar botones de acciones debajo
    const cardTurnos = document.getElementById("cardTurnos"); 
    // O busca un contenedor genérico
    const container = document.querySelector("main.container");
    
    if (container && !document.getElementById("btnWizardGas")) {
        const divAcciones = document.createElement("section");
        divAcciones.className = "card";
        divAcciones.innerHTML = `
            <h2>🚀 Acciones Rápidas</h2>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                <button id="btnWizardGas" class="btn-secondary" style="background:#fef3c7; color:#b45309; border:1px solid #fcd34d;">
                    ⛽ Cargar Gasolina
                </button>
                <button id="btnWizardGasto" class="btn-secondary" style="background:#e0e7ff; color:#3730a3; border:1px solid #c7d2fe;">
                    💸 Registrar Gasto
                </button>
            </div>
        `;
        // Insertar después del primer hijo (turnos)
        container.insertBefore(divAcciones, container.children[1]);
        
        // Asignar eventos a estos nuevos botones
        setTimeout(() => {
            $("btnWizardGas").onclick = flowCargaGasolina;
            $("btnWizardGasto").onclick = flowGastoInteligente;
        }, 100);
    }
};

// --- REFRESCO DE VISTAS ---
const refreshAdminUI = () => {
    const stats = getAdminStats();
    Render.renderTurnoControl(stats.turnoActivo);
    Render.renderMetaDiaria(stats.metaDiaria);
    Render.renderAdminLists(stats.deudas);
};

const refreshDashboardUI = () => {
    Render.renderDashboard(getDashboardStats());
    initCharts();
};

document.addEventListener("DOMContentLoaded", () => {
    loadData();
    Render.renderGlobalMenu();
    
    const page = document.body.getAttribute('data-page');

    if (page === 'index') refreshDashboardUI();
    else if (page === 'admin') {
        refreshAdminUI();
        bindAdminEvents();
    }
    else if (page === 'wallet') Render.renderWalletUI({}); // Wallet requiere lógica en Data si la reactivamos
    else if (page === 'historial') Render.renderHistorial(getState().movimientos);
});
