// js/solicitudes_mias.js
// Página "Mis Solicitudes" (vista del inquilino)

import {
  openDB,
  isLoggedIn,
  getSession,
  clearSession,
  getRoomById,
  getUserByEmail,
  updateRequest
} from "./db.js";

document.addEventListener("DOMContentLoaded", async () => {
  // 1) Proteger la página
  if (!isLoggedIn()) {
    window.location.replace("login.html");
    return;
  }

  // 2) Header usuario
  renderHeaderUser();

  // 3) Cargar mis solicitudes
  try {
    await loadMyRequests();
  } catch (err) {
    console.error("[solicitudes_mias] Error al cargar:", err);
    const container = document.getElementById("solicitudesContainer");
    if (container) {
      container.innerHTML = `<p class="error">Error al cargar tus solicitudes.</p>`;
    }
  }
});

/* ============================================================
   HEADER USUARIO
============================================================ */
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

/* ============================================================
   CARGAR MIS SOLICITUDES
============================================================ */
async function loadMyRequests() {
  const session = getSession();
  const email = session.email.trim().toLowerCase();

  const container = document.getElementById("solicitudesContainer");
  const emptyMsg  = document.getElementById("solicitudesEmpty");

  if (!container) {
    console.warn("[solicitudes_mias] No existe #solicitudesContainer en el HTML");
    return;
  }

  container.innerHTML = `<p class="loading-msg">Cargando tus solicitudes…</p>`;
  if (emptyMsg) emptyMsg.style.display = "none";

  const myRequests = await getMyRequestsFromDB(email);

  if (!myRequests.length) {
    container.innerHTML = "";
    if (emptyMsg) emptyMsg.style.display = "block";
    return;
  }

  // Orden: pending → rejected → cancelled → otros, y por fecha desc
  myRequests.sort((a, b) => {
    const order = (estado) => {
      if (estado === "pending") return 0;
      if (estado === "rejected") return 1;
      if (estado === "cancelled") return 2;
      return 3;
    };
    const diffEstado = order(a.estado) - order(b.estado);
    if (diffEstado !== 0) return diffEstado;
    return (b.fechaSolicitud || 0) - (a.fechaSolicitud || 0);
  });

  container.innerHTML = "";

  for (const request of myRequests) {
    const card = await buildRequestCard(request);
    container.appendChild(card);
  }
}

/* ============================================================
   LEER MIS SOLICITUDES DE INDEXEDDB
============================================================ */
async function getMyRequestsFromDB(email) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("solicitud", "readonly");
    const store = tx.objectStore("solicitud");
    const idx = store.index("emailInquiPosible_idx");
    const req = idx.getAll(email);

    req.onsuccess = () => {
      const all = req.result || [];
      // 🔴 No mostramos las aceptadas (ya tienen alquiler)
      const vivos = all.filter(
        r => !r.deletedAt && r.estado !== "accepted"
      );
      resolve(vivos);
    };
    req.onerror = () => reject(req.error);
  });
}

/* ============================================================
   CARD DE SOLICITUD
============================================================ */
async function buildRequestCard(request) {
  const card = document.createElement("article");
  card.className = "solicitud-card";

  // 1) Datos de la habitación
  let room = null;
  try {
    room = await getRoomById(request.idHabi);
  } catch (err) {
    console.warn("[solicitudes_mias] No se ha podido leer la habitación", request.idHabi, err);
  }

  const ciudad    = room?.ciudad || "Ciudad desconocida";
  const direccion = room?.direccion || "Dirección no disponible";
  const precio    = typeof room?.precio === "number" ? `${room.precio} €/mes` : "Precio —";
  const img       = room?.imagenBase64 || "./fotos/habitacion1.jpg";
  const emailPropie = room?.emailPropie || "";

  // 2) Propietario
  let ownerName = "";
  if (emailPropie) {
    try {
      const owner = await getUserByEmail(emailPropie);
      ownerName = owner?.nombre || owner?.email || "";
    } catch (err) {
      console.warn("[solicitudes_mias] No se ha podido leer el propietario", emailPropie, err);
    }
  }

  // 3) Fecha y estado
  const fecha = formatDateTime(request.fechaSolicitud);
  const { textoEstado, claseEstado } = mapEstado(request.estado);

  card.innerHTML = `
    <div class="solicitud-card-inner">
      <div class="solicitud-card-img">
        <img src="${img}" alt="Habitación en ${ciudad}">
      </div>

      <div class="solicitud-card-body">
        <h3 class="solicitud-card-title">${ciudad} – ${direccion}</h3>

        <p class="solicitud-card-price">${precio}</p>

        <p class="solicitud-card-dates">
          <strong>Fecha solicitud:</strong> ${fecha}
        </p>

        <p class="solicitud-card-owner">
          <strong>Propietario:</strong> ${ownerName || emailPropie || "—"}
        </p>

        <p class="solicitud-card-status ${claseEstado}">
          ${textoEstado}
        </p>

        <div class="solicitud-card-actions"></div>
      </div>
    </div>
  `;

  const actions = card.querySelector(".solicitud-card-actions");

  // 4) Botón CANCELAR para pendientes
  if (request.estado === "pending" && actions) {
    const btnCancel = document.createElement("button");
    btnCancel.className = "solicitud-btn-cancel";
    btnCancel.textContent = "Cancelar solicitud";

    btnCancel.addEventListener("click", async () => {
      const ok = confirm("¿Seguro que quieres cancelar esta solicitud?");
      if (!ok) return;

      try {
        request.estado = "cancelled";
        await updateRequest(request);
        await loadMyRequests();
      } catch (err) {
        console.error("[solicitudes_mias] Error al cancelar:", err);
        alert("No se ha podido cancelar la solicitud.");
      }
    });

    actions.appendChild(btnCancel);
  }

  // 5) Botón ELIMINAR para rechazadas
  if (request.estado === "rejected" && actions) {
    const btnDelete = document.createElement("button");
    btnDelete.className = "solicitud-btn-delete";
    btnDelete.textContent = "Eliminar solicitud";

    btnDelete.addEventListener("click", async () => {
      const ok = confirm("¿Seguro que quieres eliminar esta solicitud?");
      if (!ok) return;

      try {
        request.deletedAt = Date.now(); // borrado lógico
        await updateRequest(request);
        await loadMyRequests();
      } catch (err) {
        console.error("[solicitudes_mias] Error al eliminar:", err);
        alert("No se ha podido eliminar la solicitud.");
      }
    });

    actions.appendChild(btnDelete);
  }

  return card;
}

/* ============================================================
   HELPERS
============================================================ */
function formatDateTime(value) {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function mapEstado(estado) {
  switch (estado) {
    case "pending":
      return { textoEstado: "Pendiente de respuesta", claseEstado: "solicitud-estado-pending" };
    case "accepted":
      // No se muestran, pero por si acaso
      return { textoEstado: "Aceptada (tienes un alquiler)", claseEstado: "solicitud-estado-accepted" };
    case "rejected":
      // 🔴 Texto que pedías
      return { textoEstado: "Solicitud denegada", claseEstado: "solicitud-estado-rejected" };
    case "cancelled":
      return { textoEstado: "Cancelada por ti", claseEstado: "solicitud-estado-cancelled" };
    default:
      return { textoEstado: estado || "Desconocido", claseEstado: "solicitud-estado-other" };
  }
}
