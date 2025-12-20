// 05_init.js
import { loadData } from "./02_data.js";
import { renderDashboard, renderWallet } from "./03_render.js";
import { initCharts } from "./04_charts.js";

document.addEventListener("DOMContentLoaded", () => {
    loadData();
    renderDashboard();
    renderWallet();
    initCharts();
});
