// 03_render.js
import { $, formatMoney } from "./01_consts_utils.js";
import { getState, saveState } from "./02_data.js";

/* -----------------------------------
   🔵  Render turno
----------------------------------- */
export function renderTurnoUI() {
    if (document.body.dataset.page !== "admin") return;

    const lbl = $("turnoTexto");
    const btnIniciar = $("btnIniciarTurno");
    const btnFinalizar = $("btnPreFinalizarTurno");
    const cierreBox = $("cierreTurnoContainer");

    if (!lbl || !btnIniciar || !btnFinalizar) return;

    const state = getState();
    const activo = state.turnoActivo;

    if (!activo) {
        lbl.textContent = "🔴 Sin turno activo";
        btnIniciar.style.display = "block";
        btnFinalizar.style.display = "none";
        cierreBox.style.display = "none";
        return;
    }

    lbl.textContent = `🟢 Turno activo – KM inicio: ${activo.kmInicio}`;
    btnIniciar.style.display = "none";
    btnFinalizar.style.display = "block";
}

/* -----------------------------------
   🔵  Render odómetro
----------------------------------- */
export function renderOdometroUI() {
    if (document.body.dataset.page !== "admin") return;

    const lblKm = $("lblKmAnterior");
    const estado = $("lblEstadoOdometro");

    if (!lblKm || !estado) return;

    const state = getState();
    lblKm.textContent = state.kmActual ?? 0;
    estado.textContent = "OK";
}

/* -----------------------------------
   🔵 Render Meta Diaria
----------------------------------- */
export function renderMetaDiaria() {
    if (document.body.dataset.page !== "admin") return;

    const display = $("metaDiariaDisplay");
    if (!display) return;

    const state = getState();
    display.textContent = formatMoney(state.metaDiaria || 0);
}

/* -----------------------------------
   🔵 Render Mantenimiento
----------------------------------- */
export function renderMantenimientoUI() {
    if (document.body.dataset.page !== "admin") return;

    const state = getState();

    const aceite = $("mantenimientoAceite");
    const bujia = $("mantenimientoBujia");
    const llantas = $("mantenimientoLlantas");

    if (!aceite || !bujia || !llantas) return;

    aceite.value = state.mantenimiento?.aceite || "";
    bujia.value = state.mantenimiento?.bujia || "";
    llantas.value = state.mantenimiento?.llantas || "";
}

/* -----------------------------------
   🟣 Render dashboard (index)
----------------------------------- */
export function renderDashboard() {
    if (document.body.dataset.page !== "index") return;

    // Aquí va el render del panel principal...
    // Suficiente con no reventar si no existen elementos.
}

/* -----------------------------------
   🟣 Render historial
----------------------------------- */
export function renderHistorial() {
    if (document.body.dataset.page !== "historial") return;

    const container = $("listaHistorial");
    if (!container) return;

    const state = getState();

    container.innerHTML = state.turnos
        .map(t => `<div class="historial-item">
                    <strong>${new Date(t.fecha).toLocaleDateString()}</strong> – 
                    ${formatMoney(t.ganancia)}
                </div>`)
        .join("");
}

/* -----------------------------------
   ⚙️ Listeners (solo admin)
----------------------------------- */
export function setupAdminListeners() {
    if (document.body.dataset.page !== "admin") return;

    const safe = id => $(id) || null;

    const btnIniciar = safe("btnIniciarTurno");
    const btnPreFinalizar = safe("btnPreFinalizarTurno");
    const btnConfirmarFinalizar = safe("btnConfirmarFinalizar");
    const btnCancelarCierre = safe("btnCancelarCierre");
    const btnActualizarOdometro = safe("btnActualizarOdometro");

    // --- evitar errores ---
    if (btnIniciar) btnIniciar.addEventListener("click", () => {
        const state = getState();
        state.turnoActivo = {
            fecha: Date.now(),
            kmInicio: state.kmActual
        };
        saveState();
        renderTurnoUI();
    });

    if (btnPreFinalizar) btnPreFinalizar.addEventListener("click", () => {
        $("cierreTurnoContainer").style.display = "block";
    });

    if (btnCancelarCierre) btnCancelarCierre.addEventListener("click", () => {
        $("cierreTurnoContainer").style.display = "none";
    });

    if (btnConfirmarFinalizar) btnConfirmarFinalizar.addEventListener("click", () => {
        const state = getState();
        const monto = Number($("gananciaBruta").value || 0);

        if (!state.turnoActivo) return;

        state.turnos.push({
            fecha: Date.now(),
            kmInicio: state.turnoActivo.kmInicio,
            kmFin: state.kmActual,
            ganancia: monto
        });

        state.turnoActivo = null;
        saveState();

        $("cierreTurnoContainer").style.display = "none";
        renderTurnoUI();
    });

    if (btnActualizarOdometro) btnActualizarOdometro.addEventListener("click", () => {
        const state = getState();
        const val = Number($("inputOdometro").value);
        if (!val) return;
        state.kmActual = val;
        saveState();
        renderOdometroUI();
    });
}
