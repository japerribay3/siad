// js/dashboard.js
// Lógica del panel de usuario (dashboard)

import {
  isLoggedIn,
  getSession,
  clearSession,
  getRoomsByOwner
} from "./db.js";

document.addEventListener("DOMContentLoaded", async () => {
  // 1) Proteger el dashboard: sólo usuarios logueados
  if (!isLoggedIn()) {
    window.location.replace("login.html");
    return;
  }

  const session = getSession();
  console.log("Sesión:", session); // 👈 para depuración

  // Header usuario + logout
  renderHeaderUser(session);

  setupNavMenus();
  await updatePropietarioColumn(session);
});



/**
 * Pinta en #loginBox la info del usuario y el botón Logout
 */
function renderHeaderUser(session) {
  const loginBox = document.getElementById("loginBox");
  if (!loginBox) return;

  if (!session) {
    // Por seguridad, si algo raro pasa → a login
    loginBox.innerHTML = `<a href="login.html" class="vb-login-btn">Login</a>`;
    return;
  }

  const nombre = session.nombre || session.email || "";
  const foto = session.foto || session.fotoBase64 || "";

  const avatarHtml = foto
    ? `<img src="${foto}" alt="Avatar" />`
    : "";

  loginBox.innerHTML = `
    <div class="header-user">
      ${avatarHtml}
      <span>Hola, ${nombre}</span>
      <button id="logoutBtn" class="vb-login-btn">Logout</button>
    </div>
  `;

  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      try {
        // Usamos clearSession de db.js si existe, si no, vaciamos sessionStorage
        if (typeof clearSession === "function") {
          clearSession();
        } else {
          sessionStorage.clear();
        }
      } catch (e) {
        console.error("[dashboard] Error limpiando sesión:", e);
        sessionStorage.clear();
      }
      window.location.replace("index.html");
    });
  }
}

/**
 * Muestra u oculta la columna "Propietario"
 * según si el usuario tiene habitaciones registradas.
 */
async function updatePropietarioColumn(session) {
  const colProp = document.getElementById("col-propietario");
  if (!colProp || !session?.email) return;

  try {
    const rooms = await getRoomsByOwner(session.email);
    const hasRooms = Array.isArray(rooms) && rooms.length > 0;

    colProp.style.display = hasRooms ? "block" : "none";
    // Si quieres que mantenga el layout flex, también valdría:
    // colProp.style.display = hasRooms ? "flex" : "none";
  } catch (err) {
    console.error("[dashboard] Error comprobando habitaciones del propietario:", err);
    // En caso de error, por prudencia se oculta la columna
    colProp.style.display = "none";
  }
}

/**
 * Gestiona los desplegables del menú superior del dashboard
 * (Consultar / Habitaciones / Ver / Propietario)
 */
function setupNavMenus() {
  const colButtons = document.querySelectorAll(".nav-col-btn");
  if (!colButtons.length) return;

  colButtons.forEach((btn) => {
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      const col = btn.closest(".nav-col");
      if (!col) return;

      const isOpen = col.classList.contains("open");

      // Cerrar todos
      document.querySelectorAll(".nav-col").forEach((c) => c.classList.remove("open"));

      // Abrir sólo el que se ha pulsado si antes estaba cerrado
      if (!isOpen) col.classList.add("open");
    });
  });

  // Cerrar menús si se hace click fuera de la barra
  document.addEventListener("click", (ev) => {
    if (!ev.target.closest(".dash-nav-inner")) {
      document.querySelectorAll(".nav-col").forEach((c) =>
        c.classList.remove("open")
      );
    }
  });
}
