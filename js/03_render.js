// 03_render.js
import { $, fmtMoney, CATEGORIAS_GASTOS } from './01_consts_utils.js'; // <--- IMPORTANTE: CATEGORIAS_GASTOS AÑADIDO
import { getState, getTurnoActivo, iniciarTurnoLogic, finalizarTurnoLogic, recalcularMetaDiaria, registrarCargaGasolina, actualizarOdometroManual, agregarDeuda, agregarGasto, agregarGastoFijo } from './02_data.js'; // <--- IMPORTANTE: agregarGasto y agregarGastoFijo AÑADIDOS

// ... (Tus funciones renderTurnoUI, renderOdometroUI, renderMetaDiaria, renderDashboard siguen igual) ...

// --- NUEVA FUNCIÓN: Llenar Select de Categorías ---
const llenarCategorias = (tipo) => {
    const select = $("gastoCategoriaSelect");
    const inputManual = $("gastoCategoriaManual");
    if (!select) return;

    select.innerHTML = ""; // Limpiar
    inputManual.style.display = "none"; // Ocultar manual por defecto

    // Obtener lista según tipo (moto/hogar)
    const lista = CATEGORIAS_GASTOS[tipo] || [];

    lista.forEach(cat => {
        const option = document.createElement("option");
        option.value = cat;
        option.text = cat;
        select.appendChild(option);
    });

    // Detectar si seleccionan "Otro/Nuevo"
    select.onchange = () => {
        if (select.value.includes("Otro / Nuevo")) {
            inputManual.style.display = "block";
            inputManual.focus();
        } else {
            inputManual.style.display = "none";
        }
    };
};


export const setupAdminListeners = () => {
    if (!$("btnIniciarTurno")) return; 

    // ... (Listeners de Turno y Odómetro siguen igual) ...

    // === LÓGICA DE GASTOS INTELIGENTES (NUEVA) ===
    
    // 1. Inicializar Select (Por defecto Moto)
    llenarCategorias("moto");

    // 2. Cambio de Radio (Moto vs Hogar)
    const radiosTipo = document.getElementsByName("gastoTipoRadio");
    radiosTipo.forEach(radio => {
        radio.addEventListener("change", (e) => {
            llenarCategorias(e.target.value);
        });
    });

    // 3. Checkbox "Es Recurrente"
    const checkRecurrente = $("checkEsRecurrente");
    const divFrecuencia = $("divFrecuenciaGasto");
    if (checkRecurrente) {
        checkRecurrente.onchange = () => {
            divFrecuencia.style.display = checkRecurrente.checked ? "block" : "none";
        };
    }

    // 4. Botón Guardar Gasto
    $("btnRegistrarGasto").onclick = () => {
        const selectCat = $("gastoCategoriaSelect");
        const inputManual = $("gastoCategoriaManual");
        const monto = $("gastoCantidad").value;
        const desc = $("gastoDescripcion").value;
        const esRecurrente = $("checkEsRecurrente").checked;
        
        // Validar categoría final
        let categoriaFinal = selectCat.value;
        if (categoriaFinal.includes("Otro") && inputManual.value.trim() !== "") {
            categoriaFinal = inputManual.value.trim(); // Usar lo que escribió el usuario
        }

        if (!monto || Number(monto) <= 0) return alert("Ingresa un monto válido.");

        const datosGasto = {
            id: Date.now(),
            fecha: new Date().toISOString(),
            categoria: categoriaFinal,
            monto: Number(monto),
            desc: desc,
            tipo: document.querySelector('input[name="gastoTipoRadio"]:checked').value // 'moto' o 'hogar'
        };

        if (esRecurrente) {
            // SI ES RECURRENTE (Luz, Renta, etc.) -> Va a Gastos Fijos y Recalcula Meta
            datosGasto.frecuencia = $("gastoFrecuenciaSelect").value;
            // Importante: agregarGastoFijo debe estar exportada en 02_data.js
            agregarGastoFijo(datosGasto); 
            alert(`Gasto Fijo "${categoriaFinal}" agregado. Tu Meta Diaria ha subido.`);
        } else {
            // SI ES ESPORÁDICO (Talachero, Coca, etc.) -> Gasto simple
            datosGasto.frecuencia = "No Recurrente";
            agregarGasto(datosGasto);
            alert("Gasto registrado.");
        }

        // Limpiar formulario
        $("gastoCantidad").value = "";
        $("gastoDescripcion").value = "";
        $("gastoCategoriaManual").value = "";
        inputManual.style.display = "none";
        checkRecurrente.checked = false;
        divFrecuencia.style.display = "none";
        selectCat.selectedIndex = 0;
        
        // Actualizar visualización de Meta Diaria por si cambió
        if(esRecurrente) window.location.reload(); 
    };

    // ... (Listeners de Deudas y Gasolina siguen igual) ...
};
