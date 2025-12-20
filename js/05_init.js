// 05_init.js
import { loadData } from "./02_data.js";
import {
  renderGlobalMenu,
  initAdminRender
} from "./03_render.js";

document.addEventListener("DOMContentLoaded", () => {
  loadData();

  // 🔥 MENÚ GLOBAL SIEMPRE
  renderGlobalMenu();

  const page = document.body.dataset.page;

  if (page === "admin") {
    initAdminRender();
  }
});
