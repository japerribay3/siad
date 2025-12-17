// js/app.js
import {
  isLoggedIn,
  getSession,
  clearSession,
  getAllRooms,
  getAllRentals
} from "./db.js";

document.addEventListener("DOMContentLoaded", async () => {
  renderHeaderUser();

  setupSearchForm();
});

/* =========================
   HEADER LOGIN / LOGOUT
========================= */

function renderHeaderUser() {
  const loginBox = document.getElementById("loginBox");
  if (!loginBox) return;

  if (!isLoggedIn()) {
    loginBox.innerHTML = `
      <a href="login.html" class="vb-login-btn">Login</a>
    `;
    return;
  }

  const session = getSession();
  if (!session) {
    loginBox.innerHTML = `
      <a href="login.html" class="vb-login-btn">Login</a>
    `;
    return;
  }

  const nombre = session.nombre || session.email || "";
  const foto = session.foto || session.fotoBase64 || "";

  const avatarHtml = foto
    ? `<img src="${foto}" alt="Avatar" class="header-user-avatar">`
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
      clearSession();
      window.location.replace("index.html");
    });
  }
}

/* =========================
   FORMULARIO DE BÚSQUEDA
========================= */

function setupSearchForm() {
  const form = document.getElementById("searchForm");
  if (!form) return;

  const errEl = document.getElementById("formErr"); // opcional

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (errEl) errEl.textContent = "";

    const cityInput =
      document.getElementById("city") ||
      document.getElementById("citySelect");

    const dateInput =
      document.getElementById("date") ||
      document.getElementById("startDate");

    const ciudad = cityInput ? cityInput.value : "";
    const fechaStr = dateInput ? dateInput.value : "";

    if (!ciudad || !fechaStr) {
      if (errEl) errEl.textContent = "Debes seleccionar ciudad y fecha.";
      return;
    }

    const fechaBusqueda = new Date(fechaStr);
    if (isNaN(fechaBusqueda.getTime())) {
      if (errEl) errEl.textContent = "La fecha seleccionada no es válida.";
      return;
    }

    try {
      await runGenericSearch(ciudad, fechaBusqueda);
    } catch (err) {
      console.error("[index] Error en búsqueda genérica:", err);
      if (errEl) errEl.textContent = "Error al realizar la búsqueda.";
    }
  });
}

/* =========================
   LÓGICA DE DISPONIBILIDAD
========================= */

// alquileres = array de alquileres de ESA habitación
// referenceDate = fecha a partir de la cual se quiere residir
function computeAvailabilityForRoom(alquileres, referenceDate) {
  if (!alquileres || !alquileres.length) {
    // Nunca se ha alquilado → disponible desde siempre
    return {
      availableFrom: new Date(0) // 1970 → siempre <= fecha de búsqueda
    };
  }

  let lastFin = null;

  for (const a of alquileres) {
    const finStr =
      a.fFinAlquiler || a.fFin || a.fechaFin || a.fecha_fin;
    if (!finStr) continue;

    const finDate = new Date(finStr);
    if (!lastFin || finDate > lastFin) {
      lastFin = finDate;
    }
  }

  if (!lastFin) {
    // No hay fechas válidas
    return {
      availableFrom: new Date(0)
    };
  }

  // Si el último alquiler termina antes de la fecha de referencia,
  // la habitación está disponible a partir de la fecha de referencia.
  // Pero para comparar es más cómodo devolver lastFin y luego filtrar.
  return {
    availableFrom: lastFin
  };
}

/* =========================
   EJECUTAR BÚSQUEDA GENÉRICA
========================= */

