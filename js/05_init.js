// 05_init.js
import { initAdminRender } from "./03_render.js";

document.addEventListener("DOMContentLoaded", () => {
  if (document.body.dataset.page === "admin") {
    initAdminRender();
  }
});
