// js/consultar_geolocalizacion.js

import {
  isLoggedIn,
  getSession,
  clearSession,
  getAllRooms,
  getAllRentals,
} from "./db.js";



import { geocodeAddress } from "./geocode.js"; // reutilizamos tu geocodificación

let map = null;
let circle = null;
let markers = [];
let roomsCache = [];
let activeInfoWindow = null; // 🔴 IMPORTANTE

// Calcula la disponibilidad de UNA habitación a partir de sus alquileres
function computeAvailabilityForRoom(alquileres, today = new Date()) {
  if (!alquileres || !alquileres.length) {
    // Nunca se ha alquilado: disponible ya
    return {
      isOccupied: false,
      availableFrom: today
    };
  }

  let lastFin = null;

  for (const a of alquileres) {
    // Adapta aquí el nombre del campo si es distinto:
    const finStr = a.fFinAlquiler || a.fFin || a.fechaFin || a.fecha_fin;
    if (!finStr) continue;

    const finDate = new Date(finStr);
    if (!lastFin || finDate > lastFin) {
      lastFin = finDate;
    }
  }

  if (!lastFin) {
    // No hay fechas válidas
    return {
      isOccupied: false,
      availableFrom: today
    };
  }

  const startOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );

  if (lastFin < startOfToday) {
    // El último alquiler terminó antes de hoy → libre ya
    return {
      isOccupied: false,
      availableFrom: today
    };
  }

  // Hay un alquiler que llega hasta una fecha >= hoy
  return {
    isOccupied: true,
    availableFrom: lastFin
  };
}

// ========================
// ARRANQUE
// ========================
document.addEventListener("DOMContentLoaded", async () => {
  // Proteger la página (interno de usuario logueado)
  if (!isLoggedIn()) {
    window.location.replace("login.html");
    return;
  }

  const session = getSession();
  renderHeaderUser(session);

  // Cargar habitaciones
  await loadRooms();


  setupForm();
  
});

// ========================
// HEADER USER
// ========================
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
        console.error("[geo] error limpiando sesión:", e);
        sessionStorage.clear();
      }
      window.location.replace("index.html");
    });
  }
}

// ========================
// CARGAR HABITACIONES
// ========================
async function loadRooms() {
  const resultsInfo = document.getElementById("resultsInfo");
  try {
    const [rooms, rentals] = await Promise.all([
      getAllRooms(),
      getAllRentals()
    ]);

    const today = new Date();

    // Para cada habitación, calculamos su estado en base a sus alquileres
    roomsCache = (rooms || []).map(room => {
      const alquileresDeEsta = (rentals || []).filter(
        a => a.idHabi === room.idHabi
      );

      const availability = computeAvailabilityForRoom(alquileresDeEsta, today);

      return {
        ...room,
        isOccupied: availability.isOccupied,
        availableFrom: availability.availableFrom
      };
    });

    // Filtramos las borradas lógicamente si usas deletedAt
    roomsCache = roomsCache.filter(r => !r.deletedAt);

    if (!roomsCache.length && resultsInfo) {
      resultsInfo.textContent = "No hay habitaciones disponibles en el sistema.";
    } else if (resultsInfo) {
      resultsInfo.textContent = "Introduce una dirección y pulsa “Buscar”.";
    }
  } catch (err) {
    console.error("[geo] Error cargando habitaciones:", err);
    if (resultsInfo) {
      resultsInfo.textContent = "Error cargando habitaciones.";
    }
  }
}

