// 04_charts.js
import { $, } from "./01_consts_utils.js";
import { getState } from "./02_data.js";

export const initCharts = () => {
    const canvas = $("graficaGanancias");
    if (!canvas || typeof Chart === "undefined") return;

    const data = getState().turnos.slice(-14);

    new Chart(canvas, {
        type: "bar",
        data: {
            labels: data.map(t => new Date(t.fecha).toLocaleDateString()),
            datasets: [{
                data: data.map(t => t.ganancia)
            }]
        }
    });
};
