// 05_init.js
// =====================================
// INIT GLOBAL — NO DEPENDE DE LA PÁGINA
// =====================================

import { renderGlobalMenu } from "./03_render.js";

document.addEventListener("DOMContentLoaded", () => {
  // 🔒 El menú SIEMPRE se inicializa
  renderGlobalMenu();
});
