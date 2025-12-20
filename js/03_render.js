
import { $, fmtMoney, formatearFecha, isSameDay, safeNumber } from "./01_consts_utils.js";
import { getState } from "./02_data.js";

export function renderDashboard() {
  const s = getState();
  const hoy = new Date();

  const turnosHoy = s.turnos.filter(t => isSameDay(t.fecha, hoy));
  const bruto = turnosHoy.reduce((a, b) => a + b.dineroGenerado, 0);
  const horas = turnosHoy.reduce((a, b) => a + b.horas, 0);

  if ($("resGananciaBruta")) $("resGananciaBruta").innerText = `$${fmtMoney(bruto)}`;
  if ($("resHoras")) $("resHoras").innerText = `${horas.toFixed(2)}h`;
}

export function renderWalletUI() {
  const s = getState();
  let html = "";

  s.deudas.forEach(d => {
    html += `<p><strong>${d.desc}</strong>: $${fmtMoney(d.saldo)}</p>`;
  });

  if ($("walletInfo")) $("walletInfo").innerHTML = html;
}

export function renderHistorialUI() {
  const s = getState();
  if (!$("historial")) return;

  $("historial").innerHTML = s.movimientos
    .slice()
    .reverse()
    .map(m => `<p>${formatearFecha(m.fecha)} — ${m.desc} — $${fmtMoney(m.monto)}</p>`)
    .join("");
}
