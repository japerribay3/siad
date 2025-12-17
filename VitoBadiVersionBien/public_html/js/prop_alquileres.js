// js/prop_alquileres.js
// Vista de propietario: alquileres de mis habitaciones

import {
  isLoggedIn,
  getSession,
  clearSession,
  getRoomsByOwner,
  getAllRentals,
  getRoomById,
  getUserByEmail
} from "./db.js";

document.addEventListener("DOMContentLoaded", async () => {
  if (!isLoggedIn()) {
    window.location.replace("login.html");
    return;
  }

  const session = getSession();
  renderHeaderUser(session);

  try {
    await loadOwnerRentals(session);
  } catch (err) {
    console.error("[prop_alquileres] Error al cargar:", err);
    const container = document.getElementById("propAlquileresContainer");
    if (container) {
      container.innerHTML = `<p class="error">Error al cargar los alquileres de tus habitaciones.</p>`;
    }
  }
});

/* ============================================================
   HEADER USUARIO
============================================================ */
function renderHeaderUser(session) {
  const loginBox = document.getElementById("loginBox");
  if (!loginBox) return;

  if (!session) {
    loginBox.innerHTML = `<a href="login.html" class="vb-login-btn">Login</a>`;
    return;
  }

  const nombre = session.nombre || session.email;
  const foto = session.foto || session.fotoBase64 || "";

  const avatar = foto
    ? `<img src="${foto}" alt="Avatar" class="header-user-avatar">`
    : "";

  loginBox.innerHTML = `
    <div class="header-user">
      ${avatar}
      <span class="vb-header-username">${nombre}</span>
      <button id="logoutBtn" class="vb-login-btn">Logout</button>
    </div>
  `;

  document.getElementById("logoutBtn")?.addEventListener("click", () => {
    clearSession();
    window.location.replace("login.html");
  });
}

/* ============================================================
   CARGAR ALQUILERES DE MIS HABITACIONES
============================================================ */
async function loadOwnerRentals(session) {
  const container = document.getElementById("propAlquileresContainer");
  const emptyMsg  = document.getElementById("propAlquileresEmpty");

  if (!container || !session?.email) return;

  container.innerHTML = `<p class="loading-msg">Cargando alquileres…</p>`;
  if (emptyMsg) emptyMsg.style.display = "none";

  // 1) Habitaciones del propietario + todos los alquileres
  const [rooms, rentals] = await Promise.all([
    getRoomsByOwner(session.email),
    getAllRentals()
  ]);

  const habs = (rooms || []).filter(r => !r.deletedAt);
  if (!habs.length) {
    container.innerHTML = "";
    if (emptyMsg) emptyMsg.style.display = "block";
    return;
  }

  const idsProp = new Set(habs.map(r => r.idHabi));

  // 2) Filtrar alquileres de mis habitaciones
  let myRentals = (rentals || []).filter(r => idsProp.has(r.idHabi));

  if (!myRentals.length) {
    container.innerHTML = "";
    if (emptyMsg) emptyMsg.style.display = "block";
    return;
  }

  // 3) Separar activos y finalizados
  const activos = myRentals.filter(r => r.activo);
  const finalizados = myRentals.filter(r => !r.activo);

  // Ordenar:
  //   - activos: por fecha de inicio (más reciente primero)
  //   - finalizados: por fecha de fin de alquiler (más reciente primero)
  activos.sort((a, b) => (b.fInicio || 0) - (a.fInicio || 0));
  finalizados.sort((a, b) => (b.fFin || 0) - (a.fFin || 0));

  const ordenados = [...activos, ...finalizados];

  container.innerHTML = "";

  for (const rental of ordenados) {
    const card = await buildRentalCard(rental);
    container.appendChild(card);
  }
}

/* ============================================================
   CARD DE CADA ALQUILER (vista propietario)
============================================================ */
async function buildRentalCard(rental) {
  const card = document.createElement("article");
  card.className = "alquiler-card prop-alquiler-card";

  // Datos de la habitación
  let room = null;
  try {
    room = await getRoomById(rental.idHabi);
  } catch (e) {
    console.warn("[prop_alquileres] No se ha podido leer la habitación", rental.idHabi, e);
  }

  const ciudad    = room?.ciudad || "Ciudad desconocida";
  const direccion = room?.direccion || "Dirección no disponible";
  const precio    = typeof room?.precio === "number" ? `${room.precio} €/mes` : "Precio —";
  const img       = room?.imagenBase64 || "./fotos/habitacion1.jpg";

  // Datos del inquilino
  const emailInqui = rental.emailInqui || "";
  let inquiName = "";
  if (emailInqui) {
    try {
      const inqui = await getUserByEmail(emailInqui);
      inquiName = inqui?.nombre || inqui?.name || inqui?.email || "";
    } catch (err) {
      console.warn("[prop_alquileres] No se ha podido leer el inquilino", emailInqui, err);
    }
  }

  const inicio = formatDate(rental.fInicio);
  const fin = rental.fFin ? formatDate(rental.fFin)
                          : (rental.activo ? "En curso" : "No indicado");

  const estado = rental.activo ? "Alquiler activo" : "Finalizado";
  const claseEstado = rental.activo
    ? "alquiler-estado-activo"
    : "alquiler-estado-finalizado";

  card.innerHTML = `
    <div class="alquiler-card-inner">
      <div class="alquiler-card-img">
        <img src="${img}" alt="Habitación en ${ciudad}">
      </div>
      <div class="alquiler-card-body">
        <h3 class="alquiler-card-title">${ciudad} – ${direccion}</h3>
        <p class="alquiler-card-price">${precio}</p>

        <p class="alquiler-card-dates">
          <strong>Inicio:</strong> ${inicio}<br>
          <strong>Fin:</strong> ${fin}
        </p>

        <p class="alquiler-card-owner">
          <strong>Inquilino:</strong> ${inquiName || emailInqui || "—"}
        </p>

        <p class="alquiler-card-status ${claseEstado}">
          ${estado}
        </p>
      </div>
    </div>
  `;

  return card;
}

/* ============================================================
   UTILIDADES
============================================================ */
function formatDate(v) {
  if (!v) return "—";
  const d = v instanceof Date ? v : new Date(v);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-ES");
}

