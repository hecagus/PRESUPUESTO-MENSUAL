// 03_render.js
// =====================================
// MENÚ HAMBURGUESA GLOBAL (BLINDADO)
// =====================================

let menuInitialized = false;

export function renderGlobalMenu() {
  if (menuInitialized) return;
  menuInitialized = true;

  const header = document.querySelector(".header");
  if (!header) return;

  // BOTÓN
  const btn = document.createElement("button");
  btn.id = "menuToggle";
  btn.textContent = "☰";
  btn.style.position = "absolute";
  btn.style.top = "16px";
  btn.style.right = "16px";
  btn.style.fontSize = "28px";
  btn.style.background = "transparent";
  btn.style.border = "none";
  btn.style.color = "#fff";
  btn.style.cursor = "pointer";
  btn.style.zIndex = "1001";

  // MENÚ
  const nav = document.createElement("nav");
  nav.id = "globalMenu";
  nav.style.position = "fixed";
  nav.style.top = "0";
  nav.style.right = "0";
  nav.style.width = "220px";
  nav.style.height = "100%";
  nav.style.background = "#111";
  nav.style.display = "none";
  nav.style.flexDirection = "column";
  nav.style.padding = "20px";
  nav.style.zIndex = "1000";

  nav.innerHTML = `
    <a href="index.html" style="color:#fff;margin:10px 0;">Inicio</a>
    <a href="admin.html" style="color:#fff;margin:10px 0;">Admin</a>
    <a href="historial.html" style="color:#fff;margin:10px 0;">Historial</a>
  `;

  header.style.position = "relative";
  header.appendChild(btn);
  document.body.appendChild(nav);

  let open = false;

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    open = !open;
    nav.style.display = open ? "flex" : "none";
  });

  document.addEventListener("click", () => {
    if (!open) return;
    open = false;
    nav.style.display = "none";
  });

  console.log("✅ Menú hamburguesa VISIBLE y funcional");
}

// Stubs seguros
export function initAdminRender() {}
export function initHistorialRender() {}
