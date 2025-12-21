// 03_render.js
import {
  iniciarTurno,
  finalizarTurno,
  registrarIngresoExtra,
  registrarGasto,
  registrarGasolina,
  registrarDeuda,
  registrarAbono,
  getState
} from "./02_data.js";

const $ = id => document.getElementById(id);

/* ======================
   MENÚ
====================== */
export function renderGlobalMenu() {
  if ($("menuToggle")) return;

  const btn = document.createElement("button");
  btn.id = "menuToggle";
  btn.textContent = "☰";

  const nav = document.createElement("nav");
  nav.className = "menu";
  nav.innerHTML = `
    <a href="index.html">Inicio</a>
    <a href="admin.html">Admin</a>
    <a href="historial.html">Historial</a>
  `;

  document.body.prepend(btn);
  document.body.appendChild(nav);

  btn.onclick = () => nav.classList.toggle("show");
}

/* ======================
   ADMIN
====================== */
export function initAdminRender() {
  renderGlobalMenu();

  $("btnIniciarTurno")?.addEventListener("click", () => {
    iniciarTurno();
    $("turnoTexto").textContent = "🟢 Turno en curso";
  });

  $("btnGuardarTurno")?.addEventListener("click", () => {
    finalizarTurno({
      kmFinal: $("kmFinal").value,
      ganancia: $("gananciaTurno").value
    });
    $("turnoTexto").textContent = "🔴 Sin turno activo";
    $("cierreTurno").style.display = "none";
  });

  $("btnGuardarIngresoExtra")?.addEventListener("click", () =>
    registrarIngresoExtra(
      $("ingresoExtraDesc").value,
      $("ingresoExtraMonto").value
    )
  );

  $("btnGuardarGasto")?.addEventListener("click", () =>
    registrarGasto(
      $("gastoDesc").value,
      $("gastoMonto").value
    )
  );

  $("btnGuardarGasolina")?.addEventListener("click", () =>
    registrarGasolina(
      $("litrosGasolina").value,
      $("costoGasolina").value,
      $("kmGasolina").value
    )
  );

  $("btnGuardarDeuda")?.addEventListener("click", () =>
    registrarDeuda(
      $("deudaNombre").value,
      $("deudaMonto").value,
      $("deudaCuota").value
    )
  );

  $("btnRegistrarAbono")?.addEventListener("click", () =>
    registrarAbono(
      $("abonoDeudaSelect").value,
      $("abonoMonto").value
    )
  );
}
