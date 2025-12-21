// 05_init.js
import { initAdminRender, renderGlobalMenu } from "./03_render.js";

document.addEventListener("DOMContentLoaded", () => {
  // Menú SIEMPRE
  renderGlobalMenu();

  const page = document.body.dataset.page;

  if (page === "admin") {
    initAdminRender();
  }
});
