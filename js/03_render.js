// 03_render.js
import { $, fmtMoney, CATEGORIAS_GASTOS, formatearFecha, safeNumber } from './01_consts_utils.js';
import { getState, getTurnoActivo, iniciarTurnoLogic, finalizarTurnoLogic, recalcularMetaDiaria, registrarCargaGasolina, actualizarOdometroManual, agregarDeuda, agregarGasto, agregarGastoFijo, exportarJsonLogic, importarJsonLogic, calcularGastoOperativoAcumulado, guardarParametrosMantenimiento } from './02_data.js';

// --- Funciones de Renderizado ---

// --- ADMIN: INTERFAZ DE ODÓMETRO, COSTO POR KM Y GASTO ACUMULADO (CORREGIDO) ---
export const renderOdometroUI = () => {
    const lblKm = $("lblKmAnterior");
    const inputKm = $("inputOdometro");
    const costoKmDisplay = $("costoPorKmDisplay"); 
    const gastoDisp = $("gastoAcumuladoDisplay"); // Nuevo
    const kmInicialDisp = $("kmInicialAcumulado"); // Nuevo
    const kmActualDisp = $("kmActualOperativo"); // Nuevo
    const kmRecorridoDisp = $("kmRecorridoDisplay"); // Nuevo

    if (!lblKm) return;
    const state = getState();
    lblKm.innerText = `${state.parametros.ultimoKM} km`;
    inputKm.placeholder = state.parametros.ultimoKM > 0 ? `Mayor a ${state.parametros.ultimoKM}` : "Ingresa KM Inicial";

    // 1. Mostrar Costo por KM
    if (costoKmDisplay) {
        const costo = state.parametros.costoPorKm;
        costoKmDisplay.innerText = costo > 0.001 ? `$${fmtMoney(costo)}/km` : "Calculando..."; 
    }
    
    // 2. Mostrar Gasto Operativo Acumulado
    const acumulado = calcularGastoOperativoAcumulado();
    if (gastoDisp) {
        gastoDisp.innerText = `$${fmtMoney(acumulado.gastoAcumulado)}`;
        kmInicialDisp.innerText = `${acumulado.kmInicial} km`;
        kmActualDisp.innerText = `${acumulado.kmActual} km`;
        kmRecorridoDisp.innerText = `${acumulado.kmRecorrido} km`;
    }
};

// --- ADMIN: MANTENIMIENTO (NUEVO) ---
const renderMantenimientoUI = () => {
    const state = getState();
    const base = state.parametros.mantenimientoBase;
    const ultimoKM = state.parametros.ultimoKM;
    
    // Rellenar Umbrales
    const setVal = (id, val) => { const el = $(id); if(el) el.value = val; };
    setVal("mantenimientoAceite", base.Aceite);
    setVal("mantenimientoBujia", base.Bujia);
    setVal("mantenimientoLlantas", base.Llantas);

    // Alertas (Lógica simple: Asumimos último servicio fue KM 0)
    const lastKmEl = $("maintLastKm");
    if(lastKmEl) lastKmEl.innerText = `${ultimoKM} km`;
    
    const ulAlertas = $("listaAlertasMantenimiento");
    if(!ulAlertas) return;
    ulAlertas.innerHTML = '';
    
    if(ultimoKM < 100) {
         ulAlertas.innerHTML = '<li>⚙️ Registra tu primer servicio (KM 0) para activar alertas.</li>';
         return;
    }

    // Aquí iría la lógica avanzada para comparar con state.parametros.ultimoServicio.
    // Por simplicidad, alertamos si el KM es mayor al umbral si no hay registro de servicio.
    const umbrales = [
        { key: 'Aceite', km: base.Aceite },
        { key: 'Bujía', km: base.Bujía },
        { key: 'Llantas', km: base.Llantas }
    ];

    umbrales.forEach(item => {
        const servicioKM = state.parametros.ultimoServicio[item.key] || 0;
        const kmFaltante = item.km - (ultimoKM - servicioKM);
        
        if(kmFaltante < item.km * 0.1) { // Alertar si falta menos del 10% para el umbral
             ulAlertas.innerHTML += `<li style="color:#d97706;">🚨 ${item.key}: Faltan ${kmFaltante.toFixed(0)} km.</li>`;
        }
    });

    if (ulAlertas.innerHTML === '') {
        ulAlertas.innerHTML = '<li style="color:#10b981;">✅ Todo OK.</li>';
    }
};


// --- LISTENERS ADMIN ---
export const setupAdminListeners = () => {
    if (!$("btnIniciarTurno")) return; 

    // ... (1-4. Turno, Odómetro, Gastos, Wizards se mantienen) ...

    // 5. MANTENIMIENTO LISTENERS (NUEVO)
    const btnMaint = $("btnGuardarMantenimiento");
    if (btnMaint) {
        btnMaint.onclick = () => {
            const aceite = $("mantenimientoAceite").value;
            const bujia = $("mantenimientoBujia").value;
            const llantas = $("mantenimientoLlantas").value;
            
            guardarParametrosMantenimiento(aceite, bujia, llantas);
            renderMantenimientoUI();
            alert("Configuración de Mantenimiento guardada.");
        };
    }
    
    // Llamar a renderizar el mantenimiento al final de la inicialización del Admin
    renderMantenimientoUI();

    // ... (Resto de listeners se mantiene igual) ...
};

// Exportar renderMantenimientoUI para el init
export { renderMantenimientoUI };
// ... (omitted for brevity: renderTurnoUI, renderMetaDiaria, renderDashboard, etc.) ...
