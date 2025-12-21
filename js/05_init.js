// 05_init.js
import { loadData } from "./02_data.js";
import {
  initAdminRender,
  initHistorialRender,
  renderGlobalMenu
} from "./03_render.js";

document.addEventListener("DOMContentLoaded", () => {
  loadData();
  renderGlobalMenu();

  const page = document.body.dataset.page;

  if (page === "admin") initAdminRender();
  if (page === "historial") initHistorialRender();
});
