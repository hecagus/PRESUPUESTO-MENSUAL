// 03_render.js
import { $, fmtMoney } from "./01_consts_utils.js";
import {
  getState,
  getTurnoActivo,
  iniciarTurno,
  finalizarTurno,
  agregarGasto,
  agregarDeuda,
  getWalletData
} from "./02_data.js";

/* =========================
   UTILIDADES
========================= */
const show = (el) => { if (el) el.style.display = ""; };
const hide = (el) => { if (el) el.style.display = "none"; };

/* =========================
   TURNO
========================= */
export const renderTurnoUI = () => {
  const turnoTexto = $("turnoTexto");
  const btnIniciar = $("btnIniciarTurno");
  const btnFinalizar = $("btnFinalizarTurno");
  const cierre = $("cierreTurnoContainer");

  if (!turnoTexto || !btnIniciar || !btnFinalizar) return;

  const activo = getTurnoActivo();

  if (activo) {
    turnoTexto.textContent = "🟢 Turno en curso";
    hide(btnIniciar);
    show(btnFinalizar);
    show(cierre);
  } else {
    turnoTexto.textContent = "🔴 Sin turno activo";
    show(btnIniciar);
    hide(btnFinalizar);
    hide(cierre);
  }
};

export const setupTurnoListeners = () => {
  const btnIniciar = $("btnIniciarTurno");
  const btnFinalizar = $("btnFinalizarTurno");
  const btnGuardar = $("btnGuardarCierre");

  btnIniciar?.addEventListener("click", () => {
    iniciarTurno();
    renderTurnoUI();
  });

  btnFinalizar?.addEventListener("click", () => {
    show($("cierreTurnoContainer"));
  });

  btnGuardar?.addEventListener("click", () => {
    const km = $("inpKmFinal")?.value;
    const ganancia = $("inpGanancia")?.value;

    finalizarTurno(ganancia, km);
    renderTurnoUI();
  });
};

/* =========================
   INGRESOS / GASTOS
========================= */
export const setupGastosListeners = () => {
  $("btnGuardarIngreso")?.addEventListener("click", () => {
    const desc = $("ingresoDescripcion")?.value || "Ingreso";
    const monto = $("ingresoCantidad")?.value;

    agregarGasto({
      fecha: new Date().toISOString(),
      categoria: desc,
      monto,
      tipo: "ingreso"
    });
  });

  $("btnGuardarGasto")?.addEventListener("click", () => {
    agregarGasto({
      fecha: new Date().toISOString(),
      categoria: $("gastoCategoria")?.value,
      monto: $("gastoCantidad")?.value,
      tipo: "gasto"
    });
  });
};

/* =========================
   DEUDAS
========================= */
export const renderDeudas = () => {
  const lista = $("listaDeudas");
  const selector = $("abonoSeleccionar");
  if (!lista || !selector) return;

  lista.innerHTML = "";
  selector.innerHTML = "";

  const { deudas } = getState();

  deudas.forEach((d, i) => {
    const li = document.createElement("li");
    li.textContent = `${d.desc} — $${fmtMoney(d.saldo)}`;
    lista.appendChild(li);

    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = d.desc;
    selector.appendChild(opt);
  });
};

export const setupDeudaListeners = () => {
  $("btnRegistrarDeudaFinal")?.addEventListener("click", () => {
    agregarDeuda({
      desc: $("deudaNombre")?.value,
      saldo: $("deudaMontoTotal")?.value,
      montoCuota: $("deudaMontoCuota")?.value,
      frecuencia: $("deudaFrecuencia")?.value
    });
    renderDeudas();
  });
};

/* =========================
   WALLET (RESUMEN)
========================= */
export const renderWalletResumen = () => {
  const data = getWalletData();
  const el = $("walletResumen");
  if (!el) return;

  el.textContent = `Disponible: $${fmtMoney(data.totales.disponible)}`;
};

/* =========================
   INIT GENERAL
========================= */
export const initAdminRender = () => {
  renderTurnoUI();
  renderDeudas();
  renderWalletResumen();

  setupTurnoListeners();
  setupGastosListeners();
  setupDeudaListeners();
};
