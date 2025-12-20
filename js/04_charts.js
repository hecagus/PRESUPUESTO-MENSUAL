import { $ } from "./01_consts_utils.js";
import { getState } from "./02_data.js";

export function initCharts() {
  if (typeof Chart === "undefined") return;
  const ctx = $("chartGanancias");
  if (!ctx) return;

  const s = getState();

  new Chart(ctx, {
    type: "bar",
    data: {
      labels: s.turnos.map((_, i) => `T${i + 1}`),
      datasets: [{
        label: "Ingresos",
        data: s.turnos.map(t => t.dineroGenerado)
      }]
    }
  });
}
