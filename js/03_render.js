// 03_render.js
import { $, fmtMoney, CATEGORIAS_GASTOS, formatearFecha, safeNumber } from './01_consts_utils.js';
import { getState, getTurnoActivo, iniciarTurnoLogic, finalizarTurnoLogic, recalcularMetaDiaria, registrarCargaGasolina, actualizarOdometroManual, agregarDeuda, agregarGasto, agregarGastoFijo, guardarConfigMantenimiento } from './02_data.js';

// ... (Funciones llenarCategorias, renderTurnoUI, renderOdometroUI, renderMetaDiaria, renderDashboard, renderHistorial IDÉNTICAS A LAS ANTERIORES) ...
// PEGA AQUÍ TUS FUNCIONES DE RENDERIZADO ANTERIORES SI LAS TIENES, O USA ESTE BLOQUE NUEVO PARA MANTENIMIENTO:

// --- NUEVO: RENDERIZADO SEGURO DE MANTENIMIENTO ---
export const renderMantenimientoUI = () => {
    const state = getState();
    // Protección: Si mantenimientoBase no existe, usamos objeto vacío para no romper
    const config = state.parametros?.mantenimientoBase || {}; 

    const setVal = (id, key) => {
        const el = $(id);
        if (el) {
            // Si el valor es undefined, ponemos 0
            el.value = config[key] || 0; 
        }
    };

    setVal("mantenimientoAceite", "Aceite");
    setVal("mantenimientoBujia", "Bujía");
    setVal("mantenimientoLlantas", "Llantas");
};

// ... (Resto de funciones render...)

// --- LISTENERS ACTUALIZADOS ---
export const setupAdminListeners = () => {
    if (!$("btnIniciarTurno")) return; 

    // ... (Tus listeners de Turno, Odometro, Gasto, Gasolina, Deuda... COPIALOS DE LA VERSIÓN ANTERIOR O MANTENLOS) ...

    // NUEVO BLOQUE: GUARDAR MANTENIMIENTO
    const btnMant = $("btnGuardarMantenimiento");
    if(btnMant) {
        btnMant.onclick = () => {
            const ac = $("mantenimientoAceite").value;
            const bu = $("mantenimientoBujia").value;
            const ll = $("mantenimientoLlantas").value;
            guardarConfigMantenimiento(ac, bu, ll);
            alert("Configuración de mantenimiento guardada.");
        };
    }
};