// ========================
// FORMULARIO
// ========================
function setupForm() {
  const form = document.getElementById("geoForm");
  const errEl = document.getElementById("formErr");

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    errEl.textContent = "";

    const addrInput = document.getElementById("centerAddress");
    const radiusSel = document.getElementById("radiusKm");

    const address = addrInput.value.trim();
    const radiusKm = parseFloat(radiusSel.value);

    if (!address) {
      errEl.textContent = "Introduce una dirección o ciudad para buscar.";
      return;
    }

    if (!window.google || !google.maps || !google.maps.geometry) {
      errEl.textContent = "El mapa todavía se está cargando. Inténtalo de nuevo en un momento.";
      return;
    }

    // Geocodificar centro
    errEl.textContent = "Obteniendo coordenadas del centro de búsqueda…";
    const coords = await geocodeAddress(address, "");
    if (!coords) {
      errEl.textContent = "No se han podido obtener coordenadas. Revisa la dirección.";
      return;
    }

    errEl.textContent = "";
    const centerLatLng = new google.maps.LatLng(coords.lat, coords.lon);

    // Crear mapa si aún no existe
    if (!map) {
      map = new google.maps.Map(document.getElementById("map"), {
        center: centerLatLng,
        zoom: 13,
        mapTypeId: "roadmap"
      });
    } else {
      map.setCenter(centerLatLng);
      map.setZoom(13);
    }

    // Dibujar círculo
    const radiusMeters = radiusKm * 1000;
    if (circle) {
      circle.setMap(null);
    }
    circle = new google.maps.Circle({
      map,
      center: centerLatLng,
      radius: radiusMeters,
      fillColor: "#1E4D68",
      fillOpacity: 0.18,
      strokeColor: "#1E4D68",
      strokeOpacity: 0.7,
      strokeWeight: 1.5
    });

    // Borrar marcadores anteriores
    markers.forEach(m => m.setMap(null));
    markers = [];

    // Filtrar habitaciones por radio
    const results = [];
    for (const room of roomsCache) {
      const rLat = Number(room.lat);
      const rLon = Number(room.lon);
      if (!rLat && !rLon) continue;

      const roomLatLng = new google.maps.LatLng(rLat, rLon);
      const distMeters = google.maps.geometry.spherical.computeDistanceBetween(centerLatLng, roomLatLng);
      const distKm = distMeters / 1000;

    if (distMeters <= radiusMeters) {
  const marker = new google.maps.Marker({
    map,
    position: roomLatLng,
    title: room.direccion || ""
  });
  markers.push(marker);

  const precioNum = Number(room.precio) || 0;
  const precioTexto = precioNum > 0
    ? `${precioNum.toLocaleString("es-ES")} €/mes`
    : "Precio no disponible";

  let disponibilidadTexto = "Disponible ahora";
  if (room.availableFrom) {
    const today = new Date();
    const startOfToday = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );

    if (room.availableFrom > startOfToday) {
      // Ocupada hasta availableFrom → disponible a partir de esa fecha
      disponibilidadTexto = `Disponible a partir del ${formatDate(room.availableFrom)}`;
    }
  }

  const contentHtml = `
    <div style="font-family: 'Open Sans', sans-serif; max-width: 230px;">
      <strong>${room.direccion || "Habitación"}</strong><br>
      <span>${room.ciudad || ""}</span><br>
      <span style="color:#1E4D68; font-weight:600;">${precioTexto}</span><br>
      <span style="font-size: 0.85rem; color:#666;">${disponibilidadTexto}</span>
    </div>
  `;

  const infoWin = new google.maps.InfoWindow({ content: contentHtml });

  marker.addListener("click", () => {
    if (activeInfoWindow) {
      activeInfoWindow.close();
    }
    activeInfoWindow = infoWin;
    infoWin.open(map, marker);
  });

  results.push({
    ...room,
    distanceKm: distKm
  });
}

    }

    renderResults(results, radiusKm, address);
  });
}
function formatDate(d) {
  if (!(d instanceof Date)) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}
// ========================
// RESULTADOS
// ========================
function renderResults(results, radiusKm, address) {
  const listEl = document.getElementById("resultsList");
  const infoEl = document.getElementById("resultsInfo");

  listEl.innerHTML = "";

  if (!results.length) {
    if (infoEl) {
      infoEl.textContent = `No se han encontrado habitaciones en un radio de ${radiusKm} km alrededor de “${address}”.`;
    }
    return;
  }

  if (infoEl) {
    infoEl.textContent = `${results.length} habitación(es) encontradas en un radio de ${radiusKm} km alrededor de “${address}”.`;
  }

  for (const room of results) {
    const card = document.createElement("article");
    card.className = "geo-room-card";

    const titleEl = document.createElement("div");
    titleEl.className = "geo-room-title";
    titleEl.textContent = room.direccion || "(Sin dirección)";

    const cityEl = document.createElement("div");
    cityEl.className = "geo-room-city";
    cityEl.textContent = room.ciudad || "";

    const priceEl = document.createElement("div");
    priceEl.className = "geo-room-price";
    const precioNum = Number(room.precio) || 0;
    priceEl.textContent = precioNum > 0
      ? `${precioNum.toLocaleString("es-ES")} €/mes`
      : "Precio no disponible";

    const distEl = document.createElement("div");
    distEl.className = "geo-room-distance";
    distEl.textContent = `Distancia aprox: ${room.distanceKm.toFixed(2)} km`;

    card.appendChild(titleEl);
    card.appendChild(cityEl);
    card.appendChild(priceEl);
    card.appendChild(distEl);

    listEl.appendChild(card);
  }
}
