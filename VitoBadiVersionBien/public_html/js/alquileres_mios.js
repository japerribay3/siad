// js/alquileres_mios.js
// Página "Mis Alquileres"

import {
  isLoggedIn,
  getSession,
  clearSession,
  getAllRentals,
  getRoomById,
  getUserByEmail
} from "./db.js";

document.addEventListener("DOMContentLoaded", async () => {
  if (!isLoggedIn()) {
    window.location.replace("login.html");
    return;
  }

  renderHeaderUser();

  try {
    await loadMyRentals();
  } catch (err) {
    console.error("[alquileres_mios] Error al cargar:", err);
    const container = document.getElementById("alquileresContainer");
    if (container) {
      container.innerHTML = `<p class="error">Error al cargar tus alquileres.</p>`;
    }
  }
});

function renderHeaderUser() {
  const loginBox = document.getElementById("loginBox");
  if (!loginBox) return;

  const session = getSession();
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

async function loadMyRentals() {
  const session = getSession();
  const email = session.email.toLowerCase();

  const container = document.getElementById("alquileresContainer");
  const emptyMsg  = document.getElementById("alquileresEmpty");

  if (!container) return;

  container.innerHTML = `<p class="loading-msg">Cargando tus alquileres…</p>`;
  if (emptyMsg) emptyMsg.style.display = "none";

  const rentals = await getAllRentals();
  const myRentals = rentals.filter(r =>
    (r.emailInqui || "").toLowerCase() === email
  );

  if (!myRentals.length) {
    container.innerHTML = "";
    if (emptyMsg) emptyMsg.style.display = "block";
    return;
  }

  myRentals.sort((a, b) => {
    if (a.activo && !b.activo) return -1;
    if (!a.activo && b.activo) return 1;
    return (b.fInicio || 0) - (a.fInicio || 0);
  });

  container.innerHTML = "";

  for (const rental of myRentals) {
    const card = await buildRentalCard(rental);
    container.appendChild(card);
  }
}

async function buildRentalCard(rental) {
  const card = document.createElement("article");
  card.className = "alquiler-card";

  let room = null;
  try {
    room = await getRoomById(rental.idHabi);
  } catch {}

  const ciudad = room?.ciudad || "Ciudad desconocida";
  const direccion = room?.direccion || "Dirección no disponible";
  const precio = typeof room?.precio === "number" ? `${room.precio} €/mes` : "Precio —";
  const img = room?.imagenBase64 || "./fotos/habitacion1.jpg";
  const emailPropie = room?.emailPropie || "";

  let ownerName = "";
  if (emailPropie) {
    try {
      const owner = await getUserByEmail(emailPropie);
      ownerName = owner?.nombre || owner?.email || "";
    } catch {}
  }

  const inicio = formatDate(rental.fInicio);
  const fin = rental.fFin ? formatDate(rental.fFin)
                          : (rental.activo ? "En curso" : "No indicado");
  const estado = rental.activo ? "Alquiler activo" : "Finalizado";
  const claseEstado = rental.activo ? "alquiler-estado-activo" : "alquiler-estado-finalizado";

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
          <strong>Propietario:</strong> ${ownerName || emailPropie}
        </p>
        <p class="alquiler-card-status ${claseEstado}">
          ${estado}
        </p>
      </div>
    </div>
  `;
  return card;
}

function formatDate(v) {
  if (!v) return "—";
  const d = v instanceof Date ? v : new Date(v);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-ES");
}
