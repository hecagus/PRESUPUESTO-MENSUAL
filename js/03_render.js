/* 03_render.js (AJUSTADO – SIN HEADER MENU, SOLO DATOS) */
import { $, fmtMoney, formatearFecha } from "./01_consts_utils.js";
import { getState, getTurnoActivo } from "./02_data.js";

export const renderAdminUI = () => {
  const t = getTurnoActivo();

  if ($("turnoTexto")) {
    $("turnoTexto").innerText = t ? "🟢 Turno activo" : "🔴 Sin turno";
    $("btnIniciarTurno").style.display = t ? "none" : "block";
    $("btnFinalizarTurno").style.display = t ? "block" : "none";
  }

  if ($("metaDiariaDisplay")) {
    $("metaDiariaDisplay").innerText =
      `$${fmtMoney(getState().parametros.gastoFijo)}`;
  }
};

export const renderDashboard = (stats) => {
  if (!stats) return;

  $("resHoras").innerText = stats.horas.toFixed(1) + "h";
  $("resGananciaBruta").innerText = "$" + fmtMoney(stats.ganancia);
  $("dashboardMeta").innerText = "$" + fmtMoney(stats.meta);
  $("progresoTexto").innerText = stats.progreso.toFixed(0) + "%";
  $("progresoBarra").style.width =
    Math.min(stats.progreso, 100) + "%";

  const tbody = $("tablaTurnos");
  tbody.innerHTML = stats.turnosRecientes.map(t => `
    <tr>
      <td>${formatearFecha(t.fecha)}</td>
      <td>${t.horas.toFixed(1)}</td>
      <td>${t.km}</td>
      <td>$${fmtMoney(t.ganancia)}</td>
    </tr>
  `).join("");
};
