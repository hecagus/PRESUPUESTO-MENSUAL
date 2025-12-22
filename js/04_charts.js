/* 04_charts.js */
import { getState } from "./02_data.js";

export const initCharts = () => {
  if (typeof Chart === "undefined") return;
  const ctx = document.getElementById("grafica");
  if (!ctx) return;

  const turnos = getState().turnos.slice(-7);

  new Chart(ctx, {
    type: "bar",
    data: {
      labels: turnos.map((t) =>
        new Date(t.fecha).toLocaleDateString(undefined, { weekday: "short" })
      ),
      datasets: [
        {
          data: turnos.map((t) => t.ganancia),
          backgroundColor: "#2563eb",
          borderRadius: 5
        }
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } }
    }
  });
};
