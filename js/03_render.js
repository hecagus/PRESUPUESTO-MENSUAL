/* 03_render.js */
import { $, fmtMoney, formatearFecha } from "./01_consts_utils.js";
import { getState, getTurnoActivo } from "./02_data.js";

export const renderGlobalMenu = () => {
  const container = document.querySelector(".header-actions");
  if (!container || container.dataset.ready) return;
  container.dataset.ready = "1";

  container.innerHTML = `
    <nav class="nav">
      <a href="index.html" id="nav-index">📊</a>
      <a href="wallet.html" id="nav-wallet">💰</a>
      <a href="admin.html" id="nav-admin">⚙️</a>
      <a href="historial.html" id="nav-historial">📜</a>
    </nav>
  `;

  const page = document.body.dataset.page;
  const link = document.getElementById(`nav-${page}`);
  if (link) link.classList.add("active");
};

export const renderAdminUI = () => {
  const t = getTurnoActivo();

  if ($("turnoTexto")) {
    $("turnoTexto").innerText = t ? "🟢 Turno activo" : "🔴 Sin turno";
    $("btnIniciarTurno").style.display = t ? "none" : "block";
    $("btnFinalizarTurno").style.display = t ? "block" : "none";
  }

  if ($("metaDiariaDisplay")) {
    $("metaDiariaDisplay").innerText = `$${fmtMoney(
      getState().parametros.gastoFijo
    )}`;
  }

  const ul = $("listaDeudas");
  const sel = $("abonoSeleccionar");

  if (ul && sel) {
    ul.innerHTML = "";
    sel.innerHTML = "";
    getState().deudas.forEach((d) => {
      if (d.saldo > 0) {
        ul.innerHTML += `<li>${d.desc}: <b>$${fmtMoney(d.saldo)}</b></li>`;
        sel.add(new Option(d.desc, d.id));
      }
    });
  }
};

export const renderDashboard = (stats) => {
  $("resHoras").innerText = stats.horas.toFixed(1) + "h";
  $("resGananciaBruta").innerText = "$" + fmtMoney(stats.ganancia);
  $("dashboardMeta").innerText = "$" + fmtMoney(stats.meta);
  $("progresoTexto").innerText = stats.progreso.toFixed(0) + "%";
  $("progresoBarra").style.width =
    Math.min(stats.progreso, 100).toFixed(0) + "%";

  const tbody = $("tablaTurnos");
  if (!tbody) return;

  tbody.innerHTML = stats.turnosRecientes
    .map(
      (t) => `
    <tr>
      <td>${formatearFecha(t.fecha)}</td>
      <td>${t.horas.toFixed(1)}</td>
      <td>${t.km}</td>
      <td>$${fmtMoney(t.ganancia)}</td>
    </tr>`
    )
    .join("");
};

export const renderHistorial = () => {
  const tbody = $("historialBody");
  if (!tbody) return;

  tbody.innerHTML = getState().movimientos
    .slice()
    .reverse()
    .map(
      (m) => `
    <tr>
      <td>${formatearFecha(m.fecha)}</td>
      <td>${m.desc}</td>
      <td>${m.categoria || "-"}</td>
      <td>$${fmtMoney(m.monto)}</td>
    </tr>`
    )
    .join("");
};

export const renderWallet = () => {
  const s = getState();
  const dia = new Date().getDate();

  const esperado = s.parametros.gastoFijo * dia;
  const real = s.movimientos.reduce(
    (a, m) => a + (m.tipo === "ingreso" ? m.monto : -m.monto),
    0
  );

  $("walletEsperado").innerText = `$${fmtMoney(esperado)}`;
  $("walletReal").innerText = `$${fmtMoney(real)}`;
  $("walletGas").innerText = `$${fmtMoney(
    s.parametros.costoKmPromedio
  )} / km`;
};
