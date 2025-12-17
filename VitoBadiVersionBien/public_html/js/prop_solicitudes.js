// js/prop_solicitudes.js
// "Solicitudes de mis habitaciones" (perfil Propietario)

import {
  isLoggedIn,
  getSession,
  clearSession,
  getRoomsByOwner,
  getAllRentals,
  getRequestsByRoom,
  getUserByEmail,
  acceptRequest
} from "./db.js";

document.addEventListener("DOMContentLoaded", async () => {
  if (!isLoggedIn()) {
    window.location.replace("login.html");
    return;
  }

  renderHeaderUser();

  try {
    await loadOwnerRequests();
  } catch (err) {
    console.error("[prop_solicitudes] Error al cargar:", err);
    const container = document.getElementById("propSolicitudesContainer");
    if (container) {
      container.innerHTML = `<p class="error">Error al cargar las solicitudes de tus habitaciones.</p>`;
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

/**
 * Requisito profe:
 *  - Se visualizan las habitaciones para las cuales hay o no solicitudes.
 *  - Por cada habitación: foto, dirección, precio, fechas inicio/fin del alquiler,
 *    y un botón “Ver posibles inquilinos” que muestra el detalle de cada uno.
 *  - Las listas estarán ordenadas por fecha de fin de alquiler.
 */
async function loadOwnerRequests() {
  const session = getSession();
  const ownerEmail = session.email.toLowerCase();

  const container = document.getElementById("propSolicitudesContainer");
  const emptyMsg  = document.getElementById("propSolicitudesEmpty");

  if (!container) return;

  container.innerHTML = `<p class="loading-msg">Cargando habitaciones y solicitudes…</p>`;
  if (emptyMsg) emptyMsg.style.display = "none";

  // 1) Habitaciones del propietario + todos los alquileres para saber fechas
  const [rooms, rentals] = await Promise.all([
    getRoomsByOwner(ownerEmail),
    getAllRentals()
  ]);

  if (!rooms.length) {
    container.innerHTML = "";
    if (emptyMsg) emptyMsg.style.display = "block";
    return;
  }

  const rentalsByRoom = {};
  for (const rent of rentals) {
    if (!rentalsByRoom[rent.idHabi]) {
      rentalsByRoom[rent.idHabi] = [];
    }
    rentalsByRoom[rent.idHabi].push(rent);
  }

  // Ordenamos habitaciones por fecha de fin de alquiler (último fin conocido)
  const roomsSorted = [...rooms].sort((a, b) => {
    const finsA = (rentalsByRoom[a.idHabi] || [])
      .map(r => r.fFin)
      .filter(Boolean);
    const finsB = (rentalsByRoom[b.idHabi] || [])
      .map(r => r.fFin)
      .filter(Boolean);

    const lastFinA = finsA.length ? Math.max(...finsA) : Number.MAX_SAFE_INTEGER;
    const lastFinB = finsB.length ? Math.max(...finsB) : Number.MAX_SAFE_INTEGER;

    return lastFinA - lastFinB;
  });

  container.innerHTML = "";

  for (const room of roomsSorted) {
    const card = await buildRoomWithRequestsCard(room, rentalsByRoom[room.idHabi] || []);
    container.appendChild(card);
  }
}

async function buildRoomWithRequestsCard(room, rentalsRoom) {
  const card = document.createElement("article");
  card.className = "prop-room-card";

  const imgSrc = room.imagenBase64 || "./fotos/habitacion1.jpg";
  const ciudad = room.ciudad || "Ciudad desconocida";
  const direccion = room.direccion || "Dirección no disponible";
  const precio = typeof room.precio === "number" ? room.precio : null;

  // Para mostrar fechas de alquiler de referencia (por ejemplo, el último alquiler)
  let ultimaInicio = null;
  let ultimaFin = null;

  if (rentalsRoom.length) {
    rentalsRoom.sort((a, b) => (b.fInicio || 0) - (a.fInicio || 0));
    const last = rentalsRoom[0];
    ultimaInicio = last.fInicio || null;
    ultimaFin = last.fFin || null;
  }

  const inicioStr = formatDate(ultimaInicio);
  const finStr = ultimaFin ? formatDate(ultimaFin) : "—";

  // Contenedor de solicitudes (se rellena después)
  const requestsContainerId = `reqs-${room.idHabi}`;

  card.innerHTML = `
    <div class="prop-room-img-wrapper">
      <img src="${imgSrc}" alt="Habitación" class="prop-room-img">
    </div>

    <div class="prop-room-body">
      <div class="prop-room-header-row">
        <div>
          <h2 class="prop-room-title">${ciudad}</h2>
          <p class="prop-room-address">${direccion}</p>
        </div>
        <div class="prop-room-price-block">
          <span class="prop-room-price">
            ${precio != null ? precio.toFixed(0) + " €/mes" : "Precio no disponible"}
          </span>
        </div>
      </div>

      <div class="prop-room-meta">
        <p><strong>Último alquiler - inicio:</strong> ${inicioStr}</p>
        <p><strong>Último alquiler - fin:</strong> ${finStr}</p>
      </div>

      <div class="prop-room-actions">
        <button type="button" class="prop-room-toggle-btn" data-target="${requestsContainerId}">
          Ver posibles inquilinos
        </button>
      </div>

      <div id="${requestsContainerId}" class="prop-requests-wrapper" hidden>
        <p class="prop-requests-loading">Cargando posibles inquilinos…</p>
      </div>
    </div>
  `;

  // Botón toggle
  const toggleBtn = card.querySelector(".prop-room-toggle-btn");
  const requestsWrapper = card.querySelector(`#${requestsContainerId}`);

  if (toggleBtn && requestsWrapper) {
    let loaded = false;

    toggleBtn.addEventListener("click", async () => {
      const isHidden = requestsWrapper.hasAttribute("hidden");

      if (isHidden && !loaded) {
        // Primera vez que se despliega: cargar solicitudes desde la BD
        await fillRequestsForRoom(room.idHabi, requestsWrapper);
        loaded = true;
      }

      if (isHidden) {
        requestsWrapper.removeAttribute("hidden");
        toggleBtn.textContent = "Ocultar posibles inquilinos";
      } else {
        requestsWrapper.setAttribute("hidden", "");
        toggleBtn.textContent = "Ver posibles inquilinos";
      }
    });
  }

  return card;
}

/**
 * Rellena el contenedor con la lista de solicitudes de una habitación
 */
async function fillRequestsForRoom(idHabi, wrapper) {
  wrapper.innerHTML = `<p class="prop-requests-loading">Cargando posibles inquilinos…</p>`;

  let requests = [];
  try {
    requests = await getRequestsByRoom(idHabi);
  } catch (err) {
    console.error("[prop_solicitudes] Error getRequestsByRoom:", err);
    wrapper.innerHTML = `<p class="error">Error al cargar las solicitudes.</p>`;
    return;
  }

  if (!requests.length) {
    wrapper.innerHTML = `<p class="prop-requests-empty">Esta habitación no tiene solicitudes todavía.</p>`;
    return;
  }

  // Ordenamos por fecha fin de alquiler NO se puede porque la solicitud no lleva fFin.
  // Como el enunciado habla de "ordenadas por fecha de fin de alquiler",
  // usamos la fecha de solicitud como aproximación temporal.
  requests.sort((a, b) => (a.fechaSolicitud || 0) - (b.fechaSolicitud || 0));

  wrapper.innerHTML = "";
  const list = document.createElement("div");
  list.className = "prop-requests-list";

  for (const req of requests) {
    const row = await buildRequestRow(req);
    list.appendChild(row);
  }

  wrapper.appendChild(list);
}

async function buildRequestRow(req) {
  const row = document.createElement("div");
  row.className = "prop-request-row";

  let user = null;
  try {
    user = await getUserByEmail(req.emailInquiPosible);
  } catch (err) {
    console.warn("[prop_solicitudes] No se pudo obtener usuario de solicitud:", err);
  }

  const nombre = user?.name || req.emailInquiPosible;
  const email  = user?.email || req.emailInquiPosible;

  const fechaSolicitud = formatDate(req.fechaSolicitud);
  const estado = (req.estado || "pending").toLowerCase();

  let estadoLabel = "Pendiente";
  if (estado === "accepted") estadoLabel = "Aceptada";
  else if (estado === "rejected") estadoLabel = "Rechazada";
  else if (estado === "cancelled") estadoLabel = "Cancelada";

  const estadoClass =
    estado === "accepted" ? "is-accepted"
    : estado === "rejected" ? "is-rejected"
    : estado === "cancelled" ? "is-cancelled"
    : "is-pending";

  row.innerHTML = `
    <div class="prop-request-main">
      <p class="prop-request-name">${nombre}</p>
      <p class="prop-request-email">${email}</p>
    </div>
    <div class="prop-request-info">
      <p><strong>Fecha solicitud:</strong> ${fechaSolicitud}</p>
      <span class="prop-request-estado ${estadoClass}">
        ${estadoLabel}
      </span>
    </div>
    <div class="prop-request-actions">
      ${
        estado === "pending"
          ? `<button type="button" class="prop-request-accept-btn">Aceptar solicitud</button>`
          : ""
      }
    </div>
  `;

  // Botón "Aceptar solicitud" → usamos acceptRequest de db.js
  if (estado === "pending") {
    const btn = row.querySelector(".prop-request-accept-btn");
    if (btn) {
      btn.addEventListener("click", async () => {
        if (!confirm("¿Aceptar esta solicitud? Se creará el alquiler y se marcarán las demás como rechazadas.")) {
          return;
        }
        btn.disabled = true;
        btn.textContent = "Procesando…";
        try {
          await acceptRequest(req.idSolicitud);
          alert("Solicitud aceptada correctamente.");
          window.location.reload();
        } catch (err) {
          console.error("[prop_solicitudes] Error acceptRequest:", err);
          alert("Error al aceptar la solicitud.");
          btn.disabled = false;
          btn.textContent = "Aceptar solicitud";
        }
      });
    }
  }

  return row;
}

function formatDate(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "—";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}