async function runGenericSearch(ciudad, fechaBusqueda) {
  const resultsContainer = document.getElementById("resultsContainer");
  if (!resultsContainer) return;

  resultsContainer.innerHTML = "Buscando habitaciones…";

  const logged = isLoggedIn();
  const session = logged ? getSession() : null;
  const emailActual = session?.email || null;

  // 1) Cargar habitaciones + alquileres
  const [rooms, rentals] = await Promise.all([
    getAllRooms(),
    getAllRentals()
  ]);

  const today = new Date();

  // 2) Decorar habitaciones con disponibilidad calculada para la fecha de búsqueda
  let decoratedRooms = (rooms || []).map((room) => {
    const alquileresDeEsta = (rentals || []).filter(
      (a) => a.idHabi === room.idHabi
    );

    const availability = computeAvailabilityForRoom(
      alquileresDeEsta,
      fechaBusqueda
    );

    return {
      ...room,
      availability
    };
  });

  // 3) Filtro por ciudad
  decoratedRooms = decoratedRooms.filter(
    (r) => (r.ciudad || "").toLowerCase() === ciudad.toLowerCase()
  );

  // 4) Filtro por disponibilidad a partir de la fecha seleccionada
  decoratedRooms = decoratedRooms.filter((r) => {
    const lastFin = r.availability.availableFrom;

    // Caso "nunca alquilada" o sin fechas → availableFrom = 1970, siempre <= fechaBusqueda
    if (!(lastFin instanceof Date) || isNaN(lastFin.getTime())) {
      return true;
    }

    // Si el último alquiler termina antes de la fecha de búsqueda → OK
    // (es decir, está libre cuando el usuario quiere entrar)
    return lastFin < fechaBusqueda;
  });

  // 5) Si el usuario está logeado: NO mostrar habitaciones que sean suyas
  if (logged && emailActual) {
    decoratedRooms = decoratedRooms.filter(
      (r) => r.emailPropie !== emailActual
    );
  }

  // 6) Ordenar por precio ascendente
  decoratedRooms.sort((a, b) => {
    const pa = Number(a.precio) || 0;
    const pb = Number(b.precio) || 0;
    return pa - pb;
  });

  // 7) Pintar resultados
  resultsContainer.innerHTML = "";

  if (!decoratedRooms.length) {
    resultsContainer.textContent = "No se han encontrado habitaciones para esa ciudad y fecha.";
    return;
  }

  decoratedRooms.forEach((room) => {
    const card = createRoomCard(room, { logged, fechaBusqueda });
    resultsContainer.appendChild(card);
  });
}

/* =========================
   PINTAR TARJETAS
========================= */

function createRoomCard(room, { logged, fechaBusqueda }) {
  const card = document.createElement("article");
  card.className = "search-room-card";

  // Imagen
  const img = document.createElement("img");
  img.className = "search-room-img";
  if (room.imagenBase64 && typeof room.imagenBase64 === "string") {
    img.src = room.imagenBase64;
  }

  if (!logged) {
    img.classList.add("search-room-img--blur");
  }

  // Texto
  const body = document.createElement("div");
  body.className = "search-room-body";

  const addrEl = document.createElement("div");
  addrEl.className = "search-room-address";
  addrEl.textContent = room.direccion || "(Sin dirección)";

  const priceEl = document.createElement("div");
  priceEl.className = "search-room-price";
  const precioNum = Number(room.precio) || 0;
  priceEl.textContent =
    precioNum > 0
      ? `${precioNum.toLocaleString("es-ES")} €/mes`
      : "Precio no disponible";

  body.appendChild(addrEl);
  body.appendChild(priceEl);

  // Si está logeado, mostramos lat/lon
  if (logged) {
    const coordsEl = document.createElement("div");
    coordsEl.className = "search-room-coords";

    const latVal = Number(room.lat) || 0;
    const lonVal = Number(room.lon) || 0;

    coordsEl.textContent = `Lat: ${latVal.toFixed(4)} · Lon: ${lonVal.toFixed(4)}`;
    body.appendChild(coordsEl);
  }

  card.appendChild(img);
  card.appendChild(body);

  // Comportamiento al clickar
  if (!logged) {
    // Usuario anónimo → debe ir a login para ver más detalles
    card.addEventListener("click", () => {
      window.location.href = "login.html";
    });
  } else {
    // Usuario logeado → aquí podrías abrir detalles de habitación
    card.addEventListener("click", () => {
      // Por ejemplo, cuando implementes detalle:
      // window.location.href = `habitacion_detalle.html?id=${room.idHabi}`;
      alert("Vista de detalles todavía no implementada.");
    });
  }

  return card;
}
