// 03_render.js
// =====================================
// RENDER GLOBAL — BOTÓN HAMBURGUESA
// FUENTE DE LA VERDAD (NO TOCAR)
// =====================================

let menuInitialized = false;

export function renderGlobalMenu() {
  // 🔒 Blindaje absoluto: solo una vez
  if (menuInitialized) return;
  menuInitialized = true;

  // Esperar a que exista el header
  const header = document.querySelector(".header");
  if (!header) {
    console.warn("⚠️ No hay .header, menú no renderizado");
    return;
  }

  // Crear botón
  const btn = document.createElement("button");
  btn.id = "menuToggle";
  btn.setAttribute("aria-label", "Abrir menú");
  btn.textContent = "☰";

  // Crear menú
  const nav = document.createElement("nav");
  nav.id = "globalMenu";
  nav.className = "menu hidden";
  nav.innerHTML = `
    <a href="index.html">Inicio</a>
    <a href="admin.html">Admin</a>
    <a href="historial.html">Historial</a>
  `;

  // Insertar en DOM
  header.appendChild(btn);
  document.body.appendChild(nav);

  // Estado interno
  let open = false;

  // Toggle menú
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    open = !open;
    nav.classList.toggle("hidden", !open);
  });

  // Cerrar al hacer click fuera
  document.addEventListener("click", () => {
    if (!open) return;
    open = false;
    nav.classList.add("hidden");
  });

  console.log("✅ Menú hamburguesa inicializado (blindado)");
}

// Stub seguro (no rompe imports)
export function initAdminRender() {
  /* Admin se conecta después */
}

export function initHistorialRender() {
  /* Historial se conecta después */
}
