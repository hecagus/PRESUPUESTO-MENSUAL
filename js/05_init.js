// 05_init.js
import { loadAdminData } from "./02_data.js";
import {
  renderGlobalMenu,
  initAdminRender,
  initHistorialRender
} from "./03_render.js";

document.addEventListener("DOMContentLoaded", () => {
  loadAdminData();
  renderGlobalMenu();

  const page = document.body.dataset.page;

  if (page === "admin") initAdminRender();
  if (page === "historial") initHistorialRender();
});
