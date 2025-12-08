// 03_render.js
import { $, fmtMoney, CATEGORIAS_GASTOS } from './01_consts_utils.js';
import { getState, getTurnoActivo, iniciarTurnoLogic, finalizarTurnoLogic, recalcularMetaDiaria, registrarCargaGasolina, actualizarOdometroManual, agregarDeuda, agregarGasto, agregarGastoFijo } from './02_data.js';

// ... (renderTurnoUI, renderMetaDiaria, renderDashboard, llenarCategorias) ...

// --- ADMIN: INTERFAZ DE ODÓMETRO Y COSTO POR KM ---
export const renderOdometroUI = () => {
    const lblKm = $("lblKmAnterior");
    const inputKm = $("inputOdometro");
    const costoKmDisplay = $("costoPorKmDisplay"); // <-- Referencia al elemento

    if (!lblKm) return; // Guard Clause

    const state = getState();
    lblKm.innerText = `${state.parametros.ultimoKM} km`;
    
    // Placeholder para el input de KM
    inputKm.placeholder = state.parametros.ultimoKM > 0 ? `Mayor a ${state.parametros.ultimoKM}` : "Ingresa KM Inicial";

    // Mostrar Costo por KM
    if (costoKmDisplay) {
        const costo = state.parametros.costoPorKm;
        // Si el costo es mayor a cero, lo mostramos formateado. Si no, mostramos "Calculando..."
        costoKmDisplay.innerText = costo > 0 ? `$${fmtMoney(costo)}` : "Calculando...";
    }
};

// ... (resto de setupAdminListeners) ...
