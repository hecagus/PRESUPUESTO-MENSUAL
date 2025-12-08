// 03_render.js

// ... (imports) ...

// --- ADMIN: INTERFAZ DE ODÓMETRO Y COSTO POR KM ---
export const renderOdometroUI = () => {
    const lblKm = $("lblKmAnterior");
    const inputKm = $("inputOdometro");
    const costoKmDisplay = $("costoPorKmDisplay"); 

    if (!lblKm) return; // Guard Clause

    const state = getState();
    lblKm.innerText = `${state.parametros.ultimoKM} km`;
    
    inputKm.placeholder = state.parametros.ultimoKM > 0 ? `Mayor a ${state.parametros.ultimoKM}` : "Ingresa KM Inicial";

    // Mostrar Costo por KM (LEER VALOR DE STATE)
    if (costoKmDisplay) {
        const costo = state.parametros.costoPorKm;
        // Si el costo es mayor a $0.001, lo mostramos formateado. Si no, mostramos "Calculando..."
        if (costo > 0.001) {
            costoKmDisplay.innerText = `$${fmtMoney(costo)}`;
        } else {
            // Esto se mostrará hasta que haya al menos dos cargas válidas.
            costoKmDisplay.innerText = "Calculando..."; 
        }
    }
};

// ... (resto de funciones) ...
