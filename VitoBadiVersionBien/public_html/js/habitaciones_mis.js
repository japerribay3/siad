// js/habitaciones_mis.js

import {
  isLoggedIn,
  getSession,
  clearSession,
  getRoomsByOwner
} from "./db.js";

document.addEventListener("DOMContentLoaded", async () => {
  // 1) Proteger la página
  if (!isLoggedIn()) {
    window.location.replace("login.html");
    return;
  }

  const session = getSession();
  renderHeaderUser(session);

  // 2) Cargar habitaciones del propietario
  await loadRooms(session);
});

/**
 * Pinta en el header el usuario actual (avatar, nombre y botón Logout)
 */
function renderHeaderUser(session) {
  const loginBox = document.getElementById("loginBox");
  if (!loginBox) return;

  if (!session) {
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
      <span>${nombre}</span>
      <button id="logoutBtn" class="vb-login-btn">Logout</button>
    </div>
  `;

  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      try {
        if (typeof clearSession === "function") {
          clearSession();
        } else {
          sessionStorage.clear();
        }
      } catch (e) {
        console.error("[mis habitaciones] error limpiando sesión:", e);
        sessionStorage.clear();
      }
      window.location.replace("index.html");
    });
  }
}

/**
 * Carga las habitaciones del propietario y las pinta en #roomsList
 */
async function loadRooms(session) {
  const listEl = document.getElementById("roomsList");
  const emptyMsgEl = document.getElementById("emptyMsg");

  if (!listEl || !session?.email) return;

  listEl.innerHTML = "";
  if (emptyMsgEl) emptyMsgEl.style.display = "none";

  let rooms = [];
  try {
    rooms = await getRoomsByOwner(session.email);
  } catch (err) {
    console.error("[mis habitaciones] error cargando habitaciones:", err);
  }

  // Filtramos las borradas lógicamente si usas deletedAt
  rooms = (rooms || []).filter(r => !r.deletedAt);

  if (!rooms.length) {
    if (emptyMsgEl) emptyMsgEl.style.display = "block";
    return;
  }

  for (const room of rooms) {
    const card = createRoomCard(room);
    listEl.appendChild(card);
  }
}

/**
 * Crea la tarjeta HTML de una habitación
 */
function createRoomCard(room) {
  const {
    idHabi,
    direccion,
    ciudad,
    precio,
    lat,
    lon,
    imagenBase64
  } = room;

  const card = document.createElement("article");
  card.className = "mis-room-card";

  // Imagen (fallback si no hay imagenBase64)
  const img = document.createElement("img");
  img.className = "mis-room-img";
  if (imagenBase64 && typeof imagenBase64 === "string" && imagenBase64.startsWith("data:image")) {
    img.src = imagenBase64;
  } else {
    // Si quieres, puedes poner una ruta a una imagen por defecto
    // img.src = "./fotos/habitacion1.jpg";
    img.style.background = "#ddd";
  }
  img.alt = "Habitación";

  const body = document.createElement("div");
  body.className = "mis-room-body";

  const cityEl = document.createElement("div");
  cityEl.className = "mis-room-city";
  cityEl.textContent = ciudad || "";

  const addrEl = document.createElement("div");
  addrEl.className = "mis-room-address";
  addrEl.textContent = direccion || "";

  const priceEl = document.createElement("div");
  priceEl.className = "mis-room-price";
  const precioNum = Number(precio) || 0;
  priceEl.textContent = precioNum > 0
    ? `${precioNum.toLocaleString("es-ES")} €/mes`
    : "Precio no disponible";

  const coordsEl = document.createElement("div");
  coordsEl.className = "mis-room-coords";
  const latVal = Number(lat) || 0;
  const lonVal = Number(lon) || 0;
  coordsEl.textContent = `Lat: ${latVal.toFixed(4)} · Lon: ${lonVal.toFixed(4)}`;

  const actions = document.createElement("div");
  actions.className = "mis-room-actions";

  const btnVer = document.createElement("button");
  btnVer.className = "mis-room-btn";
  btnVer.textContent = "Ver detalles";
  btnVer.addEventListener("click", () => {
    // Aquí podrías abrir otra página tipo habitacion_detalle.html?id=idHabi
    alert("Vista de detalles todavía no implementada.\nID habitación: " + idHabi);
  });

  const btnDel = document.createElement("button");
  btnDel.className = "mis-room-btn danger";
  btnDel.textContent = "Eliminar";
  btnDel.addEventListener("click", () => {
    // De momento solo avisamos; cuando tengas deleteRoom en db.js lo conectamos aquí
    alert("Eliminar habitación todavía no está implementado en la BD.\nID habitación: " + idHabi);
  });

  actions.appendChild(btnVer);
  actions.appendChild(btnDel);

  body.appendChild(cityEl);
  body.appendChild(addrEl);
  body.appendChild(priceEl);
  body.appendChild(coordsEl);
  body.appendChild(actions);

  card.appendChild(img);
  card.appendChild(body);

  return card;
}
